/** Discussion de classe en temps réel (Socket.IO). */
const cookie = require('cookie');
const db = require('./db');
const { NOM_COOKIE, utilisateurDepuisJeton } = require('./auth');
const { classeAccessible, canalAccessible, peutEcrire, SQL_MESSAGE } = require('./metier');
const { t } = require('./i18n');

// ---------- Présence ----------
// Statut affiché : disponible, en_reunion, veille (inactif depuis 5 min), absent,
// non_disponible, hors_ligne. Les personnes d'une même organisation se voient.
const STATUTS_CHOISIS = ['auto', 'absent', 'non_disponible'];
const presences = new Map(); // id -> { choix, sockets: Map(socketId -> { inactif, reunion }), affiche }

function statutDe(id) {
  const p = presences.get(id);
  if (!p || !p.sockets.size) return 'hors_ligne';
  if (p.choix === 'absent' || p.choix === 'non_disponible') return p.choix;
  const etats = [...p.sockets.values()];
  if (etats.some((e) => e.reunion)) return 'en_reunion';
  return etats.every((e) => e.inactif) ? 'veille' : 'disponible';
}

const espacesDe = (id) => db.prepare('SELECT espace_id FROM adhesions WHERE utilisateur_id = ?').all(id).map((e) => e.espace_id);

/** Prévient les organisations de la personne si son statut affiché a changé. */
function diffuserPresence(io, id) {
  const statut = statutDe(id);
  const p = presences.get(id);
  if (p) { if (p.affiche === statut) return; p.affiche = statut; }
  let cible = io.to(`utilisateur:${id}`);
  for (const e of espacesDe(id)) cible = cible.to(`espace:${e}`);
  cible.emit('presence:maj', { id, statut });
  if (statut === 'hors_ligne') presences.delete(id);
}

module.exports = function brancherTempsReel(io) {
  io.use((socket, next) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const utilisateur = utilisateurDepuisJeton(cookies[NOM_COOKIE]);
    if (!utilisateur) return next(new Error('non-authentifie'));
    socket.data.utilisateur = utilisateur;
    next();
  });

  io.on('connection', (socket) => {
    const u = socket.data.utilisateur;
    socket.join(`utilisateur:${u.id}`); // notifications personnelles (invitations aux réunions)

    // Présence : on rejoint ses organisations, puis on reçoit l'état de ses collègues connectés.
    const espaces = espacesDe(u.id);
    for (const e of espaces) socket.join(`espace:${e}`);
    if (!presences.has(u.id)) {
      const choix = db.prepare('SELECT statut_choisi FROM utilisateurs WHERE id = ?').get(u.id)?.statut_choisi;
      presences.set(u.id, { choix: STATUTS_CHOISIS.includes(choix) ? choix : 'auto', sockets: new Map(), affiche: 'hors_ligne' });
    }
    presences.get(u.id).sockets.set(socket.id, { inactif: false, reunion: false });
    diffuserPresence(io, u.id);
    const collegues = espaces.length
      ? db.prepare(`SELECT DISTINCT utilisateur_id AS id FROM adhesions WHERE espace_id IN (${espaces.map(() => '?').join(',')})`).all(...espaces)
      : [];
    const statuts = {};
    for (const { id } of collegues) if (presences.has(id)) statuts[id] = statutDe(id);
    statuts[u.id] = statutDe(u.id);
    socket.emit('presence:tout', { statuts, choix: presences.get(u.id).choix });

    const majSocket = (champ, valeur) => {
      const etat = presences.get(u.id)?.sockets.get(socket.id);
      if (!etat) return;
      etat[champ] = valeur;
      diffuserPresence(io, u.id);
    };
    socket.on('presence:activite', (inactif) => majSocket('inactif', Boolean(inactif)));
    // En visio : identifiant de la salle (pour le suivi de capacité), ou false en sortant.
    socket.on('presence:reunion', (salle) => majSocket('reunion', typeof salle === 'string' ? salle.slice(0, 80) : Boolean(salle)));
    socket.on('presence:choisir', (choix, ack) => {
      const repondre = typeof ack === 'function' ? ack : () => {};
      if (!STATUTS_CHOISIS.includes(choix)) return repondre({ ok: false });
      db.prepare('UPDATE utilisateurs SET statut_choisi = ? WHERE id = ?').run(choix, u.id);
      const p = presences.get(u.id);
      if (p) p.choix = choix;
      io.to(`utilisateur:${u.id}`).emit('presence:choix', choix);
      diffuserPresence(io, u.id);
      repondre({ ok: true });
    });
    socket.on('disconnect', () => {
      presences.get(u.id)?.sockets.delete(socket.id);
      diffuserPresence(io, u.id);
    });

    // Langue de l'interface, pour les messages d'erreur.
    socket.on('langue', (langue) => { socket.data.langue = String(langue || '').slice(0, 2); });

    socket.on('classe:rejoindre', (classeId) => {
      const classe = classeAccessible(u, Number(classeId));
      if (!classe) return;
      for (const salle of socket.rooms) if (salle.startsWith('classe:')) socket.leave(salle);
      socket.join(`classe:${classe.id}`);
    });

    // Messages directs : diffusés à chaque membre de la conversation.
    socket.on('dm:envoyer', (donnees, ack) => {
      const repondre = typeof ack === 'function' ? ack : () => {};
      const { ajouterMessage, estMembre, prevenir } = require('./routes/conversations');
      const conversationId = Number(donnees?.conversationId);
      const contenu = String(donnees?.contenu ?? '').trim();
      if (!contenu || contenu.length > 4000) return repondre({ ok: false, erreur: t(socket, 'message_longueur') });
      if (!estMembre(conversationId, u.id)) return repondre({ ok: false, erreur: t(socket, 'conversation_introuvable') });
      const message = ajouterMessage(conversationId, u.id, contenu);
      prevenir(io, conversationId, 'dm:nouveau', message);
      repondre({ ok: true });
    });

    // Les messages sont diffusés à toute l'équipe : l'interface signale les canaux non lus.
    socket.on('message:envoyer', (donnees, ack) => {
      const repondre = typeof ack === 'function' ? ack : () => {};
      const contenu = String(donnees?.contenu ?? '').trim();
      if (!contenu || contenu.length > 4000) {
        return repondre({ ok: false, erreur: t(socket, 'message_longueur') });
      }
      const acces = canalAccessible(u, Number(donnees?.canalId));
      if (!acces) return repondre({ ok: false, erreur: t(socket, 'canal_acces') });
      const { canal, classe } = acces;
      if (!peutEcrire(u, canal, classe)) return repondre({ ok: false, erreur: t(socket, 'annonces_owner') });

      const { lastInsertRowid } = db
        .prepare('INSERT INTO messages (classe_id, canal_id, utilisateur_id, contenu) VALUES (?, ?, ?, ?)')
        .run(classe.id, canal.id, u.id, contenu);
      const message = db.prepare(`${SQL_MESSAGE} WHERE m.id = ?`).get(lastInsertRowid);
      io.to(`classe:${classe.id}`).emit('message:nouveau', message);
      require('./notifications').publication(message);
      repondre({ ok: true });
    });
  });
};

