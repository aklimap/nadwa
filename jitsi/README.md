# Réglages du serveur vidéo (Jitsi, Hetzner)

Certains réglages ne peuvent être faits que sur le serveur vidéo : Jitsi ignore ceux que la page Nadwa lui envoie s'ils ne sont pas dans sa liste autorisée (le son de l'ordinateur pendant un partage d'écran, par exemple).

## Installer `custom-config.js` (docker-jitsi-meet)

Sur le serveur Hetzner, dans le dossier de docker-jitsi-meet :

```bash
# 1. Où sont les fichiers de configuration (CONFIG dans .env, par défaut ~/.jitsi-meet-cfg)
grep '^CONFIG=' .env

# 2. Créer le fichier ~/.jitsi-meet-cfg/web/custom-config.js (adapter le chemin si CONFIG est différent)
#    avec le contenu de jitsi/custom-config.js de ce dépôt : nano ~/.jitsi-meet-cfg/web/custom-config.js

# 3. Redémarrer le conteneur web
docker compose restart web
```

Vérification : ouvrir https://meet.nadwalive.com/config.js et chercher `desktopSystemAudio: 'exclude'` à la fin du fichier.
