'use strict';

/* ======================================================================
   Nadwa : interface (modèle Teams). Conversation, Équipes, Calendrier.
   ====================================================================== */

// ---------- Outils ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => String(name || '').split(/\s+/).filter((w) => /\p{L}/u.test(w[0] || '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const hue = (id) => (Number(id) * 67) % 360;
const meetingEnd = (s) => new Date(Date.parse(s.debut) + s.duree_min * 60_000);
const avatar = (id, nom, cls = '') => `<span class="avatar ${cls}" data-teinte="${hue(id)}" aria-hidden="true">${esc(initials(nom))}</span>`;
/** Avatar d'une personne, avec la pastille de présence (Disponible, Absent…). */
const avatarP = (id, nom, cls = '') => `<span class="avatar ${cls}" data-teinte="${hue(id)}" aria-hidden="true">${esc(initials(nom))}${presenceDot(id)}</span>`;
const presenceDot = (id) => { const s = statutDe(id); return `<span class="presence" data-presence="${id}" data-statut="${s}" title="${esc(t(`statut_${s}`))}"></span>`; };
const statutDe = (id) => state.presence.get(id) || 'hors_ligne';
const ICONES = {
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3"/></svg>',
  videoOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10.5 5-3v9l-5-3M3 3l18 18"/></svg>',
  micro: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  microOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M3 3l18 18"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  envoyer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3-7-8-1z"/></svg>',
  retour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  inviter: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M18 8v6M15 11h6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  gauche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
  droite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  profil: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/></svg>',
  orga: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10l8-6 8 6v10"/><path d="M9.5 20v-5h5v5"/></svg>',
  grille: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  sortir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/></svg>',
  ouvrir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  telecharger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  trombone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.5 7"/></svg>',
  dossier: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  aide: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.8M12 17h.01"/></svg>',
  cloche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
  options: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  poubelle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/></svg>',
};

// Couleurs des avatars : via le CSSOM (la politique de sécurité interdit les styles en ligne).
new MutationObserver(() => {
  $$('[data-teinte]').forEach((el) => {
    el.style.setProperty('--teinte', el.dataset.teinte);
    el.removeAttribute('data-teinte');
  });
}).observe(document.documentElement, { childList: true, subtree: true });

// ---------- Langue ----------
const fmt = {};
const langue = () => window.NADWA_LANGUES.find((l) => l.code === window.NADWA_LANGUE);
function buildFormats() {
  const { locale } = langue();
  fmt.day = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  fmt.dayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  fmt.weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  fmt.weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  fmt.time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  fmt.message = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  fmt.date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  fmt.dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
}
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** Heure courte pour une liste : « 10:42 » aujourd'hui, « lun. » cette semaine, sinon « 3 oct. ». */
function shortWhen(iso) {
  const d = new Date(iso); const now = new Date();
  if (sameDay(d, now)) return fmt.time.format(d);
  if (now - d < 6 * 864e5) return fmt.weekday.format(d);
  return fmt.dayMonth.format(d);
}
const whenRange = (debut, fin) => {
  const { locale } = langue();
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).formatRange(debut, fin);
};

const roleLabel = (role) => t(role === 'admin' ? 'role_admin' : 'role_membre');
const stateLabel = (etat) => t(`etat_${etat}`);
const channelName = (c) => (c.est_general ? t('canal_general') : c.nom);
const orgName = (o) => (o?.personnel ? t('mon_espace') : o?.nom ?? '');
const inviteLink = (jeton) => (window.NADWA_LIEN_INVITE ? window.NADWA_LIEN_INVITE(jeton) : `${location.origin}/r/${jeton}`);
const fileUrl = (id, download = false) => (window.NADWA_URL_FICHIER ? window.NADWA_URL_FICHIER(id, download) : `/api/fichiers/${id}${download ? '?telecharger=1' : ''}`);
const TAILLE_MAX_MO = 25;
function formatSize(n) {
  const unites = t('unites_taille').split('|');
  let i = 0; let v = Number(n) || 0;
  while (v >= 1024 && i < unites.length - 1) { v /= 1024; i += 1; }
  return `${new Intl.NumberFormat(langue().locale, { maximumFractionDigits: i ? 1 : 0 }).format(v)} ${unites[i]}`;
}
/** Pastille du type de fichier (PDF, DOC, XLS…). */
function extBadge(nom, type) {
  const ext = (String(nom).split('.').pop() || '').toLowerCase();
  const famille = /pdf/.test(ext) ? 'pdf' : /docx?|odt|rtf/.test(ext) ? 'doc' : /xlsx?|ods|csv/.test(ext) ? 'xls' : /pptx?|odp/.test(ext) ? 'ppt'
    : /^image\//.test(type || '') ? 'img' : '';
  return `<span class="ext ${famille}" aria-hidden="true">${esc((ext || '?').slice(0, 4).toUpperCase())}</span>`;
}
const isImage = (type) => /^image\/(png|jpeg|gif|webp)$/.test(type || '');
/** Carte d'une pièce jointe dans un message (aperçu pour les images). */
function attachmentHtml(m) {
  if (!m.fichier_id) return '';
  return `${isImage(m.fichier_type) ? `<a href="${esc(fileUrl(m.fichier_id))}" target="_blank" rel="noopener"><img class="apercu-image" src="${esc(fileUrl(m.fichier_id))}" alt="${esc(m.fichier_nom)}" loading="lazy"></a>` : ''}
    <div class="piece-jointe">${extBadge(m.fichier_nom, m.fichier_type)}
      <div><strong>${esc(m.fichier_nom)}</strong><small>${esc(formatSize(m.fichier_taille))}</small></div>
      <a class="btn-icone" href="${esc(fileUrl(m.fichier_id))}" target="_blank" rel="noopener" aria-label="${esc(t('ouvrir'))}" title="${esc(t('ouvrir'))}">${ICONES.ouvrir}</a>
      <a class="btn-icone" href="${esc(fileUrl(m.fichier_id, true))}" download aria-label="${esc(t('telecharger'))}" title="${esc(t('telecharger'))}">${ICONES.telecharger}</a>
    </div>`;
}

/** Téléverse des fichiers vers un canal (dossier) ou une conversation. */
async function uploadFiles(files, url) {
  for (const file of files) {
    if (file.size > TAILLE_MAX_MO * 1024 * 1024) { toast(t('fichier_trop_gros_client', { nom: file.name, max: TAILLE_MAX_MO })); continue; }
    toast(t('envoi_fichier', { nom: file.name }));
    try {
      if (window.NADWA_TELEVERSER) await window.NADWA_TELEVERSER(url, file);
      else {
        const res = await fetch(`/api${url}`, {
          method: 'POST', credentials: 'same-origin', body: file,
          headers: { 'X-Langue': window.NADWA_LANGUE, 'X-Nom-Fichier': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!res.ok) { let d = null; try { d = await res.json(); } catch { /* vide */ } throw new Error(d?.erreur || t('erreur_n', { n: res.status })); }
      }
      toast(t('fichier_envoye'));
    } catch (err) { toast(err.message); }
  }
}
/** Ouvre le sélecteur de fichiers et téléverse vers « url ». */
function pickFiles(url, after) {
  const input = $('#choix-fichiers');
  input.value = '';
  input.onchange = async () => { const files = [...input.files]; if (files.length) { await uploadFiles(files, url); after?.(); } };
  input.click();
}

// Terminer une réunion : son organisateur seulement (le propriétaire de l'équipe, sans organisateur connu).
const canEnd = (m) => (m.organisateur_id ? m.organisateur_id === state.me.id : canHost(m));
const canHost = (m) => m.organisateur_id === state.me.id || m.responsable_id === state.me.id || state.org?.role === 'admin';

function translatePage() {
  const l = langue();
  document.documentElement.lang = l.code;
  document.documentElement.dir = l.dir;
  // Nom de la plateforme : en arabe « ندوة », en français et en anglais « Nadwa ».
  $$('[data-logo]').forEach((el) => {
    const ar = l.code === 'ar';
    el.textContent = ar ? 'ندوة' : 'Nadwa';
    el.lang = ar ? 'ar' : 'en';
    el.classList.toggle('latin', !ar);
  });
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  // Conditions d'utilisation et confidentialité, dans la langue de l'interface.
  $$('[data-lien-legal]').forEach((el) => { el.href = `/${el.dataset.lienLegal}?lang=${l.code}`; });
  $$('[data-liens-conditions]').forEach((el) => {
    el.innerHTML = t('accepte_conditions', {
      conditions: `<a href="/conditions?lang=${l.code}" target="_blank" rel="noopener">${esc(t('conditions_utilisation_min'))}</a>`,
      confidentialite: `<a href="/confidentialite?lang=${l.code}" target="_blank" rel="noopener">${esc(t('politique_confidentialite_min'))}</a>`,
    });
  });
  showFreePeriod();
  $$('.choix-langue').forEach((sel) => {
    sel.innerHTML = window.NADWA_LANGUES.map((x) => `<option value="${x.code}" lang="${x.code}">${x.nom}</option>`).join('');
    sel.value = l.code;
  });
  buildFormats();
}

/** « Gratuit jusqu'au … » : page d'accueil et application, une fois la date de lancement fixée. */
let publicInfo = null;
function showFreePeriod() {
  // Affichée seulement après le lancement officiel (DATE_LANCEMENT réglée dans Render).
  if (!publicInfo?.gratuit_jusqu_au) return;
  const texte = t('gratuit_jusqu_au', { date: new Intl.DateTimeFormat(langue().locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(publicInfo.gratuit_jusqu_au)) });
  $$('[data-gratuit]').forEach((el) => { el.textContent = texte; el.hidden = false; });
}
fetch('/api/infos').then((r) => r.json()).then((info) => { publicInfo = info; showFreePeriod(); }).catch(() => {});

/** Nouvelle version des Conditions : à accepter avant de continuer (sinon déconnexion). */
async function checkTerms() {
  try {
    const { a_jour } = await api('/auth/conditions');
    if (a_jour) return;
  } catch { return; }
  const dlg = $('#dlg-conditions');
  dlg.addEventListener('cancel', (e) => e.preventDefault(), { once: true }); // pas de fermeture avec Échap
  openDialog('dlg-conditions', async () => {
    await api('/auth/conditions', { method: 'POST', body: { accepte_conditions: true } });
  });
}
$('#conditions-refuser').addEventListener('click', async () => {
  try { await api('/auth/deconnexion', { method: 'POST' }); } catch { /* déjà déconnecté */ }
  location.replace('/');
});

function setLanguage(code) {
  window.NADWA_LANGUE = code;
  try { localStorage.setItem('nadwa:langue', code); } catch { /* stockage indisponible */ }
  translatePage();
  state.socket?.emit('langue', code);
  setAuthMode(state.authMode);
  if (!$('#ecran-reunion').hidden) renderPrejoin();
  if (!$('#ecran-app').hidden && state.org) {
    renderOrgSwitch();
    showView(state.view);
  }
}
document.addEventListener('change', (e) => {
  if (e.target.matches('.choix-langue')) setLanguage(e.target.value);
});

// ---------- État, API, messages ----------
const state = {
  me: null, orgs: [], org: null, view: 'classes',
  teams: [], teamId: null, detail: null, fileFolder: null, meetings: [], channels: [], channelId: null, unread: new Set(), tab: 'publications', teamFilter: '',
  convs: [], convId: null, convFilter: '', contacts: null,
  socket: null, authMode: 'connexion',
  presence: new Map(), presenceChoix: 'auto',
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Langue': window.NADWA_LANGUE, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* réponse vide */ }
  if (!res.ok) {
    const err = new Error(data?.erreur || t('erreur_n', { n: res.status }));
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}

/** Message bref en bas de l'écran, avec une action facultative. */
function toast(message, action) {
  const box = $('#toast');
  box.textContent = message;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => { box.classList.remove('visible'); action.run(); });
    box.append(b);
  }
  box.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('visible'), action ? 6000 : 3500);
}

const lastOrg = {
  get() { try { return Number(localStorage.getItem('nadwa:org')) || null; } catch { return null; } },
  set(id) { try { localStorage.setItem('nadwa:org', String(id)); } catch { /* stockage indisponible */ } },
};

function showScreen(id) {
  for (const s of ['ecran-auth', 'ecran-app', 'ecran-reunion']) $(`#${s}`).hidden = s !== id;
}

/** Copie un texte et le confirme. */
function copy(text, okKey) {
  navigator.clipboard.writeText(text)
    .then(() => toast(t(okKey)))
    .catch(() => toast(text));
}

// ---------- Connexion ----------
function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === 'inscription';
  const f = $('#form-auth');
  $$('[data-inscription]').forEach((el) => { el.hidden = !signup; });
  f.nom.required = signup;
  f.accepte_conditions.required = signup;
  f.mot_de_passe.autocomplete = signup ? 'new-password' : 'current-password';
  $('#auth-titre').textContent = t(signup ? 'titre_inscription' : 'titre_connexion');
  $('#auth-sous-titre').textContent = t(signup ? 'sous_titre_inscription' : 'sous_titre_connexion');
  $('#auth-soumettre').textContent = t(signup ? 'creer_compte' : 'se_connecter');
  $('#auth-bascule-texte').textContent = t(signup ? 'deja_compte' : 'pas_de_compte');
  $('#auth-bascule').textContent = t(signup ? 'se_connecter' : 'creer_compte');
  $('#auth-erreur').textContent = '';
  $('#btn-oubli').hidden = signup;
}
$('#auth-bascule').addEventListener('click', () => setAuthMode(state.authMode === 'inscription' ? 'connexion' : 'inscription'));

$('#form-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.reportValidity()) return;
  const button = $('#auth-soumettre');
  button.disabled = true;
  $('#auth-erreur').textContent = '';
  try {
    const body = { email: f.email.value, mot_de_passe: f.mot_de_passe.value };
    if (state.authMode === 'inscription') { body.nom = f.nom.value; body.accepte_conditions = f.accepte_conditions.checked; }
    const result = await api(state.authMode === 'inscription' ? '/auth/inscription' : '/auth/connexion', { method: 'POST', body });
    if (result.verification) { f.reset(); showVerifyPending(result.email); return; }
    f.reset();
    start(result);
  } catch (err) {
    $('#auth-erreur').textContent = err.message;
    if (err.code === 'email_non_verifie') showVerifyPending(f.email.value, true);
  } finally {
    button.disabled = false;
  }
});

// Rejoindre une réunion avec un lien, sans compte.
$('#btn-lien-reunion').addEventListener('click', () => openDialog('dlg-lien', async ({ lien }) => {
  const jeton = (String(lien).match(/\/r\/([\w-]{12,})/) || String(lien).match(/^\s*([\w-]{12,})\s*$/) || [])[1];
  if (!jeton) throw new Error(t('lien_invalide'));
  history.pushState(null, '', window.NADWA_LIEN_INVITE ? `#/r/${jeton}` : `/r/${jeton}`);
  showGuest(jeton);
}));

$('#btn-oubli').addEventListener('click', () => {
  $('#oubli-envoye').hidden = true;
  openDialog('dlg-oubli', async ({ email }) => {
    await api('/auth/mot-de-passe-oublie', { method: 'POST', body: { email } });
    $('#oubli-envoye').hidden = false;
    throw Object.assign(new Error(''), { garder: true }); // le dialogue reste ouvert pour afficher la confirmation
  }, (form) => { form.email.value = $('#form-auth').email.value; });
});

