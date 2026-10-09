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
  /* ---- Complaint progress / gate (added with the progress timeline) ---- */
  'Submitted': 'दर्ज की गई',
  'Assigned': 'सौंपी गई',
  'In progress': 'कार्य जारी',
  'Resolved': 'हल हो गई',
  'Assigned to': 'ज़िम्मेदार',
  'Expected by': 'अपेक्षित तिथि',
  'Waiting': 'प्रतीक्षा में',
  'Waiting for the committee to assign someone.': 'समिति द्वारा किसी को ज़िम्मेदारी सौंपे जाने की प्रतीक्षा है।',
  'Assigned — work will start soon.': 'ज़िम्मेदारी सौंप दी गई है — काम जल्द शुरू होगा।',
  'Work is in progress.': 'काम चल रहा है।',
  'Staff marked it fixed — please confirm below.': 'स्टाफ ने इसे ठीक बताया है — कृपया नीचे पुष्टि करें।',
  'Closed. Thank you for confirming.': 'बंद। पुष्टि के लिए धन्यवाद।',
  'This complaint was closed without action — please contact the office if you have questions.': 'यह शिकायत बिना कार्रवाई के बंद की गई — प्रश्न हों तो कृपया कार्यालय से संपर्क करें।',
  'You reopened this complaint — the staff will look at it again.': 'आपने यह शिकायत दोबारा खोली है — स्टाफ इसे फिर देखेगा।',
  /* ---- Header / nav ---- */
  'Registered Society': 'पंजीकृत सोसाइटी',
  'Follow us on Facebook': 'फेसबुक पर हमें फॉलो करें',
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
  'Register your flat once, pay online or at the office, and get a QR-verified receipt every time.':
    'अपना फ्लैट एक बार पंजीकृत करें, ऑनलाइन या कार्यालय में भुगतान करें, और हर बार QR-सत्यापित रसीद पाएँ।',
  'Register as Resident': 'सदस्य के रूप में पंजीकरण करें',
  'Homes in the Community': 'समुदाय में घर',
  'Residential Towers': 'आवासीय टावर',
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
  "Kids' Play Area": 'बच्चों का खेल क्षेत्र',
  'Jogging Track': 'जॉगिंग ट्रैक',
  'Yoga / Meditation': 'योग / ध्यान',
  '3-Tier Security': '3-स्तरीय सुरक्षा',
  '100% Power Backup': '100% पावर बैकअप',
  'Ample Parking': 'पर्याप्त पार्किंग',
  'Community': 'परिसर',
  'JDA': 'JDA',
  'Select your tower': 'अपना टावर चुनें',

  /* ---- Downloads & dues ---- */
  'Documents': 'दस्तावेज़',
  'Society documents & forms': 'सोसाइटी के दस्तावेज़ एवं फ़ॉर्म',
  "Bylaws, AGM minutes, audited accounts and the forms you'd otherwise have to collect from the office.":
    'उपनियम, वार्षिक बैठक की कार्यवाही, अंकेक्षित लेखे और वे फ़ॉर्म जिनके लिए वरना कार्यालय जाना पड़ता।',
  'No documents have been published yet.': 'अभी तक कोई दस्तावेज़ प्रकाशित नहीं हुआ है।',
  'Documents could not be loaded.': 'दस्तावेज़ लोड नहीं हो सके।',
  'Bylaws': 'उपनियम',
  'AGM Minutes': 'वार्षिक बैठक कार्यवाही',
  'Audited Accounts': 'अंकेक्षित लेखे',
  'Forms': 'फ़ॉर्म',
  'Circular': 'परिपत्र',
  'Other': 'अन्य',
  'Document': 'दस्तावेज़',
  'Outstanding': 'बकाया',
  'Paid in full': 'पूरा भुगतान',
  'Total Due': 'कुल देय',
  'Paid': 'भुगतान किया',
  'Balance': 'शेष',
  'Unpaid': 'अभुगतान',
  'Partially Paid': 'आंशिक भुगतान',
  'Overpaid': 'अधिक भुगतान',
  'Rate not set': 'दर तय नहीं',

  /* ---- Accounts ---- */
  'Accounts': 'लेखा-जोखा',
  'Where your maintenance goes': 'आपका मेंटेनेंस कहाँ जाता है',
  'What the society collected this financial year, and what it was spent on. The same figures the committee presents at the AGM.':
    'इस वित्तीय वर्ष में सोसाइटी ने कितना संग्रह किया और कहाँ खर्च हुआ। वही आँकड़े जो समिति वार्षिक बैठक में प्रस्तुत करती है।',
  'Collected': 'संग्रहित',
  'Spent': 'व्यय',
  'Spending by head': 'मद-वार व्यय',
  'No accounts have been published for this year yet.': 'इस वर्ष का लेखा-जोखा अभी प्रकाशित नहीं हुआ है।',
  'No expenses have been recorded for this year yet.': 'इस वर्ष का कोई खर्च अभी दर्ज नहीं हुआ है।',
  'Accounts could not be loaded.': 'लेखा-जोखा लोड नहीं हो सका।',
  'Security / Guards': 'सुरक्षा / गार्ड',
  'Housekeeping': 'साफ़-सफ़ाई',
  'Electricity': 'बिजली',
  'Water': 'पानी',
  'Lift AMC': 'लिफ़्ट रखरखाव',
  'Generator / Diesel': 'जनरेटर / डीज़ल',
  'Gardening': 'बाग़वानी',
  'Repairs & Maintenance': 'मरम्मत एवं रखरखाव',
  'Office & Admin': 'कार्यालय एवं प्रशासन',
  'Legal / Audit': 'क़ानूनी / अंकेक्षण',
  'Festival & Events': 'त्योहार एवं आयोजन',

  /* ---- Committee ---- */
  'Governance': 'प्रशासन',
  'Your committee': 'आपकी समिति',
  'President': 'अध्यक्ष',
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

  'Select your flat': 'अपना फ्लैट चुनें',
  'Select tower first': 'पहले टावर चुनें',
  'Select': 'चुनें',
  'Ground Floor': 'भूतल',
  'Registered Welfare Society': 'पंजीकृत कल्याण समिति',
  'Approved': 'स्वीकृत',
  'Bina 0 ya +91 ke. 6, 7, 8 ya 9 se shuru hona chahiye.': '0 या +91 के बिना। 6, 7, 8 या 9 से शुरू होना चाहिए।',

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
  'Verified': 'सत्यापित',
  'Rejected': 'अस्वीकृत',
  'Deactivated': 'निष्क्रिय',

  'Download Membership Card': 'सदस्यता कार्ड डाउनलोड करें',
  'Active Member': 'सक्रिय सदस्य',
  'Membership Not Active': 'सदस्यता सक्रिय नहीं है',
  'Active': 'सक्रिय',
  'Inactive': 'निष्क्रिय',
  'Name': 'नाम',

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
  'Pay': 'भुगतान',
  'Payments': 'भुगतान',
  'Complaints': 'शिकायतें',
  'More': 'और',
  'Pay Now': 'अभी भुगतान करें',
  /* v170 — first-time guide */
  'Quick guide': 'छोटी गाइड',
  'How to use this app': 'ऐप कैसे इस्तेमाल करें',
  'Skip': 'छोड़ें',
  'Back': 'पीछे',
  'Next': 'आगे',
  'Got it': 'समझ गया',
  'Welcome to your society app': 'आपकी सोसाइटी के ऐप में स्वागत है',
  'Everything for your flat in one place.': 'आपके फ्लैट की हर चीज़ एक जगह।',
  'See what you owe, and pay it, from Home.': 'Home से देखें कितना बकाया है, और वहीं से भुगतान करें।',
  'Your receipts, complaints, notices and polls are all here.': 'आपकी रसीदें, शिकायतें, नोटिस और पोल सब यहीं हैं।',
  'Pay and get your receipt': 'भुगतान करें और रसीद पाएं',
  'Paying takes about a minute.': 'भुगतान में करीब एक मिनट लगता है।',
  'Open Payments and tap Make a Payment.': 'Payments खोलें और Make a Payment दबाएं।',
  'Pay by UPI, then type the UTR number from your UPI app.': 'UPI से भुगतान करें, फिर अपने UPI ऐप से UTR नंबर यहां लिखें।',
  'Watch it move: Submitted, Verified, Receipt. The receipt PDF appears once the committee verifies it.': 'इसे आगे बढ़ते देखें: Submitted, Verified, Receipt। कमेटी के verify करते ही रसीद का PDF आ जाता है।',
  'Complaints, notices and polls': 'शिकायतें, नोटिस और पोल',
  'Stay in touch with the committee.': 'कमेटी से जुड़े रहें।',
  'Raise a complaint, with a photo, from Complaints.': 'Complaints में फोटो के साथ शिकायत दर्ज करें।',
  'Notices from the committee appear on Home.': 'कमेटी के नोटिस Home पर दिखते हैं।',
  'Vote in polls. It is one vote per flat, and a vote cannot be changed.': 'पोल में वोट दें। हर फ्लैट का एक ही वोट होता है, और वोट बदला नहीं जा सकता।',
  'Make it comfortable': 'इसे अपने हिसाब से बनाएं',
  'The app can be adjusted for you.': 'ऐप को आपके लिए ठीक किया जा सकता है।',
  'Text too small? Open More, then Display, then Text size.': 'अक्षर छोटे लगते हैं? More खोलें, फिर Display, फिर Text size।',
  'To read in Hindi, tap the language switch at the top.': 'हिंदी में पढ़ने के लिए ऊपर भाषा वाला बटन दबाएं।',
  'Add this app to your home screen from your browser menu.': 'ब्राउज़र मेन्यू से इस ऐप को अपनी होम स्क्रीन पर जोड़ें।',
  'Report a problem': 'समस्या बताएं',
  'My Portal': 'मेरा पोर्टल',
  'Edit': 'बदलें',
  'Society': 'सोसाइटी',
  'My home': 'मेरा घर',
  'Help': 'मदद',
  'RWA Core Committee': 'आरडब्ल्यूए कोर कमेटी',
  'Admin': 'एडमिन',
  'Reg.': 'पंजी.',
  'Profile & Family': 'प्रोफ़ाइल और परिवार',
  'Fastest way: sign up with Google': 'सबसे आसान तरीका: Google से साइन अप करें',
  'Sign up with Google': 'Google से साइन अप करें',
  'Continue with Google': 'Google से जारी रखें',
  'What happened?': 'क्या हुआ?',
  'Send report': 'रिपोर्ट भेजें',
  'Something not working?': 'कुछ काम नहीं कर रहा?',
  'Send technical details too (helps us fix it faster)': 'तकनीकी जानकारी भी भेजें (जल्दी ठीक करने में मदद)',
  'What exactly is sent?': 'क्या-क्या भेजा जाता है?',
  'All paid ✓': 'सब चुकता ✓',
  'At the Gate': 'गेट पर',
  'Admin Panel': 'एडमिन पैनल',
  'Bookings, Guests & Suggestions': 'बुकिंग, मेहमान और सुझाव',
  'Profile, Vehicles, Family & Pets': 'प्रोफ़ाइल, वाहन, परिवार और पालतू',
  /* ---- Resident dashboard, payment and complaint forms (added with the v160 Hindi pass) ---- */
  "Complaint": "शिकायत",
  "Visitors": "आगंतुक",
  "Bookings": "बुकिंग",
  "Progress": "प्रगति",
  "FY Statement": "वित्त वर्ष विवरण",
  "No payments yet": "अभी तक कोई भुगतान नहीं",
  "Your verified payments and receipts will appear here.": "आपके सत्यापित भुगतान और रसीदें यहाँ दिखेंगी।",
  "More — Profile, Vehicles, Family & Pets": "और — प्रोफ़ाइल, वाहन, परिवार और पालतू",
  "Profile completeness": "प्रोफ़ाइल कितनी पूरी है",
  "Add a photo · Add your date of birth · Add your anniversary or a family member": "फ़ोटो जोड़ें · जन्म तिथि जोड़ें · सालगिरह या परिवार का सदस्य जोड़ें",
  "Date of Birth": "जन्म तिथि",
  "Family Members": "परिवार के सदस्य",
  "✎ Edit Profile": "✎ प्रोफ़ाइल बदलें",
  "Edit Profile": "प्रोफ़ाइल बदलें",
  "Needs correction": "सुधार चाहिए",
  "Verified by": "सत्यापित",
  "Repeat": "दोबारा",
  "Staff Login": "स्टाफ़ लॉगिन",
  "Gate Login": "गेट लॉगिन",
  "My Vehicles": "मेरे वाहन",
  "✎ Edit": "✎ बदलें",
  "No vehicles on file yet.": "अभी कोई वाहन दर्ज नहीं है।",
  "My Family": "मेरा परिवार",
  "Each family member can carry their own membership card — same QR, since it verifies against this flat's registration.": "परिवार का हर सदस्य अपना सदस्यता कार्ड रख सकता है — QR वही रहता है, क्योंकि यह इस फ़्लैट के पंजीकरण से सत्यापित होता है।",
  "No family members on file yet — add them from Edit Profile.": "अभी कोई परिवार सदस्य दर्ज नहीं है — \"प्रोफ़ाइल बदलें\" से जोड़ें।",
  "My Pets": "मेरे पालतू",
  "+ Add a Pet": "+ पालतू जोड़ें",
  "No pets registered yet.": "अभी कोई पालतू पंजीकृत नहीं है।",
  "My Complaints": "मेरी शिकायतें",
  "+ Raise Complaint": "+ शिकायत दर्ज करें",
  "No complaints yet.": "अभी कोई शिकायत नहीं है।",
  "Book a Facility": "सुविधा बुक करें",
  "Expected Guests": "अपेक्षित मेहमान",
  "Suggestions": "सुझाव",
  "Request to use a shared facility — the committee approves each booking.": "साझा सुविधा के उपयोग का अनुरोध करें — हर बुकिंग समिति मंज़ूर करती है।",
  "+ New Request": "+ नया अनुरोध",
  "No requests yet": "अभी कोई अनुरोध नहीं",
  "Request a facility using the button above.": "ऊपर के बटन से सुविधा का अनुरोध करें।",
  "Add Your Birthday!": "अपना जन्मदिन जोड़ें!",
  "The society will wish you and your family a happy birthday/anniversary on WhatsApp — just fill in your details.": "सोसाइटी आपको और आपके परिवार को WhatsApp पर जन्मदिन/सालगिरह की शुभकामनाएँ देगी — बस अपनी जानकारी भरें।",
  "Fill Now": "अभी भरें",
  "No notices yet": "अभी कोई सूचना नहीं",
  "New notices from the committee will appear here.": "समिति की नई सूचनाएँ यहाँ दिखेंगी।",
  "Visible after login": "लॉगिन के बाद दिखेगा",
  "Full account number, IFSC & branch": "पूरा खाता नंबर, IFSC और शाखा",
  "What's Coming Up": "आगे क्या होने वाला है",
  "Society Calendar": "सोसाइटी कैलेंडर",
  "Nothing coming up yet": "अभी कुछ निर्धारित नहीं",
  "New events, maintenance work, and meetings will appear here.": "नए कार्यक्रम, मेंटेनेंस कार्य और बैठकें यहाँ दिखेंगी।",
  "Have Your Say": "अपनी राय दें",
  "Active Polls": "चालू मतदान",
  "No active polls right now": "अभी कोई मतदान चालू नहीं",
  "New polls will appear here.": "नए मतदान यहाँ दिखेंगे।",
  "No documents yet": "अभी कोई दस्तावेज़ नहीं",
  "Bylaws, minutes, and forms will be published here.": "उप-नियम, बैठकों के कार्यवृत्त और फ़ॉर्म यहाँ प्रकाशित होंगे।",
  "Login / Register": "लॉगिन / रजिस्टर",
  "Staff App →": "स्टाफ ऐप →",
  "Gate App →": "गेट ऐप →",
  "Emergency:": "आपातकाल:",
  "Office": "कार्यालय",
  "A/C Holder": "खाताधारक",
  "Quick actions": "त्वरित कार्य",
  "Financial year for the statement": "विवरण के लिए वित्त वर्ष",
  "All receipts for the selected financial year in one PDF": "चुने हुए वित्त वर्ष की सभी रसीदें एक PDF में",
  "Society location": "सोसाइटी का स्थान",
  "One-Time Membership Fee": "एकमुश्त सदस्यता शुल्क",
  "One-time": "एकमुश्त",
  "Membership fee due": "सदस्यता शुल्क बकाया",
  "Maintenance Invoice": "मेंटेनेंस बिल",
  "Paid so far (verified)": "अब तक चुकाया (सत्यापित)",
  "Membership Fee": "सदस्यता शुल्क",
  "Maintenance": "मेंटेनेंस",
  "Raise a Complaint": "शिकायत दर्ज करें",
  "Where is the problem?": "समस्या कहाँ है?",
  "Select…": "चुनें…",
  "Common Area (lift, lobby, parking, garden…)": "साझा क्षेत्र (लिफ़्ट, लॉबी, पार्किंग, बगीचा…)",
  "Inside My Flat": "मेरे फ़्लैट के अंदर",
  "What is it about?": "यह किस बारे में है?",
  "Plumbing (taps, leakage, drainage)": "प्लंबिंग (नल, रिसाव, नाली)",
  "Electrical (lights, wiring, power)": "बिजली (लाइट, वायरिंग, पावर)",
  "Cleaning / Housekeeping": "सफ़ाई / हाउसकीपिंग",
  "Carpentry / Civil / Repair": "बढ़ईगिरी / सिविल / मरम्मत",
  "Security / Guard": "सुरक्षा / गार्ड",
  "Parking": "पार्किंग",
  "Noise": "शोर",
  "Something else": "कुछ और",
  "Short title": "संक्षिप्त शीर्षक",
  "Describe the problem": "समस्या का विवरण",
  "(optional — problem ki photo laga sakte hain)": "(वैकल्पिक — समस्या की फ़ोटो लगा सकते हैं)",
  "Submit Complaint": "शिकायत भेजें",
  "e.g. Kitchen tap leaking": "जैसे: रसोई का नल टपक रहा है",
  "Aap yahan type karke apni problem bata sakte hain…": "यहाँ लिखकर अपनी समस्या बता सकते हैं…",
  "e.g. Pay Now dabane par kuch nahi hota": "जैसे: \"अभी भुगतान करें\" दबाने पर कुछ नहीं होता",
  "Your name and flat are sent with it. No password, no payment details, no photos.": "इसके साथ आपका नाम और फ़्लैट भेजा जाता है। कोई पासवर्ड, भुगतान विवरण या फ़ोटो नहीं।",
  "Close": "बंद करें",
  'Vaccination date not set': 'टीकाकरण की तारीख़ दर्ज नहीं',
  'Max Heights Majestic RWA. All rights reserved.': 'Max Heights Majestic RWA. सर्वाधिकार सुरक्षित।',
  "Pay with my UPI app": "अपने UPI ऐप से भुगतान करें",
  "Your UPI app opens with the amount already filled in. After paying, come back here and enter the Transaction ID below.": "आपका UPI ऐप राशि भरकर खुलेगा। भुगतान के बाद यहाँ लौटकर नीचे Transaction ID भरें।",
  "Back from your UPI app? If the payment went through, enter its Transaction ID (UTR) below and tap \"I Have Paid\".": "UPI ऐप से लौट आए? भुगतान हो गया हो तो नीचे Transaction ID (UTR) भरें और \"भुगतान कर दिया है\" दबाएँ।",
  "Did not open? Use the QR below, or copy the UPI ID and pay from any UPI app.": "ऐप नहीं खुला? नीचे का QR इस्तेमाल करें, या UPI ID कॉपी करके किसी भी UPI ऐप से भुगतान करें।",
  "Enter a valid amount first (up to ₹1,00,000).": "पहले सही राशि भरें (₹1,00,000 तक)।",
  'Maintenance due': 'मेंटेनेंस बकाया',
  'My complaints': 'मेरी शिकायतें',
  'Documents & Committee': 'दस्तावेज़ और कमेटी',
  'Documents & Contact': 'दस्तावेज़ और संपर्क',
  'For': 'किसलिए',
  'Paid by': 'भुगतान का तरीका',
  'Reference': 'संदर्भ',
  'Next: the committee matches it with the bank record. Your receipt appears under Payments once it is verified.': 'आगे: कमेटी इसे बैंक रिकॉर्ड से मिलाती है। verify होते ही आपकी रसीद Payments में दिखेगी।',
  'View my payments': 'मेरे भुगतान देखें',
  'Membership fee': 'सदस्यता शुल्क',
  'Clubhouse, hall or court — ask for a slot and the committee will confirm.': 'क्लबहाउस, हॉल या कोर्ट — स्लॉट मांगें, कमेटी पुष्टि करेगी।',
  'New request': 'नया अनुरोध',
  'Tell the office who is coming so the gate is ready.': 'ऑफिस को बताएं कि कौन आ रहा है, ताकि गेट पर तैयारी रहे।',
  'Log a guest': 'मेहमान दर्ज करें',
  'Have an idea for the society? The committee reads every one.': 'सोसाइटी के लिए कोई विचार है? कमेटी हर एक पढ़ती है।',
  'Share an idea': 'विचार बताएं',
  'Once you pay, you can follow it here and download the receipt.': 'भुगतान करने के बाद आप उसे यहां देख सकते हैं और रसीद डाउनलोड कर सकते हैं।',
  'Make a payment': 'भुगतान करें',
  'No complaints': 'कोई शिकायत नहीं',
  'Nothing is pending. If something needs fixing, raise a complaint with a photo.': 'कुछ बाकी नहीं है। कुछ ठीक करवाना हो तो फोटो के साथ शिकायत दर्ज करें।',
  'Raise a complaint': 'शिकायत दर्ज करें',
  'Looks right — 12 digits.': 'सही लग रहा है — 12 अंक।',
  'Looks fine.': 'ठीक लग रहा है।',
  'Only letters and numbers, please.': 'कृपया सिर्फ अक्षर और अंक लिखें।',
  'That looks too short for a reference number.': 'रेफरेंस नंबर के लिए यह बहुत छोटा लगता है।',
  'That looks too long — check it once.': 'यह बहुत लंबा लगता है — एक बार जांच लें।',
  'Know your RWA': 'अपनी RWA को जानें',
  'Print version': 'प्रिंट वाला कार्ड',
  'I have read this': 'मैंने पढ़ लिया',
  'You confirmed you have read this': 'आपने पढ़ने की पुष्टि कर दी है',
  'Today': 'आज',
  'Expecting someone today? One tap:': 'आज कोई आ रहा है? बस एक टैप:',
  'Delivery': 'डिलीवरी',
  'Cab': 'कैब',
  'Morning': 'सुबह',
  'Evening': 'शाम',
  'Full Day': 'पूरा दिन',
  'Important numbers': 'ज़रूरी नंबर',
  'Keep handy': 'हाथ में रखें',
  'Neighbours': 'पड़ोसी',
  'Meet your neighbours': 'अपने पड़ोसियों से मिलें',
  'You are in the neighbours list': 'आप पड़ोसियों की सूची में हैं',
  'Other residents who have joined can see your name and flat.': 'जुड़े हुए बाकी निवासी आपका नाम और फ़्लैट देख सकते हैं।',
  'Join to see who lives where. Only residents who join can see the list, and you decide whether your mobile number is shown. Nothing is shown unless you join.': 'जुड़कर देखें कि कौन कहाँ रहता है। सूची सिर्फ़ जुड़े हुए निवासी देख सकते हैं, और मोबाइल नंबर दिखे या नहीं यह आप तय करते हैं। जुड़े बिना कुछ नहीं दिखता।',
  'Also show my mobile number so neighbours can call': 'मेरा मोबाइल नंबर भी दिखाएँ ताकि पड़ोसी फ़ोन कर सकें',
  'Remove me from the list': 'मुझे सूची से हटाएँ',
  'Add me to the list': 'मुझे सूची में जोड़ें',
  'Join the list above to see your neighbours.': 'पड़ोसियों को देखने के लिए ऊपर सूची से जुड़ें।',
  'Could not load the list': 'सूची नहीं खुल सकी',
  'Please try again in a little while.': 'कृपया थोड़ी देर बाद फिर कोशिश करें।',
  'Nobody found': 'कोई नहीं मिला',
  'Try a different name or flat.': 'कोई और नाम या फ़्लैट आज़माएँ।',
  'You are the first one here. Neighbours will appear as they join.': 'आप यहाँ पहले हैं। पड़ोसी जुड़ते ही दिखने लगेंगे।',
  'What is free': 'क्या खाली है',
  'No facilities to show yet.': 'अभी दिखाने के लिए कोई सुविधा नहीं है।',
  'Could not check availability right now.': 'अभी उपलब्धता नहीं देखी जा सकी।',
  'Request': 'अनुरोध करें',
  'Reported': 'दर्ज हुई',
  'Being fixed': 'ठीक हो रही है',
  'Your report': 'आपकी शिकायत',
  'Me too': 'मुझे भी',
  '✓ Me too': '✓ मुझे भी',
  'Emergency': 'आपातकाल',
  'Emergency (all services)': 'आपातकाल (सभी सेवाएँ)',
  'Police': 'पुलिस',
  'Fire': 'दमकल',
  'Ambulance': 'एम्बुलेंस',
  'Security & office': 'सुरक्षा और ऑफ़िस',
  'Lift, water & power': 'लिफ़्ट, पानी और बिजली',
  'Plumber, electrician & helpers': 'प्लंबर, इलेक्ट्रीशियन और सहायक',
  'Arrived': 'पहुँच गए',
  'Be the first to say “me too”': 'सबसे पहले “मुझे भी” कहें',
  '1 neighbour says me too': '1 पड़ोसी कहता है “मुझे भी”',
  'Let neighbours add “me too”. Only the title and category are shown — never your name, flat, photo or details.': 'पड़ोसियों को “मुझे भी” जोड़ने दें। सिर्फ़ शीर्षक और श्रेणी दिखती है — आपका नाम, फ़्लैट, फ़ोटो या ब्योरा कभी नहीं।',
  'Problems neighbours reported': 'पड़ोसियों की बताई समस्याएँ',
  'Seeing the same thing? Tap “Me too” instead of raising it again — the committee sees how many are affected.': 'वही समस्या दिख रही है? दोबारा शिकायत करने की जगह “मुझे भी” दबाएँ — कमेटी देखती है कि कितने लोग प्रभावित हैं।',
  'Expected today': 'आज अपेक्षित',
  'Let in': 'अंदर आने दें',
  'Resident Welfare Society · Jaipur': 'रेज़िडेंट वेलफेयर सोसाइटी · जयपुर',
  'Towers': 'टावर',
  'Flats': 'फ्लैट',
  'The people who run the society on your behalf.': 'वे लोग जो आपकी ओर से सोसाइटी चलाते हैं।',
  'The committee below is elected by the members. For anything about the app, use More → Report a problem; for a problem in the society, raise a complaint.': 'नीचे की कमेटी सदस्यों द्वारा चुनी गई है। ऐप की किसी दिक्कत के लिए More → Report a problem दबाएं; सोसाइटी की समस्या के लिए शिकायत दर्ज करें।',
  'Your payment': 'आपका भुगतान',
  'Being verified': 'जाँच जारी है',
  'You sent the Transaction ID': 'आपने Transaction ID भेज दी',
  'Committee is checking': 'कमेटी जाँच रही है',
  'We match it with the bank record': 'बैंक रिकॉर्ड से मिलान किया जाता है',
  'Receipt issued': 'रसीद जारी',
  'A QR-sealed receipt appears here': 'QR वाली रसीद यहाँ दिखेगी',
  'Still due after this': 'इसके बाद भी बाकी',
  'Or pay cash / cheque at the RWA office': 'या RWA ऑफ़िस में नकद / चेक से भुगतान करें',
  'All paid — thank you': 'सब चुकाया — धन्यवाद',
  'Latest receipt': 'ताज़ा रसीद',
  'Download receipt': 'रसीद डाउनलोड करें',
  'Share receipt on WhatsApp': 'रसीद WhatsApp पर भेजें',
  'Open Payments to download this receipt.': 'यह रसीद डाउनलोड करने के लिए भुगतान स्क्रीन खोलें।',
  // v168
  'Voting may have just closed, or your flat has already voted. Refreshing…': 'हो सकता है मतदान अभी बंद हुआ हो, या आपके फ़्लैट से वोट पड़ चुका हो। ताज़ा किया जा रहा है…',
  'Pending verification': 'जाँच बाकी',
  'Open': 'खुली',
  'In Progress': 'कार्य जारी',
  'Add photo': 'फ़ोटो जोड़ें',
  'The committee hasn\'t set a rate for this year yet.': 'कमेटी ने इस वर्ष की दर अभी तय नहीं की है।',
  'Address not configured yet — set it from the Admin Panel.': 'पता अभी दर्ज नहीं है — एडमिन पैनल से जोड़ें।',
  'Security': 'सुरक्षा',
  'Electrical': 'बिजली',
  'Plumbing': 'प्लंबिंग',
  'Display': 'दिखावट',
  'Text size': 'अक्षरों का आकार',
  'Make everything bigger and easier to read': 'सब कुछ बड़ा और पढ़ने में आसान करें',
  'Receipt': 'रसीद',
  'Voided': 'रद्द',
  // v167 — polls
  'Polls': 'मतदान',
  'Recent results': 'हाल के नतीजे',
  'Closed': 'बंद',
  'Result:': 'नतीजा:',
  'You voted:': 'आपने वोट दिया:',
  'Log in to vote.': 'वोट देने के लिए लॉगिन करें।',
  'Checking your membership…': 'आपकी सदस्यता जाँची जा रही है…',
  'Voting opens once your membership is approved.': 'सदस्यता स्वीकृत होते ही वोट देना शुरू हो जाएगा।',
  'One vote per flat. A vote is final.': 'एक फ़्लैट का एक वोट। दिया गया वोट बदला नहीं जा सकता।',
  'Someone from your flat has already voted — it is one vote per flat.': 'आपके फ़्लैट से किसी ने पहले ही वोट दे दिया है — एक फ़्लैट का एक ही वोट होता है।',
  'Someone from your flat has already voted. It is one vote per flat.': 'आपके फ़्लैट से किसी ने पहले ही वोट दे दिया है। एक फ़्लैट का एक ही वोट होता है।',
  'Your vote has been recorded!': 'आपका वोट दर्ज हो गया!',
  "Couldn't check whether you've already voted on this poll.": 'यह जाँच नहीं हो पाई कि आप इस मतदान में वोट दे चुके हैं या नहीं।'
};

