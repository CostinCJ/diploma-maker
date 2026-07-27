# Diploma Maker

**Offline diploma generator for summer camp sessions.**

Camp guides used to hand-write every participant's name on pre-printed diplomas. Diploma Maker replaces that: photograph the participant list, let offline OCR read the names, correct anything it got wrong, and print one diploma per person.

Built as a Windows desktop app (Electron) with a **hard privacy constraint — children's names never leave the machine.** No cloud APIs, no telemetry, no network requests of any kind. The app works fully offline, by design.

> The user interface is in Romanian, matching its users. The codebase and docs are in English.

---

## Features

- **Session setup** — start/end dates, a group background photo, and two corner logos, shared by every diploma in the session.
- **Five ways to add the children** — whatever form the list already exists in, there is a way in:
  - **photos of a printed list**, read by offline OCR (button, drag & drop, or Ctrl+V of a screenshot);
  - **a paste box** — copy the names out of Word, Excel, WhatsApp or an e-mail and press Ctrl+V anywhere on the step;
  - **list files** — `.docx`, `.xlsx`, `.csv` and `.txt`, by button or dropped on the window;
  - **typing**, one name per Enter;
  - **a blank row**, for filling in by hand.
- **Import preview** — every source ends at the same confirmation screen: what was found, what is already in the list (unticked, but tickable — two children really can share a name), and a one-click undo of the whole import afterwards.
- **Removable imports** — everything imported is listed on the right (photos with their thumbnail) and can be deleted on its own, taking its names with it. Each name remembers the import it arrived in, so a name corrected after OCR read it still goes when its photo goes, and names typed by hand are never touched. The wrong photo no longer means clearing the session and starting over; the deletion itself is undoable.
- **The photos stay with the session** — imported list photos are copied into the app data directory, so reopening the app the next day still shows what each name should be checked against. They are deleted as soon as their import is removed (once its undo is given up), when the session is cleared, and at startup if a crash left any behind.
- **Word and Excel without a library** — `.docx` and `.xlsx` are ZIP archives of XML, so they are unpacked with the browser's own `DecompressionStream` and read directly. No dependency, nothing downloaded, and Word's `Ş/Ţ` are folded onto the Romanian `Ș/Ț` so the same child never arrives twice. Header rows, numbering columns and extra columns (age, group) are dropped; a list split into *Nume* / *Prenume* columns is joined back together. Legacy `.doc`/`.xls` are refused with an explanation rather than read as garbage.
- **Adaptive OCR pipeline** — Tesseract's layout analysis is unstable on low-resolution lists, so no single recipe wins: the app scales the page into the size band Tesseract reads best, detects column gutters, and tries a few segmentation/preprocessing combinations, keeping whichever recovers the most full names. On a 452x640 two-column sample this took the result from 2 names to 120.
- **Romanian-aware parsing** — diacritics (Ș Ț Ă Î Â) preserved; header rows, row numbers, and OCR junk stripped heuristically. No row is ever silently deleted.
- **Manual teacher list** — a separate, simple list for the handful of accompanying adults. Each one is marked *însoțitor* or *însoțitoare* as their name is typed, so their diploma names one gender instead of printing both forms with a slash. There is no defensible way to guess it, so an unanswered choice blocks printing that batch and says whose it is — the children can still be printed meanwhile.
- **Editable templates** — fixed diploma layout, fully editable wording, with three tabs (copil / însoțitor / însoțitoare) and a live preview using real session assets. The two adult tabs differ only in the award line; the rest of the text is shared.
- **Print & export** — print the whole session, kids only, or teachers only; or export the same render to PDF. One landscape A4 diploma per page — preview is the print output.
- **Persistent sessions** — everything is stored locally in the app data directory and can be reopened later. Saves are written atomically (temp file + rename), and the last edits are flushed synchronously when the window closes, so a crash or a quick Alt+F4 cannot truncate or lose the list.

## Privacy by design

This app handles minors' names, so privacy is a functional requirement, not a nice-to-have:

- The Romanian Tesseract model (`ron.traineddata`, tessdata_best) is **bundled in the installer**. Nothing is ever downloaded at runtime — if the model file is missing, OCR fails loudly rather than silently falling back to a CDN.
- No `fetch`/HTTP code exists anywhere in the app. It runs correctly with networking disabled.
- The renderer runs behind a `contextBridge` preload with a strict Content-Security-Policy (`default-src 'self'`); the print window is sandboxed.
- The temporary print document containing the names is unique per job and deleted immediately after printing or PDF export; any document left behind by a crash is purged at the next startup.
- Replacing the group photo or a logo deletes the previous copy from the app data directory instead of leaving it behind. Imported list photos are held to the same rule: removing the import deletes its photo, clearing the session deletes all of them, and any left behind by a crash are purged at the next startup.

## Installing on the camp laptop