// ---------- Vérification de l'adresse e-mail ----------
function showVerifyPending(email, depuisConnexion = false) {
  const zone = $('#auth-verifier');
  zone.hidden = false;
  $('#form-auth').hidden = true;
  $('.auth-bascule').hidden = true;
  $('#auth-titre').textContent = t('verif_titre');
  $('#auth-sous-titre').textContent = '';
  zone.innerHTML = `
    <div class="verif-icone">${ICONES.mail}</div>
    <p>${depuisConnexion ? t('verif_connexion') : t('verif_texte')}</p>
    <p class="verif-email" dir="ltr"></p>
    <p class="note">${t('verif_spam')}</p>
    <button type="button" class="btn btn-contour" id="verif-renvoyer">${t('verif_renvoyer')}</button>
    <button type="button" class="btn-lien" id="verif-retour">${t('verif_retour')}</button>`;
  $('.verif-email', zone).textContent = email;
  $('#verif-renvoyer').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { await api('/auth/renvoyer-verification', { method: 'POST', body: { email } }); toast(t('verif_renvoye')); }
    catch (err) { toast(err.message); }
    finally { setTimeout(() => { const b = $('#verif-renvoyer'); if (b) b.disabled = false; }, 30_000); }
  });
  $('#verif-retour').addEventListener('click', hideVerifyPending);
}
function hideVerifyPending() {
  $('#auth-verifier').hidden = true;
  $('#form-auth').hidden = false;
  $('.auth-bascule').hidden = false;
  setAuthMode('connexion');
}

/** Lien de confirmation reçu par e-mail : /verifier/<jeton>. */
const verifyTokenInUrl = () => (location.pathname.match(/^\/verifier\/([\w-]{20,})/) || [])[1] || null;
async function confirmEmail(jeton) {
  history.replaceState(null, '', '/');
  try {
    const result = await api('/auth/verifier', { method: 'POST', body: { jeton } });
    start(result);
    setTimeout(() => toast(t('verif_ok')), 800);
  } catch (err) {
    // Lien déjà utilisé alors que la personne est connectée : on ouvre simplement Nadwa.
    const deja = await api('/auth/moi').catch(() => null);
    if (deja) { start(deja); return; }
    showScreen('ecran-auth');
    setAuthMode('connexion');
    $('#auth-erreur').textContent = err.message;
  }
}

/** Lien reçu par e-mail : /reinitialiser/<jeton> (ou #/reinitialiser/<jeton>). */
const resetTokenInUrl = () => (location.pathname.match(/^\/reinitialiser\/([\w-]{20,})/) || location.hash.match(/^#\/reinitialiser\/([\w-]{20,})/) || [])[1] || null;
function showReset(jeton) {
  showScreen('ecran-auth');
  setAuthMode('connexion');
  openDialog('dlg-reinit', async ({ mot_de_passe: mdp, confirmation }) => {
    if (mdp !== confirmation) throw new Error(t('mdp_differents'));
    const result = await api('/auth/reinitialiser', { method: 'POST', body: { jeton, mot_de_passe: mdp } });
    history.replaceState(null, '', location.hash.startsWith('#/reinitialiser/') ? location.pathname + location.search : '/');
    toast(t('reinit_ok'));
    start(result);
  });
}

async function signOut() {
  await api('/auth/deconnexion', { method: 'POST' }).catch(() => {});
  location.reload();
}

// ---------- Démarrage ----------
async function start({ utilisateur, espaces }) {
  state.me = utilisateur;
  state.orgs = espaces;
  checkTerms();
  // Mode libre : chacun a d'office un espace personnel, on arrive directement dans Nadwa.
  if (!state.orgs.length) {
    await api('/espaces/personnel', { method: 'POST' }).catch(() => {});
    await reloadOrgs();
  }
  const me = $('#btn-moi');
  me.innerHTML = `${esc(initials(utilisateur.nom))}${presenceDot(utilisateur.id)}`;
  me.style.setProperty('--teinte', hue(utilisateur.id));
  connectSocket();
  showScreen('ecran-app');
  const last = lastOrg.get();
  const org = state.orgs.find((o) => o.id === last) || state.orgs.find((o) => !o.personnel && o.role === 'admin')
    || state.orgs.find((o) => !o.personnel) || state.orgs[0];
  const lien = new URLSearchParams(location.search).toString() ? location.href : null;
  await openOrg(org.id);
  loadConversations();
  initNotifications();
  if (lien) openFromLink(lien);
}

// ---------- Liens des notifications ----------
// /?conv=ID (conversation), /?equipe=ID[&onglet=clavardage][&canal=ID][&reunion=ID]
async function openFromLink(url) {
  const p = new URL(url, location.origin).searchParams;
  const conv = Number(p.get('conv')) || null;
  const equipe = Number(p.get('equipe')) || null;
  if (!conv && !equipe) return;
  history.replaceState(null, '', '/');
  try {
    if (conv) {
      await loadConversations();
      showView('conversation', { convId: conv });
      return;
    }
    const d = await api(`/classes/${equipe}`);
    if (p.get('onglet') === 'clavardage') state.ongletSuivant = 'clavardage';
    if (p.get('canal')) state.canalSuivant = Number(p.get('canal'));
    if (state.org?.id !== d.classe.espace_id) await openOrg(d.classe.espace_id, { teamId: equipe });
    else showView('classes', { teamId: equipe });
    const reunion = Number(p.get('reunion')) || null;
    if (reunion) showPrejoin(reunion);
  } catch (err) { toast(err.message); }
}
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.type === 'nadwa:ouvrir' && state.me) openFromLink(e.data.url);
});

// ---------- Notifications (téléphone, ordinateur, e-mail) ----------
const notif = { email: true, push: true, cle: null, appareil: false };
const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const swPret = 'serviceWorker' in navigator ? navigator.serviceWorker.register('/sw.js').catch(() => null) : Promise.resolve(null);

async function abonnementActuel() {
  const reg = await swPret;
  return reg ? reg.pushManager.getSubscription() : null;
}

async function initNotifications() {
  try { Object.assign(notif, await api('/notifications')); } catch { return; }
  if (!pushPossible()) return;
  const sub = await abonnementActuel().catch(() => null);
  notif.appareil = Boolean(sub) && Notification.permission === 'granted';
  if (sub && notif.appareil) api('/notifications/abonnement', { method: 'POST', body: sub.toJSON() }).catch(() => {});
  // Première fois : proposer d'activer les notifications sur cet appareil.
  let deja = false;
  try { deja = localStorage.getItem('nadwa:notif-propose') === '1'; localStorage.setItem('nadwa:notif-propose', '1'); } catch { /* stockage indisponible */ }
  if (!deja && Notification.permission === 'default') {
    setTimeout(() => toast(t('notif_proposer'), { label: t('activer'), run: enableDeviceNotifications }), 2500);
  }
}

const base64EnOctets = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function enableDeviceNotifications() {
  if (!pushPossible()) { toast(t('notif_non_supporte')); return; }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') { toast(t('notif_refuse')); return; }
  try {
    const reg = await swPret;
    const sub = (await reg.pushManager.getSubscription())
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64EnOctets(notif.cle) });
    await api('/notifications/abonnement', { method: 'POST', body: sub.toJSON() });
    if (!notif.push) Object.assign(notif, await api('/notifications', { method: 'PATCH', body: { push: true } }));
    notif.appareil = true;
    await api('/notifications/essai', { method: 'POST' });
    toast(t('notif_activees'));
  } catch (err) { toast(err.message || t('notif_non_supporte')); }
}

async function disableDeviceNotifications() {
  const sub = await abonnementActuel().catch(() => null);
  if (sub) {
    await api('/notifications/abonnement', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  notif.appareil = false;
  toast(t('notif_desactivees'));
}

async function toggleEmailNotifications() {
  try {
    Object.assign(notif, await api('/notifications', { method: 'PATCH', body: { email: !notif.email } }));
    toast(t(notif.email ? 'notif_email_on' : 'notif_email_off'));
  } catch (err) { toast(err.message); }
}

async function reloadOrgs() { state.orgs = await api('/espaces'); }

async function openOrg(orgId, { teamId } = {}) {
  state.org = state.orgs.find((o) => o.id === orgId) || state.orgs[0];
  lastOrg.set(state.org.id);
  state.teamId = null;
  state.detail = null;
  directory.orgId = null;
  renderOrgSwitch();
  await loadTeams();
  showView('classes', { teamId });
}

function renderOrgSwitch() {
  const b = $('#btn-choix-org');
  b.hidden = state.orgs.length < 2;
  b.innerHTML = `<span>${esc(orgName(state.org))}</span>${ICONES.chevron}`;
}
$('#btn-choix-org').addEventListener('click', (e) => openMenu('menu-moi', e.currentTarget, buildOrgMenu));

// ---------- Présence ----------
// « En veille » après 5 minutes sans activité (souris, clavier, toucher) ; « En réunion » pendant la visio.
const VEILLE_MS = 5 * 60_000;
let derniereActivite = Date.now();
let etaitInactif = false;
const inactif = () => Date.now() - derniereActivite > VEILLE_MS;
function noteActivity() {
  derniereActivite = Date.now();
  if (etaitInactif) { etaitInactif = false; state.socket?.emit('presence:activite', false); }
}
for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, noteActivity, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) noteActivity(); });
setInterval(() => {
  if (!etaitInactif && inactif()) { etaitInactif = true; state.socket?.emit('presence:activite', true); }
}, 30_000);

function setDot(el, statut) {
  el.dataset.statut = statut;
  if (el.classList.contains('presence')) el.title = t(`statut_${statut}`);
}
function chooseStatus(choix) {
  state.presenceChoix = choix;
  state.socket?.emit('presence:choisir', choix);
}

function connectSocket() {
  if (state.socket) return;
  const socket = io({ withCredentials: true, auth: { langue: window.NADWA_LANGUE } });
  state.socket = socket;
  socket.on('connect', () => { if (state.teamId) socket.emit('classe:rejoindre', state.teamId); });
  socket.on('message:nouveau', (m) => {
    if (m.classe_id !== state.teamId) return;
    if (m.canal_id === state.channelId && state.tab === 'publications' && state.view === 'classes') appendPost(m, true);
    else if (m.auteur_id !== state.me.id) { state.unread.add(m.canal_id); renderTeamList(); }
  });
  socket.on('canaux:maj', ({ classe_id }) => { if (classe_id === state.teamId) loadChannels(); });
  socket.on('seances:maj', ({ classe_id }) => {
    checkVisio();
    if (state.view === 'agenda') loadCalendar();
    if (classe_id === state.teamId) loadMeetings();
  });
  socket.on('dm:nouveau', onDirectMessage);
  socket.on('presence:tout', ({ statuts, choix }) => {
    state.presence = new Map(Object.entries(statuts).map(([id, s]) => [Number(id), s]));
    state.presenceChoix = choix;
    $$('[data-presence]').forEach((el) => setDot(el, statutDe(Number(el.dataset.presence))));
    socket.emit('presence:activite', inactif());
    socket.emit('presence:reunion', Boolean(visio.api));
  });
  socket.on('presence:maj', ({ id, statut }) => {
    if (statut === 'hors_ligne') state.presence.delete(id); else state.presence.set(id, statut);
    $$(`[data-presence="${id}"]`).forEach((el) => setDot(el, statut));
  });
  socket.on('presence:choix', (choix) => { state.presenceChoix = choix; });
  socket.on('classe:supprimee', ({ classe_id }) => {
    if (classe_id === state.teamId) leaveDeletedTeam(); else if (state.org) loadTeams();
  });
  socket.on('fichiers:maj', ({ canal_id }) => { if (canal_id === state.channelId && state.tab === 'fichiers' && state.view === 'classes') renderFiles(); });
}