/* Lines that carry a name, number or year can't be listed word for word, so these patterns translate
   the fixed part and keep the rest (e.g. "Welcome, Rahul" → "स्वागत है, Rahul"). */
const PATTERNS = [
  [/^Maintenance · FY (.+)$/, 'रखरखाव · वित्त वर्ष $1'],
  [/^That is (\d+) digits\. A bank UTR has 12 — check it once\.$/, 'यह $1 अंक है। बैंक UTR 12 अंक का होता है — एक बार जांच लें।'],
  [/^(\d+) digits\.$/, '$1 अंक।'],
  [/^Welcome, (.+)$/, 'स्वागत है, $1'],
  [/^Tower (\S+) · Flat (\S+)$/, 'टावर $1 · फ़्लैट $2'],
  [/^(\d+) guests? expected today$/, 'आज $1 मेहमान अपेक्षित'],
  [/^(\d+) guests? arrived$/, '$1 मेहमान पहुँच गए'],
  [/^(\d+) open complaints?$/, '$1 खुली शिकायत'],
  [/^(\d+) polls? open to vote$/, '$1 पोल में वोट बाकी'],
  [/^(\d+) new updates?$/, '$1 नई सूचना'],
  [/^(\d+) neighbours say me too$/, '$1 पड़ोसी कहते हैं “मुझे भी”'],
  [/^(Morning|Evening|Full Day) · (Free|Booked)$/, (m, sl, st) => `${HI[sl] || sl} · ${st === 'Free' ? 'खाली' : 'बुक'}`],
  [/^\((Security|Housekeeping|Maintenance|Electrical|Plumbing|Noise|Parking|Other)\)$/, (m, c) => `(${HI[c] || c})`],
  [/^(\d{2} \w+ \d{4}) · FY (\S+)( · Membership)?$/, (m, d, fy, mem) => `${d} · वित्त वर्ष ${fy}${mem ? ' · सदस्यता' : ''}`],
  [/^Ends in (\d+)h$/, '$1 घंटे में बंद'],
  [/^Ends in (\d+) min$/, '$1 मिनट में बंद'],
  [/^(\d+) days? left$/, '$1 दिन बाकी'],
  [/^(\d+) of (\d+) flats voted$/, '$2 में से $1 फ़्लैट ने वोट दिया'],
  [/^One vote per flat \((.+)\)\. A vote is final\.$/, 'एक फ़्लैट ($1) का एक वोट। दिया गया वोट बदला नहीं जा सकता।'],
  [/^Voting closes (.+)$/, 'मतदान $1 को बंद होगा'],
  [/^Tie — (.+)$/, 'बराबरी — $1'],
  [/^(\d+) votes? so far(?: · (\d+) flats? voted)?$/, (m, v, f) => `अब तक ${v} वोट${f ? ` · ${f} फ़्लैट ने वोट दिया` : ''}`],
  [/^(\d+) votes? in total(?: · (\d+) flats? voted)?$/, (m, v, f) => `कुल ${v} वोट${f ? ` · ${f} फ़्लैट ने वोट दिया` : ''}`],
  [/^Reminder from the committee · (.+)$/, 'कमेटी की ओर से याद दिलाना · $1'],
  [/^Committee reminder: (.+) maintenance \(FY (.+)\) is due\.$/, 'कमेटी की याद दिलाई: $1 मेंटेनेंस (वित्त वर्ष $2) बाकी है।'],
  [/^Committee reminder: (.+) maintenance \(FY (.+)\) and (.+) membership fee are due\.$/, 'कमेटी की याद दिलाई: $1 मेंटेनेंस (वित्त वर्ष $2) और $3 सदस्यता शुल्क बाकी हैं।'],
  [/^Committee reminder: (.+) membership fee is due\.$/, 'कमेटी की याद दिलाई: $1 सदस्यता शुल्क बाकी है।'],
  [/^Maintenance due · FY (.+)$/, 'मेंटेनेंस बकाया · वित्त वर्ष $1'],
  [/^Outstanding · FY (.+)$/, 'बकाया · वित्त वर्ष $1'],
  [/^Paid in full · FY (.+)$/, 'पूरा चुकाया · वित्त वर्ष $1'],
  [/^Maintenance paid for FY (.+)$/, 'वित्त वर्ष $1 का मेंटेनेंस चुकाया गया'],
  [/^Membership fee (₹[\d,]+) is also pending$/, 'सदस्यता शुल्क $1 भी बाकी है'],
  [/^Flat (\S+) · Tower (\S+) charge$/, 'फ़्लैट $1 · टावर $2 शुल्क'],
  [/^(\S+) · Flat (\S+)$/, '$1 · फ़्लैट $2'],
  [/^Reg\. No: (.+)$/, 'पंजीकरण सं.: $1'],
  [/^Vaccination due in (\d+) days?$/, 'टीकाकरण $1 दिन में देय'],
  [/^Vaccination overdue by (\d+) days?$/, 'टीकाकरण $1 दिन से बकाया'],
  [/^Pay the remaining (₹[\d,]+)$/, 'बाकी $1 चुकाएँ'],
  [/^Maintenance for FY (.+) is cleared$/, 'वित्त वर्ष $1 का मेंटेनेंस चुकता है'],
  [/^(\d+) payments$/, '$1 भुगतान'],
  [/^(\d+) open$/, '$1 खुली'],
  [/^(₹[\d,]+) submitted — waiting for the committee to verify$/, '$1 जमा किया — कमेटी की जाँच का इंतज़ार'],
  [/^Maintenance · (.+)$/, 'मेंटेनेंस · $1'],
  [/^Membership · (.+)$/, 'सदस्यता · $1'],
  [/^Event · (.+)$/, 'कार्यक्रम · $1']
];

