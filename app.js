/* Oberkörper-Trainingsplan – Vanilla PWA
 * Plan nach Wochentagen: Mo–Fr je ein Training, Wochenende Pause.
 * Max. ein Training pro Tag. Kalender + Verlauf.
 * Alle Daten lokal im localStorage. */

'use strict';

// TEMPORÄR: tut so, als wäre Wochenende, um das Nachholen zu testen. Wieder auf false setzen!
const TEST_WEEKEND = true;

const STORAGE_KEY = 'trainingsplan.v2';

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
  if (TEST_WEEKEND) return -1; // TEMPORÄR: Wochenende simulieren
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

/** Werktags-Trainings (Mo–Fr) dieser Woche, deren Tag schon vorbei ist und die
 *  noch nicht (auch nicht nachträglich) abgeschlossen wurden. */
function missedWorkoutsThisWeek() {
  const today = todayISO();
  const monday = startOfWeekISO(today);
  const doneIds = new Set(
    state.history.filter((h) => h.date >= monday && h.date <= today).map((h) => h.workoutId)
  );
  const todayWd = weekdayIndexOf(today); // 0=So … 6=Sa
  const weekendNow = TEST_WEEKEND || todayWd === 0 || todayWd === 6;

  const missed = [];
  for (let wd = 1; wd <= 5; wd++) {         // Mo(1) … Fr(5)
    const dayPassed = weekendNow || wd < todayWd;
    if (!dayPassed) continue;               // Tag noch nicht vorbei
    const wo = state.workouts[wd - 1];
    if (wo && !doneIds.has(wo.id)) missed.push(wo);
  }
  return missed;
}

/* ---------- Rendering: Heute ---------- */
function renderToday() {
  const eyebrow = document.getElementById('todayEyebrow');
  const nameEl = document.getElementById('todayWorkoutName');
  const listEl = document.getElementById('exerciseList');
  const finishBtn = document.getElementById('finishBtn');
  const undoBtn = document.getElementById('undoTodayBtn');
  const backBtn = document.getElementById('catchupBack');
  const picker = document.getElementById('catchupPicker');
  const progressWrap = document.querySelector('#view-today .progress');
  const lastEl = document.getElementById('lastTrained');

  listEl.innerHTML = '';
  picker.innerHTML = '';
  picker.hidden = true;
  backBtn.hidden = true;

  const idx = workoutIndexForToday();
  const wdLong = WEEKDAYS_LONG[weekdayIndexOf(todayISO())];

  let wo = null;
  let isCatchUp = false;

  // --- Wochenende ---
  if (idx === -1) {
    // Heute schon ein (Nachhol-)Training abgeschlossen?
    if (trainedToday()) {
      const entry = state.history.find((h) => h.date === todayISO());
      eyebrow.textContent = wdLong;
      nameEl.textContent = entry ? entry.workoutName : 'Erledigt';
      progressWrap.style.display = 'none';
      finishBtn.style.display = 'none';
      undoBtn.style.display = 'block';
      lastEl.textContent = 'Nachhol-Training erledigt ✅';
      return;
    }

    const missed = missedWorkoutsThisWeek();

    // Nichts verpasst → normale Pause
    if (missed.length === 0) {
      eyebrow.textContent = wdLong;
      nameEl.textContent = 'Pause 💤';
      progressWrap.style.display = 'none';
      finishBtn.style.display = 'none';
      undoBtn.style.display = 'none';
      lastEl.textContent = 'Am Wochenende ist Ruhetag. Genieß die Erholung!';
      return;
    }

    // Gemerkte Auswahl bereinigen, falls nicht mehr verpasst
    if (catchUpWorkoutId && !missed.some((m) => m.id === catchUpWorkoutId)) {
      catchUpWorkoutId = null;
    }

    // Noch nichts gewählt → Auswahl der verpassten Trainings zeigen
    if (!catchUpWorkoutId) {
      eyebrow.textContent = wdLong + ' · Nachholen';
      nameEl.textContent = missed.length === 1 ? '1 Training verpasst' : missed.length + ' Trainings verpasst';
      progressWrap.style.display = 'none';
      finishBtn.style.display = 'none';
      undoBtn.style.display = 'none';
      picker.hidden = false;
      missed.forEach((m) => {
        const b = document.createElement('button');
        b.className = 'catchup-option';
        b.innerHTML = `<span class="co-day"></span><span class="co-name"></span>`;
        b.querySelector('.co-day').textContent = m.day;
        b.querySelector('.co-name').textContent = m.name;
        b.addEventListener('click', () => { catchUpWorkoutId = m.id; renderToday(); });
        picker.appendChild(b);
      });
      lastEl.textContent = 'Diese Woche verpasst – hol ein Training am Wochenende nach.';
      return;
    }

    // Nachhol-Training gewählt → wie ein normales Training rendern
    wo = state.workouts.find((w) => w.id === catchUpWorkoutId);
    isCatchUp = true;
    backBtn.hidden = missed.length <= 1;
  } else {
    wo = state.workouts[idx];
  }

  // --- Gemeinsames Rendering eines Trainings ---
  eyebrow.textContent = isCatchUp ? ('Nachholen · ' + wo.day) : wdLong;
  nameEl.textContent = wo.name;
  progressWrap.style.display = 'flex';

  const alreadyDone = !isCatchUp && trainedToday();
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
    undoBtn.style.display = 'block';
    lastEl.textContent = 'Heute schon erledigt ✅ – morgen geht’s weiter!';
  } else {
    finishBtn.style.display = 'block';
    finishBtn.disabled = total === 0;
    undoBtn.style.display = 'none';
    lastEl.textContent = isCatchUp
      ? 'Nachhol-Training: Übungen abhaken und „Training abschließen".'
      : lastTrainedText();
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
  if (trainedToday()) { toast('Heute schon trainiert – morgen wieder!'); return; }

  let wo;
  const idx = workoutIndexForToday();
  if (idx === -1) {
    // Wochenende: nur mit ausgewähltem Nachhol-Training
    if (!catchUpWorkoutId) { toast('Am Wochenende ist Pause 🙂'); return; }
    wo = state.workouts.find((w) => w.id === catchUpWorkoutId);
    if (!wo) { catchUpWorkoutId = null; toast('Training nicht gefunden'); return; }
  } else {
    wo = state.workouts[idx];
  }

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
  catchUpWorkoutId = null;
  save();

  renderToday();
  renderHistory();
  toast(idx === -1 ? 'Nachgeholt! Training gespeichert 💪' : 'Stark! Training gespeichert 💪');
}

