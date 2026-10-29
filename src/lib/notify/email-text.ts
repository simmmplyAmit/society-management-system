// Email wording in Hindi and Marathi. English emails keep the wording in templates.ts unchanged.
// Values are plain text: templates.ts escapes them before putting them into HTML.
// SMS stays English: every SMS template in another language needs its own DLT approval.

export type EmailLocale = "hi" | "mr";

export interface EmailText {
  greeting: (name: string) => string;
  maintenance: string;
  labels: { flat: string; amount: string; payTo: string; period: string; balance: string; paidOn: string; reference: string; note: string };
  otp: {
    subject: (code: string) => string;
    reasons: Record<string, string>;
    intro: string;
    ignore: string;
    text: (code: string) => string;
  };
  due: {
    subjectNew: (what: string, amount: string, period: string) => string;
    subjectReminder: (what: string, amount: string, period: string) => string;
    headingNew: (what: string) => string;
    headingReminder: (what: string) => string;
    /** Sentence with the period in bold; `period` is already escaped HTML. */
    lineNew: (what: string, periodHtml: string) => string;
    lineReminder: (what: string, periodHtml: string) => string;
    paidSoFar: (paid: string) => string;
    payUpi: (upi: string) => string;
    payOther: string;
    seeDues: (link: string) => string;
    button: string;
  };
  receipt: {
    subject: (amount: string, period: string) => string;
    heading: string;
    intro: (name: string) => string;
    today: string;
    text: (a: { name: string; amount: string; what: string; period: string; flat: string; paidOn: string; utr?: string | null; balance?: string; society: string }) => string;
  };
  credit: {
    subject: (amount: string, expense: string) => string;
    heading: string;
    /** `amountHtml` and `expenseHtml` are already escaped HTML. */
    body: (amountHtml: string, expenseHtml: string) => string;
    note: string;
    button: string;
    text: (a: { name: string; amount: string; expense: string; society: string; link: string }) => string;
  };
  notice: {
    urgentPrefix: string;
    button: string;
    text: (a: { society: string; category: string; title: string; excerpt: string; link: string }) => string;
  };
  complaint: {
    raised: string;
    reply: string;
    status: string;
    review: string;
    view: string;
    statusDetail: (status: string, note?: string | null) => string;
    text: (a: { society: string; heading: string; title: string; actor: string; detail: string; link: string }) => string;
  };
}

