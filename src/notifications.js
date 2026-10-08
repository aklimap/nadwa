/**
 * Notifications : e-mail (SMTP, ex. Brevo) et notifications « push » sur téléphone et ordinateur.
 *
 * - Message direct, clavardage d'équipe, publication dans un canal : chaque destinataire est prévenu.
 *   Pour ne pas inonder les boîtes de réception, un seul e-mail part par conversation (ou canal)
 *   et par personne toutes les 10 minutes ; les notifications push, elles, partent à chaque message.
 * - Rappel de réunion 30 minutes avant le début, pour l'équipe et les personnes invitées.
 *
 * Les notifications push sont gratuites (Web Push : Chrome, Edge, Firefox, Android, et l'appli
 * Android Nadwa). Les clés VAPID sont créées au premier démarrage et gardées dans la base.
 */
const webpush = require('web-push');
const db = require('./db');
const config = require('./config');
const mail = require('./mail');
const { t } = require('./i18n');

const EMAIL_INTERVALLE_MS = 10 * 60_000;
const RAPPEL_AVANT_MIN = 30;

// ---------- Clés VAPID ----------
function reglage(cle) { return db.prepare('SELECT valeur FROM reglages WHERE cle = ?').get(cle)?.valeur || null; }
function definirReglage(cle, valeur) { db.prepare('INSERT OR REPLACE INTO reglages (cle, valeur) VALUES (?, ?)').run(cle, valeur); }

function clesVapid() {
  let publique = process.env.VAPID_PUBLIC_KEY || reglage('vapid_publique');
  let privee = process.env.VAPID_PRIVATE_KEY || reglage('vapid_privee');
  if (!publique || !privee) {
    ({ publicKey: publique, privateKey: privee } = webpush.generateVAPIDKeys());
    definirReglage('vapid_publique', publique);
    definirReglage('vapid_privee', privee);
  }
  return { publique, privee };
}
const vapid = clesVapid();
const contact = config.smtp.from?.match(/<([^>]+)>/)?.[1] || config.smtp.user || 'no-reply@nadwa.app';
webpush.setVapidDetails(`mailto:${contact}`, vapid.publique, vapid.privee);

const clePublique = () => vapid.publique;