// ---------- Navigation ----------
function showView(view, opts = {}) {
  state.view = view;
  for (const v of ['conversation', 'classes', 'agenda', 'gestion', 'plateforme']) $(`#vue-${v}`).hidden = v !== view;
  $$('.rail-btn[data-vue]').forEach((b) => {
    if (b.dataset.vue === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.body.classList.remove('detail-ouvert');
  if (view === 'classes') {
    renderTeamList();
    const target = opts.teamId || state.teamId || (matchMedia('(min-width: 861px)').matches && state.teams[0]?.id);
    if (target) openTeam(target, { keep: target === state.teamId && !opts.teamId }); else showEmptyTeam();
  }
  if (view === 'conversation') {
    renderConvList();
    const target = opts.convId || state.convId || (matchMedia('(min-width: 861px)').matches && state.convs[0]?.id);
    if (target) openConversation(target); else showEmptyConversation();
  }
  if (view === 'agenda') loadCalendar();
  if (view === 'gestion') loadManage();
  if (view === 'plateforme') loadPlatform();
}
$$('.rail-btn[data-vue]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.vue)));
function backToList() { document.body.classList.remove('detail-ouvert'); }

// ---------- Menus ----------
function openMenu(id, anchor, build) {
  const menu = $(`#${id}`);
  if (build) build(menu);
  menu.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = menu.offsetWidth; const h = menu.offsetHeight;
  let left = document.dir === 'rtl' ? r.right - w : r.left;
  if (r.left < 120) left = r.right + 8; // menu du rail : à côté
  left = Math.max(12, Math.min(left, innerWidth - w - 12));
  let top = r.left < 120 ? r.bottom - h : r.bottom + 6;
  top = Math.max(12, Math.min(top, innerHeight - h - 12));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  setTimeout(() => document.addEventListener('click', function close(e) {
    if (menu.contains(e.target) && !e.target.closest('button,a')) return;
    menu.hidden = true;
    document.removeEventListener('click', close, true);
  }, true));
}

function buildOrgMenu(menu) {
  menu.innerHTML = `
    <div class="menu-section">${t('organisations')}</div>
    ${state.orgs.map((o) => `<button type="button" data-org="${o.id}" class="${o.id === state.org.id ? 'actif' : ''}">${avatar(o.id, orgName(o), 'petit carre')}<span>${esc(orgName(o))}</span></button>`).join('')}
    <hr>
    <button type="button" data-action="creer-org">${ICONES.plus}<span>${t('creer_org')}</span></button>
    <button type="button" data-action="code">${ICONES.code}<span>${t('rejoindre_avec_code')}</span></button>`;
  bindMenuActions(menu);
}

function buildMeMenu(menu) {
  const admin = state.org?.role === 'admin' && !state.org?.personnel;
  menu.innerHTML = `
    <div class="menu-tete">${avatarP(state.me.id, state.me.nom, 'grand')}<div><strong>${esc(state.me.nom)}</strong><small dir="ltr">${esc(state.me.email)}</small></div></div>
    <div class="menu-section">${t('statut')}</div>
    ${[['auto', 'disponible'], ['absent', 'absent'], ['non_disponible', 'non_disponible']].map(([choix, s]) => `
      <button type="button" data-statut-choix="${choix}" class="${state.presenceChoix === choix ? 'actif' : ''}"><span class="presence-pastille" data-statut="${s}"></span><span>${t(`statut_${s}`)}</span></button>`).join('')}
    <hr>
    <div class="menu-section">${t('notifications')}</div>
    <button type="button" data-action="notif-appareil">${ICONES.cloche}<span>${t('notif_cet_appareil')}</span><span class="menu-etat ${notif.appareil ? 'on' : ''}">${t(notif.appareil ? 'active' : 'inactive')}</span></button>
    <button type="button" data-action="notif-email">${ICONES.mail}<span>${t('notif_par_email')}</span><span class="menu-etat ${notif.email ? 'on' : ''}">${t(notif.email ? 'active' : 'inactive')}</span></button>
    <hr>
    <button type="button" data-action="profil">${ICONES.profil}<span>${t('mon_profil')}</span></button>
    <div class="menu-langue"><span>${t('langue')}</span><select class="choix-langue" aria-label="${esc(t('langue'))}"></select></div>
    <hr>
    <div class="menu-section">${t('organisations')}</div>
    ${state.orgs.map((o) => `<button type="button" data-org="${o.id}" class="${o.id === state.org.id ? 'actif' : ''}">${avatar(o.id, orgName(o), 'petit carre')}<span>${esc(orgName(o))}</span></button>`).join('')}
    <button type="button" data-action="creer-org">${ICONES.plus}<span>${t('creer_org')}</span></button>
    <button type="button" data-action="code">${ICONES.code}<span>${t('rejoindre_avec_code')}</span></button>
    ${admin ? `<button type="button" data-action="gerer">${ICONES.orga}<span>${t('gerer_org')}</span></button>` : ''}
    ${state.me.est_superadmin ? `<button type="button" data-action="plateforme">${ICONES.grille}<span>${t('plateforme')}</span></button>` : ''}
    <button type="button" data-action="aide">${ICONES.aide}<span>${t('aide_commentaires')}</span></button>
    <hr>
    <button type="button" data-action="sortir">${ICONES.sortir}<span>${t('se_deconnecter')}</span></button>`;
  const sel = $('.choix-langue', menu);
  sel.innerHTML = window.NADWA_LANGUES.map((x) => `<option value="${x.code}">${x.nom}</option>`).join('');
  sel.value = window.NADWA_LANGUE;
  bindMenuActions(menu);
}
$('#btn-moi').addEventListener('click', (e) => openMenu('menu-moi', e.currentTarget, buildMeMenu));

function bindMenuActions(menu) {
  $$('[data-statut-choix]', menu).forEach((b) => b.addEventListener('click', () => { menu.hidden = true; chooseStatus(b.dataset.statutChoix); }));
  $$('[data-org]', menu).forEach((b) => b.addEventListener('click', () => { menu.hidden = true; openOrg(Number(b.dataset.org)); }));
  $$('[data-action]', menu).forEach((b) => b.addEventListener('click', () => {
    menu.hidden = true;
    const a = b.dataset.action;
    if (a === 'profil') openProfile();
    if (a === 'aide') openHelp();
    if (a === 'notif-appareil') (notif.appareil ? disableDeviceNotifications : enableDeviceNotifications)();
    if (a === 'notif-email') toggleEmailNotifications();
    if (a === 'creer-org') openDialog('dlg-creer-espace', createOrg);
    if (a === 'code') openDialog('dlg-code', joinWithCode);
    if (a === 'gerer') showView('gestion');
    if (a === 'plateforme') showView('plateforme');
    if (a === 'sortir') signOut();
  }));
}

async function createOrg(values) {
  const org = await api('/espaces', { method: 'POST', body: values });
  await reloadOrgs();
  await openOrg(org.id);
  showView('gestion');
  toast(t('org_creee'));
}

async function joinWithCode({ code }) {
  const r = await api('/rejoindre', { method: 'POST', body: { code } });
  await reloadOrgs();
  await openOrg(r.espace_id, { teamId: r.classe_id });
  toast(t('vous_avez_rejoint', { nom: r.nom }));
}

// ---------- Équipes ----------
async function loadTeams() {
  state.teams = await api(`/classes?espace=${state.org.id}`);
  renderTeamList();
}

$('#recherche-equipe').addEventListener('input', (e) => { state.teamFilter = e.target.value.trim().toLowerCase(); renderTeamList(); });

function renderTeamList() {
  const ul = $('#liste-classes');
  const list = state.teams.filter((x) => !state.teamFilter || x.nom.toLowerCase().includes(state.teamFilter));
  if (!state.teams.length) { ul.innerHTML = `<li class="liste-vide">${t('aucune_equipe')}</li>`; return; }
  if (!list.length) { ul.innerHTML = `<li class="liste-vide">${t('aucun_resultat')}</li>`; return; }
  ul.innerHTML = list.map((team) => `
    <li>
      <button class="item" data-equipe="${team.id}" ${team.id === state.teamId ? 'aria-current="true"' : ''}>
        ${avatar(team.id, team.nom, 'carre')}
        <span class="item-texte"><strong>${esc(team.nom)}</strong><small>${esc(team.module || t('proprietaire_nom', { nom: team.responsable_nom }))}</small></span>
        ${team.en_direct ? `<span class="point-en-cours" title="${esc(t('reunion_en_cours_court'))}"></span>` : ''}
        ${!team.en_direct && teamChat(team.id)?.non_lus && !(team.id === state.teamId && state.tab === 'clavardage') ? `<span class="non-lu-point" title="${esc(t('nouveaux_messages'))}"></span>` : ''}
      </button>
      ${team.id === state.teamId && state.detail?.classe.id === team.id ? channelList() : ''}
    </li>`).join('');
  $$('[data-equipe]', ul).forEach((b) => b.addEventListener('click', () => openTeam(Number(b.dataset.equipe))));
  $$('[data-canal]', ul).forEach((b) => b.addEventListener('click', () => selectChannel(Number(b.dataset.canal))));
  $('#btn-ajouter-canal', ul)?.addEventListener('click', openChannelDialog);
}

function channelList() {
  return `
    <ul class="canaux" aria-label="${esc(t('canaux'))}">
      ${state.channels.map((c) => `
        <li><button class="canal" data-canal="${c.id}" ${c.id === state.channelId ? 'aria-current="true"' : ''}>
          <span class="canal-nom">${esc(channelName(c))}</span>
          ${c.annonces ? `<span class="canal-tag" title="${esc(t('tag_annonces_info'))}">${t('tag_annonces')}</span>` : ''}
          ${state.unread.has(c.id) ? `<span class="non-lu-point" title="${esc(t('nouveaux_messages'))}"></span>` : ''}
        </button></li>`).join('')}
      ${state.detail.estResponsable ? `<li><button class="canal canal-ajout" id="btn-ajouter-canal">${t('plus_canal')}</button></li>` : ''}
    </ul>`;
}

async function deleteTeam() {
  const team = state.detail?.classe;
  if (!team) return;
  const saisie = prompt(t('confirmer_suppr_equipe', { nom: team.nom }));
  if (saisie === null) return;
  if (saisie.trim() !== team.nom.trim()) { toast(t('nom_equipe_different')); return; }
  try {
    await api(`/classes/${team.id}`, { method: 'DELETE' });
    leaveDeletedTeam();
    toast(t('equipe_supprimee', { nom: team.nom }));
  } catch (err) { toast(err.message); }
}

/** L'équipe affichée n'existe plus : retour à la liste. */
function leaveDeletedTeam() {
  Object.assign(state, { teamId: null, detail: null, meetings: [], channels: [], channelId: null, tab: 'publications' });
  state.unread.clear();
  backToList();
  showEmptyTeam();
  loadTeams();
}

function showEmptyTeam() {
  $('#classe').innerHTML = `<div class="fil"><div class="fil-vide"><strong>${esc(orgName(state.org))}</strong>${t(state.teams.length ? 'choisir_equipe' : 'vide_creer_equipe')}</div></div>`;
}

let openToken = 0;
async function openTeam(id, { keep = false } = {}) {
  const token = ++openToken;
  const sameTeam = state.teamId === id;
  if (!sameTeam) { state.tab = state.ongletSuivant || 'publications'; state.unread.clear(); state.fileFolder = null; }
  else if (state.ongletSuivant) state.tab = state.ongletSuivant;
  state.ongletSuivant = null;
  state.teamId = id;
  renderTeamList();
  state.socket?.emit('classe:rejoindre', id);
  try {
    const [detail, meetings, channels] = await Promise.all([api(`/classes/${id}`), api(`/classes/${id}/seances`), api(`/classes/${id}/canaux`)]);
    if (token !== openToken) return;
    state.detail = detail; state.meetings = meetings; state.channels = channels;
    if (!teamChat(id)) loadConversations().then(() => { if (state.teamId === id) renderTeamList(); });
    if (!sameTeam || !keep || !channels.some((c) => c.id === state.channelId)) state.channelId = channels[0]?.id ?? null;
    if (state.canalSuivant && channels.some((c) => c.id === state.canalSuivant)) state.channelId = state.canalSuivant;
    state.canalSuivant = null;
    renderTeamList();
    renderTeam();
    if (matchMedia('(min-width: 861px)').matches) document.body.classList.add('detail-ouvert');
  } catch (err) { toast(err.message); }
}

function selectChannel(id) {
  if (state.channelId !== id) state.fileFolder = null;
  state.channelId = id;
  state.unread.delete(id);
  state.tab = 'publications';
  document.body.classList.add('detail-ouvert');
  renderTeamList();
  renderTeam();
}

async function loadChannels() {
  const id = state.teamId;
  const channels = await api(`/classes/${id}/canaux`).catch(() => null);
  if (!channels || id !== state.teamId) return;
  state.channels = channels;
  if (!channels.some((c) => c.id === state.channelId)) { state.channelId = channels[0]?.id ?? null; renderTeam(); }
  renderTeamList();
}

async function loadMeetings() {
  const id = state.teamId;
  if (!id) return;
  const meetings = await api(`/classes/${id}/seances`).catch(() => null);
  if (!meetings || id !== state.teamId) return;
  state.meetings = meetings;
  if (state.view === 'classes' && state.tab === 'publications') renderLiveBanner();
  loadTeams();
}

function renderTeam() {
  if (!state.detail) return;
  const { classe: team, estResponsable: isOwner } = state.detail;
  const channel = state.channels.find((c) => c.id === state.channelId);
  $('#classe').innerHTML = `
    <header class="detail-haut">
      <div class="detail-ligne">
        <button class="btn-icone retour" id="btn-retour" aria-label="${esc(t('retour'))}">${ICONES.retour}</button>
        ${avatar(team.id, team.nom, 'carre grand')}
        <div class="detail-titre">${state.tab === 'clavardage'
          ? `<h1>${esc(team.nom)}</h1><p>${esc(t('clavardage_equipe'))}</p>`
          : `<h1>${esc(channel ? channelName(channel) : team.nom)}</h1><p>${esc(team.nom)}</p>`}</div>
        ${isOwner ? `<button class="btn btn-contour" id="btn-inviter">${ICONES.inviter}<span>${t('inviter')}</span></button>` : ''}
        <button class="btn btn-accent" id="btn-reunion" aria-haspopup="true">${ICONES.video}<span>${t('reunion')}</span>${ICONES.chevron}</button>
        ${isOwner ? `<button class="btn-icone" id="btn-options-equipe" aria-haspopup="true" aria-label="${esc(t('options_equipe'))}" title="${esc(t('options_equipe'))}">${ICONES.options}</button>` : ''}
      </div>
      <div class="onglets" role="tablist">
        <button role="tab" data-onglet="publications" aria-selected="${state.tab === 'publications'}">${t('publications')}</button>
        <button role="tab" data-onglet="clavardage" aria-selected="${state.tab === 'clavardage'}">${t('onglet_clavardage')}${teamChatUnread() ? '<span class="non-lu-point"></span>' : ''}</button>
        <button role="tab" data-onglet="fichiers" aria-selected="${state.tab === 'fichiers'}">${t('onglet_fichiers')}</button>
        <button role="tab" data-onglet="membres" aria-selected="${state.tab === 'membres'}">${t('onglet_membres')}</button>
      </div>
    </header>
    <div id="zone-onglet" class="detail"></div>`;
  $('#btn-retour').addEventListener('click', backToList);
  $('#btn-inviter')?.addEventListener('click', openInvite);
  $('#btn-reunion').addEventListener('click', (e) => openMenu('menu-reunion', e.currentTarget));
  $('#btn-options-equipe')?.addEventListener('click', (e) => openMenu('menu-equipe', e.currentTarget, (menu) => {
    menu.innerHTML = `<button type="button" class="danger" id="btn-suppr-equipe">${ICONES.poubelle}<span>${t('supprimer_equipe')}</span></button>`;
    $('#btn-suppr-equipe', menu).addEventListener('click', () => { menu.hidden = true; deleteTeam(); });
  }));
  $$('[data-onglet]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.onglet; renderTeam(); }));
  if (state.tab === 'membres') renderMembers();
  else if (state.tab === 'fichiers') renderFiles();
  else if (state.tab === 'clavardage') renderTeamChat();
  else renderFeed();
}

// Menu « Réunion » de l'équipe
$$('#menu-reunion [data-menu-action]').forEach((b) => b.addEventListener('click', () => {
  $('#menu-reunion').hidden = true;
  if (b.dataset.menuAction === 'maintenant') meetNow(state.teamId);
  else openScheduler({ teamId: state.teamId });
}));

// ---------- Clavardage de l'équipe ----------
// Une discussion de groupe instantanée avec tous les membres de l'équipe (comme le chat de Teams).
const teamChat = (classeId) => state.convs.find((c) => c.classe_id === classeId);
const teamChatUnread = () => (state.detail ? teamChat(state.detail.classe.id)?.non_lus || 0 : 0);

async function renderTeamChat() {
  const id = state.detail?.clavardage_id;
  const zone = $('#zone-onglet');
  if (!id) { zone.innerHTML = ''; return; }
  zone.innerHTML = `<div class="clavardage">${chatHtml()}</div>`;
  if (!teamChat(state.detail.classe.id)) await loadConversations();
  await bindChat(id, () => teamChatOpen(id));
  $('[data-onglet="clavardage"] .non-lu-point')?.remove();
}

async function openTeamChat(classeId) {
  state.ongletSuivant = 'clavardage';
  if (state.view !== 'classes') showView('classes', { teamId: classeId });
  else openTeam(classeId);
}

function liveMeeting() { return state.meetings.find((m) => m.etat === 'en_direct'); }

function renderLiveBanner() {
  const zone = $('#bandeau');
  if (!zone) return;
  const m = liveMeeting();
  zone.innerHTML = m ? `
    <div class="en-cours">
      <span class="en-cours-icone">${ICONES.video}</span>
      <div class="en-cours-texte"><strong>${esc(t('reunion_en_cours', { titre: m.titre }))}</strong><span>${esc(t('jusqua', { heure: fmt.time.format(meetingEnd(m)) }))}</span></div>
      ${canEnd(m) ? `<button class="btn btn-contour" data-terminer-seance="${m.id}">${t('terminer_reunion')}</button>` : ''}
      <button class="btn btn-soleil" data-avant="${m.id}">${t('rejoindre_reunion')}</button>
    </div>` : '';
}

/** Fil de publications du canal, avec les réunions à venir de l'équipe (canal Général). */
async function renderFeed() {
  const zone = $('#zone-onglet');
  const { estResponsable: isOwner } = state.detail;
  const channel = state.channels.find((c) => c.id === state.channelId);
  if (!channel) { zone.innerHTML = ''; return; }
  const canPost = !channel.annonces || isOwner;
  zone.innerHTML = `
    <div class="fil" id="fil">
      <div id="bandeau"></div>
      <p class="chargement">${t('chargement_messages')}</p>
    </div>
    ${canPost ? `
      <div class="compose"><form id="compose">
        <button type="button" class="btn-joindre" id="joindre-canal" aria-label="${esc(t('joindre'))}" title="${esc(t('joindre'))}">${ICONES.trombone}</button>
        <label class="sr" for="champ-message">${esc(t('message_a', { canal: channelName(channel) }))}</label>
        <textarea id="champ-message" rows="1" maxlength="4000" placeholder="${esc(t('nouvelle_publication', { canal: channelName(channel) }))}"></textarea>
        <button class="btn-envoyer" type="submit" aria-label="${esc(t('envoyer'))}">${ICONES.envoyer}</button>
      </form></div>` : `<p class="lecture-seule">${t('lecture_seule')}</p>`}`;
  renderLiveBanner();
  $('#joindre-canal')?.addEventListener('click', () => pickFiles(`/canaux/${channel.id}/fichiers`));
  if (canPost) bindComposer($('#compose'), (contenu, done) => {
    state.socket.emit('message:envoyer', { canalId: channel.id, contenu }, (res) => {
      if (res?.ok) done(); else toast(res?.erreur || t('message_non_envoye'));
    });
  });
  try {
    const messages = await api(`/canaux/${channel.id}/messages`);
    if (state.channelId !== channel.id || state.tab !== 'publications') return;
    const feed = $('#fil');
    $('.chargement', feed)?.remove();
    // Réunions à venir de l'équipe, placées dans le fil à leur date de création (canal Général).
    const items = messages.map((m) => ({ type: 'post', at: m.cree_le, m }));
    if (channel.est_general) state.meetings.filter((m) => m.etat === 'a_venir').forEach((m) => items.push({ type: 'reunion', at: m.cree_le, m }));
    items.sort((a, b) => a.at.localeCompare(b.at));
    if (!items.length) feed.insertAdjacentHTML('beforeend', `<div class="fil-vide" id="fil-vide"><strong>${esc(channelName(channel))}</strong>${t('aucun_message')}</div>`);
    items.forEach((it) => (it.type === 'post' ? appendPost(it.m, false) : appendMeetingCard(it.m)));
    feed.scrollTop = feed.scrollHeight;
  } catch (err) { toast(err.message); }
}

function appendPost(m, scroll) {
  const feed = $('#fil');
  if (!feed || !state.detail) return;
  $('#fil-vide', feed)?.remove();
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  const owner = m.auteur_id === state.detail.classe.responsable_id;
  const el = document.createElement('article');
  el.className = 'publication';
  el.innerHTML = `${avatar(m.auteur_id, m.auteur_nom)}
    <div class="publication-corps">
      <div class="publication-tete"><strong>${esc(m.auteur_nom)}</strong>${owner ? `<span class="badge">${t('proprietaire')}</span>` : ''}<time datetime="${esc(m.cree_le)}">${esc(fmt.message.format(new Date(m.cree_le)))}</time></div>
      <p></p>${attachmentHtml(m)}
    </div>`;
  $('p', el).textContent = m.contenu;
  if (!m.contenu) $('p', el).remove();
  feed.append(el);
  if (scroll && (atBottom || m.auteur_id === state.me.id)) feed.scrollTop = feed.scrollHeight;
}

function appendMeetingCard(m) {
  const feed = $('#fil');
  const el = document.createElement('article');
  el.className = 'publication carte-reunion';
  el.innerHTML = `<span class="icone-cal">${ICONES.cal}</span>
    <div class="publication-corps"><small>${t('reunion_planifiee_titre')}</small><strong></strong><span>${esc(whenRange(new Date(m.debut), meetingEnd(m)))}</span></div>
    <button class="btn btn-contour" data-reunion="${m.id}">${t('voir')}</button>`;
  $('strong', el).textContent = m.titre;
  feed.append(el);
}

/** Zone de saisie : Entrée envoie, Maj+Entrée va à la ligne. */
function bindComposer(form, send) {
  const field = $('textarea', form);
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  field.addEventListener('input', () => { field.style.height = 'auto'; field.style.height = `${Math.min(field.scrollHeight, 160)}px`; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const contenu = field.value.trim();
    if (!contenu) return;
    send(contenu, () => { field.value = ''; field.style.height = 'auto'; field.focus(); });
  });
}

// ---------- Onglet Fichiers : bibliothèque de documents du canal ----------
async function renderFiles() {
  const zone = $('#zone-onglet');
  const channel = state.channels.find((c) => c.id === state.channelId);
  if (!channel) { zone.innerHTML = ''; return; }
  const folder = state.fileFolder;
  let data;
  try { data = await api(`/canaux/${channel.id}/fichiers${folder ? `?dossier=${folder}` : ''}`); }
  catch (err) { state.fileFolder = null; toast(err.message); return; }
  if (state.tab !== 'fichiers' || state.channelId !== channel.id || state.fileFolder !== folder) return;
  const target = `/canaux/${channel.id}/fichiers?${folder ? `dossier=${folder}&` : ''}publier=${folder ? 0 : 1}`;
  zone.innerHTML = `
    <div class="fichiers" id="zone-fichiers" data-depot="${esc(t('deposer_ici'))}">
      <div class="fichiers-barre">
        <nav class="ariane" aria-label="${esc(t('onglet_fichiers'))}">
          ${data.chemin.length ? `<button data-dossier="">${esc(channelName(channel))}</button>` : `<span aria-current="page">${esc(channelName(channel))}</span>`}
          ${data.chemin.map((d, i) => `<span class="sep">›</span>${i === data.chemin.length - 1 ? `<span aria-current="page">${esc(d.nom)}</span>` : `<button data-dossier="${d.id}">${esc(d.nom)}</button>`}`).join('')}
        </nav>
        ${data.peut_deposer ? `
          <button class="btn btn-contour" id="btn-dossier">${ICONES.dossier}<span>${t('nouveau_dossier')}</span></button>
          <button class="btn btn-accent" id="btn-televerser">${ICONES.telecharger}<span>${t('televerser')}</span></button>` : ''}
      </div>
      ${data.elements.length ? `
      <table class="table-fichiers">
        <thead><tr><th>${t('col_nom')}</th><th class="col-option">${t('col_modifie')}</th><th class="col-option">${t('col_par')}</th><th class="col-option">${t('col_taille')}</th><th><span class="sr">${t('actions')}</span></th></tr></thead>
        <tbody>${data.elements.map((f) => `
          <tr>
            <td><div class="nom-fichier">${f.est_dossier ? `<span class="ext dossier">${ICONES.dossier}</span><button data-dossier="${f.id}">${esc(f.nom)}</button>`
              : `${extBadge(f.nom, f.type_mime)}<a href="${esc(fileUrl(f.id))}" target="_blank" rel="noopener">${esc(f.nom)}</a>`}</div></td>
            <td class="discret col-option">${esc(fmt.message.format(new Date(f.cree_le)))}</td>
            <td class="discret col-option">${esc(f.auteur_nom || '')}</td>
            <td class="discret col-option">${f.est_dossier ? '' : esc(formatSize(f.taille))}</td>
            <td class="actions">
              ${f.est_dossier ? '' : `<a class="btn-icone" href="${esc(fileUrl(f.id, true))}" download aria-label="${esc(t('telecharger'))}" title="${esc(t('telecharger'))}">${ICONES.telecharger}</a>`}
              ${f.peut_supprimer ? `<button class="btn-icone" data-suppr-fichier="${f.id}" data-nom="${esc(f.nom)}" data-est-dossier="${f.est_dossier}" aria-label="${esc(t('supprimer'))}" title="${esc(t('supprimer'))}">${ICONES.poubelle}</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table>` : `<div class="fil-vide fichiers-vide">${ICONES.dossier}<br>${t(data.peut_deposer ? 'fichiers_vide' : 'aucun_resultat')}</div>`}
    </div>`;
  $$('[data-dossier]', zone).forEach((b) => b.addEventListener('click', () => { state.fileFolder = Number(b.dataset.dossier) || null; renderFiles(); }));
  $('#btn-televerser')?.addEventListener('click', () => pickFiles(target, renderFiles));
  $('#btn-dossier')?.addEventListener('click', () => openDialog('dlg-dossier', async ({ nom }) => {
    await api(`/canaux/${channel.id}/dossiers`, { method: 'POST', body: { nom, parent_id: folder } });
    toast(t('dossier_cree'));
    renderFiles();
  }));
  $$('[data-suppr-fichier]', zone).forEach((b) => b.addEventListener('click', async () => {
    const question = Number(b.dataset.estDossier) ? 'confirmer_suppr_dossier' : 'confirmer_suppr_fichier';
    if (!confirm(t(question, { nom: b.dataset.nom }))) return;
    try { await api(`/fichiers/${b.dataset.supprFichier}`, { method: 'DELETE' }); toast(t('fichier_supprime')); renderFiles(); }
    catch (err) { toast(err.message); }
  }));
  // Glisser-déposer des fichiers depuis l'ordinateur
  const depot = $('#zone-fichiers');
  if (data.peut_deposer) {
    depot.addEventListener('dragover', (e) => { e.preventDefault(); depot.classList.add('depot'); });
    depot.addEventListener('dragleave', (e) => { if (!depot.contains(e.relatedTarget)) depot.classList.remove('depot'); });
    depot.addEventListener('drop', async (e) => {
      e.preventDefault(); depot.classList.remove('depot');
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) { await uploadFiles(files, target); renderFiles(); }
    });
  }
}

function renderMembers() {
  const zone = $('#zone-onglet');
  const { classe: team, responsable: owner, membres: members, estResponsable: isOwner } = state.detail;
  const row = (p, removable) => `
    <li class="membre">${avatarP(p.id, p.nom)}<div><strong>${esc(p.nom)}</strong><small dir="ltr">${esc(p.email)}</small></div>
      ${removable ? `<button class="btn-discret" data-retirer="${p.id}">${t('retirer')}</button>` : ''}
      ${p.id !== state.me.id ? `<button class="btn-icone" data-ecrire="${p.id}" aria-label="${esc(t('envoyer_message_a', { nom: p.nom }))}" title="${esc(t('envoyer_message_a', { nom: p.nom }))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></button>` : ''}
    </li>`;
  zone.innerHTML = `<div class="panneau">
    ${isOwner ? `<div class="invitation"><div><span class="invitation-libelle">${t('code_equipe')}</span><strong class="code">${esc(team.code_invitation)}</strong></div><p>${t('note_code_equipe')}</p><button class="btn btn-contour" data-copier="${esc(team.code_invitation)}">${t('copier_code')}</button></div>` : ''}
    <h3 class="sous-titre">${t('proprietaire')}</h3>
    <ul class="membres">${row(owner, false)}</ul>
    <h3 class="sous-titre">${t('membres_n', { n: members.length })}</h3>
    ${members.length ? `<ul class="membres">${members.map((p) => row(p, isOwner)).join('')}</ul>` : `<p class="note">${t('personne_rejoint')}</p>`}
  </div>`;
}

function openInvite() {
  const { classe: team } = state.detail;
  const message = t('message_invitation', { equipe: team.nom, lien: location.origin, code: team.code_invitation });
  $('#inviter-corps').innerHTML = `
    <h2>${esc(t('inviter_dans', { equipe: team.nom }))}</h2>
    <p class="note">${t('note_inviter')}</p>
    <div class="invitation"><div><span class="invitation-libelle">${t('code_equipe')}</span><strong class="code">${esc(team.code_invitation)}</strong></div>
      <button class="btn btn-contour" data-copier="${esc(team.code_invitation)}">${t('copier_code')}</button></div>
    <button class="btn btn-accent" id="copier-message">${t('copier_message_invitation')}</button>
    <button type="button" class="btn-lien dlg-fermer" data-fermer>${t('fermer')}</button>`;
  $('#copier-message').addEventListener('click', () => copy(message, 'message_copie'));
  $('#inviter-corps [data-fermer]').addEventListener('click', () => $('#dlg-inviter').close());
  $('#dlg-inviter').showModal();
}

function openChannelDialog() {
  openDialog('dlg-canal', async (values) => {
    const channel = await api(`/classes/${state.teamId}/canaux`, { method: 'POST', body: { nom: values.nom, description: values.description, annonces: values.annonces === 'on' } });
    await loadChannels();
    selectChannel(channel.id);
    toast(t('canal_cree'));
  });
}

$('#btn-nouvelle-classe').addEventListener('click', () => openDialog('dlg-classe', async (values) => {
  const team = await api('/classes', { method: 'POST', body: { ...values, espace_id: state.org.id } });
  await loadTeams();
  await openTeam(team.id);
  openInvite();
}));

// ---------- Réunions : maintenant, planifier ----------
/** Réunion immédiate : créée tout de suite, puis l'écran « prêt à rejoindre ». */
async function meetNow(teamId) {
  try {
    const m = await api(`/classes/${teamId}/seances`, { method: 'POST', body: { immediat: true, titre: t('titre_reunion_immediate'), duree_min: 60 } });
    if (teamId === state.teamId) loadMeetings();
    showPrejoin(m.id);
  } catch (err) { toast(err.message); }
}

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
function nextFullHour() { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return toLocalInput(d); }

/**
 * Planifier une réunion (mode « planifier ») ou en lancer une tout de suite depuis le calendrier (mode « maintenant »).
 * teamId fixé : depuis une équipe ; sinon on choisit l'équipe.
 */
function openScheduler({ teamId = null, debut = null, mode = 'planifier' } = {}) {
  if (!teamId && !state.teams.length) return toast(t('aucune_equipe_planifier'));
  const now = mode === 'maintenant';
  const picker = createPicker($('#choix-planif'), loadDirectory);
  const refreshExclude = async (id) => { try { picker.setExclude([state.me.id, ...(await teamMemberIds(id))]); } catch { /* sans incidence */ } };
  openDialog('dlg-seance', async (values) => {
    const team = teamId || Number(values.classe_id);
    const body = now
      ? { immediat: true, titre: values.titre, duree_min: 60, participants: picker.ids() }
      : { titre: values.titre, debut: new Date(values.debut).toISOString(), duree_min: Number(values.duree_min), participants: picker.ids() };
    const m = await api(`/classes/${team}/seances`, { method: 'POST', body });
    if (team === state.teamId) loadMeetings();
    if (state.view === 'agenda') loadCalendar();
    if (now) showPrejoin(m.id); else toast(t('reunion_planifiee'));
  }, (form) => {
    $('#seance-titre-dlg').textContent = t(now ? 'reunion_maintenant' : 'planifier_reunion');
    $('#seance-valider').textContent = t(now ? 'demarrer' : 'planifier');
    $('#champs-horaire').hidden = now;
    form.debut.required = !now;
    form.titre.value = now ? t('titre_reunion_immediate') : '';
    form.debut.value = debut ? toLocalInput(debut) : nextFullHour();
    $('#champ-equipe').hidden = Boolean(teamId);
    form.classe_id.innerHTML = state.teams.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('');
    if (state.teamId && state.teams.some((x) => x.id === state.teamId)) form.classe_id.value = state.teamId;
    form.classe_id.onchange = () => refreshExclude(Number(form.classe_id.value));
    refreshExclude(teamId || Number(form.classe_id.value));
  });
}

// ---------- Avant de rejoindre (membres et invités) ----------
const prejoin = { mode: null, id: null, jeton: null, info: null, micro: true, camera: false, flux: null, back: null };

function stopPreview() {
  prejoin.flux?.getTracks().forEach((tr) => tr.stop());
  prejoin.flux = null;
}

/** Écran « prêt à rejoindre » pour un membre (réunion d'une équipe ou réunion où il est invité). */
async function showPrejoin(meetingId) {
  stopPreview();
  Object.assign(prejoin, { mode: 'membre', id: meetingId, jeton: null, info: null, camera: false, micro: true, back: state.view });
  showScreen('ecran-reunion');
  $('#avant-contenu').innerHTML = `<p class="chargement">${t('chargement')}</p>`;
  try {
    const p = await api(`/seances/${meetingId}/participants`);
    const m = state.meetings.find((x) => x.id === meetingId) || cal.meetings.find((x) => x.id === meetingId)
      || (await api(`/agenda?espace=${state.org.id}&du=${new Date(Date.now() - 864e5).toISOString()}&au=${new Date(Date.now() + 60 * 864e5).toISOString()}`)).find((x) => x.id === meetingId);
    prejoin.info = { ...m, equipe: p.equipe.nom, nbEquipe: p.equipe.membres.length, invites: p.invites, jeton: p.jeton, peutModifier: p.peutModifier, membres: p.equipe.membres };
    renderPrejoin();
  } catch (err) { $('#avant-contenu').innerHTML = `<p class="message-info">${esc(err.message)}</p>`; }
}

/** Écran « prêt à rejoindre » pour un invité, par le lien /r/<jeton>, sans compte. */
async function showGuest(jeton) {
  stopPreview();
  Object.assign(prejoin, { mode: 'invite', id: null, jeton, info: null, camera: false, micro: true, back: null });
  showScreen('ecran-reunion');
  $('#avant-contenu').innerHTML = `<p class="chargement">${t('chargement')}</p>`;
  try {
    const info = await api(`/invite/${jeton}`);
    prejoin.info = { ...info, organisateur_nom: info.organisateur, jeton };
    renderPrejoin();
  } catch (err) { $('#avant-contenu').innerHTML = `<p class="message-info">${esc(err.message)}</p>`; }
}

function renderPrejoin() {
  const m = prejoin.info;
  if (!m) return;
  const guest = prejoin.mode === 'invite';
  const debut = new Date(m.debut);
  const fin = new Date(debut.getTime() + m.duree_min * 60_000);
  const ouverture = new Date(debut.getTime() - 10 * 60_000);
  const host = !guest && canHost(m);
  const open = m.etat === 'en_direct' || (host && m.etat === 'a_venir');
  const me = guest ? null : state.me;
  let action;
  if (m.etat === 'terminee') action = `<p class="message-info">${t('invite_terminee')}</p>`;
  else if (!open) action = `<p class="message-info">${esc(t('invite_ouvre_a', { heure: fmt.time.format(ouverture), min: 10 }))}</p>`;
  else action = `
    <form id="form-rejoindre" class="form-rejoindre">
      ${guest ? `<label><span>${t('votre_nom')}</span><input name="nom" required minlength="2" maxlength="60" autocomplete="name"></label><p class="note">${t('invite_sans_compte')}</p>` : ''}
      <p class="erreur" role="alert"></p>
      <button class="btn btn-accent btn-grand" type="submit">${t('rejoindre_maintenant')}</button>
    </form>`;
  const participants = guest ? '' : `
    <div class="carte-ligne">
      <span class="pile-avatars">${m.membres.slice(0, 3).map((p) => avatar(p.id, p.nom, 'petit')).join('')}</span>
      <span>${esc(t('toute_equipe', { equipe: m.equipe, n: m.nbEquipe }))}${m.invites.length ? `, ${esc(t('n_invites', { n: m.invites.length }))}` : ''}</span>
    </div>`;
  $('#avant-retour').hidden = false;
  $('#avant-retour').textContent = t(guest ? 'invite_compte' : 'retour');
  $('#avant-contenu').innerHTML = `
    <div class="avant-cadre">
      <div>
        <div class="avant-equipe">${esc(m.equipe || m.classe_nom || '')}</div>
        <h1></h1>
        <p class="avant-quand">${esc(whenRange(debut, fin))}${m.organisateur_nom ? `, ${esc(t('organisee_par', { nom: m.organisateur_nom }))}` : ''}</p>
      </div>
      <div class="avant-grille">
        <div class="avant-video">
          <div class="apercu" id="apercu">
            ${me ? avatar(me.id, me.nom) : `<span class="avatar">${ICONES.profil}</span>`}
            <span class="apercu-etiquette">${t(prejoin.camera ? 'camera_on' : 'camera_desactivee')}</span>
          </div>
          <div class="reglages">
            <button type="button" class="reglage" id="reglage-micro" aria-pressed="${prejoin.micro}">${prejoin.micro ? ICONES.micro : ICONES.microOff}<span>${t(prejoin.micro ? 'micro_on' : 'micro_off')}</span></button>
            <button type="button" class="reglage" id="reglage-camera" aria-pressed="${prejoin.camera}">${prejoin.camera ? ICONES.video : ICONES.videoOff}<span>${t(prejoin.camera ? 'camera_on' : 'camera_off')}</span></button>
          </div>
        </div>
        <div class="avant-cote">
          <div class="carte">
            <h2>${t('pret_a_rejoindre')}</h2>
            ${participants}
            ${action}
          </div>
          ${m.jeton && m.etat !== 'terminee' && !guest ? `
          <div class="carte">
            <h2>${t('inviter_quelqu_un')}</h2>
            <p class="note">${t('note_lien')}</p>
            <div class="lien-ligne"><input readonly dir="ltr" value="${esc(inviteLink(m.jeton))}" aria-label="${esc(t('lien_invitation'))}"><button type="button" class="btn btn-contour" data-copier-lien="${esc(m.jeton)}">${t('copier_lien')}</button></div>
            ${m.peutModifier ? `<button type="button" class="btn-lien a-gauche" id="avant-ajout">${t('ajouter_participants')}</button>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>`;
  $('#avant-contenu h1').textContent = m.titre;
  if (prejoin.flux) attachPreview();
  $('#reglage-micro').addEventListener('click', () => { prejoin.micro = !prejoin.micro; renderPrejoin(); });
  $('#reglage-camera').addEventListener('click', toggleCamera);
  $('#avant-ajout')?.addEventListener('click', () => openAddParticipants({ id: prejoin.id }, { equipe: { membres: m.membres }, invites: m.invites }, () => showPrejoin(prejoin.id)));
  const form = $('#form-rejoindre');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    joinNow(form);
  });
}

/** Aperçu caméra local (rien n'est envoyé avant d'entrer dans la réunion). */
async function toggleCamera() {
  prejoin.camera = !prejoin.camera;
  if (prejoin.camera) {
    try { prejoin.flux = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
    catch { prejoin.camera = false; toast(t('camera_refusee')); }
  } else stopPreview();
  renderPrejoin();
}
function attachPreview() {
  const zone = $('#apercu');
  const v = document.createElement('video');
  v.autoplay = true; v.muted = true; v.playsInline = true; v.srcObject = prejoin.flux;
  zone.prepend(v);
}

// ---------- Visio dans la page (comme Teams) ----------
// La réunion s'affiche par-dessus Nadwa, dans un seul onglet. « Quitter » ramène à Nadwa ;
// « Terminer pour tous » (organisateur) ferme la réunion pour tout le monde. Chaque page
// vérifie aussi l'état de la réunion et ferme la visio dès qu'elle est terminée.
const visio = { api: null, etat: null, timer: null, seanceId: null };
let chargementApiJitsi = null;

function chargerApiJitsi(domaine) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  chargementApiJitsi ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${domaine}/external_api.js`;
    script.onload = resolve;
    script.onerror = () => { chargementApiJitsi = null; reject(new Error(t('visio_indisponible'))); };
    document.head.append(script);
  });
  return chargementApiJitsi;
}

/**
 * Ouvre la visio. reponse = réponse de l'API (/rejoindre ou /appel).
 * options : titre, etat (fonction qui renvoie l'état de la réunion), seanceId (si l'on peut la terminer).
 */
async function openVisio(reponse, { titre = '', etat = null, seanceId = null, ref = null } = {}) {
  const v = reponse.integration;
  if (window.NADWA_OUVRIR_VISIO) { window.NADWA_OUVRIR_VISIO(reponse.url); return; }
  if (!v) { // BigBlueButton : nouvel onglet
    if (!window.open(reponse.url, '_blank')) location.href = reponse.url;
    return;
  }
  await chargerApiJitsi(v.domaine);
  closeVisio(false);
  $('#visio-titre').textContent = titre;
  $('#visio-terminer').hidden = !seanceId;
  $('#ecran-visio').hidden = false;
  const api = new window.JitsiMeetExternalAPI(v.domaine, {
    roomName: v.salle,
    jwt: v.jwt || undefined,
    parentNode: $('#visio-cadre'),
    width: '100%',
    height: '100%',
    lang: window.NADWA_LANGUE,
    userInfo: { displayName: v.nom },
    configOverwrite: {
      startWithAudioMuted: !v.micro,
      startWithVideoMuted: !v.camera,
      prejoinConfig: { enabled: false },
      disableDeepLinking: true,
      enableClosePage: false,
      // Grand cours : vidéo limitée à 360p (débit divisé par 2 à 3 pour le serveur et les élèves).
      ...(v.grand ? { resolution: 360, constraints: { video: { height: { ideal: 360, max: 360, min: 180 } } } } : {}),
    },
  });
  Object.assign(visio, { api, etat, seanceId, ref, debut: Date.now(), timer: etat ? setInterval(checkVisio, 10_000) : null });
  state.socket?.emit('presence:reunion', v.salle);
  // Raccrocher dans la visio, ou être exclu quand l'organisateur termine : retour à Nadwa.
  api.addListener('videoConferenceLeft', () => closeVisio());
  api.addListener('readyToClose', () => closeVisio());
}

function closeVisio(rafraichir = true) {
  clearInterval(visio.timer);
  const api = visio.api;
  const { ref, debut } = visio;
  Object.assign(visio, { api: null, etat: null, timer: null, seanceId: null, ref: null, debut: null });
  if (api) { try { api.dispose(); } catch { /* déjà fermée */ } }
  $('#visio-cadre').innerHTML = '';
  $('#ecran-visio').hidden = true;
  if (api) state.socket?.emit('presence:reunion', false);
  if (rafraichir && api && state.me) {
    loadMeetings();
    if (state.view === 'agenda') loadCalendar();
    // Évaluation de la qualité, après une réunion d'au moins une minute.
    const duree = Math.round((Date.now() - debut) / 1000);
    if (ref && duree >= 60) setTimeout(() => openRating(ref, duree), 400);
  }
}

// ---------- Évaluation de la qualité après une réunion ----------
function openRating(ref, duree) {
  const dlg = $('#dlg-evaluation');
  if (dlg.open) return;
  let note = 0;
  const form = $('form', dlg);
  form.reset();
  $('.erreur', dlg).textContent = '';
  const etoiles = $$('[data-note]', dlg);
  const peindre = (n) => etoiles.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.note) <= n)));
  peindre(0);
  etoiles.forEach((b) => { b.onclick = () => { note = Number(b.dataset.note); peindre(note); $('#eval-details').hidden = note >= 5; }; });
  $('#eval-details').hidden = true;
  dlg.showModal();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!note) { $('.erreur', dlg).textContent = t('choisir_note'); return; }
    const problemes = $$('[name=probleme]:checked', form).map((c) => c.value);
    try {
      await api('/aide/evaluation', { method: 'POST', body: { ...ref, note, problemes, commentaire: form.commentaire.value, duree_s: duree } });
      dlg.close();
      toast(t('merci_evaluation'));
    } catch (err) { $('.erreur', dlg).textContent = err.message; }
  };
}

