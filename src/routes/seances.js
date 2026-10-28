const express = require('express');
const db = require('../db');
const visio = require('../visio');
const { exigerConnexion } = require('../auth');
const { etatSeance, peutAnimer, seanceAccessible, ajouterInvites, jetonInvite, OUVERTURE_AVANT_MIN } = require('../metier');
const { annoncerSeances } = require('./classes');
const { t, langueDe } = require('../i18n');
const limites = require('../limites');
const salle = require('../salle-attente');
const presences = require('../presences');

db.exec(`
CREATE TABLE IF NOT EXISTS notes_reunion (
  seance_id  INTEGER PRIMARY KEY REFERENCES seances(id) ON DELETE CASCADE,
  contenu    TEXT NOT NULL DEFAULT '',
  maj_le     INTEGER NOT NULL,
  maj_par    INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL
);
`);
const MAX_NOTES = 50_000;

const routeur = express.Router();
routeur.use(exigerConnexion);

const externesDe = (seanceId) => db.prepare('SELECT email FROM seance_invites_externes WHERE seance_id = ? ORDER BY email')
  .all(seanceId).map((x) => x.email);
const invitesDe = (seanceId) => db.prepare(`
  SELECT u.id, u.nom, u.email FROM seance_invites i JOIN utilisateurs u ON u.id = i.utilisateur_id
  WHERE i.seance_id = ? ORDER BY u.nom`).all(seanceId);

function trouver(req, res) {
  const acces = seanceAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) res.status(404).json({ erreur: t(req, 'reunion_introuvable') });
  return acces;
}

// Salle d'attente : toutes les demandes en attente pour les réunions dont on est hôte.
routeur.get('/salle-attente', (req, res) => res.json(salle.pourHote(req.utilisateur.id)));

// Renvoie le lien d'entrée dans la salle de visio.
routeur.post('/:id/rejoindre', async (req, res, next) => {
  try {
    const acces = trouver(req, res);
    if (!acces) return;
    const { seance, classe } = acces;
    const u = req.utilisateur;
    const moderateur = peutAnimer(u, seance, classe);
    const etat = etatSeance(seance);
    if (!moderateur && etat === 'a_venir') {
      return res.status(403).json({ erreur: t(req, 'salle_ouvre', { min: OUVERTURE_AVANT_MIN }) });
    }
    if (!moderateur && etat === 'terminee') {
      return res.status(403).json({ erreur: t(req, 'reunion_terminee') });
    }
    const refus = limites.controlerEntree(seance, classe, langueDe(req), u.id);
    if (refus) return res.status(403).json({ erreur: refus });
    limites.noterOuverture(seance);
    const { micro = true, camera = true } = req.body || {};
    const lien = await visio.lienVisio({ seance, classe, utilisateur: u, moderateur, langue: langueDe(req), micro: micro !== false, camera: camera !== false, logo: `${req.protocol}://${req.get('host')}/logo-nadwa${langueDe(req) === 'ar' ? '-ar' : ''}.svg` });
    // Présence : arrivée notée ; la page envoie ensuite un signe de vie et son départ.
    const presence = presences.arriver(seance, { cle: `u:${u.id}`, utilisateurId: u.id, nom: u.nom });
    res.json({ ...lien, presence });
  } catch (err) {
    next(err);
  }
});

// État de la réunion : l'onglet Nadwa le surveille pour fermer la visio quand elle est terminée.
routeur.get('/:id/etat', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  res.json({ etat: etatSeance(acces.seance) });
});

