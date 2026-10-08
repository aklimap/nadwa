/** Soutien technique (aide et commentaires) et évaluation de la qualité des réunions. */
const express = require('express');
const db = require('../db');
const config = require('../config');
const mail = require('../mail');
const { exigerConnexion } = require('../auth');
const { t } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);

const TYPES = ['probleme', 'suggestion', 'question'];
const PROBLEMES = ['son', 'image', 'coupures', 'partage', 'lenteur', 'autre'];

/** Adresses de l'exploitant : SUPPORT_EMAIL, sinon ADMIN_EMAIL, sinon les comptes exploitants. */
function adressesSoutien() {
  const env = (process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || '').trim();
  if (env) return env;
  return db.prepare('SELECT email FROM utilisateurs WHERE est_superadmin = 1').all().map((u) => u.email).join(',');
}

routeur.post('/retour', (req, res) => {
  const u = req.utilisateur;
  const type = TYPES.includes(req.body?.type) ? req.body.type : 'question';
  const message = String(req.body?.message ?? '').trim().slice(0, 4000);
  if (message.length < 5) return res.status(400).json({ erreur: t(req, 'retour_trop_court') });
  const recents = db.prepare("SELECT COUNT(*) AS n FROM retours WHERE utilisateur_id = ? AND cree_le > ?")
    .get(u.id, new Date(Date.now() - 3600_000).toISOString()).n;
  if (recents >= 10) return res.status(429).json({ erreur: t(req, 'retour_trop_nombreux') });
  const page = String(req.body?.page ?? '').slice(0, 200);
  const navigateur = String(req.get('user-agent') || '').slice(0, 300);
  db.prepare('INSERT INTO retours (utilisateur_id, type, message, page, navigateur) VALUES (?, ?, ?, ?, ?)').run(u.id, type, message, page, navigateur);

  const a = adressesSoutien();
  if (a) {
    mail.envoyer({
      a, langue: 'fr',
      sujet: `[Nadwa · ${type}] ${message.slice(0, 60)}`,
      titre: `Nouveau message : ${type}`,
      paragraphes: [message, `De : ${u.nom} <${u.email}>`, `Page : ${page || '—'}`, `Navigateur : ${navigateur}`],
      bouton: 'Ouvrir Nadwa', lien: config.urlPublique || 'https://nadwalive.com',
    });
  }
  res.status(201).json({ ok: true });
});

routeur.post('/evaluation', (req, res) => {
  const note = Number(req.body?.note);
  if (!Number.isInteger(note) || note < 1 || note > 5) return res.status(400).json({ erreur: t(req, 'evaluation_note') });
  const problemes = (Array.isArray(req.body?.problemes) ? req.body.problemes : []).filter((p) => PROBLEMES.includes(p)).join(',');
  const commentaire = String(req.body?.commentaire ?? '').trim().slice(0, 1000) || null;
  const seanceId = Number(req.body?.seance_id) || null;
  const conversationId = Number(req.body?.conversation_id) || null;
  const duree = Math.max(0, Math.min(86400, Number(req.body?.duree_s) || 0));
  const seance = seanceId && db.prepare('SELECT id FROM seances WHERE id = ?').get(seanceId);
  const conv = conversationId && db.prepare('SELECT 1 FROM conversation_membres WHERE conversation_id = ? AND utilisateur_id = ?').get(conversationId, req.utilisateur.id);
  db.prepare(`INSERT INTO evaluations (utilisateur_id, seance_id, conversation_id, note, problemes, commentaire, duree_s)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(req.utilisateur.id, seance ? seanceId : null, conv ? conversationId : null, note, problemes || null, commentaire, duree);
  res.status(201).json({ ok: true });
});

module.exports = routeur;
