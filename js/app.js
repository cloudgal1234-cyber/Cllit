/*
 * ממשק המשתמש: רופא/ה, רוקח/ת, מטופל/ת ומנהל/ת.
 */
(function () {
  const $app = document.getElementById('app');
  const S = Store;
  let db = S.load();

  const state = {
    user: null,
    view: null,
    params: {},
    draft: null, // טיוטת מרשם בעריכה
    dispenseSel: {},
    flash: null,
  };

  const FREQUENCIES = ['פעם ביום', 'פעמיים ביום', '3 פעמים ביום', '4 פעמים ביום', 'כל 8 שעות', 'לפני השינה', 'לפי הצורך', 'פעם בשבוע'];
  const SPECIALTIES = ['קרדיולוגיה', 'עיניים', 'אורתופדיה', 'עור', 'אף אוזן גרון', 'נוירולוגיה', 'גסטרואנטרולוגיה', 'אנדוקרינולוגיה', 'פיזיותרפיה', 'דיאטנית', 'בריאות הנפש', 'גינקולוגיה', 'רפואת ילדים'];
  const PLANS = ['בסיסי', 'מושלם', 'פלטינום'];

  // ---------- עזרים ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('he-IL') : ''; }
  function fmtDateTime(iso) { return iso ? new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }
  function money(n) { return '₪' + Number(n).toFixed(2); }
  function localDate(d) {
    d = d ? new Date(d) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function nextWorkday() {
    const d = new Date();
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 5 || d.getDay() === 6);
    return localDate(d);
  }
  function sameDay(a, b) { a = new Date(a); b = new Date(b); return a.toDateString() === b.toDateString(); }
  function fullName(p) { return p ? `${p.firstName} ${p.lastName}` : '—'; }
  function userName(id) { const u = S.user(id); return u ? u.name : '—'; }
  function persist() { S.save(); }
  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function flash(msg, kind) { state.flash = { msg, kind: kind || 'ok' }; }

  function statusBadge(status) {
    const cls = { 'פעיל': 'b-blue', 'נופק חלקית': 'b-amber', 'נופק': 'b-green', 'בוטל': 'b-gray', 'פג תוקף': 'b-red',
      'מתוזמן': 'b-blue', 'הגיע/ה': 'b-amber', 'הסתיים': 'b-green', 'בוטל ע"י מטופל': 'b-gray',
      'פתוחה': 'b-blue', 'נקבע תור': 'b-green' }[status] || 'b-gray';
    return `<span class="badge ${cls}">${esc(status)}</span>`;
  }

  function warningsHtml(warnings) {
    if (!warnings.length) return '<div class="alert ok">✓ לא נמצאו אזהרות אלרגיה או אינטראקציות</div>';
    const label = { severe: 'חמורה', moderate: 'בינונית', minor: 'קלה' };
    return warnings.map(w => `<div class="alert ${w.level}"><strong>אזהרה ${label[w.level]}:</strong> ${esc(w.msg)}</div>`).join('');
  }

  function allergyChips(p) {
    if (!p.allergies.length) return '<span class="muted">לא ידועות אלרגיות</span>';
    return p.allergies.map(a => `<span class="chip chip-red">⚠ ${esc(Clinical.ALLERGY_LABELS[a] || a)}</span>`).join(' ');
  }

  function go(view, params) {
    state.view = view;
    state.params = params || {};
    render();
    window.scrollTo(0, 0);
  }

  // ---------- תבנית כללית ----------
  const NAV = {
    doctor: [['doc-schedule', 'יומן תורים'], ['doc-search', 'חיפוש מטופל'], ['doc-rx', 'מרשמים שהנפקתי'], ['drug-catalog', 'מאגר תרופות']],
    pharmacist: [['ph-dispense', 'ניפוק מרשם'], ['ph-inventory', 'מלאי'], ['ph-history', 'היסטוריית ניפוקים'], ['drug-catalog', 'מאגר תרופות']],
    patient: [['pt-home', 'האזור האישי'], ['pt-rx', 'המרשמים שלי'], ['pt-book', 'זימון תור']],
    admin: [['ad-dash', 'לוח בקרה'], ['ad-users', 'משתמשים'], ['ad-audit', 'יומן פעולות'], ['drug-catalog', 'מאגר תרופות']],
  };
  const ROLE_LABEL = { doctor: 'רופא/ה', pharmacist: 'רוקח/ת', patient: 'מטופל/ת', admin: 'מנהל/ת' };

  function layout(content) {
    const u = state.user;
    const nav = NAV[u.role].map(([v, label]) =>
      `<button class="nav-btn ${state.view === v ? 'active' : ''}" onclick="App.go('${v}')">${label}</button>`).join('');
    const fl = state.flash ? `<div class="flash ${state.flash.kind}">${esc(state.flash.msg)}</div>` : '';
    state.flash = null;
    return `
      <header class="topbar no-print">
        <div class="brand"><span class="logo">✚</span> מערכת רפואה קהילתית <span class="demo-tag">הדגמה</span></div>
        <div class="who">${esc(u.name)} · ${ROLE_LABEL[u.role]}${u.clinic ? ' · ' + esc(u.clinic) : ''}
          <button class="btn btn-ghost btn-sm" onclick="App.logout()">יציאה</button></div>
      </header>
      <nav class="nav no-print">${nav}</nav>
      <main class="main">${fl}${content}</main>`;
  }

  // ---------- כניסה ----------
  function viewLogin() {
    const demo = db.users.map(u => `
      <button class="demo-user" onclick="App.quickLogin('${u.username}')">
        <strong>${esc(u.name)}</strong><span>${ROLE_LABEL[u.role]} · ${esc(u.username)} / ${esc(u.password)}</span>
      </button>`).join('');
    return `
      <div class="login-wrap">
        <div class="card login-card">
          <div class="brand big"><span class="logo">✚</span> מערכת רפואה קהילתית</div>
          <p class="muted">מערכת הדגמה לרופאים, בתי מרקחת ומטופלים. כל הנתונים פיקטיביים.</p>
          <form onsubmit="App.login(event)">
            <label>שם משתמש<input name="username" required autocomplete="username"></label>
            <label>סיסמה<input name="password" type="password" required autocomplete="current-password"></label>
            <div id="login-err" class="err"></div>
            <button class="btn btn-primary btn-block">כניסה</button>
          </form>
          <h4>כניסה מהירה (משתמשי הדגמה)</h4>
          <div class="demo-users">${demo}</div>
        </div>
      </div>`;
  }

  // ---------- רופא: יומן ----------
  function viewDocSchedule() {
    const date = state.params.date || localDate();
    const appts = db.appointments
      .filter(a => a.doctorId === state.user.id && sameDay(a.start, date))
      .sort((a, b) => a.start.localeCompare(b.start));
    const rows = appts.map(a => {
      const p = S.patient(a.patientId);
      return `<tr>
        <td>${fmtTime(a.start)}</td>
        <td><a href="#" onclick="App.openPatient('${a.patientId}');return false">${esc(fullName(p))}</a><div class="muted small">${esc(a.patientId)}</div></td>
        <td>${esc(a.reason)}</td>
        <td>${statusBadge(a.status)}</td>
        <td class="actions">
          ${a.status === 'מתוזמן' ? `<button class="btn btn-sm" onclick="App.apptStatus('${a.id}','הגיע/ה')">הגיע/ה</button>` : ''}
          ${a.status !== 'הסתיים' ? `<button class="btn btn-sm" onclick="App.apptStatus('${a.id}','הסתיים')">סיום</button>` : ''}
          <button class="btn btn-sm btn-primary" onclick="App.openPatient('${a.patientId}')">פתח תיק</button>
        </td></tr>`;
    }).join('');
    return layout(`
      <div class="page-head"><h2>יומן תורים</h2>
        <input type="date" value="${date}" onchange="App.go('doc-schedule',{date:this.value})"></div>
      <div class="card">
        ${appts.length ? `<table class="table"><thead><tr><th>שעה</th><th>מטופל/ת</th><th>סיבת פנייה</th><th>סטטוס</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
          : '<p class="muted">אין תורים ביום זה.</p>'}
      </div>`);
  }

  // ---------- רופא: חיפוש מטופל ----------
  function viewDocSearch() {
    const q = (state.params.q || '').trim();
    const list = db.patients.filter(p => !q || p.id.includes(q) || fullName(p).includes(q) || (p.phone || '').includes(q));
    const rows = list.map(p => `<tr onclick="App.openPatient('${p.id}')" class="clickable">
      <td>${esc(p.id)}</td><td>${esc(fullName(p))}</td><td>${Clinical.ageFrom(p.birthDate)}</td><td>${esc(p.gender)}</td>
      <td>${esc(p.plan)}</td><td>${p.allergies.length ? '<span class="chip chip-red">⚠ אלרגיות</span>' : ''}</td></tr>`).join('');
    return layout(`
      <div class="page-head"><h2>חיפוש מטופל</h2>
        <button class="btn btn-primary" onclick="App.go('doc-new-patient')">+ מטופל/ת חדש/ה</button></div>
      <div class="card">
        <form class="row" onsubmit="event.preventDefault();App.go('doc-search',{q:this.q.value})">
          <input name="q" placeholder="ת.ז, שם או טלפון" value="${esc(q)}" autofocus>
          <button class="btn btn-primary">חיפוש</button>
        </form>
        <table class="table"><thead><tr><th>ת.ז</th><th>שם</th><th>גיל</th><th>מין</th><th>ביטוח משלים</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6" class="muted">לא נמצאו מטופלים</td></tr>'}</tbody></table>
      </div>`);
  }

  function viewDocNewPatient() {
    const allergyOpts = Object.entries(Clinical.ALLERGY_LABELS).map(([k, v]) =>
      `<label class="check"><input type="checkbox" name="allergy_${k}"> ${esc(v)}</label>`).join('');
    return layout(`
      <div class="page-head"><h2>קליטת מטופל/ת חדש/ה</h2></div>
      <div class="card">
        <form onsubmit="App.createPatient(event)" class="grid2">
          <label>תעודת זהות<input name="id" required inputmode="numeric" maxlength="9"></label>
          <label>ביטוח משלים<select name="plan">${PLANS.map(p => `<option>${p}</option>`).join('')}</select></label>
          <label>שם פרטי<input name="firstName" required></label>
          <label>שם משפחה<input name="lastName" required></label>
          <label>תאריך לידה<input name="birthDate" type="date" required></label>
          <label>מין<select name="gender"><option>זכר</option><option>נקבה</option><option>אחר</option></select></label>
          <label>טלפון<input name="phone"></label>
          <label>כתובת<input name="address"></label>
          <label class="span2">מחלות כרוניות (מופרדות בפסיק)<input name="chronic"></label>
          <fieldset class="span2"><legend>אלרגיות ידועות</legend><div class="checks">${allergyOpts}</div></fieldset>
          <div id="form-err" class="err span2"></div>
          <div class="span2"><button class="btn btn-primary">שמירה ופתיחת תיק</button>
            <button type="button" class="btn" onclick="App.go('doc-search')">ביטול</button></div>
        </form>
      </div>`);
  }

  // ---------- רופא: תיק מטופל ----------
  function patientHeader(p) {
    return `
      <div class="card patient-head">
        <div>
          <h2>${esc(fullName(p))}</h2>
          <div class="meta">ת.ז ${esc(p.id)} · גיל ${Clinical.ageFrom(p.birthDate)} · ${esc(p.gender)} · ${esc(p.phone || '')} · ביטוח משלים: ${esc(p.plan)}</div>
          <div class="meta">רופא/ה מטפל/ת: ${esc(userName(p.primaryDoctorId))}</div>
        </div>
        <div class="head-side">
          <div><strong>אלרגיות:</strong> ${allergyChips(p)}</div>
          <div><strong>מחלות רקע:</strong> ${p.chronic.length ? p.chronic.map(c => `<span class="chip">${esc(c)}</span>`).join(' ') : '<span class="muted">אין</span>'}</div>
        </div>
      </div>`;
  }

  function rxCard(rx, opts) {
    opts = opts || {};
    const status = Clinical.prescriptionStatus(rx);
    const items = rx.items.map(it => {
      const d = S.drug(it.drugId);
      const used = (it.dispenses || []).length;
      return `<li><strong>${esc(d.name)}</strong> ${d.controlled ? '<span class="chip chip-red">סם מסוכן</span>' : ''} — ${esc(it.dose)}, ${esc(it.frequency)}, ${it.durationDays} ימים
        · ${it.packages} אריזות${(it.repeats || 1) > 1 ? ` · ניפוקים: ${used}/${it.repeats}` : (used ? ' · נופק' : '')}
        ${it.instructions ? `<div class="muted small">${esc(it.instructions)}</div>` : ''}</li>`;
    }).join('');
    return `<div class="rx-card">
      <div class="rx-head"><span><strong>מרשם ${esc(rx.id)}</strong> · ${fmtDate(rx.date)} · ${esc(userName(rx.doctorId))}</span>${statusBadge(status)}</div>
      <ul>${items}</ul>
      <div class="muted small">בתוקף עד ${fmtDate(rx.validUntil)}${rx.notes ? ' · ' + esc(rx.notes) : ''}${rx.cancelled ? ' · סיבת ביטול: ' + esc(rx.cancelReason || '') : ''}</div>
      <div class="actions no-print">
        <button class="btn btn-sm" onclick="App.go('rx-print',{id:'${rx.id}'})">הדפסה</button>
        ${opts.canCancel && !rx.cancelled && status !== 'נופק' ? `<button class="btn btn-sm btn-danger" onclick="App.cancelRx('${rx.id}')">ביטול מרשם</button>` : ''}
      </div></div>`;
  }

  function viewDocPatient() {
    const p = S.patient(state.params.id);
    if (!p) return layout('<div class="card">מטופל לא נמצא</div>');
    const tab = state.params.tab || 'summary';
    const tabs = [['summary', 'סיכום'], ['visits', 'ביקורים'], ['rx', 'מרשמים'], ['referrals', 'הפניות'], ['appts', 'תורים']]
      .map(([k, l]) => `<button class="tab ${tab === k ? 'active' : ''}" onclick="App.go('doc-patient',{id:'${p.id}',tab:'${k}'})">${l}</button>`).join('');

    let body = '';
    if (tab === 'summary') {
      const active = S.activeDrugIds(p.id).map(id => S.drug(id));
      const lastVisit = S.patientVisits(p.id)[0];
      body = `
        <div class="grid2">
          <div class="card"><h3>תרופות פעילות</h3>
            ${active.length ? `<ul>${active.map(d => `<li>${esc(d.name)} <span class="muted small">(${esc(d.therapeuticClass)})</span></li>`).join('')}</ul>` : '<p class="muted">אין תרופות פעילות</p>'}
          </div>
          <div class="card"><h3>ביקור אחרון</h3>
            ${lastVisit ? visitHtml(lastVisit) : '<p class="muted">אין ביקורים</p>'}
          </div>
        </div>`;
    } else if (tab === 'visits') {
      const vs = S.patientVisits(p.id);
      body = vs.length ? vs.map(v => `<div class="card">${visitHtml(v)}</div>`).join('') : '<div class="card muted">אין ביקורים</div>';
    } else if (tab === 'rx') {
      const rxs = S.patientPrescriptions(p.id);
      body = rxs.length ? rxs.map(rx => rxCard(rx, { canCancel: rx.doctorId === state.user.id })).join('') : '<div class="card muted">אין מרשמים</div>';
    } else if (tab === 'referrals') {
      const rs = S.patientReferrals(p.id);
      body = `<div class="card">${rs.length ? `<table class="table"><thead><tr><th>תאריך</th><th>תחום</th><th>סיבה</th><th>דחיפות</th><th>רופא/ה</th><th>סטטוס</th></tr></thead><tbody>
        ${rs.map(r => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.specialty)}</td><td>${esc(r.reason)}</td><td>${esc(r.urgency)}</td><td>${esc(userName(r.doctorId))}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">אין הפניות</p>'}</div>`;
    } else if (tab === 'appts') {
      const as = S.patientAppointments(p.id);
      body = `<div class="card">${as.length ? `<table class="table"><thead><tr><th>מועד</th><th>רופא/ה</th><th>סיבה</th><th>סטטוס</th></tr></thead><tbody>
        ${as.map(a => `<tr><td>${fmtDateTime(a.start)}</td><td>${esc(userName(a.doctorId))}</td><td>${esc(a.reason)}</td><td>${statusBadge(a.status)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">אין תורים</p>'}</div>`;
    }

    return layout(`
      ${patientHeader(p)}
      <div class="toolbar">
        <button class="btn btn-primary" onclick="App.go('doc-visit',{id:'${p.id}'})">+ ביקור חדש</button>
        <button class="btn btn-primary" onclick="App.newRx('${p.id}')">+ מרשם חדש</button>
        <button class="btn" onclick="App.go('doc-referral',{id:'${p.id}'})">+ הפניה</button>
        <button class="btn" onclick="App.go('doc-sicknote',{id:'${p.id}'})">אישור מחלה</button>
        <button class="btn" onclick="App.go('doc-allergies',{id:'${p.id}'})">עדכון אלרגיות ורקע</button>
      </div>
      <div class="tabs">${tabs}</div>
      ${body}`);
  }

  function visitHtml(v) {
    const vt = v.vitals || {};
    return `<div class="visit">
      <div class="rx-head"><strong>${fmtDateTime(v.date)}</strong><span class="muted">${esc(userName(v.doctorId))}</span></div>
      <div><strong>תלונה:</strong> ${esc(v.complaint)}</div>
      <div class="muted small">ל"ד ${esc(vt.bp || '-')} · דופק ${esc(vt.pulse || '-')} · חום ${esc(vt.temp || '-')} · משקל ${esc(vt.weight || '-')}</div>
      <div><strong>ממצאים:</strong> ${esc(v.findings)}</div>
      <div><strong>אבחנה:</strong> ${esc(v.diagnosis)}</div>
      <div><strong>המלצות:</strong> ${esc(v.plan)}</div>
    </div>`;
  }

  function viewDocVisit() {
    const p = S.patient(state.params.id);
    return layout(`
      ${patientHeader(p)}
      <div class="card"><h3>תיעוד ביקור</h3>
        <form onsubmit="App.saveVisit(event,'${p.id}')" class="grid2">
          <label class="span2">תלונה עיקרית<input name="complaint" required></label>
          <label>לחץ דם<input name="bp" placeholder="120/80"></label>
          <label>דופק<input name="pulse" type="number"></label>
          <label>חום<input name="temp" type="number" step="0.1"></label>
          <label>משקל (ק"ג)<input name="weight" type="number" step="0.1"></label>
          <label class="span2">ממצאי בדיקה<textarea name="findings" rows="3"></textarea></label>
          <label class="span2">אבחנה<input name="diagnosis" required></label>
          <label class="span2">המלצות / תוכנית טיפול<textarea name="plan" rows="3"></textarea></label>
          <div class="span2">
            <button class="btn btn-primary" name="next" value="">שמירה</button>
            <button class="btn btn-primary" name="next" value="rx">שמירה ומעבר למרשם</button>
            <button type="button" class="btn" onclick="App.openPatient('${p.id}')">ביטול</button>
          </div>
        </form></div>`);
  }

  // ---------- רופא: מרשם חדש ----------
  function draftWarnings() {
    const d = state.draft;
    const p = S.patient(d.patientId);
    const newDrugs = d.items.map(it => S.drug(it.drugId));
    const activeDrugs = S.activeDrugIds(p.id).map(id => S.drug(id));
    return Clinical.checkPrescription({ patient: p, newDrugs, activeDrugs, interactions: db.interactions });
  }

  function viewDocRx() {
    const d = state.draft;
    const p = S.patient(d.patientId);
    const drugOpts = db.drugs.map(x => `<option value="${x.id}">${esc(x.name)}${x.controlled ? ' (סם מסוכן)' : ''}${x.inBasket ? '' : ' (מחוץ לסל)'}</option>`).join('');
    const items = d.items.map((it, i) => {
      const drug = S.drug(it.drugId);
      const c = Clinical.copay(drug, p.plan, it.packages);
      return `<tr><td>${esc(drug.name)}</td><td>${esc(it.dose)}</td><td>${esc(it.frequency)}</td><td>${it.durationDays} ימים</td>
        <td>${it.packages}</td><td>${it.repeats}</td><td>${money(c.total)}${c.covered ? '' : ' <span class="muted small">(מחוץ לסל)</span>'}</td>
        <td><button class="btn btn-sm btn-danger" onclick="App.rxRemoveItem(${i})">הסרה</button></td></tr>`;
    }).join('');
    const warnings = d.items.length ? draftWarnings() : [];
    const hasSevere = warnings.some(w => w.level === 'severe');
    return layout(`
      ${patientHeader(p)}
      <div class="card"><h3>מרשם חדש</h3>
        <form class="grid4" onsubmit="App.rxAddItem(event)">
          <label class="span2">תרופה<select name="drugId" required onchange="App.rxDrugChanged(this)"><option value="">בחירת תרופה…</option>${drugOpts}</select></label>
          <label>מינון<input name="dose" required placeholder='לדוגמה: 1 טבליה'></label>
          <label>תדירות<select name="frequency">${FREQUENCIES.map(f => `<option>${f}</option>`).join('')}</select></label>
          <label>משך (ימים)<input name="durationDays" type="number" min="1" value="7" required></label>
          <label>מס' אריזות<input name="packages" type="number" min="1" value="1" required></label>
          <label>ניפוקים חוזרים (כרוני)<input name="repeats" type="number" min="1" max="12" value="1" required></label>
          <label>הוראות<input name="instructions" placeholder="לפני/אחרי אוכל…"></label>
          <div id="drug-info" class="span4 muted small"></div>
          <div class="span4"><button class="btn">+ הוספה למרשם</button></div>
        </form>
        <div id="rx-err" class="err"></div>
      </div>
      <div class="card"><h3>פריטים במרשם</h3>
        ${d.items.length ? `<table class="table"><thead><tr><th>תרופה</th><th>מינון</th><th>תדירות</th><th>משך</th><th>אריזות</th><th>ניפוקים</th><th>השתתפות משוערת</th><th></th></tr></thead><tbody>${items}</tbody></table>` : '<p class="muted">טרם נוספו תרופות</p>'}
      </div>
      ${d.items.length ? `<div class="card"><h3>בדיקת בטיחות</h3>${warningsHtml(warnings)}</div>` : ''}
      <div class="card">
        <label>הערות לרוקח/ת<input id="rx-notes" value="${esc(d.notes)}" oninput="App.rxNotes(this.value)"></label>
        ${hasSevere ? `<label class="check override"><input type="checkbox" id="rx-override"> קראתי את האזהרות החמורות ואני מאשר/ת את המרשם על אחריותי</label>
          <label>נימוק קליני לעקיפת האזהרה<input id="rx-override-reason"></label>` : ''}
        <div class="toolbar">
          <button class="btn btn-primary" ${d.items.length ? '' : 'disabled'} onclick="App.rxSubmit()">חתימה והנפקת מרשם</button>
          <button class="btn" onclick="App.openPatient('${p.id}')">ביטול</button>
        </div>
        <div id="rx-submit-err" class="err"></div>
      </div>`);
  }

  function viewDocReferral() {
    const p = S.patient(state.params.id);
    return layout(`
      ${patientHeader(p)}
      <div class="card"><h3>הפניה לרופא/ה מומחה/ית</h3>
        <form onsubmit="App.saveReferral(event,'${p.id}')" class="grid2">
          <label>תחום<select name="specialty">${SPECIALTIES.map(s => `<option>${s}</option>`).join('')}</select></label>
          <label>דחיפות<select name="urgency"><option>רגילה</option><option>דחופה</option><option>דחופה מאוד</option></select></label>
          <label class="span2">סיבת ההפניה ושאלה קלינית<textarea name="reason" rows="4" required></textarea></label>
          <div class="span2"><button class="btn btn-primary">שמירת הפניה</button>
            <button type="button" class="btn" onclick="App.openPatient('${p.id}')">ביטול</button></div>
        </form></div>`);
  }

  function viewDocSickNote() {
    const p = S.patient(state.params.id);
    const today = localDate();
    if (state.params.from) {
      return layout(`<div class="print-doc">
        <div class="no-print toolbar"><button class="btn btn-primary" onclick="window.print()">הדפסה</button>
          <button class="btn" onclick="App.openPatient('${p.id}')">חזרה לתיק</button></div>
        <h2>אישור מחלה</h2>
        <p>הריני לאשר כי <strong>${esc(fullName(p))}</strong>, ת.ז ${esc(p.id)}, נבדק/ה על ידי ונמצא/ה אינו/ה כשיר/ה לעבודה/ללימודים
        מתאריך <strong>${fmtDate(state.params.from)}</strong> עד תאריך <strong>${fmtDate(state.params.to)}</strong> (כולל).</p>
        ${state.params.note ? `<p>הערות: ${esc(state.params.note)}</p>` : ''}
        <div class="sign">${esc(state.user.name)} · מ.ר ${esc(state.user.license)} · ${esc(state.user.clinic)}<br>תאריך הנפקה: ${fmtDate(new Date().toISOString())}</div>
        <p class="muted small">מסמך הדגמה — אינו מסמך רפואי תקף.</p>
      </div>`);
    }
    return layout(`
      ${patientHeader(p)}
      <div class="card"><h3>אישור מחלה</h3>
        <form onsubmit="App.makeSickNote(event,'${p.id}')" class="grid2">
          <label>מתאריך<input type="date" name="from" value="${today}" required></label>
          <label>עד תאריך<input type="date" name="to" value="${today}" required></label>
          <label class="span2">הערות (ללא פירוט אבחנה)<input name="note"></label>
          <div class="span2"><button class="btn btn-primary">הפקת אישור</button></div>
        </form></div>`);
  }

  function viewDocAllergies() {
    const p = S.patient(state.params.id);
    const opts = Object.entries(Clinical.ALLERGY_LABELS).map(([k, v]) =>
      `<label class="check"><input type="checkbox" name="allergy_${k}" ${p.allergies.includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('');
    return layout(`
      ${patientHeader(p)}
      <div class="card"><h3>עדכון אלרגיות ומחלות רקע</h3>
        <form onsubmit="App.saveAllergies(event,'${p.id}')">
          <fieldset><legend>אלרגיות</legend><div class="checks">${opts}</div></fieldset>
          <label>מחלות רקע (מופרדות בפסיק)<input name="chronic" value="${esc(p.chronic.join(', '))}"></label>
          <label>ביטוח משלים<select name="plan">${PLANS.map(x => `<option ${x === p.plan ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <button class="btn btn-primary">שמירה</button>
          <button type="button" class="btn" onclick="App.openPatient('${p.id}')">ביטול</button>
        </form></div>`);
  }

  function viewDocRxList() {
    const rxs = db.prescriptions.filter(r => r.doctorId === state.user.id).sort((a, b) => b.date.localeCompare(a.date));
    const rows = rxs.map(rx => {
      const p = S.patient(rx.patientId);
      return `<tr class="clickable" onclick="App.go('doc-patient',{id:'${p.id}',tab:'rx'})"><td>${esc(rx.id)}</td><td>${fmtDate(rx.date)}</td><td>${esc(fullName(p))}</td>
        <td>${rx.items.map(it => esc(S.drug(it.drugId).name)).join('<br>')}</td><td>${statusBadge(Clinical.prescriptionStatus(rx))}</td></tr>`;
    }).join('');
    return layout(`<div class="page-head"><h2>מרשמים שהנפקתי</h2></div>
      <div class="card"><table class="table"><thead><tr><th>מס'</th><th>תאריך</th><th>מטופל/ת</th><th>תרופות</th><th>סטטוס</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted">אין מרשמים</td></tr>'}</tbody></table></div>`);
  }

  // ---------- הדפסת מרשם ----------
  function viewRxPrint() {
    const rx = S.prescription(state.params.id);
    const p = S.patient(rx.patientId);
    const doc = S.user(rx.doctorId);
    const back = state.user.role === 'patient' ? "App.go('pt-rx')" : state.user.role === 'pharmacist' ? "App.go('ph-dispense',{pid:'" + p.id + "'})" : `App.go('doc-patient',{id:'${p.id}',tab:'rx'})`;
    return layout(`<div class="print-doc">
      <div class="no-print toolbar"><button class="btn btn-primary" onclick="window.print()">הדפסה</button><button class="btn" onclick="${back}">חזרה</button></div>
      <div class="rx-print-head"><div><h2>מרשם רפואי</h2><div>מס' ${esc(rx.id)}</div></div><div class="barcode">${esc(rx.id)}</div></div>
      <p><strong>מטופל/ת:</strong> ${esc(fullName(p))} · ת.ז ${esc(p.id)} · גיל ${Clinical.ageFrom(p.birthDate)}</p>
      <p><strong>אלרגיות:</strong> ${p.allergies.map(a => esc(Clinical.ALLERGY_LABELS[a])).join(', ') || 'לא ידועות'}</p>
      <table class="table"><thead><tr><th>תרופה</th><th>מינון</th><th>תדירות</th><th>משך</th><th>אריזות</th><th>ניפוקים</th><th>הוראות</th></tr></thead><tbody>
      ${rx.items.map(it => `<tr><td>${esc(S.drug(it.drugId).name)}</td><td>${esc(it.dose)}</td><td>${esc(it.frequency)}</td><td>${it.durationDays} ימים</td><td>${it.packages}</td><td>${it.repeats || 1}</td><td>${esc(it.instructions)}</td></tr>`).join('')}
      </tbody></table>
      <p>תאריך: ${fmtDate(rx.date)} · בתוקף עד: ${fmtDate(rx.validUntil)} · סטטוס: ${esc(Clinical.prescriptionStatus(rx))}</p>
      ${rx.notes ? `<p>הערות: ${esc(rx.notes)}</p>` : ''}
      <div class="sign">${esc(doc.name)} · ${esc(doc.title || '')} · מ.ר ${esc(doc.license)}<br>${esc(doc.clinic)}<br>חתימה דיגיטלית ✓</div>
      <p class="muted small">מסמך הדגמה — אינו מרשם תקף.</p>
    </div>`);
  }

  // ---------- רוקח/ת: ניפוק ----------
  function viewPhDispense() {
    const pid = state.params.pid || '';
    let body = '';
    if (pid) {
      const p = S.patient(pid);
      if (!p) {
        body = `<div class="card err">לא נמצא/ה מטופל/ת עם ת.ז ${esc(pid)}</div>`;
      } else {
        const rxs = S.patientPrescriptions(pid);
        const sel = state.dispenseSel || {};
        let total = 0;
        let anyControlled = false;
        const cards = rxs.map(rx => {
          const status = Clinical.prescriptionStatus(rx);
          const lines = rx.items.map((it, i) => {
            const d = S.drug(it.drugId);
            const chk = Clinical.itemDispensable(rx, it);
            const stock = db.inventory[d.id] || 0;
            const enoughStock = stock >= it.packages;
            const key = rx.id + ':' + i;
            const c = Clinical.copay(d, p.plan, it.packages);
            const checked = !!sel[key] && chk.ok && enoughStock;
            if (checked) { total += c.total; if (d.controlled) anyControlled = true; }
            const reason = !chk.ok ? chk.reason : !enoughStock ? `אין מספיק מלאי (במלאי: ${stock})` : '';
            return `<tr class="${chk.ok && enoughStock ? '' : 'disabled-row'}">
              <td><input type="checkbox" ${checked ? 'checked' : ''} ${chk.ok && enoughStock ? '' : 'disabled'} onchange="App.toggleDispense('${key}',this.checked)"></td>
              <td><strong>${esc(d.name)}</strong> ${d.controlled ? '<span class="chip chip-red">סם מסוכן</span>' : ''}<div class="muted small">${esc(it.dose)}, ${esc(it.frequency)}, ${it.durationDays} ימים${it.instructions ? ' · ' + esc(it.instructions) : ''}</div></td>
              <td>${it.packages}</td><td>${(it.dispenses || []).length}/${it.repeats || 1}</td><td>${stock}</td>
              <td>${money(c.total)}${c.covered ? '' : '<div class="muted small">מחוץ לסל</div>'}</td>
              <td class="small">${esc(reason)}</td></tr>`;
          }).join('');
          return `<div class="card">
            <div class="rx-head"><span><strong>מרשם ${esc(rx.id)}</strong> · ${fmtDate(rx.date)} · ${esc(userName(rx.doctorId))} · בתוקף עד ${fmtDate(rx.validUntil)}</span>${statusBadge(status)}</div>
            ${rx.notes ? `<div class="muted small">הערת רופא/ה: ${esc(rx.notes)}</div>` : ''}
            <table class="table"><thead><tr><th></th><th>תרופה</th><th>אריזות</th><th>נופק</th><th>מלאי</th><th>השתתפות</th><th>הערה</th></tr></thead><tbody>${lines}</tbody></table>
            <button class="btn btn-sm" onclick="App.go('rx-print',{id:'${rx.id}'})">צפייה במרשם</button>
          </div>`;
        }).join('');
        const selectedCount = Object.values(sel).filter(Boolean).length;
        body = `
          ${patientHeader(p)}
          ${cards || '<div class="card muted">אין מרשמים למטופל/ת</div>'}
          ${rxs.length ? `<div class="card sticky-total">
            <div><strong>סה"כ לתשלום: ${money(total)}</strong> <span class="muted">(ביטוח משלים: ${esc(p.plan)})</span></div>
            ${anyControlled ? '<label class="check override"><input type="checkbox" id="id-verified"> זהות המטופל/ת או מיופה/ת הכוח אומתה מול תעודה מזהה (חובה לסם מסוכן)</label>' : ''}
            <button class="btn btn-primary" ${selectedCount && total >= 0 ? '' : 'disabled'} onclick="App.dispense('${p.id}')">ניפוק וחיוב</button>
            <div id="disp-err" class="err"></div>
          </div>` : ''}`;
      }
    }
    return layout(`
      <div class="page-head"><h2>ניפוק מרשם</h2></div>
      <div class="card">
        <form class="row" onsubmit="event.preventDefault();App.phSearch(this.pid.value)">
          <input name="pid" placeholder="תעודת זהות של המטופל/ת" value="${esc(pid)}" inputmode="numeric" autofocus>
          <button class="btn btn-primary">איתור מרשמים</button>
        </form>
        <div class="muted small">לנוחות ההדגמה: ${db.patients.map(p => `<a href="#" onclick="App.phSearch('${p.id}');return false">${esc(p.id)}</a>`).join(' · ')}</div>
      </div>
      ${body}`);
  }

  function viewPhReceipt() {
    const ds = db.dispenses.find(d => d.id === state.params.id);
    const p = S.patient(ds.patientId);
    return layout(`<div class="print-doc">
      <div class="no-print toolbar"><button class="btn btn-primary" onclick="window.print()">הדפסת קבלה</button>
        <button class="btn" onclick="App.go('ph-dispense')">ניפוק הבא</button></div>
      <h2>קבלה — ניפוק ${esc(ds.id)}</h2>
      <p>${esc(fullName(p))} · ת.ז ${esc(p.id)} · מרשם ${esc(ds.prescriptionId)} · ${fmtDateTime(ds.date)}</p>
      <table class="table"><thead><tr><th>תרופה</th><th>אריזות</th><th>השתתפות</th></tr></thead><tbody>
      ${ds.lines.map(l => `<tr><td>${esc(S.drug(l.drugId).name)}</td><td>${l.packages}</td><td>${money(l.copay)}</td></tr>`).join('')}
      </tbody></table>
      <p><strong>סה"כ: ${money(ds.total)}</strong></p>
      <p>רוקח/ת: ${esc(userName(ds.pharmacistId))}</p>
      <p class="muted small">מסמך הדגמה.</p></div>`);
  }

  function viewPhInventory() {
    const q = (state.params.q || '').trim();
    const rows = db.drugs.filter(d => !q || d.name.includes(q) || d.ingredient.includes(q.toLowerCase())).map(d => {
      const s = db.inventory[d.id] || 0;
      return `<tr class="${s === 0 ? 'row-red' : s < 10 ? 'row-amber' : ''}">
        <td>${esc(d.id)}</td><td>${esc(d.name)} ${d.controlled ? '<span class="chip chip-red">סם מסוכן</span>' : ''}</td><td>${esc(d.form)} · ${d.packSize}</td>
        <td>${money(d.price)}</td><td>${d.inBasket ? 'כן' : 'לא'}</td><td><strong>${s}</strong>${s === 0 ? ' — אזל' : s < 10 ? ' — מלאי נמוך' : ''}</td>
        <td><form class="row" onsubmit="App.addStock(event,'${d.id}')"><input name="qty" type="number" min="1" value="10" class="w-num"><button class="btn btn-sm">קבלת סחורה</button></form></td></tr>`;
    }).join('');
    return layout(`
      <div class="page-head"><h2>ניהול מלאי</h2>
        <form class="row" onsubmit="event.preventDefault();App.go('ph-inventory',{q:this.q.value})"><input name="q" placeholder="חיפוש תרופה" value="${esc(q)}"><button class="btn">חיפוש</button></form></div>
      <div class="card"><table class="table"><thead><tr><th>קוד</th><th>תרופה</th><th>צורה · יח' באריזה</th><th>מחיר</th><th>בסל</th><th>מלאי (אריזות)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }

  function viewPhHistory() {
    const rows = db.dispenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map(ds => `
      <tr class="clickable" onclick="App.go('ph-receipt',{id:'${ds.id}'})"><td>${esc(ds.id)}</td><td>${fmtDateTime(ds.date)}</td><td>${esc(fullName(S.patient(ds.patientId)))}</td>
      <td>${esc(ds.prescriptionId)}</td><td>${ds.lines.map(l => esc(S.drug(l.drugId).name) + ' ×' + l.packages).join('<br>')}</td><td>${money(ds.total)}</td><td>${esc(userName(ds.pharmacistId))}</td></tr>`).join('');
    return layout(`<div class="page-head"><h2>היסטוריית ניפוקים</h2></div>
      <div class="card"><table class="table"><thead><tr><th>מס'</th><th>מועד</th><th>מטופל/ת</th><th>מרשם</th><th>פריטים</th><th>סה"כ</th><th>רוקח/ת</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" class="muted">אין ניפוקים</td></tr>'}</tbody></table></div>`);
  }

  // ---------- מאגר תרופות (משותף) ----------
  function viewDrugCatalog() {
    const q = (state.params.q || '').trim();
    const rows = db.drugs.filter(d => !q || d.name.includes(q) || d.therapeuticClass.includes(q) || d.ingredient.includes(q.toLowerCase())).map(d => {
      const ints = db.interactions.filter(i => i.a === d.ingredient || i.b === d.ingredient).map(i => {
        const other = i.a === d.ingredient ? i.b : i.a;
        const od = db.drugs.find(x => x.ingredient === other);
        return `${od ? od.name.split(' ')[0] : other}`;
      });
      return `<tr><td>${esc(d.name)}</td><td>${esc(d.therapeuticClass)}</td><td>${esc(d.form)} · ${d.packSize}</td><td>${d.inBasket ? 'בסל' : 'מחוץ לסל'}</td><td>${money(d.price)}</td>
        <td>${d.controlled ? '<span class="chip chip-red">סם מסוכן</span>' : ''}${d.minAge ? `<span class="chip">מגיל ${d.minAge}</span>` : ''}</td>
        <td class="small">${esc(ints.join(', '))}</td></tr>`;
    }).join('');
    return layout(`
      <div class="page-head"><h2>מאגר תרופות</h2>
        <form class="row" onsubmit="event.preventDefault();App.go('drug-catalog',{q:this.q.value})"><input name="q" placeholder="שם, חומר פעיל או קבוצה" value="${esc(q)}"><button class="btn">חיפוש</button></form></div>
      <div class="card"><table class="table"><thead><tr><th>תרופה</th><th>קבוצה</th><th>צורה</th><th>סל</th><th>מחיר</th><th>הגבלות</th><th>אינטראקציות ידועות</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }

  // ---------- מטופל/ת ----------
  function myPatient() { return S.patient(state.user.patientId); }

  function viewPtHome() {
    const p = myPatient();
    const appts = S.patientAppointments(p.id).filter(a => new Date(a.start) >= new Date(new Date().toDateString()) && a.status !== 'בוטל ע"י מטופל');
    const activeRx = S.patientPrescriptions(p.id).filter(rx => ['פעיל', 'נופק חלקית'].includes(Clinical.prescriptionStatus(rx)));
    const visits = S.patientVisits(p.id).slice(0, 3);
    const refs = S.patientReferrals(p.id);
    return layout(`
      <h2>שלום ${esc(p.firstName)}</h2>
      <div class="grid2">
        <div class="card"><h3>התורים הקרובים</h3>
          ${appts.length ? appts.map(a => `<div class="list-item"><div><strong>${fmtDateTime(a.start)}</strong> · ${esc(userName(a.doctorId))}<div class="muted small">${esc(a.reason)}</div></div>
            ${a.status === 'מתוזמן' ? `<button class="btn btn-sm btn-danger" onclick="App.cancelAppt('${a.id}')">ביטול תור</button>` : statusBadge(a.status)}</div>`).join('') : '<p class="muted">אין תורים קרובים</p>'}
          <button class="btn btn-primary" onclick="App.go('pt-book')">זימון תור חדש</button>
        </div>
        <div class="card"><h3>מרשמים פעילים</h3>
          ${activeRx.length ? activeRx.map(rx => `<div class="list-item"><div><strong>${esc(rx.id)}</strong> · ${rx.items.map(it => esc(S.drug(it.drugId).name)).join(', ')}</div>${statusBadge(Clinical.prescriptionStatus(rx))}</div>`).join('') : '<p class="muted">אין מרשמים פעילים</p>'}
          <button class="btn" onclick="App.go('pt-rx')">לכל המרשמים</button>
        </div>
        <div class="card"><h3>ביקורים אחרונים</h3>
          ${visits.length ? visits.map(v => `<div class="list-item"><div><strong>${fmtDate(v.date)}</strong> · ${esc(userName(v.doctorId))}<div class="muted small">${esc(v.diagnosis)} — ${esc(v.plan)}</div></div></div>`).join('') : '<p class="muted">אין ביקורים</p>'}
        </div>
        <div class="card"><h3>הפניות</h3>
          ${refs.length ? refs.map(r => `<div class="list-item"><div><strong>${esc(r.specialty)}</strong> · ${fmtDate(r.date)}<div class="muted small">${esc(r.reason)}</div></div>${statusBadge(r.status)}</div>`).join('') : '<p class="muted">אין הפניות</p>'}
        </div>
        <div class="card"><h3>הפרטים שלי</h3>
          <p>ת.ז ${esc(p.id)} · ${esc(p.phone)} · ${esc(p.address)}</p>
          <p><strong>אלרגיות:</strong> ${allergyChips(p)}</p>
          <p><strong>ביטוח משלים:</strong> ${esc(p.plan)}</p>
        </div>
      </div>`);
  }

  function viewPtRx() {
    const p = myPatient();
    const rxs = S.patientPrescriptions(p.id);
    return layout(`<div class="page-head"><h2>המרשמים שלי</h2></div>
      ${rxs.length ? rxs.map(rx => rxCard(rx)).join('') : '<div class="card muted">אין מרשמים</div>'}`);
  }

  function viewPtBook() {
    const p = myPatient();
    const doctors = db.users.filter(u => u.role === 'doctor');
    const docId = state.params.doctorId || p.primaryDoctorId || doctors[0].id;
    const date = state.params.date || nextWorkday();
    const taken = db.appointments.filter(a => a.doctorId === docId && sameDay(a.start, date) && a.status !== 'בוטל ע"י מטופל').map(a => fmtTime(a.start));
    const slots = [];
    for (let h = 8; h < 14; h++) for (const m of [0, 15, 30, 45]) slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    const now = new Date();
    const slotBtns = slots.map(s => {
      const dt = new Date(`${date}T${s}:00`);
      const disabled = taken.includes(s) || dt < now || dt.getDay() === 5 || dt.getDay() === 6;
      return `<button class="slot" ${disabled ? 'disabled' : ''} onclick="App.bookAppt('${docId}','${date}','${s}')">${s}</button>`;
    }).join('');
    return layout(`
      <div class="page-head"><h2>זימון תור</h2></div>
      <div class="card">
        <div class="grid2">
          <label>רופא/ה<select onchange="App.go('pt-book',{doctorId:this.value,date:'${date}'})">${doctors.map(d => `<option value="${d.id}" ${d.id === docId ? 'selected' : ''}>${esc(d.name)} — ${esc(d.title)}</option>`).join('')}</select></label>
          <label>תאריך<input type="date" value="${date}" min="${localDate()}" onchange="App.go('pt-book',{doctorId:'${docId}',date:this.value})"></label>
          <label class="span2">סיבת הפנייה<input id="appt-reason" placeholder="לדוגמה: חידוש מרשם, כאב גב…"></label>
        </div>
        <h4>שעות פנויות</h4>
        <div class="slots">${slotBtns}</div>
        <p class="muted small">המרפאה סגורה בימי שישי ושבת.</p>
      </div>`);
  }

  // ---------- מנהל/ת ----------
  function viewAdDash() {
    const today = new Date();
    const rxStatuses = {};
    db.prescriptions.forEach(rx => { const s = Clinical.prescriptionStatus(rx); rxStatuses[s] = (rxStatuses[s] || 0) + 1; });
    const lowStock = db.drugs.filter(d => (db.inventory[d.id] || 0) < 10);
    const revenue = db.dispenses.reduce((s, d) => s + d.total, 0);
    const tile = (label, val) => `<div class="tile"><div class="tile-val">${val}</div><div class="tile-label">${label}</div></div>`;
    return layout(`
      <div class="page-head"><h2>לוח בקרה</h2></div>
      <div class="tiles">
        ${tile('מטופלים', db.patients.length)}
        ${tile('תורים היום', db.appointments.filter(a => sameDay(a.start, today)).length)}
        ${tile('מרשמים', db.prescriptions.length)}
        ${tile('ניפוקים', db.dispenses.length)}
        ${tile('השתתפות עצמית שנגבתה', money(revenue))}
        ${tile('תרופות במלאי נמוך', lowStock.length)}
      </div>
      <div class="grid2">
        <div class="card"><h3>מרשמים לפי סטטוס</h3>${Object.entries(rxStatuses).map(([s, n]) => `<div class="list-item">${statusBadge(s)}<strong>${n}</strong></div>`).join('')}</div>
        <div class="card"><h3>מלאי נמוך</h3>${lowStock.map(d => `<div class="list-item"><span>${esc(d.name)}</span><strong>${db.inventory[d.id] || 0}</strong></div>`).join('') || '<p class="muted">אין</p>'}</div>
      </div>
      <div class="card"><h3>נתוני הדגמה</h3>
        <button class="btn btn-danger" onclick="App.resetData()">איפוס כל הנתונים למצב ההתחלתי</button>
        <button class="btn" onclick="App.exportData()">ייצוא נתונים (JSON)</button></div>`);
  }

  function viewAdUsers() {
    const rows = db.users.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${ROLE_LABEL[u.role]}</td><td>${esc(u.license || '')}</td><td>${esc(u.clinic || (u.patientId ? 'ת.ז ' + u.patientId : ''))}</td></tr>`).join('');
    return layout(`<div class="page-head"><h2>משתמשים</h2></div>
      <div class="card"><table class="table"><thead><tr><th>שם משתמש</th><th>שם</th><th>תפקיד</th><th>רישיון</th><th>שיוך</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="card"><h3>הוספת משתמש</h3>
        <form class="grid2" onsubmit="App.addUser(event)">
          <label>שם משתמש<input name="username" required></label>
          <label>סיסמה<input name="password" required></label>
          <label>שם מלא<input name="name" required></label>
          <label>תפקיד<select name="role"><option value="doctor">רופא/ה</option><option value="pharmacist">רוקח/ת</option><option value="patient">מטופל/ת</option><option value="admin">מנהל/ת</option></select></label>
          <label>מס' רישיון (לצוות)<input name="license"></label>
          <label>ת.ז מטופל/ת (למטופלים)<input name="patientId"></label>
          <div id="user-err" class="err span2"></div>
          <div class="span2"><button class="btn btn-primary">הוספה</button></div>
        </form></div>`);
  }

  function viewAdAudit() {
    const rows = db.audit.map(a => `<tr><td>${fmtDateTime(a.date)}</td><td>${esc(a.userName)}</td><td>${esc(a.action)}</td><td>${esc(a.details)}</td></tr>`).join('');
    return layout(`<div class="page-head"><h2>יומן פעולות</h2></div>
      <div class="card"><table class="table"><thead><tr><th>מועד</th><th>משתמש</th><th>פעולה</th><th>פרטים</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="muted">אין פעולות עדיין</td></tr>'}</tbody></table></div>`);
  }

  // ---------- ניתוב ----------
  const VIEWS = {
    'doc-schedule': viewDocSchedule, 'doc-search': viewDocSearch, 'doc-new-patient': viewDocNewPatient,
    'doc-patient': viewDocPatient, 'doc-visit': viewDocVisit, 'doc-rx-new': viewDocRx, 'doc-referral': viewDocReferral,
    'doc-sicknote': viewDocSickNote, 'doc-allergies': viewDocAllergies, 'doc-rx': viewDocRxList,
    'rx-print': viewRxPrint,
    'ph-dispense': viewPhDispense, 'ph-receipt': viewPhReceipt, 'ph-inventory': viewPhInventory, 'ph-history': viewPhHistory,
    'drug-catalog': viewDrugCatalog,
    'pt-home': viewPtHome, 'pt-rx': viewPtRx, 'pt-book': viewPtBook,
    'ad-dash': viewAdDash, 'ad-users': viewAdUsers, 'ad-audit': viewAdAudit,
  };
  const HOME = { doctor: 'doc-schedule', pharmacist: 'ph-dispense', patient: 'pt-home', admin: 'ad-dash' };
  // הרשאות: אילו מסכים זמינים לכל תפקיד
  const ALLOWED = {
    doctor: /^(doc-|rx-print|drug-catalog)/,
    pharmacist: /^(ph-|rx-print|drug-catalog)/,
    patient: /^(pt-|rx-print)/,
    admin: /^(ad-|drug-catalog)/,
  };

  function render() {
    if (!state.user) { $app.innerHTML = viewLogin(); return; }
    if (!VIEWS[state.view] || !ALLOWED[state.user.role].test(state.view)) state.view = HOME[state.user.role];
    if (state.view === 'rx-print' && state.user.role === 'patient') {
      const rx = S.prescription(state.params.id);
      if (!rx || rx.patientId !== state.user.patientId) state.view = 'pt-rx';
    }
    $app.innerHTML = VIEWS[state.view]();
    try { sessionStorage.setItem('medsys_session', JSON.stringify({ uid: state.user.id, view: state.view, params: state.params })); } catch (e) { /* ignore */ }
  }

  // ---------- פעולות ----------
  const App = {
    go,
    login(e) {
      e.preventDefault();
      const f = formData(e.target);
      const u = db.users.find(x => x.username === f.username.trim() && x.password === f.password);
      if (!u) { document.getElementById('login-err').textContent = 'שם משתמש או סיסמה שגויים'; return; }
      state.user = u;
      S.log(u, 'כניסה למערכת');
      persist();
      go(HOME[u.role]);
    },
    quickLogin(username) {
      const u = db.users.find(x => x.username === username);
      state.user = u;
      S.log(u, 'כניסה למערכת');
      persist();
      go(HOME[u.role]);
    },
    logout() {
      state.user = null;
      state.draft = null;
      try { sessionStorage.removeItem('medsys_session'); } catch (e) { /* ignore */ }
      render();
    },
    openPatient(id) { go('doc-patient', { id }); },

    apptStatus(id, status) {
      const a = db.appointments.find(x => x.id === id);
      a.status = status;
      S.log(state.user, 'עדכון תור', `${id} → ${status}`);
      persist();
      render();
    },

    createPatient(e) {
      e.preventDefault();
      const f = formData(e.target);
      const err = document.getElementById('form-err');
      const id = f.id.trim().padStart(9, '0');
      if (!Clinical.isValidIsraeliId(id)) { err.textContent = 'מספר תעודת זהות אינו תקין (ספרת ביקורת שגויה)'; return; }
      if (S.patient(id)) { err.textContent = 'מטופל/ת עם ת.ז זו כבר קיים/ת במערכת'; return; }
      if (new Date(f.birthDate) > new Date()) { err.textContent = 'תאריך לידה עתידי'; return; }
      const p = {
        id, firstName: f.firstName.trim(), lastName: f.lastName.trim(), birthDate: f.birthDate, gender: f.gender,
        phone: f.phone, address: f.address, plan: f.plan,
        allergies: Object.keys(Clinical.ALLERGY_LABELS).filter(k => f['allergy_' + k]),
        chronic: f.chronic ? f.chronic.split(',').map(s => s.trim()).filter(Boolean) : [],
        primaryDoctorId: state.user.id,
      };
      db.patients.push(p);
      S.log(state.user, 'קליטת מטופל/ת', `${fullName(p)} (${id})`);
      persist();
      flash('המטופל/ת נקלט/ה בהצלחה');
      go('doc-patient', { id });
    },

    saveVisit(e, pid) {
      e.preventDefault();
      const f = formData(e.target);
      const next = e.submitter ? e.submitter.value : '';
      const v = {
        id: S.nextId('V'), patientId: pid, doctorId: state.user.id, date: new Date().toISOString(),
        complaint: f.complaint, findings: f.findings, diagnosis: f.diagnosis, plan: f.plan,
        vitals: { bp: f.bp, pulse: f.pulse, temp: f.temp, weight: f.weight },
      };
      db.visits.push(v);
      // אם יש תור פתוח היום — מסמנים כהסתיים
      const appt = db.appointments.find(a => a.patientId === pid && a.doctorId === state.user.id && sameDay(a.start, new Date()) && a.status !== 'הסתיים');
      if (appt) appt.status = 'הסתיים';
      S.log(state.user, 'תיעוד ביקור', `${pid}: ${f.diagnosis}`);
      persist();
      flash('הביקור נשמר');
      if (next === 'rx') App.newRx(pid); else go('doc-patient', { id: pid, tab: 'visits' });
    },

    newRx(pid) {
      state.draft = { patientId: pid, items: [], notes: '' };
      go('doc-rx-new', { id: pid });
    },
    rxDrugChanged(sel) {
      const d = S.drug(sel.value);
      const box = document.getElementById('drug-info');
      if (!d) { box.textContent = ''; return; }
      const p = S.patient(state.draft.patientId);
      const c = Clinical.copay(d, p.plan, 1);
      const quick = Clinical.checkPrescription({
        patient: p, newDrugs: [d], activeDrugs: S.activeDrugIds(p.id).map(id => S.drug(id)).concat(state.draft.items.map(it => S.drug(it.drugId))), interactions: db.interactions,
      });
      box.innerHTML = `${esc(d.therapeuticClass)} · ${esc(d.form)} · ${d.packSize} יח' באריזה · ${d.inBasket ? 'בסל הבריאות' : 'מחוץ לסל'} · השתתפות לאריזה: ${money(c.perPack)}
        ${d.controlled ? '<br><strong>סם מסוכן:</strong> מרשם בתוקף 10 ימים, ללא ניפוקים חוזרים.' : ''}
        ${quick.length ? '<div class="pre-warn">' + warningsHtml(quick) + '</div>' : ''}`;
      if (d.controlled) {
        const rep = sel.form.repeats;
        rep.value = 1;
      }
    },
    rxAddItem(e) {
      e.preventDefault();
      const f = formData(e.target);
      const err = document.getElementById('rx-err');
      const d = S.drug(f.drugId);
      if (!d) { err.textContent = 'יש לבחור תרופה'; return; }
      const item = {
        drugId: d.id, dose: f.dose.trim(), frequency: f.frequency, durationDays: Number(f.durationDays),
        packages: Number(f.packages), repeats: Number(f.repeats), instructions: f.instructions.trim(), dispenses: [],
      };
      if (d.controlled && item.repeats > 1) { err.textContent = 'לא ניתן לרשום ניפוקים חוזרים לסם מסוכן'; return; }
      if (d.controlled && item.packages > 2) { err.textContent = 'סם מסוכן: עד 2 אריזות למרשם'; return; }
      if (item.durationDays < 1 || item.packages < 1 || item.repeats < 1) { err.textContent = 'ערכים לא תקינים'; return; }
      state.draft.items.push(item);
      render();
    },
    rxRemoveItem(i) { state.draft.items.splice(i, 1); render(); },
    rxNotes(v) { state.draft.notes = v; },
    rxSubmit() {
      const d = state.draft;
      const warnings = draftWarnings();
      const severe = warnings.filter(w => w.level === 'severe');
      const err = document.getElementById('rx-submit-err');
      let overrideReason = '';
      if (severe.length) {
        const ok = document.getElementById('rx-override');
        overrideReason = (document.getElementById('rx-override-reason').value || '').trim();
        if (!ok || !ok.checked || !overrideReason) {
          err.textContent = 'קיימות אזהרות חמורות: יש לאשר ולציין נימוק קליני, או להסיר את התרופה הבעייתית';
          return;
        }
      }
      const now = new Date();
      const validDays = Clinical.prescriptionValidityDays(d.items, S.drugsById());
      const rx = {
        id: S.nextId('RX'), patientId: d.patientId, doctorId: state.user.id, date: now.toISOString(),
        validUntil: new Date(now.getTime() + validDays * Clinical.DAY).toISOString(),
        notes: d.notes, items: d.items, overrideReason: overrideReason || undefined,
        warnings: warnings.map(w => w.msg),
      };
      db.prescriptions.push(rx);
      S.log(state.user, 'הנפקת מרשם', `${rx.id} ל-${d.patientId}: ${d.items.map(it => S.drug(it.drugId).name).join(', ')}${overrideReason ? ' | עקיפת אזהרה: ' + overrideReason : ''}`);
      persist();
      state.draft = null;
      flash(`המרשם ${rx.id} נחתם ונשלח לבית המרקחת`);
      go('doc-patient', { id: rx.patientId, tab: 'rx' });
    },
    cancelRx(id) {
      const reason = prompt('סיבת ביטול המרשם:');
      if (reason == null) return;
      const rx = S.prescription(id);
      rx.cancelled = true;
      rx.cancelReason = reason;
      S.log(state.user, 'ביטול מרשם', `${id}: ${reason}`);
      persist();
      flash('המרשם בוטל');
      render();
    },
    saveReferral(e, pid) {
      e.preventDefault();
      const f = formData(e.target);
      const r = { id: S.nextId('RF'), patientId: pid, doctorId: state.user.id, date: new Date().toISOString(), specialty: f.specialty, reason: f.reason, urgency: f.urgency, status: 'פתוחה' };
      db.referrals.push(r);
      S.log(state.user, 'הפניה', `${pid} → ${f.specialty}`);
      persist();
      flash('ההפניה נשמרה');
      go('doc-patient', { id: pid, tab: 'referrals' });
    },
    makeSickNote(e, pid) {
      e.preventDefault();
      const f = formData(e.target);
      if (f.to < f.from) { alert('תאריך הסיום מוקדם מתאריך ההתחלה'); return; }
      S.log(state.user, 'אישור מחלה', `${pid}: ${f.from} – ${f.to}`);
      persist();
      go('doc-sicknote', { id: pid, from: f.from, to: f.to, note: f.note });
    },
    saveAllergies(e, pid) {
      e.preventDefault();
      const f = formData(e.target);
      const p = S.patient(pid);
      p.allergies = Object.keys(Clinical.ALLERGY_LABELS).filter(k => f['allergy_' + k]);
      p.chronic = f.chronic.split(',').map(s => s.trim()).filter(Boolean);
      p.plan = f.plan;
      S.log(state.user, 'עדכון רקע רפואי', pid);
      persist();
      flash('הפרטים עודכנו');
      go('doc-patient', { id: pid });
    },

    // רוקח/ת
    phSearch(pid) {
      pid = String(pid).trim();
      if (pid && /^\d+$/.test(pid)) pid = pid.padStart(9, '0');
      state.dispenseSel = {};
      go('ph-dispense', { pid });
    },
    toggleDispense(key, on) {
      state.dispenseSel[key] = on;
      render();
    },
    dispense(pid) {
      const p = S.patient(pid);
      const sel = state.dispenseSel || {};
      const err = document.getElementById('disp-err');
      const byRx = {};
      for (const [key, on] of Object.entries(sel)) {
        if (!on) continue;
        const [rxId, idx] = key.split(':');
        (byRx[rxId] = byRx[rxId] || []).push(Number(idx));
      }
      // אימות מחדש לפני ביצוע
      let needsId = false;
      for (const [rxId, idxs] of Object.entries(byRx)) {
        const rx = S.prescription(rxId);
        for (const i of idxs) {
          const it = rx.items[i];
          const d = S.drug(it.drugId);
          const chk = Clinical.itemDispensable(rx, it);
          if (!chk.ok) { err.textContent = `${d.name}: ${chk.reason}`; return; }
          if ((db.inventory[d.id] || 0) < it.packages) { err.textContent = `${d.name}: אין מספיק מלאי`; return; }
          if (d.controlled) needsId = true;
        }
      }
      if (needsId) {
        const cb = document.getElementById('id-verified');
        if (!cb || !cb.checked) { err.textContent = 'יש לאמת זהות לפני ניפוק סם מסוכן'; return; }
      }
      const now = new Date().toISOString();
      let lastId = null;
      for (const [rxId, idxs] of Object.entries(byRx)) {
        const rx = S.prescription(rxId);
        const lines = idxs.map(i => {
          const it = rx.items[i];
          const d = S.drug(it.drugId);
          it.dispenses = (it.dispenses || []).concat(now);
          db.inventory[d.id] -= it.packages;
          return { drugId: d.id, packages: it.packages, copay: Clinical.copay(d, p.plan, it.packages).total };
        });
        const ds = { id: S.nextId('DS'), prescriptionId: rxId, patientId: pid, pharmacistId: state.user.id, date: now, lines, total: Math.round(lines.reduce((s, l) => s + l.copay, 0) * 100) / 100 };
        db.dispenses.push(ds);
        lastId = ds.id;
        S.log(state.user, 'ניפוק', `${ds.id} מרשם ${rxId}: ${lines.map(l => S.drug(l.drugId).name).join(', ')}`);
      }
      persist();
      state.dispenseSel = {};
      if (Object.keys(byRx).length === 1) go('ph-receipt', { id: lastId });
      else { flash('הניפוק בוצע בהצלחה'); go('ph-history'); }
    },
    addStock(e, drugId) {
      e.preventDefault();
      const qty = Number(e.target.qty.value);
      if (!(qty > 0)) return;
      db.inventory[drugId] = (db.inventory[drugId] || 0) + qty;
      S.log(state.user, 'קבלת מלאי', `${S.drug(drugId).name} +${qty}`);
      persist();
      flash(`נוספו ${qty} אריזות ${S.drug(drugId).name}`);
      render();
    },

    // מטופל/ת
    bookAppt(docId, date, time) {
      const reason = (document.getElementById('appt-reason').value || '').trim() || 'ביקור כללי';
      const start = new Date(`${date}T${time}:00`).toISOString();
      if (db.appointments.some(a => a.doctorId === docId && a.start === start && a.status !== 'בוטל ע"י מטופל')) { alert('השעה נתפסה, נא לבחור שעה אחרת'); render(); return; }
      db.appointments.push({ id: S.nextId('A'), patientId: state.user.patientId, doctorId: docId, start, reason, status: 'מתוזמן' });
      S.log(state.user, 'זימון תור', `${userName(docId)} ${date} ${time}`);
      persist();
      flash(`התור נקבע ל-${fmtDate(start)} בשעה ${time}`);
      go('pt-home');
    },
    cancelAppt(id) {
      if (!confirm('לבטל את התור?')) return;
      const a = db.appointments.find(x => x.id === id);
      a.status = 'בוטל ע"י מטופל';
      S.log(state.user, 'ביטול תור', id);
      persist();
      flash('התור בוטל');
      render();
    },

    // מנהל/ת
    addUser(e) {
      e.preventDefault();
      const f = formData(e.target);
      const err = document.getElementById('user-err');
      if (db.users.some(u => u.username === f.username.trim())) { err.textContent = 'שם המשתמש תפוס'; return; }
      if (f.role === 'patient' && !S.patient(f.patientId.trim())) { err.textContent = 'לא נמצא/ה מטופל/ת עם ת.ז זו'; return; }
      const u = { id: 'U' + (db.users.length + 1) + Date.now().toString(36), username: f.username.trim(), password: f.password, role: f.role, name: f.name, license: f.license, clinic: f.role === 'doctor' ? 'מרפאת הדגמה מרכז' : f.role === 'pharmacist' ? 'בית מרקחת הדגמה' : undefined, title: f.role === 'doctor' ? 'רפואה כללית' : undefined };
      if (f.role === 'patient') u.patientId = f.patientId.trim();
      db.users.push(u);
      S.log(state.user, 'הוספת משתמש', `${u.username} (${ROLE_LABEL[u.role]})`);
      persist();
      flash('המשתמש נוסף');
      render();
    },
    resetData() {
      if (!confirm('לאפס את כל הנתונים למצב ההדגמה ההתחלתי?')) return;
      db = S.reset();
      state.user = db.users.find(u => u.id === state.user.id) || null;
      flash('הנתונים אופסו');
      render();
    },
    exportData() {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'medsys-export.json';
      a.click();
      URL.revokeObjectURL(a.href);
    },
  };

  window.App = App;

  // שחזור התחברות בעת רענון הדף
  try {
    const sess = JSON.parse(sessionStorage.getItem('medsys_session') || 'null');
    if (sess) {
      state.user = S.user(sess.uid) || null;
      state.view = sess.view;
      state.params = sess.params || {};
      if (state.view === 'doc-rx-new') { state.draft = { patientId: state.params.id, items: [], notes: '' }; }
    }
  } catch (e) { /* ignore */ }
  render();
})();
