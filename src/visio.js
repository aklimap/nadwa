/**
 * Visioconférence.
 * - BigBlueButton (recommandé, auto-hébergé) si BBB_URL et BBB_SECRET sont définis.
 * - Sinon Jitsi, pratique pour une démonstration sans serveur de visio.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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

async function creerReunionBBB(seance, classe, langue, logo) {
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
    ...(logo ? { logo } : {}), // logo de Nadwa dans la salle, à la place de celui de BigBlueButton
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

// ---------- Jitsi ----------

/**
 * Jeton d'animateur pour un serveur Jitsi privé (jitsi-meet-tokens).
 * Seuls les animateurs en reçoivent un : ils ouvrent la salle et en sont modérateurs ;
 * les autres participants entrent comme invités, une fois l'animateur arrivé.
 */
function jetonJitsi(salle, utilisateur) {
  if (!config.jitsiAppId || !config.jitsiAppSecret) return null;
  return jwt.sign(
    {
      aud: 'jitsi',
      iss: config.jitsiAppId,
      sub: config.jitsiDomaine,
      room: salle.toLowerCase(),
      context: { user: { id: String(utilisateur.id), name: utilisateur.nom, moderator: true } },
    },
    config.jitsiAppSecret,
    { algorithm: 'HS256', expiresIn: '12h', notBefore: -60 },
  );
}

/**
 * Grand cours : l'équipe (propriétaire + membres + invités) compte au moins GRAND_COURS_MIN personnes.
 * La vidéo y est limitée à 360p : beaucoup moins de débit pour le serveur et les élèves.
 */
const GRAND_COURS_MIN = Number(process.env.GRAND_COURS_MIN) || 15;
function grandCours(seance, classe) {
  if (!classe?.id) return false;
  const db = require('./db');
  const membres = db.prepare('SELECT COUNT(*) AS n FROM membres WHERE classe_id = ?').get(classe.id).n;
  const invites = seance.id ? db.prepare('SELECT COUNT(*) AS n FROM seance_invites WHERE seance_id = ?').get(seance.id).n : 0;
  return membres + invites + 1 >= GRAND_COURS_MIN;
}

// ---------- Point d'entrée ----------

/**
 * Renvoie l'URL qui fait entrer l'utilisateur dans la salle de la séance.
 * L'enseignant (ou l'administrateur) entre comme modérateur.
 */
async function lienVisio({ seance, classe, utilisateur, moderateur, langue = 'en', micro = true, camera = true, logo = null }) {
  if (bbbActif()) {
    await creerReunionBBB(seance, classe, langue, logo);
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
  const jeton = moderateur ? jetonJitsi(seance.reunion_id, utilisateur) : null;
  const requete = jeton ? `?jwt=${jeton}` : '';
  return {
    fournisseur: 'jitsi',
    // Pour afficher la visio dans la page Nadwa (API IFrame de Jitsi), comme Teams.
    integration: { domaine: config.jitsiDomaine, salle: seance.reunion_id, jwt: jeton, nom: utilisateur.nom, micro, camera, grand: grandCours(seance, classe) },
    // Choix faits avant d'entrer : micro et caméra activés ou coupés au démarrage.
    url: `https://${config.jitsiDomaine}/${salle}${requete}#userInfo.displayName=${nom}&config.startWithAudioMuted=${!micro}&config.startWithVideoMuted=${!camera}&config.prejoinConfig.enabled=false`,
  };
}

module.exports = { lienVisio, fournisseur };
