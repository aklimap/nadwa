/**
 * Salle d'attente des réunions, comme dans Teams.
 *
 * Les membres de l'équipe et les personnes invitées avec leur compte entrent directement.
 * Toute autre personne (lien d'invitation, sans compte ou non invitée) attend qu'un
 * hôte de la réunion l'admette : l'organisateur ou le propriétaire de l'équipe.
 *
 * Les hôtes sont prévenus de trois façons, comme dans Teams :
 * - en direct dans Nadwa (carte « X attend dans la salle d'attente », même pendant la visio) ;
 * - par une notification sur le téléphone et l'ordinateur, TOUJOURS envoyée : Nadwa peut être
 *   ouvert dans un onglet en arrière-plan ou sur un téléphone en veille, où la carte ne se voit pas ;
 * - au retour dans Nadwa, les demandes encore en attente réapparaissent.
 *
 * Les demandes sont gardées dans la base : elles survivent à un redémarrage du serveur.
 */
const crypto = require('crypto');
const db = require('./db');
const { t } = require('./i18n');

const ATTENTE_MAX_MS = 20 * 60_000; // une demande sans réponse expire après 20 minutes
const ABSENCE_MS = 3 * 60_000; // la page de l'invité ne répond plus (onglet fermé) : il est parti
const CONSERVATION_MS = 60 * 60_000; // une décision reste lisible une heure
const MAX_PAR_REUNION = 100;

db.exec(`
CREATE TABLE IF NOT EXISTS salle_attente (
  id         TEXT PRIMARY KEY,
  secret     TEXT NOT NULL,
  seance_id  INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  statut     TEXT NOT NULL DEFAULT 'attente',
  cree       INTEGER NOT NULL,
  vu         INTEGER NOT NULL,
  decide     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_salle_attente_seance ON salle_attente(seance_id, statut);
`);

const lireDemande = (id) => db.prepare('SELECT * FROM salle_attente WHERE id = ?').get(String(id));
const changerStatut = (id, statut) => db.prepare('UPDATE salle_attente SET statut = ?, decide = ? WHERE id = ?').run(statut, Date.now(), id);

/** Expire les demandes trop anciennes ou abandonnées, et oublie les vieilles décisions. */
function nettoyer(io = null) {
  const maintenant = Date.now();
  const perimees = db.prepare(`SELECT id, seance_id FROM salle_attente WHERE statut = 'attente' AND (cree < ? OR vu < ?)`)
    .all(maintenant - ATTENTE_MAX_MS, maintenant - ABSENCE_MS);
  for (const d of perimees) {
    changerStatut(d.id, 'expiree');
    const seance = db.prepare('SELECT id, classe_id, organisateur_id FROM seances WHERE id = ?').get(d.seance_id);
    if (seance && io) prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, id: d.id, statut: 'expiree' });
  }
  db.prepare(`DELETE FROM salle_attente WHERE statut <> 'attente' AND COALESCE(decide, cree) < ?`).run(maintenant - CONSERVATION_MS);
}
let ioGlobal = null;
setInterval(() => { try { nettoyer(ioGlobal); } catch { /* base fermée */ } }, 15_000).unref();

/** Personnes qui peuvent admettre : organisateur et propriétaire de l'équipe. */
function hotesDe(seance) {
  const classe = db.prepare('SELECT responsable_id FROM classes WHERE id = ?').get(seance.classe_id);
  return [...new Set([seance.organisateur_id, classe?.responsable_id].filter(Boolean))];
}

const publique = (d, titre) => ({ id: d.id, seance_id: d.seance_id, nom: d.nom, cree: new Date(d.cree).toISOString(), ...(titre !== undefined ? { titre } : {}) });
const enAttente = (seanceId) => db.prepare(`SELECT * FROM salle_attente WHERE seance_id = ? AND statut = 'attente' ORDER BY cree`).all(seanceId);

