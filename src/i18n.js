/**
 * Messages du serveur en anglais, français et arabe.
 * La langue vient de l'en-tête « X-Langue » envoyé par l'interface (sinon Accept-Language, sinon anglais).
 */
const LANGUES = ['en', 'fr', 'ar'];

const MESSAGES = {
  auth_requise: ['Please sign in.', 'Veuillez vous connecter.', 'يرجى تسجيل الدخول.'],
  interdit: ["You don't have permission to do this.", "Vous n'avez pas les droits pour cette action.", 'ليست لديك صلاحية القيام بهذا الإجراء.'],
  route_inconnue: ['Route not found.', 'Route introuvable.', 'المسار غير موجود.'],
  erreur_interne: ['Internal server error.', 'Erreur interne du serveur.', 'خطأ داخلي في الخادم.'],

  nom_invalide: ['Enter your full name (2 to 80 characters).', 'Indiquez votre nom complet (2 à 80 caractères).', 'أدخل اسمك الكامل (من 2 إلى 80 حرفًا).'],
  email_invalide: ['This email address is not valid.', "Cette adresse e-mail n'est pas valide.", 'عنوان البريد الإلكتروني غير صالح.'],
  mdp_court: ['Password must be at least 8 characters.', 'Le mot de passe doit contenir au moins 8 caractères.', 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.'],
  inscription_fermee: ['Sign-up is closed. Ask your organization admin for an account.', "Les inscriptions sont fermées. Demandez un compte à l'administrateur de votre organisation.", 'التسجيل مغلق حاليًا. اطلب حسابًا من مسؤول مؤسستك.'],
  compte_existe: ['An account already exists with this email. Sign in instead.', 'Un compte existe déjà avec cette adresse. Connectez-vous.', 'يوجد حساب مسجّل بهذا البريد الإلكتروني. سجّل الدخول بدلًا من ذلك.'],
  identifiants: ['Incorrect email or password.', 'Adresse e-mail ou mot de passe incorrect.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'],

  org_introuvable: ["Organization not found, or you don't have access.", "Organisation introuvable, ou vous n'y avez pas accès.", 'المؤسسة غير موجودة أو ليس لديك حق الوصول إليها.'],
  admins_seulement: ['Only organization admins can do this.', "Seuls les administrateurs de l'organisation peuvent faire cela.", 'هذا الإجراء مخصص لمسؤولي المؤسسة فقط.'],
  creation_org_fermee: ['Creating new organizations is closed. Contact the Nadwa team.', "La création d'organisations est fermée. Contactez l'équipe Nadwa.", 'إنشاء مؤسسات جديدة غير متاح حاليًا. تواصل مع فريق «ندوة».'],
  nom_org: ['Name your organization (2 to 100 characters).', 'Donnez un nom à votre organisation (2 à 100 caractères).', 'أدخل اسم مؤسستك (من 2 إلى 100 حرف).'],
  role_inconnu: ['Unknown role.', 'Rôle inconnu.', 'دور غير معروف.'],
  deja_membre_org: ['This person is already in the organization.', "Cette personne fait déjà partie de l'organisation.", 'هذا الشخص عضو في المؤسسة بالفعل.'],
  propre_role: ["You can't change your own role.", 'Vous ne pouvez pas modifier votre propre rôle.', 'لا يمكنك تغيير دورك بنفسك.'],
  pas_membre_org: ['This person is not in the organization.', "Cette personne ne fait pas partie de l'organisation.", 'هذا الشخص ليس عضوًا في المؤسسة.'],
  se_retirer: ["You can't remove yourself from the organization.", "Vous ne pouvez pas vous retirer vous-même de l'organisation.", 'لا يمكنك إزالة نفسك من المؤسسة.'],
  code_inconnu: ['No organization or team matches this code. Check it with the person who gave it to you.', "Aucune organisation ni équipe ne correspond à ce code. Vérifiez-le auprès de la personne qui vous l'a donné.", 'لا توجد مؤسسة أو فريق بهذا الرمز. تحقّق منه لدى الشخص الذي أعطاك إياه.'],

  equipe_introuvable: ["Team not found, or you don't have access.", "Équipe introuvable, ou vous n'y avez pas accès.", 'الفريق غير موجود أو ليس لديك حق الوصول إليه.'],
  nom_equipe: ['Name your team (100 characters max).', "Donnez un nom à l'équipe (100 caractères au maximum).", 'أدخل اسم الفريق (100 حرف كحد أقصى).'],
  retirer_membre_owner: ['Only team owners can remove members.', "Seuls les propriétaires de l'équipe peuvent retirer des membres.", 'يمكن لمالكي الفريق فقط إزالة الأعضاء.'],
  ajout_canal_owner: ['Only team owners can add channels.', "Seuls les propriétaires de l'équipe peuvent ajouter des canaux.", 'يمكن لمالكي الفريق فقط إضافة قنوات.'],
  nom_canal: ['Name the channel (50 characters max).', 'Donnez un nom au canal (50 caractères au maximum).', 'أدخل اسم القناة (50 حرفًا كحد أقصى).'],
  canal_existe: ['This team already has a channel with that name.', 'Cette équipe a déjà un canal portant ce nom.', 'يوجد في هذا الفريق قناة بهذا الاسم.'],
  canal_introuvable: ["Channel not found, or you don't have access.", "Canal introuvable, ou vous n'y avez pas accès.", 'القناة غير موجودة أو ليس لديك حق الوصول إليها.'],
  suppr_canal_owner: ['Only team owners can delete channels.', "Seuls les propriétaires de l'équipe peuvent supprimer des canaux.", 'يمكن لمالكي الفريق فقط حذف القنوات.'],
  general_permanent: ["The General channel can't be deleted.", 'Le canal Général ne peut pas être supprimé.', 'لا يمكن حذف القناة العامة.'],

  planifier_owner: ['Only team owners can schedule meetings.', "Seuls les propriétaires de l'équipe peuvent planifier des réunions.", 'يمكن لمالكي الفريق فقط جدولة الاجتماعات.'],
  titre_reunion: ['Give the meeting a title (120 characters max).', 'Donnez un titre à la réunion (120 caractères au maximum).', 'أدخل عنوانًا للاجتماع (120 حرفًا كحد أقصى).'],
  date_invalide: ['Enter a valid start date and time.', 'Indiquez une date et une heure de début valides.', 'أدخل تاريخًا ووقت بدء صحيحين.'],
  duree: ['Duration must be between 15 and {max} minutes.', 'La durée doit être comprise entre 15 et {max} minutes.', 'يجب أن تكون المدة بين 15 و{max} دقيقة.'],
  reunion_introuvable: ["Meeting not found, or you don't have access.", "Réunion introuvable, ou vous n'y avez pas accès.", 'الاجتماع غير موجود أو ليس لديك حق الوصول إليه.'],
  suppr_reunion_owner: ['Only the organizer or a team owner can delete this meeting.', "Seuls l'organisateur ou un propriétaire de l'équipe peuvent supprimer cette réunion.", 'لا يمكن حذف هذا الاجتماع إلا من قِبل منظِّمه أو أحد مالكي الفريق.'],
  participants_hote: ['Only the organizer or a team owner can change the participants.', "Seuls l'organisateur ou un propriétaire de l'équipe peuvent modifier les participants.", 'لا يمكن تعديل المشاركين إلا من قِبل المنظِّم أو أحد مالكي الفريق.'],
  reunion_terminee: ['This meeting has ended.', 'Cette réunion est terminée.', 'انتهى هذا الاجتماع.'],
  salle_ouvre: ['The meeting room opens {min} minutes before the start time.', 'La salle ouvre {min} minutes avant le début.', 'تُفتح قاعة الاجتماع قبل موعد البدء بـ{min} دقائق.'],

  message_longueur: ['Messages must be between 1 and 4,000 characters.', 'Un message doit contenir entre 1 et 4 000 caractères.', 'يجب أن يتراوح طول الرسالة بين 1 و4000 حرف.'],
  canal_acces: ["You don't have access to this channel.", "Vous n'avez pas accès à ce canal.", 'ليس لديك حق الوصول إلى هذه القناة.'],
  annonces_owner: ['Only team owners can post in this channel.', "Seuls les propriétaires de l'équipe peuvent publier dans ce canal.", 'يمكن لمالكي الفريق فقط النشر في هذه القناة.'],

  visio_ko: ['The video server is not responding. Try again in a moment.', 'Le serveur de visioconférence ne répond pas. Réessayez dans un instant.', 'خادم الاجتماعات المرئية لا يستجيب. أعد المحاولة بعد لحظات.'],
  bbb_refus: ['BigBlueButton could not create the meeting room.', "BigBlueButton n'a pas pu créer la salle.", 'تعذّر على BigBlueButton إنشاء قاعة الاجتماع.'],
  bbb_bienvenue: ['Welcome to {nom}.', 'Bienvenue dans {nom}.', 'مرحبًا بكم في {nom}.'],
};

/** Langue d'une requête HTTP, d'un socket, ou d'une chaîne déjà résolue. */
function langueDe(source) {
  if (typeof source === 'string') return LANGUES.includes(source) ? source : 'en';
  if (source?.handshake) { // socket : langue choisie dans l'interface
    const l = source.data?.langue || source.handshake.auth?.langue;
    if (LANGUES.includes(l)) return l;
    source = source.handshake;
  }
  const choisie = String(source?.headers?.['x-langue'] || '').slice(0, 2).toLowerCase();
  if (LANGUES.includes(choisie)) return choisie;
  const navigateur = String(source?.headers?.['accept-language'] || '').slice(0, 2).toLowerCase();
  return LANGUES.includes(navigateur) ? navigateur : 'en';
}

/** t(req | socket | 'fr', 'cle', { variables }) */
function t(source, cle, variables = {}) {
  const textes = MESSAGES[cle];
  if (!textes) return cle;
  const texte = textes[LANGUES.indexOf(langueDe(source))] || textes[0];
  return texte.replace(/\{(\w+)\}/g, (_, nom) => variables[nom] ?? '');
}

module.exports = { t, langueDe, LANGUES, MESSAGES };
