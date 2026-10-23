/**
 * Lien d'invitation d'une réunion : /r/<jeton>.
 * Toute personne qui a le lien peut entrer dans la salle avec seulement son nom, sans compte (comme Zoom).
 */
const express = require('express');
const db = require('../db');
const visio = require('../visio');
const { etatSeance, seanceAccessible, OUVERTURE_AVANT_MIN } = require('../metier');
const { NOM_COOKIE, utilisateurDepuisJeton } = require('../auth');
const { t, langueDe } = require('../i18n');
const limites = require('../limites');
const salle = require('../salle-attente');

const routeur = express.Router();

function trouver(req, res) {
  const jeton = String(req.params.jeton || '');
  const seance = jeton.length >= 12 && db.prepare('SELECT * FROM seances WHERE jeton_invite = ?').get(jeton);
  if (!seance) { res.status(404).json({ erreur: t(req, 'lien_invalide') }); return {}; }
  const classe = db.prepare('SELECT c.*, u.nom AS responsable_nom FROM classes c JOIN utilisateurs u ON u.id = c.responsable_id WHERE c.id = ?').get(seance.classe_id);
  return { seance, classe };
}

routeur.get('/:jeton', (req, res) => {
  const { seance, classe } = trouver(req, res);
  if (!seance) return;
  const organisateur = db.prepare('SELECT nom FROM utilisateurs WHERE id = ?').get(seance.organisateur_id)?.nom || null;
  // Déjà connecté et invité (ou membre de l'équipe) : l'interface ouvre la réunion dans son compte.
  // Sinon : entrée avec son nom seulement, sans compte.
  const moi = utilisateurDepuisJeton(req.cookies?.[NOM_COOKIE]);
  const seanceId = moi && seanceAccessible(moi, seance.id) ? seance.id : null;
  res.json({
    seance_id: seanceId,
    titre: seance.titre, debut: seance.debut, duree_min: seance.duree_min, etat: etatSeance(seance),
    equipe: classe.nom, organisateur, ouverture_min: OUVERTURE_AVANT_MIN,
  });
});

const logoDe = (req) => `${req.protocol}://${req.get('host')}/logo-nadwa${langueDe(req) === 'ar' ? '-ar' : ''}.svg`;

/**
 * Demande d'entrée par le lien : la personne patiente dans la salle d'attente jusqu'à ce
 * qu'un organisateur l'admette (comme dans Teams). Réponse : { attente: true, demande, secret }.
 */
routeur.post('/:jeton/rejoindre', (req, res) => {
  const { seance, classe } = trouver(req, res);
  if (!seance) return;
  const nom = String(req.body?.nom ?? '').trim().slice(0, 60);
  if (nom.length < 2) return res.status(400).json({ erreur: t(req, 'nom_invite') });
  const etat = etatSeance(seance);
  if (etat === 'a_venir') return res.status(403).json({ erreur: t(req, 'salle_ouvre', { min: OUVERTURE_AVANT_MIN }) });
  if (etat === 'terminee') return res.status(403).json({ erreur: t(req, 'reunion_terminee') });
  const refus = limites.controlerEntree(seance, classe, langueDe(req));
  if (refus) return res.status(403).json({ erreur: refus });

  const demande = salle.demander(req.app.get('io'), seance, nom);
  if (!demande) return res.status(429).json({ erreur: t(req, 'salle_attente_pleine') });
  res.json({ attente: true, demande: demande.id, secret: demande.secret });
});

/**
 * Suivi de la demande par la personne qui attend (interrogé toutes les 2 secondes).
 * Une fois admise, la réponse contient le lien de la visio.
 */
routeur.get('/:jeton/demande/:id', async (req, res, next) => {
  try {
    const { seance, classe } = trouver(req, res);
    if (!seance) return;
    const d = salle.lire(seance.id, req.params.id, req.query.secret);
    if (!d) return res.status(404).json({ erreur: t(req, 'demande_introuvable') });
    if (etatSeance(seance) === 'terminee' && d.statut === 'attente') d.statut = 'terminee';
    if (d.statut !== 'admise') return res.json({ statut: d.statut });

    limites.noterOuverture(seance);
    const invite = { id: `invite-${d.id}`, nom: `${d.nom} (${t(req, 'invite_externe')})` };
    const visioLien = await visio.lienVisio({
      seance, classe, utilisateur: invite, moderateur: false, langue: langueDe(req),
      micro: req.query.micro !== '0', camera: req.query.camera !== '0', logo: logoDe(req),
    });
    res.json({ statut: 'admise', ...visioLien });
  } catch (err) { next(err); }
});

/**
 * Incident de visio signalé automatiquement par la page (connexion audio/vidéo impossible…),
 * pour un invité sans compte. Gardé dans les retours et envoyé à l'exploitant.
 */
routeur.post('/:jeton/incident', (req, res) => {
  const { seance } = trouver(req, res);
  if (!seance) return;
  const recents = db.prepare("SELECT COUNT(*) AS n FROM retours WHERE type = 'visio' AND page = ? AND cree_le > ?")
    .get(`reunion ${seance.id}`, new Date(Date.now() - 3600_000).toISOString()).n;
  if (recents >= 5) return res.json({ ok: true });
  require('../incidents').signaler({ seance, qui: `${String(req.body?.nom || 'Invité').slice(0, 60)} (invité sans compte)`, details: req.body?.details, navigateur: req.get('user-agent') });
  res.json({ ok: true });
});

/** La personne quitte la salle d'attente (bouton, ou fermeture de l'onglet). */
routeur.post('/:jeton/demande/:id/quitter', (req, res) => {
  const { seance } = trouver(req, res);
  if (!seance) return;
  const d = salle.lire(seance.id, req.params.id, req.query.secret);
  if (d) salle.annuler(req.app.get('io'), seance, d);
  res.json({ ok: true });
});
routeur.delete('/:jeton/demande/:id', (req, res) => {
  const { seance } = trouver(req, res);
  if (!seance) return;
  const d = salle.lire(seance.id, req.params.id, req.query.secret);
  if (d) salle.annuler(req.app.get('io'), seance, d);
  res.json({ ok: true });
});

module.exports = routeur;
