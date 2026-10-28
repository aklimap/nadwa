/**
 * Présences aux réunions, comme le rapport de présence de Teams.
 *
 * Chaque entrée dans la visio ouvre une « session » (arrivée) ; la page envoie un signe de vie
 * chaque minute et prévient quand elle part. Sans signe de vie depuis 3 minutes, la personne
 * est considérée partie à son dernier signe de vie (onglet fermé, téléphone éteint…).
 *
 * Le rapport liste les personnes attendues (propriétaire et membres de l'équipe, invités) et
 * les invités venus par le lien, avec : arrivée, départ, durée, et un statut (Présent, En retard,
 * Absent) que l'organisateur peut corriger (ex. Excusé).
 */
const crypto = require('crypto');
const db = require('./db');

const ABSENCE_MS = 3 * 60_000;
const RETARD_MIN = 10;
const STATUTS = ['present', 'retard', 'absent', 'excuse'];

db.exec(`
CREATE TABLE IF NOT EXISTS presences_reunion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  secret          TEXT NOT NULL,
  seance_id       INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  cle             TEXT NOT NULL,           -- u:<id> (compte) ou i:<demande> (invité sans compte)
  utilisateur_id  INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  nom             TEXT NOT NULL,
  arrivee         INTEGER NOT NULL,
  vu              INTEGER NOT NULL,
  depart          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_presences_seance ON presences_reunion(seance_id, cle);
CREATE TABLE IF NOT EXISTS presences_statuts (
  seance_id  INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  cle        TEXT NOT NULL,
  statut     TEXT NOT NULL,
  PRIMARY KEY (seance_id, cle)
);
`);

