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
};
