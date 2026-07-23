/* ==========================================================================
   MHMRWS Portal — site-wide English / Hindi switching
   ==========================================================================
   HOW IT WORKS
   Rather than tagging every element with data-i18n attributes (easy to forget
   when adding new copy), this walks the DOM once, remembers each text node's
   original English, and swaps it for the Hindi entry below. Switching back to
   English restores the remembered original, so nothing is ever lost.

   TO ADD OR CHANGE A TRANSLATION
   Add an entry to HI keyed by the EXACT English text as it appears on screen.
   Anything without an entry simply stays in English — nothing breaks.

   Proper nouns (Max Heights Majestic, MHMRWS, UPI, NEFT, QR) stay as-is by
   design; transliterating them would make them harder to recognise, not easier.
   ========================================================================== */

export const HI = {
  /* ---- Header / nav ---- */
  'Registered Society': 'पंजीकृत सोसाइटी',
  'About': 'परिचय',
  'Notices': 'सूचनाएँ',
  'Committee': 'समिति',
  'Contact': 'संपर्क',
  'Resident Login': 'सदस्य लॉगिन',
  'Logout': 'लॉगआउट',

  /* ---- Hero ---- */
  'Digital Membership & Payment Portal': 'डिजिटल सदस्यता एवं भुगतान पोर्टल',
  'Membership, payments and receipts — in': 'सदस्यता, भुगतान और रसीदें — एक',
  'one verified record.': 'सत्यापित रिकॉर्ड में।',
  'Register your flat once, pay online or at the office, and receive a QR-verified receipt every single time. No paper registers, no "did it go through?" uncertainty.':
    'अपना फ्लैट एक बार पंजीकृत करें, ऑनलाइन या कार्यालय में भुगतान करें, और हर बार QR-सत्यापित रसीद पाएँ। न कागज़ी रजिस्टर, न "भुगतान पहुँचा या नहीं?" की उलझन।',
  'Register as Resident': 'सदस्य के रूप में पंजीकरण करें',
  'Registered Members': 'पंजीकृत सदस्य',
  'Towers Covered': 'शामिल टावर',
  'QR-Verifiable': 'QR-सत्यापित',
  'Official · Registered · Verified': 'आधिकारिक · पंजीकृत · सत्यापित',

  /* ---- About + process ---- */
  'About the Society': 'सोसाइटी के बारे में',
  'A registered welfare society, run in the open.': 'एक पंजीकृत कल्याण समिति, पूरी पारदर्शिता के साथ।',
  "Max Heights Majestic Resident Welfare Society manages the upkeep, security and shared finances of our community. This portal is how that work stays visible to every member — who's registered, what's been collected, and what every rupee was for.":
    'मैक्स हाइट्स मैजेस्टिक रेजिडेंट वेलफेयर सोसाइटी हमारे परिसर के रखरखाव, सुरक्षा और साझा वित्त का प्रबंधन करती है। यह पोर्टल हर सदस्य को दिखाता है — कौन पंजीकृत है, कितना संग्रह हुआ, और हर रुपया किस काम आया।',
  'REGISTER': 'पंजीकरण',
  'Submit your details once': 'एक बार विवरण भरें',
  'Fill the resident form with your flat, tower and contact details. The committee reviews and approves it.':
    'अपने फ्लैट, टावर और संपर्क विवरण के साथ फ़ॉर्म भरें। समिति उसकी समीक्षा कर स्वीकृति देती है।',
  'PAY': 'भुगतान',
  'Choose how you pay': 'अपना भुगतान माध्यम चुनें',
  'Cash or cheque at the RWA office, or UPI and bank transfer from your phone. Both are tracked identically.':
    'RWA कार्यालय में नकद या चेक, या फ़ोन से UPI और बैंक ट्रांसफ़र। दोनों का रिकॉर्ड एक समान रखा जाता है।',
  'VERIFY': 'सत्यापन',
  'Get a sealed receipt': 'मुहरबंद रसीद प्राप्त करें',
  'Once the Treasurer verifies your payment, a numbered receipt with a scannable QR seal is issued to you.':
    'कोषाध्यक्ष द्वारा भुगतान सत्यापित होते ही, स्कैन-योग्य QR मुहर वाली क्रमांकित रसीद जारी कर दी जाती है।',

  /* ---- Benefits ---- */
  'Why This Portal': 'यह पोर्टल क्यों',
  'Built around one idea: nothing should be "he said, she said."': 'एक ही सोच पर बना: कोई बात "कहा-सुनी" पर न रहे।',
  'One Member ID, for life': 'एक सदस्यता क्रमांक, हमेशा के लिए',
  "Approved once, your MHM ID stays linked to your flat's entire payment history — no re-registration, ever.":
    'एक बार स्वीकृत होने पर आपका MHM क्रमांक आपके फ्लैट के पूरे भुगतान इतिहास से जुड़ा रहता है — दोबारा पंजीकरण की ज़रूरत नहीं।',
  'QR-sealed receipts': 'QR-मुहर वाली रसीदें',
  "Every verified payment issues a receipt with a scannable seal. Anyone can confirm it's genuine, anytime.":
    'हर सत्यापित भुगतान पर स्कैन-योग्य मुहर वाली रसीद मिलती है। कोई भी, कभी भी उसकी सत्यता जाँच सकता है।',
  'Pay your way': 'अपनी सुविधा से भुगतान',
  'Cash or cheque at the office, or UPI and bank transfer from home — both tracked the same way.':
    'कार्यालय में नकद या चेक, या घर से UPI और बैंक ट्रांसफ़र — दोनों का रिकॉर्ड एक समान।',
  'Nothing changes quietly': 'कोई बदलाव चुपचाप नहीं',
  'Every approval, edit and verification is timestamped in an audit trail the committee can always review.':
    'हर स्वीकृति, संशोधन और सत्यापन समय-मुहर के साथ ऑडिट रिकॉर्ड में दर्ज होता है, जिसे समिति कभी भी देख सकती है।',
  'English or Hindi notices': 'अंग्रेज़ी या हिंदी में सूचनाएँ',
  'Society announcements post in both languages, so nobody misses what matters.':
    'सोसाइटी की घोषणाएँ दोनों भाषाओं में जारी होती हैं, ताकि कोई ज़रूरी बात छूटे नहीं।',
  'Built for one hand': 'एक हाथ से चलाने लायक',
  'Register, pay, and pull up a receipt from your phone — no app store, no download needed.':
    'फ़ोन से ही पंजीकरण, भुगतान और रसीद — न ऐप स्टोर, न डाउनलोड।',

  /* ---- Notice board ---- */
  'Notice Board': 'सूचना पट्ट',
  'Latest from the committee': 'समिति की नवीनतम सूचनाएँ',
  'Payment Details on File': 'दर्ज भुगतान विवरण',
  "These are the society's official collection details, configured by the committee.":
    'ये सोसाइटी के आधिकारिक संग्रह विवरण हैं, जो समिति द्वारा दर्ज किए गए हैं।',
  'UPI ID': 'UPI आईडी',
  'Bank': 'बैंक',
  'A/C No.': 'खाता संख्या',
  'IFSC': 'IFSC',
  'Not configured yet — the committee can set these from the Admin Panel.':
    'अभी दर्ज नहीं — समिति एडमिन पैनल से इन्हें भर सकती है।',
  'No notices have been posted yet.': 'अभी तक कोई सूचना जारी नहीं हुई है।',
  'Notices could not be loaded.': 'सूचनाएँ लोड नहीं हो सकीं।',
  'Download attachment': 'संलग्नक डाउनलोड करें',

  /* ---- Our Community ---- */
  'Where We Live': 'हम कहाँ रहते हैं',
  'Max Heights Majestic, Grand Sikar Road': 'मैक्स हाइट्स मैजेस्टिक, ग्रैंड सीकर रोड',
  'Seven towers in the 400-acre Suncity Township, sharing a landscaped podium garden and a six-level clubhouse. These are the common facilities your maintenance contributions keep running.':
    '400 एकड़ के सनसिटी टाउनशिप में सात टावर, एक सुंदर पोडियम गार्डन और छह मंज़िला क्लबहाउस के साथ। ये वही साझा सुविधाएँ हैं जो आपके मेंटेनेंस योगदान से चलती हैं।',
  'The Complex': 'परिसर',
  '70,000 sq.ft. landscaped podium garden': '70,000 वर्ग फुट का लैंडस्केप पोडियम गार्डन',
  'Club Ultima': 'क्लब अल्टिमा',
  '25,000 sq.ft. clubhouse, six levels': '25,000 वर्ग फुट क्लबहाउस, छह मंज़िलें',
  'Rooftop': 'छत पर',
  'Swimming Pool & sun deck': 'स्विमिंग पूल और सन डेक',
  'Swimming Pool': 'स्विमिंग पूल',
  'Gymnasium': 'जिम',
  'Banquet Hall': 'बैंक्वेट हॉल',
  'Home Theatre': 'होम थिएटर',
  "Kids' Play Area": 'बच्चों का खेल क्षेत्र',
  'Jogging Track': 'जॉगिंग ट्रैक',
  'Yoga / Meditation': 'योग / ध्यान',
  '3-Tier Security': '3-स्तरीय सुरक्षा',
  '100% Power Backup': '100% पावर बैकअप',
  'Ample Parking': 'पर्याप्त पार्किंग',
  'Community': 'परिसर',
  'JDA': 'JDA',
  'Approved': 'स्वीकृत',
  'Select your tower': 'अपना टावर चुनें',

  /* ---- Committee ---- */
  'Governance': 'प्रशासन',
  'Your committee': 'आपकी समिति',
  'President': 'अध्यक्ष',
  'Vice President': 'उपाध्यक्ष',
  'Secretary': 'सचिव',
  'Joint Secretary': 'सह-सचिव',
  'Treasurer': 'कोषाध्यक्ष',

  /* ---- Portal / forms ---- */
  'Portal Access': 'पोर्टल प्रवेश',
  'Resident login & registration': 'सदस्य लॉगिन एवं पंजीकरण',
  'Login': 'लॉगिन',
  'New Registration': 'नया पंजीकरण',
  'Email': 'ईमेल',
  'Password': 'पासवर्ड',
  'Log In': 'लॉगिन करें',
  'Forgot password?': 'पासवर्ड भूल गए?',
  'Resident Details': 'सदस्य विवरण',
  'Full Name': 'पूरा नाम',
  "Father's / Husband's Name": 'पिता / पति का नाम',
  'Tower': 'टावर',
  'Flat Number': 'फ्लैट नंबर',
  'Mobile Number': 'मोबाइल नंबर',
  'Occupation': 'व्यवसाय',
  'Owner / Tenant': 'स्वामी / किरायेदार',
  'Owner': 'स्वामी',
  'Tenant': 'किरायेदार',
  'Address': 'पता',
  'Nominee Name': 'नामिती का नाम',
  'Nominee Relation': 'नामिती से संबंध',
  'Uploads': 'दस्तावेज़ अपलोड',
  'Photo': 'फ़ोटो',
  'Aadhaar / PAN': 'आधार / पैन',
  '(optional)': '(वैकल्पिक)',
  'Access-restricted to you and the committee. Fully optional.':
    'केवल आप और समिति ही देख सकते हैं। पूरी तरह वैकल्पिक।',
  'Account': 'खाता',
  'Set Password': 'पासवर्ड बनाएँ',
  'Confirm Password': 'पासवर्ड दोबारा भरें',
  'I declare that the information provided above is true to the best of my knowledge, and I authorize MHMRWS to verify these details.':
    'मैं घोषणा करता/करती हूँ कि ऊपर दी गई जानकारी मेरी जानकारी के अनुसार सत्य है, और मैं MHMRWS को इन विवरणों की पुष्टि करने की अनुमति देता/देती हूँ।',
  'Submit Registration': 'पंजीकरण जमा करें',
  'e.g. Tower B': 'जैसे Tower B',
  'e.g. B-1204': 'जैसे B-1204',
  '10-digit mobile': '10 अंकों का मोबाइल',

  /* ---- Resident dashboard ---- */
  'Your Portal': 'आपका पोर्टल',
  'Welcome back': 'पुनः स्वागत है',
  'Payment History': 'भुगतान इतिहास',
  'Make a Payment': 'भुगतान करें',
  'Your Details': 'आपका विवरण',
  'Member ID': 'सदस्यता क्रमांक',
  'Mobile': 'मोबाइल',
  'Type': 'प्रकार',
  'Nominee': 'नामिती',
  'Download PDF': 'PDF डाउनलोड करें',
  'Print': 'प्रिंट करें',
  'No payment records yet.': 'अभी तक कोई भुगतान रिकॉर्ड नहीं है।',
  'Pending Approval': 'स्वीकृति प्रतीक्षित',
  'Pending Verification': 'सत्यापन प्रतीक्षित',
  'Approved': 'स्वीकृत',
  'Verified': 'सत्यापित',
  'Rejected': 'अस्वीकृत',
  'Deactivated': 'निष्क्रिय',

  /* ---- Payment modal ---- */
  'Cash': 'नकद',
  'Cheque': 'चेक',
  'Visit the RWA office': 'RWA कार्यालय आएँ',
  'UPI / QR Scan': 'UPI / QR स्कैन',
  'Pay instantly from your phone': 'फ़ोन से तुरंत भुगतान करें',
  'Net Banking / Transfer': 'नेट बैंकिंग / ट्रांसफ़र',
  'NEFT / IMPS to society account': 'सोसाइटी खाते में NEFT / IMPS',
  'Amount (₹)': 'राशि (₹)',
  'UTR / Transaction ID': 'UTR / लेन-देन क्रमांक',
  'Payment Screenshot': 'भुगतान का स्क्रीनशॉट',
  'I Have Paid': 'भुगतान कर दिया है',
  'Submit — I Will Pay at Office': 'जमा करें — कार्यालय में भुगतान करूँगा/करूँगी',

  /* ---- Contact ---- */
  'Get in Touch': 'संपर्क करें',
  'Visit or contact the office': 'कार्यालय आएँ या संपर्क करें',
  'Reg. No:': 'पंजीकरण सं.:',

  /* ---- Footer ---- */
  'Portal': 'पोर्टल',
  'Official': 'आधिकारिक',
  'Admin Panel →': 'एडमिन पैनल →',
  'Verify a Receipt →': 'रसीद सत्यापित करें →',
  'Digital membership, payments and records for every resident.':
    'हर सदस्य के लिए डिजिटल सदस्यता, भुगतान और रिकॉर्ड।',
  'All rights reserved.': 'सर्वाधिकार सुरक्षित।',
  'MHMRWS Digital Portal': 'MHMRWS डिजिटल पोर्टल',

  /* ---- Mobile tab bar ---- */
  'Home': 'होम',
  'Pay': 'भुगतान'
};

