// Réglages du serveur vidéo Jitsi de Nadwa (meet.nadwalive.com), à ajouter sur le serveur Hetzner.
// Ces réglages ne peuvent PAS être envoyés par Nadwa : Jitsi les ignore depuis la page
// (ils ne sont pas dans sa liste de réglages autorisés). Voir jitsi/README.md.

// Partage d'écran sans le son de l'ordinateur, comme Teams par défaut.
// Par défaut Jitsi l'inclut : en partageant tout l'écran, le son de la réunion qui sort des
// haut-parleurs est renvoyé aux autres (écho, larsen). La personne peut toujours cocher
// « Partager l'audio » pour un onglet (vidéo avec son).
config.screenShareSettings = {
    desktopSystemAudio: 'exclude',
    desktopSelfBrowserSurface: 'exclude',
    desktopSuppressLocalAudioPlayback: 'include',
    desktopSurfaceSwitching: 'include',
    desktopPreferCurrentTab: false,
};

// Son : traitement du micro actif, mono (le stéréo coupe l'annulation d'écho),
// rien d'envoyé pendant les silences (DTX), redondance contre les pertes de paquets.
config.disableAP = false;
config.disableAEC = false;
config.disableNS = false;
config.disableAGC = false;
config.disableHPF = false;
config.audioQuality = { stereo: false, enableOpusDtx: true };
config.enableOpusRed = true;

// Pas de page de fin Jitsi (Nadwa reprend la main à la fin de la réunion).
config.enableClosePage = false;
