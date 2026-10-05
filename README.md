# Nadwa (ندوة) — réunions, équipes et visio en ligne

Plateforme de cours, de réunions et de visioconférence sur le modèle de Microsoft Teams, conçue en Algérie et ouverte à toute organisation : universités, écoles, centres de formation, entreprises, associations et coopératives.

« Nadwa » (ندوة) désigne en arabe la réunion d'échange, le séminaire où l'on se retrouve pour discuter et apprendre. Le nom apparaît dans `public/index.html`, `public/i18n.js` et `package.json`.

## Le principe : le modèle de Teams

L'interface est disponible en **arabe, français et anglais** (sélecteur sur l'écran de connexion, sur l'écran d'accueil et en bas de la liste des équipes). La langue du navigateur est choisie par défaut, le choix est mémorisé, et l'arabe s'affiche de droite à gauche. Les messages d'erreur du serveur suivent la langue choisie.

L'organisation reprend celle de Microsoft Teams, avec le même vocabulaire pour tout le monde :

- **Organization** : chaque organisation cliente (université, école, entreprise, association…) a la sienne, totalement séparée des autres. Une personne peut appartenir à plusieurs organisations et passe de l'une à l'autre avec la pastille en haut de la barre latérale.
- **Rôles dans l'organisation** : *Admin* (gère les personnes et les rôles, voit toutes les équipes) ou *Member*.
- **Teams** : tout membre peut créer une équipe et en devient le propriétaire (*Owner*), comme dans Teams.
- **Channels** : chaque équipe est découpée en canaux par sujet. Un canal **General** est créé automatiquement et ne peut pas être supprimé ; l'Owner ajoute les autres (« Lab work », « Project group 1 »…). Un canal peut être réservé aux annonces : seuls les Owners y écrivent, les membres lisent. Un point signale les canaux qui ont de nouveaux messages.
- **Meetings** : tout membre d'une équipe peut planifier une réunion ou lancer une **réunion immédiate** (« Meet now ») ; celui qui l'organise en est l'hôte dans la visio, avec le propriétaire de l'équipe. L'organisateur ou un propriétaire peut la supprimer.
- **Participants** : toute l'équipe est invitée d'office ; à la planification ou ensuite depuis la fiche de la réunion, on peut ajouter d'autres personnes de l'organisation (recherche par nom ou e-mail). Elles voient la réunion dans leur calendrier, en temps réel, et peuvent la rejoindre sans accéder au reste de l'équipe.
- **Calendar** : calendrier de l'organisation en vue jour, semaine ou mois, avec repère de l'heure actuelle. Un clic sur un créneau libre ouvre la planification à cette heure (choix de l'équipe) ; un clic sur une réunion affiche sa fiche (Rejoindre, Supprimer, Ouvrir l'équipe). En arabe, la semaine commence le samedi.
- **Chat** : discussion en temps réel dans chaque canal.

**Deux codes d'invitation, un seul champ « Join with a code ».** Le code d'une organisation (8 caractères) y fait entrer une personne comme membre ; le code d'une équipe (6 caractères) la fait entrer directement dans l'équipe, et dans l'organisation s'il le faut. Un admin peut aussi ajouter quelqu'un par e-mail (« Add people »), avec un mot de passe provisoire si la personne n'a pas encore de compte.

Au-dessus des organisations, l'**exploitant de la plateforme** voit toutes les organisations clientes dans la page « Platform ».

## Fonctions