// ---------- Aide et commentaires (soutien technique) ----------
function openHelp() {
  openDialog('dlg-aide', async (values) => {
    await api('/aide/retour', { method: 'POST', body: { ...values, page: `${state.view}${state.teamId ? ` / équipe ${state.teamId}` : ''}` } });
    toast(t('merci_retour'));
  });
}

async function checkVisio() {
  if (!visio.api || !visio.etat) return;
  const api = visio.api;
  const etat = await visio.etat().catch((err) => (err.status === 404 ? 'terminee' : null));
  if (etat !== 'terminee' || visio.api !== api) return;
  closeVisio();
  toast(t('reunion_terminee_ok'));
}

$('#visio-quitter').addEventListener('click', () => closeVisio());
$('#visio-terminer').addEventListener('click', async () => {
  const id = visio.seanceId;
  if (!id || !confirm(t('confirmer_fin_reunion'))) return;
  try {
    await api(`/seances/${id}/terminer`, { method: 'POST' });
    try { visio.api?.executeCommand('endConference'); } catch { /* ancienne version de Jitsi */ }
    setTimeout(() => closeVisio(), 800);
    toast(t('reunion_terminee_ok'));
  } catch (err) { toast(err.message); }
});

async function joinNow(form) {
  const button = $('[type=submit]', form);
  button.disabled = true;
  $('.erreur', form).textContent = '';
  const options = { micro: prejoin.micro, camera: prejoin.camera };
  try {
    const reponse = prejoin.mode === 'invite'
      ? await api(`/invite/${prejoin.jeton}/rejoindre`, { method: 'POST', body: { nom: form.nom.value, ...options } })
      : await api(`/seances/${prejoin.id}/rejoindre`, { method: 'POST', body: options });
    stopPreview();
    const { mode, id, jeton, info } = prejoin;
    const organisateur = mode !== 'invite' && info && (info.organisateur_id ? info.organisateur_id === state.me?.id : canHost(info));
    await openVisio(reponse, {
      titre: info?.titre || '',
      etat: async () => (await api(mode === 'invite' ? `/invite/${jeton}` : `/seances/${id}/etat`)).etat,
      seanceId: organisateur ? id : null,
      ref: mode === 'invite' ? null : { seance_id: id },
    });
  } catch (err) {
    $('.erreur', form).textContent = err.message;
  } finally { button.disabled = false; }
}