/* -------------------------------------------------------------------------
   Engine
   ------------------------------------------------------------------------- */

const STORAGE_KEY = 'mhmrws-lang';
const originals = new Map();      // node -> original English string
const attrOriginals = new Map();  // "attr" -> Map(element -> original)
let captured = false;
let currentLang = 'en';

function captureNode(node) {
  if (!originals.has(node)) originals.set(node, node.nodeValue);
}

function walkTextNodes(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const parent = n.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Never touch code-like or script content
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'svg') return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
      return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const out = [];
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

function captureAttr(el, attr) {
  if (!attrOriginals.has(attr)) attrOriginals.set(attr, new Map());
  const m = attrOriginals.get(attr);
  if (!m.has(el)) m.set(el, el.getAttribute(attr));
}

/** Translate a subtree. Call after rendering any dynamic content. */
export function translateSubtree(root = document.body) {
  walkTextNodes(root).forEach(node => {
    const original = originals.has(node) ? originals.get(node) : node.nodeValue;
    captureNode(node);
    if (currentLang === 'hi') {
      const key = original.trim();
      if (HI[key]) node.nodeValue = original.replace(key, HI[key]);
    } else {
      node.nodeValue = original;
    }
  });

  ['placeholder', 'title', 'aria-label'].forEach(attr => {
    root.querySelectorAll(`[${attr}]`).forEach(el => {
      captureAttr(el, attr);
      const original = attrOriginals.get(attr).get(el);
      if (original == null) return;
      el.setAttribute(attr, currentLang === 'hi' && HI[original.trim()] ? HI[original.trim()] : original);
    });
  });
}

/** Switch the whole page to 'en' or 'hi' and remember the choice. */
export function setLang(lang) {
  currentLang = lang === 'hi' ? 'hi' : 'en';
  captured = true;
  document.documentElement.lang = currentLang;
  translateSubtree(document.body);
  try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) { /* private mode — choice just won't persist */ }
  document.querySelectorAll('[data-lang-btn]').forEach(b =>
    b.classList.toggle('active', b.dataset.langBtn === currentLang)
  );
  window.dispatchEvent(new CustomEvent('mhm:langchange', { detail: { lang: currentLang } }));
}

export function getLang() { return currentLang; }

/** Read the saved preference and apply it. Safe to call before content loads. */
export function initLang() {
  let saved = 'en';
  try { saved = localStorage.getItem(STORAGE_KEY) || 'en'; } catch (e) {}
  setLang(saved);
}