const hi: EmailText = {
  greeting: (name) => `नमस्ते ${name},`,
  maintenance: "मेंटेनेंस",
  labels: { flat: "फ़्लैट", amount: "राशि", payTo: "UPI पर भुगतान करें", period: "अवधि", balance: "बाकी बकाया", paidOn: "भुगतान की तारीख", reference: "रेफ़रेंस", note: "नोट" },
  otp: {
    subject: (code) => `${code} आपका Society MS कोड है`,
    reasons: {
      "Verify your email address": "अपना ईमेल सत्यापित करें",
      "Verify your mobile number": "अपना मोबाइल नंबर सत्यापित करें",
      "Reset your password": "अपना पासवर्ड बदलें",
    },
    intro: "आगे बढ़ने के लिए यह कोड इस्तेमाल करें। यह 10 मिनट तक मान्य है।",
    ignore: "अगर आपने यह नहीं माँगा था, तो इस ईमेल को अनदेखा करें। यह कोड कभी किसी को न बताएँ।",
    text: (code) => `आपका Society MS कोड ${code} है। यह 10 मिनट तक मान्य है। इसे किसी को न बताएँ।`,
  },
  due: {
    subjectNew: (what, amount, period) => `${period} का ${what} बकाया: ${amount}`,
    subjectReminder: (what, amount, period) => `याद दिलाना: ${period} का ${what} ${amount} बाकी है`,
    headingNew: (what) => `${what} बकाया`,
    headingReminder: (what) => `${what} की याद`,
    lineNew: (what, period) => `<b>${period}</b> का आपका ${what} बाकी है`,
    lineReminder: (what, period) => `याद दिला रहे हैं कि <b>${period}</b> का आपका ${what} बाकी है`,
    paidSoFar: (paid) => ` (${paid} पहले ही भरा जा चुका है, यह बाकी राशि है)`,
    payUpi: (upi) => `${upi} पर UPI से भुगतान करें।`,
    payOther: "कृपया अपनी सोसाइटी के निर्देशों के अनुसार भुगतान करें।",
    seeDues: (link) => `अपना बकाया देखने के लिए ${link} खोलें।`,
    button: "बकाया देखें",
  },
  receipt: {
    subject: (amount, period) => `भुगतान मिला: ${period} के लिए ${amount}`,
    heading: "भुगतान मिला",
    intro: (name) => `नमस्ते ${name}, धन्यवाद! हमने आपका भुगतान दर्ज कर लिया है।`,
    today: "आज",
    text: (a) =>
      `नमस्ते ${a.name}, हमें ${a.period} (${a.flat}) के ${a.what} के लिए ${a.amount} ${a.paidOn} को मिले${a.utr ? `, रेफ़रेंस ${a.utr}` : ""}।${a.balance ? ` बाकी बकाया: ${a.balance}।` : ""} धन्यवाद! - ${a.society}`,
  },
  credit: {
    subject: (amount, expense) => `“${expense}” के लिए ${amount} क्रेडिट किए गए`,
    heading: "खर्च का क्रेडिट जोड़ा गया",
    body: (amount, expense) => `आपने सोसाइटी की ओर से <b>${expense}</b> का भुगतान किया, इसलिए आपके खाते में <b>${amount}</b> क्रेडिट किए गए हैं।`,
    note: "यह अपने आप आपके मेंटेनेंस बकाये में लगेगा। क्रेडिट सिर्फ़ बकाये के लिए इस्तेमाल हो सकता है।",
    button: "मेरा क्रेडिट देखें",
    text: (a) =>
      `नमस्ते ${a.name}, आपने सोसाइटी की ओर से "${a.expense}" का भुगतान किया, इसलिए ${a.society} में आपके खाते में ${a.amount} क्रेडिट किए गए हैं। यह अपने आप आपके मेंटेनेंस बकाये में लगेगा। अपना क्रेडिट देखने के लिए ${a.link} खोलें।`,
  },
  notice: {
    urgentPrefix: "ज़रूरी: ",
    button: "सूचनाएँ खोलें",
    text: (a) => `${a.society} की सूचना (${a.category}): ${a.title}\n\n${a.excerpt}\n\nऐप में पढ़ें: ${a.link}`,
  },
  complaint: {
    raised: "नई शिकायत",
    reply: "आपकी शिकायत पर नया जवाब",
    status: "आपकी शिकायत में बदलाव हुआ",
    review: "शिकायत देखें",
    view: "शिकायत देखें",
    statusDetail: (status, note) => `स्थिति: ${status}${note ? `। ${note}` : ""}`,
    text: (a) => `${a.society}: ${a.heading} - "${a.title}"। ${a.actor}: ${a.detail}\n\nखोलें: ${a.link}`,
  },
};

