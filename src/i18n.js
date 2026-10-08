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
  notif_mail_pied: ['You receive this meeting reminder because you have a Nadwa account. You can turn off email reminders from your account menu.', "Vous recevez ce rappel parce que vous avez un compte Nadwa. Vous pouvez désactiver les rappels par e-mail depuis le menu de votre compte.", 'يصلك هذا التذكير لأن لديك حسابًا على ندوة. يمكنك إيقاف التذكيرات بالبريد من قائمة حسابك.'],
  notif_message_de: ['New message from {nom}', 'Nouveau message de {nom}', 'رسالة جديدة من {nom}'],
  notif_message_dans: ['{nom} in {lieu}', '{nom} dans {lieu}', '{nom} في {lieu}'],
  notif_appel: ['{nom} is calling', '{nom} vous appelle', '{nom} يتصل بك'],
  notif_appel_texte: ['Open Nadwa to join the call.', "Ouvrez Nadwa pour rejoindre l'appel.", 'افتح ندوة للانضمام إلى المكالمة.'],
  notif_repondre: ['Reply', 'Répondre', 'الرد'],
  notif_rejoindre: ['Join', 'Rejoindre', 'انضمام'],
  notif_rappel: ['"{titre}" starts in {min} min', '« {titre} » commence dans {min} min', 'يبدأ «{titre}» بعد {min} دقيقة'],
  notif_rappel_texte: ['Meeting of the team {equipe}.', "Réunion de l'équipe {equipe}.", 'اجتماع فريق {equipe}.'],
  notif_voir_reunion: ['Open the meeting', 'Ouvrir la réunion', 'فتح الاجتماع'],
  notif_abonnement_invalide: ['This device could not be registered for notifications.', "Cet appareil n'a pas pu être inscrit aux notifications.", 'تعذّر تسجيل هذا الجهاز لتلقي الإشعارات.'],
  notif_essai_titre: ['Notifications are on', 'Notifications activées', 'تم تفعيل الإشعارات'],
  notif_essai_texte: ["You'll be notified of messages and meetings on this device.", 'Vous serez prévenu ici des messages et des réunions.', 'ستصلك على هذا الجهاز إشعارات الرسائل والاجتماعات.'],
  mail_verif_sujet: ['Confirm your email address for Nadwa', 'Confirmez votre adresse e-mail pour Nadwa', 'أكّد بريدك الإلكتروني على ندوة'],
  mail_verif_texte: ['To activate your Nadwa account, confirm your email address by clicking the button below.', 'Pour activer votre compte Nadwa, confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous.', 'لتفعيل حسابك على ندوة، أكّد بريدك الإلكتروني بالنقر على الزر أدناه.'],
  mail_verif_duree: ['This link is valid for 48 hours.', 'Ce lien est valable 48 heures.', 'هذا الرابط صالح لمدة 48 ساعة.'],
  mail_verif_bouton: ['Confirm my address', 'Confirmer mon adresse', 'تأكيد بريدي'],
  verification_invalide: ['This confirmation link is invalid or has expired. Sign in to receive a new one.', 'Ce lien de confirmation est invalide ou a expiré. Connectez-vous pour en recevoir un nouveau.', 'رابط التأكيد غير صالح أو منتهي الصلاحية. سجّل الدخول لتلقي رابط جديد.'],
  verification_trop: ['Too many emails sent: try again in an hour.', "Trop d'e-mails envoyés : réessayez dans une heure.", 'أُرسلت رسائل كثيرة: أعد المحاولة بعد ساعة.'],
  email_non_verifie: ['Confirm your email address first: click the link we sent you.', "Confirmez d'abord votre adresse e-mail : cliquez sur le lien que nous vous avons envoyé.", 'أكّد بريدك الإلكتروني أولًا: انقر على الرابط الذي أرسلناه إليك.'],
  retour_trop_court: ['Please write a few more words.', 'Écrivez quelques mots de plus.', 'يُرجى كتابة بضع كلمات أخرى.'],
  retour_trop_nombreux: ['You have sent many messages: please try again in an hour.', 'Vous avez envoyé beaucoup de messages : réessayez dans une heure.', 'لقد أرسلت رسائل كثيرة: أعد المحاولة بعد ساعة.'],
  evaluation_note: ['Choose a rating from 1 to 5.', 'Choisissez une note de 1 à 5.', 'اختر تقييمًا من 1 إلى 5.'],
  suppr_equipe_owner: ['Only a team owner can delete this team.', "Seul un propriétaire de l'équipe peut la supprimer.", 'لا يمكن حذف هذا الفريق إلا من قِبل أحد مالكيه.'],
  terminer_reunion_owner: ['Only the organizer can end this meeting.', "Seul l'organisateur peut terminer cette réunion.", 'لا يمكن إنهاء هذا الاجتماع إلا من قِبل منظِّمه.'],
  participants_hote: ['Only the organizer or a team owner can change the participants.', "Seuls l'organisateur ou un propriétaire de l'équipe peuvent modifier les participants.", 'لا يمكن تعديل المشاركين إلا من قِبل المنظِّم أو أحد مالكي الفريق.'],
  reunion_terminee: ['This meeting has ended.', 'Cette réunion est terminée.', 'انتهى هذا الاجتماع.'],
  salle_ouvre: ['The meeting room opens {min} minutes before the start time.', 'La salle ouvre {min} minutes avant le début.', 'تُفتح قاعة الاجتماع قبل موعد البدء بـ{min} دقائق.'],

  message_longueur: ['Messages must be between 1 and 4,000 characters.', 'Un message doit contenir entre 1 et 4 000 caractères.', 'يجب أن يتراوح طول الرسالة بين 1 و4000 حرف.'],
  canal_acces: ["You don't have access to this channel.", "Vous n'avez pas accès à ce canal.", 'ليس لديك حق الوصول إلى هذه القناة.'],
  annonces_owner: ['Only team owners can post in this channel.', "Seuls les propriétaires de l'équipe peuvent publier dans ce canal.", 'يمكن لمالكي الفريق فقط النشر في هذه القناة.'],

  visio_ko: ['The video server is not responding. Try again in a moment.', 'Le serveur de visioconférence ne répond pas. Réessayez dans un instant.', 'خادم الاجتماعات المرئية لا يستجيب. أعد المحاولة بعد لحظات.'],
  bbb_refus: ['BigBlueButton could not create the meeting room.', "BigBlueButton n'a pas pu créer la salle.", 'تعذّر على BigBlueButton إنشاء قاعة الاجتماع.'],
  lien_invalide: ['This invitation link is not valid, or the meeting was deleted.', "Ce lien d'invitation n'est pas valide, ou la réunion a été supprimée.", 'رابط الدعوة هذا غير صالح، أو تم حذف الاجتماع.'],
  nom_invite: ['Enter your name to join.', 'Indiquez votre nom pour rejoindre.', 'أدخل اسمك للانضمام.'],
  invite_externe: ['guest', 'invité', 'ضيف'],
  equipe_perso: ['My meetings', 'Mes réunions', 'اجتماعاتي'],
  mdp_actuel_faux: ['Your current password is incorrect.', 'Le mot de passe actuel est incorrect.', 'كلمة المرور الحالية غير صحيحة.'],
  conversation_introuvable: ["Conversation not found, or you don't have access.", "Conversation introuvable, ou vous n'y avez pas accès.", 'المحادثة غير موجودة أو ليس لديك حق الوصول إليها.'],
  choisir_personne: ['Choose at least one person.', 'Choisissez au moins une personne.', 'اختر شخصًا واحدًا على الأقل.'],
  appel: ['Call', 'Appel', 'مكالمة'],
  fichier_nom: ['The file has no name.', "Le fichier n'a pas de nom.", 'الملف بلا اسم.'],
  fichier_vide: ['The file is empty.', 'Le fichier est vide.', 'الملف فارغ.'],
  fichier_introuvable: ["File not found, or you don't have access.", "Fichier introuvable, ou vous n'y avez pas accès.", 'الملف غير موجود أو ليس لديك حق الوصول إليه.'],
  fichier_suppr_droits: ['Only the person who added it or a team owner can delete it.', "Seuls la personne qui l'a déposé ou un propriétaire de l'équipe peuvent le supprimer.", 'لا يمكن حذفه إلا من قِبل من أضافه أو أحد مالكي الفريق.'],
  fichier_trop_gros: ['This file is too large (maximum {max} MB).', 'Ce fichier est trop volumineux (maximum {max} Mo).', 'هذا الملف كبير جدًا (الحد الأقصى {max} ميغابايت).'],
  dossier_nom: ['Name the folder.', 'Donnez un nom au dossier.', 'أدخل اسم المجلد.'],
  dossier_existe: ['A folder with this name already exists here.', 'Un dossier porte déjà ce nom ici.', 'يوجد مجلد بهذا الاسم هنا.'],
  dossier_introuvable: ['Folder not found.', 'Dossier introuvable.', 'المجلد غير موجود.'],
  mail_indisponible: ["Password recovery by email isn't set up on this platform yet. Ask your organization's administrator to reset your password.", "La récupération par e-mail n'est pas encore activée sur cette plateforme. Demandez à l'administrateur de votre organisation de réinitialiser votre mot de passe.", 'استعادة كلمة المرور بالبريد الإلكتروني غير مفعّلة بعد على هذه المنصة. اطلب من مسؤول مؤسستك إعادة تعيين كلمة المرور.'],
  reinit_invalide: ['This link is no longer valid. Ask for a new one.', "Ce lien n'est plus valable. Demandez-en un nouveau.", 'هذا الرابط لم يعد صالحًا. اطلب رابطًا جديدًا.'],
  mail_bienvenue_sujet: ['Welcome to Nadwa', 'Bienvenue sur Nadwa', 'مرحبًا بك في ندوة'],
  mail_bienvenue_titre: ['Welcome, {prenom}', 'Bienvenue, {prenom}', 'مرحبًا، {prenom}'],
  mail_bienvenue_texte: ['Your Nadwa account has been created.', 'Votre compte Nadwa est créé.', 'تم إنشاء حسابك على ندوة.'],
  mail_bienvenue_texte2: ['You can now create teams, chat, schedule meetings and share files.', 'Vous pouvez maintenant créer des équipes, discuter, planifier des réunions et partager des fichiers.', 'يمكنك الآن إنشاء فرق، والمحادثة، وجدولة الاجتماعات، ومشاركة الملفات.'],
  mail_ouvrir_nadwa: ['Open Nadwa', 'Ouvrir Nadwa', 'فتح ندوة'],
  mail_pas_vous: ["If you didn't create this account, you can ignore this email.", "Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.", 'إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذه الرسالة.'],
  mail_compte_sujet: ['Your account for {organisation} on Nadwa', 'Votre compte pour {organisation} sur Nadwa', 'حسابك في {organisation} على ندوة'],
  mail_ajout_sujet: ["You've been added to {organisation} on Nadwa", 'Vous avez été ajouté à {organisation} sur Nadwa', 'تمت إضافتك إلى {organisation} على ندوة'],
  mail_compte_texte: ['{par} added you to {organisation} on Nadwa.', '{par} vous a ajouté à {organisation} sur Nadwa.', 'أضافك {par} إلى {organisation} على ندوة.'],
  mail_compte_identifiants: ['To sign in: email {email}, temporary password {mdp}', 'Pour vous connecter : adresse {email}, mot de passe provisoire {mdp}', 'لتسجيل الدخول: البريد {email}، كلمة المرور المؤقتة {mdp}'],
  mail_compte_changer: ['Change this password after signing in, from "My profile".', 'Changez ce mot de passe après votre connexion, depuis « Mon profil ».', 'غيّر كلمة المرور هذه بعد تسجيل الدخول من «ملفي الشخصي».'],
  mail_reinit_sujet: ['Reset your Nadwa password', 'Réinitialiser votre mot de passe Nadwa', 'إعادة تعيين كلمة مرور ندوة'],
  mail_reinit_titre: ['Hello {prenom}', 'Bonjour {prenom}', 'مرحبًا {prenom}'],
  mail_reinit_texte: ['We received a request to reset your password. Click the button to choose a new one.', 'Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton pour en choisir un nouveau.', 'تلقّينا طلبًا لإعادة تعيين كلمة مرورك. انقر على الزر لاختيار كلمة مرور جديدة.'],
  mail_reinit_duree: ['This link is valid for 1 hour and can be used once.', 'Ce lien est valable 1 heure et ne peut servir qu\'une fois.', 'هذا الرابط صالح لمدة ساعة واحدة ويُستخدم مرة واحدة فقط.'],
  mail_reinit_bouton: ['Choose a new password', 'Choisir un nouveau mot de passe', 'اختيار كلمة مرور جديدة'],
  mail_reinit_pas_vous: ["If you didn't ask for this, ignore this email: your password won't change.", "Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne changera pas.", 'إذا لم تطلب ذلك، فتجاهل هذه الرسالة: لن تتغير كلمة مرورك.'],
  mail_change_sujet: ['Your Nadwa password was changed', 'Votre mot de passe Nadwa a été modifié', 'تم تغيير كلمة مرور ندوة'],
  mail_change_texte: ['Your password has just been changed.', 'Votre mot de passe vient d\'être modifié.', 'تم تغيير كلمة مرورك للتو.'],
  mail_change_pas_vous: ["If you didn't do this, reset your password right away with \"Forgot password?\" on the sign-in page.", "Si ce n'est pas vous, réinitialisez tout de suite votre mot de passe avec « Mot de passe oublié ? » sur la page de connexion.", 'إذا لم تقم بذلك، أعد تعيين كلمة المرور فورًا عبر «نسيت كلمة المرور؟» في صفحة تسجيل الدخول.'],
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
