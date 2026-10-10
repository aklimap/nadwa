/** Vue d'ensemble pour l'exploitant de la plateforme (superadmin). */
const express = require('express');
const db = require('../db');
const { exigerConnexion, exigerSuperadmin } = require('../auth');

const routeur = express.Router();
routeur.use(exigerConnexion, exigerSuperadmin);

// Seuil indicatif de capacité du serveur de visio (participants simultanés).
// CPX22 (2 vCPU) : environ 250 ; CPX32 : environ 500. À ajuster avec CAPACITE_PARTICIPANTS.
const seuil = () => Number(process.env.CAPACITE_PARTICIPANTS) || 250;

function capacite() {
  const { mesurerCapacite } = require('../temps-reel');
  const depuis = (jours) => new Date(Date.now() - jours * 864e5).toISOString();
  const pic = (jours) => db.prepare('SELECT MAX(participants) AS participants, MAX(reunions) AS reunions FROM mesures_capacite WHERE horodatage >= ?').get(depuis(jours));
  const parJour = db.prepare(`SELECT substr(horodatage, 1, 10) AS jour, MAX(participants) AS participants, MAX(reunions) AS reunions
    FROM mesures_capacite WHERE horodatage >= ? GROUP BY jour ORDER BY jour`).all(depuis(30));
  return { maintenant: mesurerCapacite(), jour: pic(1), semaine: pic(7), mois: pic(30), par_jour: parJour, seuil: seuil() };
}

function qualite() {
  const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
  const resume = db.prepare('SELECT COUNT(*) AS n, AVG(note) AS moyenne FROM evaluations WHERE cree_le >= ?').get(depuis);
  const notes = db.prepare('SELECT note, COUNT(*) AS n FROM evaluations WHERE cree_le >= ? GROUP BY note').all(depuis);
  const problemes = {};
  for (const { problemes: p } of db.prepare('SELECT problemes FROM evaluations WHERE cree_le >= ? AND problemes IS NOT NULL').all(depuis)) {
    for (const x of p.split(',')) problemes[x] = (problemes[x] || 0) + 1;
  }
  const commentaires = db.prepare(`SELECT e.note, e.commentaire, e.problemes, e.cree_le, u.nom FROM evaluations e
    LEFT JOIN utilisateurs u ON u.id = e.utilisateur_id WHERE e.commentaire IS NOT NULL ORDER BY e.id DESC LIMIT 20`).all();
  return { n: resume.n, moyenne: resume.moyenne, notes, problemes, commentaires };
}

function comptes() {
  const depuis = (jours) => new Date(Date.now() - jours * 864e5).toISOString();
  const compter = (sql, ...params) => db.prepare(sql).get(...params).n;
  const nouveaux = (jours) => compter('SELECT COUNT(*) AS n FROM utilisateurs WHERE cree_le >= ?', depuis(jours));
  const actifs = (jours) => compter('SELECT COUNT(*) AS n FROM utilisateurs WHERE derniere_activite >= ?', depuis(jours));
  return {
    total: compter('SELECT COUNT(*) AS n FROM utilisateurs'),
    verifies: compter('SELECT COUNT(*) AS n FROM utilisateurs WHERE email_verifie = 1'),
    nouveaux: { jour: nouveaux(1), semaine: nouveaux(7), mois: nouveaux(30) },
    actifs: { jour: actifs(1), semaine: actifs(7), mois: actifs(30) },
    sans_organisation: compter(`SELECT COUNT(*) AS n FROM utilisateurs u WHERE NOT EXISTS (
      SELECT 1 FROM adhesions a JOIN espaces e ON e.id = a.espace_id WHERE a.utilisateur_id = u.id AND e.personnel = 0)`),
    par_jour: db.prepare(`SELECT substr(cree_le, 1, 10) AS jour, COUNT(*) AS n FROM utilisateurs
      WHERE cree_le >= ? GROUP BY jour ORDER BY jour`).all(depuis(30)),
    derniers: db.prepare(`SELECT nom, email, email_verifie, cree_le, derniere_activite FROM utilisateurs
      ORDER BY id DESC LIMIT 20`).all(),
  };
}

routeur.get('/', (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    comptes: comptes(),
    capacite: capacite(),
    qualite: qualite(),
    retours: db.prepare(`SELECT r.id, r.type, r.message, r.page, r.cree_le, u.nom, u.email FROM retours r
      LEFT JOIN utilisateurs u ON u.id = r.utilisateur_id ORDER BY r.id DESC LIMIT 50`).all(),
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
