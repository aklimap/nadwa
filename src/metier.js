const crypto = require('crypto');
const db = require('./db');

class ErreurHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const ROLES_ESPACE = ['admin', 'membre'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Renvoie la clé de traduction de l'erreur, ou null. */
function verifierCompte({ nom, email, motDePasse }) {
  if (!nom || nom.length < 2 || nom.length > 80) return 'nom_invalide';
  if (!EMAIL.test(email)) return 'email_invalide';
  if (motDePasse.length < 8) return 'mdp_court';
  return null;
}

// ---------- Espaces ----------

/** Rôle de l'utilisateur dans l'organisation ('admin' | 'membre'), ou null. */
function roleDansEspace(utilisateur, espaceId) {
  if (utilisateur.est_superadmin) return 'admin';
  return db.prepare('SELECT role FROM adhesions WHERE espace_id = ? AND utilisateur_id = ?')
    .get(espaceId, utilisateur.id)?.role ?? null;
}

function espacesDe(utilisateur) {
  return db.prepare(`
    SELECT e.id, e.nom, e.personnel, a.role
    FROM adhesions a JOIN espaces e ON e.id = a.espace_id
    WHERE a.utilisateur_id = ? ORDER BY e.nom`).all(utilisateur.id);
}

/** Les non-administrateurs ne voient pas le code d'invitation de l'espace. */
function espacePourUtilisateur(espace, role) {
  const { code_invitation, ...reste } = espace;
  return role === 'admin' ? { ...espace, role } : { ...reste, role };
}

// ---------- Groupes (classes, équipes…) ----------

/** Renvoie le groupe si l'utilisateur y a accès, sinon null. */
function classeAccessible(utilisateur, classeId) {
  const classe = db.prepare(`
    SELECT c.*, u.nom AS responsable_nom
    FROM classes c
    JOIN utilisateurs u ON u.id = c.responsable_id
    WHERE c.id = ?`).get(classeId);
  if (!classe) return null;

  const role = roleDansEspace(utilisateur, classe.espace_id);
  if (!role) return null; // retiré de l'espace = plus d'accès à ses groupes
  if (role === 'admin' || classe.responsable_id === utilisateur.id) return classe;

  const membre = db.prepare('SELECT 1 FROM membres WHERE classe_id = ? AND utilisateur_id = ?')
    .get(classeId, utilisateur.id);
  return membre ? classe : null;
}

/** Le propriétaire de l'équipe ou un administrateur de l'organisation. */
function estResponsable(utilisateur, classe) {
  return classe.responsable_id === utilisateur.id || roleDansEspace(utilisateur, classe.espace_id) === 'admin';
}

function classePourUtilisateur(classe, utilisateur) {
  if (estResponsable(utilisateur, classe)) return classe;
  const { code_invitation, ...reste } = classe;
  return reste;
}

// ---------- Séances ----------

// La salle ouvre quelques minutes avant le début.
const OUVERTURE_AVANT_MIN = 10;

function etatSeance(seance, maintenant = Date.now()) {
  if (seance.terminee_le) return 'terminee'; // terminée par l'organisateur
  const debut = Date.parse(seance.debut);
  const fin = debut + seance.duree_min * 60_000;
  if (maintenant < debut - OUVERTURE_AVANT_MIN * 60_000) return 'a_venir';
  if (maintenant <= fin) return 'en_direct';
  return 'terminee';
}

const avecEtat = (seance) => ({ ...seance, etat: etatSeance(seance) });

/** Requête des réunions avec le nom de l'organisateur et de l'équipe. */
const SQL_SEANCE = `
  SELECT s.*, o.nom AS organisateur_nom, c.nom AS classe_nom, c.responsable_id,
         (SELECT COUNT(*) FROM seance_invites i WHERE i.seance_id = s.id) AS nb_invites
  FROM seances s
  JOIN classes c ON c.id = s.classe_id
  LEFT JOIN utilisateurs o ON o.id = s.organisateur_id`;

/**
 * Accès à une réunion : membres de l'équipe, ou personnes invitées (toujours membres de l'organisation).
 * Renvoie { seance, classe, accesEquipe } ou null.
 */
function seanceAccessible(utilisateur, seanceId) {
  const seance = db.prepare('SELECT * FROM seances WHERE id = ?').get(seanceId);
  if (!seance) return null;
  const classeEquipe = classeAccessible(utilisateur, seance.classe_id);
  if (classeEquipe) return { seance, classe: classeEquipe, accesEquipe: true };
  const classe = db.prepare('SELECT c.*, u.nom AS responsable_nom FROM classes c JOIN utilisateurs u ON u.id = c.responsable_id WHERE c.id = ?').get(seance.classe_id);
  const invite = db.prepare('SELECT 1 FROM seance_invites WHERE seance_id = ? AND utilisateur_id = ?').get(seance.id, utilisateur.id);
  if (!invite || !roleDansEspace(utilisateur, classe.espace_id)) return null;
  return { seance, classe, accesEquipe: false };
}

/** Ajoute des invités ; ne garde que des membres de l'organisation. Renvoie les identifiants ajoutés. */
function ajouterInvites(seance, espaceId, ids) {
  const membreOrg = db.prepare('SELECT 1 FROM adhesions WHERE espace_id = ? AND utilisateur_id = ?');
  const inserer = db.prepare('INSERT OR IGNORE INTO seance_invites (seance_id, utilisateur_id) VALUES (?, ?)');
  const valides = [...new Set((Array.isArray(ids) ? ids : []).map(Number))].filter((id) => membreOrg.get(espaceId, id));
  db.transaction(() => valides.forEach((id) => inserer.run(seance.id, id)))();
  return valides;
}

/** Anime la réunion : l'organisateur, le propriétaire de l'équipe ou un administrateur. */
const peutAnimer = (utilisateur, seance, classe) =>
  seance.organisateur_id === utilisateur.id || estResponsable(utilisateur, classe);

// ---------- Clavardage d'équipe ----------

/**
 * Conversation de groupe de l'équipe (créée au besoin), avec pour membres le propriétaire
 * et les membres de l'équipe. Un administrateur de l'organisation qui l'ouvre y est ajouté.
 * Renvoie l'identifiant de la conversation.
 */
function clavardageEquipe(classe, utilisateur = null) {
  return db.transaction(() => {
    let conv = db.prepare('SELECT id, nom FROM conversations WHERE classe_id = ?').get(classe.id);
    if (!conv) {
      const { lastInsertRowid } = db.prepare('INSERT INTO conversations (nom, cree_par, classe_id) VALUES (?, ?, ?)')
        .run(classe.nom, classe.responsable_id, classe.id);
      conv = { id: Number(lastInsertRowid), nom: classe.nom };
    } else if (conv.nom !== classe.nom) {
      db.prepare('UPDATE conversations SET nom = ? WHERE id = ?').run(classe.nom, conv.id);
    }
    const voulus = new Set(db.prepare('SELECT utilisateur_id AS id FROM membres WHERE classe_id = ?').all(classe.id).map((m) => m.id));
    voulus.add(classe.responsable_id);
    if (utilisateur) voulus.add(utilisateur.id);
    const actuels = db.prepare('SELECT utilisateur_id AS id FROM conversation_membres WHERE conversation_id = ?').all(conv.id).map((m) => m.id);
    const dernier = db.prepare('SELECT MAX(id) AS n FROM messages_directs WHERE conversation_id = ?').get(conv.id).n || 0;
    const ajouter = db.prepare('INSERT OR IGNORE INTO conversation_membres (conversation_id, utilisateur_id, lu_jusqua) VALUES (?, ?, ?)');
    for (const id of voulus) if (!actuels.includes(id)) ajouter.run(conv.id, id, dernier);
    // Retirer les personnes qui ont quitté l'équipe (sauf les administrateurs de l'organisation).
    const retirer = db.prepare('DELETE FROM conversation_membres WHERE conversation_id = ? AND utilisateur_id = ?');
    for (const id of actuels) {
      if (voulus.has(id)) continue;
      const admin = db.prepare("SELECT 1 FROM adhesions WHERE espace_id = ? AND utilisateur_id = ? AND role = 'admin'").get(classe.espace_id, id);
      if (!admin) retirer.run(conv.id, id);
    }
    return conv.id;
  })();
}

// ---------- Codes ----------

// Sans caractères ambigus (0/O, 1/I). 32 symboles : tirage sans biais sur un octet.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code unique parmi les codes de groupes ET d'espaces (un seul champ « code » côté utilisateur). */
function nouveauCode(longueur) {
  const pris = db.prepare(`
    SELECT 1 FROM classes WHERE code_invitation = @code
    UNION SELECT 1 FROM espaces WHERE code_invitation = @code`);
  for (;;) {
    const code = [...crypto.randomBytes(longueur)].map((o) => ALPHABET[o % 32]).join('');
    if (!pris.get({ code })) return code;
  }
}
const nouveauCodeInvitation = () => nouveauCode(6); // groupes
const nouveauCodeEspace = () => nouveauCode(8);     // espaces

/** Jeton du lien d'invitation d'une réunion (créé à la demande pour les réunions plus anciennes). */
function jetonInvite(seanceId) {
  const existant = db.prepare('SELECT jeton_invite FROM seances WHERE id = ?').get(seanceId)?.jeton_invite;
  if (existant) return existant;
  const jeton = crypto.randomBytes(12).toString('base64url');
  db.prepare('UPDATE seances SET jeton_invite = ? WHERE id = ?').run(jeton, seanceId);
  return jeton;
}

/** Espace personnel de l'utilisateur (mode libre), créé avec une équipe « nomEquipe » s'il n'existe pas. */
function espacePersonnel(utilisateur, nomEquipe) {
  const existant = db.prepare(`
    SELECT e.* FROM espaces e JOIN adhesions a ON a.espace_id = e.id
    WHERE e.personnel = 1 AND e.cree_par = ? AND a.utilisateur_id = ?`).get(utilisateur.id, utilisateur.id);
  if (existant) return existant;
  return db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO espaces (nom, code_invitation, cree_par, personnel) VALUES (?, ?, ?, 1)')
      .run(utilisateur.nom, nouveauCodeEspace(), utilisateur.id);
    db.prepare("INSERT INTO adhesions (espace_id, utilisateur_id, role) VALUES (?, ?, 'admin')").run(lastInsertRowid, utilisateur.id);
    const equipe = db.prepare('INSERT INTO classes (espace_id, nom, responsable_id, code_invitation) VALUES (?, ?, ?, ?)')
      .run(lastInsertRowid, nomEquipe, utilisateur.id, nouveauCodeInvitation()).lastInsertRowid;
    creerCanalGeneral(equipe);
    return db.prepare('SELECT * FROM espaces WHERE id = ?').get(lastInsertRowid);
  })();
}

