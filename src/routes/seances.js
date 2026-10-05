const express = require('express');
const db = require('../db');
const visio = require('../visio');
const { exigerConnexion } = require('../auth');
const { etatSeance, peutAnimer, seanceAccessible, ajouterInvites, jetonInvite, OUVERTURE_AVANT_MIN } = require('../metier');
const { annoncerSeances } = require('./classes');
const { t, langueDe } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);

const invitesDe = (seanceId) => db.prepare(`
  SELECT u.id, u.nom, u.email FROM seance_invites i JOIN utilisateurs u ON u.id = i.utilisateur_id
  WHERE i.seance_id = ? ORDER BY u.nom`).all(seanceId);

function trouver(req, res) {
  const acces = seanceAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) res.status(404).json({ erreur: t(req, 'reunion_introuvable') });
  return acces;
}

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
    const { micro = true, camera = true } = req.body || {};
    res.json(await visio.lienVisio({ seance, classe, utilisateur: u, moderateur, langue: langueDe(req), micro: micro !== false, camera: camera !== false }));
  } catch (err) {
    next(err);
  }
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
    peutModifier: peutAnimer(req.utilisateur, seance, classe),
    accesEquipe: acces.accesEquipe,
  });
});

routeur.post('/:id/participants', (req, res) => {
  const acces = trouver(req, res);
  if (!acces) return;
  const { seance, classe } = acces;
  if (!peutAnimer(req.utilisateur, seance, classe)) return res.status(403).json({ erreur: t(req, 'participants_hote') });
  const ajoutes = ajouterInvites(seance, classe.espace_id, req.body?.ids);
  annoncerSeances(req, classe.id, ajoutes);
  res.json({ invites: invitesDe(seance.id) });
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
