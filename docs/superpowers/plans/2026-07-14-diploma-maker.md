# Diploma Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully-offline Windows Electron app that OCRs kids' names from photos of participant lists and prints/exports per-person camp diplomas.

**Architecture:** Electron main process (CJS) handles persistence, file dialogs, OCR (tesseract.js in Node with a bundled Romanian language pack), printing and PDF export. The renderer (vanilla ES modules, no framework/bundler) hosts a 5-step UI. All business logic (name parsing, template filling, diploma HTML, validation) lives in pure ESM modules under `src/shared/` that are unit-tested with Vitest and shared with the renderer.

**Tech Stack:** Electron, tesseract.js (+ `ron.traineddata` bundled at build time), Vitest, electron-builder (NSIS installer). No network access at runtime.

**Spec:** `docs/superpowers/specs/2026-07-14-diploma-maker-design.md`

**File map (final state):**

```
package.json                  scripts, deps, electron-builder config
electron/main.js              window, IPC: session, assets, OCR, print/PDF
electron/preload.js           contextBridge API
src/index.html                5-section UI shell
src/styles.css                app chrome styles
src/renderer.js               bootstrap, state, autosave, step navigation
src/ui/setup.js               Section 1: dates + background + logos
src/ui/kids.js                Section 2: OCR import + editable table
src/ui/teachers.js            Section 3: manual teacher list
src/ui/templates.js           Section 4: template tabs + live preview
src/ui/generate.js            Section 5: preview all, print, PDF
src/ocr/preprocess.js         canvas grayscale/contrast (pure core)
src/shared/nameParsing.js     OCR text → clean name rows (pure)
src/shared/template.js        defaults, date formatting, {x} fills (pure)
src/shared/diplomaHtml.js     one-diploma + full-print-doc HTML (pure)
src/shared/diplomaCss.js      diploma layout CSS string (pure)
src/shared/session.js         default session shape + merge (pure)
src/shared/validation.js      generation guards (pure)
ocr-data/ron.traineddata      Romanian OCR model (build-time download)
tests/*.test.js               Vitest unit tests for src/shared + preprocess
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `electron/main.js`, `electron/preload.js`, `src/index.html`, `src/styles.css`, `src/renderer.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "diploma-maker",
  "productName": "Diploma Maker",
  "version": "1.0.0",
  "description": "Offline diploma generator for camp sessions",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "test": "vitest run",
    "dist": "electron-builder --win"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "tesseract.js": "^5.1.0"
  },
  "build": {
    "appId": "ro.tabereapuseni.diplomamaker",
    "productName": "Diploma Maker",
    "win": { "target": "nsis" },
    "files": ["electron/**", "src/**", "package.json"],
    "extraResources": [{ "from": "ocr-data", "to": "ocr-data" }],
    "asarUnpack": ["node_modules/tesseract.js/**", "node_modules/tesseract.js-core/**"]
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
ocr-data/*.traineddata
```

(The language model is a 3–15 MB binary re-downloadable at build time — keep it out of git.)

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` appears.

- [ ] **Step 4: Create `electron/main.js`**

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 5: Create `electron/preload.js`** (empty API for now; filled in later tasks)

```js
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('api', {});
```

- [ ] **Step 6: Create `src/index.html`**

```html
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; img-src 'self' file: blob: data:; style-src 'self' 'unsafe-inline'" />
  <title>Diploma Maker</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <h1>Diploma Maker</h1>
  <script type="module" src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 7: Create placeholder `src/styles.css`** (single line comment `/* app styles */`) **and `src/renderer.js`** (single line `console.log('renderer up');`)

- [ ] **Step 8: Verify the window opens**

Run: `npm start`
Expected: a window titled "Diploma Maker" showing the heading. Close it.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Electron app with vitest and electron-builder"
```

---

### Task 2: Name parsing module (OCR post-processing)

**Files:**
- Create: `src/shared/nameParsing.js`
- Test: `tests/nameParsing.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/nameParsing.test.js
import { describe, it, expect } from 'vitest';
import { parseNamesFromOcrText } from '../src/shared/nameParsing.js';

// Fictional names, shaped like real OCR output from a printed participant list.
const SAMPLE = `TABEL PARTICIPANTI LA TABARA DE MUNTE
NR.
Numele si prenumele elevilor
1. | POPESCU ALEXANDRU
2. IONESCU ȘTEFAN
3. .DUMITRESCU MIHNEA
32. PĂUNESCU ȘTEFAN

38. GHIȚĂ ELENA
47. MARIN PATRICK
`;

describe('parseNamesFromOcrText', () => {
  it('extracts names, dropping headers and row numbers', () => {
    expect(parseNamesFromOcrText(SAMPLE)).toEqual([
      'POPESCU ALEXANDRU',
      'IONESCU ȘTEFAN',
      'DUMITRESCU MIHNEA',
      'PĂUNESCU ȘTEFAN',
      'GHIȚĂ ELENA',
      'MARIN PATRICK',
    ]);
  });

  it('preserves Romanian diacritics', () => {
    expect(parseNamesFromOcrText('30. BRĂTIANU ANDREI')).toEqual(['BRĂTIANU ANDREI']);
  });

  it('drops lines with no letters and empty lines', () => {
    expect(parseNamesFromOcrText('12.\n---\n\n')).toEqual([]);
  });

  it('keeps hyphenated compound names intact', () => {
    expect(parseNamesFromOcrText('31. MICU-GEORGESCU-VLAD IOAN')).toEqual(['MICU-GEORGESCU-VLAD IOAN']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nameParsing.test.js`
Expected: FAIL — cannot find module `nameParsing.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/shared/nameParsing.js
const HEADER_RE = /TABEL|PARTICIPAN|NUMELE|PRENUMELE|ELEVILOR|^NR\.?$/i;

/** OCR text of a participant list → array of clean names, one per row. */
export function parseNamesFromOcrText(text) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^[\s|,._]*\d{1,3}\s*[.,]?\s*/, '') // leading row number + punctuation
        .replace(/[|_]/g, ' ')                        // table-border artifacts
        .replace(/^[\s.,]+/, '')                      // stray leading punctuation
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length >= 3)
    .filter((line) => !HEADER_RE.test(line))
    .filter((line) => /[A-Za-zĂÂÎȘȚăâîșț]/.test(line));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nameParsing.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/nameParsing.js tests/nameParsing.test.js
git commit -m "feat: OCR text post-processing into clean name rows"
```

---

### Task 3: Template module (defaults, date format, placeholder fill)

**Files:**
- Create: `src/shared/template.js`
- Test: `tests/template.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/template.test.js
import { describe, it, expect } from 'vitest';
import { formatDateRo, fillLine, DEFAULT_TEMPLATES } from '../src/shared/template.js';

describe('formatDateRo', () => {
  it('converts ISO to DD.MM.YYYY', () => {
    expect(formatDateRo('2026-07-07')).toBe('07.07.2026');
  });
  it('returns empty string for empty input', () => {
    expect(formatDateRo('')).toBe('');
  });
});

describe('fillLine', () => {
  it('substitutes {start} and {end}', () => {
    expect(fillLine('în perioada {start} - {end}', { start: '07.07.2026', end: '12.07.2026' }))
      .toBe('în perioada 07.07.2026 - 12.07.2026');
  });
  it('leaves lines without placeholders untouched', () => {
    expect(fillLine('Diplomă de participare', { start: 'x', end: 'y' }))
      .toBe('Diplomă de participare');
  });
});

describe('DEFAULT_TEMPLATES', () => {
  it('has kid and teacher templates with all four lines', () => {
    for (const key of ['kid', 'teacher']) {
      const t = DEFAULT_TEMPLATES[key];
      expect(t.title).toBeTruthy();
      expect(t.awardLine).toBeTruthy();
      expect(t.participationLine).toBeTruthy();
      expect(t.dateLine).toContain('{start}');
    }
    expect(DEFAULT_TEMPLATES.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(DEFAULT_TEMPLATES.teacher.awardLine).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/template.test.js`
Expected: FAIL — cannot find module `template.js`.

- [ ] **Step 3: Write the implementation**

```js
// src/shared/template.js

/** '2026-07-07' → '07.07.2026' */
export function formatDateRo(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Replace {start}/{end} placeholders in a template line. */
export function fillLine(line, ctx) {
  return line.replaceAll('{start}', ctx.start ?? '').replaceAll('{end}', ctx.end ?? '');
}

export const DEFAULT_TEMPLATES = {
  kid: {
    title: 'Diplomă de participare',
    awardLine: 'SE ACORDĂ ELEVULUI/ELEVEI',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
  },
  teacher: {
    title: 'Diplomă de participare',
    awardLine: 'SE ACORDĂ D-NEI ÎNSOȚITOARE',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/template.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/template.js tests/template.test.js
git commit -m "feat: diploma templates with date formatting and placeholder fill"
```

---

### Task 4: Diploma HTML renderer (pure)

**Files:**
- Create: `src/shared/diplomaCss.js`, `src/shared/diplomaHtml.js`
- Test: `tests/diplomaHtml.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/diplomaHtml.test.js
import { describe, it, expect } from 'vitest';
import { renderDiplomaHtml, buildPrintDocument } from '../src/shared/diplomaHtml.js';
import { DEFAULT_TEMPLATES } from '../src/shared/template.js';

const CTX = { start: '07.07.2026', end: '12.07.2026' };
const ASSETS = { background: 'file:///C:/x/bg.jpg', logoLeft: 'file:///C:/x/l.png', logoRight: 'file:///C:/x/r.png' };

describe('renderDiplomaHtml', () => {
  it('contains name, filled date line and all template lines', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'PĂUNESCU ȘTEFAN', CTX, ASSETS);
    expect(html).toContain('PĂUNESCU ȘTEFAN');
    expect(html).toContain('în perioada 07.07.2026 - 12.07.2026');
    expect(html).toContain('Diplomă de participare');
    expect(html).toContain('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(html).toContain(ASSETS.background);
  });

  it('escapes HTML in names', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, '<b>X</b>', CTX, ASSETS);
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });

  it('omits image tags for missing assets', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, { background: '', logoLeft: '', logoRight: '' });
    expect(html).not.toContain('<img');
  });
});

describe('buildPrintDocument', () => {
  it('wraps diplomas in a full HTML document with the diploma CSS', () => {
    const one = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, ASSETS);
    const doc = buildPrintDocument([one]);
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('.diploma');
    expect(doc).toContain('A B');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/diplomaHtml.test.js`
Expected: FAIL — cannot find module `diplomaHtml.js`.

- [ ] **Step 3: Write `src/shared/diplomaCss.js`**

```js
// src/shared/diplomaCss.js — layout matches the existing printed diploma.
export const DIPLOMA_CSS = `
.diploma {
  position: relative; width: 297mm; height: 210mm; overflow: hidden;
  page-break-after: always; background: #fff;
  font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a;
}
.diploma .bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; opacity: 0.25;
}
.diploma .logo { position: absolute; top: 10mm; width: 35mm; height: auto; }
.diploma .logo.left { left: 10mm; }
.diploma .logo.right { right: 10mm; }
.diploma .content {
  position: absolute; inset: 0; padding: 0 25mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8mm; text-align: center;
}
.diploma h1 { font-size: 40pt; font-weight: bold; margin: 0; }
.diploma .award { font-size: 16pt; letter-spacing: 1px; margin: 0; }
.diploma .name {
  font-size: 26pt; font-weight: bold; margin: 0;
  min-width: 100mm; padding: 0 10mm 2mm; border-bottom: 1px dotted #444;
}
.diploma .part { font-size: 16pt; font-style: italic; margin: 0; }
.diploma .dates { font-size: 14pt; margin: 0; }
@media print { @page { size: A4 landscape; margin: 0; } body { margin: 0; } }
`;
```

