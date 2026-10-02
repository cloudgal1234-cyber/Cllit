/*
 * נתוני הדגמה (פיקטיביים לחלוטין). נטענים בפעם הראשונה ובעת "איפוס נתוני הדגמה".
 */
(function (root) {
  function daysFromNow(n, hour) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    if (hour != null) d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  }

  function todayAt(h, m) {
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return d.toISOString();
  }

  const DRUGS = [
    { id: 'D01', name: 'פרצטמול 500 מ"ג', ingredient: 'paracetamol', therapeuticClass: 'משככי כאבים', form: 'טבליות', packSize: 20, inBasket: true, price: 18, allergyGroups: [] },
    { id: 'D02', name: 'איבופרופן 400 מ"ג', ingredient: 'ibuprofen', therapeuticClass: 'NSAID', form: 'טבליות', packSize: 20, inBasket: true, price: 24, allergyGroups: ['nsaid'] },
    { id: 'D03', name: 'דיקלופנק 75 מ"ג', ingredient: 'diclofenac', therapeuticClass: 'NSAID', form: 'טבליות', packSize: 20, inBasket: true, price: 30, allergyGroups: ['nsaid'] },
    { id: 'D04', name: 'אמוקסיצילין 500 מ"ג', ingredient: 'amoxicillin', therapeuticClass: 'אנטיביוטיקה - פניצילינים', form: 'כמוסות', packSize: 20, inBasket: true, price: 35, allergyGroups: ['penicillin'] },
    { id: 'D05', name: 'אמוקסיצילין+קלבולנט 875 מ"ג', ingredient: 'amoxicillin-clavulanate', therapeuticClass: 'אנטיביוטיקה - פניצילינים', form: 'טבליות', packSize: 14, inBasket: true, price: 48, allergyGroups: ['penicillin'] },
    { id: 'D06', name: 'צפלקסין 500 מ"ג', ingredient: 'cephalexin', therapeuticClass: 'אנטיביוטיקה - צפלוספורינים', form: 'כמוסות', packSize: 20, inBasket: true, price: 40, allergyGroups: ['cephalosporin'] },
    { id: 'D07', name: 'אזיתרומיצין 250 מ"ג', ingredient: 'azithromycin', therapeuticClass: 'אנטיביוטיקה - מקרולידים', form: 'טבליות', packSize: 6, inBasket: true, price: 42, allergyGroups: ['macrolide'] },
    { id: 'D08', name: 'קלריתרומיצין 500 מ"ג', ingredient: 'clarithromycin', therapeuticClass: 'אנטיביוטיקה - מקרולידים', form: 'טבליות', packSize: 14, inBasket: true, price: 55, allergyGroups: ['macrolide'] },
    { id: 'D09', name: 'סולפמתוקסזול+טרימתופרים', ingredient: 'tmp-smx', therapeuticClass: 'אנטיביוטיקה - סולפונאמידים', form: 'טבליות', packSize: 20, inBasket: true, price: 28, allergyGroups: ['sulfa'] },
    { id: 'D10', name: 'אומפרזול 20 מ"ג', ingredient: 'omeprazole', therapeuticClass: 'מעכבי משאבת פרוטונים', form: 'כמוסות', packSize: 28, inBasket: true, price: 32, allergyGroups: [] },
    { id: 'D11', name: 'מטפורמין 850 מ"ג', ingredient: 'metformin', therapeuticClass: 'סוכרת - ביגואנידים', form: 'טבליות', packSize: 60, inBasket: true, price: 26, allergyGroups: [] },
    { id: 'D12', name: 'אטורבסטטין 20 מ"ג', ingredient: 'atorvastatin', therapeuticClass: 'סטטינים', form: 'טבליות', packSize: 30, inBasket: true, price: 45, allergyGroups: [] },
    { id: 'D13', name: 'סימבסטטין 20 מ"ג', ingredient: 'simvastatin', therapeuticClass: 'סטטינים', form: 'טבליות', packSize: 30, inBasket: true, price: 30, allergyGroups: [] },
    { id: 'D14', name: 'אמלודיפין 5 מ"ג', ingredient: 'amlodipine', therapeuticClass: 'חוסמי תעלות סידן', form: 'טבליות', packSize: 30, inBasket: true, price: 22, allergyGroups: [] },
    { id: 'D15', name: 'רמיפריל 5 מ"ג', ingredient: 'ramipril', therapeuticClass: 'מעכבי ACE', form: 'כמוסות', packSize: 30, inBasket: true, price: 27, allergyGroups: [] },
    { id: 'D16', name: 'לוסרטן 50 מ"ג', ingredient: 'losartan', therapeuticClass: 'חוסמי קולטן לאנגיוטנסין', form: 'טבליות', packSize: 30, inBasket: true, price: 33, allergyGroups: [] },
    { id: 'D17', name: 'ביסופרולול 5 מ"ג', ingredient: 'bisoprolol', therapeuticClass: 'חוסמי בטא', form: 'טבליות', packSize: 30, inBasket: true, price: 21, allergyGroups: [] },
    { id: 'D18', name: 'פורוסמיד 40 מ"ג', ingredient: 'furosemide', therapeuticClass: 'משתנים', form: 'טבליות', packSize: 30, inBasket: true, price: 15, allergyGroups: ['sulfa'] },
    { id: 'D19', name: 'וורפרין 5 מ"ג', ingredient: 'warfarin', therapeuticClass: 'נוגדי קרישה', form: 'טבליות', packSize: 30, inBasket: true, price: 20, allergyGroups: [] },
    { id: 'D20', name: 'אספירין 100 מ"ג', ingredient: 'aspirin', therapeuticClass: 'נוגדי טסיות', form: 'טבליות', packSize: 30, inBasket: true, price: 12, allergyGroups: ['aspirin'], minAge: 16 },
    { id: 'D21', name: 'קלופידוגרל 75 מ"ג', ingredient: 'clopidogrel', therapeuticClass: 'נוגדי טסיות', form: 'טבליות', packSize: 28, inBasket: true, price: 38, allergyGroups: [] },
    { id: 'D22', name: 'לבותירוקסין 100 מק"ג', ingredient: 'levothyroxine', therapeuticClass: 'הורמון בלוטת התריס', form: 'טבליות', packSize: 50, inBasket: true, price: 19, allergyGroups: [] },
    { id: 'D23', name: 'סלבוטמול משאף 100 מק"ג', ingredient: 'salbutamol', therapeuticClass: 'מרחיבי סימפונות', form: 'משאף', packSize: 1, inBasket: true, price: 29, allergyGroups: [] },
    { id: 'D24', name: 'מונטלוקאסט 10 מ"ג', ingredient: 'montelukast', therapeuticClass: 'אסתמה - אנטגוניסטים ללויקוטריאנים', form: 'טבליות', packSize: 28, inBasket: true, price: 52, allergyGroups: [] },
    { id: 'D25', name: 'צטיריזין 10 מ"ג', ingredient: 'cetirizine', therapeuticClass: 'אנטיהיסטמינים', form: 'טבליות', packSize: 20, inBasket: false, price: 34, allergyGroups: [] },
    { id: 'D26', name: 'סרטרלין 50 מ"ג', ingredient: 'sertraline', therapeuticClass: 'SSRI', form: 'טבליות', packSize: 30, inBasket: true, price: 41, allergyGroups: [] },
    { id: 'D27', name: 'פרדניזון 20 מ"ג', ingredient: 'prednisone', therapeuticClass: 'סטרואידים', form: 'טבליות', packSize: 20, inBasket: true, price: 17, allergyGroups: [] },
    { id: 'D28', name: 'אינסולין גלרגין (עט)', ingredient: 'insulin-glargine', therapeuticClass: 'סוכרת - אינסולין', form: 'עט הזרקה', packSize: 5, inBasket: true, price: 210, allergyGroups: [] },
    { id: 'D29', name: 'אוקסיקודון 10 מ"ג', ingredient: 'oxycodone', therapeuticClass: 'אופיואידים', form: 'טבליות', packSize: 20, inBasket: true, price: 64, allergyGroups: ['opioid'], controlled: true, minAge: 18 },
    { id: 'D30', name: 'קלונזפאם 0.5 מ"ג', ingredient: 'clonazepam', therapeuticClass: 'בנזודיאזפינים', form: 'טבליות', packSize: 30, inBasket: true, price: 23, allergyGroups: [], controlled: true, minAge: 18 },
    { id: 'D31', name: 'ויטמין D3 1000 יב"ל', ingredient: 'cholecalciferol', therapeuticClass: 'ויטמינים', form: 'טבליות', packSize: 100, inBasket: false, price: 39, allergyGroups: [] },
    { id: 'D32', name: 'אסומפרזול 40 מ"ג', ingredient: 'esomeprazole', therapeuticClass: 'מעכבי משאבת פרוטונים', form: 'כמוסות', packSize: 28, inBasket: false, price: 89, allergyGroups: [] },
  ];

  const INTERACTIONS = [
    { a: 'warfarin', b: 'aspirin', severity: 'severe', note: 'סיכון מוגבר משמעותית לדימום' },
    { a: 'warfarin', b: 'ibuprofen', severity: 'severe', note: 'סיכון מוגבר לדימום במערכת העיכול' },
    { a: 'warfarin', b: 'diclofenac', severity: 'severe', note: 'סיכון מוגבר לדימום במערכת העיכול' },
    { a: 'warfarin', b: 'clarithromycin', severity: 'severe', note: 'עלייה ב-INR — נדרש ניטור צמוד' },
    { a: 'warfarin', b: 'tmp-smx', severity: 'severe', note: 'עלייה חדה ב-INR' },
    { a: 'warfarin', b: 'clopidogrel', severity: 'moderate', note: 'סיכון מוגבר לדימום' },
    { a: 'simvastatin', b: 'clarithromycin', severity: 'severe', note: 'התווית נגד — סיכון לרבדומיוליזיס' },
    { a: 'atorvastatin', b: 'clarithromycin', severity: 'moderate', note: 'סיכון למיופתיה — לשקול השהיית הסטטין' },
    { a: 'clopidogrel', b: 'omeprazole', severity: 'moderate', note: 'אומפרזול מפחית את יעילות קלופידוגרל' },
    { a: 'sertraline', b: 'ibuprofen', severity: 'moderate', note: 'סיכון מוגבר לדימום' },
    { a: 'sertraline', b: 'aspirin', severity: 'moderate', note: 'סיכון מוגבר לדימום' },
    { a: 'ramipril', b: 'losartan', severity: 'severe', note: 'חסימה כפולה של מערכת RAAS — סיכון להיפרקלמיה ולפגיעה כלייתית' },
    { a: 'oxycodone', b: 'clonazepam', severity: 'severe', note: 'סיכון לדיכוי נשימתי ולתרדמת' },
    { a: 'aspirin', b: 'ibuprofen', severity: 'moderate', note: 'איבופרופן עלול להפחית את ההגנה הלבבית של אספירין' },
    { a: 'aspirin', b: 'clopidogrel', severity: 'minor', note: 'טיפול משולב מקובל בהתוויות מסוימות — לוודא כוונה' },
    { a: 'metformin', b: 'prednisone', severity: 'minor', note: 'סטרואידים מעלים רמות סוכר — לשקול ניטור' },
    { a: 'furosemide', b: 'ibuprofen', severity: 'moderate', note: 'הפחתת היעילות המשתנת וסיכון כלייתי' },
    { a: 'ramipril', b: 'ibuprofen', severity: 'moderate', note: 'הפחתת היעילות ונזק כלייתי אפשרי' },
    { a: 'levothyroxine', b: 'omeprazole', severity: 'minor', note: 'ירידה אפשרית בספיגת לבותירוקסין' },
  ];

  const USERS = [
    { id: 'U1', username: 'doctor', password: '1234', role: 'doctor', name: 'ד"ר נועה לוי', title: 'רפואת משפחה', license: '1-23456', clinic: 'מרפאת הדגמה מרכז' },
    { id: 'U2', username: 'doctor2', password: '1234', role: 'doctor', name: 'ד"ר יוסף חדד', title: 'רפואה פנימית', license: '1-34567', clinic: 'מרפאת הדגמה מרכז' },
    { id: 'U3', username: 'pharm', password: '1234', role: 'pharmacist', name: 'רוקחת מיכל כהן', license: 'R-7788', clinic: 'בית מרקחת הדגמה' },
    { id: 'U4', username: 'patient', password: '1234', role: 'patient', name: 'דוד ישראלי', patientId: '034567891' },
    { id: 'U5', username: 'admin', password: '1234', role: 'admin', name: 'מנהלת המרפאה' },
  ];

  const PATIENTS = [
    { id: '034567891', firstName: 'דוד', lastName: 'ישראלי', birthDate: '1958-04-12', gender: 'זכר', phone: '050-1234567', address: 'רחוב הדקל 4, עיר הדגמה', plan: 'מושלם', allergies: ['penicillin'], chronic: ['יתר לחץ דם', 'סוכרת סוג 2', 'פרפור פרוזדורים'], primaryDoctorId: 'U1' },
    { id: '201456787', firstName: 'שרה', lastName: 'אברהם', birthDate: '1985-09-30', gender: 'נקבה', phone: '052-7654321', address: 'שדרות האלון 18', plan: 'פלטינום', allergies: ['sulfa'], chronic: ['תת פעילות בלוטת התריס'], primaryDoctorId: 'U1' },
    { id: '312778459', firstName: 'מוחמד', lastName: 'עאסי', birthDate: '1972-01-05', gender: 'זכר', phone: '054-1112233', address: 'רחוב הזית 7', plan: 'בסיסי', allergies: [], chronic: ['היפרכולסטרולמיה'], primaryDoctorId: 'U2' },
    { id: '058932146', firstName: 'רחל', lastName: 'גולדברג', birthDate: '1940-11-22', gender: 'נקבה', phone: '03-5556677', address: 'רחוב הורד 2', plan: 'מושלם', allergies: ['nsaid', 'macrolide'], chronic: ['אי ספיקת לב', 'אוסטאופורוזיס'], primaryDoctorId: 'U2' },
    { id: '121212120', firstName: 'נועם', lastName: 'פרץ', birthDate: '2016-06-14', gender: 'זכר', phone: '050-9998877', address: 'רחוב התאנה 11', plan: 'מושלם', allergies: [], chronic: ['אסתמה'], primaryDoctorId: 'U1' },
    { id: '298765439', firstName: 'יעל', lastName: 'מזרחי', birthDate: '1995-03-03', gender: 'נקבה', phone: '053-4445566', address: 'רחוב הגפן 9', plan: 'בסיסי', allergies: [], chronic: [], primaryDoctorId: 'U1' },
  ];

  function build() {
    const visits = [
      { id: 'V1', patientId: '034567891', doctorId: 'U1', date: daysFromNow(-40, 10), complaint: 'ביקורת סוכרת ולחץ דם', vitals: { bp: '142/88', pulse: 78, temp: 36.7, weight: 86 }, findings: 'מצב כללי טוב. HbA1c 7.4%', diagnosis: 'סוכרת סוג 2, יתר לחץ דם', plan: 'המשך טיפול, הגברת פעילות גופנית, ביקורת בעוד 3 חודשים' },
      { id: 'V2', patientId: '201456787', doctorId: 'U1', date: daysFromNow(-12, 9), complaint: 'עייפות', vitals: { bp: '118/74', pulse: 70, temp: 36.6, weight: 61 }, findings: 'TSH 5.8', diagnosis: 'תת פעילות בלוטת התריס', plan: 'התאמת מינון לבותירוקסין, בדיקת TSH בעוד 6 שבועות' },
      { id: 'V3', patientId: '058932146', doctorId: 'U2', date: daysFromNow(-5, 11), complaint: 'בצקות ברגליים', vitals: { bp: '135/80', pulse: 84, temp: 36.8, weight: 70 }, findings: 'בצקת +2 בשוקיים', diagnosis: 'החמרה באי ספיקת לב', plan: 'פורוסמיד, מעקב משקל יומי' },
    ];

    const prescriptions = [
      {
        id: 'RX1001', patientId: '034567891', doctorId: 'U1', date: daysFromNow(-40, 10), validUntil: daysFromNow(140), notes: 'טיפול כרוני',
        items: [
          { drugId: 'D11', dose: '1 טבליה', frequency: 'פעמיים ביום', durationDays: 30, packages: 1, repeats: 6, instructions: 'עם האוכל', dispenses: [daysFromNow(-40, 12)] },
          { drugId: 'D15', dose: '1 כמוסה', frequency: 'פעם ביום', durationDays: 30, packages: 1, repeats: 6, instructions: 'בבוקר', dispenses: [daysFromNow(-40, 12)] },
          { drugId: 'D19', dose: 'לפי INR', frequency: 'פעם ביום', durationDays: 30, packages: 1, repeats: 6, instructions: 'באותה שעה כל יום', dispenses: [daysFromNow(-40, 12)] },
        ],
      },
      {
        id: 'RX1002', patientId: '201456787', doctorId: 'U1', date: daysFromNow(-12, 9), validUntil: daysFromNow(78), notes: '',
        items: [
          { drugId: 'D22', dose: '1 טבליה', frequency: 'פעם ביום', durationDays: 50, packages: 1, repeats: 3, instructions: 'על קיבה ריקה, חצי שעה לפני ארוחת בוקר', dispenses: [] },
        ],
      },
      {
        id: 'RX1003', patientId: '058932146', doctorId: 'U2', date: daysFromNow(-5, 11), validUntil: daysFromNow(85), notes: '',
        items: [
          { drugId: 'D18', dose: '1 טבליה', frequency: 'פעם ביום', durationDays: 30, packages: 1, repeats: 3, instructions: 'בבוקר', dispenses: [daysFromNow(-5, 13)] },
          { drugId: 'D17', dose: '1 טבליה', frequency: 'פעם ביום', durationDays: 30, packages: 1, repeats: 3, instructions: '', dispenses: [daysFromNow(-5, 13)] },
        ],
      },
      {
        id: 'RX1004', patientId: '312778459', doctorId: 'U2', date: daysFromNow(-2, 10), validUntil: daysFromNow(88), notes: '',
        items: [
          { drugId: 'D12', dose: '1 טבליה', frequency: 'פעם ביום', durationDays: 30, packages: 1, repeats: 3, instructions: 'בערב', dispenses: [] },
        ],
      },
    ];

    const dispenses = [
      { id: 'DS1', prescriptionId: 'RX1001', patientId: '034567891', pharmacistId: 'U3', date: daysFromNow(-40, 12), lines: [{ drugId: 'D11', packages: 1, copay: 10 }, { drugId: 'D15', packages: 1, copay: 10 }, { drugId: 'D19', packages: 1, copay: 10 }], total: 30 },
      { id: 'DS2', prescriptionId: 'RX1003', patientId: '058932146', pharmacistId: 'U3', date: daysFromNow(-5, 13), lines: [{ drugId: 'D18', packages: 1, copay: 10 }, { drugId: 'D17', packages: 1, copay: 10 }], total: 20 },
    ];

    const referrals = [
      { id: 'RF1', patientId: '034567891', doctorId: 'U1', date: daysFromNow(-40, 10), specialty: 'עיניים', reason: 'בדיקת קרקעית עין שנתית לחולה סוכרת', urgency: 'רגילה', status: 'פתוחה' },
    ];

    const appointments = [
      { id: 'A1', patientId: '034567891', doctorId: 'U1', start: todayAt(8, 30), reason: 'ביקורת תקופתית', status: 'מתוזמן' },
      { id: 'A2', patientId: '298765439', doctorId: 'U1', start: todayAt(9, 0), reason: 'כאב גרון וחום', status: 'מתוזמן' },
      { id: 'A3', patientId: '121212120', doctorId: 'U1', start: todayAt(9, 30), reason: 'החמרה באסתמה', status: 'מתוזמן' },
      { id: 'A4', patientId: '201456787', doctorId: 'U1', start: todayAt(10, 15), reason: 'תוצאות בדיקות דם', status: 'מתוזמן' },
      { id: 'A5', patientId: '058932146', doctorId: 'U2', start: todayAt(11, 0), reason: 'מעקב אי ספיקת לב', status: 'מתוזמן' },
      { id: 'A6', patientId: '034567891', doctorId: 'U2', start: daysFromNow(9, 12), reason: 'ייעוץ פנימי', status: 'מתוזמן' },
    ];

    const inventory = {};
    DRUGS.forEach((d, i) => { inventory[d.id] = [40, 25, 12, 6, 60, 3][i % 6]; });
    inventory.D29 = 4;
    inventory.D30 = 8;
    inventory.D24 = 0;

    return {
      version: 1,
      counters: { RX: 1004, V: 3, DS: 2, RF: 1, A: 6, LOG: 0 },
      users: JSON.parse(JSON.stringify(USERS)),
      patients: JSON.parse(JSON.stringify(PATIENTS)),
      drugs: JSON.parse(JSON.stringify(DRUGS)),
      interactions: JSON.parse(JSON.stringify(INTERACTIONS)),
      visits, prescriptions, dispenses, referrals, appointments, inventory,
      audit: [],
    };
  }

  const SeedData = { build, DRUGS, INTERACTIONS, PATIENTS, USERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = SeedData;
  else root.SeedData = SeedData;
})(typeof window !== 'undefined' ? window : globalThis);
