/**
 * Au premier démarrage en production : crée le compte de l'exploitant de la plateforme
 * si ADMIN_EMAIL et ADMIN_MOT_DE_PASSE sont définis et qu'aucun exploitant n'existe encore.
 * (Aucune donnée de démonstration n'est créée.)
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

/** « arezki.lehad@… » → « Arezki Lehad » (modifiable ensuite dans « Mon profil »). */
const nomDepuisEmail = (email) => (process.env.ADMIN_NOM || email.split('@')[0])
  .split(/[._-]+/).filter(Boolean).map((m) => m[0].toUpperCase() + m.slice(1)).join(' ');

module.exports = function amorcer() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE || '';
  if (!email || !motDePasse) return;
  // Compte déjà créé par une version précédente sous le nom provisoire : on lui donne un vrai nom.
  db.prepare("UPDATE utilisateurs SET nom = ? WHERE est_superadmin = 1 AND email = ? AND nom = 'Platform operator'")
    .run(nomDepuisEmail(email), email);
  if (db.prepare('SELECT 1 FROM utilisateurs WHERE est_superadmin = 1').get()) return;

  const existant = db.prepare('SELECT id FROM utilisateurs WHERE email = ?').get(email);
  if (existant) {
    db.prepare('UPDATE utilisateurs SET est_superadmin = 1 WHERE id = ?').run(existant.id);
  } else {
    if (motDePasse.length < 8) {
      console.warn('ADMIN_MOT_DE_PASSE must be at least 8 characters: operator account not created.');
      return;
    }
    db.prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, est_superadmin) VALUES (?, ?, ?, 1)')
      .run(nomDepuisEmail(email), email, bcrypt.hashSync(motDePasse, 10));
  }
  console.log(`Platform operator account ready: ${email}`);
};
