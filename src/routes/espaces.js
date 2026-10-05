const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { exigerConnexion } = require('../auth');
const { t } = require('../i18n');
const {
  ROLES_ESPACE, verifierCompte, roleDansEspace, espacesDe,
  espacePourUtilisateur, nouveauCodeEspace,
} = require('../metier');

const routeur = express.Router();
routeur.use(exigerConnexion);

/** Charge l'espace et le rôle de l'utilisateur ; répond 404/403 sinon. */
function chargerEspace(req, res, { admin = false } = {}) {
  const espace = db.prepare('SELECT * FROM espaces WHERE id = ?').get(Number(req.params.id));
  const role = espace && roleDansEspace(req.utilisateur, espace.id);
  if (!role) { res.status(404).json({ erreur: t(req, 'org_introuvable') }); return {}; }
  if (admin && role !== 'admin') { res.status(403).json({ erreur: t(req, 'admins_seulement') }); return {}; }
  return { espace, role };
}

routeur.get('/', (req, res) => res.json(espacesDe(req.utilisateur)));

// Créer un espace : la personne qui le crée en devient administratrice.
routeur.post('/', (req, res) => {
  if (!config.creationEspaceOuverte && !req.utilisateur.est_superadmin) {
    return res.status(403).json({ erreur: t(req, 'creation_org_fermee') });
  }
  const nom = String(req.body?.nom ?? '').trim();
  if (nom.length < 2 || nom.length > 100) return res.status(400).json({ erreur: t(req, 'nom_org') });

  const id = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO espaces (nom, code_invitation, cree_par) VALUES (?, ?, ?)')
      .run(nom, nouveauCodeEspace(), req.utilisateur.id);
    db.prepare("INSERT INTO adhesions (espace_id, utilisateur_id, role) VALUES (?, ?, 'admin')")
      .run(lastInsertRowid, req.utilisateur.id);
    return Number(lastInsertRowid);
  })();
  res.status(201).json(espacePourUtilisateur(db.prepare('SELECT * FROM espaces WHERE id = ?').get(id), 'admin'));
});

routeur.get('/:id', (req, res) => {
  const { espace, role } = chargerEspace(req, res);
  if (espace) res.json(espacePourUtilisateur(espace, role));
});

routeur.get('/:id/stats', (req, res) => {
  const { espace } = chargerEspace(req, res, { admin: true });
  if (!espace) return;
  const roles = Object.fromEntries(ROLES_ESPACE.map((r) => [r, 0]));
  db.prepare('SELECT role, COUNT(*) AS n FROM adhesions WHERE espace_id = ? GROUP BY role').all(espace.id)
    .forEach(({ role, n }) => { roles[role] = n; });
  res.json({
    ...roles,
    groupes: db.prepare('SELECT COUNT(*) AS n FROM classes WHERE espace_id = ?').get(espace.id).n,
    seances_a_venir: db.prepare(`
      SELECT COUNT(*) AS n FROM seances s JOIN classes c ON c.id = s.classe_id
      WHERE c.espace_id = ? AND s.debut >= ?`).get(espace.id, new Date().toISOString()).n,
  });
});

// Annuaire : nom et e-mail des personnes de l'organisation (visible par tout membre, pour inviter).
routeur.get('/:id/annuaire', (req, res) => {
  const { espace } = chargerEspace(req, res);
  if (!espace) return;
  res.json(db.prepare(`
    SELECT u.id, u.nom, u.email FROM adhesions a JOIN utilisateurs u ON u.id = a.utilisateur_id
    WHERE a.espace_id = ? ORDER BY u.nom`).all(espace.id));
});

routeur.get('/:id/membres', (req, res) => {
  const { espace } = chargerEspace(req, res, { admin: true });
  if (!espace) return;
  res.json(db.prepare(`
    SELECT u.id, u.nom, u.email, a.role, a.rejoint_le
    FROM adhesions a JOIN utilisateurs u ON u.id = a.utilisateur_id
    WHERE a.espace_id = ? ORDER BY u.nom`).all(espace.id));
});

// Ajouter quelqu'un : compte existant (par e-mail) ou nouveau compte avec mot de passe provisoire.
routeur.post('/:id/membres', (req, res) => {
  const { espace } = chargerEspace(req, res, { admin: true });
  if (!espace) return;
  const nom = String(req.body?.nom ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const motDePasse = String(req.body?.mot_de_passe ?? '');
  const role = String(req.body?.role ?? 'membre');
  if (!ROLES_ESPACE.includes(role)) return res.status(400).json({ erreur: t(req, 'role_inconnu') });

  let utilisateur = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
  const compteExistant = Boolean(utilisateur);
  if (!utilisateur) {
    const erreur = verifierCompte({ nom, email, motDePasse });
    if (erreur) return res.status(400).json({ erreur: t(req, erreur) });
    const { lastInsertRowid } = db.prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe) VALUES (?, ?, ?)')
      .run(nom, email, bcrypt.hashSync(motDePasse, 10));
    utilisateur = { id: Number(lastInsertRowid) };
  }
  if (roleDansEspace({ id: utilisateur.id }, espace.id)) {
    return res.status(409).json({ erreur: t(req, 'deja_membre_org') });
  }
  db.prepare('INSERT INTO adhesions (espace_id, utilisateur_id, role) VALUES (?, ?, ?)').run(espace.id, utilisateur.id, role);
  res.status(201).json({ ok: true, compte_existant: compteExistant });
});

routeur.patch('/:id/membres/:uid', (req, res) => {
  const { espace } = chargerEspace(req, res, { admin: true });
  if (!espace) return;
  const uid = Number(req.params.uid);
  const role = String(req.body?.role ?? '');
  if (uid === req.utilisateur.id) return res.status(400).json({ erreur: t(req, 'propre_role') });
  if (!ROLES_ESPACE.includes(role)) return res.status(400).json({ erreur: t(req, 'role_inconnu') });
  const { changes } = db.prepare('UPDATE adhesions SET role = ? WHERE espace_id = ? AND utilisateur_id = ?').run(role, espace.id, uid);
  if (!changes) return res.status(404).json({ erreur: t(req, 'pas_membre_org') });
  res.json({ ok: true });
});

routeur.delete('/:id/membres/:uid', (req, res) => {
  const { espace } = chargerEspace(req, res, { admin: true });
  if (!espace) return;
  const uid = Number(req.params.uid);
  if (uid === req.utilisateur.id) return res.status(400).json({ erreur: t(req, 'se_retirer') });
  db.transaction(() => {
    db.prepare('DELETE FROM membres WHERE utilisateur_id = ? AND classe_id IN (SELECT id FROM classes WHERE espace_id = ?)').run(uid, espace.id);
    db.prepare('DELETE FROM adhesions WHERE espace_id = ? AND utilisateur_id = ?').run(espace.id, uid);
  })();
  res.json({ ok: true });
});

module.exports = routeur;
