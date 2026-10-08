/** Conversations directes : messages entre personnes et appels vidéo, comme dans Teams. */
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const visio = require('../visio');
const { exigerConnexion } = require('../auth');
const { contactsDe } = require('../metier');
const { t, langueDe } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);

const SQL_DM = `
  SELECT d.id, d.conversation_id, d.type, d.contenu, d.cree_le, u.id AS auteur_id, u.nom AS auteur_nom,
         d.fichier_id, f.nom AS fichier_nom, f.taille AS fichier_taille, f.type_mime AS fichier_type
  FROM messages_directs d LEFT JOIN utilisateurs u ON u.id = d.utilisateur_id
  LEFT JOIN fichiers f ON f.id = d.fichier_id`;

/** Résumé d'une conversation pour un utilisateur : autres membres, dernier message, non lus. */
function resume(conversationId, moiId) {
  const c = db.prepare('SELECT id, nom, maj_le, classe_id FROM conversations WHERE id = ?').get(conversationId);
  const membres = db.prepare(`
    SELECT u.id, u.nom, u.email FROM conversation_membres m JOIN utilisateurs u ON u.id = m.utilisateur_id
    WHERE m.conversation_id = ? AND u.id <> ? ORDER BY u.nom`).all(conversationId, moiId);
  const dernier = db.prepare(`${SQL_DM} WHERE d.conversation_id = ? ORDER BY d.id DESC LIMIT 1`).get(conversationId) || null;
  const lu = db.prepare('SELECT lu_jusqua FROM conversation_membres WHERE conversation_id = ? AND utilisateur_id = ?').get(conversationId, moiId)?.lu_jusqua ?? 0;
  const nonLus = db.prepare(`SELECT COUNT(*) AS n FROM messages_directs WHERE conversation_id = ? AND id > ? AND (utilisateur_id IS NULL OR utilisateur_id <> ?)`)
    .get(conversationId, lu, moiId).n;
  return { ...c, membres, dernier, non_lus: nonLus };
}

const estMembre = (conversationId, utilisateurId) =>
  Boolean(db.prepare('SELECT 1 FROM conversation_membres WHERE conversation_id = ? AND utilisateur_id = ?').get(conversationId, utilisateurId));

function trouver(req, res) {
  const id = Number(req.params.id);
  if (!estMembre(id, req.utilisateur.id)) { res.status(404).json({ erreur: t(req, 'conversation_introuvable') }); return null; }
  return id;
}

/** Envoie un événement à tous les membres d'une conversation (salle personnelle de chacun). */
function prevenir(req, conversationId, evenement, donnees) {
  const io = req.app?.get?.('io') || req;
  const ids = db.prepare('SELECT utilisateur_id FROM conversation_membres WHERE conversation_id = ?').all(conversationId).map((m) => m.utilisateur_id);
  let cible = io;
  for (const id of ids) cible = cible.to(`utilisateur:${id}`);
  cible.emit(evenement, donnees);
}

