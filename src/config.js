require('dotenv').config();
const path = require('path');

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set: using a development secret. Set it before going to production.');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'secret-de-developpement-a-changer',
  cookiesSecurises: process.env.COOKIES_SECURISES === 'true',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nadwa.db'),
  // Fichiers partagés : par défaut à côté de la base (sur Render : le disque /var/data).
  fichiersDir: process.env.FICHIERS_DIR || path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'nadwa.db')), 'fichiers'),
  tailleMaxMo: Number(process.env.TAILLE_MAX_MO) || 25,

  // Adresse publique de la plateforme (liens dans les e-mails), ex. https://nadwa-xxxx.onrender.com
  urlPublique: (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, ''),
  // Envoi des e-mails (facultatif)
  smtp: {
    host: (process.env.SMTP_HOST || '').trim(),
    port: Number(process.env.SMTP_PORT) || 587,
    user: (process.env.SMTP_USER || '').trim(),
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || process.env.SMTP_USER || 'Nadwa <no-reply@nadwa.app>',
  },

  inscriptionOuverte: process.env.INSCRIPTION_OUVERTE !== 'false',
  // false : seul l'exploitant (superadmin) peut créer de nouveaux espaces
  creationEspaceOuverte: process.env.CREATION_ESPACE_OUVERTE !== 'false',

  bbbUrl: (process.env.BBB_URL || '').trim(),
  bbbSecret: (process.env.BBB_SECRET || '').trim(),
  jitsiDomaine: (process.env.JITSI_DOMAINE || 'meet.jit.si').trim(),
  // Serveur Jitsi privé sécurisé par jetons (JWT) : l'animateur entre sans mot de passe.
  jitsiAppId: (process.env.JITSI_APP_ID || '').trim(),
  jitsiAppSecret: (process.env.JITSI_APP_SECRET || '').trim(),

  // Limites d'usage (0 = pas de limite). Réglables sans toucher au code, ex. pour l'offre gratuite.
  limites: {
    participants: Number(process.env.LIMITE_PARTICIPANTS) || 0, // personnes connectées dans une même réunion
    dureeMin: Number(process.env.LIMITE_DUREE_MIN) || 0, // durée maximale d'une réunion, en minutes
    reunionsSimultanees: Number(process.env.LIMITE_REUNIONS_SIMULTANEES) || 0, // réunions ouvertes en même temps par organisation
  },

  // Éditeur du service, affiché dans les Conditions et la Politique de confidentialité.
  editeur: (process.env.EDITEUR_NOM || 'Nadwa').trim(), // ex. « EURL Nadwa »
  editeurAdresse: (process.env.EDITEUR_ADRESSE || '').trim(),
  contactEmail: (process.env.SUPPORT_EMAIL || 'contact@nadwalive.com').trim(),
  // Hébergement : false = phase pilote (Allemagne) ; true = serveurs en Algérie (HEBERGEUR = nom de l'hébergeur).
  hebergementAlgerie: process.env.HEBERGEMENT_ALGERIE === 'true',
  hebergeur: (process.env.HEBERGEUR || '').trim(),
  // Période gratuite : date du lancement public (AAAA-MM-JJ) et nombre de mois gratuits.
  dateLancement: (process.env.DATE_LANCEMENT || '').trim(),
  moisGratuits: Number(process.env.MOIS_GRATUITS) || 12,
};
