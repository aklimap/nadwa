/**
 * Fichiers : bibliothèque de documents de chaque canal (dossiers, téléversement, aperçu, téléchargement),
 * et pièces jointes des conversations directes. Équivalent de l'onglet « Fichiers » (SharePoint) de Teams.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const config = require('../config');
const { exigerConnexion } = require('../auth');
const { canalAccessible, estResponsable, peutEcrire, SQL_MESSAGE } = require('../metier');
const { t } = require('../i18n');

const routeur = express.Router();
routeur.use(exigerConnexion);
fs.mkdirSync(config.fichiersDir, { recursive: true });

const brut = express.raw({ type: () => true, limit: `${config.tailleMaxMo}mb` });
const SQL_FICHIER = `
  SELECT f.id, f.canal_id, f.conversation_id, f.parent_id, f.est_dossier, f.nom, f.type_mime, f.taille, f.cree_le,
         u.id AS auteur_id, u.nom AS auteur_nom
  FROM fichiers f LEFT JOIN utilisateurs u ON u.id = f.utilisateur_id`;

const nomPropre = (nom) => String(nom || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 180);
const membreConversation = (cid, uid) => Boolean(db.prepare('SELECT 1 FROM conversation_membres WHERE conversation_id = ? AND utilisateur_id = ?').get(cid, uid));

/** Accès à un fichier ou dossier : via son canal (équipe) ou sa conversation. */
function accesFichier(u, fichier) {
  if (fichier.canal_id) {
    const acces = canalAccessible(u, fichier.canal_id);
    return acces ? { ...acces, gerer: fichier.utilisateur_id === u.id || estResponsable(u, acces.classe) } : null;
  }
  if (fichier.conversation_id && membreConversation(fichier.conversation_id, u.id)) return { gerer: fichier.utilisateur_id === u.id };
  return null;
}

/** Chemin d'un dossier (pour le fil d'Ariane). */
function cheminDe(dossierId) {
  const chemin = [];
  let id = dossierId;
  while (id) {
    const d = db.prepare('SELECT id, nom, parent_id FROM fichiers WHERE id = ? AND est_dossier = 1').get(id);
    if (!d) break;
    chemin.unshift({ id: d.id, nom: d.nom });
    id = d.parent_id;
  }
  return chemin;
}

/** Dossier de destination valide dans ce canal, ou null (racine). */
function dossierDuCanal(canalId, dossierId) {
  if (!dossierId) return null;
  const d = db.prepare('SELECT id FROM fichiers WHERE id = ? AND canal_id = ? AND est_dossier = 1').get(Number(dossierId), canalId);
  return d ? d.id : undefined;
}

function enregistrer(req, { canalId = null, conversationId = null, parentId = null }) {
  const nom = nomPropre(decodeURIComponent(req.get('x-nom-fichier') || ''));
  if (!nom) return { erreur: 'fichier_nom' };
  if (!Buffer.isBuffer(req.body) || !req.body.length) return { erreur: 'fichier_vide' };
  const stockage = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(path.join(config.fichiersDir, stockage), req.body);
  const type = String(req.get('content-type') || 'application/octet-stream').split(';')[0].slice(0, 100);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO fichiers (canal_id, conversation_id, parent_id, nom, type_mime, taille, stockage, utilisateur_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(canalId, conversationId, parentId, nom, type, req.body.length, stockage, req.utilisateur.id);
  return { fichier: db.prepare(`${SQL_FICHIER} WHERE f.id = ?`).get(lastInsertRowid) };
}

// ---------- Bibliothèque d'un canal ----------
routeur.get('/canaux/:id/fichiers', (req, res) => {
  const acces = canalAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) return res.status(404).json({ erreur: t(req, 'canal_introuvable') });
  const dossier = dossierDuCanal(acces.canal.id, req.query.dossier);
  if (dossier === undefined) return res.status(404).json({ erreur: t(req, 'dossier_introuvable') });
  const elements = db.prepare(`${SQL_FICHIER} WHERE f.canal_id = ? AND f.parent_id IS ? ORDER BY f.est_dossier DESC, f.nom COLLATE NOCASE`)
    .all(acces.canal.id, dossier);
  const gerer = estResponsable(req.utilisateur, acces.classe);
  res.json({
    chemin: cheminDe(dossier),
    elements: elements.map((e) => ({ ...e, peut_supprimer: gerer || e.auteur_id === req.utilisateur.id })),
    peut_deposer: peutEcrire(req.utilisateur, acces.canal, acces.classe),
  });
});

// Téléverser dans un canal (et l'annoncer dans le fil des publications, comme Teams).
routeur.post('/canaux/:id/fichiers', brut, (req, res) => {
  const acces = canalAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) return res.status(404).json({ erreur: t(req, 'canal_introuvable') });
  const { canal, classe } = acces;
  if (!peutEcrire(req.utilisateur, canal, classe)) return res.status(403).json({ erreur: t(req, 'annonces_owner') });
  const parentId = dossierDuCanal(canal.id, req.query.dossier);
  if (parentId === undefined) return res.status(404).json({ erreur: t(req, 'dossier_introuvable') });
  const r = enregistrer(req, { canalId: canal.id, parentId });
  if (r.erreur) return res.status(400).json({ erreur: t(req, r.erreur) });
  if (req.query.publier !== '0') {
    const contenu = String(decodeURIComponent(req.get('x-commentaire') || '')).trim().slice(0, 4000);
    const { lastInsertRowid } = db.prepare('INSERT INTO messages (classe_id, canal_id, utilisateur_id, contenu, fichier_id) VALUES (?, ?, ?, ?, ?)')
      .run(classe.id, canal.id, req.utilisateur.id, contenu, r.fichier.id);
    req.app.get('io')?.to(`classe:${classe.id}`).emit('message:nouveau', db.prepare(`${SQL_MESSAGE} WHERE m.id = ?`).get(lastInsertRowid));
  }
  req.app.get('io')?.to(`classe:${classe.id}`).emit('fichiers:maj', { canal_id: canal.id });
  res.status(201).json(r.fichier);
});

