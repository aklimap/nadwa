const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Base créée par une version antérieure (schéma différent) : on s'arrête avec un message clair.
const colonnes = (table) => db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all().map((c) => c.name);
const messagesSansCanal = colonnes('messages').length && !colonnes('messages').includes('canal_id');
if (colonnes('utilisateurs').includes('role') || colonnes('espaces').includes('type') || messagesSansCanal) {
  console.error('Database from an older version detected. Run "npm run seed:reset" to recreate it.');
  process.exit(1);
}

const MAINTENANT = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

db.exec(`
CREATE TABLE IF NOT EXISTS utilisateurs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nom             TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  mot_de_passe    TEXT NOT NULL,
  est_superadmin  INTEGER NOT NULL DEFAULT 0,   -- exploitant de la plateforme
  cree_le         TEXT NOT NULL DEFAULT ${MAINTENANT}
);

-- Un espace = une organisation cliente (université, école, entreprise, association…).
CREATE TABLE IF NOT EXISTS espaces (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nom              TEXT NOT NULL,
  code_invitation  TEXT NOT NULL UNIQUE,
  cree_par         INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le          TEXT NOT NULL DEFAULT ${MAINTENANT}
);

-- Rôle d'une personne dans une organisation (admin ou membre), comme dans Teams.
-- Une même personne peut appartenir à plusieurs organisations.
CREATE TABLE IF NOT EXISTS adhesions (
  espace_id       INTEGER NOT NULL REFERENCES espaces(id) ON DELETE CASCADE,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'membre')),
  rejoint_le      TEXT NOT NULL DEFAULT ${MAINTENANT},
  PRIMARY KEY (espace_id, utilisateur_id)
);

-- Une équipe (« team ») ; responsable_id = propriétaire (owner) de l'équipe.
CREATE TABLE IF NOT EXISTS classes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  espace_id        INTEGER NOT NULL REFERENCES espaces(id) ON DELETE CASCADE,
  nom              TEXT NOT NULL,
  module           TEXT,
  description      TEXT,
  responsable_id   INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  code_invitation  TEXT NOT NULL UNIQUE,
  cree_le          TEXT NOT NULL DEFAULT ${MAINTENANT}
);

CREATE TABLE IF NOT EXISTS membres (
  classe_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  rejoint_le      TEXT NOT NULL DEFAULT ${MAINTENANT},
  PRIMARY KEY (classe_id, utilisateur_id)
);

CREATE TABLE IF NOT EXISTS seances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  titre       TEXT NOT NULL,
  debut       TEXT NOT NULL,          -- ISO 8601 UTC
  duree_min   INTEGER NOT NULL DEFAULT 90,
  reunion_id  TEXT NOT NULL UNIQUE,   -- identifiant de la salle de visio
  organisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le     TEXT NOT NULL DEFAULT ${MAINTENANT}
);

-- Canaux d'une équipe : « General » est créé automatiquement et ne peut pas être supprimé.
-- annonces = 1 : seuls les propriétaires de l'équipe peuvent y écrire.
CREATE TABLE IF NOT EXISTS canaux (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  description  TEXT,
  est_general  INTEGER NOT NULL DEFAULT 0,
  annonces     INTEGER NOT NULL DEFAULT 0,
  cree_le      TEXT NOT NULL DEFAULT ${MAINTENANT}
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  classe_id       INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  canal_id        INTEGER NOT NULL REFERENCES canaux(id) ON DELETE CASCADE,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  contenu         TEXT NOT NULL,
  cree_le         TEXT NOT NULL DEFAULT ${MAINTENANT}
);

-- Participants invités à une réunion en plus des membres de l'équipe (autres personnes de l'organisation).
CREATE TABLE IF NOT EXISTS seance_invites (
  seance_id       INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  PRIMARY KEY (seance_id, utilisateur_id)
);

CREATE INDEX IF NOT EXISTS idx_invites_utilisateur ON seance_invites(utilisateur_id);

-- Conversations directes (à deux ou en petit groupe), comme le volet « Conversation » de Teams.
CREATE TABLE IF NOT EXISTS conversations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nom         TEXT,                     -- nom d'un groupe ; vide pour une conversation à deux
  reunion_id  TEXT UNIQUE,              -- salle de visio de la conversation (appels)
  cree_par    INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le     TEXT NOT NULL DEFAULT ${MAINTENANT},
  maj_le      TEXT NOT NULL DEFAULT ${MAINTENANT}
);
CREATE TABLE IF NOT EXISTS conversation_membres (
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  utilisateur_id   INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  lu_jusqua        INTEGER NOT NULL DEFAULT 0,   -- dernier message lu
  PRIMARY KEY (conversation_id, utilisateur_id)
);
CREATE TABLE IF NOT EXISTS messages_directs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  utilisateur_id   INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  type             TEXT NOT NULL DEFAULT 'texte' CHECK (type IN ('texte', 'appel')),
  contenu          TEXT NOT NULL,
  cree_le          TEXT NOT NULL DEFAULT ${MAINTENANT}
);
CREATE INDEX IF NOT EXISTS idx_conv_membres_utilisateur ON conversation_membres(utilisateur_id);

-- Demandes de réinitialisation du mot de passe (on ne garde que l'empreinte du jeton).
CREATE TABLE IF NOT EXISTS reinitialisations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jeton_hash      TEXT NOT NULL UNIQUE,
  expire_le       TEXT NOT NULL,
  utilise         INTEGER NOT NULL DEFAULT 0,
  cree_le         TEXT NOT NULL DEFAULT ${MAINTENANT}
);

-- Fichiers et dossiers (bibliothèque de documents de chaque canal, comme SharePoint dans Teams),
-- et pièces jointes des conversations directes.
CREATE TABLE IF NOT EXISTS fichiers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  canal_id         INTEGER REFERENCES canaux(id) ON DELETE CASCADE,
  conversation_id  INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id        INTEGER REFERENCES fichiers(id) ON DELETE CASCADE,  -- dossier parent
  est_dossier      INTEGER NOT NULL DEFAULT 0,
  nom              TEXT NOT NULL,
  type_mime        TEXT,
  taille           INTEGER NOT NULL DEFAULT 0,
  stockage         TEXT,                                              -- nom du fichier sur le disque
  utilisateur_id   INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le          TEXT NOT NULL DEFAULT ${MAINTENANT}
);
CREATE INDEX IF NOT EXISTS idx_fichiers_canal ON fichiers(canal_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_fichiers_conversation ON fichiers(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_directs ON messages_directs(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_adhesions_utilisateur ON adhesions(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_classes_espace ON classes(espace_id);
CREATE INDEX IF NOT EXISTS idx_membres_utilisateur ON membres(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_seances_classe ON seances(classe_id, debut);
CREATE INDEX IF NOT EXISTS idx_canaux_classe ON canaux(classe_id);
CREATE INDEX IF NOT EXISTS idx_messages_canal ON messages(canal_id, id);
`);