/** Heutiges Training rückgängig machen: nur den heutigen Eintrag aus dem Verlauf
 *  entfernen und die abgehakten Übungen wiederherstellen (alles andere bleibt). */
function undoToday() {
  if (!trainedToday()) return;
  if (!confirm('Heutiges Training zurücksetzen? Nur der heutige Eintrag wird aus dem Verlauf entfernt – dein übriger Verlauf bleibt erhalten.')) return;

  const entry = state.history.find((h) => h.date === todayISO());
  const checked = {};
  if (entry && Array.isArray(entry.doneExerciseIds)) {
    entry.doneExerciseIds.forEach((id) => { checked[id] = true; });
  }
  state.history = state.history.filter((h) => h.date !== todayISO());
  state.session = { date: todayISO(), checked };
  save();

  renderToday();
  renderHistory();
  toast('Heutiges Training zurückgesetzt');
}

/* ---------- Rendering: Verlauf + Kalender ---------- */
function trainingsThisWeek() {
  const monday = startOfWeekISO(todayISO());
  return state.history.filter((h) => h.date >= monday).length;
}

let calState = null; // { year, month }  (month 0-basiert)
let catchUpWorkoutId = null; // am Wochenende ausgewähltes Nachhol-Training (nur zur Laufzeit)

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
      save();
      renderAll();
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
  document.getElementById('undoTodayBtn').addEventListener('click', undoToday);
  document.getElementById('catchupBack').addEventListener('click', () => { catchUpWorkoutId = null; renderToday(); });
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('resetBtn').addEventListener('click', resetData);
  document.getElementById('calPrev').addEventListener('click', () => shiftMonth(-1));
  document.getElementById('calNext').addEventListener('click', () => shiftMonth(1));

  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .catch((err) => console.warn('SW-Registrierung fehlgeschlagen', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