// ---------- Abonnements push ----------
function abonner(utilisateurId, abonnement) {
  const { endpoint, keys } = abonnement || {};
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys?.auth) return false;
  db.prepare(`INSERT INTO push_abonnements (utilisateur_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET utilisateur_id = excluded.utilisateur_id, p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(utilisateurId, endpoint.slice(0, 1000), String(keys.p256dh).slice(0, 200), String(keys.auth).slice(0, 100));
  return true;
}
const desabonner = (utilisateurId, endpoint) =>
  db.prepare('DELETE FROM push_abonnements WHERE utilisateur_id = ? AND endpoint = ?').run(utilisateurId, String(endpoint || ''));

async function pousser(utilisateurId, donnees) {
  const abonnements = db.prepare('SELECT * FROM push_abonnements WHERE utilisateur_id = ?').all(utilisateurId);
  await Promise.all(abonnements.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(donnees), { TTL: 3600 });
    } catch (err) {
      // Abonnement expiré ou révoqué : on l'oublie.
      if (err.statusCode === 404 || err.statusCode === 410) db.prepare('DELETE FROM push_abonnements WHERE id = ?').run(a.id);
      else console.error('Notification push non envoyée :', err.statusCode || err.message);
    }
  }));
}

// ---------- Envoi à une personne ----------
const derniersEmails = new Map(); // `${utilisateurId}:${fil}` -> horodatage

const urlBase = () => config.urlPublique || 'https://nadwalive.com';
const extrait = (texte, n = 140) => { const s = String(texte || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/**
 * Prévient une personne. fil = clé de regroupement des e-mails (conversation, canal…) ;
 * sans fil, l'e-mail part toujours (rappels de réunion).
 */
function prevenir(destinataire, { titre, texte, chemin, fil = null, sujet, bouton, tag, toujours = false }) {
  const lien = `${urlBase()}${chemin}`;
  // Push : pas pour une personne active dans Nadwa (elle voit déjà le message) ni en « Non disponible ».
  // Les rappels de réunion (toujours = true) partent dans tous les cas.
  const statut = require('./temps-reel').statutDe(destinataire.id);
  const occupe = ['disponible', 'en_reunion', 'non_disponible'].includes(statut);
  if (destinataire.notif_push && (toujours || !occupe)) pousser(destinataire.id, { titre, texte, url: chemin, tag }).catch(() => {});
  if (!destinataire.notif_email || !destinataire.email) return;
  if (fil) {
    const cle = `${destinataire.id}:${fil}`;
    const avant = derniersEmails.get(cle) || 0;
    if (Date.now() - avant < EMAIL_INTERVALLE_MS) return;
    derniersEmails.set(cle, Date.now());
  }
  const langue = destinataire.langue || 'en';
  mail.envoyer({
    a: destinataire.email, langue, sujet: sujet || titre,
    titre, paragraphes: [texte], bouton: bouton || t(langue, 'mail_ouvrir_nadwa'), lien,
    pied: t(langue, 'notif_mail_pied'),
  });
}

const SQL_PERSONNE = 'SELECT id, nom, email, langue, notif_email, notif_push FROM utilisateurs';

// ---------- Messages ----------

/** Nouveau message dans une conversation (directe ou clavardage d'équipe). */
function messageDirect(message) {
  try {
    const conv = db.prepare('SELECT id, nom, classe_id FROM conversations WHERE id = ?').get(message.conversation_id);
    if (!conv) return;
    const destinataires = db.prepare(`${SQL_PERSONNE} WHERE id IN (
      SELECT utilisateur_id FROM conversation_membres WHERE conversation_id = ?) AND id <> ?`).all(conv.id, message.auteur_id || 0);
    const chemin = conv.classe_id ? `/?equipe=${conv.classe_id}&onglet=clavardage` : `/?conv=${conv.id}`;
    for (const d of destinataires) {
      const langue = d.langue || 'en';
      const lieu = conv.classe_id || conv.nom ? conv.nom : null;
      const appel = message.type === 'appel';
      const titre = appel
        ? t(langue, 'notif_appel', { nom: message.auteur_nom })
        : lieu ? t(langue, 'notif_message_dans', { nom: message.auteur_nom, lieu }) : t(langue, 'notif_message_de', { nom: message.auteur_nom });
      const texte = appel ? t(langue, 'notif_appel_texte') : extrait(message.contenu || message.fichier_nom || '');
      prevenir(d, { titre, texte, chemin, fil: `conv:${conv.id}`, tag: `conv-${conv.id}`, bouton: t(langue, appel ? 'notif_rejoindre' : 'notif_repondre') });
    }
  } catch (err) { console.error('Notification de message :', err.message); }
}

/** Nouvelle publication dans un canal d'équipe : membres et propriétaire de l'équipe. */
function publication(message) {
  try {
    const classe = db.prepare('SELECT id, nom, responsable_id FROM classes WHERE id = ?').get(message.classe_id);
    const canal = db.prepare('SELECT id, nom, est_general FROM canaux WHERE id = ?').get(message.canal_id);
    if (!classe || !canal) return;
    const destinataires = db.prepare(`${SQL_PERSONNE} WHERE (id = ? OR id IN (SELECT utilisateur_id FROM membres WHERE classe_id = ?)) AND id <> ?`)
      .all(classe.responsable_id, classe.id, message.auteur_id);
    for (const d of destinataires) {
      const langue = d.langue || 'en';
      const lieu = canal.est_general ? classe.nom : `${classe.nom} › ${canal.nom}`;
      prevenir(d, {
        titre: t(langue, 'notif_message_dans', { nom: message.auteur_nom, lieu }),
        texte: extrait(message.contenu || message.fichier_nom || ''),
        chemin: `/?equipe=${classe.id}&canal=${canal.id}`,
        fil: `canal:${canal.id}`, tag: `canal-${canal.id}`, bouton: t(langue, 'notif_repondre'),
      });
    }
  } catch (err) { console.error('Notification de publication :', err.message); }
}

// ---------- Rappels de réunion ----------
function envoyerRappels() {
  try {
    const maintenant = Date.now();
    const seances = db.prepare(`SELECT s.*, c.nom AS classe_nom, c.responsable_id FROM seances s JOIN classes c ON c.id = s.classe_id
      WHERE s.rappel_envoye = 0 AND s.terminee_le IS NULL AND s.debut > ? AND s.debut <= ?`)
      .all(new Date(maintenant).toISOString(), new Date(maintenant + RAPPEL_AVANT_MIN * 60_000).toISOString());
    for (const s of seances) {
      db.prepare('UPDATE seances SET rappel_envoye = 1 WHERE id = ?').run(s.id);
      // Réunion créée il y a moins de 2 minutes (ex. « Réunion immédiate ») : pas de rappel.
      if (maintenant - Date.parse(s.cree_le) < 2 * 60_000) continue;
      const personnes = db.prepare(`${SQL_PERSONNE} WHERE id = ? OR id IN (SELECT utilisateur_id FROM membres WHERE classe_id = ?)
        OR id IN (SELECT utilisateur_id FROM seance_invites WHERE seance_id = ?)`).all(s.responsable_id, s.classe_id, s.id);
      const minutes = Math.max(1, Math.round((Date.parse(s.debut) - maintenant) / 60_000));
      for (const d of personnes) {
        const langue = d.langue || 'en';
        prevenir(d, {
          titre: t(langue, 'notif_rappel', { titre: s.titre, min: minutes }),
          texte: t(langue, 'notif_rappel_texte', { equipe: s.classe_nom }),
          chemin: `/?equipe=${s.classe_id}&reunion=${s.id}`,
          tag: `reunion-${s.id}`, bouton: t(langue, 'notif_voir_reunion'), toujours: true,
        });
      }
    }
  } catch (err) { console.error('Rappels de réunion :', err.message); }
}

function demarrerRappels() {
  setTimeout(envoyerRappels, 15_000);
  setInterval(envoyerRappels, 60_000).unref();
}

module.exports = { clePublique, abonner, desabonner, messageDirect, publication, demarrerRappels, envoyerRappels, pousser };
