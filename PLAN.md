# Plan: Oberkörper-Trainingsplan-App (PWA)

## Kontext
Eine eigene Gym-App: ein **Oberkörper-Trainingsplan** nach **Wochentagen**. Beine werden
separat trainiert und sind nicht Teil der App.

**Wochenrhythmus:** Montag–Freitag gibt es je ein festes Training, **Wochenende = Pause**.
Es ist **max. ein Training pro Tag** möglich – ist das heutige abgeschlossen, ist der Tag
gesperrt bis zum nächsten Tag. Die App merkt sich alle Trainingstage.

## Technischer Ansatz
Reine **Vanilla-PWA** (HTML + CSS + JS), kein Build-Schritt, kein Framework.
- **Persistenz:** `localStorage` (Key `trainingsplan.v2`) – alle Daten am Gerät.
- **Installierbar & offline:** Web-App-Manifest + Service Worker (App-Shell-Caching).
- **Design:** schwarz mit lila Akzent.

## Wochenplan (in der App editierbar)
- **Mo** – Brust & Trizeps
- **Di** – Rücken & Bizeps
- **Mi** – Schultern
- **Do** – Arme
- **Fr** – Oberkörper komplett

Jedes Training hat 6 Übungen (anpassbar). Sa/So: Pause.

## Datenmodell (localStorage)
```jsonc
{
  "workouts": [   // Index 0 = Mo … 4 = Fr
    { "id": "w_..", "day": "Mo", "name": "Brust & Trizeps",
      "exercises": [ { "id": "e_..", "name": "Bankdrücken (Langhantel)" } ] }
  ],
  "history": [
    { "date": "2026-07-17", "workoutId": "w_..", "workoutName": "Brust & Trizeps",
      "doneExerciseIds": ["e_.."], "totalExercises": 6 }
  ],
  "session": { "date": "2026-07-17", "checked": { "e_..": true } }  // laufendes Training (an Datum gebunden)
}
```
> Übungen bleiben als Objekt `{id,name}` – so lassen sich später `sets`, `reps`,
> `weight` ergänzen, ohne die Struktur zu brechen.

## Logik
- Heutiger Wochentag → `getDay()` (1=Mo … 5=Fr). Wochenende → „Pause".
- Anzeige = `workouts[wochentag-1]`.
- **Ein Training pro Tag:** existiert für heute schon ein `history`-Eintrag, wird das
  Training als „erledigt" (gesperrt) angezeigt.
- `session` ist an das Datum gebunden – an einem neuen Tag automatisch leer.

## Screens
1. **Heute** – Wochentag + heutiges Training, Übungen zum Abhaken, Fortschritt,
   „Training abschließen". Danach „erledigt"-Ansicht. Am Wochenende „Pause 💤".
2. **Verlauf** – Statistik (Trainings gesamt, diese Woche, zuletzt) + Liste aller Trainingstage.
3. **Bearbeiten** – Übungen je Wochentag hinzufügen/umbenennen/löschen, Trainingsname
   ändern. Backup exportieren/importieren, Zurücksetzen.

## Dateien
`index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`,
`icons/icon-192.png`, `icons/icon-512.png`, `GOAL.md`.

## Hosting
Live über **GitHub Pages**: Repo `Noah804/trainingsplan`, Adresse
`https://noah804.github.io/trainingsplan/`. Updates: Dateien committen + pushen.
Service-Worker-Cache (`CACHE_VERSION`) bei Änderungen hochzählen, damit Updates ankommen.

## Später
- Gewichte, Sätze & Wiederholungen pro Übung (Datenmodell ist vorbereitet).
