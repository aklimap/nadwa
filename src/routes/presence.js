/**
 * Signes de vie de la page pendant la visio (présences) : sans compte, protégés par le secret
 * de la session de présence. « depart » est aussi appelé par navigator.sendBeacon à la fermeture.
 */
const express = require('express');
const presences = require('../presences');

const routeur = express.Router();
routeur.post('/:id/vu', (req, res) => {
  const p = presences.session(req.params.id, req.query.secret);
  if (p) presences.signeDeVie(p);
  res.json({ ok: Boolean(p) });
});
routeur.post('/:id/depart', (req, res) => {
  const p = presences.session(req.params.id, req.query.secret);
  if (p) presences.partir(p);
  res.json({ ok: Boolean(p) });
});
module.exports = routeur;