/** Prévient les hôtes : alerte en direct, et (nouvelle demande) notification sur leurs appareils. */
function prevenirHotes(io, seance, evenement, donnees) {
  for (const id of hotesDe(seance)) {
    io?.to(`utilisateur:${id}`).emit(evenement, donnees);
    if (evenement !== 'salle:demande') continue;
    const hote = db.prepare('SELECT langue, notif_push FROM utilisateurs WHERE id = ?').get(id);
    if (!hote?.notif_push) continue;
    const langue = hote.langue || 'en';
    require('./notifications').pousser(id, {
      titre: t(langue, 'notif_salle_attente', { nom: donnees.nom }),
      texte: donnees.titre || '',
      url: `/?reunion=${seance.id}`,
      tag: `salle-${donnees.id}`,
    }).catch(() => {});
  }
}

/** Nouvelle demande d'entrée. Renvoie { id, secret } (le secret permet à la personne de suivre sa demande). */
function demander(io, seance, nom) {
  ioGlobal = io || ioGlobal;
  nettoyer(io);
  if (enAttente(seance.id).length >= MAX_PAR_REUNION) return null;
  const maintenant = Date.now();
  const d = {
    id: crypto.randomBytes(9).toString('base64url'),
    secret: crypto.randomBytes(18).toString('base64url'),
    seance_id: seance.id, nom, statut: 'attente', cree: maintenant, vu: maintenant,
  };
  db.prepare('INSERT INTO salle_attente (id, secret, seance_id, nom, statut, cree, vu) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(d.id, d.secret, d.seance_id, d.nom, d.statut, d.cree, d.vu);
  prevenirHotes(io, seance, 'salle:demande', publique(d, seance.titre));
  return { id: d.id, secret: d.secret };
}

/** Demande vue par la personne qui attend (vérifiée par son secret) ; note qu'elle est toujours là. */
function lire(seanceId, id, secret) {
  const d = lireDemande(id);
  if (!d || d.seance_id !== seanceId || !secret || d.secret !== String(secret)) return null;
  if (d.statut === 'attente') {
    db.prepare('UPDATE salle_attente SET vu = ? WHERE id = ?').run(Date.now(), d.id);
    if (Date.now() - d.cree > ATTENTE_MAX_MS) { changerStatut(d.id, 'expiree'); d.statut = 'expiree'; }
  }
  return d;
}

/** La personne quitte la salle d'attente. */
function annuler(io, seance, d) {
  if (d.statut !== 'attente') return;
  changerStatut(d.id, 'annulee');
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, id: d.id, statut: 'annulee' });
}

/** Décision d'un hôte : 'admettre' ou 'refuser'. Renvoie la demande, ou null si elle n'attend plus. */
function decider(io, seance, id, decision) {
  const d = lireDemande(id);
  if (!d || d.seance_id !== seance.id || d.statut !== 'attente') return null;
  d.statut = decision === 'admettre' ? 'admise' : 'refusee';
  changerStatut(d.id, d.statut);
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, id: d.id, statut: d.statut });
  return d;
}

/** Fin de la réunion : plus personne n'attend. */
function fermer(io, seance) {
  db.prepare(`UPDATE salle_attente SET statut = 'terminee', decide = ? WHERE seance_id = ? AND statut = 'attente'`).run(Date.now(), seance.id);
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, tout: true });
}

/** Toutes les demandes en attente pour les réunions dont la personne est hôte. */
function pourHote(utilisateurId) {
  nettoyer(ioGlobal);
  return db.prepare(`
    SELECT a.*, s.titre FROM salle_attente a
    JOIN seances s ON s.id = a.seance_id
    JOIN classes c ON c.id = s.classe_id
    WHERE a.statut = 'attente' AND (s.organisateur_id = ? OR c.responsable_id = ?)
    ORDER BY a.cree`).all(utilisateurId, utilisateurId).map((d) => publique(d, d.titre));
}

module.exports = {
  pourHote,
  demander, lire, annuler, decider, fermer,
  enAttente: (seanceId) => (nettoyer(ioGlobal), enAttente(seanceId).map((d) => publique(d))),
  hotesDe,
  brancher: (io) => { ioGlobal = io; },
};
