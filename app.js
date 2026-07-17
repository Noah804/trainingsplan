/* Oberkörper-Trainingsplan – Vanilla PWA
 * Plan nach Wochentagen: Mo–Fr je ein Training, Wochenende Pause.
 * Max. ein Training pro Tag. Kalender + tägliche Erinnerung (17:00).
 * Alle Daten lokal im localStorage. */

'use strict';

const STORAGE_KEY = 'trainingsplan.v2';
const REMINDER_HOUR = 17;

const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* ---------- ID-Helfer ---------- */
let idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return prefix + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
}

/* ---------- Standardplan: Mo–Fr, Oberkörper ---------- */
function defaultState() {
  const mk = (day, name, exercises) => ({
    id: uid('w'),
    day,
    name,
    exercises: exercises.map((n) => ({ id: uid('e'), name: n })),
  });
  return {
    // Index 0 = Montag … 4 = Freitag
    workouts: [
      mk('Mo', 'Brust & Trizeps', [
        'Bankdrücken (Langhantel)',
        'Schrägbankdrücken (Kurzhantel)',
        'Butterfly / Kabel-Fly',
        'Trizeps-Pushdown (Kabel)',
        'French Press',
        'Liegestütze',
      ]),
      mk('Di', 'Rücken & Bizeps', [
        'Klimmzüge / Latzug',
        'Langhantelrudern',
        'Kabelrudern (eng)',
        'Face Pulls',
        'Bizeps-Curls (Langhantel)',
        'Hammer-Curls',
      ]),
      mk('Mi', 'Schultern', [
        'Schulterdrücken (Kurzhantel)',
        'Seitheben',
        'Frontheben',
        'Reverse Flys',
        'Upright Rows',
        'Shrugs',
      ]),
      mk('Do', 'Arme', [
        'Bizeps-Curls (Langhantel)',
        'Hammer-Curls',
        'Konzentrationscurls',
        'Trizeps-Dips',
        'Trizeps-Pushdown',
        'Overhead-Trizeps (Seil)',
      ]),
      mk('Fr', 'Oberkörper komplett', [
        'Bankdrücken',
        'Latzug',
        'Schulterdrücken',
        'Rudern (Kurzhantel)',
        'Bizeps-Curls',
        'Trizeps-Pushdown',
      ]),
    ],
    history: [],
    session: { date: todayISO(), checked: {} },
    settings: { reminder: false, lastNotified: null, reminderTime: '17:00' },
  };
}

/* ---------- State laden/speichern ---------- */
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.workouts) || parsed.workouts.length === 0) return defaultState();
    if (!Array.isArray(parsed.history)) parsed.history = [];
    if (!parsed.session || typeof parsed.session !== 'object') {
      parsed.session = { date: todayISO(), checked: {} };
    }
    if (!parsed.settings || typeof parsed.settings !== 'object') {
      parsed.settings = { reminder: false, lastNotified: null, reminderTime: '17:00' };
    }
    if (!parsed.settings.reminderTime) parsed.settings.reminderTime = '17:00';
    return parsed;
  } catch (e) {
    console.error('State konnte nicht geladen werden, nutze Standard.', e);
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    toast('Speichern fehlgeschlagen');
  }
}

/* ---------- Datum-Helfer ---------- */
function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function weekdayIndexOf(iso) {
  return new Date(iso + 'T00:00:00').getDay(); // 0=So … 6=Sa
}

/** Index in state.workouts für einen Wochentag; -1 am Wochenende. */
function workoutIndexForToday() {
  const wd = weekdayIndexOf(todayISO());
  if (wd >= 1 && wd <= 5) return wd - 1;
  return -1;
}

