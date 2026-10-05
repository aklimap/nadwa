const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ouvrirSession, fermerSession, exigerConnexion } = require('../auth');
const { verifierCompte, espacesDe } = require('../metier');
const { t } = require('../i18n');

const routeur = express.Router();

const lireChamps = (corps = {}) => ({
  nom: String(corps.nom ?? '').trim(),
  email: String(corps.email ?? '').trim().toLowerCase(),
  motDePasse: String(corps.mot_de_passe ?? ''),
});

const profil = (u) => ({ id: u.id, nom: u.nom, email: u.email, est_superadmin: Boolean(u.est_superadmin) });

// Tout le monde peut créer un compte ; les droits viennent ensuite des espaces rejoints.
routeur.post('/inscription', (req, res) => {
  if (!config.inscriptionOuverte) {
    return res.status(403).json({ erreur: t(req, 'inscription_fermee') });
  }
  const champs = lireChamps(req.body);
  const erreur = verifierCompte(champs);
  if (erreur) return res.status(400).json({ erreur: t(req, erreur) });
  if (db.prepare('SELECT 1 FROM utilisateurs WHERE email = ?').get(champs.email)) {
    return res.status(409).json({ erreur: t(req, 'compte_existe') });
  }

  const { lastInsertRowid } = db
    .prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe) VALUES (?, ?, ?)')
    .run(champs.nom, champs.email, bcrypt.hashSync(champs.motDePasse, 10));

  const utilisateur = profil({ id: Number(lastInsertRowid), nom: champs.nom, email: champs.email });
  ouvrirSession(res, utilisateur);
  res.status(201).json({ utilisateur, espaces: [] });
});

routeur.post('/connexion', (req, res) => {
  const { email, motDePasse } = lireChamps(req.body);
  const ligne = db.prepare('SELECT * FROM utilisateurs WHERE email = ?').get(email);
  if (!ligne || !bcrypt.compareSync(motDePasse, ligne.mot_de_passe)) {
    return res.status(401).json({ erreur: t(req, 'identifiants') });
  }
  const utilisateur = profil(ligne);
  ouvrirSession(res, utilisateur);
  res.json({ utilisateur, espaces: espacesDe(utilisateur) });
});

routeur.post('/deconnexion', (req, res) => {
  fermerSession(res);
  res.json({ ok: true });
});

routeur.get('/moi', exigerConnexion, (req, res) => {
  res.json({ utilisateur: req.utilisateur, espaces: espacesDe(req.utilisateur) });
});

module.exports = routeur;