/** Personnes avec qui l'on peut discuter : celles qui partagent au moins une organisation. */
function contactsDe(utilisateur) {
  return db.prepare(`
    SELECT DISTINCT u.id, u.nom, u.email
    FROM adhesions a1 JOIN adhesions a2 ON a2.espace_id = a1.espace_id
    JOIN utilisateurs u ON u.id = a2.utilisateur_id
    WHERE a1.utilisateur_id = ? AND a2.utilisateur_id <> ?
    ORDER BY u.nom`).all(utilisateur.id, utilisateur.id);
}

const nouvelIdReunion = (classeId) => `nadwa-${classeId}-${crypto.randomBytes(8).toString('hex')}`;

const SQL_MESSAGE = `
  SELECT m.id, m.classe_id, m.canal_id, m.contenu, m.cree_le, u.id AS auteur_id, u.nom AS auteur_nom,
         m.fichier_id, f.nom AS fichier_nom, f.taille AS fichier_taille, f.type_mime AS fichier_type
  FROM messages m JOIN utilisateurs u ON u.id = m.utilisateur_id
  LEFT JOIN fichiers f ON f.id = m.fichier_id`;

// ---------- Canaux ----------

const SQL_CANAL = 'SELECT id, classe_id, nom, description, est_general, annonces, cree_le FROM canaux';