/** Ouvre une session de présence ; reprend la précédente si la page revient vite (rechargement). */
function arriver(seance, { cle, utilisateurId = null, nom }) {
  const maintenant = Date.now();
  const recente = db.prepare(`SELECT * FROM presences_reunion WHERE seance_id = ? AND cle = ?
    AND (depart IS NULL OR depart > ?) AND vu > ? ORDER BY id DESC LIMIT 1`)
    .get(seance.id, cle, maintenant - 60_000, maintenant - ABSENCE_MS);
  if (recente) {
    db.prepare('UPDATE presences_reunion SET depart = NULL, vu = ? WHERE id = ?').run(maintenant, recente.id);
    return { id: recente.id, secret: recente.secret };
  }
  const secret = crypto.randomBytes(16).toString('base64url');
  const { lastInsertRowid } = db.prepare(`INSERT INTO presences_reunion (secret, seance_id, cle, utilisateur_id, nom, arrivee, vu)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(secret, seance.id, cle, utilisateurId, String(nom).slice(0, 80), maintenant, maintenant);
  return { id: Number(lastInsertRowid), secret };
}

function session(id, secret) {
  const p = db.prepare('SELECT * FROM presences_reunion WHERE id = ?').get(Number(id));
  return p && secret && p.secret === String(secret) ? p : null;
}
const signeDeVie = (p) => { if (!p.depart) db.prepare('UPDATE presences_reunion SET vu = ? WHERE id = ?').run(Date.now(), p.id); };
const partir = (p) => { if (!p.depart) db.prepare('UPDATE presences_reunion SET depart = ?, vu = ? WHERE id = ?').run(Date.now(), Date.now(), p.id); };

/** Fin de la réunion : toutes les sessions ouvertes se ferment. */
function fermerTout(seanceId) {
  const maintenant = Date.now();
  db.prepare(`UPDATE presences_reunion SET depart = CASE WHEN vu < ? THEN vu ELSE ? END WHERE seance_id = ? AND depart IS NULL`)
    .run(maintenant - ABSENCE_MS, maintenant, seanceId);
}

/** Départ effectif d'une session (null = encore dans la réunion). */
function departDe(p, maintenant) {
  if (p.depart) return p.depart;
  return maintenant - p.vu > ABSENCE_MS ? p.vu : null;
}

/**
 * Rapport de présence d'une réunion.
 * Personnes attendues : propriétaire, membres de l'équipe, invités (comptes et adresses e-mail),
 * puis les personnes venues sans être attendues (invités par le lien).
 */
function rapport(seance, classe) {
  const maintenant = Date.now();
  const debut = Date.parse(seance.debut);
  const commencee = maintenant >= debut || Boolean(seance.ouverte_le);
  const finie = Boolean(seance.terminee_le) || maintenant > debut + seance.duree_min * 60_000;

  const lignes = new Map(); // cle -> ligne
  const ajouter = (cle, nom, email, role) => {
    if (!lignes.has(cle)) lignes.set(cle, { cle, nom, email, role, sessions: [] });
    return lignes.get(cle);
  };
  const organisateur = seance.organisateur_id || classe.responsable_id;
  const comptes = db.prepare(`
    SELECT u.id, u.nom, u.email FROM utilisateurs u
    WHERE u.id = ? OR u.id = ? OR u.id IN (SELECT utilisateur_id FROM membres WHERE classe_id = ?)
    ORDER BY u.nom`).all(organisateur, classe.responsable_id, classe.id);
  for (const u of comptes) ajouter(`u:${u.id}`, u.nom, u.email, u.id === organisateur ? 'organisateur' : 'membre');
  for (const u of db.prepare(`SELECT u.id, u.nom, u.email FROM seance_invites i JOIN utilisateurs u ON u.id = i.utilisateur_id
    WHERE i.seance_id = ? ORDER BY u.nom`).all(seance.id)) ajouter(`u:${u.id}`, u.nom, u.email, 'invite');
  for (const { email } of db.prepare('SELECT email FROM seance_invites_externes WHERE seance_id = ? ORDER BY email').all(seance.id)) {
    ajouter(`e:${email}`, email, email, 'invite_email');
  }

  for (const p of db.prepare('SELECT * FROM presences_reunion WHERE seance_id = ? ORDER BY arrivee').all(seance.id)) {
    const ligne = lignes.get(p.cle) || ajouter(p.cle, p.nom, null, p.cle.startsWith('i:') ? 'invite_lien' : 'invite');
    ligne.sessions.push({ arrivee: p.arrivee, depart: departDe(p, maintenant) });
  }

  const corrections = new Map(db.prepare('SELECT cle, statut FROM presences_statuts WHERE seance_id = ?').all(seance.id).map((x) => [x.cle, x.statut]));
  const resultat = [...lignes.values()].map((l) => {
    const arrivee = l.sessions.length ? Math.min(...l.sessions.map((s) => s.arrivee)) : null;
    const enCours = l.sessions.some((s) => s.depart === null);
    const depart = l.sessions.length && !enCours ? Math.max(...l.sessions.map((s) => s.depart)) : null;
    const duree = l.sessions.reduce((n, s) => n + ((s.depart ?? maintenant) - s.arrivee), 0);
    let auto;
    if (arrivee) auto = arrivee > debut + RETARD_MIN * 60_000 && l.role !== 'organisateur' ? 'retard' : 'present';
    else if (l.role === 'invite_email') auto = null; // venu peut-être par le lien sous un autre nom
    else auto = commencee ? 'absent' : null;
    return {
      cle: l.cle, nom: l.nom, email: l.email, role: l.role,
      arrivee: arrivee ? new Date(arrivee).toISOString() : null,
      depart: depart ? new Date(depart).toISOString() : null,
      en_cours: enCours,
      duree_min: Math.round(duree / 60_000),
      entrees: l.sessions.length,
      statut_auto: auto,
      statut: corrections.get(l.cle) || auto,
      corrige: corrections.has(l.cle),
    };
  });
  const ordre = { organisateur: 0, membre: 1, invite: 2, invite_email: 3, invite_lien: 4 };
  resultat.sort((a, b) => ordre[a.role] - ordre[b.role] || a.nom.localeCompare(b.nom));
  const compte = (s) => resultat.filter((r) => r.statut === s).length;
  return {
    seance: { id: seance.id, titre: seance.titre, debut: seance.debut, duree_min: seance.duree_min, finie },
    resume: { attendus: resultat.filter((r) => r.role !== 'invite_lien').length, presents: compte('present') + compte('retard'), retards: compte('retard'), absents: compte('absent'), excuses: compte('excuse') },
    lignes: resultat,
  };
}

function corriger(seanceId, cle, statut) {
  if (!statut) db.prepare('DELETE FROM presences_statuts WHERE seance_id = ? AND cle = ?').run(seanceId, cle);
  else db.prepare('INSERT OR REPLACE INTO presences_statuts (seance_id, cle, statut) VALUES (?, ?, ?)').run(seanceId, cle, statut);
}

/** Rapport en CSV (séparateur « ; » et BOM : s'ouvre directement dans Excel). */
function csv(r, { langue = 'fr', fuseau = 'Africa/Algiers', libelles }) {
  let tz = fuseau;
  try { new Intl.DateTimeFormat('fr', { timeZone: tz }); } catch { tz = 'Africa/Algiers'; }
  const f = new Intl.DateTimeFormat({ fr: 'fr-FR', en: 'en-GB', ar: 'ar-DZ' }[langue] || 'fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: tz });
  const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lignes = [libelles.entetes.map(cel).join(';')];
  for (const l of r.lignes) {
    lignes.push([l.nom, l.email || '', libelles.roles[l.role] || l.role, libelles.statuts[l.statut] || '—',
      l.arrivee ? f.format(new Date(l.arrivee)) : '', l.depart ? f.format(new Date(l.depart)) : (l.en_cours ? libelles.en_cours : ''),
      l.duree_min, l.entrees].map(cel).join(';'));
  }
  return `﻿${lignes.join('\r\n')}\r\n`;
}

module.exports = { arriver, session, signeDeVie, partir, fermerTout, rapport, corriger, csv, STATUTS };
