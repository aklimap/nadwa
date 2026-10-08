/**
 * Un seul champ « code » pour l'utilisateur :
 * - code d'espace (8 caractères) → rejoint l'organisation comme membre ;
 * - code de groupe (6 caractères) → rejoint le groupe et, si besoin, son espace.
 */
const express = require('express');
const db = require('../db');
const { exigerConnexion } = require('../auth');
const { roleDansEspace, estResponsable, clavardageEquipe } = require('../metier');
const { t } = require('../i18n');

const routeur = express.Router();

routeur.post('/', exigerConnexion, (req, res) => {
  const u = req.utilisateur;
  const code = String(req.body?.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const adherer = db.prepare("INSERT OR IGNORE INTO adhesions (espace_id, utilisateur_id, role) VALUES (?, ?, 'membre')");

  const espace = db.prepare('SELECT id, nom FROM espaces WHERE code_invitation = ?').get(code);
  if (espace) {
    adherer.run(espace.id, u.id);
    return res.json({ type: 'espace', espace_id: espace.id, nom: espace.nom });
  }

  const classe = db.prepare('SELECT * FROM classes WHERE code_invitation = ?').get(code);
  if (!classe) return res.status(404).json({ erreur: t(req, 'code_inconnu') });

  db.transaction(() => {
    if (!roleDansEspace(u, classe.espace_id)) adherer.run(classe.espace_id, u.id);
    if (!estResponsable(u, classe)) {
      db.prepare('INSERT OR IGNORE INTO membres (classe_id, utilisateur_id) VALUES (?, ?)').run(classe.id, u.id);
    }
  })();
  clavardageEquipe(classe); // le nouveau membre rejoint le clavardage de l'équipe
  res.json({ type: 'classe', espace_id: classe.espace_id, classe_id: classe.id, nom: classe.nom });
});

module.exports = routeur;