/** Crée le canal « General » d'une nouvelle équipe. */
function creerCanalGeneral(classeId) {
  db.prepare("INSERT INTO canaux (classe_id, nom, est_general) VALUES (?, 'General', 1)").run(classeId);
}

/** Canaux d'une équipe : General d'abord, puis par ordre alphabétique. */
function canauxDe(classeId) {
  return db.prepare(`${SQL_CANAL} WHERE classe_id = ? ORDER BY est_general DESC, nom COLLATE NOCASE`).all(classeId);
}

/** Renvoie { canal, classe } si l'utilisateur a accès à l'équipe du canal, sinon null. */
function canalAccessible(utilisateur, canalId) {
  const canal = db.prepare(`${SQL_CANAL} WHERE id = ?`).get(canalId);
  if (!canal) return null;
  const classe = classeAccessible(utilisateur, canal.classe_id);
  return classe ? { canal, classe } : null;
}

/** Peut-on écrire dans ce canal ? (canal d'annonces : propriétaires seulement) */
const peutEcrire = (utilisateur, canal, classe) => !canal.annonces || estResponsable(utilisateur, classe);

module.exports = {
  SQL_CANAL,
  creerCanalGeneral,
  canauxDe,
  canalAccessible,
  peutEcrire,
  ErreurHttp,
  ROLES_ESPACE,
  verifierCompte,
  roleDansEspace,
  espacesDe,
  espacePourUtilisateur,
  classeAccessible,
  estResponsable,
  classePourUtilisateur,
  OUVERTURE_AVANT_MIN,
  etatSeance,
  avecEtat,
  SQL_SEANCE,
  peutAnimer,
  clavardageEquipe,
  seanceAccessible,
  ajouterInvites,
  nouveauCodeInvitation,
  nouveauCodeEspace,
  nouvelIdReunion,
  jetonInvite,
  espacePersonnel,
  contactsDe,
  SQL_MESSAGE,
};
