/**
 * Lien d'invitation d'une réunion : /r/<jeton>.
 * Toute personne qui a le lien peut entrer dans la salle avec seulement son nom, sans compte (comme Zoom).
 */
const express = require('express');
const db = require('../db');
const visio = require('../visio');
const { etatSeance, OUVERTURE_AVANT_MIN } = require('../metier');
const { t, langueDe } = require('../i18n');

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
  res.json({
    titre: seance.titre, debut: seance.debut, duree_min: seance.duree_min, etat: etatSeance(seance),
    equipe: classe.nom, organisateur, ouverture_min: OUVERTURE_AVANT_MIN,
  });
});

routeur.post('/:jeton/rejoindre', async (req, res, next) => {
  try {
    const { seance, classe } = trouver(req, res);
    if (!seance) return;
    const nom = String(req.body?.nom ?? '').trim().slice(0, 60);
    if (nom.length < 2) return res.status(400).json({ erreur: t(req, 'nom_invite') });
    const etat = etatSeance(seance);
    if (etat === 'a_venir') return res.status(403).json({ erreur: t(req, 'salle_ouvre', { min: OUVERTURE_AVANT_MIN }) });
    if (etat === 'terminee') return res.status(403).json({ erreur: t(req, 'reunion_terminee') });

    const invite = { id: `invite-${Date.now()}`, nom: `${nom} (${t(req, 'invite_externe')})` };
    res.json(await visio.lienVisio({ seance, classe, utilisateur: invite, moderateur: false, langue: langueDe(req), micro: req.body?.micro !== false, camera: req.body?.camera !== false }));
  } catch (err) {
    next(err);
  }
});

module.exports = routeur;
