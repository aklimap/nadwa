/** Réglages des notifications : abonnement push de l'appareil et préférences e-mail / push. */
const express = require('express');
const db = require('../db');
const { exigerConnexion } = require('../auth');
const notifications = require('../notifications');
const { t } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);

const preferences = (id) => {
  const p = db.prepare('SELECT notif_email, notif_push FROM utilisateurs WHERE id = ?').get(id);
  return { email: Boolean(p.notif_email), push: Boolean(p.notif_push), cle: notifications.clePublique() };
};

routeur.get('/', (req, res) => res.json(preferences(req.utilisateur.id)));

routeur.patch('/', (req, res) => {
  const { email, push } = req.body || {};
  if (typeof email === 'boolean') db.prepare('UPDATE utilisateurs SET notif_email = ? WHERE id = ?').run(Number(email), req.utilisateur.id);
  if (typeof push === 'boolean') db.prepare('UPDATE utilisateurs SET notif_push = ? WHERE id = ?').run(Number(push), req.utilisateur.id);
  res.json(preferences(req.utilisateur.id));
});

// Cet appareil reçoit les notifications push.
routeur.post('/abonnement', (req, res) => {
  if (!notifications.abonner(req.utilisateur.id, req.body)) return res.status(400).json({ erreur: t(req, 'notif_abonnement_invalide') });
  res.status(201).json({ ok: true });
});

routeur.delete('/abonnement', (req, res) => {
  notifications.desabonner(req.utilisateur.id, req.body?.endpoint);
  res.json({ ok: true });
});

// Notification d'essai sur ses propres appareils.
routeur.post('/essai', async (req, res) => {
  await notifications.pousser(req.utilisateur.id, { titre: t(req, 'notif_essai_titre'), texte: t(req, 'notif_essai_texte'), url: '/' });
  res.json({ ok: true });
});

module.exports = routeur;