// Statut affiché d'une personne (utilisé par les notifications).
module.exports.statutDe = statutDe;

// ---------- Suivi de la capacité (exploitant) ----------
// Chaque minute : nombre de réunions en cours et de personnes connectées en visio (comptes Nadwa ;
// les invités sans compte ne sont pas comptés). Gardé 180 jours.
function mesurerCapacite() {
  const salles = new Map();
  for (const [id, p] of presences) {
    for (const e of p.sockets.values()) {
      if (!e.reunion) continue;
      const salle = typeof e.reunion === 'string' ? e.reunion : `inconnue-${id}`;
      if (!salles.has(salle)) salles.set(salle, new Set());
      salles.get(salle).add(id);
    }
  }
  const tailles = [...salles.values()].map((s) => s.size);
  return { reunions: salles.size, participants: tailles.reduce((a, b) => a + b, 0), plus_grande: Math.max(0, ...tailles) };
}
function enregistrerMesure() {
  const m = mesurerCapacite();
  const minute = new Date(); minute.setSeconds(0, 0);
  db.prepare('INSERT OR REPLACE INTO mesures_capacite (horodatage, reunions, participants, plus_grande) VALUES (?, ?, ?, ?)')
    .run(minute.toISOString(), m.reunions, m.participants, m.plus_grande);
  if (minute.getMinutes() === 0) db.prepare('DELETE FROM mesures_capacite WHERE horodatage < ?').run(new Date(Date.now() - 180 * 864e5).toISOString());
}
setInterval(() => { try { enregistrerMesure(); } catch (err) { console.error('Mesure de capacité :', err.message); } }, 60_000).unref();
module.exports.mesurerCapacite = mesurerCapacite;

/** Nombre de personnes (comptes Nadwa) actuellement dans une salle de visio. */
module.exports.participantsSalle = (salle, sauf = null) => {
  let n = 0;
  for (const [id, p] of presences) if (id !== sauf && [...p.sockets.values()].some((e) => e.reunion === salle)) n += 1;
  return n;
};