Download the latest `DiplomaMaker-Setup-<version>.exe` from the [releases page](https://github.com/CostinCJ/diploma-maker/releases) and run it. Nothing else is needed — Node.js is not required, the OCR model is inside the installer, and the app never touches the network afterwards.

- The installer is **not code-signed**, so Windows shows *"Windows protected your PC"* on first run. Choose **More info → Run anyway**. (Signing requires a paid certificate.)
- It installs per-user, so **no administrator rights** are needed.
- Before camp, do one full dry run on that laptop: import a photo, check the names, and **print one real page** — A4 landscape with zero margins is the setting most likely to be wrong on an unfamiliar printer.
- Session data (including participants' names) lives in `%APPDATA%\Diploma Maker\`. That is what to clear if the laptop is shared or handed back; *Sesiune nouă — șterge tot* does it from inside the app.

### Cutting a release

Tag a version and push it — [the workflow](.github/workflows/release.yml) builds the installer on a Windows runner and attaches it to the release:

```bash
npm version minor -m "v%s"   # or edit "version" in package.json by hand
git push origin main --follow-tags
```

Building locally with `npm run dist` works on Windows; on Linux or macOS it needs Wine, which is exactly why the release build runs on GitHub.

## Getting started (development)

**Requirements:** Node.js 18+ and Windows (for packaging; development works anywhere Electron runs).

```bash
git clone https://github.com/CostinCJ/diploma-maker.git
cd diploma-maker
npm install
```

The OCR model is not checked into the repository. Download the Romanian **tessdata_best** model and place it at `ocr-data/ron.traineddata`:

```bash
curl -L -o ocr-data/ron.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/ron.traineddata
```

Then run the app:

```bash
npm start
```

## Getting good OCR results

Recognition quality is dominated by how much detail the photo actually contains — no amount of processing invents pixels that were never captured.

- **Resolution is the single biggest factor.** Tesseract wants roughly 30px of cap height per line. A 452x640 screenshot of a 120-row list gives about 6px and is essentially unreadable; the same list photographed at full phone resolution reads cleanly. Fill the frame with the sheet and avoid shrinking the file before importing.
- **If the list already exists digitally** (a spreadsheet, a PDF), OCR is the wrong tool — retyping or pasting a handful of names beats correcting a bad scan.
- **Expect an import to take a while.** The app tries the page whole, then per column, escalating to contrast enhancement only when a pass falls short — up to six recognition passes on a two-column page. It stops early when the first pass reads well, and the status line names the attempt in flight.
- **Every row is editable.** OCR output lands in a numbered table beside the original photo precisely so it can be checked by eye; nothing is ever silently dropped.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Launch the app in development |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run smoke` | Drive the real app end to end in a throwaway profile (Electron) |
| `npm run dist` | Build the Windows NSIS installer via electron-builder |

To verify a packaged build loads the bundled OCR model, run the app with `DIPLOME_OCR_SELFTEST=1`; it runs the real OCR code path and prints `OCR_SELFTEST_OK` or `OCR_SELFTEST_FAIL`, then exits.

## Project structure

```
electron/
  main.js            Main process: session storage, asset copying, OCR worker, print/PDF
  preload.js         contextBridge API surface exposed to the renderer
src/
  index.html         Five-step shell (session → kids → teachers → templates → generate)
  renderer.js        Step routing and session bootstrap
  ocr/preprocess.js  Scaling, grayscale, contrast stretch, adaptive thresholding
  ocr/columns.js     Column-gutter and text-row detection (pure)
  ocr/readNames.js   Picks the best of several OCR attempts (pure)
  shared/            Pure logic: name parsing, templates, validation, file URLs, diploma HTML/CSS
  ui/                One module per step
tests/               Vitest unit tests for the pure shared logic
scripts/smoke.js     End-to-end run of the real app (npm run smoke)
ocr-data/            Bundled Tesseract model (gitignored — see Getting started)
docs/                Design spec and implementation plan
```

The `shared/` modules and the pure parts of `ocr/` (`columns.js`, `readNames.js`, and the scaling maths in `preprocess.js`) are deliberately free of DOM and Electron dependencies, so parsing, templating, validation, page geometry, OCR strategy, and diploma rendering are all unit-tested directly. Only the canvas work in `preprocess.js` needs a browser.

## Tech stack

Electron 33 · tesseract.js 5 · Vitest 2 · electron-builder 25 · vanilla ES modules (no framework, no bundler)

## Testing

```bash
npm test        # pure logic, fast
npm run smoke   # the real app, end to end
```

Unit tests cover OCR post-processing (header filtering, row-number stripping, diacritic preservation), column and text-row detection, the OCR attempt strategy (driven by a stubbed recogniser, including the case where contrast enhancement makes a page worse and must be rejected), image scaling, template substitution, session persistence and corrupt-file recovery, validation rules, `file://` URL building, and diploma HTML rendering.

`npm run smoke` covers what unit tests cannot reach: it launches the real main process against a throwaway profile directory, drives the five steps of the UI, and checks the results — a pasted list losing its header and row numbers, an imported photo written into the app data directory, the whole session coming back after a reload, removing an import taking its names with it (and its photo once the undo is given up), an undecided teacher blocking generation by name, and the right award line reaching the rendered diploma. Every check prints a line and the run exits non-zero on failure, so it is the thing to run before cutting a release.

## License

[MIT](LICENSE)
