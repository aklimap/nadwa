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

// ---------- Vérification de l'adresse e-mail ----------
const empreinte = (jeton) => crypto.createHash('sha256').update(jeton).digest('hex');
const VERIFICATION_HEURES = 48;

/** Envoie le lien de vérification (au plus 3 par heure). Renvoie false si la limite est atteinte. */
async function envoyerVerification(req, u) {
  const recentes = db.prepare('SELECT COUNT(*) AS n FROM verifications_email WHERE utilisateur_id = ? AND cree_le > ?')
    .get(u.id, new Date(Date.now() - 3600_000).toISOString()).n;
  if (recentes >= 3) return false;
  const jeton = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO verifications_email (utilisateur_id, jeton_hash, expire_le) VALUES (?, ?, ?)')
    .run(u.id, empreinte(jeton), new Date(Date.now() + VERIFICATION_HEURES * 3600_000).toISOString());
  await mail.verification({ email: u.email, nom: u.nom, langue: langueDe(req), lien: `${urlDe(req)}/verifier/${jeton}` });
  return true;
}

// Tout le monde peut créer un compte ; les droits viennent ensuite des espaces rejoints.
// Si l'envoi d'e-mails est configuré, le compte n'est utilisable qu'après avoir cliqué le lien reçu.
routeur.post('/inscription', async (req, res, next) => {
  try {
    if (!config.inscriptionOuverte) {
      return res.status(403).json({ erreur: t(req, 'inscription_fermee') });
    }
    const champs = lireChamps(req.body);
    const erreur = verifierCompte(champs);
    if (erreur) return res.status(400).json({ erreur: t(req, erreur) });
    const verifier = mail.actif();
    const existant = db.prepare('SELECT id, email_verifie FROM utilisateurs WHERE email = ?').get(champs.email);
    // Une adresse déjà vérifiée est prise ; une inscription jamais confirmée peut être reprise.
    if (existant && (existant.email_verifie || !verifier)) {
      return res.status(409).json({ erreur: t(req, 'compte_existe') });
    }
    const hash = bcrypt.hashSync(champs.motDePasse, 10);
    let id;
    if (existant) {
      db.prepare('UPDATE utilisateurs SET nom = ?, mot_de_passe = ?, langue = ? WHERE id = ?').run(champs.nom, hash, langueDe(req), existant.id);
      id = existant.id;
    } else {
      id = Number(db.prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, langue, email_verifie) VALUES (?, ?, ?, ?, ?)')
        .run(champs.nom, champs.email, hash, langueDe(req), verifier ? 0 : 1).lastInsertRowid);
    }
    const utilisateur = profil({ id, nom: champs.nom, email: champs.email });
    if (!existant) espacePersonnel(utilisateur, t(req, 'equipe_perso'));

    if (verifier) {
      await envoyerVerification(req, utilisateur);
      return res.status(201).json({ verification: true, email: champs.email });
    }
    mail.bienvenue({ email: champs.email, nom: champs.nom, langue: langueDe(req), url: urlDe(req) }); // sans attendre
    ouvrirSession(res, utilisateur);
    res.status(201).json({ utilisateur, espaces: espacesDe(utilisateur) });
  } catch (err) { next(err); }
});

// Lien reçu par e-mail : l'adresse est confirmée et la personne est connectée.
routeur.post('/verifier', (req, res) => {
  const jeton = String(req.body?.jeton ?? '');
  const demande = db.prepare('SELECT * FROM verifications_email WHERE jeton_hash = ?').get(empreinte(jeton));
  if (!demande || demande.utilise || demande.expire_le < new Date().toISOString()) {
    return res.status(400).json({ erreur: t(req, 'verification_invalide') });
  }
  db.transaction(() => {
    db.prepare('UPDATE utilisateurs SET email_verifie = 1 WHERE id = ?').run(demande.utilisateur_id);
    db.prepare('UPDATE verifications_email SET utilise = 1 WHERE utilisateur_id = ?').run(demande.utilisateur_id);
  })();
  const ligne = db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(demande.utilisateur_id);
  mail.bienvenue({ email: ligne.email, nom: ligne.nom, langue: langueDe(req), url: urlDe(req) });
  const utilisateur = profil(ligne);
  ouvrirSession(res, utilisateur);
  res.json({ utilisateur, espaces: espacesDe(utilisateur) });
});

// Renvoyer le lien : réponse identique que l'adresse existe ou non.
routeur.post('/renvoyer-verification', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const u = db.prepare('SELECT id, nom, email, email_verifie FROM utilisateurs WHERE email = ?').get(email);
    if (u && !u.email_verifie && mail.actif()) {
      if (!(await envoyerVerification(req, u))) return res.status(429).json({ erreur: t(req, 'verification_trop') });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

routeur.post('/connexion', (req, res) => {
  const { email, motDePasse } = lireChamps(req.body);
  const ligne = db.prepare('SELECT * FROM utilisateurs WHERE email = ?').get(email);
  if (!ligne || !bcrypt.compareSync(motDePasse, ligne.mot_de_passe)) {
    return res.status(401).json({ erreur: t(req, 'identifiants') });
  }
  if (!ligne.email_verifie && mail.actif()) {
    return res.status(403).json({ erreur: t(req, 'email_non_verifie'), code: 'email_non_verifie' });
  }
  const utilisateur = profil(ligne);
  db.prepare('UPDATE utilisateurs SET langue = ? WHERE id = ?').run(langueDe(req), ligne.id);
  ouvrirSession(res, utilisateur);
  res.json({ utilisateur, espaces: espacesDe(utilisateur) });
});

// ---------- Mot de passe oublié ----------

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
    db.prepare('UPDATE utilisateurs SET mot_de_passe = ?, email_verifie = 1 WHERE id = ?').run(bcrypt.hashSync(motDePasse, 10), demande.utilisateur_id);
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
