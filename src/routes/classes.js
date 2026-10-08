const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const db = require('../db');
const { exigerConnexion } = require('../auth');
const { t } = require('../i18n');
const {
  roleDansEspace, classeAccessible, estResponsable, classePourUtilisateur, avecEtat,
  nouveauCodeInvitation, nouvelIdReunion, OUVERTURE_AVANT_MIN,
  creerCanalGeneral, canauxDe, SQL_CANAL, SQL_SEANCE, ajouterInvites, jetonInvite,
} = require('../metier');

const routeur = express.Router();
routeur.use(exigerConnexion);

const DUREE_MAX_MIN = 300;

/** Y a-t-il une séance en direct dans ce groupe ? */
function classeEnDirect(classeId) {
  const maintenant = Date.now();
  const lignes = db.prepare('SELECT * FROM seances WHERE classe_id = ? AND debut <= ? AND debut >= ?').all(
    classeId,
    new Date(maintenant + OUVERTURE_AVANT_MIN * 60_000).toISOString(),
    new Date(maintenant - DUREE_MAX_MIN * 60_000).toISOString(),
  );
  return lignes.some((s) => avecEtat(s).etat === 'en_direct');
}

function trouverClasse(req, res) {
  const classe = classeAccessible(req.utilisateur, Number(req.params.id));
  if (!classe) res.status(404).json({ erreur: t(req, 'equipe_introuvable') });
  return classe;
}

/** Prévient l'équipe et les invités qu'une réunion a changé (calendriers mis à jour en direct). */
const annoncerSeances = (req, classeId, invites = []) => {
  const io = req.app.get('io');
  if (!io) return;
  let cible = io.to(`classe:${classeId}`);
  for (const id of invites) cible = cible.to(`utilisateur:${id}`);
  cible.emit('seances:maj', { classe_id: classeId });
};

// Groupes de l'utilisateur dans un espace (tous pour l'administrateur de l'espace).
routeur.get('/', (req, res) => {
  const u = req.utilisateur;
  const espaceId = Number(req.query.espace);
  const role = roleDansEspace(u, espaceId);
  if (!role) return res.status(404).json({ erreur: t(req, 'org_introuvable') });

  const base = `
    SELECT c.*, r.nom AS responsable_nom,
           (SELECT COUNT(*) FROM membres m WHERE m.classe_id = c.id) AS nb_membres
    FROM classes c JOIN utilisateurs r ON r.id = c.responsable_id
    WHERE c.espace_id = ?`;
  const lignes = role === 'admin'
    ? db.prepare(`${base} ORDER BY c.nom`).all(espaceId)
    : db.prepare(`${base}
        AND (c.responsable_id = ? OR c.id IN (SELECT classe_id FROM membres WHERE utilisateur_id = ?))
        ORDER BY c.nom`).all(espaceId, u.id, u.id);

  res.json(lignes.map((c) => ({ ...classePourUtilisateur(c, u), en_direct: classeEnDirect(c.id) })));
});