routeur.post('/canaux/:id/dossiers', express.json(), (req, res) => {
  const acces = canalAccessible(req.utilisateur, Number(req.params.id));
  if (!acces) return res.status(404).json({ erreur: t(req, 'canal_introuvable') });
  if (!peutEcrire(req.utilisateur, acces.canal, acces.classe)) return res.status(403).json({ erreur: t(req, 'annonces_owner') });
  const nom = nomPropre(req.body?.nom);
  if (!nom) return res.status(400).json({ erreur: t(req, 'dossier_nom') });
  const parentId = dossierDuCanal(acces.canal.id, req.body?.parent_id);
  if (parentId === undefined) return res.status(404).json({ erreur: t(req, 'dossier_introuvable') });
  if (db.prepare('SELECT 1 FROM fichiers WHERE canal_id = ? AND parent_id IS ? AND est_dossier = 1 AND nom = ? COLLATE NOCASE').get(acces.canal.id, parentId, nom)) {
    return res.status(409).json({ erreur: t(req, 'dossier_existe') });
  }
  const { lastInsertRowid } = db.prepare('INSERT INTO fichiers (canal_id, parent_id, est_dossier, nom, utilisateur_id) VALUES (?, ?, 1, ?, ?)')
    .run(acces.canal.id, parentId, nom, req.utilisateur.id);
  req.app.get('io')?.to(`classe:${acces.classe.id}`).emit('fichiers:maj', { canal_id: acces.canal.id });
  res.status(201).json(db.prepare(`${SQL_FICHIER} WHERE f.id = ?`).get(lastInsertRowid));
});

// ---------- Pièce jointe dans une conversation directe ----------
routeur.post('/conversations/:id/fichiers', brut, (req, res) => {
  const cid = Number(req.params.id);
  if (!membreConversation(cid, req.utilisateur.id)) return res.status(404).json({ erreur: t(req, 'conversation_introuvable') });
  const r = enregistrer(req, { conversationId: cid });
  if (r.erreur) return res.status(400).json({ erreur: t(req, r.erreur) });
  const { ajouterMessage, prevenir } = require('./conversations');
  const message = ajouterMessage(cid, req.utilisateur.id, String(decodeURIComponent(req.get('x-commentaire') || '')).trim().slice(0, 4000), 'texte', r.fichier.id);
  prevenir(req, cid, 'dm:nouveau', message);
  res.status(201).json(r.fichier);
});

// ---------- Ouvrir, télécharger, supprimer ----------
routeur.get('/fichiers/:id', (req, res) => {
  const f = db.prepare('SELECT * FROM fichiers WHERE id = ? AND est_dossier = 0').get(Number(req.params.id));
  if (!f || !accesFichier(req.utilisateur, f)) return res.status(404).json({ erreur: t(req, 'fichier_introuvable') });
  const chemin = path.join(config.fichiersDir, f.stockage);
  if (!fs.existsSync(chemin)) return res.status(404).json({ erreur: t(req, 'fichier_introuvable') });
  // Aperçu dans le navigateur pour les images et les PDF ; téléchargement pour le reste.
  const apercu = !req.query.telecharger && /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/plain)$/.test(f.type_mime || '');
  res.setHeader('Content-Type', f.type_mime || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${apercu ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.nom)}`);
  res.sendFile(chemin);
});

routeur.delete('/fichiers/:id', (req, res) => {
  const f = db.prepare('SELECT * FROM fichiers WHERE id = ?').get(Number(req.params.id));
  const acces = f && accesFichier(req.utilisateur, f);
  if (!acces) return res.status(404).json({ erreur: t(req, 'fichier_introuvable') });
  if (!acces.gerer) return res.status(403).json({ erreur: t(req, 'fichier_suppr_droits') });
  // Un dossier est supprimé avec tout son contenu (fichiers effacés du disque).
  const aEffacer = [];
  const collecter = (id) => {
    for (const e of db.prepare('SELECT id, est_dossier, stockage FROM fichiers WHERE parent_id = ?').all(id)) {
      if (e.est_dossier) collecter(e.id); else if (e.stockage) aEffacer.push(e.stockage);
    }
  };
  if (f.est_dossier) collecter(f.id); else if (f.stockage) aEffacer.push(f.stockage);
  db.prepare('DELETE FROM fichiers WHERE id = ?').run(f.id);
  for (const s of aEffacer) fs.rm(path.join(config.fichiersDir, s), { force: true }, () => {});
  if (acces.classe) req.app.get('io')?.to(`classe:${acces.classe.id}`).emit('fichiers:maj', { canal_id: f.canal_id });
  res.json({ ok: true });
});

module.exports = routeur;
