/** Discussion de classe en temps réel (Socket.IO). */
const cookie = require('cookie');
const db = require('./db');
const { NOM_COOKIE, utilisateurDepuisJeton } = require('./auth');
const { classeAccessible, canalAccessible, peutEcrire, SQL_MESSAGE } = require('./metier');
const { t } = require('./i18n');

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
      repondre({ ok: true });
    });
  });
};
