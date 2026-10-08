/**
 * Données de démonstration : deux espaces d'organisations différentes.
 *   npm run seed         → crée les données si la base est vide
 *   npm run seed:reset   → efface la base et recommence
 */
const fs = require('fs');
const config = require('../src/config');

if (process.argv.includes('--reset')) {
  for (const suffixe of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffixe, { force: true });
  console.log('Database deleted.');
}

const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { nouveauCodeInvitation, nouveauCodeEspace, nouvelIdReunion, creerCanalGeneral } = require('../src/metier');

if (db.prepare('SELECT COUNT(*) AS n FROM utilisateurs').get().n > 0) {
  console.log('The database already has accounts: nothing to do (use "npm run seed:reset" to start over).');
  process.exit(0);
}

const adminEmail = process.env.ADMIN_EMAIL || 'admin@nadwa.test';
const adminMdp = process.env.ADMIN_MOT_DE_PASSE || 'Admin2026!';

const ajouterUtilisateur = db.prepare('INSERT INTO utilisateurs (nom, email, mot_de_passe, est_superadmin) VALUES (?, ?, ?, ?)');
const creer = (nom, email, mdp, superadmin = 0) =>
  Number(ajouterUtilisateur.run(nom, email, bcrypt.hashSync(mdp, 10), superadmin).lastInsertRowid);
const creerEspace = (nom, par) =>
  Number(db.prepare('INSERT INTO espaces (nom, code_invitation, cree_par) VALUES (?, ?, ?)')
    .run(nom, nouveauCodeEspace(), par).lastInsertRowid);
const adherer = db.prepare('INSERT INTO adhesions (espace_id, utilisateur_id, role) VALUES (?, ?, ?)');
const creerGroupe = (espace, nom, module, responsable) => {
  const id = Number(db.prepare('INSERT INTO classes (espace_id, nom, module, responsable_id, code_invitation) VALUES (?, ?, ?, ?, ?)')
    .run(espace, nom, module, responsable, nouveauCodeInvitation()).lastInsertRowid);
  creerCanalGeneral(id);
  return id;
};
const general = (classe) => db.prepare('SELECT id FROM canaux WHERE classe_id = ? AND est_general = 1').get(classe).id;
const creerCanal = (classe, nom, description, annonces = 0) =>
  Number(db.prepare('INSERT INTO canaux (classe_id, nom, description, annonces) VALUES (?, ?, ?, ?)')
    .run(classe, nom, description, annonces).lastInsertRowid);
const inscrire = db.prepare('INSERT INTO membres (classe_id, utilisateur_id) VALUES (?, ?)');
const planifierStmt = db.prepare('INSERT INTO seances (classe_id, titre, debut, duree_min, reunion_id, organisateur_id) VALUES (?, ?, ?, ?, ?, ?)');
// L'organisateur par défaut est le propriétaire de l'équipe.
const planifier = { run: (classe, titre, debut, duree, reunion) =>
  planifierStmt.run(classe, titre, debut, duree, reunion, db.prepare('SELECT responsable_id FROM classes WHERE id = ?').get(classe).responsable_id) };
const ecrireStmt = db.prepare('INSERT INTO messages (classe_id, canal_id, utilisateur_id, contenu) VALUES (?, ?, ?, ?)');
const ecrire = (canal, auteur, contenu) =>
  ecrireStmt.run(db.prepare('SELECT classe_id FROM canaux WHERE id = ?').get(canal).classe_id, canal, auteur, contenu);

const ilYa5min = new Date(Date.now() - 5 * 60_000).toISOString();
const demainA = (h) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d.toISOString(); };

db.transaction(() => {
  creer('Nadwa Operator', adminEmail, adminMdp, 1);
  const prof = creer('Demo Teacher', 'prof@nadwa.test', 'Prof2026!');
  const etudiants = [
    ['Amina Belkacem', 'etudiant1@nadwa.test'],
    ['Yacine Haddad', 'etudiant2@nadwa.test'],
    ['Lina Ouali', 'etudiant3@nadwa.test'],
  ].map(([nom, email]) => creer(nom, email, 'Etud2026!'));
  const responsableCoop = creer('Cooperative Manager', 'coop@nadwa.test', 'Coop2026!');

  // Organization 1: a school
  const ecole = creerEspace('School of Agronomy (demo)', prof);
  adherer.run(ecole, prof, 'admin');
  etudiants.forEach((id) => adherer.run(ecole, id, 'membre'));
  const classe = creerGroupe(ecole, 'Molecular Biology, Year 4', 'Plant protection', prof);
  etudiants.forEach((id) => inscrire.run(classe, id));
  planifier.run(classe, 'Nucleic acid extraction', ilYa5min, 90, nouvelIdReunion(classe));
  planifier.run(classe, 'PCR and RT-PCR: principles', demainA(9), 90, nouvelIdReunion(classe));
  const annonces = creerCanal(classe, 'Announcements', 'Dates, schedule changes and exams', 1);
  const tp = creerCanal(classe, 'Projects', 'Ongoing work, questions and results');
  ecrire(general(classe), prof, 'Welcome to the team. Slides for the first lecture will be shared before the meeting.');
  ecrire(general(classe), etudiants[0], 'Thanks! Will the meeting be recorded?');
  ecrire(annonces, prof, 'The mid-term exam is on the last Saturday of the month.');
  ecrire(tp, etudiants[1], 'Which CTAB buffer volume should we use for 100 mg of leaf tissue?');

  // Organization 2: a farming cooperative, where the teacher is also a member
  const coop = creerEspace('Farming Cooperative (demo)', responsableCoop);
  adherer.run(coop, responsableCoop, 'admin');
  adherer.run(coop, prof, 'membre');
  const groupe = creerGroupe(coop, 'Potato growers', 'Monthly technical meetings', responsableCoop);
  inscrire.run(groupe, prof);
  planifier.run(groupe, 'Season review and seed orders', demainA(18), 60, nouvelIdReunion(groupe));
  ecrire(general(groupe), responsableCoop, 'Meeting tomorrow evening: please bring your yields per field.');
})();

const codes = db.prepare('SELECT nom, code_invitation FROM espaces').all()
  .map((e) => `  ${e.nom} : ${e.code_invitation}`).join('\n');

console.log(`Demo data created.

  Platform operator        : ${adminEmail} / ${adminMdp}
  Teacher (2 organizations): prof@nadwa.test / Prof2026!
  Students                 : etudiant1@nadwa.test … etudiant3@nadwa.test / Etud2026!
  Cooperative manager      : coop@nadwa.test / Coop2026!

Organization invite codes:
${codes}
`);
