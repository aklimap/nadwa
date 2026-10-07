/**
 * Envoi des e-mails (bienvenue, compte créé par un administrateur, mot de passe oublié).
 * Fonctionne avec n'importe quel service SMTP : Gmail (mot de passe d'application), Brevo, Mailjet, OVH…
 * Sans SMTP_HOST, aucun e-mail n'est envoyé : le contenu est seulement écrit dans les journaux.
 */
const nodemailer = require('nodemailer');
const config = require('./config');
const { t } = require('./i18n');

const actif = () => Boolean(config.smtp.host);
let transport = null;
function transporteur() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transport;
}

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mise en page commune : bandeau bleu nuit, texte, bouton. Sens de lecture selon la langue. */
function gabarit(langue, { titre, paragraphes, bouton, lien, pied }) {
  const rtl = langue === 'ar';
  const nom = rtl ? 'ندوة' : 'Nadwa';
  const html = `<!doctype html><html lang="${langue}" dir="${rtl ? 'rtl' : 'ltr'}"><body style="margin:0;background:#F5F6FA;font-family:Segoe UI,Arial,sans-serif;color:#101828">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden">
    <tr><td style="background:#111A33;padding:20px 28px;font-size:24px;font-weight:800;color:#F2A93B">${nom}</td></tr>
    <tr><td style="padding:28px;text-align:${rtl ? 'right' : 'left'}">
      <h1 style="margin:0 0 14px;font-size:22px">${echapper(titre)}</h1>
      ${paragraphes.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${echapper(p)}</p>`).join('')}
      ${lien ? `<p style="margin:22px 0"><a href="${echapper(lien)}" style="display:inline-block;background:#2F5BEA;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${echapper(bouton)}</a></p>
      <p style="margin:0;font-size:12px;color:#5B6478;word-break:break-all" dir="ltr">${echapper(lien)}</p>` : ''}
      ${pied ? `<p style="margin:22px 0 0;font-size:13px;color:#5B6478">${echapper(pied)}</p>` : ''}
    </td></tr>
  </table></td></tr></table></body></html>`;
  const texte = [titre, '', ...paragraphes, ...(lien ? ['', `${bouton} : ${lien}`] : []), ...(pied ? ['', pied] : [])].join('\n');
  return { html, texte };
}

/** Envoie un e-mail ; renvoie true si parti, false sinon (jamais d'exception vers l'appelant). */
async function envoyer({ a, sujet, langue = 'en', ...contenu }) {
  const { html, texte } = gabarit(langue, contenu);
  if (!actif()) {
    console.log(`[e-mail non envoyé : SMTP non configuré] À : ${a}\nSujet : ${sujet}\n${texte}\n`);
    return false;
  }
  try {
    await transporteur().sendMail({ from: config.smtp.from, to: a, subject: sujet, text: texte, html });
    return true;
  } catch (err) {
    console.error('Échec de l\'envoi de l\'e-mail :', err.message);
    return false;
  }
}

// ---------- Messages ----------
const prenom = (nom) => String(nom || '').split(' ')[0];

function bienvenue({ email, nom, langue, url }) {
  return envoyer({
    a: email, langue,
    sujet: t(langue, 'mail_bienvenue_sujet'),
    titre: t(langue, 'mail_bienvenue_titre', { prenom: prenom(nom) }),
    paragraphes: [t(langue, 'mail_bienvenue_texte'), t(langue, 'mail_bienvenue_texte2')],
    bouton: t(langue, 'mail_ouvrir_nadwa'), lien: url,
    pied: t(langue, 'mail_pas_vous'),
  });
}

function compteCree({ email, nom, langue, url, organisation, par, motDePasse }) {
  return envoyer({
    a: email, langue,
    sujet: t(langue, 'mail_compte_sujet', { organisation }),
    titre: t(langue, 'mail_bienvenue_titre', { prenom: prenom(nom) }),
    paragraphes: [
      t(langue, 'mail_compte_texte', { par, organisation }),
      t(langue, 'mail_compte_identifiants', { email, mdp: motDePasse }),
      t(langue, 'mail_compte_changer'),
    ],
    bouton: t(langue, 'mail_ouvrir_nadwa'), lien: url,
  });
}

function ajoutOrganisation({ email, nom, langue, url, organisation, par }) {
  return envoyer({
    a: email, langue,
    sujet: t(langue, 'mail_ajout_sujet', { organisation }),
    titre: t(langue, 'mail_bienvenue_titre', { prenom: prenom(nom) }),
    paragraphes: [t(langue, 'mail_compte_texte', { par, organisation })],
    bouton: t(langue, 'mail_ouvrir_nadwa'), lien: url,
  });
}

function reinitialisation({ email, nom, langue, lien }) {
  return envoyer({
    a: email, langue,
    sujet: t(langue, 'mail_reinit_sujet'),
    titre: t(langue, 'mail_reinit_titre', { prenom: prenom(nom) }),
    paragraphes: [t(langue, 'mail_reinit_texte'), t(langue, 'mail_reinit_duree')],
    bouton: t(langue, 'mail_reinit_bouton'), lien,
    pied: t(langue, 'mail_reinit_pas_vous'),
  });
}

function motDePasseChange({ email, nom, langue }) {
  return envoyer({
    a: email, langue,
    sujet: t(langue, 'mail_change_sujet'),
    titre: t(langue, 'mail_reinit_titre', { prenom: prenom(nom) }),
    paragraphes: [t(langue, 'mail_change_texte')],
    pied: t(langue, 'mail_change_pas_vous'),
  });
}

module.exports = { actif, envoyer, bienvenue, compteCree, ajoutOrganisation, reinitialisation, motDePasseChange };
