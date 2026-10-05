'use strict';

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Langue ----------
// Formats de date selon la langue ; recréés à chaque changement de langue.
const fmt = {};
function buildFormats() {
  const { locale } = window.NADWA_LANGUES.find((l) => l.code === window.NADWA_LANGUE);
  fmt.day = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  fmt.dayShort = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  fmt.weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  fmt.time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' });
  fmt.message = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  fmt.date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

const roleLabel = (role) => t(role === 'admin' ? 'role_admin' : 'role_membre');
const stateLabel = (etat) => t(`etat_${etat}`);
const channelName = (c) => (c.est_general ? t('canal_general') : c.nom);
/** Peut animer (démarrer, supprimer) : organisateur, propriétaire de l'équipe ou administrateur. */
const canHost = (m) => m.organisateur_id === state.me.id || m.responsable_id === state.me.id || state.org?.role === 'admin';

/** Traduit les éléments statiques de la page (attributs data-i18n…). */
function translatePage() {
  const langue = window.NADWA_LANGUES.find((l) => l.code === window.NADWA_LANGUE);
  document.documentElement.lang = langue.code;
  document.documentElement.dir = langue.dir;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$('.choix-langue').forEach((sel) => {
    sel.innerHTML = window.NADWA_LANGUES.map((l) => `<option value="${l.code}" lang="${l.code}">${l.nom}</option>`).join('');
    sel.value = langue.code;
  });
  buildFormats();
}

/** Change de langue et redessine ce qui est affiché. */
function setLanguage(code) {
  window.NADWA_LANGUE = code;
  try { localStorage.setItem('nadwa:langue', code); } catch { /* stockage indisponible */ }
  translatePage();
  state.socket?.emit('langue', code);
  setAuthMode(state.authMode);
  if (!$('#ecran-accueil').hidden) showWelcome();
  if (!$('#ecran-app').hidden && state.org) {
    renderTeamList();
    if (state.detail) renderTeam(); else showEmptyTeam();
    const view = $('.rail-btn[aria-current="page"]')?.dataset.vue;
    if (view && view !== 'classes') showView(view);
  }
}
document.addEventListener('change', (e) => {
  if (e.target.matches('.choix-langue')) setLanguage(e.target.value);
});

const initials = (name) => name.split(/\s+/).filter((w) => /\p{L}/u.test(w[0] || '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const hue = (id) => (id * 67) % 360;
const meetingEnd = (s) => new Date(Date.parse(s.debut) + s.duree_min * 60_000);

// Avatar colours are applied through the CSSOM (the content security policy blocks inline styles).
new MutationObserver(() => {
  $$('[data-teinte]').forEach((el) => {
    el.style.setProperty('--teinte', el.dataset.teinte);
    el.removeAttribute('data-teinte');
  });
}).observe(document.body, { childList: true, subtree: true });

const state = {
  me: null,
  orgs: [],
  org: null,      // current organization { id, nom, role }
  teams: [],
  teamId: null,
  detail: null,
  meetings: [],
  channels: [],
  channelId: null,
  unread: new Set(),  // canaux de l'équipe ouverte avec des messages non lus
  tab: 'chat',
  nextTab: null,
  socket: null,
  authMode: 'connexion',
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Langue': window.NADWA_LANGUE, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty response */ }
  if (!res.ok) throw new Error(data?.erreur || t('erreur_n', { n: res.status }));
  return data;
}

function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove('visible'), 3500);
}

// Remembers the last organization opened on this device.
const lastOrg = {
  get() { try { return Number(localStorage.getItem('nadwa:org')) || null; } catch { return null; } },
  set(id) { try { localStorage.setItem('nadwa:org', String(id)); } catch { /* storage unavailable */ } },
};

function showScreen(id) {
  for (const s of ['ecran-auth', 'ecran-accueil', 'ecran-app']) $(`#${s}`).hidden = s !== id;
}

// ---------- Sign in ----------
function setAuthMode(mode) {
  state.authMode = mode;
  const f = $('#form-auth');
  $$('.bascule button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  $$('[data-inscription]').forEach((el) => { el.hidden = mode !== 'inscription'; });
  f.nom.required = mode === 'inscription';
  f.mot_de_passe.autocomplete = mode === 'inscription' ? 'new-password' : 'current-password';
  $('#auth-soumettre').textContent = t(mode === 'inscription' ? 'creer_compte' : 'se_connecter');
  $('#auth-erreur').textContent = '';
}
$$('.bascule button').forEach((b) => b.addEventListener('click', () => setAuthMode(b.dataset.mode)));

$('#form-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const button = $('#auth-soumettre');
  button.disabled = true;
  $('#auth-erreur').textContent = '';
  try {
    const body = { email: f.email.value, mot_de_passe: f.mot_de_passe.value };
    if (state.authMode === 'inscription') body.nom = f.nom.value;
    const route = state.authMode === 'inscription' ? '/auth/inscription' : '/auth/connexion';
    const result = await api(route, { method: 'POST', body });
    f.reset();
    start(result);
  } catch (err) {
    $('#auth-erreur').textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

$$('[data-deconnexion]').forEach((b) => b.addEventListener('click', async () => {
  await api('/auth/deconnexion', { method: 'POST' }).catch(() => {});
  location.reload();
}));

// ---------- Start ----------
function start({ utilisateur, espaces }) {
  state.me = utilisateur;
  state.orgs = espaces;
  $('#rail-plateforme').hidden = !utilisateur.est_superadmin;
  $('#moi-avatar').textContent = initials(utilisateur.nom);
  $('#moi-nom').textContent = utilisateur.nom;
  $('#moi-email').textContent = utilisateur.email;
  connectSocket();

  if (!espaces.length) return showWelcome();
  const last = lastOrg.get();
  openOrg((espaces.find((o) => o.id === last) || espaces[0]).id);
}

function showWelcome() {
  $('#accueil-titre').textContent = t('bienvenue_nom', { nom: state.me.nom.split(' ')[0] });
  showScreen('ecran-accueil');
}

async function openOrg(orgId, { teamId } = {}) {
  state.org = state.orgs.find((o) => o.id === orgId);
  if (!state.org) return;
  lastOrg.set(orgId);
  state.teamId = null;
  state.detail = null;
  showScreen('ecran-app');

  const switcher = $('#btn-espaces');
  switcher.textContent = initials(state.org.nom);
  switcher.style.setProperty('--teinte', hue(state.org.id));
  $('#rail-gestion').hidden = state.org.role !== 'admin';
  $('#liste-espace-nom').textContent = state.org.nom;

  showView('classes');
  await loadTeams();
  const target = teamId || (matchMedia('(min-width: 801px)').matches && state.teams[0]?.id);
  if (target) openTeam(target);
  else { document.body.classList.remove('classe-ouverte'); showEmptyTeam(); }
}

async function reloadOrgs() {
  state.orgs = await api('/espaces');
}

function connectSocket() {
  if (state.socket) return;
  const socket = io({ withCredentials: true, auth: { langue: window.NADWA_LANGUE } });
  state.socket = socket;
  socket.on('connect', () => { if (state.teamId) socket.emit('classe:rejoindre', state.teamId); });
  socket.on('message:nouveau', (m) => {
    if (m.classe_id !== state.teamId) return;
    if (m.canal_id === state.channelId && state.tab === 'chat') appendMessage(m, true);
    else if (m.auteur_id !== state.me.id) { state.unread.add(m.canal_id); renderTeamList(); }
  });
  socket.on('canaux:maj', ({ classe_id }) => {
    if (classe_id === state.teamId) loadChannels();
  });
  socket.on('seances:maj', ({ classe_id }) => {
    if (!$('#vue-agenda').hidden) loadCalendar();
    if (classe_id === state.teamId) loadMeetings();
  });
}

// ---------- Navigation ----------
function showView(view) {
  for (const v of ['classes', 'agenda', 'gestion', 'plateforme']) $(`#vue-${v}`).hidden = v !== view;
  $$('.rail-btn[data-vue]').forEach((b) => {
    if (b.dataset.vue === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (view === 'agenda') loadCalendar();
  if (view === 'gestion') loadManage();
  if (view === 'plateforme') loadPlatform();
}
$$('.rail-btn[data-vue]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.vue)));

// ---------- Switch organization ----------
$('#btn-espaces').addEventListener('click', () => {
  $('#liste-espaces').innerHTML = state.orgs.map((o) => `
    <li>
      <button class="item-classe" data-espace="${o.id}" ${o.id === state.org?.id ? 'aria-current="true"' : ''}>
        <span class="pastille" data-teinte="${hue(o.id)}" aria-hidden="true">${esc(initials(o.nom))}</span>
        <span class="item-texte"><strong>${esc(o.nom)}</strong><small>${roleLabel(o.role)}</small></span>
      </button>
    </li>`).join('');
  $$('[data-espace]').forEach((b) => b.addEventListener('click', () => {
    $('#dlg-espaces').close();
    openOrg(Number(b.dataset.espace));
  }));
  $('#dlg-espaces').showModal();
});

// ---------- Teams ----------
async function loadTeams() {
  state.teams = await api(`/classes?espace=${state.org.id}`);
  renderTeamList();
}

function renderTeamList() {
  const ul = $('#liste-classes');
  if (!state.teams.length) {
    ul.innerHTML = `<li class="vide-liste">${t('aucune_equipe')}</li>`;
    return;
  }
  ul.innerHTML = state.teams.map((team) => `
    <li>
      <button class="item-classe" data-id="${team.id}" ${team.id === state.teamId ? 'aria-current="true"' : ''}>
        <span class="pastille" data-teinte="${hue(team.id)}" aria-hidden="true">${esc(initials(team.nom))}</span>
        <span class="item-texte"><strong>${esc(team.nom)}</strong><small>${esc(team.module || team.responsable_nom)}</small></span>
        ${team.en_direct ? `<span class="point-direct" title="${t('reunion_en_cours_court')}"></span><span class="sr">${t('reunion_en_cours_court')}</span>` : ''}
      </button>
      ${team.id === state.teamId && state.detail?.classe.id === team.id ? channelList() : ''}
    </li>`).join('');
  $$('.item-classe', ul).forEach((b) => b.addEventListener('click', () => openTeam(Number(b.dataset.id))));
  $$('[data-canal]', ul).forEach((b) => b.addEventListener('click', () => selectChannel(Number(b.dataset.canal))));
  $('#btn-ajouter-canal', ul)?.addEventListener('click', openChannelDialog);
}

function channelList() {
  const owner = state.detail.estResponsable;
  return `
    <ul class="canaux" aria-label="${t('canaux')}">
      ${state.channels.map((c) => `
        <li>
          <button class="canal" data-canal="${c.id}" ${c.id === state.channelId ? 'aria-current="true"' : ''}>
            <span class="canal-nom">${esc(channelName(c))}</span>
            ${c.annonces ? `<span class="canal-tag" title="${t('tag_annonces_info')}">${t('tag_annonces')}</span>` : ''}
            ${state.unread.has(c.id) ? `<span class="non-lu" title="${t('nouveaux_messages')}"></span><span class="sr">${t('nouveaux_messages')}</span>` : ''}
          </button>
        </li>`).join('')}
      ${owner ? `<li><button class="canal canal-ajout" id="btn-ajouter-canal">${t('plus_canal')}</button></li>` : ''}
    </ul>`;
}

function selectChannel(id) {
  state.channelId = id;
  state.unread.delete(id);
  state.tab = 'chat';
  document.body.classList.add('classe-ouverte');
  renderTeamList();
  $$('[data-onglet]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.onglet === 'chat')));
  renderTab();
}

async function loadChannels() {
  const id = state.teamId;
  const channels = await api(`/classes/${id}/canaux`).catch(() => null);
  if (!channels || id !== state.teamId) return;
  state.channels = channels;
  if (!channels.some((c) => c.id === state.channelId)) {
    state.channelId = channels[0]?.id ?? null;
    if (state.tab === 'chat') renderTab();
  }
  renderTeamList();
}

function openChannelDialog() {
  openDialog('dlg-canal', async (values) => {
    const channel = await api(`/classes/${state.teamId}/canaux`, {
      method: 'POST',
      body: { nom: values.nom, description: values.description, annonces: values.annonces === 'on' },
    });
    await loadChannels();
    selectChannel(channel.id);
    toast(t('canal_cree'));
  });
}

async function deleteChannel() {
  const channel = state.channels.find((c) => c.id === state.channelId);
  if (!channel || !confirm(t('confirmer_suppr_canal', { nom: channelName(channel) }))) return;
  try {
    await api(`/canaux/${channel.id}`, { method: 'DELETE' });
    state.channelId = state.channels.find((c) => c.est_general)?.id ?? null;
    await loadChannels();
    renderTab();
    toast(t('canal_supprime'));
  } catch (err) { toast(err.message); }
}

function showEmptyTeam() {
  $('#classe').innerHTML = `
    <div class="vide-classe">
      <p class="vide-titre">${esc(state.org.nom)}</p>
      <p>${t(state.teams.length ? 'choisir_equipe' : 'vide_creer_equipe')}</p>
    </div>`;
}

let openToken = 0;
async function openTeam(id) {
  const token = ++openToken;
  const sameTeam = state.teamId === id;
  if (!sameTeam) {
    state.tab = state.nextTab || 'chat';
    state.unread.clear();
  }
  state.nextTab = null;
  state.teamId = id;
  renderTeamList();
  state.socket?.emit('classe:rejoindre', id);
  try {
    const [detail, meetings, channels] = await Promise.all([
      api(`/classes/${id}`), api(`/classes/${id}/seances`), api(`/classes/${id}/canaux`),
    ]);
    if (token !== openToken) return;
    state.detail = detail;
    state.meetings = meetings;
    state.channels = channels;
    if (!sameTeam || !channels.some((c) => c.id === state.channelId)) state.channelId = channels[0]?.id ?? null;
    renderTeamList();
    renderTeam();
    // Sur ordinateur l'équipe s'affiche tout de suite ; sur téléphone on choisit d'abord un canal.
    if (matchMedia('(min-width: 801px)').matches || state.tab !== 'chat') document.body.classList.add('classe-ouverte');
  } catch (err) {
    toast(err.message);
  }
}

function renderTeam() {
  const { classe: team, estResponsable: isOwner } = state.detail;
  const subtitle = [team.module, t('proprietaire_nom', { nom: team.responsable_nom })].filter(Boolean).join(', ');
  const tabs = { chat: t('onglet_chat'), meetings: t('onglet_reunions'), members: t('onglet_membres') };
  $('#classe').innerHTML = `
    <header class="classe-entete">
      <button class="retour" id="btn-retour" aria-label="${t('retour_equipes')}">‹</button>
      <div>
        <h1>${esc(team.nom)}</h1>
        <p>${esc(subtitle)}</p>
      </div>
      <div class="entete-actions">
        <button class="btn btn-secondaire" id="btn-planifier">${t('planifier_reunion')}</button>
        <button class="btn btn-direct" id="btn-maintenant">${t('reunion_maintenant')}</button>
      </div>
    </header>
    <div id="zone-direct"></div>
    <div class="onglets" role="tablist" aria-label="${t('sections_equipe')}">
      ${Object.entries(tabs).map(([key, label]) =>
        `<button role="tab" data-onglet="${key}" aria-selected="${state.tab === key}">${label}</button>`).join('')}
    </div>
    <div class="panneau" id="panneau" role="tabpanel"></div>`;

  $('#btn-retour').addEventListener('click', () => {
    document.body.classList.remove('classe-ouverte');
    renderTeamList();
  });
  $('#btn-planifier').addEventListener('click', () => openScheduler({ teamId: state.teamId }));
  $('#btn-maintenant').addEventListener('click', meetNow);
  $$('[data-onglet]').forEach((b) => b.addEventListener('click', () => {
    state.tab = b.dataset.onglet;
    $$('[data-onglet]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    renderTab();
  }));
  renderLiveBanner();
  renderTab();
}

function renderLiveBanner() {
  const zone = $('#zone-direct');
  if (!zone) return;
  const m = state.meetings.find((x) => x.etat === 'en_direct');
  zone.innerHTML = m ? `
    <div class="direct">
      <span class="direct-point" aria-hidden="true"></span>
      <div>
        <strong>${esc(t('reunion_en_cours', { titre: m.titre }))}</strong>
        <small>${t('jusqua', { heure: fmt.time.format(meetingEnd(m)) })}</small>
      </div>
      <button class="btn btn-direct" data-rejoindre="${m.id}">${t('rejoindre_reunion')}</button>
    </div>` : '';
}

async function loadMeetings() {
  if (!state.teamId) return;
  const id = state.teamId;
  const meetings = await api(`/classes/${id}/seances`).catch(() => null);
  if (!meetings || id !== state.teamId) return;
  state.meetings = meetings;
  renderLiveBanner();
  if (state.tab === 'meetings') renderTab();
  loadTeams();
}

// ---------- Tabs ----------
function renderTab() {
  if (state.tab === 'chat') return renderChat();
  if (state.tab === 'meetings') return renderMeetings();
  return renderMembers();
}

async function renderChat() {
  const panel = $('#panneau');
  const { estResponsable: isOwner } = state.detail;
  const channel = state.channels.find((c) => c.id === state.channelId);
  if (!channel) { panel.className = 'panneau'; panel.innerHTML = ''; return; }
  const canPost = !channel.annonces || isOwner;
  panel.className = 'panneau panneau-discussion';
  panel.innerHTML = `
    <div class="barre-canal">
      <div>
        <strong>${esc(channelName(channel))}</strong>
        ${channel.description ? `<span>${esc(channel.description)}</span>` : ''}
      </div>
      ${isOwner && !channel.est_general ? `<button class="btn-lien" id="btn-supprimer-canal">${t('supprimer_canal')}</button>` : ''}
    </div>
    <div class="fil" id="fil"><p class="chargement">${t('chargement_messages')}</p></div>
    ${canPost ? `
    <form class="compose" id="compose">
      <label class="sr" for="champ-message">${esc(t('message_a', { canal: channelName(channel) }))}</label>
      <textarea id="champ-message" rows="1" maxlength="4000" placeholder="${esc(t('ecrire_dans', { canal: channelName(channel) }))}"></textarea>
      <button class="btn btn-principal" type="submit">${t('envoyer')}</button>
    </form>` : `<p class="lecture-seule">${t('lecture_seule')}</p>`}`;
  $('#btn-supprimer-canal')?.addEventListener('click', deleteChannel);
  if (canPost) bindComposer(channel);
  loadChannelMessages(channel.id);
}

function bindComposer(channel) {
  const field = $('#champ-message');
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#compose').requestSubmit(); }
  });
  field.addEventListener('input', () => {
    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  });
  $('#compose').addEventListener('submit', (e) => {
    e.preventDefault();
    const contenu = field.value.trim();
    if (!contenu) return;
    state.socket.emit('message:envoyer', { canalId: channel.id, contenu }, (res) => {
      if (res?.ok) { field.value = ''; field.style.height = 'auto'; field.focus(); }
      else toast(res?.erreur || t('message_non_envoye'));
    });
  });
}

async function loadChannelMessages(channelId) {
  try {
    const messages = await api(`/canaux/${channelId}/messages`);
    if (state.channelId !== channelId || state.tab !== 'chat') return;
    const feed = $('#fil');
    feed.innerHTML = messages.length ? '' : `<p class="vide-fil">${t('aucun_message')}</p>`;
    messages.forEach((m) => appendMessage(m, false));
    feed.scrollTop = feed.scrollHeight;
  } catch (err) {
    $('#fil').innerHTML = `<p class="chargement">${esc(err.message)}</p>`;
  }
}

function appendMessage(m, scroll) {
  const feed = $('#fil');
  if (!feed || !state.detail) return;
  feed.querySelector('.vide-fil')?.remove();
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  const mine = m.auteur_id === state.me.id;
  const owner = m.auteur_id === state.detail.classe.responsable_id;
  const el = document.createElement('article');
  el.className = `message${mine ? ' message-moi' : ''}`;
  el.innerHTML = `
    <span class="avatar avatar-teinte" data-teinte="${hue(m.auteur_id)}" aria-hidden="true">${esc(initials(m.auteur_nom))}</span>
    <div class="message-corps">
      <header>
        <strong>${esc(m.auteur_nom)}</strong>
        ${owner ? `<span class="badge">${t('proprietaire')}</span>` : ''}
        <time datetime="${esc(m.cree_le)}">${fmt.message.format(new Date(m.cree_le))}</time>
      </header>
      <p></p>
    </div>`;
  el.querySelector('p').textContent = m.contenu;
  feed.append(el);
  if (scroll && (atBottom || mine)) feed.scrollTop = feed.scrollHeight;
}

function meetingRow(m, withTeam = false) {
  const d = new Date(m.debut);
  const host = canHost(m);
  const canJoin = m.etat === 'en_direct' || (host && m.etat === 'a_venir');
  return `
    <li class="seance seance-${m.etat}">
      <time class="seance-date" datetime="${esc(m.debut)}">
        <span>${fmt.dayShort.format(d)}</span><strong>${fmt.time.format(d)}</strong>
      </time>
      <div class="seance-info">
        <button class="seance-titre" data-reunion="${m.id}">${esc(m.titre)}</button>
        <small>${withTeam ? `${esc(m.classe_nom)}, ` : ''}${t('minutes', { n: m.duree_min })}${m.organisateur_nom ? `, ${esc(t('organisee_par', { nom: m.organisateur_nom }))}` : ''}${m.nb_invites ? `, ${t('n_invites', { n: m.nb_invites })}` : ''}</small>
      </div>
      <span class="etat etat-${m.etat}">${stateLabel(m.etat)}</span>
      <div class="seance-actions">
        ${canJoin ? `<button class="btn ${m.etat === 'en_direct' ? 'btn-direct' : 'btn-secondaire'}" data-rejoindre="${m.id}">${t(m.etat === 'en_direct' ? 'rejoindre_reunion' : 'demarrer')}</button>` : ''}
        ${host && !withTeam ? `<button class="btn-lien" data-supprimer-seance="${m.id}">${t('supprimer')}</button>` : ''}
      </div>
    </li>`;
}

function renderMeetings() {
  const panel = $('#panneau');
  panel.className = 'panneau';
  const upcoming = state.meetings.filter((m) => m.etat !== 'terminee');
  const past = state.meetings.filter((m) => m.etat === 'terminee').reverse();

  const upcomingBlock = upcoming.length
    ? `<ul class="seances">${upcoming.map((m) => meetingRow(m)).join('')}</ul>`
    : `<div class="vide-bloc"><p>${t('aucune_reunion')}</p><p>${t('astuce_planifier')}</p></div>`;
  const pastBlock = past.length
    ? `<h3 class="sous-titre">${t('reunions_passees')}</h3><ul class="seances">${past.map((m) => meetingRow(m)).join('')}</ul>`
    : '';
  panel.innerHTML = upcomingBlock + pastBlock;
}

function memberRow(p, removable) {
  return `
    <li class="membre">
      <span class="avatar avatar-teinte" data-teinte="${hue(p.id)}" aria-hidden="true">${esc(initials(p.nom))}</span>
      <div><strong>${esc(p.nom)}</strong><small>${esc(p.email)}</small></div>
      ${removable ? `<button class="btn-lien" data-retirer="${p.id}">${t('retirer')}</button>` : ''}
    </li>`;
}

function renderMembers() {
  const panel = $('#panneau');
  const { classe: team, responsable: owner, membres: members, estResponsable: isOwner } = state.detail;
  panel.className = 'panneau';
  panel.innerHTML = `
    ${isOwner ? `
      <div class="invitation">
        <div><span class="invitation-libelle">${t('code_equipe')}</span><strong class="code">${esc(team.code_invitation)}</strong></div>
        <p>${t('note_code_equipe')}</p>
        <button class="btn btn-secondaire" data-copier="${esc(team.code_invitation)}">${t('copier_code')}</button>
      </div>` : ''}
    <h3 class="sous-titre">${t('proprietaire')}</h3>
    <ul class="membres">${memberRow(owner, false)}</ul>
    <h3 class="sous-titre">${t('membres_n', { n: members.length })}</h3>
    ${members.length
      ? `<ul class="membres">${members.map((p) => memberRow(p, isOwner)).join('')}</ul>`
      : `<div class="vide-bloc"><p>${t('personne_rejoint')}</p></div>`}`;
}

// ---------- Actions ----------
async function joinMeeting(meetingId, win = window.open('', '_blank')) {
  // The tab is opened right away (in the click) so the browser doesn't block it.
  try {
    const { url } = await api(`/seances/${meetingId}/rejoindre`, { method: 'POST' });
    if (win) { win.opener = null; win.location.href = url; }
    else location.href = url;
  } catch (err) {
    win?.close();
    toast(err.message);
  }
}

/** « Meet now » : crée une réunion qui commence tout de suite et y entre. */
async function meetNow() {
  const win = window.open('', '_blank');
  try {
    const meeting = await api(`/classes/${state.teamId}/seances`, {
      method: 'POST',
      body: { immediat: true, titre: t('titre_reunion_immediate'), duree_min: 60 },
    });
    await joinMeeting(meeting.id, win);
    loadMeetings();
  } catch (err) {
    win?.close();
    toast(err.message);
  }
}

async function deleteMeeting(id) {
  if (!confirm(t('confirmer_suppr_reunion'))) return;
  try {
    await api(`/seances/${id}`, { method: 'DELETE' });
    toast(t('reunion_supprimee'));
    $('#dlg-reunion')?.close();
    loadMeetings();
    if (!$('#vue-agenda').hidden) loadCalendar();
  } catch (err) { toast(err.message); }
}

async function removeMember(userId) {
  if (!confirm(t('confirmer_retrait_equipe'))) return;
  try {
    await api(`/classes/${state.teamId}/membres/${userId}`, { method: 'DELETE' });
    state.detail = await api(`/classes/${state.teamId}`);
    renderMembers();
    toast(t('retire_equipe'));
  } catch (err) { toast(err.message); }
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-rejoindre], [data-supprimer-seance], [data-retirer], [data-copier], [data-ouvrir-code]');
  if (!el) return;
  if (el.dataset.rejoindre) joinMeeting(Number(el.dataset.rejoindre));
  else if (el.dataset.supprimerSeance) deleteMeeting(Number(el.dataset.supprimerSeance));
  else if (el.dataset.retirer) removeMember(Number(el.dataset.retirer));
  else if (el.dataset.copier) {
    navigator.clipboard.writeText(el.dataset.copier)
      .then(() => toast(t('code_copie')))
      .catch(() => toast(t('code_x', { code: el.dataset.copier })));
  } else if ('ouvrirCode' in el.dataset) {
    $('#dlg-espaces').close();
    openDialog('dlg-code', joinWithCode);
  }
});

// ---------- Choix de personnes (participants) ----------
const directory = { orgId: null, people: [] };
async function loadDirectory() {
  if (directory.orgId !== state.org.id) {
    directory.people = await api(`/espaces/${state.org.id}/annuaire`);
    directory.orgId = state.org.id;
  }
  return directory.people;
}

/** Champ de recherche avec puces : choisir des personnes de l'organisation. */
function createPicker(root) {
  const picker = { selected: new Map(), exclude: new Set() };
  root.innerHTML = `
    <div class="choix-selection"></div>
    <input type="search" class="choix-recherche" autocomplete="off" placeholder="${esc(t('rechercher_personne'))}" aria-label="${esc(t('rechercher_personne'))}">
    <ul class="choix-resultats"></ul>`;
  const input = $('.choix-recherche', root);
  const results = $('.choix-resultats', root);
  const chips = $('.choix-selection', root);

  const renderChips = () => {
    chips.innerHTML = [...picker.selected.values()].map((p) => `
      <span class="puce-personne">${esc(p.nom)}<button type="button" data-enlever="${p.id}" aria-label="${esc(t('retirer_nom', { nom: p.nom }))}">×</button></span>`).join('');
  };
  const renderResults = () => {
    if (document.activeElement !== input) { results.innerHTML = ''; return; }
    const q = input.value.trim().toLowerCase();
    const list = directory.people
      .filter((p) => !picker.selected.has(p.id) && !picker.exclude.has(p.id))
      .filter((p) => !q || p.nom.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 6);
    results.innerHTML = list.length
      ? list.map((p) => `<li><button type="button" data-choisir="${p.id}">
          <span class="avatar avatar-teinte" data-teinte="${hue(p.id)}" aria-hidden="true">${esc(initials(p.nom))}</span>
          <span><strong>${esc(p.nom)}</strong><small dir="ltr">${esc(p.email)}</small></span></button></li>`).join('')
      : `<li class="choix-vide">${t('aucune_personne')}</li>`;
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('blur', () => setTimeout(renderResults, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('[data-choisir]', results)?.click(); }
  });
  results.addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus dans le champ
  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-choisir]');
    if (!b) return;
    const person = directory.people.find((p) => p.id === Number(b.dataset.choisir));
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
  picker.setExclude = (ids) => {
    picker.exclude = new Set(ids);
    for (const id of picker.exclude) picker.selected.delete(id);
    renderChips(); renderResults();
  };
  return picker;
}

/** Membres d'une équipe (propriétaire compris), pour ne pas les proposer comme invités. */
async function teamMemberIds(teamId) {
  const d = await api(`/classes/${teamId}`);
  return [d.responsable.id, ...d.membres.map((m) => m.id)];
}

// ---------- Dialogs ----------
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
      $('.erreur', dlg).textContent = err.message;
    } finally {
      button.disabled = false;
    }
  };
}
$$('[data-fermer]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

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

// Forms on the welcome screen (not in a dialog).
function bindForm(form, action) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('[type=submit]', form);
    button.disabled = true;
    $('.erreur', form).textContent = '';
    try {
      await action(Object.fromEntries(new FormData(form)));
      form.reset();
    } catch (err) {
      $('.erreur', form).textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}
bindForm($('#ecran-accueil .form-creer-espace'), createOrg);
bindForm($('#ecran-accueil .form-code'), joinWithCode);

$('#btn-creer-espace').addEventListener('click', () => {
  $('#dlg-espaces').close();
  openDialog('dlg-creer-espace', createOrg);
});

$('#btn-nouvelle-classe').addEventListener('click', () => openDialog('dlg-classe', async (values) => {
  const team = await api('/classes', { method: 'POST', body: { ...values, espace_id: state.org.id } });
  await loadTeams();
  state.nextTab = 'members';
  openTeam(team.id);
  toast(t('equipe_creee'));
}));

function nextFullHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Planifier une réunion : depuis une équipe (teamId) ou depuis le calendrier (choix de l'équipe, créneau cliqué). */
function openScheduler({ teamId = null, debut = null } = {}) {
  if (!teamId && !state.teams.length) return toast(t('aucune_equipe_planifier'));
  const picker = createPicker($('#choix-planif'));
  const refreshExclude = async (id) => {
    try { picker.setExclude([state.me.id, ...(await teamMemberIds(id))]); } catch { /* sans incidence */ }
  };
  loadDirectory().catch(() => {});

  openDialog('dlg-seance', async (values) => {
    const team = teamId || Number(values.classe_id);
    await api(`/classes/${team}/seances`, {
      method: 'POST',
      body: {
        titre: values.titre, debut: new Date(values.debut).toISOString(),
        duree_min: Number(values.duree_min), participants: picker.ids(),
      },
    });
    if (team === state.teamId) await loadMeetings();
    if (!$('#vue-agenda').hidden) loadCalendar();
    toast(t('reunion_planifiee'));
  }, (form) => {
    form.debut.value = debut ? toLocalInput(debut) : nextFullHour();
    $('#champ-equipe').hidden = Boolean(teamId);
    form.classe_id.required = !teamId;
    form.classe_id.innerHTML = state.teams.map((x) => `<option value="${x.id}">${esc(x.nom)}</option>`).join('');
    if (state.teamId && state.teams.some((x) => x.id === state.teamId)) form.classe_id.value = state.teamId;
    form.classe_id.onchange = () => refreshExclude(Number(form.classe_id.value));
    refreshExclude(teamId || Number(form.classe_id.value));
  });
}

$('#btn-ajouter-membre').addEventListener('click', () => openDialog('dlg-membre', async (values) => {
  const r = await api(`/espaces/${state.org.id}/membres`, { method: 'POST', body: values });
  toast(t(r.compte_existant ? 'ajoute_org' : 'compte_cree_mdp'));
  loadManage();
}));

// ---------- Calendar ----------
const HOUR_PX = 48;
const cal = { mode: matchMedia('(max-width: 800px)').matches ? 'jour' : 'semaine', ref: new Date(), meetings: [] };

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
// Premier jour de la semaine : samedi en arabe (Algérie), lundi sinon.
const weekStart = (d) => { const first = window.NADWA_LANGUE === 'ar' ? 6 : 1; const x = startOfDay(d); return addDays(x, -((x.getDay() - first + 7) % 7)); };

function calRange() {
  if (cal.mode === 'jour') { const d = startOfDay(cal.ref); return [d, addDays(d, 1)]; }
  if (cal.mode === 'semaine') { const d = weekStart(cal.ref); return [d, addDays(d, 7)]; }
  const first = new Date(cal.ref.getFullYear(), cal.ref.getMonth(), 1);
  const d = weekStart(first);
  return [d, addDays(d, 42)];
}

function calLabel([from, to]) {
  const { locale } = window.NADWA_LANGUES.find((l) => l.code === window.NADWA_LANGUE);
  if (cal.mode === 'mois') return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cal.ref);
  if (cal.mode === 'jour') return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(from);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(from, addDays(to, -1));
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
  // Après une planification ou une mise à jour, on garde la position de défilement.
  const key = `${cal.mode}|${range[0].toISOString()}`;
  const keepScroll = cal.key === key ? $('#cal-defilement')?.scrollTop : null;
  cal.key = key;
  const modes = { jour: t('vue_jour'), semaine: t('vue_semaine'), mois: t('vue_mois') };
  zone.innerHTML = `
    <header class="cal-barre">
      <div class="cal-nav">
        <button class="btn btn-secondaire" id="cal-aujourdhui">${t('cal_aujourdhui')}</button>
        <button class="cal-fleche" id="cal-prec" aria-label="${t('cal_precedent')}">‹</button>
        <button class="cal-fleche" id="cal-suiv" aria-label="${t('cal_suivant')}">›</button>
        <h1>${esc(calLabel(range))}</h1>
      </div>
      <div class="cal-droite">
        <div class="cal-vues" role="group" aria-label="${t('cal_vues')}">
          ${Object.entries(modes).map(([k, v]) => `<button data-cal-vue="${k}" aria-pressed="${cal.mode === k}">${v}</button>`).join('')}
        </div>
        <button class="btn btn-principal" id="cal-nouvelle">${t('nouvelle_reunion')}</button>
      </div>
    </header>
    <div class="cal-corps" id="cal-corps"><p class="chargement">${t('chargement')}</p></div>`;

  $('#cal-aujourdhui').addEventListener('click', () => { cal.ref = new Date(); loadCalendar(); });
  $('#cal-prec').addEventListener('click', () => calMove(-1));
  $('#cal-suiv').addEventListener('click', () => calMove(1));
  $$('[data-cal-vue]').forEach((b) => b.addEventListener('click', () => { cal.mode = b.dataset.calVue; loadCalendar(); }));
  $('#cal-nouvelle').addEventListener('click', () => openScheduler());

  try {
    const meetings = await api(`/agenda?espace=${state.org.id}&du=${range[0].toISOString()}&au=${range[1].toISOString()}`);
    if ($('#vue-agenda').hidden) return;
    cal.meetings = meetings;
    if (cal.mode === 'mois') renderMonth(range); else renderTimeGrid(range, keepScroll);
  } catch (err) {
    $('#cal-corps').innerHTML = `<p class="chargement">${esc(err.message)}</p>`;
  }
}

/** Réparti les réunions qui se chevauchent dans des colonnes côte à côte. */
function layoutDay(meetings) {
  const items = meetings.map((m) => {
    const start = new Date(m.debut);
    return { m, start: start.getHours() * 60 + start.getMinutes(), end: start.getHours() * 60 + start.getMinutes() + m.duree_min };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster = []; let clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const it of cluster) {
      let lane = lanes.findIndex((end) => end <= it.start);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = it.end; it.lane = lane;
    }
    cluster.forEach((it) => { it.lanes = lanes.length; });
    cluster = [];
  };
  for (const it of items) {
    if (it.start >= clusterEnd && cluster.length) flush();
    cluster.push(it); clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return items;
}

function renderTimeGrid([from, to], keepScroll = null) {
  const days = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, h) => { const d = new Date(from); d.setHours(h, 0, 0, 0); return fmt.time.format(d); });
  const corps = $('#cal-corps');
  corps.innerHTML = `
    <div class="cal-semaine">
      <div class="cal-entetes">
        <div></div>
        ${days.map((d) => `<div class="cal-jour-entete${sameDay(d, today) ? ' cal-aujourdhui' : ''}" data-jour="${d.toISOString()}">
          <span>${fmt.weekday.format(d)}</span><strong>${d.getDate()}</strong></div>`).join('')}
      </div>
      <div class="cal-defilement" id="cal-defilement">
        <div class="cal-grille-heures">
          <div class="cal-heures">${hours.map((h) => `<span>${h}</span>`).join('')}</div>
          ${days.map((d) => `<div class="cal-colonne${sameDay(d, today) ? ' cal-aujourdhui' : ''}" data-jour="${d.toISOString()}"></div>`).join('')}
        </div>
      </div>
    </div>
    <p class="cal-astuce">${t('cal_astuce')}</p>`;
  $('.cal-semaine', corps).style.setProperty('--jours', days.length);

  $$('.cal-colonne', corps).forEach((col) => {
    const day = new Date(col.dataset.jour);
    for (const it of layoutDay(cal.meetings.filter((m) => sameDay(new Date(m.debut), day)))) {
      const m = it.m;
      const el = document.createElement('button');
      el.className = `cal-evt cal-evt-${m.etat}`;
      el.dataset.reunion = m.id;
      el.style.setProperty('--teinte', hue(m.classe_id));
      el.style.top = `${(it.start / 60) * HOUR_PX}px`;
      el.style.height = `${Math.max((Math.min(it.end, 1440) - it.start) / 60 * HOUR_PX - 2, 22)}px`;
      el.style.insetInlineStart = `${(it.lane / it.lanes) * 100}%`;
      el.style.width = `calc(${100 / it.lanes}% - 4px)`;
      el.innerHTML = `<strong></strong><span>${fmt.time.format(new Date(m.debut))}, ${esc(m.classe_nom)}</span>`;
      el.querySelector('strong').textContent = m.titre;
      col.append(el);
    }
    if (sameDay(day, today)) {
      const line = document.createElement('div');
      line.className = 'cal-maintenant';
      line.style.top = `${((today.getHours() * 60 + today.getMinutes()) / 60) * HOUR_PX}px`;
      col.append(line);
    }
    // Clic sur un créneau libre : planifier à cette heure (demi-heure la plus proche).
    col.addEventListener('click', (e) => {
      if (e.target !== col) return;
      const minutes = Math.floor((e.offsetY / HOUR_PX) * 2) * 30;
      const debut = new Date(day); debut.setHours(0, minutes, 0, 0);
      openScheduler({ debut });
    });
  });
  $$('.cal-jour-entete', corps).forEach((h) => h.addEventListener('click', () => {
    cal.ref = new Date(h.dataset.jour); cal.mode = 'jour'; loadCalendar();
  }));

  const scroller = $('#cal-defilement');
  const showsToday = days.some((d) => sameDay(d, today));
  scroller.scrollTop = keepScroll ?? (showsToday ? Math.max(today.getHours() - 2, 0) : 7.5) * HOUR_PX;
}

function renderMonth([from]) {
  const today = new Date();
  const month = cal.ref.getMonth();
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const corps = $('#cal-corps');
  corps.innerHTML = `
    <div class="cal-mois">
      ${days.slice(0, 7).map((d) => `<div class="cal-mois-entete">${fmt.weekday.format(d)}</div>`).join('')}
      ${days.map((d) => {
        const list = cal.meetings.filter((m) => sameDay(new Date(m.debut), d));
        return `
          <div class="cal-case${d.getMonth() !== month ? ' cal-hors-mois' : ''}${sameDay(d, today) ? ' cal-aujourdhui' : ''}" data-jour="${d.toISOString()}">
            <button class="cal-num" data-ouvrir-jour="${d.toISOString()}">${d.getDate()}</button>
            ${list.slice(0, 3).map((m) => `<button class="cal-puce cal-evt-${m.etat}" data-reunion="${m.id}" data-teinte="${hue(m.classe_id)}">
              <span>${fmt.time.format(new Date(m.debut))}</span> ${esc(m.titre)}</button>`).join('')}
            ${list.length > 3 ? `<button class="cal-plus" data-ouvrir-jour="${d.toISOString()}">${t('plus_n', { n: list.length - 3 })}</button>` : ''}
          </div>`;
      }).join('')}
    </div>
    <p class="cal-astuce">${t('cal_astuce')}</p>`;
  $$('[data-ouvrir-jour]', corps).forEach((b) => b.addEventListener('click', () => {
    cal.ref = new Date(b.dataset.ouvrirJour); cal.mode = 'jour'; loadCalendar();
  }));
  $$('.cal-case', corps).forEach((c) => c.addEventListener('click', (e) => {
    if (e.target !== c) return;
    const debut = new Date(c.dataset.jour); debut.setHours(9, 0, 0, 0);
    openScheduler({ debut });
  }));
}

/** Détail d'une réunion (clic dans le calendrier). */
function openMeetingDetail(id) {
  const m = cal.meetings.find((x) => x.id === id) || state.meetings.find((x) => x.id === id);
  if (!m) return;
  const { locale } = window.NADWA_LANGUES.find((l) => l.code === window.NADWA_LANGUE);
  const start = new Date(m.debut);
  const when = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    .formatRange(start, meetingEnd(m));
  const host = canHost(m);
  const canJoin = m.etat === 'en_direct' || (host && m.etat === 'a_venir');
  const dlg = $('#dlg-reunion');
  $('.dlg-corps', dlg).innerHTML = `
    <div class="reunion-entete">
      <span class="pastille" data-teinte="${hue(m.classe_id)}" aria-hidden="true">${esc(initials(m.classe_nom))}</span>
      <div><h2></h2><p>${esc(m.classe_nom)}${m.acces_equipe === 0 ? ` <span class="badge-invite">${t('vous_etes_invite')}</span>` : ''}</p></div>
    </div>
    <dl class="reunion-infos">
      <div><dt>${t('debut')}</dt><dd>${esc(when)}</dd></div>
      ${m.organisateur_nom ? `<div><dt>${t('organisateur')}</dt><dd>${esc(m.organisateur_nom)}</dd></div>` : ''}
      <div><dt>${t('etat')}</dt><dd><span class="etat etat-${m.etat}">${stateLabel(m.etat)}</span></dd></div>
    </dl>
    <section class="reunion-participants" id="reunion-participants"><p class="chargement">${t('chargement')}</p></section>
    <div class="dlg-actions">
      ${host ? `<button class="btn-lien" data-supprimer-seance="${m.id}">${t('supprimer')}</button>` : ''}
      ${m.acces_equipe === 0 ? '' : `<button class="btn btn-secondaire" id="reunion-equipe">${t('ouvrir_equipe')}</button>`}
      ${canJoin ? `<button class="btn ${m.etat === 'en_direct' ? 'btn-direct' : 'btn-principal'}" data-rejoindre="${m.id}">${t(m.etat === 'en_direct' ? 'rejoindre_reunion' : 'demarrer')}</button>` : ''}
    </div>
    <button type="button" class="btn-lien dlg-fermer" data-fermer-reunion>${t('fermer')}</button>`;
  $('h2', dlg).textContent = m.titre;
  $('[data-fermer-reunion]', dlg).addEventListener('click', () => dlg.close());
  $('#reunion-equipe')?.addEventListener('click', () => {
    dlg.close();
    state.nextTab = 'meetings';
    showView('classes');
    openTeam(m.classe_id);
  });
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
      <p class="equipe-entiere">${esc(t('toute_equipe', { equipe: p.equipe.nom, n: p.equipe.membres.length }))}</p>
      ${p.invites.length ? `<div class="choix-selection">${p.invites.map((x) => `
        <span class="puce-personne">${esc(x.nom)}${p.peutModifier ? `<button type="button" data-retirer-invite="${x.id}" aria-label="${esc(t('retirer_nom', { nom: x.nom }))}">×</button>` : ''}</span>`).join('')}</div>` : ''}
      ${p.peutModifier ? `<button class="btn btn-secondaire" id="btn-ajout-participants">${t('ajouter_participants')}</button>` : ''}`;
    $$('[data-retirer-invite]', zone).forEach((b) => b.addEventListener('click', async () => {
      try {
        await api(`/seances/${m.id}/participants/${b.dataset.retirerInvite}`, { method: 'DELETE' });
        m.nb_invites = Math.max((m.nb_invites || 1) - 1, 0);
        loadParticipants(m);
        refreshMeetingViews();
      } catch (err) { toast(err.message); }
    }));
    $('#btn-ajout-participants')?.addEventListener('click', () => openAddParticipants(m, p));
  } catch (err) {
    zone.innerHTML = `<p class="chargement">${esc(err.message)}</p>`;
  }
}

/** Ajouter des participants à une réunion existante. */
function openAddParticipants(m, current) {
  const picker = createPicker($('#choix-ajout'));
  loadDirectory().then(() => picker.setExclude([
    state.me.id, ...current.equipe.membres.map((x) => x.id), ...current.invites.map((x) => x.id),
  ])).catch(() => {});
  openDialog('dlg-participants', async () => {
    const ids = picker.ids();
    if (!ids.length) throw new Error(t('choisir_personne'));
    const r = await api(`/seances/${m.id}/participants`, { method: 'POST', body: { ids } });
    m.nb_invites = r.invites.length;
    toast(t('participants_ajoutes'));
    loadParticipants(m);
    refreshMeetingViews();
  });
}

function refreshMeetingViews() {
  if (!$('#vue-agenda').hidden) loadCalendar();
  if (state.teamId) loadMeetings();
}

document.addEventListener('click', (e) => {
  const evt = e.target.closest('[data-reunion]');
  if (evt) openMeetingDetail(Number(evt.dataset.reunion));
});

// ---------- Manage organization ----------
async function loadManage() {
  $('#gestion-titre').textContent = state.org.nom;
  try {
    const [org, stats, people] = await Promise.all([
      api(`/espaces/${state.org.id}`),
      api(`/espaces/${state.org.id}/stats`),
      api(`/espaces/${state.org.id}/membres`),
    ]);
    $('#gestion-invitation').innerHTML = `
      <div><span class="invitation-libelle">${t('code_org')}</span><strong class="code">${esc(org.code_invitation)}</strong></div>
      <p>${t('note_code_org')}</p>
      <button class="btn btn-secondaire" data-copier="${esc(org.code_invitation)}">${t('copier_code')}</button>`;

    $('#gestion-stats').innerHTML = [
      [t('stat_membres'), stats.membre],
      [t('stat_admins'), stats.admin],
      [t('stat_equipes'), stats.groupes],
      [t('stat_reunions_venir'), stats.seances_a_venir],
    ].map(([label, n]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');

    $('#gestion-membres').innerHTML = `
      <table>
        <thead><tr><th>${t('col_nom')}</th><th>${t('col_email')}</th><th>${t('col_role')}</th><th>${t('col_rejoint')}</th><th><span class="sr">${t('actions')}</span></th></tr></thead>
        <tbody>${people.map((p) => `
          <tr>
            <td>${esc(p.nom)}</td>
            <td dir="ltr">${esc(p.email)}</td>
            <td>${p.id === state.me.id ? roleLabel(p.role) : `
              <select data-role-pour="${p.id}" aria-label="${esc(t('role_de', { nom: p.nom }))}">
                ${['membre', 'admin'].map((key) => `<option value="${key}" ${key === p.role ? 'selected' : ''}>${roleLabel(key)}</option>`).join('')}
              </select>`}</td>
            <td>${fmt.date.format(new Date(p.rejoint_le))}</td>
            <td>${p.id === state.me.id ? '' : `<button class="btn-lien" data-retirer-espace="${p.id}">${t('retirer')}</button>`}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

    $$('[data-role-pour]').forEach((sel) => sel.addEventListener('change', async () => {
      try {
        await api(`/espaces/${state.org.id}/membres/${sel.dataset.rolePour}`, { method: 'PATCH', body: { role: sel.value } });
        toast(t('role_maj'));
      } catch (err) { toast(err.message); loadManage(); }
    }));
    $$('[data-retirer-espace]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(t('confirmer_retrait_org'))) return;
      try {
        await api(`/espaces/${state.org.id}/membres/${b.dataset.retirerEspace}`, { method: 'DELETE' });
        toast(t('retire_org'));
        loadManage();
      } catch (err) { toast(err.message); }
    }));
  } catch (err) {
    toast(err.message);
  }
}

// ---------- Platform (operator) ----------
async function loadPlatform() {
  try {
    const { stats, espaces } = await api('/plateforme');
    $('#plateforme-stats').innerHTML = [
      [t('stat_orgs'), stats.espaces],
      [t('stat_comptes'), stats.utilisateurs],
      [t('stat_equipes'), stats.groupes],
      [t('stat_reunions'), stats.seances],
    ].map(([label, n]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
    $('#plateforme-espaces').innerHTML = `
      <table>
        <thead><tr><th>${t('col_org')}</th><th>${t('col_personnes')}</th><th>${t('col_equipes')}</th><th>${t('col_creee')}</th></tr></thead>
        <tbody>${espaces.map((o) => `
          <tr>
            <td>${esc(o.nom)}</td>
            <td>${o.nb_membres}</td>
            <td>${o.nb_groupes}</td>
            <td>${fmt.date.format(new Date(o.cree_le))}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    toast(err.message);
  }
}

// ---------- Launch ----------
translatePage();
api('/auth/moi')
  .then(start)
  .catch(() => {
    showScreen('ecran-auth');
    setAuthMode('connexion');
  });
