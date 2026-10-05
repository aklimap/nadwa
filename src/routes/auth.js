const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ouvrirSession, fermerSession, exigerConnexion } = require('../auth');
const { verifierCompte, espacesDe, espacePersonnel } = require('../metier');
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
  espacePersonnel(utilisateur, t(req, 'equipe_perso'));
  ouvrirSession(res, utilisateur);
  res.status(201).json({ utilisateur, espaces: espacesDe(utilisateur) });
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

// Modifier son profil : nom, et mot de passe (l'actuel est demandé).
routeur.patch('/moi', exigerConnexion, (req, res) => {
  const nom = String(req.body?.nom ?? '').trim();
  const actuel = String(req.body?.mot_de_passe_actuel ?? '');
  const nouveau = String(req.body?.nouveau_mot_de_passe ?? '');
  if (nom.length < 2 || nom.length > 80) return res.status(400).json({ erreur: t(req, 'nom_invalide') });
  if (nouveau) {
    const ligne = db.prepare('SELECT mot_de_passe FROM utilisateurs WHERE id = ?').get(req.utilisateur.id);
    if (!bcrypt.compareSync(actuel, ligne.mot_de_passe)) return res.status(400).json({ erreur: t(req, 'mdp_actuel_faux') });
    if (nouveau.length < 8) return res.status(400).json({ erreur: t(req, 'mdp_court') });
    db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').run(bcrypt.hashSync(nouveau, 10), req.utilisateur.id);
  }
  db.prepare('UPDATE utilisateurs SET nom = ? WHERE id = ?').run(nom, req.utilisateur.id);
  res.json({ utilisateur: { ...req.utilisateur, nom } });
});

routeur.get('/moi', exigerConnexion, (req, res) => {
  res.json({ utilisateur: req.utilisateur, espaces: espacesDe(req.utilisateur) });
});

module.exports = routeur;
