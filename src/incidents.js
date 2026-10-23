/** Incidents de visio signalés automatiquement par les pages (gardés et envoyés à l'exploitant). */
const db = require('./db');
const config = require('./config');
const mail = require('./mail');

function adressesSoutien() {
  const env = (process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || '').trim();
  if (env) return env;
  return db.prepare('SELECT email FROM utilisateurs WHERE est_superadmin = 1').all().map((u) => u.email).join(',');
}

function signaler({ seance, qui, utilisateurId = null, details, navigateur }) {
  const texte = String(typeof details === 'string' ? details : JSON.stringify(details ?? '')).slice(0, 1500);
  const message = `Visio : ${texte}`;
  const page = `reunion ${seance.id}`;
  const ua = String(navigateur || '').slice(0, 300);
  db.prepare("INSERT INTO retours (utilisateur_id, type, message, page, navigateur) VALUES (?, 'visio', ?, ?, ?)").run(utilisateurId, message, page, ua);
  const a = adressesSoutien();
  if (!a) return;
  mail.envoyer({
    a, langue: 'fr',
    sujet: `[Nadwa · visio] Problème de connexion audio/vidéo — ${seance.titre}`,
    titre: 'Problème de connexion audio/vidéo',
    paragraphes: [
      `Réunion : ${seance.titre} (n° ${seance.id})`,
      `Personne : ${qui}`,
      `Détail : ${texte}`,
      `Appareil : ${ua}`,
      "Cause la plus fréquente : le serveur vidéo (Jitsi, Hetzner) n'est pas joignable en UDP 10000 (pare-feu), ou son adresse IP publique n'est pas annoncée (JVB_ADVERTISE_IPS). Voir le README, section Visio.",
    ],
    bouton: 'Ouvrir Nadwa', lien: config.urlPublique || 'https://nadwalive.com',
  });
}

module.exports = { signaler };