// Colonnes ajoutées dans les versions récentes : mise à jour automatique des bases existantes.
if (!colonnes('espaces').includes('personnel')) {
  db.exec('ALTER TABLE espaces ADD COLUMN personnel INTEGER NOT NULL DEFAULT 0'); // espace personnel (mode libre)
}
if (!colonnes('seances').includes('jeton_invite')) {
  db.exec('ALTER TABLE seances ADD COLUMN jeton_invite TEXT'); // lien d'invitation sans compte
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_seances_jeton ON seances(jeton_invite)');
}

// Langue préférée de chaque personne (pour les e-mails).
if (!colonnes('utilisateurs').includes('langue')) db.exec("ALTER TABLE utilisateurs ADD COLUMN langue TEXT NOT NULL DEFAULT 'en'");

// Pièce jointe d'un message (canal ou conversation directe).
if (!colonnes('messages').includes('fichier_id')) db.exec('ALTER TABLE messages ADD COLUMN fichier_id INTEGER REFERENCES fichiers(id) ON DELETE SET NULL');
if (!colonnes('messages_directs').includes('fichier_id')) db.exec('ALTER TABLE messages_directs ADD COLUMN fichier_id INTEGER REFERENCES fichiers(id) ON DELETE SET NULL');

// Bases antérieures à l'ajout de l'organisateur des réunions : on ajoute la colonne.
if (!colonnes('seances').includes('organisateur_id')) {
  db.exec('ALTER TABLE seances ADD COLUMN organisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL');
}

module.exports = db;
