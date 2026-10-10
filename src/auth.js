const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const { t } = require('./i18n');

const NOM_COOKIE = 'nadwa_jeton';
const DUREE_SESSION_MS = 7 * 24 * 3600 * 1000;

const optionsCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookiesSecurises,
});

function ouvrirSession(res, utilisateur) {
  const jeton = jwt.sign({ sub: utilisateur.id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(NOM_COOKIE, jeton, { ...optionsCookie(), maxAge: DUREE_SESSION_MS });
}

function fermerSession(res) {
  res.clearCookie(NOM_COOKIE, optionsCookie());
}

/** Relit l'utilisateur en base : un compte supprimé ou modifié est pris en compte immédiatement. */
function utilisateurDepuisJeton(jeton) {
  if (!jeton) return null;
  try {
    const { sub } = jwt.verify(jeton, config.jwtSecret);
    const u = db.prepare('SELECT id, nom, email, est_superadmin FROM utilisateurs WHERE id = ?').get(sub);
    return u ? { ...u, est_superadmin: Boolean(u.est_superadmin) } : null;
  } catch {
    return null;
  }
}

function exigerConnexion(req, res, next) {
  const utilisateur = utilisateurDepuisJeton(req.cookies?.[NOM_COOKIE]);
  if (!utilisateur) return res.status(401).json({ erreur: t(req, 'auth_requise') });
  req.utilisateur = utilisateur;
  noterActivite(utilisateur.id);
  next();
}

/** Note la dernière activité, au plus une fois par heure (pour compter les utilisateurs actifs). */
function noterActivite(id) {
  const maintenant = new Date();
  const ilYaUneHeure = new Date(maintenant.getTime() - 3600e3).toISOString();
  try {
    db.prepare('UPDATE utilisateurs SET derniere_activite = ? WHERE id = ? AND (derniere_activite IS NULL OR derniere_activite < ?)')
      .run(maintenant.toISOString(), id, ilYaUneHeure);
  } catch { /* sans incidence sur la requête */ }
}

/** Réservé à l'exploitant de la plateforme. */
function exigerSuperadmin(req, res, next) {
  if (req.utilisateur?.est_superadmin) return next();
  res.status(403).json({ erreur: t(req, 'interdit') });
}

module.exports = {
  NOM_COOKIE,
  ouvrirSession,
  fermerSession,
  utilisateurDepuisJeton,
  exigerConnexion,
  exigerSuperadmin,
};
