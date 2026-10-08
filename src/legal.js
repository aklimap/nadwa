/**
 * Conditions d'utilisation et Politique de confidentialité (anglais, français, arabe).
 * Pages publiques : /conditions et /confidentialite (?lang=fr|en|ar).
 * À faire relire par un juriste algérien ; changer VERSION à chaque modification importante.
 */
const config = require('./config');

const VERSION = '2026-10';
const LANGUES = ['en', 'fr', 'ar'];
const LOCALES = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-DZ' };

/** Fin de la période gratuite (Date), ou null si la date de lancement n'est pas encore fixée. */
function finGratuite() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.dateLancement)) return null;
  const d = new Date(`${config.dateLancement}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + config.moisGratuits);
  return d;
}

const dateLongue = (d, langue) => new Intl.DateTimeFormat(LOCALES[langue], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Variables insérées dans les textes. */
function variables(langue) {
  const fin = finGratuite();
  const mois = config.moisGratuits;
  const lieu = {
    en: config.hebergementAlgerie
      ? `in Algeria${config.hebergeur ? `, by ${config.hebergeur}` : ''}`
      : 'during the pilot phase, in Germany (Render and Hetzner); they will be moved to Algeria at the official launch',
    fr: config.hebergementAlgerie
      ? `en Algérie${config.hebergeur ? `, chez ${config.hebergeur}` : ''}`
      : "pendant la phase pilote, en Allemagne (Render et Hetzner) ; elles seront transférées en Algérie au lancement officiel",
    ar: config.hebergementAlgerie
      ? `في الجزائر${config.hebergeur ? `، لدى ${config.hebergeur}` : ''}`
      : 'خلال المرحلة التجريبية في ألمانيا (Render وHetzner)، وستُنقل إلى الجزائر عند الإطلاق الرسمي',
  }[langue];
  const gratuit = {
    en: fin ? `${mois} months, until ${dateLongue(fin, langue)}` : `${mois} months from the official launch`,
    fr: fin ? `${mois} mois, jusqu'au ${dateLongue(fin, langue)}` : `${mois} mois à compter du lancement officiel`,
    ar: fin ? `${mois} شهرًا، حتى ${dateLongue(fin, langue)}` : `${mois} شهرًا ابتداءً من الإطلاق الرسمي`,
  }[langue];
  return {
    editeur: esc(config.editeur + (config.editeurAdresse ? `, ${config.editeurAdresse}` : '')),
    contact: `<a href="mailto:${esc(config.contactEmail)}" dir="ltr">${esc(config.contactEmail)}</a>`,
    lieu: esc(lieu),
    gratuit: esc(gratuit),
    version: VERSION,
  };
}

