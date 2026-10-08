const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const config = require('./src/config');
const visio = require('./src/visio');
const brancherTempsReel = require('./src/temps-reel');
const amorcer = require('./src/amorcage');
const { t } = require('./src/i18n');

amorcer();

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'style-src': ["'self'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'"],
      // Visio Jitsi affichée dans la page : script de l'API IFrame et cadre de la réunion.
      'script-src': ["'self'", `https://${config.jitsiDomaine}`],
      'frame-src': ["'self'", `https://${config.jitsiDomaine}`],
      // En HTTP local, ne pas forcer le passage en HTTPS des ressources.
      'upgrade-insecure-requests': config.cookiesSecurises ? [] : null,
    },
  },
  crossOriginOpenerPolicy: false, // la visio s'ouvre dans un nouvel onglet
}));
// Les téléversements de fichiers lisent eux-mêmes le corps brut de la requête.
app.use((req, res, next) => (req.method === 'POST' && /\/fichiers$/.test(req.path) ? next() : express.json({ limit: '100kb' })(req, res, next)));
app.use(cookieParser());

// Santé et version : ouvrir /api/sante pour savoir quelle version est en ligne.
const { version } = require('./package.json');
app.get('/api/sante', (req, res) => res.json({ ok: true, version, visio: visio.fournisseur(), emails: Boolean(config.smtp.host) }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/espaces', require('./src/routes/espaces'));
app.use('/api/rejoindre', require('./src/routes/rejoindre'));
app.use('/api/classes', require('./src/routes/classes'));
app.use('/api/canaux', require('./src/routes/canaux'));
app.use('/api/seances', require('./src/routes/seances'));
app.use('/api/agenda', require('./src/routes/agenda'));
app.use('/api/plateforme', require('./src/routes/plateforme'));
app.use('/api/invite', require('./src/routes/invite'));
app.use('/api/conversations', require('./src/routes/conversations'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/aide', require('./src/routes/aide'));
app.use('/api', require('./src/routes/fichiers'));
app.use('/api', (req, res) => res.status(404).json({ erreur: t(req, 'route_inconnue') }));

// Page d'accueil : les fichiers de l'interface portent le numéro de version (?v=…), pour que
// chaque mise à jour soit chargée tout de suite, sans vider le cache du navigateur.
const pageAccueil = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
  .replace(/(href|src)="\/(style\.css|i18n\.js|app\.js)"/g, `$1="/$2?v=${version}"`);
const envoyerAccueil = (req, res) => res.set('Cache-Control', 'no-cache').type('html').send(pageAccueil);
app.get(['/', '/index.html'], envoyerAccueil);
// Service worker (notifications) : toujours la dernière version.
app.get('/sw.js', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'public', 'sw.js')));
// Appli Android (Play Store) : lien de confiance entre l'appli et le site.
// ANDROID_SHA256 = empreinte(s) SHA-256 du certificat de signature, séparées par des virgules.
app.get('/.well-known/assetlinks.json', (req, res) => {
  const empreintes = String(process.env.ANDROID_SHA256 || '').split(',').map((s) => s.trim()).filter(Boolean);
  res.json(empreintes.length ? [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: process.env.ANDROID_PACKAGE || 'com.nadwalive.app', sha256_cert_fingerprints: empreintes },
  }] : []);
});
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('*', envoyerAccueil);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    const { t } = require('./src/i18n');
    return res.status(413).json({ erreur: t(req, 'fichier_trop_gros', { max: config.tailleMaxMo }) });
  }
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ erreur: err.expose ? err.message : t(req, 'erreur_interne') });
});

const serveur = http.createServer(app);
const io = new Server(serveur);
app.set('io', io);
brancherTempsReel(io);

require('./src/notifications').demarrerRappels(); // rappels de réunion 30 min avant

serveur.listen(config.port, () => {
  console.log(`Nadwa is running: http://localhost:${config.port}  (video: ${visio.fournisseur()})`);
});
