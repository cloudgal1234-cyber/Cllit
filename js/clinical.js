/*
 * לוגיקה קלינית ועסקית טהורה (ללא DOM) — ניתנת לבדיקה ב-Node.
 * בדיקות אלרגיה, אינטראקציות בין תרופות, השתתפות עצמית, סטטוס מרשם וזכאות לניפוק.
 */
(function (root) {
  const DAY = 24 * 60 * 60 * 1000;
  const MIN_DAYS_BETWEEN_REPEATS = 25;

  const ALLERGY_LABELS = {
    penicillin: 'פניצילין',
    cephalosporin: 'צפלוספורינים',
    sulfa: 'סולפה',
    nsaid: 'NSAIDs (נוגדי דלקת)',
    macrolide: 'מקרולידים',
    opioid: 'אופיואידים',
    aspirin: 'אספירין',
  };

  // רגישות צולבת: אלרגיה למפתח => אזהרה בינונית לקבוצה
  const CROSS_REACTIVITY = {
    penicillin: ['cephalosporin'],
    aspirin: ['nsaid'],
    nsaid: ['aspirin'],
  };

  function isValidIsraeliId(id) {
    id = String(id == null ? '' : id).trim();
    if (!/^\d{5,9}$/.test(id)) return false;
    id = id.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let n = Number(id[i]) * ((i % 2) + 1);
      if (n > 9) n -= 9;
      sum += n;
    }
    return sum % 10 === 0;
  }

  function ageFrom(birthDate, now) {
    const b = new Date(birthDate);
    const n = now ? new Date(now) : new Date();
    let age = n.getFullYear() - b.getFullYear();
    const m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--;
    return age;
  }

  function checkAllergies(patient, drug) {
    const warnings = [];
    const allergies = patient.allergies || [];
    const groups = drug.allergyGroups || [];
    for (const g of groups) {
      if (allergies.includes(g)) {
        warnings.push({
          level: 'severe',
          type: 'allergy',
          msg: `${drug.name}: המטופל/ת אלרגי/ת ל${ALLERGY_LABELS[g] || g}`,
        });
      }
    }
    for (const a of allergies) {
      for (const cross of CROSS_REACTIVITY[a] || []) {
        if (groups.includes(cross) && !groups.includes(a)) {
          warnings.push({
            level: 'moderate',
            type: 'allergy',
            msg: `${drug.name}: חשש לרגישות צולבת (אלרגיה ל${ALLERGY_LABELS[a] || a})`,
          });
        }
      }
    }
    return warnings;
  }

  function checkAge(patient, drug, now) {
    if (drug.minAge == null) return [];
    const age = ageFrom(patient.birthDate, now);
    if (age < drug.minAge) {
      return [{
        level: 'severe',
        type: 'age',
        msg: `${drug.name}: אינה מאושרת מתחת לגיל ${drug.minAge} (גיל המטופל/ת: ${age})`,
      }];
    }
    return [];
  }

  /*
   * newDrugs: תרופות במרשם החדש; activeDrugs: תרופות פעילות קיימות של המטופל.
   * בודק אינטראקציות בין כל זוג שבו לפחות תרופה אחת חדשה, וכן כפילות טיפולית.
   */
  function checkInteractions(newDrugs, activeDrugs, interactions) {
    const warnings = [];
    const seen = new Set();
    const all = newDrugs.map(d => ({ d, isNew: true })).concat(activeDrugs.map(d => ({ d, isNew: false })));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (!a.isNew && !b.isNew) continue;
        if (a.d.id === b.d.id) {
          const key = 'dup:' + a.d.id;
          if (!seen.has(key)) {
            seen.add(key);
            warnings.push({
              level: 'moderate',
              type: 'duplicate',
              msg: `${a.d.name} כבר ${b.isNew ? 'מופיעה פעמיים במרשם' : 'קיימת במרשם פעיל'}`,
            });
          }
          continue;
        }
        for (const it of interactions) {
          const match =
            (it.a === a.d.ingredient && it.b === b.d.ingredient) ||
            (it.a === b.d.ingredient && it.b === a.d.ingredient);
          if (match) {
            const key = 'int:' + [a.d.id, b.d.id].sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            warnings.push({
              level: it.severity,
              type: 'interaction',
              msg: `אינטראקציה ${a.d.name} + ${b.d.name}: ${it.note}`,
            });
          }
        }
        if (a.d.therapeuticClass && a.d.therapeuticClass === b.d.therapeuticClass) {
          const key = 'cls:' + [a.d.id, b.d.id].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            warnings.push({
              level: 'moderate',
              type: 'duplicate',
              msg: `כפילות טיפולית: ${a.d.name} ו-${b.d.name} מאותה קבוצה (${a.d.therapeuticClass})`,
            });
          }
        }
      }
    }
    return warnings;
  }

  function checkPrescription({ patient, newDrugs, activeDrugs, interactions, now }) {
    let warnings = [];
    for (const d of newDrugs) {
      warnings = warnings.concat(checkAllergies(patient, d), checkAge(patient, d, now));
    }
    warnings = warnings.concat(checkInteractions(newDrugs, activeDrugs || [], interactions || []));
    const order = { severe: 0, moderate: 1, minor: 2 };
    return warnings.sort((x, y) => order[x.level] - order[y.level]);
  }

  // השתתפות עצמית (מודל הדגמה): תרופה בסל — 15% מהמחיר, מינימום ₪10 ותקרה ₪60 לאריזה.
  // מחוץ לסל — מחיר מלא בהנחת ביטוח משלים.
  const PLAN_DISCOUNT = { 'בסיסי': 0, 'מושלם': 0.2, 'פלטינום': 0.35 };

  function copay(drug, plan, packages) {
    packages = packages || 1;
    let perPack;
    if (drug.inBasket) {
      perPack = Math.min(60, Math.max(10, drug.price * 0.15));
    } else {
      perPack = drug.price * (1 - (PLAN_DISCOUNT[plan] || 0));
    }
    perPack = Math.round(perPack * 100) / 100;
    return {
      perPack,
      total: Math.round(perPack * packages * 100) / 100,
      covered: drug.inBasket,
    };
  }

  function prescriptionValidityDays(items, drugsById) {
    const controlled = items.some(it => drugsById[it.drugId] && drugsById[it.drugId].controlled);
    if (controlled) return 10;
    const maxRepeats = Math.max(1, ...items.map(it => it.repeats || 1));
    return maxRepeats * 30;
  }

  function itemDone(item) {
    return (item.dispenses || []).length >= (item.repeats || 1);
  }

  function prescriptionStatus(rx, now) {
    now = now ? new Date(now) : new Date();
    if (rx.cancelled) return 'בוטל';
    const done = rx.items.filter(itemDone).length;
    const anyDispensed = rx.items.some(it => (it.dispenses || []).length > 0);
    if (done === rx.items.length) return 'נופק';
    if (now > new Date(rx.validUntil)) return 'פג תוקף';
    if (anyDispensed) return 'נופק חלקית';
    return 'פעיל';
  }

  function itemDispensable(rx, item, now) {
    now = now ? new Date(now) : new Date();
    const status = prescriptionStatus(rx, now);
    if (status === 'בוטל') return { ok: false, reason: 'המרשם בוטל' };
    if (status === 'פג תוקף') return { ok: false, reason: 'פג תוקף המרשם' };
    if (itemDone(item)) return { ok: false, reason: 'נופק במלואו' };
    const d = item.dispenses || [];
    if (d.length > 0) {
      const last = new Date(d[d.length - 1]);
      const days = Math.floor((now - last) / DAY);
      if (days < MIN_DAYS_BETWEEN_REPEATS) {
        return { ok: false, reason: `ניפוק חוזר אפשרי בעוד ${MIN_DAYS_BETWEEN_REPEATS - days} ימים` };
      }
    }
    return { ok: true, reason: '' };
  }

  const Clinical = {
    DAY,
    ALLERGY_LABELS,
    PLAN_DISCOUNT,
    MIN_DAYS_BETWEEN_REPEATS,
    isValidIsraeliId,
    ageFrom,
    checkAllergies,
    checkAge,
    checkInteractions,
    checkPrescription,
    copay,
    prescriptionValidityDays,
    prescriptionStatus,
    itemDispensable,
    itemDone,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Clinical;
  else root.Clinical = Clinical;
})(typeof window !== 'undefined' ? window : globalThis);