// Participants : toute l'équipe + les personnes invitées.
routeur.get('/:id/participants', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  const equipe = db.prepare(`
    SELECT u.id, u.nom, u.email FROM utilisateurs u
    WHERE u.id = ? OR u.id IN (SELECT utilisateur_id FROM membres WHERE classe_id = ?)
    ORDER BY u.nom`).all(classe.responsable_id, classe.id);
  res.json({
    jeton: jetonInvite(seance.id),
    equipe: { id: classe.id, nom: classe.nom, membres: equipe },
    invites: invitesDe(seance.id),
    externes: peutAnimer(req.utilisateur, seance, classe) ? externesDe(seance.id) : [],
    nbExternes: externesDe(seance.id).length,
    peutModifier: peutAnimer(req.utilisateur, seance, classe),
    accesEquipe: acces.accesEquipe,
  });
});

routeur.post('/:id/participants', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'participants_hote') });
  const ajoutes = ajouterInvites(seance, classe, req.utilisateur, { ids: req.body?.ids, emails: req.body?.emails });
  if (!ajoutes.ids.length && !ajoutes.emails.length) {
    const demande = (Array.isArray(req.body?.ids) && req.body.ids.length) || (req.body?.emails && String(req.body.emails).trim());
    if (demande) return res.status(400).json({ erreur: t(req, 'invites_deja') });
  }
  if (etatSeance(seance) !== 'terminee') {
    require('../notifications').invitationReunion({
      seance, organisateur: req.utilisateur, ...ajoutes, jeton: jetonInvite(seance.id), fuseau: req.body?.fuseau, langue: langueDe(req),
    });
  }
  annoncerSeances(req, classe.id, ajoutes.ids);
  res.json({ invites: invitesDe(seance.id), externes: externesDe(seance.id), ajoutes });
});

routeur.delete('/:id/participants/:uid', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'participants_hote') });
  const uid = Number(req.params.uid);
  db.prepare('DELETE FROM seance_invites WHERE seance_id = ? AND utilisateur_id = ?').run(seance.id, uid);
  annoncerSeances(req, classe.id, [uid]);
  res.json({ invites: invitesDe(seance.id) });
});

// Salle d'attente : personnes qui demandent à entrer (visible par les organisateurs).
routeur.get('/:id/demandes', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.json([]);
  res.json(salle.enAttente(seance.id));
});

// Admettre ou refuser une personne de la salle d'attente.
routeur.post('/:id/demandes/:did', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'admettre_hote') });
  const decision = req.body?.decision === 'admettre' ? 'admettre' : 'refuser';
  const d = salle.decider(req.app.get('io'), seance, req.params.did, decision);
  if (!d) return res.status(404).json({ erreur: t(req, 'demande_traitee') });
  res.json({ ok: true, statut: d.statut });
});

// ---------- Présences (organisateur) ----------
const libellesCsv = (req) => ({
  entetes: ['nom', 'email', 'role', 'statut', 'arrivee', 'depart', 'duree_min', 'entrees'].map((k) => t(req, `pres_col_${k}`)),
  roles: Object.fromEntries(['organisateur', 'membre', 'invite', 'invite_email', 'invite_lien'].map((k) => [k, t(req, `pres_role_${k}`)])),
  statuts: Object.fromEntries(presences.STATUTS.map((k) => [k, t(req, `pres_statut_${k}`)])),
  en_cours: t(req, 'pres_en_cours'),
});
function hote(req, res) {
  const acces = trouver(req, res);
  if (!acces) return null;
  if (!peutAnimer(req.utilisateur, acces.seance, acces.classe)) { res.status(403).json({ erreur: t(req, 'presences_hote') }); return null; }
  return acces;
}
routeur.get('/:id/presences', (req, res) => {
  const acces = hote(req, res);
  if (acces) res.json(presences.rapport(acces.seance, acces.classe));
});
routeur.put('/:id/presences', (req, res) => {
  const acces = hote(req, res);
  if (!acces) return;
  const cle = String(req.body?.cle || '').slice(0, 300);
  const statut = req.body?.statut ? String(req.body.statut) : null;
  if (!cle || (statut && !presences.STATUTS.includes(statut))) return res.status(400).json({ erreur: t(req, 'presences_statut') });
  presences.corriger(acces.seance.id, cle, statut);
  res.json(presences.rapport(acces.seance, acces.classe));
});
routeur.get('/:id/presences.csv', (req, res) => {
  const acces = hote(req, res);
  if (!acces) return;
  const r = presences.rapport(acces.seance, acces.classe);
  const nom = `presences-${acces.seance.debut.slice(0, 10)}-${acces.seance.titre.normalize('NFD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 40)}.csv`;
  res.set('Content-Disposition', `attachment; filename="${nom}"`);
  res.type('text/csv; charset=utf-8').send(presences.csv(r, { langue: langueDe(req), fuseau: String(req.query.fuseau || ''), libelles: libellesCsv(req) }));
});

