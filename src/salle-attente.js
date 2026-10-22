/**
 * Salle d'attente des réunions, comme dans Teams.
 *
 * Les membres de l'équipe et les personnes invitées avec leur compte entrent directement.
 * Toute autre personne (lien d'invitation, sans compte ou non invitée) attend qu'un
 * organisateur de la réunion l'admette : l'organisatrice ou l'organisateur, le propriétaire
 * de l'équipe. Ils reçoivent l'alerte en direct dans Nadwa (même pendant la visio) et,
 * s'ils ne sont pas connectés, une notification sur leur téléphone.
 *
 * Les demandes sont gardées en mémoire (un seul serveur) : elles expirent d'elles-mêmes.
 */
const crypto = require('crypto');
const db = require('./db');
const { t } = require('./i18n');

const ATTENTE_MAX_MS = 20 * 60_000; // une demande sans réponse expire après 20 minutes
const CONSERVATION_MS = 60 * 60_000; // une décision reste lisible une heure
const MAX_PAR_REUNION = 100;

const demandes = new Map(); // id -> { id, secret, seanceId, nom, statut, cree, decide }

function nettoyer() {
  const maintenant = Date.now();
  for (const d of demandes.values()) {
    if (d.statut === 'attente' && maintenant - d.cree > ATTENTE_MAX_MS) { d.statut = 'expiree'; d.decide = maintenant; }
    if (d.statut !== 'attente' && maintenant - (d.decide || d.cree) > CONSERVATION_MS) demandes.delete(d.id);
  }
}
setInterval(nettoyer, 60_000).unref();

/** Personnes qui peuvent admettre : organisateur et propriétaire de l'équipe. */
function hotesDe(seance) {
  const classe = db.prepare('SELECT responsable_id FROM classes WHERE id = ?').get(seance.classe_id);
  return [...new Set([seance.organisateur_id, classe?.responsable_id].filter(Boolean))];
}

const publique = (d) => ({ id: d.id, seance_id: d.seanceId, nom: d.nom, cree: new Date(d.cree).toISOString() });
const titreDe = (seanceId) => db.prepare('SELECT titre FROM seances WHERE id = ?').get(seanceId)?.titre || '';
const enAttente = (seanceId) => [...demandes.values()].filter((d) => d.seanceId === seanceId && d.statut === 'attente');

/** Prévient les hôtes : alerte en direct, et notification sur le téléphone s'ils ne sont pas dans Nadwa. */
function prevenirHotes(io, seance, evenement, donnees) {
  const { statutDe } = require('./temps-reel');
  for (const id of hotesDe(seance)) {
    io?.to(`utilisateur:${id}`).emit(evenement, donnees);
    if (evenement === 'salle:demande' && statutDe(id) === 'hors_ligne') {
      const hote = db.prepare('SELECT langue, notif_push FROM utilisateurs WHERE id = ?').get(id);
      if (!hote?.notif_push) continue;
      const langue = hote.langue || 'en';
      require('./notifications').pousser(id, {
        titre: t(langue, 'notif_salle_attente', { nom: donnees.nom }),
        texte: seance.titre,
        url: `/?reunion=${seance.id}`,
        tag: `salle-${seance.id}`,
      }).catch(() => {});
    }
  }
}

/** Nouvelle demande d'entrée. Renvoie { id, secret } (le secret permet à la personne de suivre sa demande). */
function demander(io, seance, nom) {
  nettoyer();
  if (enAttente(seance.id).length >= MAX_PAR_REUNION) return null;
  const d = {
    id: crypto.randomBytes(9).toString('base64url'),
    secret: crypto.randomBytes(18).toString('base64url'),
    seanceId: seance.id, nom, statut: 'attente', cree: Date.now(), decide: null,
  };
  demandes.set(d.id, d);
  prevenirHotes(io, seance, 'salle:demande', { ...publique(d), titre: seance.titre || titreDe(seance.id) });
  return { id: d.id, secret: d.secret };
}

/** Demande vue par la personne qui attend (vérifiée par son secret). */
function lire(seanceId, id, secret) {
  const d = demandes.get(String(id));
  if (!d || d.seanceId !== seanceId || d.secret !== String(secret || '')) return null;
  return d;
}

/** La personne quitte la salle d'attente. */
function annuler(io, seance, d) {
  if (d.statut !== 'attente') return;
  d.statut = 'annulee'; d.decide = Date.now();
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, id: d.id, statut: d.statut });
}

/** Décision d'un hôte : 'admettre' ou 'refuser'. Renvoie la demande, ou null si elle n'attend plus. */
function decider(io, seance, id, decision) {
  const d = demandes.get(String(id));
  if (!d || d.seanceId !== seance.id || d.statut !== 'attente') return null;
  d.statut = decision === 'admettre' ? 'admise' : 'refusee';
  d.decide = Date.now();
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, id: d.id, statut: d.statut });
  return d;
}

/** Fin de la réunion : plus personne n'attend. */
function fermer(io, seance) {
  for (const d of enAttente(seance.id)) { d.statut = 'terminee'; d.decide = Date.now(); }
  prevenirHotes(io, seance, 'salle:maj', { seance_id: seance.id, tout: true });
}

/** Toutes les demandes en attente pour les réunions dont la personne est hôte (au retour dans Nadwa). */
function pourHote(utilisateurId) {
  nettoyer();
  const titres = new Map();
  return [...demandes.values()].filter((d) => d.statut === 'attente').filter((d) => {
    const seance = db.prepare('SELECT id, titre, classe_id, organisateur_id FROM seances WHERE id = ?').get(d.seanceId);
    if (!seance || !hotesDe(seance).includes(utilisateurId)) return false;
    titres.set(d.id, seance.titre);
    return true;
  }).map((d) => ({ ...publique(d), titre: titres.get(d.id) }));
}

module.exports = {
  pourHote,
  demander, lire, annuler, decider, fermer,
  enAttente: (seanceId) => (nettoyer(), enAttente(seanceId).map(publique)),
  hotesDe,
};
