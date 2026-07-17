# Plan: Oberkörper-Trainingsplan-App (PWA)

## Kontext
Eine eigene Gym-App: ein **Oberkörper-Trainingsplan**, bei dem die anstehenden Übungen
angezeigt und beim Training einzeln abgehakt werden. Beine werden separat trainiert und
sind nicht Teil der App.

**Rotation ohne Wochentage:** Die Einheiten laufen in fester Reihenfolge im Kreis. Nach
einer abgeschlossenen Einheit wird automatisch die nächste angezeigt – egal an welchem
Tag das nächste Training stattfindet. Die App merkt sich außerdem alle Trainingstage.

## Technischer Ansatz
Reine **Vanilla-PWA** (HTML + CSS + JS), kein Build-Schritt, kein Framework.

- **Persistenz:** `localStorage` (JSON) – alle Daten bleiben am Gerät.
- **Installierbar & offline:** Web-App-Manifest + Service Worker (App-Shell-Caching).

## Startinhalt: 3er-Oberkörper-Split (in der App editierbar)
Rotation: **Drücken → Ziehen → Schultern & Arme → …**

1. **Drücken** – Bankdrücken (LH), Schrägbankdrücken (KH), Butterfly/Kabel-Fly, Trizeps-Pushdown, French Press
2. **Ziehen** – Klimmzüge/Latzug, Rudern (KH/Kabel), Face Pulls, Bizeps-Curls (LH), Hammer-Curls
3. **Schultern & Arme** – Schulterdrücken (KH), Seitheben, Reverse Flys, Bizeps-Curls (KH), Trizeps-Dips

## Datenmodell (localStorage-Key `trainingsplan.v1`)
```jsonc
{
  "workouts": [
    { "id": "w_..", "name": "Drücken",
      "exercises": [ { "id": "e_..", "name": "Bankdrücken (Langhantel)" } ] }
  ],
  "currentIndex": 0,        // welche Einheit als Nächstes ansteht
  "history": [              // Trainingshistorie
    { "date": "2026-07-17", "workoutId": "w_..", "workoutName": "Drücken",
      "doneExerciseIds": ["e_.."], "totalExercises": 5 }
  ],
  "session": { "workoutIndex": 0, "checked": { "e_..": true } }  // laufendes Training
}
```
> Übungen bleiben als Objekt `{id,name}` – so lassen sich später `sets`, `reps`,
> `weight` ergänzen, ohne die Struktur zu brechen.

## Screens
1. **Heute** – anstehende Einheit + Übungsliste zum Abhaken, Fortschrittsbalken,
   „Training abschließen" (speichert Datum, schaltet Rotation weiter, setzt Häkchen zurück).
   Häkchen werden laufend gespeichert und überstehen Neuladen/Schließen.
2. **Verlauf** – Statistik (Anzahl Trainings, laufende Serie, zuletzt) + Liste aller
   Trainingstage (Datum, Einheit, erledigte Übungen).
3. **Bearbeiten** – Einheiten umbenennen/verschieben/löschen, Übungen hinzufügen/
   umbenennen/löschen. Zusätzlich Backup exportieren/importieren und Zurücksetzen.

## Rotationslogik
- Anstehende Einheit = `workouts[currentIndex]`.
- Abschließen: `currentIndex = (currentIndex + 1) % workouts.length`.
- Unabhängig vom Wochentag – nur die Reihenfolge zählt.

## Dateien
| Datei | Zweck |
|-------|-------|
| `index.html` | Grundgerüst, 3 Views, Tab-Navigation |
| `styles.css` | Mobiles, touch-freundliches Design (Dark/Light automatisch) |
| `app.js` | State/localStorage, Rendering, Rotation, Bearbeiten, SW-Registrierung |
| `manifest.webmanifest` | PWA-Manifest (installierbar, standalone) |
| `sw.js` | Service Worker (Offline-Caching der App-Shell) |
| `icons/icon-192.png`, `icons/icon-512.png` | App-Icons (Hantel-Symbol) |
| `GOAL.md` | Ziel/Vision |

## Lokal testen
Service Worker brauchen `localhost` oder HTTPS. Im Projektordner z.B.:
```
python -m http.server 8000
```
Dann `http://localhost:8000` öffnen (am besten mit der Handy-Ansicht der DevTools).

Testschritte: Übungen abhaken → Reload (Häkchen bleiben) → abschließen (Verlauf-Eintrag,
nächste Einheit erscheint) → mehrfach abschließen (Rotation läuft im Kreis) → Plan
bearbeiten → in DevTools/Application Manifest + Service Worker + Offline prüfen.

## Aufs Handy bringen (Folgeschritt)
Zum Installieren am Handy braucht es HTTPS-Hosting – einfachste kostenlose Optionen:
**GitHub Pages** oder **Netlify**. Danach die Seite am Handy öffnen und „Zum Startbildschirm
hinzufügen".

## Später
- Gewichte, Sätze & Wiederholungen pro Übung (Datenmodell ist vorbereitet).
- Backup/Export ist bereits enthalten (JSON), da localStorage gerätegebunden ist.