// ---------- Notes de réunion (comme Teams) ----------
// Partagées par toutes les personnes de la réunion qui ont un compte ; enregistrées ; mises à jour en direct.
routeur.get('/:id/notes', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const n = db.prepare('SELECT n.contenu, n.maj_le, u.nom AS maj_par_nom FROM notes_reunion n LEFT JOIN utilisateurs u ON u.id = n.maj_par WHERE n.seance_id = ?').get(acces.seance.id);
  res.json({ contenu: n?.contenu || '', maj_le: n?.maj_le || 0, maj_par_nom: n?.maj_par_nom || null, titre: acces.seance.titre, debut: acces.seance.debut });
});
routeur.put('/:id/notes', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const contenu = String(req.body?.contenu ?? '');
  if (contenu.length > MAX_NOTES) return res.status(413).json({ erreur: t(req, 'notes_trop_longues') });
  const majLe = Date.now();
  db.prepare(`INSERT INTO notes_reunion (seance_id, contenu, maj_le, maj_par) VALUES (?, ?, ?, ?)
    ON CONFLICT(seance_id) DO UPDATE SET contenu = excluded.contenu, maj_le = excluded.maj_le, maj_par = excluded.maj_par`)
    .run(acces.seance.id, contenu, majLe, req.utilisateur.id);
  req.app.get('io')?.to(`seance:${acces.seance.id}`).emit('notes:maj', {
    seance_id: acces.seance.id, contenu, maj_le: majLe, maj_par: req.utilisateur.id, maj_par_nom: req.utilisateur.nom, client: String(req.body?.client || '').slice(0, 40),
  });
  res.json({ maj_le: majLe });
});

// Retirer un invité sans compte (adresse e-mail).
routeur.delete('/:id/externes', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'participants_hote') });
  db.prepare('DELETE FROM seance_invites_externes WHERE seance_id = ? AND email = ?').run(seance.id, String(req.query.email || '').toLowerCase());
  res.json({ externes: externesDe(seance.id) });
});

// Terminer la réunion maintenant : réservé à son organisateur (le propriétaire de l'équipe
// n'y assiste pas forcément). Sans organisateur connu (anciennes réunions), le propriétaire
// de l'équipe peut la terminer. Elle disparaît des réunions en cours, mais reste dans l'agenda.
routeur.post('/:id/terminer', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  const organisateur = seance.organisateur_id ? seance.organisateur_id === req.utilisateur.id : peutAnimer(req.utilisateur, seance, classe);
  if (!organisateur) return res.status(403).json({ erreur: t(req, 'terminer_reunion_owner') });
  db.prepare('UPDATE seances SET terminee_le = ? WHERE id = ?').run(new Date().toISOString(), seance.id);
  salle.fermer(req.app.get('io'), seance);
  presences.fermerTout(seance.id);
  annoncerSeances(req, classe.id, invitesDe(seance.id).map((p) => p.id));
  res.json({ ok: true });
});

routeur.delete('/:id', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'suppr_reunion_owner') });
  const invites = invitesDe(seance.id).map((p) => p.id);
  db.prepare('DELETE FROM seances WHERE id = ?').run(seance.id);
  annoncerSeances(req, classe.id, invites);
  res.json({ ok: true });
});

module.exports = routeur;
