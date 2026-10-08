/**
 * Limites d'usage réglables par variables d'environnement (0 = pas de limite) :
 * LIMITE_PARTICIPANTS, LIMITE_DUREE_MIN, LIMITE_REUNIONS_SIMULTANEES.
 */
const db = require('./db');
const config = require('./config');
const { etatSeance } = require('./metier');
const { t } = require('./i18n');

/** Durée maximale autorisée pour une réunion (minutes). */
const dureeMax = (plafond) => (config.limites.dureeMin ? Math.min(config.limites.dureeMin, plafond) : plafond);

/**
 * Vérifie qu'on peut entrer dans la salle. Renvoie un message d'erreur, ou null.
 * Les invités sans compte ne sont pas comptés dans les participants.
 */
function controlerEntree(seance, classe, langue, utilisateurId = null) {
  const { participants, reunionsSimultanees } = config.limites;
  if (participants) {
    const presents = require('./temps-reel').participantsSalle(seance.reunion_id, utilisateurId);
    if (presents >= participants) return t(langue, 'limite_participants', { max: participants });
  }
  if (reunionsSimultanees && !seance.ouverte_le) {
    const ouvertes = db.prepare(`SELECT s.* FROM seances s JOIN classes c ON c.id = s.classe_id
      WHERE c.espace_id = ? AND s.id <> ? AND s.ouverte_le IS NOT NULL AND s.terminee_le IS NULL`).all(classe.espace_id, seance.id)
      .filter((s) => etatSeance(s) === 'en_direct').length;
    if (ouvertes >= reunionsSimultanees) return t(langue, 'limite_reunions', { max: reunionsSimultanees });
  }
  return null;
}

/** Note l'ouverture effective de la réunion (première entrée). */
function noterOuverture(seance) {
  if (!seance.ouverte_le) db.prepare('UPDATE seances SET ouverte_le = ? WHERE id = ? AND ouverte_le IS NULL').run(new Date().toISOString(), seance.id);
}

module.exports = { dureeMax, controlerEntree, noterOuverture };
