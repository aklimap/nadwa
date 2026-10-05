/**
 * Visioconférence.
 * - BigBlueButton (recommandé, auto-hébergé) si BBB_URL et BBB_SECRET sont définis.
 * - Sinon Jitsi, pratique pour une démonstration sans serveur de visio.
 */
const crypto = require('crypto');
const config = require('./config');
const { ErreurHttp } = require('./metier');
const { t } = require('./i18n');

const bbbActif = () => Boolean(config.bbbUrl && config.bbbSecret);
const fournisseur = () => (bbbActif() ? 'bigbluebutton' : 'jitsi');

// ---------- BigBlueButton ----------

function baseApi() {
  let url = config.bbbUrl.replace(/\/+$/, '');
  if (!/\/api$/.test(url)) url += '/api';
  return `${url}/`;
}

/** URL signée : checksum = sha1(nomAppel + requête + secret). */
function urlSignee(appel, params) {
  const requete = new URLSearchParams(params).toString();
  const checksum = crypto.createHash('sha1').update(appel + requete + config.bbbSecret).digest('hex');
  return `${baseApi()}${appel}?${requete}${requete ? '&' : ''}checksum=${checksum}`;
}

/** Mots de passe dérivés (compatibilité avec les versions de BBB qui les exigent encore). */
function motDePasse(reunionId, role) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${reunionId}:${role}`).digest('hex').slice(0, 16);
}

async function creerReunionBBB(seance, classe, langue) {
  const params = {
    name: `${classe.nom}: ${seance.titre}`,
    meetingID: seance.reunion_id,
    attendeePW: motDePasse(seance.reunion_id, 'etudiant'),
    moderatorPW: motDePasse(seance.reunion_id, 'enseignant'),
    record: 'true',
    autoStartRecording: 'false',
    allowStartStopRecording: 'true',
    welcome: t(langue, 'bbb_bienvenue', { nom: classe.nom }),
    'meta_plateforme': 'Nadwa',
    'meta_classe': String(classe.id),
  };

  let xml;
  try {
    const reponse = await fetch(urlSignee('create', params), { signal: AbortSignal.timeout(8000) });
    xml = await reponse.text();
  } catch {
    throw new ErreurHttp(502, t(langue, 'visio_ko'));
  }
  // « create » est idempotent : une réunion déjà ouverte renvoie aussi SUCCESS.
  if (/<returncode>\s*SUCCESS\s*<\/returncode>/.test(xml)) return;
  const message = /<message>([^<]*)<\/message>/.exec(xml)?.[1];
  throw new ErreurHttp(502, `${t(langue, 'bbb_refus')}${message ? ` (${message})` : ''}`);
}

// ---------- Point d'entrée ----------

/**
 * Renvoie l'URL qui fait entrer l'utilisateur dans la salle de la séance.
 * L'enseignant (ou l'administrateur) entre comme modérateur.
 */
async function lienVisio({ seance, classe, utilisateur, moderateur, langue = 'en', micro = true, camera = true }) {
  if (bbbActif()) {
    await creerReunionBBB(seance, classe, langue);
    const url = urlSignee('join', {
      fullName: utilisateur.nom,
      meetingID: seance.reunion_id,
      role: moderateur ? 'MODERATOR' : 'VIEWER',
      password: motDePasse(seance.reunion_id, moderateur ? 'enseignant' : 'etudiant'),
      userID: String(utilisateur.id),
      redirect: 'true',
    });
    return { fournisseur: 'bigbluebutton', url };
  }

  const salle = encodeURIComponent(seance.reunion_id);
  const nom = encodeURIComponent(JSON.stringify(utilisateur.nom));
  return {
    fournisseur: 'jitsi',
    // Choix faits avant d'entrer : micro et caméra activés ou coupés au démarrage.
    url: `https://${config.jitsiDomaine}/${salle}#userInfo.displayName=${nom}&config.startWithAudioMuted=${!micro}&config.startWithVideoMuted=${!camera}&config.prejoinConfig.enabled=false`,
  };
}

module.exports = { lienVisio, fournisseur };
