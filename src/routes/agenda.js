const express = require('express');
const db = require('../db');
const { exigerConnexion } = require('../auth');
const { avecEtat, roleDansEspace, SQL_SEANCE } = require('../metier');
const { t } = require('../i18n');

const routeur = express.Router();

/**
 * Réunions de l'organisation, pour les équipes de l'utilisateur (toutes pour un administrateur).
 * - ?du=…&au=… (dates ISO) : toutes les réunions de la période, passées comprises (calendrier).
 * - sans période : les prochaines réunions.
 */
routeur.get('/', exigerConnexion, (req, res) => {
  const u = req.utilisateur;
  const espaceId = Number(req.query.espace);
  const role = roleDansEspace(u, espaceId);
  if (!role) return res.status(404).json({ erreur: t(req, 'org_introuvable') });

  const du = new Date(req.query.du);
  const au = new Date(req.query.au);
  const periode = !Number.isNaN(du.getTime()) && !Number.isNaN(au.getTime()) && au > du && au - du <= 62 * 864e5;

  const conditions = ['c.espace_id = ?'];
  const valeurs = [espaceId];
  if (periode) {
    // Inclut une réunion commencée la veille au soir qui déborde sur la période.
    conditions.push('s.debut >= ? AND s.debut < ?');
    valeurs.push(new Date(du - 6 * 3600_000).toISOString(), au.toISOString());
  } else {
    conditions.push('s.debut >= ?');
    valeurs.push(new Date(Date.now() - 6 * 3600_000).toISOString());
  }
  if (role !== 'admin') {
    conditions.push(`(c.responsable_id = ? OR c.id IN (SELECT classe_id FROM membres WHERE utilisateur_id = ?)
      OR s.id IN (SELECT seance_id FROM seance_invites WHERE utilisateur_id = ?))`);
    valeurs.push(u.id, u.id, u.id);
  }

  // acces_equipe = 0 : la personne est seulement invitée (elle ne voit pas l'équipe).
  const lignes = db.prepare(`
    SELECT x.*, (x.responsable_id = ? OR x.classe_id IN (SELECT classe_id FROM membres WHERE utilisateur_id = ?) OR ? = 'admin') AS acces_equipe
    FROM (${SQL_SEANCE} WHERE ${conditions.join(' AND ')} ORDER BY s.debut LIMIT 500) x`)
    .all(u.id, u.id, role, ...valeurs).map(avecEtat);
  res.json(periode ? lignes : lignes.filter((s) => s.etat !== 'terminee'));
});

module.exports = routeur;