$('#avant-retour').addEventListener('click', () => {
  stopPreview();
  if (prejoin.mode === 'invite') {
    history.replaceState(null, '', location.hash.startsWith('#/r/') ? location.pathname + location.search : '/');
    launch();
    return;
  }
  showScreen('ecran-app');
  showView(prejoin.back || 'classes');
});

// ---------- Conversation (messages directs) ----------
async function loadConversations() {
  try { state.convs = await api('/conversations'); } catch { state.convs = []; }
  updateBadge();
  if (state.view === 'conversation') renderConvList();
}

function updateBadge() {
  const n = state.convs.reduce((s, c) => s + (c.id === state.convId && state.view === 'conversation' ? 0 : c.non_lus), 0);
  const b = $('#badge-conversation');
  b.hidden = !n;
  b.textContent = n > 99 ? '99+' : String(n);
}

const convName = (c) => c.nom || c.membres.map((m) => m.nom).join(', ') || t('conversation');
const convAvatar = (c, cls = 'grand') => (c.membres.length === 1 ? avatarP(c.membres[0].id, c.membres[0].nom, cls) : avatar(c.id + 1000, convName(c), cls));
const convPreview = (c) => {
  if (!c.dernier) return t('nouvelle_conversation');
  const who = c.dernier.auteur_id === state.me.id ? `${t('vous_moi')} : ` : (c.membres.length > 1 ? `${c.dernier.auteur_nom} : ` : '');
  return c.dernier.type === 'appel' ? t('appel_lance_par', { nom: c.dernier.auteur_nom }) : who + (c.dernier.contenu || c.dernier.fichier_nom || '');
};

