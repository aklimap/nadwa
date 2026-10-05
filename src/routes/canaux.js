const express = require('express');
const db = require('../db');
const { exigerConnexion } = require('../auth');
const { canalAccessible, estResponsable, SQL_MESSAGE } = require('../metier');
const { t } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);

function trouverCanal(req, res) {
  const acces = canalAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) res.status(404).json({ erreur: t(req, 'canal_introuvable') });
  return acces;
}

routeur.get('/:id/messages', (req, res) => {
  const acces = trouverCanal(req, res);
  if (!acces) return;
  const avant = Number(req.query.avant) || Number.MAX_SAFE_INTEGER;
  res.json(db.prepare(`
    SELECT * FROM (${SQL_MESSAGE} WHERE m.canal_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 100)
    ORDER BY id ASC`).all(acces.canal.id, avant));
});

// Supprimer un canal (et ses messages) ; General est permanent.
routeur.delete('/:id', (req, res) => {
  const acces = trouverCanal(req, res);
  if (!acces) return;
  const { canal, classe } = acces;
  if (!estResponsable(req.utilisateur, classe)) return res.status(403).json({ erreur: t(req, 'suppr_canal_owner') });
  if (canal.est_general) return res.status(400).json({ erreur: t(req, 'general_permanent') });
  db.prepare('DELETE FROM canaux WHERE id = ?').run(canal.id);
  req.app.get('io')?.to(`classe:${classe.id}`).emit('canaux:maj', { classe_id: classe.id });
  res.json({ ok: true });
});

module.exports = routeur;