- Discussion de groupe en temps réel (Socket.IO), historique conservé.
- Réunions planifiées avec date, heure et durée ; la salle ouvre 10 minutes avant le début pour les membres, l'Owner peut l'ouvrir quand il veut.
- Visioconférence **BigBlueButton** (recommandé, auto-hébergé : tableau blanc, sondages, sous-groupes, partage d'écran, enregistrement) ou **Jitsi** en démonstration.
- Interface en arabe, français et anglais ; page de gestion de l'organisation ; page d'exploitation de la plateforme.
- Interface responsive (ordinateur et téléphone), mode sombre automatique.

## Démarrage rapide

Prérequis : Node.js 18.17 ou plus récent (20 LTS conseillé).

```bash
npm install
cp .env.example .env        # puis mettez un JWT_SECRET aléatoire
npm run seed                # comptes et espaces de démonstration
npm start                   # http://localhost:3000
```

La démonstration contient deux organisations : une école d'agronomie (avec une réunion déjà en cours) et une coopérative agricole.

| Compte | E-mail | Mot de passe |
|---|---|---|
| Exploitant de la plateforme | admin@nadwa.test | Admin2026! |
| Membre des deux organisations | prof@nadwa.test | Prof2026! |
| Membres de l'école | etudiant1@nadwa.test à etudiant3@nadwa.test | Etud2026! |
| Admin de la coopérative | coop@nadwa.test | Coop2026! |

Pour tester le parcours d'une nouvelle organisation, créez un compte depuis l'écran de connexion : on vous propose alors de créer votre organisation ou d'en rejoindre une.

`npm run seed:reset` efface la base et recrée les données de démonstration. **Si vous aviez installé une version précédente**, c'est nécessaire : la structure de la base a changé.

### Avec Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec nadwa node scripts/seed.js
```

## Mettre Nadwa en ligne sans rien installer (Render)

Tout se fait dans le navigateur ; aucun logiciel n'est nécessaire sur votre ordinateur.

1. **GitHub** : avec votre compte, créez un dépôt privé (« New repository », nom `nadwa`). Sur la page du dépôt vide, « uploading an existing file » : glissez-déposez le contenu du dossier `nadwa` (sans `node_modules` ni `data`), puis « Commit changes ».
2. **Render** : créez un compte sur render.com (connexion avec GitHub), puis « New » > « Blueprint » et choisissez le dépôt `nadwa`. Render lit `render.yaml` et prépare le service.
3. Render demande quatre valeurs : `ADMIN_EMAIL` et `ADMIN_MOT_DE_PASSE` (votre compte d'exploitant, créé au premier démarrage), `BBB_URL` et `BBB_SECRET` (laissez vides pour l'instant : la visio passe alors par Jitsi). Validez.
4. Après quelques minutes, Nadwa est accessible à une adresse du type `https://nadwa-xxxx.onrender.com`, depuis n'importe quel ordinateur ou téléphone. Connectez-vous avec le compte d'exploitant et créez la première organisation.
5. Facultatif : dans Render, « Settings » > « Custom Domains » pour utiliser votre propre nom de domaine (ex. `nadwa.dz`).

Le plan Starter est nécessaire : le plan gratuit se met en veille et n'a pas de disque, donc les données seraient perdues. Le disque de 1 Go conserve la base ; Render en fait des instantanés quotidiens.

Chaque modification du code envoyée sur GitHub redéploie automatiquement la plateforme.

## Brancher BigBlueButton

BigBlueButton s'installe sur un serveur dédié (Ubuntu 22.04 pour la version 3.0, avec un nom de domaine et les ports audio/vidéo ouverts). Pour un pilote, visez au moins 8 cœurs et 16 Go de RAM ; vérifiez les exigences à jour sur docs.bigbluebutton.org.

Installation avec le script officiel (à adapter à votre domaine et à vérifier dans la documentation avant de lancer) :

```bash
wget -qO- https://raw.githubusercontent.com/bigbluebutton/bbb-install/v3.0.x-release/bbb-install.sh \
  | bash -s -- -v jammy-300 -s visio.votre-domaine.dz -e admin@votre-domaine.dz
```

Récupérez ensuite l'URL et le secret :

```bash
sudo bbb-conf --secret
```

et reportez-les dans `.env` :

```
BBB_URL=https://visio.votre-domaine.dz/bigbluebutton/
BBB_SECRET=le-secret-affiché
```

Au redémarrage, la ligne de démarrage affiche `visio : bigbluebutton`. Rien d'autre à changer : Nadwa crée la salle BigBlueButton à la première connexion et fait entrer l'Owner de l'équipe comme modérateur, les membres comme participants.

## Architecture

```
server.js                 Express + Socket.IO, sécurité HTTP (helmet)
src/config.js             Variables d'environnement
src/db.js                 SQLite (better-sqlite3) et schéma
src/auth.js               Sessions (JWT dans un cookie httpOnly)
src/i18n.js               Messages du serveur (ar, fr, en)
src/metier.js             Rôles par espace, règles d'accès, état des rendez-vous, codes
src/visio.js              BigBlueButton (API signée) ou Jitsi
src/temps-reel.js         Discussion en temps réel
src/routes/               API REST : auth, espaces, rejoindre, classes, seances, agenda, plateforme
public/                   Interface (HTML, CSS, JavaScript sans framework) ; public/i18n.js = textes ar/fr/en
scripts/seed.js           Données de démonstration
```

Tables : `utilisateurs`, `espaces` (organisations), `adhesions` (rôle dans l'organisation), `classes` (équipes), `canaux`, `membres`, `seances`, `seance_invites`, `messages`.

### API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/inscription`, `connexion`, `deconnexion` | Compte et session |
| GET | `/api/auth/moi` | Utilisateur connecté et ses espaces |
| GET / POST | `/api/espaces` | Mes espaces / créer un espace |
| GET | `/api/espaces/:id`, `/stats`, `/membres` | Détail, chiffres et personnes (administrateur) |
| POST / PATCH / DELETE | `/api/espaces/:id/membres[/:uid]` | Ajouter, changer le rôle, retirer |
| POST | `/api/rejoindre` | Code d'espace ou de groupe |
| GET / POST | `/api/classes?espace=:id` / `/api/classes` | Groupes de l'espace / créer un groupe |
| GET | `/api/classes/:id`, `/seances` | Détail de l'équipe, réunions |
| GET / POST | `/api/classes/:id/canaux` | Canaux de l'équipe / ajouter un canal (Owner) |
| GET | `/api/canaux/:id/messages` | Messages d'un canal |
| DELETE | `/api/canaux/:id` | Supprimer un canal (Owner ; pas General) |
| POST | `/api/classes/:id/seances` | Planifier (tout membre) ; `immediat: true` = réunion immédiate ; `participants: [ids]` = invités |
| GET / POST | `/api/seances/:id/participants` | Équipe et invités / ajouter des invités (organisateur ou Owner) |
| DELETE | `/api/seances/:id/participants/:uid` | Retirer un invité |
| GET | `/api/espaces/:id/annuaire` | Personnes de l'organisation (pour inviter) |
| DELETE | `/api/classes/:id/membres/:uid` | Retirer du groupe |
| POST / DELETE | `/api/seances/:id/rejoindre`, `/api/seances/:id` | Lien de visio, suppression |
| GET | `/api/agenda?espace=:id[&du=…&au=…]` | Prochaines réunions, ou toutes celles d'une période (calendrier) |
| GET | `/api/plateforme` | Vue d'ensemble (exploitant) |

Événements Socket.IO : `classe:rejoindre`, `message:envoyer` (`canalId`, avec accusé), `message:nouveau`, `seances:maj`, `canaux:maj`.

## Mise en production

- Mettre un `JWT_SECRET` long et aléatoire, servir derrière HTTPS (Nginx ou Caddy) et passer `COOKIES_SECURISES=true`.
- Choisir le mode d'ouverture : inscription et création d'espaces libres (modèle « libre-service »), ou `CREATION_ESPACE_OUVERTE=false` pour ouvrir vous-même les espaces de vos clients.
- Sauvegarder régulièrement le dossier `data/` (base SQLite).
- Héberger en Algérie et encadrer le traitement des données personnelles des utilisateurs au regard de la loi 18-07.

## Feuille de route

**Fait** : organisations séparées, modèle Teams (Admin/Member, Owner d'équipe), canaux et canaux d'annonces, interface trilingue arabe/français/anglais, codes d'invitation, discussion, rendez-vous, visio BigBlueButton, gestion d'espace, vue exploitant.

**Prochaines étapes pour un pilote (ENSA en premier espace)** :
- import de personnes par fichier CSV (listes de promotion, annuaire d'entreprise) ;
- partage de fichiers dans les groupes ;
- accès aux enregistrements BigBlueButton ;
- canaux privés, réponses en fil sous un message, mentions @ ;
- limitation des tentatives de connexion, mot de passe oublié par e-mail ;
- par organisation : domaine e-mail autorisé, logo et couleurs.

**Ouverture commerciale** : offres par espace (gratuite limitée, puis abonnements selon le nombre de personnes et d'heures de visio), facturation, connexion unique avec les annuaires des organisations, passage à PostgreSQL, plusieurs serveurs BigBlueButton répartis avec Scalelite, application mobile.
