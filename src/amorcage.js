/**
 * Au premier démarrage en production : crée le compte de l'exploitant de la plateforme
 * si ADMIN_EMAIL et ADMIN_MOT_DE_PASSE sont définis et qu'aucun exploitant n'existe encore.
 * (Aucune donnée de démonstration n'est créée.)
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

module.exports = function amorcer() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE || '';
  if (!email || !motDePasse) return;
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
      .run('Platform operator', email, bcrypt.hashSync(motDePasse, 10));
  }
  console.log(`Platform operator account ready: ${email}`);
};