- [ ] **Step 4: Write `src/shared/diplomaHtml.js`**

```js
// src/shared/diplomaHtml.js
import { fillLine } from './template.js';
import { DIPLOMA_CSS } from './diplomaCss.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function img(cls, src) {
  return src ? `<img class="${cls}" src="${esc(src)}" alt="" />` : '';
}

/** One diploma as an HTML fragment. `assets` values are file:// URLs (or ''). */
export function renderDiplomaHtml(tpl, name, ctx, assets) {
  return `<div class="diploma">
  ${img('bg', assets.background)}
  ${img('logo left', assets.logoLeft)}
  ${img('logo right', assets.logoRight)}
  <div class="content">
    <h1>${esc(tpl.title)}</h1>
    <p class="award">${esc(fillLine(tpl.awardLine, ctx))}</p>
    <p class="name">${esc(name)}</p>
    <p class="part">${esc(fillLine(tpl.participationLine, ctx))}</p>
    <p class="dates">${esc(fillLine(tpl.dateLine, ctx))}</p>
  </div>
</div>`;
}

/** Full standalone HTML document for printing/PDF: one diploma per page. */
export function buildPrintDocument(diplomaFragments) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${DIPLOMA_CSS}
body { margin: 0; }</style></head>
<body>${diplomaFragments.join('\n')}</body></html>`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/diplomaHtml.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/diplomaCss.js src/shared/diplomaHtml.js tests/diplomaHtml.test.js
git commit -m "feat: pure diploma HTML/CSS renderer and print document builder"
```

---

### Task 5: Session model + persistence + asset picking

**Files:**
- Create: `src/shared/session.js`
- Modify: `electron/main.js`, `electron/preload.js`
- Test: `tests/session.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/session.test.js
import { describe, it, expect } from 'vitest';
import { defaultSession, mergeSession } from '../src/shared/session.js';