$('#recherche-conv').addEventListener('input', (e) => { state.convFilter = e.target.value.trim().toLowerCase(); renderConvList(); });

function renderConvList() {
  const ul = $('#liste-conversations');
  const list = state.convs.filter((c) => !state.convFilter || convName(c).toLowerCase().includes(state.convFilter));
  if (!state.convs.length) { ul.innerHTML = `<li class="liste-vide">${t('aucune_conversation')}</li>`; return; }
  if (!list.length) { ul.innerHTML = `<li class="liste-vide">${t('aucun_resultat')}</li>`; return; }
  ul.innerHTML = list.map((c) => `
    <li><button class="item${c.non_lus && c.id !== state.convId ? ' non-lu' : ''}" data-conv="${c.id}" ${c.id === state.convId ? 'aria-current="true"' : ''}>
      ${convAvatar(c)}
      <span class="item-texte">
        <span class="item-ligne"><strong>${esc(convName(c))}</strong><span class="heure">${c.dernier ? esc(shortWhen(c.dernier.cree_le)) : ''}</span></span>
        <small>${esc(convPreview(c))}</small>
      </span>
      ${c.non_lus && c.id !== state.convId ? `<span class="compteur">${c.non_lus}</span>` : ''}
    </button></li>`).join('');
  $$('[data-conv]', ul).forEach((b) => b.addEventListener('click', () => openConversation(Number(b.dataset.conv))));
}

function showEmptyConversation() {
  $('#detail-conversation').innerHTML = `<div class="fil"><div class="fil-vide"><strong>${t('conversation')}</strong>${t('aucune_conversation_detail')}</div></div>`;
}

async function openConversation(id) {
  state.convId = id;
  const c = state.convs.find((x) => x.id === id);
  if (!c) return showEmptyConversation();
  c.non_lus = 0;
  updateBadge();
  renderConvList();
  document.body.classList.add('detail-ouvert');
  const subtitle = c.membres.length === 1 ? c.membres[0].email : t('n_personnes', { n: c.membres.length + 1 });
  $('#detail-conversation').innerHTML = `
    <header class="detail-haut sans-onglets">
      <div class="detail-ligne">
        <button class="btn-icone retour" id="btn-retour-conv" aria-label="${esc(t('retour'))}">${ICONES.retour}</button>
        ${convAvatar(c)}
        <div class="detail-titre"><h1>${esc(convName(c))}</h1><p dir="auto">${esc(subtitle)}</p></div>
        <button class="btn-icone contour" id="appel-video" aria-label="${esc(t('appel_video'))}" title="${esc(t('appel_video'))}">${ICONES.video}</button>
        <button class="btn-icone contour" id="appel-audio" aria-label="${esc(t('appel_audio'))}" title="${esc(t('appel_audio'))}">${ICONES.tel}</button>
      </div>
    </header>
    ${chatHtml()}`;
  $('#btn-retour-conv').addEventListener('click', backToList);
  $('#appel-video').addEventListener('click', () => startCall(id, true));
  $('#appel-audio').addEventListener('click', () => startCall(id, false));
  await bindChat(id, () => state.convId === id && state.view === 'conversation');
}

/** Fil de messages et zone de saisie d'une conversation (messages directs ou clavardage d'équipe). */
const chatHtml = () => `
    <div class="fil" id="fil-dm"><p class="chargement">${t('chargement_messages')}</p></div>
    <div class="compose"><form id="compose-dm">
      <button type="button" class="btn-joindre" id="joindre-dm" aria-label="${esc(t('joindre'))}" title="${esc(t('joindre'))}">${ICONES.trombone}</button>
      <label class="sr" for="champ-dm">${t('message')}</label>
      <textarea id="champ-dm" rows="1" maxlength="4000" placeholder="${esc(t('ecrire_message'))}"></textarea>
      <button class="btn-envoyer" type="submit" aria-label="${esc(t('envoyer'))}">${ICONES.envoyer}</button>
    </form></div>`;

async function bindChat(id, stillHere) {
  $('#joindre-dm').addEventListener('click', () => pickFiles(`/conversations/${id}/fichiers`));
  bindComposer($('#compose-dm'), (contenu, done) => {
    state.socket.emit('dm:envoyer', { conversationId: id, contenu }, (res) => { if (res?.ok) done(); else toast(res?.erreur || t('message_non_envoye')); });
  });
  try {
    const messages = await api(`/conversations/${id}/messages`);
    if (!stillHere()) return;
    const feed = $('#fil-dm');
    feed.innerHTML = messages.length ? '' : `<div class="fil-vide" id="fil-dm-vide">${t('dites_bonjour')}</div>`;
    let lastDay = null;
    messages.forEach((m) => { lastDay = appendDM(m, lastDay); });
    feed.scrollTop = feed.scrollHeight;
    api(`/conversations/${id}/lu`, { method: 'POST' }).catch(() => {});
    const c = state.convs.find((x) => x.id === id);
    if (c && c.non_lus) { c.non_lus = 0; updateBadge(); renderTeamList(); }
  } catch (err) { toast(err.message); }
}

/** Le clavardage de l'équipe affichée est-il à l'écran ? */
const teamChatOpen = (convId) => state.view === 'classes' && state.tab === 'clavardage' && state.detail?.clavardage_id === convId;

/** Ajoute un message direct au fil ; renvoie le jour affiché (pour les séparateurs). */
function appendDM(m, lastDay) {
  const feed = $('#fil-dm');
  if (!feed) return lastDay;
  $('#fil-dm-vide', feed)?.remove();
  const d = new Date(m.cree_le);
  const day = d.toDateString();
  if (day !== lastDay) {
    feed.insertAdjacentHTML('beforeend', `<div class="jour">${esc(sameDay(d, new Date()) ? t('aujourdhui') : fmt.day.format(d))}</div>`);
  }
  if (m.type === 'appel') {
    feed.insertAdjacentHTML('beforeend', `
      <div class="carte-appel"><span class="icone">${ICONES.video}</span>
        <div><strong>${esc(t('appel_lance_par', { nom: m.auteur_nom }))}</strong><div class="note">${esc(fmt.time.format(d))}</div></div>
        <button class="btn btn-accent" data-rejoindre-appel="${m.conversation_id}">${t('rejoindre_reunion')}</button></div>`);
  } else {
    const mine = m.auteur_id === state.me.id;
    const el = document.createElement('div');
    el.className = `bulle-ligne${mine ? ' moi' : ''}`;
    const conv = state.convs.find((x) => x.id === m.conversation_id);
    const group = !mine && conv && (conv.classe_id || conv.membres.length > 1);
    el.innerHTML = `${mine ? '' : avatar(m.auteur_id, m.auteur_nom, 'petit')}<div>${group ? `<div class="bulle-auteur">${esc(m.auteur_nom)}</div>` : ''}<div class="bulle"></div>${attachmentHtml(m)}<div class="bulle-meta">${esc(fmt.time.format(d))}</div></div>`;
    $('.bulle', el).textContent = m.contenu;
    if (!m.contenu) $('.bulle', el).remove();
    feed.append(el);
  }
  feed.scrollTop = feed.scrollHeight;
  feed.dataset.jour = day;
  return day;
}

function onDirectMessage(m) {
  const c = state.convs.find((x) => x.id === m.conversation_id);
  const viewing = ((state.view === 'conversation' && state.convId === m.conversation_id) || teamChatOpen(m.conversation_id)) && !$('#ecran-app').hidden;
  if (viewing) {
    appendDM(m, $('#fil-dm')?.dataset.jour || null);
    api(`/conversations/${m.conversation_id}/lu`, { method: 'POST' }).catch(() => {});
  }
  if (!c) { loadConversations(); }
  else {
    c.dernier = m;
    if (!viewing && m.auteur_id !== state.me.id) c.non_lus += 1;
    state.convs.sort((a, b) => (b.dernier?.cree_le || '').localeCompare(a.dernier?.cree_le || ''));
    updateBadge();
    if (state.view === 'conversation') renderConvList();
    if (c.classe_id) {
      renderTeamList();
      const tab = !viewing && c.classe_id === state.teamId && $('[data-onglet="clavardage"]');
      if (tab && !$('.non-lu-point', tab)) tab.insertAdjacentHTML('beforeend', '<span class="non-lu-point"></span>');
    }
  }
  if (!viewing && m.auteur_id !== state.me.id) {
    const label = m.type === 'appel' ? t('appel_lance_par', { nom: m.auteur_nom }) : t('nouveau_message_de', { nom: m.auteur_nom });
    toast(label, m.type === 'appel'
      ? { label: t('rejoindre_reunion'), run: () => joinCall(m.conversation_id) }
      : { label: t('ouvrir'), run: () => (c?.classe_id ? openTeamChat(c.classe_id) : showView('conversation', { convId: m.conversation_id })) });
  }
}

/** Lancer un appel (vidéo ou audio) dans la conversation, ou rejoindre l'appel en cours. */
async function startCall(convId, video, rejoindre = false) {
  try {
    const reponse = await api(`/conversations/${convId}/appel`, { method: 'POST', body: { rejoindre, camera: video, micro: true } });
    await openVisio(reponse, { titre: t(video ? 'appel_video' : 'appel_audio'), ref: { conversation_id: convId } });
  } catch (err) { toast(err.message); }
}
const joinCall = (convId) => startCall(convId, true, true);

$('#btn-nouvelle-conv').addEventListener('click', () => {
  const picker = createPicker($('#choix-conv'), loadContacts, () => { $('#champ-nom-groupe').hidden = picker.ids().length < 2; });
  picker.setExclude([state.me.id]);
  openDialog('dlg-nouvelle-conv', async (values) => {
    const ids = picker.ids();
    if (!ids.length) throw new Error(t('choisir_personne'));
    const c = await api('/conversations', { method: 'POST', body: { ids, nom: ids.length > 1 ? values.nom : '' } });
    await loadConversations();
    showView('conversation', { convId: c.id });
  }, () => { $('#champ-nom-groupe').hidden = true; });
});

async function loadContacts() {
  if (!state.contacts) state.contacts = await api('/conversations/contacts');
  return state.contacts;
}

/** Écrire à quelqu'un depuis la liste des membres d'une équipe. */
async function writeTo(userId) {
  try {
    const c = await api('/conversations', { method: 'POST', body: { ids: [userId] } });
    await loadConversations();
    showView('conversation', { convId: c.id });
  } catch (err) { toast(err.message); }
}

// ---------- Choix de personnes ----------
const directory = { orgId: null, people: [] };
async function loadDirectory() {
  if (directory.orgId !== state.org.id) {
    directory.people = await api(`/espaces/${state.org.id}/annuaire`);
    directory.orgId = state.org.id;
  }
  return directory.people;
}
async function teamMemberIds(teamId) {
  const d = await api(`/classes/${teamId}`);
  return [d.responsable.id, ...d.membres.map((m) => m.id)];
}

/** Champ de recherche avec puces. source() renvoie la liste des personnes proposées. */
function createPicker(root, source, onChange = () => {}) {
  const picker = { selected: new Map(), exclude: new Set(), people: [] };
  root.innerHTML = `
    <div class="choix-selection"></div>
    <input type="search" class="choix-recherche" autocomplete="off" placeholder="${esc(t('rechercher_personne'))}" aria-label="${esc(t('rechercher_personne'))}">
    <ul class="choix-resultats"></ul>`;
  const input = $('.choix-recherche', root);
  const results = $('.choix-resultats', root);
  const chips = $('.choix-selection', root);
  source().then((people) => { picker.people = people; renderResults(); }).catch(() => {});

  const renderChips = () => {
    chips.innerHTML = [...picker.selected.values()].map((p) => `<span class="puce-personne">${esc(p.nom)}<button type="button" data-enlever="${p.id}" aria-label="${esc(t('retirer_nom', { nom: p.nom }))}">×</button></span>`).join('');
    onChange();
  };
  function renderResults() {
    if (document.activeElement !== input) { results.innerHTML = ''; return; }
    const q = input.value.trim().toLowerCase();
    const list = picker.people.filter((p) => !picker.selected.has(p.id) && !picker.exclude.has(p.id))
      .filter((p) => !q || p.nom.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)).slice(0, 6);
    results.innerHTML = list.length
      ? list.map((p) => `<li><button type="button" data-choisir="${p.id}">${avatarP(p.id, p.nom, 'petit')}<span><strong>${esc(p.nom)}</strong><small dir="ltr">${esc(p.email)}</small></span></button></li>`).join('')
      : `<li class="choix-vide">${t(picker.people.length ? 'aucune_personne' : 'aucun_contact')}</li>`;
  }
  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('blur', () => setTimeout(renderResults, 150));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('[data-choisir]', results)?.click(); } });
  results.addEventListener('mousedown', (e) => e.preventDefault());
  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-choisir]');
    if (!b) return;
    const person = picker.people.find((p) => p.id === Number(b.dataset.choisir));
    picker.selected.set(person.id, person);
    input.value = '';
    renderChips(); renderResults();
  });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-enlever]');
    if (!b) return;
    picker.selected.delete(Number(b.dataset.enlever));
    renderChips();
  });
  picker.ids = () => [...picker.selected.keys()];
  picker.setExclude = (ids) => { picker.exclude = new Set(ids); ids.forEach((id) => picker.selected.delete(id)); renderChips(); renderResults(); };
  return picker;
}

