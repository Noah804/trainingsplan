/* Oberkörper-Trainingsplan – Vanilla PWA
 * Alle Daten liegen lokal im localStorage. Kein Server, keine Cloud. */

'use strict';

const STORAGE_KEY = 'trainingsplan.v1';

/* ---------- ID-Helfer ---------- */
let idCounter = 0;
function uid(prefix) {
  idCounter += 1;
  return prefix + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
}

/* ---------- Standardplan (3er-Oberkörper-Split) ---------- */
function defaultState() {
  const mk = (name, exercises) => ({
    id: uid('w'),
    name,
    exercises: exercises.map((n) => ({ id: uid('e'), name: n })),
  });
  return {
    workouts: [
      mk('Drücken', [
        'Bankdrücken (Langhantel)',
        'Schrägbankdrücken (Kurzhantel)',
        'Butterfly / Kabel-Fly',
        'Trizeps-Pushdown (Kabel)',
        'French Press',
      ]),
      mk('Ziehen', [
        'Klimmzüge / Latzug',
        'Rudern (Kurzhantel oder Kabel)',
        'Face Pulls',
        'Bizeps-Curls (Langhantel)',
        'Hammer-Curls',
      ]),
      mk('Schultern & Arme', [
        'Schulterdrücken (Kurzhantel)',
        'Seitheben',
        'Reverse Flys',
        'Bizeps-Curls (Kurzhantel)',
        'Trizeps-Dips',
      ]),
    ],
    currentIndex: 0,
    history: [],
    session: { workoutIndex: 0, checked: {} },
  };
}

/* ---------- State laden/speichern ---------- */
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Grundstruktur absichern
    if (!Array.isArray(parsed.workouts) || parsed.workouts.length === 0) return defaultState();
    if (typeof parsed.currentIndex !== 'number') parsed.currentIndex = 0;
    if (!Array.isArray(parsed.history)) parsed.history = [];
    if (!parsed.session || typeof parsed.session !== 'object') {
      parsed.session = { workoutIndex: parsed.currentIndex, checked: {} };
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

/* ---------- Hilfen ---------- */
function clampIndex(i) {
  const n = state.workouts.length;
  if (n === 0) return 0;
  return ((i % n) + n) % n;
}

function currentWorkout() {
  return state.workouts[clampIndex(state.currentIndex)];
}

/** Session neu ausrichten, falls sie nicht mehr zur aktuellen Einheit passt. */
function ensureSession() {
  const idx = clampIndex(state.currentIndex);
  if (state.session.workoutIndex !== idx) {
    state.session = { workoutIndex: idx, checked: {} };
  }
  if (!state.session.checked || typeof state.session.checked !== 'object') {
    state.session.checked = {};
  }
}

function todayISO() {
  // Lokales Datum als YYYY-MM-DD (nicht UTC, damit der Tag stimmt)
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
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

/* ---------- Rendering: Heute ---------- */
function renderToday() {
  ensureSession();
  const wo = currentWorkout();
  const nameEl = document.getElementById('todayWorkoutName');
  const listEl = document.getElementById('exerciseList');
  const finishBtn = document.getElementById('finishBtn');

  if (!wo) {
    nameEl.textContent = 'Keine Einheit';
    listEl.innerHTML = '';
    finishBtn.disabled = true;
    return;
  }

  nameEl.textContent = wo.name;
  listEl.innerHTML = '';

  wo.exercises.forEach((ex) => {
    const li = document.createElement('li');
    li.className = 'exercise' + (state.session.checked[ex.id] ? ' done' : '');
    li.innerHTML = `<span class="check">✓</span><span class="name"></span>`;
    li.querySelector('.name').textContent = ex.name;
    li.addEventListener('click', () => toggleExercise(ex.id));
    listEl.appendChild(li);
  });

  const total = wo.exercises.length;
  const done = wo.exercises.filter((ex) => state.session.checked[ex.id]).length;
  document.getElementById('progressText').textContent = `${done} / ${total} erledigt`;
  document.getElementById('progressFill').style.width = total ? (done / total) * 100 + '%' : '0%';
  finishBtn.disabled = total === 0;

  // "zuletzt trainiert"
  const lastEl = document.getElementById('lastTrained');
  if (state.history.length) {
    const last = state.history[state.history.length - 1];
    const diff = daysBetween(last.date, todayISO());
    const when = diff === 0 ? 'heute' : diff === 1 ? 'gestern' : `vor ${diff} Tagen`;
    lastEl.textContent = `Zuletzt trainiert: ${when} (${last.workoutName})`;
  } else {
    lastEl.textContent = 'Noch kein Training aufgezeichnet.';
  }
}

function toggleExercise(exId) {
  ensureSession();
  state.session.checked[exId] = !state.session.checked[exId];
  save();
  renderToday();
}

function finishWorkout() {
  const wo = currentWorkout();
  if (!wo) return;
  const doneIds = wo.exercises.filter((ex) => state.session.checked[ex.id]).map((ex) => ex.id);

  state.history.push({
    date: todayISO(),
    workoutId: wo.id,
    workoutName: wo.name,
    doneExerciseIds: doneIds,
    totalExercises: wo.exercises.length,
  });

  // Rotation weiterschalten + Session zurücksetzen
  state.currentIndex = clampIndex(state.currentIndex + 1);
  state.session = { workoutIndex: state.currentIndex, checked: {} };
  save();

  renderToday();
  renderHistory();
  const next = currentWorkout();
  toast(next ? `Gespeichert! Nächstes Mal: ${next.name}` : 'Gespeichert!');
}

/* ---------- Rendering: Verlauf ---------- */
function computeStreak() {
  if (!state.history.length) return 0;
  // Einzigartige Trainingstage, absteigend
  const days = [...new Set(state.history.map((h) => h.date))].sort().reverse();
  let streak = 0;
  let cursor = todayISO();
  // Serie zählt ab heute oder gestern rückwärts, solange lückenlos jeder Tag ein Training hat.
  const startDiff = daysBetween(days[0], cursor);
  if (startDiff > 1) return 0; // letzte Einheit älter als gestern -> keine laufende Serie
  cursor = days[0];
  streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i], cursor) === 1) {
      streak++;
      cursor = days[i];
    } else {
      break;
    }
  }
  return streak;
}