// Chaque document : titre + sections [titre, paragraphes…]. {variable} = remplacée.
const DOCUMENTS = {
  conditions: {
    en: {
      titre: 'Terms of use',
      sections: [
        ['1. Purpose', 'Nadwa is an online collaboration platform: teams, channels, conversations, file sharing, video meetings and a shared calendar. It is published by {editeur}. By creating an account, you accept these terms.'],
        ['2. Your account', 'You give accurate information and confirm your email address. You keep your password secret and are responsible for what is done with your account. Pupils under 18 use Nadwa within their school or university, or with their parents\' consent.'],
        ['3. Free period, then paid plans', 'Nadwa is free for {gratuit}. After that, some features will become paid; a limited free plan will remain. You will be informed at least 3 months before the end of the free period, and nothing will be charged unless you subscribe yourself.'],
        ['4. Acceptable use', 'It is forbidden to publish illegal, hateful, violent or defamatory content; to harass other people; to send spam; to try to access other people\'s accounts or to disrupt the service; and to record a meeting without the participants\' consent.'],
        ['5. Your content', 'Messages, files and other content remain yours. You allow Nadwa to store and display them to the people you share them with, only to provide the service. You are responsible for the content you publish.'],
        ['6. Availability and limits', 'We do our best to keep Nadwa available and secure, but cannot guarantee uninterrupted service. To keep the platform fair for everyone, usage limits may apply (number of participants, meeting length, simultaneous meetings).'],
        ['7. Suspension and deletion', 'An account that breaks these terms may be suspended or deleted. You can delete your account at any time from "My profile".'],
        ['8. Personal data', 'How your data is handled is described in the <a href="/confidentialite?lang=en">Privacy policy</a>.'],
        ['9. Changes', 'These terms may change; you will be informed of important changes in Nadwa or by email.'],
        ['10. Applicable law', 'These terms are governed by Algerian law. Any dispute that cannot be settled amicably falls under the jurisdiction of the competent Algerian courts.'],
        ['11. Contact', 'Questions: {contact}.'],
      ],
    },
    fr: {
      titre: "Conditions d'utilisation",
      sections: [
        ['1. Objet', "Nadwa est une plateforme de collaboration en ligne : équipes, canaux, conversations, partage de fichiers, réunions en visio et agenda partagé. Elle est éditée par {editeur}. En créant un compte, vous acceptez ces conditions."],
        ['2. Votre compte', "Vous donnez des informations exactes et confirmez votre adresse e-mail. Vous gardez votre mot de passe secret et êtes responsable de l'usage de votre compte. Les élèves de moins de 18 ans utilisent Nadwa dans le cadre de leur établissement, ou avec l'accord de leurs parents."],
        ['3. Période gratuite, puis offres payantes', "Nadwa est gratuite pendant {gratuit}. Ensuite, certaines fonctions deviendront payantes ; une offre gratuite limitée restera disponible. Vous serez prévenu au moins 3 mois avant la fin de la gratuité, et rien ne vous sera facturé sans que vous ayez vous-même souscrit."],
        ['4. Bon usage', "Il est interdit de publier des contenus illicites, haineux, violents ou diffamatoires ; de harceler d'autres personnes ; d'envoyer des messages indésirables ; de tenter d'accéder aux comptes d'autrui ou de perturber le service ; d'enregistrer une réunion sans l'accord des participants."],
        ['5. Vos contenus', "Vos messages, fichiers et autres contenus restent les vôtres. Vous autorisez Nadwa à les stocker et à les afficher aux personnes avec qui vous les partagez, uniquement pour rendre le service. Vous êtes responsable des contenus que vous publiez."],
        ['6. Disponibilité et limites', "Nous faisons de notre mieux pour que Nadwa reste disponible et sûre, sans pouvoir garantir un service sans interruption. Pour que la plateforme reste équitable, des limites d'usage peuvent s'appliquer (nombre de participants, durée des réunions, réunions simultanées)."],
        ['7. Suspension et suppression', "Un compte qui ne respecte pas ces conditions peut être suspendu ou supprimé. Vous pouvez supprimer votre compte à tout moment depuis « Mon profil »."],
        ['8. Données personnelles', 'Le traitement de vos données est décrit dans la <a href="/confidentialite?lang=fr">Politique de confidentialité</a>.'],
        ['9. Modifications', 'Ces conditions peuvent évoluer ; les changements importants vous seront annoncés dans Nadwa ou par e-mail.'],
        ['10. Droit applicable', "Ces conditions sont soumises au droit algérien. Tout litige qui ne peut être réglé à l'amiable relève des juridictions algériennes compétentes."],
        ['11. Contact', 'Questions : {contact}.'],
      ],
    },
    ar: {
      titre: 'شروط الاستخدام',
      sections: [
        ['1. الغرض', 'ندوة منصة تعاون عبر الإنترنت: فرق، وقنوات، ومحادثات، ومشاركة ملفات، واجتماعات مرئية، وتقويم مشترك. تنشرها {editeur}. بإنشائك حسابًا فإنك تقبل هذه الشروط.'],
        ['2. حسابك', 'تقدّم معلومات صحيحة وتؤكد عنوان بريدك الإلكتروني. تحافظ على سرية كلمة المرور وتتحمل مسؤولية استخدام حسابك. يستخدم التلاميذ دون 18 سنة ندوة في إطار مؤسستهم التعليمية أو بموافقة أوليائهم.'],
        ['3. فترة مجانية ثم عروض مدفوعة', 'ندوة مجانية لمدة {gratuit}. بعد ذلك ستصبح بعض الخدمات مدفوعة، مع الإبقاء على عرض مجاني محدود. سيتم إعلامك قبل 3 أشهر على الأقل من نهاية الفترة المجانية، ولن يُطلب منك أي دفع ما لم تشترك بنفسك.'],
        ['4. حسن الاستخدام', 'يُمنع نشر محتوى غير قانوني أو يحض على الكراهية أو العنف أو التشهير، ومضايقة الآخرين، وإرسال الرسائل المزعجة، ومحاولة الدخول إلى حسابات الغير أو تعطيل الخدمة، وتسجيل اجتماع دون موافقة المشاركين.'],
        ['5. محتواك', 'تبقى رسائلك وملفاتك وسائر محتواك ملكًا لك. وتأذن لندوة بتخزينها وعرضها على الأشخاص الذين تشاركها معهم، لغرض تقديم الخدمة فقط. وأنت مسؤول عن المحتوى الذي تنشره.'],
        ['6. التوفر والحدود', 'نبذل قصارى جهدنا لتبقى ندوة متاحة وآمنة، دون أن نضمن خدمة بلا انقطاع. ولضمان الإنصاف بين الجميع، قد تُطبّق حدود للاستخدام (عدد المشاركين، مدة الاجتماعات، الاجتماعات المتزامنة).'],
        ['7. التعليق والحذف', 'يمكن تعليق أو حذف أي حساب يخالف هذه الشروط. ويمكنك حذف حسابك في أي وقت من «ملفي الشخصي».'],
        ['8. البيانات الشخصية', 'تُوضَّح معالجة بياناتك في <a href="/confidentialite?lang=ar">سياسة الخصوصية</a>.'],
        ['9. التعديلات', 'قد تتغير هذه الشروط، وسيتم إعلامك بالتغييرات المهمة داخل ندوة أو عبر البريد الإلكتروني.'],
        ['10. القانون المطبق', 'تخضع هذه الشروط للقانون الجزائري. وكل نزاع يتعذر حله وديًا يكون من اختصاص الجهات القضائية الجزائرية المختصة.'],
        ['11. التواصل', 'للاستفسار: {contact}.'],
      ],
    },
  },

  confidentialite: {
    en: {
      titre: 'Privacy policy',
      sections: [
        ['1. Who is responsible', 'The data controller is {editeur}. Contact for any question or request about your data: {contact}. Nadwa follows Algerian law 18-07 on the protection of personal data, as amended.'],
        ['2. Data we collect', 'Account: name, email address, password (stored encrypted, never in plain text), language, presence status and notification settings. Content: teams, channels, messages, conversations, shared files, meetings and invitations. Notifications: an anonymous token for your device if you enable notifications. Support: messages sent to support and meeting-quality ratings. Video meetings are not recorded: sound and video are only transmitted live.'],
        ['3. Why', 'To create and manage your account; to let you work with your teams; to hold video meetings; to send verification emails, meeting reminders and notifications; to answer support requests and improve quality; after the free period, to manage subscriptions.'],
        ['4. Where your data is stored', 'Your data is hosted {lieu}.'],
        ['5. Who can see it', 'Members of your teams see your name, status and what you share with them. Our providers only process data to run the service: the hosting provider, the email sending service (Brevo), your browser\'s notification service (Google, Mozilla or Apple) and Cloudflare (domain name). Your data is never sold or used for advertising.'],
        ['6. How long', 'Your account and content are kept as long as your account exists. Teams and their files are deleted when the team is deleted. Verification links expire within 48 hours. Support messages and ratings are kept for 2 years. Usage statistics contain no identity.'],
        ['7. Security', 'Encrypted connections (HTTPS), encrypted passwords, email verification, private meeting rooms, access to teams limited to their members, and daily backups.'],
        ['8. Your rights', 'You can access, correct and delete your data and object to notifications. From "My profile": download your data and delete your account. For anything else, write to {contact}. You can also file a complaint with the national authority for personal data protection (ANPDP).'],
        ['9. Cookies', 'Nadwa only uses one cookie, needed to keep you signed in, and stores your language choice in your browser. No advertising or tracking cookies.'],
        ['10. Changes', 'This policy may change; you will be informed of important changes. Version {version}.'],
      ],
    },
    fr: {
      titre: 'Politique de confidentialité',
      sections: [
        ['1. Responsable', "Le responsable du traitement est {editeur}. Contact pour toute question ou demande sur vos données : {contact}. Nadwa respecte la loi algérienne 18-07 relative à la protection des données personnelles, telle que modifiée."],
        ['2. Données collectées', "Compte : nom, adresse e-mail, mot de passe (stocké chiffré, jamais en clair), langue, statut de présence et réglages de notification. Contenus : équipes, canaux, messages, conversations, fichiers partagés, réunions et invitations. Notifications : un jeton anonyme de votre appareil si vous activez les notifications. Assistance : messages envoyés au support et évaluations de qualité des réunions. Les réunions vidéo ne sont pas enregistrées : le son et l'image sont seulement transmis en direct."],
        ['3. Pourquoi', "Créer et gérer votre compte ; vous permettre de travailler avec vos équipes ; tenir les réunions en visio ; envoyer les e-mails de vérification, les rappels de réunion et les notifications ; répondre au support et améliorer la qualité ; après la période gratuite, gérer les abonnements."],
        ['4. Où sont vos données', 'Vos données sont hébergées {lieu}.'],
        ['5. Qui peut les voir', "Les membres de vos équipes voient votre nom, votre statut et ce que vous partagez avec eux. Nos prestataires ne traitent les données que pour faire fonctionner le service : l'hébergeur, le service d'envoi d'e-mails (Brevo), le service de notifications de votre navigateur (Google, Mozilla ou Apple) et Cloudflare (nom de domaine). Vos données ne sont jamais vendues ni utilisées pour de la publicité."],
        ['6. Durée de conservation', "Votre compte et vos contenus sont conservés tant que votre compte existe. Une équipe et ses fichiers sont effacés quand l'équipe est supprimée. Les liens de vérification expirent sous 48 heures. Les messages au support et les évaluations sont gardés 2 ans. Les statistiques d'usage ne contiennent aucune identité."],
        ['7. Sécurité', "Connexions chiffrées (HTTPS), mots de passe chiffrés, vérification de l'adresse e-mail, salles de visio privées, accès aux équipes réservé à leurs membres, sauvegardes quotidiennes."],
        ['8. Vos droits', "Vous pouvez accéder à vos données, les rectifier, les effacer et vous opposer aux notifications. Depuis « Mon profil » : télécharger vos données et supprimer votre compte. Pour toute autre demande, écrivez à {contact}. Vous pouvez aussi saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP)."],
        ['9. Cookies', "Nadwa n'utilise qu'un cookie, nécessaire pour rester connecté, et garde votre choix de langue dans votre navigateur. Aucun cookie publicitaire ni traceur."],
        ['10. Modifications', 'Cette politique peut évoluer ; les changements importants vous seront annoncés. Version {version}.'],
      ],
    },
    ar: {
      titre: 'سياسة الخصوصية',
      sections: [
        ['1. المسؤول', 'المسؤول عن المعالجة هو {editeur}. للتواصل بشأن أي سؤال أو طلب يخص بياناتك: {contact}. تلتزم ندوة بالقانون الجزائري 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي، كما عُدّل.'],
        ['2. البيانات التي نجمعها', 'الحساب: الاسم، البريد الإلكتروني، كلمة المرور (مخزّنة مشفّرة ولا تُحفظ أبدًا كنص واضح)، اللغة، حالة التواجد وإعدادات الإشعارات. المحتوى: الفرق، القنوات، الرسائل، المحادثات، الملفات المشتركة، الاجتماعات والدعوات. الإشعارات: رمز مجهول لجهازك إذا فعّلت الإشعارات. الدعم: الرسائل المرسلة إلى الدعم وتقييمات جودة الاجتماعات. لا تُسجَّل الاجتماعات المرئية: يُنقل الصوت والصورة مباشرة فقط.'],
        ['3. لماذا', 'إنشاء حسابك وإدارته؛ تمكينك من العمل مع فرقك؛ عقد الاجتماعات المرئية؛ إرسال رسائل التحقق وتذكيرات الاجتماعات والإشعارات؛ الرد على طلبات الدعم وتحسين الجودة؛ وبعد الفترة المجانية، إدارة الاشتراكات.'],
        ['4. أين تُخزَّن بياناتك', 'تُستضاف بياناتك {lieu}.'],
        ['5. من يمكنه الاطلاع عليها', 'يرى أعضاء فرقك اسمك وحالتك وما تشاركه معهم. لا يعالج مزوّدونا البيانات إلا لتشغيل الخدمة: مزوّد الاستضافة، وخدمة إرسال البريد الإلكتروني (Brevo)، وخدمة إشعارات متصفحك (Google أو Mozilla أو Apple)، وCloudflare (اسم النطاق). لا تُباع بياناتك أبدًا ولا تُستخدم للإعلانات.'],
        ['6. مدة الاحتفاظ', 'يُحتفظ بحسابك ومحتواك ما دام حسابك قائمًا. تُحذف الفرقة وملفاتها عند حذفها. تنتهي صلاحية روابط التحقق خلال 48 ساعة. تُحفظ رسائل الدعم والتقييمات لمدة سنتين. لا تحتوي إحصاءات الاستخدام على أي هوية.'],
        ['7. الأمان', 'اتصالات مشفّرة (HTTPS)، كلمات مرور مشفّرة، التحقق من البريد الإلكتروني، قاعات اجتماعات خاصة، دخول الفرق مقصور على أعضائها، ونسخ احتياطية يومية.'],
        ['8. حقوقك', 'يحق لك الاطلاع على بياناتك وتصحيحها وحذفها والاعتراض على الإشعارات. من «ملفي الشخصي»: تنزيل بياناتك وحذف حسابك. ولأي طلب آخر راسلنا على {contact}. كما يمكنك تقديم شكوى إلى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي (ANPDP).'],
        ['9. ملفات تعريف الارتباط', 'لا تستخدم ندوة سوى ملف تعريف ارتباط واحد ضروري لإبقائك متصلًا، وتحفظ اختيارك للغة في متصفحك. لا توجد ملفات تعريف ارتباط إعلانية أو للتتبع.'],
        ['10. التعديلات', 'قد تتغير هذه السياسة، وسيتم إعلامك بالتغييرات المهمة. الإصدار {version}.'],
      ],
    },
  },
};

