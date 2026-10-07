# Nadwa (ندوة) — réunions, équipes et visio en ligne

Plateforme de cours, de réunions et de visioconférence sur le modèle de Microsoft Teams, conçue en Algérie et ouverte à toute organisation : universités, écoles, centres de formation, entreprises, associations et coopératives.

« Nadwa » (ندوة) désigne en arabe la réunion d'échange, le séminaire où l'on se retrouve pour discuter et apprendre. Le nom apparaît dans `public/index.html`, `public/i18n.js` et `package.json`.

## L'interface : le modèle de Teams

Une barre de gauche avec trois boutons, comme Teams :

- **Conversation** : messages directs à deux ou en groupe, avec appel vidéo ou audio en un clic. On peut écrire aux personnes qui partagent une équipe ou une organisation avec soi. Une pastille rouge compte les messages non lus.
- **Équipes** : les équipes avec leurs canaux (« Général » d'office, canaux d'annonces possibles). Chaque canal a ses publications ; les réunions à venir y apparaissent sous forme de cartes et un bandeau jaune signale la réunion en cours. En haut : **Inviter** (code de l'équipe, message d'invitation à copier) et **Réunion** (« Réunion immédiate » ou « Planifier une réunion »).
- **Agenda** : jour, semaine, mois ; boutons « Réunion immédiate » et « Nouvelle réunion » ; clic sur un créneau libre pour planifier, clic sur une réunion pour sa fiche.

Avant d'entrer dans une réunion, un écran **« Prêt à rejoindre ? »** permet de régler micro et caméra (aperçu local de la caméra) et de copier le lien d'invitation. Les invités sans compte, venus par le lien, voient le même écran avec un champ pour leur nom.

Le menu du compte (pastille en bas de la barre) regroupe : profil, langue, changement d'organisation, création d'une organisation, rejoindre avec un code, gestion de l'organisation (administrateurs) et page Plateforme (exploitant).

**À l'inscription, chacun reçoit automatiquement un espace personnel** avec une équipe « Mes réunions » : on arrive directement dans Nadwa, sans écran de choix. Les organisations (écoles, entreprises, associations) restent en arrière-plan et ne se voient que dans le menu du compte.

L'interface est en **arabe, français et anglais** ; l'arabe s'affiche de droite à gauche.

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

## Fichiers (équivalent SharePoint)

Chaque canal a un onglet **Fichiers** : une bibliothèque de documents avec dossiers et sous-dossiers, comme l'onglet Fichiers de Teams (qui s'appuie sur SharePoint). Tout membre de l'équipe peut déposer des fichiers (bouton « Téléverser » ou glisser-déposer) et créer des dossiers ; dans un canal d'annonces, seuls les propriétaires déposent. Les PDF et les images s'ouvrent dans le navigateur, les autres fichiers se téléchargent. Un fichier déposé à la racine du canal est aussi annoncé dans les publications. On peut joindre un fichier dans un canal ou dans une conversation avec le trombone.

Les fichiers sont enregistrés sur le même disque que la base (`/var/data/fichiers` sur Render), 25 Mo maximum par fichier (`TAILLE_MAX_MO` pour changer). Le disque de 1 Go se remplit vite avec des documents : augmentez sa taille dans Render (*Disks*) quand il le faut.

## E-mails : bienvenue et mot de passe oublié

Nadwa envoie des e-mails à la création d'un compte, quand un administrateur ajoute quelqu'un à une organisation (avec son mot de passe provisoire), pour **« Mot de passe oublié ? »** (lien valable 1 heure, utilisable une fois) et pour confirmer un changement de mot de passe. Les e-mails partent dans la langue de la personne (arabe, français ou anglais).

Il faut un service d'envoi d'e-mails (SMTP). À renseigner dans Render, onglet *Environment* :

| Variable | Exemple avec Brevo (gratuit jusqu'à 300 e-mails par jour) | Exemple avec Gmail |
|---|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` | `587` |
| `SMTP_USER` | l'identifiant SMTP donné par Brevo | votre adresse Gmail |
| `SMTP_PASS` | la clé SMTP donnée par Brevo | un « mot de passe d'application » Google (pas votre mot de passe habituel) |
| `MAIL_FROM` | `Nadwa <no-reply@votre-domaine>` (adresse validée dans Brevo) | `Nadwa <votre.adresse@gmail.com>` |

Sans ces variables, Nadwa fonctionne normalement mais n'envoie aucun e-mail (le contenu est seulement écrit dans les journaux) et « Mot de passe oublié ? » invite à contacter l'administrateur. L'adresse utilisée dans les liens est celle de Render, ou `APP_URL` si vous en définissez une (votre nom de domaine).

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

**Logo dans la salle de visio.** Avec BigBlueButton, Nadwa transmet son propre logo (`public/logo-nadwa.svg`) à chaque création de salle : c'est lui qui s'affiche dans la réunion, à la place du logo de BigBlueButton. Pour utiliser un autre logo, remplacez simplement ce fichier.

Le serveur public gratuit **meet.jit.si**, utilisé tant que BigBlueButton n'est pas configuré, impose le logo Jitsi : il ne peut pas être retiré. Il disparaît dès que la visio passe par votre propre serveur (BigBlueButton, ou un serveur Jitsi installé par vos soins).

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
| GET / POST | `/api/conversations` | Mes conversations / en commencer une (`ids`, `nom` pour un groupe) |
| GET | `/api/conversations/contacts` | Personnes à qui l'on peut écrire |
| GET / POST | `/api/conversations/:id/messages`, `/lu`, `/appel` | Messages, marquer comme lu, appel vidéo |
| DELETE | `/api/classes/:id/membres/:uid` | Retirer du groupe |
| POST / DELETE | `/api/seances/:id/rejoindre`, `/api/seances/:id` | Lien de visio, suppression |
| GET | `/api/agenda?espace=:id[&du=…&au=…]` | Prochaines réunions, ou toutes celles d'une période (calendrier) |
| GET | `/api/plateforme` | Vue d'ensemble (exploitant) |
| POST | `/api/espaces/personnel` | Ouvrir (ou créer) son espace personnel |
| GET / POST | `/api/invite/:jeton[/rejoindre]` | Lien d'invitation, public : infos de la réunion / entrer avec un nom |
| PATCH | `/api/auth/moi` | Modifier son nom et son mot de passe |
| POST | `/api/auth/mot-de-passe-oublie`, `/api/auth/reinitialiser` | Lien de réinitialisation par e-mail / nouveau mot de passe |
| GET / POST | `/api/canaux/:id/fichiers` | Bibliothèque du canal / téléverser (corps brut, en-tête `X-Nom-Fichier`) |
| POST | `/api/canaux/:id/dossiers` | Créer un dossier |
| GET / DELETE | `/api/fichiers/:id` | Ouvrir ou télécharger (`?telecharger=1`) / supprimer |
| POST | `/api/conversations/:id/fichiers` | Pièce jointe dans une conversation |

Événements Socket.IO : `classe:rejoindre`, `message:envoyer` (`canalId`, avec accusé), `message:nouveau`, `seances:maj`, `canaux:maj`, `dm:envoyer`, `dm:nouveau`.

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
