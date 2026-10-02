/*
 * שכבת נתונים: שמירה ב-localStorage, מזהים רצים ויומן פעולות (Audit).
 */
(function (root) {
  const KEY = 'medsys_demo_v1';
  let db = null;
  let memoryOnly = false;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) db = JSON.parse(raw);
    } catch (e) {
      memoryOnly = true;
    }
    if (!db || db.version !== 1) db = SeedData.build();
    return db;
  }

  function save() {
    if (memoryOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      memoryOnly = true;
    }
  }

  function reset() {
    db = SeedData.build();
    save();
    return db;
  }

  function nextId(prefix) {
    db.counters[prefix] = (db.counters[prefix] || 0) + 1;
    return prefix + db.counters[prefix];
  }

  function log(user, action, details) {
    db.audit.unshift({
      id: nextId('LOG'),
      date: new Date().toISOString(),
      userId: user ? user.id : null,
      userName: user ? user.name : 'מערכת',
      action,
      details: details || '',
    });
    if (db.audit.length > 500) db.audit.length = 500;
  }

  const Store = {
    load, save, reset, nextId, log,
    get db() { return db; },
    drug(id) { return db.drugs.find(d => d.id === id); },
    drugsById() { return Object.fromEntries(db.drugs.map(d => [d.id, d])); },
    patient(id) { return db.patients.find(p => p.id === id); },
    user(id) { return db.users.find(u => u.id === id); },
    prescription(id) { return db.prescriptions.find(r => r.id === id); },
    patientPrescriptions(pid) { return db.prescriptions.filter(r => r.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)); },
    patientVisits(pid) { return db.visits.filter(v => v.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)); },
    patientReferrals(pid) { return db.referrals.filter(r => r.patientId === pid).sort((a, b) => b.date.localeCompare(a.date)); },
    patientAppointments(pid) { return db.appointments.filter(a => a.patientId === pid).sort((a, b) => a.start.localeCompare(b.start)); },
    // תרופות שעדיין פעילות אצל המטופל (מרשמים שאינם מבוטלים/פגי תוקף ושלא נופקו במלואם, או נופקו ב-30 הימים האחרונים)
    activeDrugIds(pid, now) {
      now = now ? new Date(now) : new Date();
      const ids = new Set();
      for (const rx of db.prescriptions) {
        if (rx.patientId !== pid || rx.cancelled) continue;
        const status = Clinical.prescriptionStatus(rx, now);
        for (const it of rx.items) {
          const last = (it.dispenses || []).slice(-1)[0];
          const recentlyDispensed = last && (now - new Date(last)) / Clinical.DAY <= (it.durationDays || 30);
          if (status === 'פעיל' || status === 'נופק חלקית' || recentlyDispensed) ids.add(it.drugId);
        }
      }
      return [...ids];
    },
  };

  root.Store = Store;
})(window);