const mr: EmailText = {
  greeting: (name) => `नमस्कार ${name},`,
  maintenance: "मेंटेनन्स",
  labels: { flat: "फ्लॅट", amount: "रक्कम", payTo: "UPI वर भरा", period: "कालावधी", balance: "बाकी थकबाकी", paidOn: "भरण्याची तारीख", reference: "रेफरन्स", note: "नोंद" },
  otp: {
    subject: (code) => `${code} हा तुमचा Society MS कोड आहे`,
    reasons: {
      "Verify your email address": "तुमचा ईमेल पडताळा",
      "Verify your mobile number": "तुमचा मोबाइल नंबर पडताळा",
      "Reset your password": "तुमचा पासवर्ड बदला",
    },
    intro: "पुढे जाण्यासाठी हा कोड वापरा. तो 10 मिनिटे वैध आहे.",
    ignore: "तुम्ही हे मागितले नसल्यास, हा ईमेल दुर्लक्षित करा. हा कोड कधीही कोणालाही सांगू नका.",
    text: (code) => `तुमचा Society MS कोड ${code} आहे. तो 10 मिनिटे वैध आहे. तो कोणालाही सांगू नका.`,
  },
  due: {
    subjectNew: (what, amount, period) => `${period} चा ${what} थकबाकी: ${amount}`,
    subjectReminder: (what, amount, period) => `आठवण: ${period} चा ${what} ${amount} बाकी आहे`,
    headingNew: (what) => `${what} थकबाकी`,
    headingReminder: (what) => `${what} ची आठवण`,
    lineNew: (what, period) => `<b>${period}</b> चा तुमचा ${what} बाकी आहे`,
    lineReminder: (what, period) => `आठवण करून देत आहोत की <b>${period}</b> चा तुमचा ${what} बाकी आहे`,
    paidSoFar: (paid) => ` (${paid} आधीच भरले आहेत, ही उरलेली रक्कम आहे)`,
    payUpi: (upi) => `${upi} वर UPI ने भरा.`,
    payOther: "कृपया तुमच्या सोसायटीच्या सूचनेनुसार भरणा करा.",
    seeDues: (link) => `तुमची थकबाकी पाहण्यासाठी ${link} उघडा.`,
    button: "थकबाकी पहा",
  },
  receipt: {
    subject: (amount, period) => `भरणा मिळाला: ${period} साठी ${amount}`,
    heading: "भरणा मिळाला",
    intro: (name) => `नमस्कार ${name}, धन्यवाद! आम्ही तुमचा भरणा नोंदवला आहे.`,
    today: "आज",
    text: (a) =>
      `नमस्कार ${a.name}, आम्हाला ${a.period} (${a.flat}) च्या ${a.what} साठी ${a.amount} ${a.paidOn} रोजी मिळाले${a.utr ? `, रेफरन्स ${a.utr}` : ""}.${a.balance ? ` बाकी थकबाकी: ${a.balance}.` : ""} धन्यवाद! - ${a.society}`,
  },
  credit: {
    subject: (amount, expense) => `“${expense}” साठी ${amount} क्रेडिट केले`,
    heading: "खर्चाचे क्रेडिट जोडले",
    body: (amount, expense) => `तुम्ही सोसायटीच्या वतीने <b>${expense}</b> चा खर्च केला, म्हणून तुमच्या खात्यात <b>${amount}</b> क्रेडिट केले आहेत.`,
    note: "हे आपोआप तुमच्या मेंटेनन्स थकबाकीत वापरले जाईल. क्रेडिट फक्त थकबाकीसाठीच वापरता येते.",
    button: "माझे क्रेडिट पहा",
    text: (a) =>
      `नमस्कार ${a.name}, तुम्ही सोसायटीच्या वतीने "${a.expense}" चा खर्च केला, म्हणून ${a.society} मधील तुमच्या खात्यात ${a.amount} क्रेडिट केले आहेत. हे आपोआप तुमच्या मेंटेनन्स थकबाकीत वापरले जाईल. तुमचे क्रेडिट पाहण्यासाठी ${a.link} उघडा.`,
  },
  notice: {
    urgentPrefix: "तातडीचे: ",
    button: "सूचना उघडा",
    text: (a) => `${a.society} ची सूचना (${a.category}): ${a.title}\n\n${a.excerpt}\n\nॲपमध्ये वाचा: ${a.link}`,
  },
  complaint: {
    raised: "नवीन तक्रार",
    reply: "तुमच्या तक्रारीवर नवीन उत्तर",
    status: "तुमच्या तक्रारीत बदल झाला",
    review: "तक्रार पहा",
    view: "तक्रार पहा",
    statusDetail: (status, note) => `स्थिती: ${status}${note ? `. ${note}` : ""}`,
    text: (a) => `${a.society}: ${a.heading} - "${a.title}". ${a.actor}: ${a.detail}\n\nउघडा: ${a.link}`,
  },
};

const TEXT: Record<EmailLocale, EmailText> = { hi, mr };

/** The wording for a recipient's language, or null for English (templates.ts keeps the English wording). */
export function emailText(locale: string | null | undefined): EmailText | null {
  return locale === "hi" || locale === "mr" ? TEXT[locale] : null;
}