const LIBELLES = {
  en: { autres: 'Other languages', retour: 'Back to Nadwa', maj: 'Version' },
  fr: { autres: 'Autres langues', retour: 'Retour à Nadwa', maj: 'Version' },
  ar: { autres: 'لغات أخرى', retour: 'العودة إلى ندوة', maj: 'الإصدار' },
};
const NOMS_LANGUES = { en: 'English', fr: 'Français', ar: 'العربية' };

function langueDemandee(req) {
  const q = String(req.query.lang || '').slice(0, 2);
  if (LANGUES.includes(q)) return q;
  const accept = String(req.get('accept-language') || '').toLowerCase();
  return LANGUES.find((l) => accept.startsWith(l)) || 'fr';
}

/** Page HTML complète d'un document. */
function page(nomDoc, langue) {
  const doc = DOCUMENTS[nomDoc][langue];
  const v = variables(langue);
  const remplir = (s) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  const l = LIBELLES[langue];
  const autres = LANGUES.filter((x) => x !== langue).map((x) => `<a href="/${nomDoc}?lang=${x}" lang="${x}">${NOMS_LANGUES[x]}</a>`).join(' · ');
  return `<!doctype html>
<html lang="${langue}" dir="${langue === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.titre)} · Nadwa</title>
<link rel="icon" type="image/png" href="/icones/icone-192.png">
<link rel="stylesheet" href="/legal.css">
</head>
<body>
<main>
  <p class="haut"><a href="/">${langue === 'ar' ? '→' : '←'} ${l.retour}</a><span>${autres}</span></p>
  <h1>${esc(doc.titre)}</h1>
  ${doc.sections.map(([titre, texte]) => `<h2>${esc(titre)}</h2><p>${remplir(texte)}</p>`).join('\n  ')}
  <p class="version">${l.maj} ${VERSION}</p>
</main>
</body>
</html>`;
}

/** Routes /conditions et /confidentialite. */
function brancher(app) {
  for (const nomDoc of Object.keys(DOCUMENTS)) {
    app.get(`/${nomDoc}`, (req, res) => res.set('Cache-Control', 'no-cache').type('html').send(page(nomDoc, langueDemandee(req))));
  }
}

/** Informations publiques affichées sur la page d'accueil. */
function infos() {
  const fin = finGratuite();
  return { mois_gratuits: config.moisGratuits, gratuit_jusqu_au: fin ? fin.toISOString().slice(0, 10) : null, conditions_version: VERSION, limites: config.limites };
}

module.exports = { VERSION, brancher, infos };