function ajouterMessage(conversationId, auteurId, contenu, type = 'texte', fichierId = null) {
  const { lastInsertRowid } = db.prepare('INSERT INTO messages_directs (conversation_id, utilisateur_id, type, contenu, fichier_id) VALUES (?, ?, ?, ?, ?)')
    .run(conversationId, auteurId, type, contenu, fichierId);
  db.prepare("UPDATE conversations SET maj_le = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(conversationId);
  db.prepare('UPDATE conversation_membres SET lu_jusqua = ? WHERE conversation_id = ? AND utilisateur_id = ?').run(lastInsertRowid, conversationId, auteurId);
  const message = db.prepare(`${SQL_DM} WHERE d.id = ?`).get(lastInsertRowid);
  require('../notifications').messageDirect(message); // notification sur le téléphone des autres membres
  return message;
}

// Personnes avec qui l'on peut discuter.
routeur.get('/contacts', (req, res) => res.json(contactsDe(req.utilisateur)));

routeur.get('/', (req, res) => {
  const ids = db.prepare(`
    SELECT c.id FROM conversations c JOIN conversation_membres m ON m.conversation_id = c.id
    WHERE m.utilisateur_id = ? ORDER BY c.maj_le DESC LIMIT 200`).all(req.utilisateur.id);
  res.json(ids.map(({ id }) => resume(id, req.utilisateur.id)).filter((c) => c.dernier || c.membres.length));
});

// Nouvelle conversation (ou la conversation à deux déjà existante).
routeur.post('/', (req, res) => {
  const moi = req.utilisateur.id;
  const autorises = new Set(contactsDe(req.utilisateur).map((c) => c.id));
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number))].filter((id) => autorises.has(id));
  if (!ids.length) return res.status(400).json({ erreur: t(req, 'choisir_personne') });
  const nom = String(req.body?.nom ?? '').trim().slice(0, 80) || null;

  if (ids.length === 1 && !nom) {
    const existante = db.prepare(`
      SELECT c.id FROM conversations c
      WHERE c.nom IS NULL
        AND (SELECT COUNT(*) FROM conversation_membres m WHERE m.conversation_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM conversation_membres m WHERE m.conversation_id = c.id AND m.utilisateur_id = ?)
        AND EXISTS (SELECT 1 FROM conversation_membres m WHERE m.conversation_id = c.id AND m.utilisateur_id = ?)`).get(moi, ids[0]);
    if (existante) return res.json(resume(existante.id, moi));
  }
  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO conversations (nom, cree_par) VALUES (?, ?)').run(nom, moi);
    const ajouter = db.prepare('INSERT INTO conversation_membres (conversation_id, utilisateur_id) VALUES (?, ?)');
    [moi, ...ids].forEach((u) => ajouter.run(lastInsertRowid, u));
    return Number(lastInsertRowid);
  })();
  res.status(201).json(resume(id, moi));
});

routeur.get('/:id/messages', (req, res) => {
  const id = trouver(req, res);
  if (!id) return;
  const messages = db.prepare(`SELECT * FROM (${SQL_DM} WHERE d.conversation_id = ? ORDER BY d.id DESC LIMIT 100) ORDER BY id ASC`).all(id);
  if (messages.length) {
    db.prepare('UPDATE conversation_membres SET lu_jusqua = ? WHERE conversation_id = ? AND utilisateur_id = ?')
      .run(messages[messages.length - 1].id, id, req.utilisateur.id);
  }
  res.json(messages);
});

routeur.post('/:id/lu', (req, res) => {
  const id = trouver(req, res);
  if (!id) return;
  const dernier = db.prepare('SELECT MAX(id) AS n FROM messages_directs WHERE conversation_id = ?').get(id).n || 0;
  db.prepare('UPDATE conversation_membres SET lu_jusqua = ? WHERE conversation_id = ? AND utilisateur_id = ?').run(dernier, id, req.utilisateur.id);
  res.json({ ok: true });
});

// Appel vidéo dans la conversation : même salle pour tous les membres.
// { rejoindre: true } = rejoindre l'appel en cours, sans annoncer un nouvel appel.
routeur.post('/:id/appel', async (req, res, next) => {
  try {
    const id = trouver(req, res);
    if (!id) return;
    let conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conv.reunion_id) {
      db.prepare('UPDATE conversations SET reunion_id = ? WHERE id = ?').run(`nadwa-appel-${id}-${crypto.randomBytes(8).toString('hex')}`, id);
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    }
    if (!req.body?.rejoindre) {
      const message = ajouterMessage(id, req.utilisateur.id, req.utilisateur.nom, 'appel');
      prevenir(req, id, 'dm:nouveau', message);
    }
    const nom = conv.nom || resume(id, req.utilisateur.id).membres.map((m) => m.nom).concat(req.utilisateur.nom).join(', ');
    res.json(await visio.lienVisio({
      seance: { reunion_id: conv.reunion_id, titre: t(req, 'appel') },
      classe: { id: 0, nom },
      utilisateur: req.utilisateur,
      moderateur: true,
      langue: langueDe(req),
      micro: req.body?.micro !== false,
      camera: req.body?.camera !== false,
      logo: `${req.protocol}://${req.get('host')}/logo-nadwa${langueDe(req) === 'ar' ? '-ar' : ''}.svg`,
    }));
  } catch (err) {
    next(err);
  }
});

module.exports = routeur;
module.exports.ajouterMessage = ajouterMessage;
module.exports.estMembre = estMembre;
module.exports.prevenir = prevenir;