// Comme dans Teams : tout membre de l'organisation peut créer une équipe et en devient propriétaire.
routeur.post('/', (req, res) => {
  const espaceId = Number(req.body?.espace_id);
  const role = roleDansEspace(req.utilisateur, espaceId);
  if (!role) return res.status(404).json({ erreur: t(req, 'org_introuvable') });

  const nom = String(req.body?.nom ?? '').trim();
  const module = String(req.body?.module ?? '').trim() || null;
  const description = String(req.body?.description ?? '').trim() || null;
  if (!nom || nom.length > 100) return res.status(400).json({ erreur: t(req, 'nom_equipe') });

  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO classes (espace_id, nom, module, description, responsable_id, code_invitation)
      VALUES (?, ?, ?, ?, ?, ?)`).run(espaceId, nom, module, description, req.utilisateur.id, nouveauCodeInvitation());
    creerCanalGeneral(lastInsertRowid);
    return lastInsertRowid;
  })();
  res.status(201).json(classeAccessible(req.utilisateur, id));
});

routeur.get('/:id', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;
  const responsable = db.prepare('SELECT id, nom, email FROM utilisateurs WHERE id = ?').get(classe.responsable_id);
  const membres = db.prepare(`
    SELECT u.id, u.nom, u.email, m.rejoint_le
    FROM membres m JOIN utilisateurs u ON u.id = m.utilisateur_id
    WHERE m.classe_id = ? ORDER BY u.nom`).all(classe.id);

  res.json({
    classe: classePourUtilisateur(classe, req.utilisateur),
    responsable,
    membres,
    estResponsable: estResponsable(req.utilisateur, classe),
  });
});

// Supprimer l'équipe : canaux, messages, réunions et fichiers. Propriétaire ou administrateur.
routeur.delete('/:id', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;
  if (!estResponsable(req.utilisateur, classe)) return res.status(403).json({ erreur: t(req, 'suppr_equipe_owner') });
  const membres = db.prepare('SELECT utilisateur_id AS id FROM membres WHERE classe_id = ?').all(classe.id).map((m) => m.id);
  const fichiers = db.prepare(`SELECT f.stockage FROM fichiers f JOIN canaux c ON c.id = f.canal_id
    WHERE c.classe_id = ? AND f.stockage IS NOT NULL`).all(classe.id).map((f) => f.stockage);
  db.prepare('DELETE FROM classes WHERE id = ?').run(classe.id);
  for (const s of fichiers) fs.rm(path.join(config.fichiersDir, s), { force: true }, () => {});
  const io = req.app.get('io');
  if (io) {
    let cible = io.to(`classe:${classe.id}`).to(`utilisateur:${classe.responsable_id}`);
    for (const id of membres) cible = cible.to(`utilisateur:${id}`);
    cible.emit('classe:supprimee', { classe_id: classe.id });
  }
  res.json({ ok: true });
});

routeur.delete('/:id/membres/:utilisateurId', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;
  if (!estResponsable(req.utilisateur, classe)) return res.status(403).json({ erreur: t(req, 'retirer_membre_owner') });
  db.prepare('DELETE FROM membres WHERE classe_id = ? AND utilisateur_id = ?').run(classe.id, Number(req.params.utilisateurId));
  res.json({ ok: true });
});

routeur.get('/:id/canaux', (req, res) => {
  const classe = trouverClasse(req, res);
  if (classe) res.json(canauxDe(classe.id));
});

// Nouveau canal : propriétaires de l'équipe.
routeur.post('/:id/canaux', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;
  if (!estResponsable(req.utilisateur, classe)) return res.status(403).json({ erreur: t(req, 'ajout_canal_owner') });

  const nom = String(req.body?.nom ?? '').trim().replace(/^#+\s*/, '');
  const description = String(req.body?.description ?? '').trim() || null;
  const annonces = req.body?.annonces ? 1 : 0;
  if (!nom || nom.length > 50) return res.status(400).json({ erreur: t(req, 'nom_canal') });
  if (db.prepare('SELECT 1 FROM canaux WHERE classe_id = ? AND nom = ? COLLATE NOCASE').get(classe.id, nom)) {
    return res.status(409).json({ erreur: t(req, 'canal_existe') });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO canaux (classe_id, nom, description, annonces) VALUES (?, ?, ?, ?)')
    .run(classe.id, nom, description, annonces);
  req.app.get('io')?.to(`classe:${classe.id}`).emit('canaux:maj', { classe_id: classe.id });
  res.status(201).json(db.prepare(`${SQL_CANAL} WHERE id = ?`).get(lastInsertRowid));
});

routeur.get('/:id/seances', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;
  res.json(db.prepare(`${SQL_SEANCE} WHERE s.classe_id = ? ORDER BY s.debut ASC`).all(classe.id).map(avecEtat));
});

// Planifier une réunion : comme dans Teams, tout membre de l'équipe peut le faire et en devient l'organisateur.
// { immediat: true } = « Meet now » : la réunion commence tout de suite.
routeur.post('/:id/seances', (req, res) => {
  const classe = trouverClasse(req, res);
  if (!classe) return;

  const immediat = Boolean(req.body?.immediat);
  const titre = String(req.body?.titre ?? '').trim();
  const debut = immediat ? new Date() : new Date(req.body?.debut);
  const duree = Number(req.body?.duree_min) || (immediat ? 60 : 90);
  if (!titre || titre.length > 120) return res.status(400).json({ erreur: t(req, 'titre_reunion') });
  if (Number.isNaN(debut.getTime())) return res.status(400).json({ erreur: t(req, 'date_invalide') });
  if (duree < 15 || duree > DUREE_MAX_MIN) return res.status(400).json({ erreur: t(req, 'duree', { max: DUREE_MAX_MIN }) });

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO seances (classe_id, titre, debut, duree_min, reunion_id, organisateur_id)
    VALUES (?, ?, ?, ?, ?, ?)`).run(classe.id, titre, debut.toISOString(), duree, nouvelIdReunion(classe.id), req.utilisateur.id);
  const invites = ajouterInvites({ id: lastInsertRowid }, classe.espace_id, req.body?.participants);
  jetonInvite(lastInsertRowid);

  annoncerSeances(req, classe.id, invites);
  res.status(201).json(avecEtat(db.prepare(`${SQL_SEANCE} WHERE s.id = ?`).get(lastInsertRowid)));
});

module.exports = routeur;
module.exports.annoncerSeances = annoncerSeances;
