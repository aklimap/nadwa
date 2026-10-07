const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { ouvrirSession, fermerSession, exigerConnexion } = require('../auth');
const { verifierCompte, espacesDe, espacePersonnel } = require('../metier');
const { t, langueDe } = require('../i18n');
const crypto = require('crypto');
const mail = require('../mail');

/** Adresse publique de la plateforme, pour les liens des e-mails. */
const urlDe = (req) => config.urlPublique || `${req.protocol}://${req.get('host')}`;

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
    .prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, langue) VALUES (?, ?, ?, ?)')
    .run(champs.nom, champs.email, bcrypt.hashSync(champs.motDePasse, 10), langueDe(req));

  const utilisateur = profil({ id: Number(lastInsertRowid), nom: champs.nom, email: champs.email });
  espacePersonnel(utilisateur, t(req, 'equipe_perso'));
  mail.bienvenue({ email: champs.email, nom: champs.nom, langue: langueDe(req), url: urlDe(req) }); // sans attendre
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
  db.prepare('UPDATE utilisateurs SET langue = ? WHERE id = ?').run(langueDe(req), ligne.id);
  ouvrirSession(res, utilisateur);
  res.json({ utilisateur, espaces: espacesDe(utilisateur) });
});

// ---------- Mot de passe oublié ----------
const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');

// Demande : réponse identique que le compte existe ou non (pour ne pas révéler les adresses inscrites).
routeur.post('/mot-de-passe-oublie', async (req, res) => {
  if (!mail.actif()) return res.status(503).json({ erreur: t(req, 'mail_indisponible') });
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const u = db.prepare('SELECT id, nom, email FROM utilisateurs WHERE email = ?').get(email);
  if (u) {
    const recentes = db.prepare("SELECT COUNT(*) AS n FROM reinitialisations WHERE utilisateur_id = ? AND cree_le > ?")
      .get(u.id, new Date(Date.now() - 3600_000).toISOString()).n;
    if (recentes < 3) { // au plus 3 demandes par heure
      const jeton = crypto.randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO reinitialisations (utilisateur_id, jeton_hash, expire_le) VALUES (?, ?, ?)')
        .run(u.id, empreinte(jeton), new Date(Date.now() + 3600_000).toISOString());
      await mail.reinitialisation({ email: u.email, nom: u.nom, langue: langueDe(req), lien: `${urlDe(req)}/reinitialiser/${jeton}` });
    }
  }
  res.json({ ok: true });
});

// Nouveau mot de passe avec le jeton reçu par e-mail ; la personne est ensuite connectée.
routeur.post('/reinitialiser', (req, res) => {
  const jeton = String(req.body?.jeton ?? '');
  const motDePasse = String(req.body?.mot_de_passe ?? '');
  const demande = db.prepare('SELECT * FROM reinitialisations WHERE jeton_hash = ?').get(empreinte(jeton));
  if (!demande || demande.utilise || demande.expire_le < new Date().toISOString()) {
    return res.status(400).json({ erreur: t(req, 'reinit_invalide') });
  }
  if (motDePasse.length < 8) return res.status(400).json({ erreur: t(req, 'mdp_court') });
  db.transaction(() => {
    db.prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?').run(bcrypt.hashSync(motDePasse, 10), demande.utilisateur_id);
    db.prepare('UPDATE reinitialisations SET utilise = 1 WHERE utilisateur_id = ?').run(demande.utilisateur_id); // tous les liens précédents expirent
  })();
  const ligne = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(demande.utilisateur_id);
  mail.motDePasseChange({ email: ligne.email, nom: ligne.nom, langue: langueDe(req) });
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
    mail.motDePasseChange({ email: req.utilisateur.email, nom: nom, langue: langueDe(req) });
  }
  db.prepare('UPDATE utilisateurs SET nom = ? WHERE id = ?').run(nom, req.utilisateur.id);
  res.json({ utilisateur: { ...req.utilisateur, nom } });
});

routeur.get('/moi', exigerConnexion, (req, res) => {
  res.json({ utilisateur: req.utilisateur, espaces: espacesDe(req.utilisateur) });
});

module.exports = routeur;
