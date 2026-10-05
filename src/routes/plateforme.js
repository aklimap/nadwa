/** Vue d'ensemble pour l'exploitant de la plateforme (superadmin). */
const express = require('express');
const db = require('../db');
const { exigerConnexion, exigerSuperadmin } = require('../auth');

const routeur = express.Router();
routeur.use(exigerConnexion, exigerSuperadmin);

routeur.get('/', (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    stats: {
      utilisateurs: n('SELECT COUNT(*) AS n FROM utilisateurs'),
      espaces: n('SELECT COUNT(*) AS n FROM espaces'),
      groupes: n('SELECT COUNT(*) AS n FROM classes'),
      seances: n('SELECT COUNT(*) AS n FROM seances'),
    },
    espaces: db.prepare(`
      SELECT e.id, e.nom, e.cree_le,
             (SELECT COUNT(*) FROM adhesions a WHERE a.espace_id = e.id) AS nb_membres,
             (SELECT COUNT(*) FROM classes c WHERE c.espace_id = e.id) AS nb_groupes
      FROM espaces e ORDER BY e.cree_le DESC`).all(),
  });
});

module.exports = routeur;