function formatDate(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00');
  const b = new Date(isoB + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/** Montag (ISO) der Woche, in der `iso` liegt. */
function startOfWeekISO(iso) {
  const d = new Date(iso + 'T00:00:00');
  const wd = d.getDay();
  const diff = wd === 0 ? -6 : 1 - wd;
  d.setDate(d.getDate() + diff);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function trainedToday() {
  return state.history.some((h) => h.date === todayISO());
}

function sessionForToday() {
  if (!state.session || state.session.date !== todayISO()) {
    state.session = { date: todayISO(), checked: {} };
  }
  if (!state.session.checked || typeof state.session.checked !== 'object') {
    state.session.checked = {};
  }
  return state.session;
}

/* ---------- Rendering: Heute ---------- */
function renderToday() {
  const eyebrow = document.getElementById('todayEyebrow');
  const nameEl = document.getElementById('todayWorkoutName');
  const listEl = document.getElementById('exerciseList');
  const finishBtn = document.getElementById('finishBtn');
  const progressWrap = document.querySelector('#view-today .progress');
  const lastEl = document.getElementById('lastTrained');

  listEl.innerHTML = '';
  const idx = workoutIndexForToday();
  const wdLong = WEEKDAYS_LONG[weekdayIndexOf(todayISO())];

  // --- Wochenende: Pause ---
  if (idx === -1) {
    eyebrow.textContent = wdLong;
    nameEl.textContent = 'Pause 💤';
    progressWrap.style.display = 'none';
    finishBtn.style.display = 'none';
    lastEl.textContent = 'Am Wochenende ist Ruhetag. Genieß die Erholung!';
    return;
  }

  const wo = state.workouts[idx];
  eyebrow.textContent = wdLong;
  nameEl.textContent = wo.name;
  progressWrap.style.display = 'flex';

  const alreadyDone = trainedToday();
  const session = sessionForToday();

  let doneSet;
  if (alreadyDone) {
    const entry = state.history.find((h) => h.date === todayISO());
    doneSet = new Set(entry ? entry.doneExerciseIds : []);
  } else {
    doneSet = new Set(wo.exercises.filter((ex) => session.checked[ex.id]).map((ex) => ex.id));
  }

  wo.exercises.forEach((ex) => {
    const li = document.createElement('li');
    li.className = 'exercise' + (doneSet.has(ex.id) ? ' done' : '') + (alreadyDone ? ' locked' : '');
    li.innerHTML = `<span class="check">✓</span><span class="name"></span>`;
    li.querySelector('.name').textContent = ex.name;
    if (!alreadyDone) li.addEventListener('click', () => toggleExercise(ex.id));
    listEl.appendChild(li);
  });

  const total = wo.exercises.length;
  const done = doneSet.size;
  document.getElementById('progressText').textContent = `${done} / ${total} erledigt`;
  document.getElementById('progressFill').style.width = total ? (done / total) * 100 + '%' : '0%';

  if (alreadyDone) {
    finishBtn.style.display = 'none';
    lastEl.textContent = 'Heute schon erledigt ✅ – morgen geht’s weiter!';
  } else {
    finishBtn.style.display = 'block';
    finishBtn.disabled = total === 0;
    lastEl.textContent = lastTrainedText();
  }
}

function lastTrainedText() {
  if (!state.history.length) return 'Noch kein Training aufgezeichnet.';
  const last = state.history[state.history.length - 1];
  const diff = daysBetween(last.date, todayISO());
  const when = diff === 0 ? 'heute' : diff === 1 ? 'gestern' : `vor ${diff} Tagen`;
  return `Zuletzt trainiert: ${when} (${last.workoutName}).`;
}

function toggleExercise(exId) {
  if (trainedToday()) return;
  const session = sessionForToday();
  session.checked[exId] = !session.checked[exId];
  save();
  renderToday();
}

function finishWorkout() {
  const idx = workoutIndexForToday();
  if (idx === -1) { toast('Am Wochenende ist Pause 🙂'); return; }
  if (trainedToday()) { toast('Heute schon trainiert – morgen wieder!'); return; }

  const wo = state.workouts[idx];
  const session = sessionForToday();
  const doneIds = wo.exercises.filter((ex) => session.checked[ex.id]).map((ex) => ex.id);

  state.history.push({
    date: todayISO(),
    workoutId: wo.id,
    workoutName: wo.name,
    doneExerciseIds: doneIds,
    totalExercises: wo.exercises.length,
  });
  state.session = { date: todayISO(), checked: {} };
  save();

  renderToday();
  renderHistory();
  toast('Stark! Training gespeichert 💪');
}

/* ---------- Rendering: Verlauf + Kalender ---------- */
function trainingsThisWeek() {
  const monday = startOfWeekISO(todayISO());
  return state.history.filter((h) => h.date >= monday).length;
}

let calState = null; // { year, month }  (month 0-basiert)

function ensureCalState() {
  if (!calState) {
    const d = new Date();
    calState = { year: d.getFullYear(), month: d.getMonth() };
  }
}

function trainedDatesSet() {
  return new Set(state.history.map((h) => h.date));
}

function renderCalendar() {
  ensureCalState();
  const { year, month } = calState;
  const grid = document.getElementById('calGrid');
  document.getElementById('calTitle').textContent = MONTHS_LONG[month] + ' ' + year;
  grid.innerHTML = '';

  ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDow = new Date(year, month, 1).getDay(); // 0=So
  const offset = firstDow === 0 ? 6 : firstDow - 1;   // Montag-basiert
  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    grid.appendChild(el);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const trained = trainedDatesSet();
  const today = todayISO();

  for (let day = 1; day <= daysInMonth; day++) {
    const iso = year + '-' + pad2(month + 1) + '-' + pad2(day);
    const el = document.createElement('div');
    el.className = 'cal-cell';
    if (iso === today) el.classList.add('today');

    const num = document.createElement('span');
    num.className = 'cal-num';
    num.textContent = day;
    el.appendChild(num);

    if (trained.has(iso)) {
      el.classList.add('trained');
      const x = document.createElement('span');
      x.className = 'cal-x';
      x.textContent = '✕';
      el.appendChild(x);
    }
    grid.appendChild(el);
  }
}

function shiftMonth(delta) {
  ensureCalState();
  let m = calState.month + delta;
  let y = calState.year;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  calState = { year: y, month: m };
  renderCalendar();
}

function renderHistory() {
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  listEl.innerHTML = '';

  document.getElementById('statTotal').textContent = state.history.length;
  document.getElementById('statWeek').textContent = trainingsThisWeek();

  if (state.history.length) {
    const last = state.history[state.history.length - 1];
    const diff = daysBetween(last.date, todayISO());
    document.getElementById('statLast').textContent = diff === 0 ? 'heute' : diff === 1 ? 'gestern' : diff + 'd';
    emptyEl.style.display = 'none';
  } else {
    document.getElementById('statLast').textContent = '–';
    emptyEl.style.display = 'block';
  }

  renderCalendar();

  [...state.history].reverse().forEach((h) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const total = h.totalExercises != null ? h.totalExercises : (h.doneExerciseIds ? h.doneExerciseIds.length : 0);
    const done = h.doneExerciseIds ? h.doneExerciseIds.length : 0;
    li.innerHTML = `
      <div>
        <div class="h-date"></div>
        <div class="h-sub"></div>
      </div>
      <div class="h-count">${done}/${total} ✓</div>`;
    li.querySelector('.h-date').textContent = formatDate(h.date);
    li.querySelector('.h-sub').textContent = h.workoutName;
    listEl.appendChild(li);
  });
}

/* ---------- Rendering: Bearbeiten ---------- */
function renderEdit() {
  const wrap = document.getElementById('editList');
  wrap.innerHTML = '';

  state.workouts.forEach((wo) => {
    const card = document.createElement('div');
    card.className = 'edit-workout';

    const head = document.createElement('div');
    head.className = 'edit-workout-head';
    const badge = document.createElement('span');
    badge.className = 'idx';
    badge.textContent = wo.day || '?';
    head.appendChild(badge);

    const nameInput = document.createElement('input');
    nameInput.className = 'edit-input wname';
    nameInput.value = wo.name;
    nameInput.setAttribute('aria-label', 'Name des Trainings');
    nameInput.addEventListener('change', () => {
      wo.name = nameInput.value.trim() || 'Training';
      save();
      renderToday();
    });
    head.appendChild(nameInput);
    card.appendChild(head);

    const exList = document.createElement('ul');
    exList.className = 'edit-exercises';
    wo.exercises.forEach((ex) => {
      const row = document.createElement('li');
      row.className = 'edit-ex-row';
      const inp = document.createElement('input');
      inp.className = 'edit-input';
      inp.value = ex.name;
      inp.setAttribute('aria-label', 'Übungsname');
      inp.addEventListener('change', () => {
        ex.name = inp.value.trim() || 'Übung';
        save();
        renderToday();
      });
      const del = iconBtn('✕', 'del', () => {
        wo.exercises = wo.exercises.filter((e) => e.id !== ex.id);
        save();
        renderEdit();
        renderToday();
      });
      row.append(inp, del);
      exList.appendChild(row);
    });
    card.appendChild(exList);

    const addEx = document.createElement('button');
    addEx.className = 'btn btn-small add-ex';
    addEx.textContent = '+ Übung';
    addEx.addEventListener('click', () => {
      wo.exercises.push({ id: uid('e'), name: 'Neue Übung' });
      save();
      renderEdit();
      renderToday();
    });
    card.appendChild(addEx);

    wrap.appendChild(card);
  });
}

function iconBtn(label, extraClass, onClick) {
  const b = document.createElement('button');
  b.className = 'icon-btn ' + extraClass;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/* ---------- Tägliche Erinnerung (17:00) ---------- */
function notificationsSupported() {
  return 'Notification' in window;
}

function reminderParts() {
  const [h, m] = String(state.settings.reminderTime || '17:00').split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function nextReminderTime() {
  const now = new Date();
  const { h, m } = reminderParts();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t;
}

function updateReminderUI() {
  const btn = document.getElementById('reminderBtn');
  if (!btn) return;
  if (!notificationsSupported()) {
    btn.textContent = 'Nicht unterstützt';
    btn.disabled = true;
    return;
  }
  const on = state.settings.reminder && Notification.permission === 'granted';
  btn.textContent = on ? 'Aktiv ✓' : 'Aktivieren';
  btn.classList.toggle('btn-primary', on);

  const timeInput = document.getElementById('reminderTime');
  if (timeInput) timeInput.value = state.settings.reminderTime || '17:00';
  const sub = document.getElementById('reminderSub');
  if (sub) sub.textContent = 'Werktags um ' + (state.settings.reminderTime || '17:00') + ' Uhr';
}

function changeReminderTime(val) {
  if (!val) return;
  state.settings.reminderTime = val;
  state.settings.lastNotified = null; // erlaubt heute erneut eine Erinnerung zur neuen Zeit
  save();
  updateReminderUI();
  if (state.settings.reminder) {
    scheduleReminder();
    toast('Erinnerungszeit: ' + val + ' Uhr');
  }
}

function toggleReminder() {
  if (state.settings.reminder && Notification.permission === 'granted') {
    disableReminder();
  } else {
    enableReminder();
  }
}

async function enableReminder() {
  if (!notificationsSupported()) { toast('Dein Browser kann keine Benachrichtigungen'); return; }
  let perm = Notification.permission;
  if (perm !== 'granted') perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Benachrichtigung wurde nicht erlaubt'); updateReminderUI(); return; }
  state.settings.reminder = true;
  save();
  await scheduleReminder();
  updateReminderUI();
  toast('Erinnerung aktiv – werktags 17:00 Uhr');
}

function disableReminder() {
  state.settings.reminder = false;
  save();
  updateReminderUI();
  toast('Erinnerung deaktiviert');
}

/** Best-effort: Benachrichtigung im Voraus planen (falls Browser das unterstützt). */
async function scheduleReminder() {
  if (!state.settings.reminder || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('showTrigger' in Notification.prototype && 'TimestampTrigger' in window) {
      await reg.showNotification('Zeit fürs Training 🏋️', {
        tag: 'training-reminder',
        body: 'Dein Oberkörper-Training wartet! 💪',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        // eslint-disable-next-line no-undef
        showTrigger: new TimestampTrigger(nextReminderTime().getTime()),
      });
    }
  } catch (e) {
    console.warn('scheduleReminder fehlgeschlagen', e);
  }
}

/** Fallback: Wenn die App nach 17:00 geöffnet wird und noch nicht trainiert wurde. */
function reminderFallbackCheck() {
  if (!state.settings.reminder || !notificationsSupported() || Notification.permission !== 'granted') return;
  const now = new Date();
  const wd = now.getDay();
  if (wd < 1 || wd > 5) return;           // Wochenende
  const { h, m } = reminderParts();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return; // vor der eingestellten Zeit
  if (trainedToday()) return;
  if (state.settings.lastNotified === todayISO()) return;

  state.settings.lastNotified = todayISO();
  save();
  const opts = { body: 'Dein Training wartet noch heute! 💪', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'training-reminder' };
  try {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification('Zeit fürs Training 🏋️', opts))
      .catch(() => new Notification('Zeit fürs Training 🏋️', opts));
  } catch (e) {
    try { new Notification('Zeit fürs Training 🏋️', opts); } catch (_) {}
  }
}

/* ---------- Daten: Export / Import / Reset ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trainingsplan-backup-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup exportiert');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.workouts)) throw new Error('Ungültiges Format');
      state = data;
      if (!Array.isArray(state.history)) state.history = [];
      if (!state.session) state.session = { date: todayISO(), checked: {} };
      if (!state.settings) state.settings = { reminder: false, lastNotified: null };
      save();
      renderAll();
      updateReminderUI();
      toast('Backup importiert');
    } catch (e) {
      toast('Import fehlgeschlagen: ungültige Datei');
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm('Alles zurücksetzen? Verlauf und Plan gehen verloren.')) return;
  state = defaultState();
  save();
  renderAll();
  updateReminderUI();
  toast('Zurückgesetzt');
}

/* ---------- Navigation ---------- */
function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
  if (view === 'history') renderHistory();
  if (view === 'edit') renderEdit();
  if (view === 'today') renderToday();
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- Init ---------- */
function renderAll() {
  renderToday();
  renderHistory();
  renderEdit();
}

function init() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });
  document.getElementById('finishBtn').addEventListener('click', finishWorkout);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('resetBtn').addEventListener('click', resetData);
  document.getElementById('calPrev').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('calNext').addEventListener('click', () => shiftMonth(1));
  document.getElementById('reminderBtn').addEventListener('click', toggleReminder);
  const reminderTimeInput = document.getElementById('reminderTime');
  if (reminderTimeInput) reminderTimeInput.addEventListener('change', (e) => changeReminderTime(e.target.value));

  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  renderAll();
  updateReminderUI();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(() => {
          reminderFallbackCheck();
          scheduleReminder();
        })
        .catch((err) => console.warn('SW-Registrierung fehlgeschlagen', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
