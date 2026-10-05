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

  inscriptionOuverte: process.env.INSCRIPTION_OUVERTE !== 'false',
  // false : seul l'exploitant (superadmin) peut créer de nouveaux espaces
  creationEspaceOuverte: process.env.CREATION_ESPACE_OUVERTE !== 'false',

  bbbUrl: (process.env.BBB_URL || '').trim(),
  bbbSecret: (process.env.BBB_SECRET || '').trim(),
  jitsiDomaine: (process.env.JITSI_DOMAINE || 'meet.jit.si').trim(),
};