describe('defaultSession', () => {
  it('has empty dates, assets, lists, and default templates', () => {
    const s = defaultSession();
    expect(s.startDate).toBe('');
    expect(s.endDate).toBe('');
    expect(s.background).toBe('');
    expect(s.logoLeft).toBe('');
    expect(s.logoRight).toBe('');
    expect(s.kids).toEqual([]);
    expect(s.teachers).toEqual([]);
    expect(s.templates.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
  });
});

describe('mergeSession', () => {
  it('returns defaults for null input', () => {
    expect(mergeSession(null)).toEqual(defaultSession());
  });
  it('keeps loaded values and fills missing template lines from defaults', () => {
    const s = mergeSession({ startDate: '2026-07-07', kids: ['A B'], templates: { kid: { title: 'Custom' } } });
    expect(s.startDate).toBe('2026-07-07');
    expect(s.kids).toEqual(['A B']);
    expect(s.templates.kid.title).toBe('Custom');
    expect(s.templates.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(s.templates.teacher.awardLine).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/session.test.js`
Expected: FAIL — cannot find module `session.js`.

- [ ] **Step 3: Write `src/shared/session.js`**

```js
// src/shared/session.js
import { DEFAULT_TEMPLATES } from './template.js';

export function defaultSession() {
  return {
    startDate: '',
    endDate: '',
    background: '',
    logoLeft: '',
    logoRight: '',
    kids: [],
    teachers: [],
    templates: structuredClone(DEFAULT_TEMPLATES),
  };
}

/** Merge a loaded (possibly partial/old) session over defaults. */
export function mergeSession(loaded) {
  const base = defaultSession();
  if (!loaded) return base;
  return {
    ...base,
    ...loaded,
    templates: {
      kid: { ...base.templates.kid, ...(loaded.templates?.kid ?? {}) },
      teacher: { ...base.templates.teacher, ...(loaded.templates?.teacher ?? {}) },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/session.test.js`
Expected: PASS.

- [ ] **Step 5: Add persistence + asset IPC to `electron/main.js`** (replace whole file)

```js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function sessionFile() {
  return path.join(app.getPath('userData'), 'session.json');
}

function assetsDir() {
  const dir = path.join(app.getPath('userData'), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('session:load', () => {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(), 'utf8'));
  } catch {
    return null; // first run or corrupt file → renderer falls back to defaults
  }
});

ipcMain.handle('session:save', (_e, session) => {
  fs.writeFileSync(sessionFile(), JSON.stringify(session, null, 2));
  return true;
});

// kind: 'background' | 'logoLeft' | 'logoRight'. Copies into userData so the
// session keeps working even if the original file moves. Returns absolute path or null.
ipcMain.handle('asset:pick', async (_e, kind) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Alege imaginea',
    properties: ['openFile'],
    filters: [{ name: 'Imagini', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (canceled || !filePaths[0]) return null;
  const src = filePaths[0];
  const dest = path.join(assetsDir(), kind + path.extname(src).toLowerCase());
  fs.copyFileSync(src, dest);
  return dest;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 6: Expose the API in `electron/preload.js`** (replace whole file)

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (session) => ipcRenderer.invoke('session:save', session),
  pickAsset: (kind) => ipcRenderer.invoke('asset:pick', kind),
});
```

- [ ] **Step 7: Smoke-check the app still opens**

Run: `npm start`
Expected: window opens as before, no console errors in DevTools.

- [ ] **Step 8: Commit**

```bash
git add src/shared/session.js tests/session.test.js electron/main.js electron/preload.js
git commit -m "feat: session model, local JSON persistence, asset picking via IPC"
```

---

### Task 6: UI skeleton — 5-step navigation + state + autosave

**Files:**
- Modify: `src/index.html`, `src/styles.css`, `src/renderer.js`

- [ ] **Step 1: Replace `src/index.html` body with the 5-section shell**

```html
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; img-src 'self' file: blob: data:; style-src 'self' 'unsafe-inline'" />
  <title>Diploma Maker</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <nav id="steps">
    <button data-step="setup" class="active">1. Sesiune</button>
    <button data-step="kids">2. Copii</button>
    <button data-step="teachers">3. Însoțitori</button>
    <button data-step="templates">4. Șabloane</button>
    <button data-step="generate">5. Generare</button>
  </nav>
  <main>
    <section id="step-setup" class="step active"></section>
    <section id="step-kids" class="step"></section>
    <section id="step-teachers" class="step"></section>
    <section id="step-templates" class="step"></section>
    <section id="step-generate" class="step"></section>
  </main>
  <script type="module" src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Replace `src/styles.css`**

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #f4f4f6; color: #222; }
#steps { display: flex; gap: 4px; padding: 10px 16px; background: #2b3a4a; }
#steps button {
  padding: 8px 18px; border: 0; border-radius: 6px; cursor: pointer;
  background: transparent; color: #cfd8e3; font-size: 14px;
}
#steps button.active { background: #fff; color: #2b3a4a; font-weight: 600; }
main { padding: 20px; }
.step { display: none; }
.step.active { display: block; }
h2 { margin-top: 0; }
button.primary {
  background: #2b6cb0; color: #fff; border: 0; border-radius: 6px;
  padding: 10px 20px; font-size: 15px; cursor: pointer;
}
button.small { padding: 2px 8px; font-size: 13px; cursor: pointer; }
input[type="text"] { font-size: 14px; padding: 6px 8px; }
table.names { border-collapse: collapse; }
table.names td { padding: 2px 6px; }
table.names input[type="text"] { width: 340px; }
.row { display: flex; gap: 24px; align-items: flex-start; }
.asset-thumb { max-width: 160px; max-height: 100px; display: block; margin-top: 6px; border: 1px solid #ccc; }
.preview-frame { transform: scale(0.4); transform-origin: top left; }
.preview-box { width: calc(297mm * 0.4); height: calc(210mm * 0.4); overflow: hidden; border: 1px solid #bbb; background: #fff; }
.error { color: #c0392b; }
.muted { color: #777; font-size: 13px; }
```

- [ ] **Step 3: Replace `src/renderer.js` with state + navigation bootstrap**

```js
// src/renderer.js
import { mergeSession } from './shared/session.js';

export const state = { session: null, photos: [] }; // photos: {name, url} for review panel (not persisted)

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.saveSession(state.session), 300);
}

/** Windows path → file:// URL usable in <img src>. */
export function fileUrl(p) {
  return p ? 'file:///' + encodeURI(p.replace(/\\/g, '/')) : '';
}

function initNav() {
  const buttons = document.querySelectorAll('#steps button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('step-' + btn.dataset.step).classList.add('active');
    });
  });
}

async function main() {
  state.session = mergeSession(await window.api.loadSession());
  initNav();
  // Section initializers are added in later tasks:
  for (const mod of ['setup', 'kids', 'teachers', 'templates', 'generate']) {
    try {
      const m = await import(`./ui/${mod}.js`);
      m.init(state, save);
    } catch { /* section not built yet */ }
  }
}

main();
```

- [ ] **Step 4: Verify navigation**

Run: `npm start`
Expected: nav bar with 5 buttons; clicking each switches the (empty) visible section; no DevTools errors.

- [ ] **Step 5: Commit**

```bash
git add src/index.html src/styles.css src/renderer.js
git commit -m "feat: 5-step UI shell with session state and autosave"
```

---

### Task 7: Section 1 — Session setup (dates + background + logos)

**Files:**
- Create: `src/ui/setup.js`

- [ ] **Step 1: Write `src/ui/setup.js`**

```js
// src/ui/setup.js
import { fileUrl } from '../renderer.js';

const ASSETS = [
  { key: 'background', label: 'Fotografie de fundal (poza de grup)' },
  { key: 'logoLeft', label: 'Logo stânga' },
  { key: 'logoRight', label: 'Logo dreapta' },
];

export function init(state, save) {
  const el = document.getElementById('step-setup');
  el.innerHTML = `
    <h2>Sesiune</h2>
    <div class="row">
      <label>Data început <input type="date" id="startDate"></label>
      <label>Data sfârșit <input type="date" id="endDate"></label>
    </div>
    <div class="row" style="margin-top:20px">
      ${ASSETS.map((a) => `
        <div>
          <div>${a.label}</div>
          <button class="small" data-asset="${a.key}">Alege imagine…</button>
          <img class="asset-thumb" id="thumb-${a.key}" alt="" hidden>
          <div class="error" id="err-${a.key}"></div>
        </div>`).join('')}
    </div>`;

  const startEl = el.querySelector('#startDate');
  const endEl = el.querySelector('#endDate');
  startEl.value = state.session.startDate;
  endEl.value = state.session.endDate;
  startEl.addEventListener('change', () => { state.session.startDate = startEl.value; save(); });
  endEl.addEventListener('change', () => { state.session.endDate = endEl.value; save(); });

  function refreshThumb(key) {
    const img = el.querySelector('#thumb-' + key);
    const err = el.querySelector('#err-' + key);
    err.textContent = '';
    const p = state.session[key];
    img.hidden = !p;
    if (p) {
      // Re-picking an image often yields the same path (kind + extension), so
      // clear src first to force a reload of the new file contents.
      img.src = '';
      img.src = fileUrl(p) + '?t=' + Date.now();
      img.onerror = () => { // corrupt/unreadable file → reject it
        err.textContent = 'Imaginea nu a putut fi încărcată — alege alt fișier.';
        state.session[key] = '';
        img.hidden = true;
        save();
      };
    }
  }

  ASSETS.forEach(({ key }) => {
    refreshThumb(key);
    el.querySelector(`[data-asset="${key}"]`).addEventListener('click', async () => {
      const p = await window.api.pickAsset(key);
      if (p) { state.session[key] = p; save(); refreshThumb(key); }
    });
  });
}
```

- [ ] **Step 2: Verify manually**

Run: `npm start`
Expected: on step 1 — pick both dates, pick three images (any photos), thumbnails appear. Close the app, reopen: dates and thumbnails are restored (persistence works).

- [ ] **Step 3: Commit**

```bash
git add src/ui/setup.js
git commit -m "feat: session setup UI with dates and asset uploads"
```

---

### Task 8: OCR pipeline (language pack, preprocessing, main-process recognition)

**Files:**
- Create: `ocr-data/ron.traineddata` (downloaded), `src/ocr/preprocess.js`
- Modify: `electron/main.js`, `electron/preload.js`, `docs/superpowers/specs/2026-07-14-diploma-maker-design.md`
- Test: `tests/preprocess.test.js`

- [ ] **Step 1: Download the Romanian language pack (build-time only — this is a public OCR model, no user data involved)**

```powershell
New-Item -ItemType Directory -Force ocr-data
curl.exe -L -o ocr-data/ron.traineddata https://github.com/tesseract-ocr/tessdata_fast/raw/main/ron.traineddata
```

Expected: `ocr-data/ron.traineddata` exists, a few MB.

- [ ] **Step 2: Write the failing preprocessing test** (pure pixel math — no canvas needed)

```js
// tests/preprocess.test.js
import { describe, it, expect } from 'vitest';
import { grayscaleContrastStretch } from '../src/ocr/preprocess.js';

function px(...rgbas) { return { data: new Uint8ClampedArray(rgbas.flat()) }; }

describe('grayscaleContrastStretch', () => {
  it('stretches darkest pixel to 0 and brightest to 255, output is gray', () => {
    // two pixels: mid-dark gray (100,100,100) and light gray (200,200,200)
    const img = px([100, 100, 100, 255], [200, 200, 200, 255]);
    grayscaleContrastStretch(img);
    expect([img.data[0], img.data[1], img.data[2]]).toEqual([0, 0, 0]);
    expect([img.data[4], img.data[5], img.data[6]]).toEqual([255, 255, 255]);
  });

  it('handles flat images without dividing by zero', () => {
    const img = px([128, 128, 128, 255], [128, 128, 128, 255]);
    grayscaleContrastStretch(img);
    expect(img.data[0]).toBe(0); // (128-128)*255/1 = 0; no NaN
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/preprocess.test.js`
Expected: FAIL — cannot find module `preprocess.js`.

- [ ] **Step 4: Write `src/ocr/preprocess.js`**

```js
// src/ocr/preprocess.js

/** In-place grayscale + full-range contrast stretch on an ImageData-like {data}. */
export function grayscaleContrastStretch(imageData) {
  const d = imageData.data;
  const n = d.length / 4;
  const gray = new Uint8Array(n);
  let min = 255, max = 0;
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    gray[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < n; i++) {
    const v = Math.round(((gray[i] - min) * 255) / range);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return imageData;
}

/** Browser-only: File → preprocessed PNG data URL (max 2200px, gray, contrast-stretched).
 *  Throws if the file is not a decodable image. */
export async function preprocessImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Fișierul nu este o imagine validă: ' + file.name));
      i.src = url;
    });
    const scale = Math.min(1, 2200 / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    grayscaleContrastStretch(data);
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/preprocess.test.js`
Expected: PASS.

- [ ] **Step 6: Add the OCR handler to `electron/main.js`** — insert after the `asset:pick` handler:

```js
// --- OCR (fully local: bundled Romanian model, no network, no disk cache) ---
const { createWorker } = require('tesseract.js');
let ocrWorkerPromise = null;

function ocrDataDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'ocr-data')
    : path.join(__dirname, '..', 'ocr-data');
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker('ron', 1, {
      langPath: ocrDataDir(),
      gzip: false,
      cacheMethod: 'none',
    });
  }
  return ocrWorkerPromise;
}

ipcMain.handle('ocr:recognize', async (_e, pngDataUrl) => {
  const worker = await getOcrWorker();
  const buf = Buffer.from(pngDataUrl.split(',')[1], 'base64');
  const { data } = await worker.recognize(buf);
  return data.text;
});
```

- [ ] **Step 7: Expose it in `electron/preload.js`** — add inside the exposed object:

```js
  ocrRecognize: (pngDataUrl) => ipcRenderer.invoke('ocr:recognize', pngDataUrl),
```

- [ ] **Step 8: Align the spec with the implemented preprocessing.** In `docs/superpowers/specs/2026-07-14-diploma-maker-design.md`, change the line
  `- Light image preprocessing before OCR (grayscale, contrast, deskew) to improve accuracy on phone photos.`
  to
  `- Light image preprocessing before OCR (grayscale, contrast stretch; slight skew is tolerated by Tesseract's own line detection) to improve accuracy on phone photos.`

- [ ] **Step 9: Run all tests**

Run: `npx vitest run`
Expected: all test files PASS.

- [ ] **Step 10: Commit**

```bash
git add src/ocr/preprocess.js tests/preprocess.test.js electron/main.js electron/preload.js docs/superpowers/specs/2026-07-14-diploma-maker-design.md .gitignore
git commit -m "feat: offline OCR pipeline with image preprocessing and bundled Romanian model"
```

---

### Task 9: Section 2 — Kids table (import, edit, add, delete, reorder, photo panel)

**Files:**
- Create: `src/ui/kids.js`

- [ ] **Step 1: Write `src/ui/kids.js`**

```js
// src/ui/kids.js
import { preprocessImageFile } from '../ocr/preprocess.js';
import { parseNamesFromOcrText } from '../shared/nameParsing.js';

export function init(state, save) {
  const el = document.getElementById('step-kids');
  el.innerHTML = `
    <h2>Copii</h2>
    <div class="row">
      <div>
        <input type="file" id="kidPhotos" accept="image/*" multiple hidden>
        <button class="primary" id="importBtn">Importă poze cu liste…</button>
        <span class="muted" id="ocrStatus"></span>
        <p class="muted">Numele extrase apar mai jos — verifică-le cu poza alăturată și corectează unde e nevoie.</p>
        <table class="names"><tbody id="kidRows"></tbody></table>
        <button class="small" id="addKid">+ Adaugă rând</button>
      </div>
      <div id="photoPanel" style="max-width:460px"></div>
    </div>`;

  const rowsEl = el.querySelector('#kidRows');
  const statusEl = el.querySelector('#ocrStatus');
  const fileInput = el.querySelector('#kidPhotos');

  function render() {
    rowsEl.innerHTML = '';
    state.session.kids.forEach((name, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = name;
      input.addEventListener('input', () => { state.session.kids[i] = input.value; save(); });
      cell.appendChild(input);
      const ops = document.createElement('td');
      for (const [label, fn] of [
        ['↑', () => { if (i > 0) { const k = state.session.kids; [k[i - 1], k[i]] = [k[i], k[i - 1]]; save(); render(); } }],
        ['↓', () => { const k = state.session.kids; if (i < k.length - 1) { [k[i + 1], k[i]] = [k[i], k[i + 1]]; save(); render(); } }],
        ['✕', () => { state.session.kids.splice(i, 1); save(); render(); }],
      ]) {
        const b = document.createElement('button');
        b.className = 'small';
        b.textContent = label;
        b.addEventListener('click', fn);
        ops.appendChild(b);
      }
      tr.append(num, cell, ops);
      rowsEl.appendChild(tr);
    });
  }

  function renderPhotos() {
    const panel = el.querySelector('#photoPanel');
    panel.innerHTML = state.photos.length ? '<h3>Pozele importate</h3>' : '';
    state.photos.forEach(({ name, url }) => {
      const fig = document.createElement('figure');
      fig.innerHTML = `<img src="${url}" style="max-width:100%"><figcaption class="muted">${name}</figcaption>`;
      panel.appendChild(fig);
    });
  }

  el.querySelector('#addKid').addEventListener('click', () => {
    state.session.kids.push('');
    save(); render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  el.querySelector('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    for (const file of fileInput.files) {
      statusEl.textContent = `Se procesează ${file.name}…`;
      try {
        const png = await preprocessImageFile(file);
        const text = await window.api.ocrRecognize(png);
        state.session.kids.push(...parseNamesFromOcrText(text));
        state.photos.push({ name: file.name, url: URL.createObjectURL(file) });
        save(); render(); renderPhotos();
      } catch (err) {
        alert(err.message);
      }
    }
    statusEl.textContent = '';
    fileInput.value = '';
  });

  render();
  renderPhotos();
}
```

- [ ] **Step 2: Verify manually with the real sample photo**

Run: `npm start`
Expected: on step 2, import the participant-list photo. After a processing pause, rows appear with most of the 47 names (diacritics included); the photo shows on the right. Edit a name, delete a row, reorder with ↑/↓, add a row. Restart the app: the edited list is restored.

- [ ] **Step 3: Commit**

```bash
git add src/ui/kids.js
git commit -m "feat: kids section with OCR import and editable name table"
```

---

### Task 10: Section 3 — Teachers list (manual entry)

**Files:**
- Create: `src/ui/teachers.js`

- [ ] **Step 1: Write `src/ui/teachers.js`**

```js
// src/ui/teachers.js
export function init(state, save) {
  const el = document.getElementById('step-teachers');
  el.innerHTML = `
    <h2>Însoțitori</h2>
    <p class="muted">Scrie numele fiecărui însoțitor — sunt puțini, nu e nevoie de poze.</p>
    <table class="names"><tbody id="teacherRows"></tbody></table>
    <button class="small" id="addTeacher">+ Adaugă însoțitor</button>`;

  const rowsEl = el.querySelector('#teacherRows');

  function render() {
    rowsEl.innerHTML = '';
    state.session.teachers.forEach((name, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = name;
      input.addEventListener('input', () => { state.session.teachers[i] = input.value; save(); });
      cell.appendChild(input);
      const ops = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'small';
      del.textContent = '✕';
      del.addEventListener('click', () => { state.session.teachers.splice(i, 1); save(); render(); });
      ops.appendChild(del);
      tr.append(num, cell, ops);
      rowsEl.appendChild(tr);
    });
  }

  el.querySelector('#addTeacher').addEventListener('click', () => {
    state.session.teachers.push('');
    save(); render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  render();
}
```

- [ ] **Step 2: Verify manually**

Run: `npm start`
Expected: add two teachers, edit, delete one, restart app — list persists.

- [ ] **Step 3: Commit**

```bash
git add src/ui/teachers.js
git commit -m "feat: manual teacher list section"
```

---

### Task 11: Section 4 — Template editor with live preview

**Files:**
- Create: `src/ui/templates.js`

- [ ] **Step 1: Write `src/ui/templates.js`**

```js
// src/ui/templates.js
import { formatDateRo } from '../shared/template.js';
import { renderDiplomaHtml } from '../shared/diplomaHtml.js';
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { fileUrl } from '../renderer.js';

const LINES = [
  { key: 'title', label: 'Titlu' },
  { key: 'awardLine', label: 'Linia de acordare' },
  { key: 'participationLine', label: 'Linia de participare' },
  { key: 'dateLine', label: 'Linia de dată ({start}, {end})' },
];

export function init(state, save) {
  const el = document.getElementById('step-templates');
  el.innerHTML = `
    <h2>Șabloane</h2>
    <div>
      <button class="small tpl-tab active" data-tpl="kid">Copil</button>
      <button class="small tpl-tab" data-tpl="teacher">Însoțitor</button>
    </div>
    <div class="row" style="margin-top:12px">
      <div id="tplFields"></div>
      <div class="preview-box"><div class="preview-frame" id="tplPreview"></div></div>
    </div>`;

  if (!document.getElementById('diploma-css')) {
    const style = document.createElement('style');
    style.id = 'diploma-css';
    style.textContent = DIPLOMA_CSS;
    document.head.appendChild(style);
  }

  let current = 'kid';

  function preview() {
    const ctx = {
      start: formatDateRo(state.session.startDate) || 'ZZ.LL.AAAA',
      end: formatDateRo(state.session.endDate) || 'ZZ.LL.AAAA',
    };
    const assets = {
      background: fileUrl(state.session.background),
      logoLeft: fileUrl(state.session.logoLeft),
      logoRight: fileUrl(state.session.logoRight),
    };
    document.getElementById('tplPreview').innerHTML =
      renderDiplomaHtml(state.session.templates[current], 'NUME PRENUME', ctx, assets);
  }

  function renderFields() {
    const box = el.querySelector('#tplFields');
    box.innerHTML = '';
    for (const { key, label } of LINES) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="muted">${label}</div>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.style.width = '420px';
      input.value = state.session.templates[current][key];
      input.addEventListener('input', () => {
        state.session.templates[current][key] = input.value;
        save(); preview();
      });
      wrap.appendChild(input);
      box.appendChild(wrap);
    }
  }

  el.querySelectorAll('.tpl-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tpl-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      current = btn.dataset.tpl;
      renderFields(); preview();
    });
  });

  renderFields();
  preview();
}
```

- [ ] **Step 2: Verify manually**

Run: `npm start`
Expected: step 4 shows Kid/Teacher tabs; the preview shows the diploma with background, logos, sample name and the session dates; typing in any field updates the preview live; edits persist across restart; switching tabs shows each template's own wording.

- [ ] **Step 3: Commit**

```bash
git add src/ui/templates.js
git commit -m "feat: template editor with kid/teacher tabs and live preview"
```

---

### Task 12: Validation guards + Section 5 (generate, print, PDF)

**Files:**
- Create: `src/shared/validation.js`, `src/ui/generate.js`
- Modify: `electron/main.js`, `electron/preload.js`
- Test: `tests/validation.test.js`

- [ ] **Step 1: Write the failing validation test**

```js
// tests/validation.test.js
import { describe, it, expect } from 'vitest';
import { validateForGeneration } from '../src/shared/validation.js';
import { defaultSession } from '../src/shared/session.js';

function readySession() {
  return {
    ...defaultSession(),
    startDate: '2026-07-07', endDate: '2026-07-12',
    background: 'C:/x/bg.jpg', logoLeft: 'C:/x/l.png', logoRight: 'C:/x/r.png',
    kids: ['A B'], teachers: ['C D'],
  };
}

describe('validateForGeneration', () => {
  it('passes a complete session', () => {
    expect(validateForGeneration(readySession(), 'all')).toEqual({ errors: [], warnings: [] });
  });

  it('errors on missing dates', () => {
    const s = { ...readySession(), startDate: '' };
    expect(validateForGeneration(s, 'all').errors.length).toBeGreaterThan(0);
  });

  it('errors on an empty batch', () => {
    const s = { ...readySession(), kids: [] };
    expect(validateForGeneration(s, 'kids').errors.length).toBeGreaterThan(0);
    expect(validateForGeneration(s, 'teachers').errors).toEqual([]);
  });

  it('errors on blank-only names', () => {
    const s = { ...readySession(), kids: ['  '] };
    expect(validateForGeneration(s, 'kids').errors.length).toBeGreaterThan(0);
  });

  it('warns (not errors) on missing images so the user can proceed intentionally', () => {
    const s = { ...readySession(), background: '', logoLeft: '' };
    const r = validateForGeneration(s, 'all');
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validation.test.js`
Expected: FAIL — cannot find module `validation.js`.

- [ ] **Step 3: Write `src/shared/validation.js`**

```js
// src/shared/validation.js

/** batch: 'kids' | 'teachers' | 'all'. Errors block generation; warnings need confirmation. */
export function validateForGeneration(session, batch) {
  const errors = [];
  const warnings = [];

  if (!session.startDate || !session.endDate) {
    errors.push('Setează datele sesiunii (început și sfârșit) în pasul 1.');
  }

  const clean = (list) => list.map((n) => n.trim()).filter(Boolean);
  const kids = clean(session.kids);
  const teachers = clean(session.teachers);
  const count = batch === 'kids' ? kids.length : batch === 'teachers' ? teachers.length : kids.length + teachers.length;
  if (count === 0) errors.push('Lista pentru acest lot este goală.');
  if ((batch === 'kids' && session.kids.some((n) => !n.trim()) && kids.length > 0)
    || (batch === 'teachers' && session.teachers.some((n) => !n.trim()) && teachers.length > 0)
    || (batch === 'all' && [...session.kids, ...session.teachers].some((n) => !n.trim()) && count > 0)) {
    errors.push('Există rânduri goale în listă — completează-le sau șterge-le.');
  }

  if (!session.background) warnings.push('Lipsește fotografia de fundal.');
  if (!session.logoLeft) warnings.push('Lipsește logo-ul din stânga.');
  if (!session.logoRight) warnings.push('Lipsește logo-ul din dreapta.');

  return { errors, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/validation.test.js`
Expected: PASS. (If the blank-name test fails, note the rule: blank rows are an error whenever the batch also contains at least one real name; an all-blank list already hits the empty-batch error.)

- [ ] **Step 5: Add print/PDF handlers to `electron/main.js`** — insert after the OCR handler:

```js
// --- Printing & PDF (renders the standalone print document in a hidden window) ---
async function loadPrintWindow(fullHtml) {
  const file = path.join(app.getPath('userData'), 'print.html');
  fs.writeFileSync(file, fullHtml);
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await w.loadFile(file);
  return w;
}

ipcMain.handle('print:batch', async (_e, fullHtml) => {
  const w = await loadPrintWindow(fullHtml);
  return new Promise((resolve) => {
    w.webContents.print(
      { printBackground: true, landscape: true, margins: { marginType: 'none' } },
      (ok, reason) => { w.destroy(); resolve({ ok, reason: reason || '' }); },
    );
  });
});

ipcMain.handle('print:pdf', async (_e, fullHtml) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'diplome.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, reason: 'canceled' };
  const w = await loadPrintWindow(fullHtml);
  const pdf = await w.webContents.printToPDF({
    landscape: true, pageSize: 'A4', printBackground: true,
    margins: { marginType: 'none' },
  });
  w.destroy();
  fs.writeFileSync(filePath, pdf);
  return { ok: true, filePath };
});
```

- [ ] **Step 6: Expose in `electron/preload.js`** — add inside the exposed object:

```js
  printBatch: (html) => ipcRenderer.invoke('print:batch', html),
  exportPdf: (html) => ipcRenderer.invoke('print:pdf', html),
```

- [ ] **Step 7: Write `src/ui/generate.js`**

```js
// src/ui/generate.js
import { formatDateRo } from '../shared/template.js';
import { renderDiplomaHtml, buildPrintDocument } from '../shared/diplomaHtml.js';
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { validateForGeneration } from '../shared/validation.js';
import { fileUrl } from '../renderer.js';

export function init(state, save) {
  const el = document.getElementById('step-generate');
  el.innerHTML = `
    <h2>Generare</h2>
    <div class="row">
      <label>Lot:
        <select id="batch">
          <option value="all">Toți (copii + însoțitori)</option>
          <option value="kids">Doar copiii</option>
          <option value="teachers">Doar însoțitorii</option>
        </select>
      </label>
      <button class="primary" id="previewBtn">Previzualizează</button>
      <button class="primary" id="printBtn">Tipărește</button>
      <button class="primary" id="pdfBtn">Exportă PDF</button>
    </div>
    <div class="error" id="genErrors"></div>
    <div id="genPreview" style="margin-top:16px; display:flex; flex-wrap:wrap; gap:12px"></div>`;

  if (!document.getElementById('diploma-css')) {
    const style = document.createElement('style');
    style.id = 'diploma-css';
    style.textContent = DIPLOMA_CSS;
    document.head.appendChild(style);
  }

  function batchEntries(batch) {
    const clean = (list, tpl) => list.map((n) => n.trim()).filter(Boolean).map((name) => ({ name, tpl }));
    const kids = clean(state.session.kids, 'kid');
    const teachers = clean(state.session.teachers, 'teacher');
    return batch === 'kids' ? kids : batch === 'teachers' ? teachers : [...kids, ...teachers];
  }

  function buildFragments(batch) {
    const ctx = { start: formatDateRo(state.session.startDate), end: formatDateRo(state.session.endDate) };
    const assets = {
      background: fileUrl(state.session.background),
      logoLeft: fileUrl(state.session.logoLeft),
      logoRight: fileUrl(state.session.logoRight),
    };
    return batchEntries(batch).map(({ name, tpl }) =>
      renderDiplomaHtml(state.session.templates[tpl], name, ctx, assets));
  }

  /** Returns fragments if allowed to proceed, else null. */
  function guard(batch) {
    const errBox = el.querySelector('#genErrors');
    const { errors, warnings } = validateForGeneration(state.session, batch);
    if (errors.length) { errBox.textContent = errors.join(' '); return null; }
    errBox.textContent = '';
    if (warnings.length && !confirm(warnings.join('\n') + '\n\nContinui fără acestea?')) return null;
    return buildFragments(batch);
  }

  el.querySelector('#previewBtn').addEventListener('click', () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    const box = el.querySelector('#genPreview');
    box.innerHTML = '';
    for (const f of frags) {
      const cell = document.createElement('div');
      cell.className = 'preview-box';
      cell.innerHTML = `<div class="preview-frame">${f}</div>`;
      box.appendChild(cell);
    }
  });

  el.querySelector('#printBtn').addEventListener('click', async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    const { ok, reason } = await window.api.printBatch(buildPrintDocument(frags));
    if (!ok && reason !== 'cancelled') alert('Tipărirea a eșuat: ' + reason);
  });

  el.querySelector('#pdfBtn').addEventListener('click', async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    const res = await window.api.exportPdf(buildPrintDocument(frags));
    if (res.ok) alert('PDF salvat: ' + res.filePath);
    else if (res.reason !== 'canceled') alert('Exportul a eșuat: ' + res.reason);
  });
}
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 9: Verify manually end-to-end**

Run: `npm start`
Expected:
- With everything set: Preview shows a thumbnail per person; kids use kid wording, teachers use teacher wording; Export PDF produces a landscape A4 PDF, one diploma per page, matching the preview; Print opens the printer dialog.
- Clear a date → all three buttons show the date error and refuse.
- Remove the background → a confirm dialog offers to continue without it.
- Empty both lists → "lista este goală" error.

- [ ] **Step 10: Commit**

```bash
git add src/shared/validation.js tests/validation.test.js src/ui/generate.js electron/main.js electron/preload.js
git commit -m "feat: generation guards, batch preview, printing and PDF export"
```

---

### Task 13: Packaging + offline acceptance

**Files:**
- Modify: none (config already in `package.json` from Task 1)

- [ ] **Step 1: Build the installer**

Run: `npm run dist`
Expected: `dist/Diploma Maker Setup 1.0.0.exe` produced without errors.

- [ ] **Step 2: Install and run the packaged app**

Run the installer, launch "Diploma Maker".
Expected: app opens; step 2 OCR works (verifies the packaged `ocr-data` path and `asarUnpack` are correct). If OCR fails only when packaged, check `process.resourcesPath/ocr-data/ron.traineddata` exists in the install dir.

- [ ] **Step 3: Offline acceptance test (the privacy guarantee)**

Disable Wi-Fi/Ethernet entirely. In the installed app, run the full flow with the real sample list photo: setup dates + images → import + fix kids' names → add teachers → adjust templates → preview → export PDF.
Expected: everything works with zero connectivity; PDF matches preview; most of the 47 names OCR correctly, the rest are fixable in the table.

- [ ] **Step 4: Commit any fixes found, tag**

```bash
git add -A
git commit -m "chore: packaging fixes from offline acceptance test" --allow-empty
git tag v1.0.0
```

---

## Self-review notes

- **Spec coverage:** dates → Task 7; background/logos upload → Tasks 5+7; OCR import + preprocessing + header/number filtering → Tasks 2, 8, 9; editable kids table (edit/add/delete/reorder) with photo panel → Task 9; manual teachers → Task 10; two editable templates, fixed layout, live preview, dual-gender wording in text → Tasks 3, 4, 11; batch print/PDF, one per page, landscape → Tasks 4, 12; error handling (missing assets confirm, empty list block, bad image rejection, no silent row deletion) → Tasks 7, 8, 12; local persistence/reopen → Task 5; zero network + packaging → Tasks 8, 13; unit tests for parsing/template/render/validation → Tasks 2, 3, 4, 5, 8, 12; manual acceptance on real photo offline → Task 13.
- **Deskew:** implemented as grayscale + contrast stretch, relying on Tesseract's internal line detection for slight skew; spec updated accordingly in Task 8.
- **Type consistency:** session shape (`startDate,endDate,background,logoLeft,logoRight,kids,teachers,templates{kid,teacher}{title,awardLine,participationLine,dateLine}`) is used identically across Tasks 5–12; `init(state, save)` signature is uniform for all `src/ui/*.js`; asset keys `background|logoLeft|logoRight` match between setup UI and main-process `asset:pick`.