// ---------- Dialogues ----------
function openDialog(id, onSubmit, prepare) {
  const dlg = $(`#${id}`);
  const form = $('form', dlg);
  form.reset();
  $('.erreur', dlg).textContent = '';
  prepare?.(form);
  dlg.showModal();
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('[type=submit]', form);
    button.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      dlg.close();
    } catch (err) {
      $('.erreur', dlg).textContent = err.garder ? '' : err.message;
    } finally { button.disabled = false; }
  };
}
$$('[data-fermer]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

// Actions partagées (délégation)
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-copier], [data-copier-lien], [data-retirer], [data-ecrire], [data-avant], [data-reunion], [data-ouvrir-code], [data-rejoindre-appel], [data-supprimer-seance], [data-terminer-seance]');
  if (!el) return;
  if (el.dataset.copier) copy(el.dataset.copier, 'code_copie');
  else if (el.dataset.copierLien) copy(inviteLink(el.dataset.copierLien), 'lien_copie');
  else if (el.dataset.retirer) removeMember(Number(el.dataset.retirer));
  else if (el.dataset.ecrire) writeTo(Number(el.dataset.ecrire));
  else if (el.dataset.avant) { $('#dlg-reunion').open && $('#dlg-reunion').close(); showPrejoin(Number(el.dataset.avant)); }
  else if (el.dataset.reunion) openMeetingDetail(Number(el.dataset.reunion));
  else if (el.dataset.rejoindreAppel) joinCall(Number(el.dataset.rejoindreAppel));
  else if (el.dataset.supprimerSeance) deleteMeeting(Number(el.dataset.supprimerSeance));
  else if (el.dataset.terminerSeance) endMeeting(Number(el.dataset.terminerSeance));
  else if ('ouvrirCode' in el.dataset) openDialog('dlg-code', joinWithCode);
});

async function removeMember(userId) {
  if (!confirm(t('confirmer_retrait_equipe'))) return;
  try {
    await api(`/classes/${state.teamId}/membres/${userId}`, { method: 'DELETE' });
    state.detail = await api(`/classes/${state.teamId}`);
    renderTeam();
    toast(t('retire_equipe'));
  } catch (err) { toast(err.message); }
}

async function endMeeting(id) {
  if (!confirm(t('confirmer_fin_reunion'))) return;
  try {
    await api(`/seances/${id}/terminer`, { method: 'POST' });
    checkVisio(); // ferme aussi la visio si elle est ouverte
    if ($('#dlg-reunion').open) $('#dlg-reunion').close();
    toast(t('reunion_terminee_ok'));
    loadMeetings();
    if (state.view === 'agenda') loadCalendar();
  } catch (err) { toast(err.message); }
}

async function deleteMeeting(id) {
  if (!confirm(t('confirmer_suppr_reunion'))) return;
  try {
    await api(`/seances/${id}`, { method: 'DELETE' });
    $('#dlg-reunion').close();
    toast(t('reunion_supprimee'));
    loadMeetings();
    if (state.view === 'agenda') loadCalendar();
  } catch (err) { toast(err.message); }
}

// ---------- Calendrier ----------
const HOUR_PX = 56;
const cal = { mode: matchMedia('(max-width: 860px)').matches ? 'jour' : 'semaine', ref: new Date(), meetings: [], key: null };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Premier jour de la semaine : samedi en arabe (Algérie), lundi sinon.
const weekStart = (d) => { const first = window.NADWA_LANGUE === 'ar' ? 6 : 1; const x = startOfDay(d); return addDays(x, -((x.getDay() - first + 7) % 7)); };

function calRange() {
  if (cal.mode === 'jour') { const d = startOfDay(cal.ref); return [d, addDays(d, 1)]; }
  if (cal.mode === 'semaine') { const d = weekStart(cal.ref); return [d, addDays(d, 7)]; }
  const d = weekStart(new Date(cal.ref.getFullYear(), cal.ref.getMonth(), 1));
  return [d, addDays(d, 42)];
}
function calLabel([from, to]) {
  const { locale } = langue();
  if (cal.mode === 'mois') return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cal.ref);
  if (cal.mode === 'jour') return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(from);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(from, addDays(to, -1));
}
function calMove(step) {
  if (cal.mode === 'jour') cal.ref = addDays(cal.ref, step);
  else if (cal.mode === 'semaine') cal.ref = addDays(cal.ref, 7 * step);
  else cal.ref = new Date(cal.ref.getFullYear(), cal.ref.getMonth() + step, 1);
  loadCalendar();
}

async function loadCalendar() {
  const zone = $('#calendrier');
  const range = calRange();
  const key = `${cal.mode}|${range[0].toISOString()}`;
  const keepScroll = cal.key === key ? $('#cal-defilement')?.scrollTop : null;
  cal.key = key;
  const modes = { jour: t('vue_jour'), semaine: t('vue_semaine'), mois: t('vue_mois') };
  zone.innerHTML = `
    <header class="cal-barre">
      <h1>${t('agenda')}</h1>
      <button class="btn btn-contour" id="cal-aujourdhui">${t('cal_aujourdhui')}</button>
      <button class="cal-fleche" id="cal-prec" aria-label="${esc(t('cal_precedent'))}">${ICONES.gauche}</button>
      <button class="cal-fleche" id="cal-suiv" aria-label="${esc(t('cal_suivant'))}">${ICONES.droite}</button>
      <span class="cal-periode">${esc(calLabel(range))}</span>
      <span class="cal-espace"></span>
      <div class="cal-vues" role="group" aria-label="${esc(t('cal_vues'))}">${Object.entries(modes).map(([k, v]) => `<button data-cal-vue="${k}" aria-pressed="${cal.mode === k}">${v}</button>`).join('')}</div>
      <button class="btn btn-contour" id="cal-maintenant">${ICONES.video}<span>${t('reunion_maintenant')}</span></button>
      <button class="btn btn-accent" id="cal-nouvelle">${ICONES.plus}<span>${t('nouvelle_reunion')}</span></button>
    </header>
    <div class="cal-corps"><div class="cal-carte" id="cal-carte"><p class="chargement">${t('chargement')}</p></div></div>`;
  $('#cal-aujourdhui').addEventListener('click', () => { cal.ref = new Date(); loadCalendar(); });
  $('#cal-prec').addEventListener('click', () => calMove(-1));
  $('#cal-suiv').addEventListener('click', () => calMove(1));
  $$('[data-cal-vue]').forEach((b) => b.addEventListener('click', () => { cal.mode = b.dataset.calVue; loadCalendar(); }));
  $('#cal-maintenant').addEventListener('click', () => openScheduler({ mode: 'maintenant' }));
  $('#cal-nouvelle').addEventListener('click', () => openScheduler());
  try {
    cal.meetings = await api(`/agenda?espace=${state.org.id}&du=${range[0].toISOString()}&au=${range[1].toISOString()}`);
    if (state.view !== 'agenda') return;
    if (cal.mode === 'mois') renderMonth(range); else renderTimeGrid(range, keepScroll);
  } catch (err) { $('#cal-carte').innerHTML = `<p class="chargement">${esc(err.message)}</p>`; }
}

/** Réunions qui se chevauchent : côte à côte. */
function layoutDay(meetings) {
  const items = meetings.map((m) => { const s = new Date(m.debut); const start = s.getHours() * 60 + s.getMinutes(); return { m, start, end: start + m.duree_min }; })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = []; let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const it of cluster) { let lane = lanes.findIndex((end) => end <= it.start); if (lane === -1) { lane = lanes.length; lanes.push(0); } lanes[lane] = it.end; it.lane = lane; }
    cluster.forEach((it) => { it.lanes = lanes.length; });
    cluster = [];
  };
  for (const it of items) { if (it.start >= clusterEnd && cluster.length) flush(); cluster.push(it); clusterEnd = Math.max(clusterEnd, it.end); }
  if (cluster.length) flush();
  return items;
}

function renderTimeGrid([from, to], keepScroll) {
  const days = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, h) => { const d = new Date(from); d.setHours(h, 0, 0, 0); return fmt.time.format(d); });
  const carte = $('#cal-carte');
  carte.innerHTML = `
    <div class="cal-semaine" id="cal-semaine">
      <div class="cal-entetes"><div></div>
        ${days.map((d) => `<button class="cal-jour-entete${sameDay(d, today) ? ' aujourdhui' : ''}" data-jour="${d.toISOString()}"><span>${esc(fmt.weekdayLong.format(d))}</span><strong>${d.getDate()}</strong></button>`).join('')}
      </div>
      <div class="cal-defilement" id="cal-defilement"><div class="cal-grille-heures">
        <div class="cal-heures">${hours.map((h) => `<span>${h}</span>`).join('')}</div>
        ${days.map((d) => `<div class="cal-colonne${sameDay(d, today) ? ' aujourdhui' : ''}" data-jour="${d.toISOString()}"></div>`).join('')}
      </div></div>
    </div>`;
  $('#cal-semaine').style.setProperty('--jours', days.length);
  $$('.cal-colonne', carte).forEach((col) => {
    const day = new Date(col.dataset.jour);
    for (const it of layoutDay(cal.meetings.filter((m) => sameDay(new Date(m.debut), day)))) {
      const m = it.m;
      const el = document.createElement('button');
      el.className = `cal-evt ${m.etat}`;
      el.dataset.reunion = m.id;
      el.style.setProperty('--teinte', hue(m.classe_id));
      el.style.top = `${(it.start / 60) * HOUR_PX + 1}px`;
      el.style.height = `${Math.max(((Math.min(it.end, 1440) - it.start) / 60) * HOUR_PX - 3, 24)}px`;
      el.style.insetInlineStart = `${(it.lane / it.lanes) * 100}%`;
      el.style.width = `calc(${100 / it.lanes}% - 8px)`;
      el.innerHTML = `<strong></strong><span>${m.etat === 'en_direct' ? esc(t('etat_en_direct')) : `${esc(fmt.time.format(new Date(m.debut)))} – ${esc(fmt.time.format(meetingEnd(m)))}`}</span>`;
      $('strong', el).textContent = m.titre;
      col.append(el);
    }
    if (sameDay(day, today)) {
      const line = document.createElement('div');
      line.className = 'cal-maintenant';
      line.style.top = `${((today.getHours() * 60 + today.getMinutes()) / 60) * HOUR_PX}px`;
      col.append(line);
    }
    col.addEventListener('click', (e) => {
      if (e.target !== col) return;
      const minutes = Math.floor((e.offsetY / HOUR_PX) * 2) * 30;
      const debut = new Date(day); debut.setHours(0, minutes, 0, 0);
      openScheduler({ debut });
    });
  });
  $$('.cal-jour-entete', carte).forEach((h) => h.addEventListener('click', () => { cal.ref = new Date(h.dataset.jour); cal.mode = 'jour'; loadCalendar(); }));
  const showsToday = days.some((d) => sameDay(d, today));
  $('#cal-defilement').scrollTop = keepScroll ?? (showsToday ? Math.max(today.getHours() - 2, 0) : 7.5) * HOUR_PX;
}