/** Hindi for an exact English string, a pattern match, or null when there is no translation. */
export function translateText(key) {
  if (HI[key]) return HI[key];
  for (const [re, out] of PATTERNS) if (re.test(key)) return key.replace(re, out);
  return null;
}

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
      const hi = translateText(key);
      if (hi) node.nodeValue = original.replace(key, hi);
    } else {
      node.nodeValue = original;
    }
  });

  ['placeholder', 'title', 'aria-label'].forEach(attr => {
    root.querySelectorAll(`[${attr}]`).forEach(el => {
      captureAttr(el, attr);
      const original = attrOriginals.get(attr).get(el);
      if (original == null) return;
      const hi = currentLang === 'hi' ? translateText(original.trim()) : null;
      el.setAttribute(attr, hi || original);
    });
  });
}

/**
 * Set the text of an element that JavaScript controls dynamically (e.g. the
 * header button that flips between "Resident Login" and "Logout").
 *
 * Plain textContent = 'Logout' breaks under translation: translateSubtree
 * caches each text node's FIRST value ("Resident Login") and, in English,
 * restores that cached value — clobbering the new text. This sets the English
 * source of truth, forgets any stale cache for the element, then renders it in
 * the current language. Call it instead of assigning textContent for such
 * controls.
 */
export function setDynamicLabel(el, englishText) {
  if (!el) return;
  // Drop cached originals for every text node under this element.
  walkTextNodes(el).forEach(node => originals.delete(node));
  el.textContent = englishText;
  // Re-capture the new English text and render it in the active language.
  translateSubtree(el);
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