function renderHistory() {
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  listEl.innerHTML = '';

  document.getElementById('statTotal').textContent = state.history.length;
  document.getElementById('statStreak').textContent = computeStreak();

  if (state.history.length) {
    const last = state.history[state.history.length - 1];
    const diff = daysBetween(last.date, todayISO());
    document.getElementById('statLast').textContent = diff === 0 ? 'heute' : diff === 1 ? 'gestern' : diff + 'd';
    emptyEl.style.display = 'none';
  } else {
    document.getElementById('statLast').textContent = '–';
    emptyEl.style.display = 'block';
  }

  // Neueste zuerst
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

  state.workouts.forEach((wo, wi) => {
    const card = document.createElement('div');
    card.className = 'edit-workout';

    const head = document.createElement('div');
    head.className = 'edit-workout-head';
    head.innerHTML = `<span class="idx">${wi + 1}.</span>`;

    const nameInput = document.createElement('input');
    nameInput.className = 'edit-input wname';
    nameInput.value = wo.name;
    nameInput.setAttribute('aria-label', 'Name der Einheit');
    nameInput.addEventListener('change', () => {
      wo.name = nameInput.value.trim() || 'Einheit';
      save();
      renderToday();
    });
    head.appendChild(nameInput);

    const up = iconBtn('▲', 'move', () => moveWorkout(wi, -1));
    const down = iconBtn('▼', 'move', () => moveWorkout(wi, 1));
    const delW = iconBtn('🗑', 'del', () => deleteWorkout(wi));
    head.append(up, down, delW);
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

function moveWorkout(index, dir) {
  const j = index + dir;
  if (j < 0 || j >= state.workouts.length) return;
  const arr = state.workouts;
  [arr[index], arr[j]] = [arr[j], arr[index]];
  // currentIndex bleibt auf derselben logischen Position stehen; einfachster sicherer Ansatz:
  state.currentIndex = clampIndex(state.currentIndex);
  save();
  renderEdit();
  renderToday();
}

function deleteWorkout(index) {
  if (state.workouts.length <= 1) {
    toast('Mindestens eine Einheit muss bleiben.');
    return;
  }
  if (!confirm(`Einheit "${state.workouts[index].name}" wirklich löschen?`)) return;
  state.workouts.splice(index, 1);
  state.currentIndex = clampIndex(state.currentIndex);
  state.session = { workoutIndex: state.currentIndex, checked: {} };
  save();
  renderEdit();
  renderToday();
}

function addWorkout() {
  state.workouts.push({
    id: uid('w'),
    name: 'Neue Einheit',
    exercises: [{ id: uid('e'), name: 'Neue Übung' }],
  });
  save();
  renderEdit();
  renderToday();
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
      if (typeof state.currentIndex !== 'number') state.currentIndex = 0;
      if (!Array.isArray(state.history)) state.history = [];
      if (!state.session) state.session = { workoutIndex: state.currentIndex, checked: {} };
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
  document.getElementById('addWorkoutBtn').addEventListener('click', addWorkout);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('resetBtn').addEventListener('click', resetData);
  const importFile = document.getElementById('importFile');
  document.getElementById('importBtn').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  renderAll();

  // Service Worker registrieren (nur in sicherem Kontext verfügbar)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW-Registrierung fehlgeschlagen', err));
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
