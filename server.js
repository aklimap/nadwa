const http = require('http');
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
      // En HTTP local, ne pas forcer le passage en HTTPS des ressources.
      'upgrade-insecure-requests': config.cookiesSecurises ? [] : null,
    },
  },
  crossOriginOpenerPolicy: false, // la visio s'ouvre dans un nouvel onglet
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/espaces', require('./src/routes/espaces'));
app.use('/api/rejoindre', require('./src/routes/rejoindre'));
app.use('/api/classes', require('./src/routes/classes'));
app.use('/api/canaux', require('./src/routes/canaux'));
app.use('/api/seances', require('./src/routes/seances'));
app.use('/api/agenda', require('./src/routes/agenda'));
app.use('/api/plateforme', require('./src/routes/plateforme'));
app.get('/api/sante', (req, res) => res.json({ ok: true, visio: visio.fournisseur() }));
app.use('/api', (req, res) => res.status(404).json({ erreur: t(req, 'route_inconnue') }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ erreur: err.expose ? err.message : t(req, 'erreur_interne') });
});

const serveur = http.createServer(app);
const io = new Server(serveur);
app.set('io', io);
brancherTempsReel(io);

serveur.listen(config.port, () => {
  console.log(`Nadwa is running: http://localhost:${config.port}  (video: ${visio.fournisseur()})`);
});