function renderMonth([from]) {
  const today = new Date();
  const month = cal.ref.getMonth();
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const carte = $('#cal-carte');
  carte.innerHTML = `<div class="cal-mois">
    ${days.slice(0, 7).map((d) => `<div class="cal-mois-entete">${esc(fmt.weekday.format(d))}</div>`).join('')}
    ${days.map((d) => {
      const list = cal.meetings.filter((m) => sameDay(new Date(m.debut), d));
      return `<div class="cal-case${d.getMonth() !== month ? ' hors-mois' : ''}${sameDay(d, today) ? ' aujourdhui' : ''}" data-jour="${d.toISOString()}">
        <button class="cal-num" data-ouvrir-jour="${d.toISOString()}">${d.getDate()}</button>
        ${list.slice(0, 3).map((m) => `<button class="cal-puce" data-reunion="${m.id}" data-teinte="${hue(m.classe_id)}"><b>${esc(fmt.time.format(new Date(m.debut)))}</b> ${esc(m.titre)}</button>`).join('')}
        ${list.length > 3 ? `<button class="cal-plus" data-ouvrir-jour="${d.toISOString()}">${t('plus_n', { n: list.length - 3 })}</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
  $$('[data-ouvrir-jour]', carte).forEach((b) => b.addEventListener('click', () => { cal.ref = new Date(b.dataset.ouvrirJour); cal.mode = 'jour'; loadCalendar(); }));
  $$('.cal-case', carte).forEach((c) => c.addEventListener('click', (e) => {
    if (e.target !== c) return;
    const debut = new Date(c.dataset.jour); debut.setHours(9, 0, 0, 0);
    openScheduler({ debut });
  }));
}

// ---------- Fiche d'une réunion ----------
function findMeeting(id) { return cal.meetings.find((x) => x.id === id) || state.meetings.find((x) => x.id === id); }

function openMeetingDetail(id) {
  const m = findMeeting(id);
  if (!m) return;
  const host = canHost(m);
  const canJoin = m.etat === 'en_direct' || (host && m.etat === 'a_venir');
  const dlg = $('#dlg-reunion');
  $('.dlg-corps', dlg).innerHTML = `
    <div class="reunion-entete">${avatar(m.classe_id, m.classe_nom, 'carre grand')}
      <div><h2></h2><p>${esc(m.classe_nom)}${m.acces_equipe === 0 ? ` <span class="badge">${t('vous_etes_invite')}</span>` : ''}</p></div></div>
    <dl class="infos">
      <div><dt>${t('quand')}</dt><dd>${esc(whenRange(new Date(m.debut), meetingEnd(m)))}</dd></div>
      ${m.organisateur_nom ? `<div><dt>${t('organisateur')}</dt><dd>${esc(m.organisateur_nom)}</dd></div>` : ''}
      <div><dt>${t('etat')}</dt><dd><span class="etat ${m.etat}">${stateLabel(m.etat)}</span></dd></div>
    </dl>
    <section class="bloc" id="reunion-participants"><p class="note">${t('chargement')}</p></section>
    <section class="bloc" id="reunion-lien" hidden></section>
    <div class="dlg-actions">
      ${host ? `<button class="btn-discret" data-supprimer-seance="${m.id}">${t('supprimer')}</button>` : ''}
      ${canEnd(m) && m.etat === 'en_direct' ? `<button class="btn btn-contour" data-terminer-seance="${m.id}">${t('terminer_reunion')}</button>` : ''}
      ${m.acces_equipe === 0 ? '' : `<button class="btn btn-contour" id="reunion-equipe">${t('ouvrir_equipe')}</button>`}
      ${canJoin ? `<button class="btn ${m.etat === 'en_direct' ? 'btn-soleil' : 'btn-accent'}" data-avant="${m.id}">${t(m.etat === 'en_direct' ? 'rejoindre_reunion' : 'demarrer')}</button>` : ''}
    </div>
    <button type="button" class="btn-lien dlg-fermer" id="reunion-fermer">${t('fermer')}</button>`;
  $('h2', dlg).textContent = m.titre;
  $('#reunion-fermer').addEventListener('click', () => dlg.close());
  $('#reunion-equipe')?.addEventListener('click', () => { dlg.close(); showView('classes', { teamId: m.classe_id }); });
  dlg.showModal();
  loadParticipants(m);
}

async function loadParticipants(m) {
  const zone = $('#reunion-participants');
  try {
    const p = await api(`/seances/${m.id}/participants`);
    if (!$('#dlg-reunion').open) return;
    zone.innerHTML = `
      <h3>${t('participants')}</h3>
      <p class="note">${esc(t('toute_equipe', { equipe: p.equipe.nom, n: p.equipe.membres.length }))}</p>
      ${p.invites.length ? `<div class="choix-selection">${p.invites.map((x) => `<span class="puce-personne">${esc(x.nom)}${p.peutModifier ? `<button type="button" data-retirer-invite="${x.id}" aria-label="${esc(t('retirer_nom', { nom: x.nom }))}">×</button>` : ''}</span>`).join('')}</div>` : ''}
      ${p.peutModifier ? `<button class="btn btn-contour a-gauche" id="btn-ajout-participants">${ICONES.inviter}<span>${t('ajouter_participants')}</span></button>` : ''}`;
    $$('[data-retirer-invite]', zone).forEach((b) => b.addEventListener('click', async () => {
      try { await api(`/seances/${m.id}/participants/${b.dataset.retirerInvite}`, { method: 'DELETE' }); loadParticipants(m); refreshMeetingViews(); }
      catch (err) { toast(err.message); }
    }));
    $('#btn-ajout-participants')?.addEventListener('click', () => openAddParticipants(m, p, () => loadParticipants(m)));
    const lien = $('#reunion-lien');
    if (p.jeton && m.etat !== 'terminee') {
      lien.hidden = false;
      lien.innerHTML = `<h3>${t('lien_invitation')}</h3>
        <div class="lien-ligne"><input readonly dir="ltr" value="${esc(inviteLink(p.jeton))}" aria-label="${esc(t('lien_invitation'))}"><button type="button" class="btn btn-contour" data-copier-lien="${esc(p.jeton)}">${t('copier_lien')}</button></div>
        <p class="note">${t('note_lien')}</p>`;
    }
  } catch (err) { zone.innerHTML = `<p class="note">${esc(err.message)}</p>`; }
}

function openAddParticipants(m, current, after) {
  const picker = createPicker($('#choix-ajout'), loadDirectory);
  picker.setExclude([state.me.id, ...current.equipe.membres.map((x) => x.id), ...current.invites.map((x) => x.id)]);
  openDialog('dlg-participants', async () => {
    const ids = picker.ids();
    if (!ids.length) throw new Error(t('choisir_personne'));
    await api(`/seances/${m.id}/participants`, { method: 'POST', body: { ids } });
    toast(t('participants_ajoutes'));
    after?.();
    refreshMeetingViews();
  });
}

function refreshMeetingViews() {
  if (state.view === 'agenda') loadCalendar();
  if (state.teamId) loadMeetings();
}

// ---------- Gestion de l'organisation ----------
async function loadManage() {
  $('#gestion-titre').textContent = orgName(state.org);
  try {
    const [org, stats, people] = await Promise.all([api(`/espaces/${state.org.id}`), api(`/espaces/${state.org.id}/stats`), api(`/espaces/${state.org.id}/membres`)]);
    $('#gestion-invitation').innerHTML = `
      <div><span class="invitation-libelle">${t('code_org')}</span><strong class="code">${esc(org.code_invitation)}</strong></div>
      <p>${t('note_code_org')}</p>
      <button class="btn btn-contour" data-copier="${esc(org.code_invitation)}">${t('copier_code')}</button>`;
    $('#gestion-stats').innerHTML = [[t('stat_membres'), stats.membre], [t('stat_admins'), stats.admin], [t('stat_equipes'), stats.groupes], [t('stat_reunions_venir'), stats.seances_a_venir]]
      .map(([label, n]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
    $('#gestion-membres').innerHTML = `<table>
      <thead><tr><th>${t('col_nom')}</th><th>${t('col_email')}</th><th>${t('col_role')}</th><th>${t('col_rejoint')}</th><th><span class="sr">${t('actions')}</span></th></tr></thead>
      <tbody>${people.map((p) => `<tr>
        <td>${esc(p.nom)}</td><td dir="ltr">${esc(p.email)}</td>
        <td>${p.id === state.me.id ? roleLabel(p.role) : `<select data-role-pour="${p.id}" aria-label="${esc(t('role_de', { nom: p.nom }))}">${['membre', 'admin'].map((k) => `<option value="${k}" ${k === p.role ? 'selected' : ''}>${roleLabel(k)}</option>`).join('')}</select>`}</td>
        <td>${esc(fmt.date.format(new Date(p.rejoint_le)))}</td>
        <td>${p.id === state.me.id ? '' : `<button class="btn-discret" data-retirer-espace="${p.id}">${t('retirer')}</button>`}</td>
      </tr>`).join('')}</tbody></table>`;
    $$('[data-role-pour]').forEach((sel) => sel.addEventListener('change', async () => {
      try { await api(`/espaces/${state.org.id}/membres/${sel.dataset.rolePour}`, { method: 'PATCH', body: { role: sel.value } }); toast(t('role_maj')); }
      catch (err) { toast(err.message); loadManage(); }
    }));
    $$('[data-retirer-espace]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(t('confirmer_retrait_org'))) return;
      try { await api(`/espaces/${state.org.id}/membres/${b.dataset.retirerEspace}`, { method: 'DELETE' }); toast(t('retire_org')); loadManage(); }
      catch (err) { toast(err.message); }
    }));
  } catch (err) { toast(err.message); }
}
$('#btn-ajouter-membre').addEventListener('click', () => openDialog('dlg-membre', async (values) => {
  const r = await api(`/espaces/${state.org.id}/membres`, { method: 'POST', body: values });
  toast(t(r.compte_existant ? 'ajoute_org' : 'compte_cree_mdp'));
  state.contacts = null;
  loadManage();
}));

// ---------- Plateforme (exploitant) ----------
async function loadPlatform() {
  try {
    const { stats, espaces, comptes, capacite, qualite, retours } = await api('/plateforme');
    renderAccounts(comptes);
    renderCapacity(capacite);
    renderQuality(qualite);
    renderFeedback(retours);
    $('#plateforme-stats').innerHTML = [[t('stat_orgs'), stats.espaces], [t('stat_comptes'), stats.utilisateurs], [t('stat_equipes'), stats.groupes], [t('stat_reunions'), stats.seances]]
      .map(([label, n]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
    $('#plateforme-espaces').innerHTML = `<table>
      <thead><tr><th>${t('col_org')}</th><th>${t('col_personnes')}</th><th>${t('col_equipes')}</th><th>${t('col_creee')}</th></tr></thead>
      <tbody>${espaces.map((o) => `<tr><td>${esc(o.personnel ? `${o.nom} (${t('mon_espace')})` : o.nom)}</td><td>${o.nb_membres}</td><td>${o.nb_groupes}</td><td>${esc(fmt.date.format(new Date(o.cree_le)))}</td></tr>`).join('')}</tbody></table>`;
  } catch (err) { toast(err.message); }
}

function renderAccounts(c) {
  const jours = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    jours.push({ d, n: c.par_jour.find((x) => x.jour === d)?.n || 0 });
  }
  const max = Math.max(1, ...jours.map((j) => j.n));
  const W = 600; const H = 110; const bw = W / jours.length;
  const y = (n) => H - (n / max) * H;
  const barres = jours.map((j, i) => `<rect x="${i * bw + 1}" y="${y(j.n)}" width="${bw - 2}" height="${H - y(j.n)}" rx="2" class="b-ok"><title>${esc(fmt.date.format(new Date(j.d)))} : ${j.n}</title></rect>`).join('');
  const quand = (iso) => (iso ? esc(fmt.date.format(new Date(iso))) : '—');
  $('#plateforme-comptes').innerHTML = `
    <h2 class="sous-titre">${t('utilisateurs')}</h2>
    <div class="stats">
      <div class="stat"><strong>${c.total}</strong><span>${t('u_total')}</span></div>
      <div class="stat"><strong>${c.actifs.semaine}</strong><span>${t('u_actifs_7j')} · ${t('u_actifs_jour', { n: c.actifs.jour })}</span></div>
      <div class="stat"><strong>${c.actifs.mois}</strong><span>${t('u_actifs_30j')}</span></div>
      <div class="stat"><strong>+${c.nouveaux.semaine}</strong><span>${t('u_nouveaux_7j')} · ${t('u_nouveaux_30j', { n: c.nouveaux.mois })}</span></div>
    </div>
    <div class="stats">
      <div class="stat"><strong>${c.verifies}</strong><span>${t('u_verifies')}</span></div>
      <div class="stat"><strong>${c.total - c.verifies}</strong><span>${t('u_non_verifies')}</span></div>
      <div class="stat"><strong>${c.sans_organisation}</strong><span>${t('u_sans_org')}</span></div>
    </div>
    <div class="carte-capacite">
      <p><strong>${t('u_graphe')}</strong></p>
      <svg viewBox="0 0 ${W} ${H + 4}" class="graphe-capacite" role="img" aria-label="${esc(t('u_graphe'))}">${barres}</svg>
      <p class="note">${t('u_note')}</p>
    </div>
    <h3 class="sous-titre">${t('u_derniers')}</h3>
    <div class="tableau"><table><thead><tr><th>${t('col_personne')}</th><th>${t('u_inscrit_le')}</th><th>${t('u_derniere_activite')}</th><th>${t('u_email_verifie')}</th></tr></thead><tbody>
      ${c.derniers.map((u) => `<tr><td>${esc(u.nom)}<br><small dir="ltr">${esc(u.email)}</small></td><td>${quand(u.cree_le)}</td><td>${quand(u.derniere_activite)}</td><td>${u.email_verifie ? '✓' : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function renderCapacity(c) {
  const pct = (n) => Math.round(((n || 0) / c.seuil) * 100);
  const picMois = c.mois.participants || 0;
  const niveau = pct(picMois) >= 70 ? 'alerte' : pct(picMois) >= 50 ? 'attention' : 'ok';
  const jours = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    jours.push({ d, n: c.par_jour.find((x) => x.jour === d)?.participants || 0 });
  }
  const max = Math.max(c.seuil, ...jours.map((j) => j.n));
  const W = 600; const H = 140; const bw = W / jours.length;
  const y = (n) => H - (n / max) * H;
  const barres = jours.map((j, i) => `<rect x="${i * bw + 1}" y="${y(j.n)}" width="${bw - 2}" height="${H - y(j.n)}" rx="2" class="${pct(j.n) >= 70 ? 'b-alerte' : 'b-ok'}"><title>${esc(fmt.date.format(new Date(j.d)))} : ${j.n}</title></rect>`).join('');
  const seuil70 = y(c.seuil * 0.7);
  $('#plateforme-capacite').innerHTML = `
    <h2 class="sous-titre">${t('capacite')}</h2>
    <div class="stats">
      <div class="stat"><strong>${c.maintenant.participants}</strong><span>${t('cap_en_visio')}</span></div>
      <div class="stat"><strong>${c.maintenant.reunions}</strong><span>${t('cap_reunions_cours')}</span></div>
      <div class="stat"><strong>${c.semaine.participants || 0}</strong><span>${t('cap_pic_semaine')}</span></div>
      <div class="stat"><strong>${picMois} <small>/ ${c.seuil}</small></strong><span>${t('cap_pic_mois')} · ${pct(picMois)} %</span></div>
    </div>
    <div class="carte-capacite ${niveau}">
      <p><strong>${t(`cap_conseil_${niveau}`)}</strong></p>
      <svg viewBox="0 0 ${W} ${H + 4}" class="graphe-capacite" role="img" aria-label="${esc(t('cap_graphe'))}">
        ${barres}
        <line x1="0" x2="${W}" y1="${seuil70}" y2="${seuil70}" class="ligne-seuil"/>
        <text x="${W - 4}" y="${seuil70 - 4}" text-anchor="end" class="texte-seuil">70 %</text>
      </svg>
      <p class="note">${t('cap_note', { seuil: c.seuil })}</p>
    </div>`;
}

function renderQuality(q) {
  const libelle = (p) => t(`probleme_${p}`);
  const moyenne = q.moyenne ? new Intl.NumberFormat(langue().locale, { maximumFractionDigits: 1 }).format(q.moyenne) : '—';
  $('#plateforme-qualite').innerHTML = `
    <h2 class="sous-titre">${t('qualite_reunions')}</h2>
    <div class="stats">
      <div class="stat"><strong>${moyenne} <small>/ 5</small></strong><span>${t('note_moyenne_30j')}</span></div>
      <div class="stat"><strong>${q.n}</strong><span>${t('nb_evaluations_30j')}</span></div>
      ${Object.entries(q.problemes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p, n]) => `<div class="stat"><strong>${n}</strong><span>${esc(libelle(p))}</span></div>`).join('')}
    </div>
    ${q.commentaires.length ? `<div class="tableau"><table><thead><tr><th>${t('note')}</th><th>${t('commentaire')}</th><th>${t('col_personne')}</th><th>${t('col_date')}</th></tr></thead><tbody>
      ${q.commentaires.map((c) => `<tr><td>${'★'.repeat(c.note)}</td><td>${esc(c.commentaire)}${c.problemes ? `<br><small>${esc(c.problemes.split(',').map(libelle).join(', '))}</small>` : ''}</td><td>${esc(c.nom || '—')}</td><td>${esc(fmt.date.format(new Date(c.cree_le)))}</td></tr>`).join('')}
    </tbody></table></div>` : ''}`;
}

function renderFeedback(retours) {
  $('#plateforme-retours').innerHTML = `
    <h2 class="sous-titre">${t('retours_utilisateurs')}</h2>
    ${retours.length ? `<div class="tableau"><table><thead><tr><th>${t('type')}</th><th>${t('message')}</th><th>${t('col_personne')}</th><th>${t('col_date')}</th></tr></thead><tbody>
      ${retours.map((r) => `<tr><td><span class="badge">${esc(t(`retour_${r.type}`))}</span></td><td class="texte-long">${esc(r.message)}</td><td>${esc(r.nom || '—')}<br><small dir="ltr">${esc(r.email || '')}</small></td><td>${esc(fmt.date.format(new Date(r.cree_le)))}</td></tr>`).join('')}
    </tbody></table></div>` : `<p class="note">${t('aucun_retour')}</p>`}`;
}

// ---------- Profil ----------
function openProfile() {
  openDialog('dlg-profil', async (values) => {
    const { utilisateur } = await api('/auth/moi', { method: 'PATCH', body: values });
    state.me = { ...state.me, ...utilisateur };
    $('#btn-moi').innerHTML = `${esc(initials(utilisateur.nom))}${presenceDot(utilisateur.id)}`;
    toast(t('profil_maj'));
  }, (form) => { form.nom.value = state.me.nom; });
}

// Supprimer son compte : mot de passe demandé, puis retour à l'accueil.
$('#btn-supprimer-compte').addEventListener('click', () => {
  $('#dlg-profil').close();
  openDialog('dlg-supprimer-compte', async ({ mot_de_passe }) => {
    await api('/auth/moi', { method: 'DELETE', body: { mot_de_passe } });
    location.replace('/');
  });
});

// ---------- Lancement ----------
/** Jeton d'invitation dans l'adresse : /r/<jeton> (ou #/r/<jeton>). */
const tokenInUrl = () => (location.pathname.match(/^\/r\/([\w-]{12,})/) || location.hash.match(/^#\/r\/([\w-]{12,})/) || [])[1] || null;

function launch() {
  const jeton = tokenInUrl();
  if (jeton) return showGuest(jeton);
  const reset = resetTokenInUrl();
  if (reset) return showReset(reset);
  const verif = verifyTokenInUrl();
  if (verif) return confirmEmail(verif);
  api('/auth/moi')
    .then(start)
    .catch(() => { showScreen('ecran-auth'); setAuthMode('connexion'); });
}
window.addEventListener('hashchange', () => {
  if (tokenInUrl()) showGuest(tokenInUrl());
  else if (resetTokenInUrl()) showReset(resetTokenInUrl());
});
translatePage();
launch();
