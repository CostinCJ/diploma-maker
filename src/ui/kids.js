// src/ui/kids.js
import { prepareImageFile } from '../ocr/preprocess.js';
import { readNamesFromImage } from '../ocr/readNames.js';

export function init(state, save) {
  const el = document.getElementById('step-kids');
  el.innerHTML = `
    <h2>Copii</h2>
    <div class="row">
      <div id="importZone">
        <input type="file" id="kidPhotos" accept="image/*" multiple hidden>
        <button class="primary" id="importBtn">Importă poze cu liste…</button>
        <span class="muted" id="ocrStatus"></span>
        <p class="muted">Trage pozele aici sau folosește butonul. Numele extrase apar mai jos — verifică-le cu poza alăturată și corectează unde e nevoie.</p>
        <p class="muted" id="kidCount"></p>
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
    const total = state.session.kids.length;
    el.querySelector('#kidCount').textContent = total ? `${total} nume în listă` : '';
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
      const img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '100%';
      const caption = document.createElement('figcaption');
      caption.className = 'muted';
      caption.textContent = name; // a file name may contain <, & or quotes
      fig.append(img, caption);
      panel.appendChild(fig);
    });
  }

  el.querySelector('#addKid').addEventListener('click', () => {
    state.session.kids.push('');
    save(); render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  let importing = false;

  async function importFiles(files) {
    // One OCR run at a time: the worker is shared and each run sets the page
    // segmentation mode, so overlapping imports could read with the wrong one.
    if (importing) return;
    importing = true;
    const importBtn = el.querySelector('#importBtn');
    importBtn.disabled = true;
    try {
      for (const file of files) {
        // Re-importing the same photo appends every name a second time, which is
        // easy to do by accident and tedious to undo by hand.
        if (state.photos.some((p) => p.name === file.name)
          && !confirm(`Poza ${file.name} a fost deja importată. O procesezi din nou?\nNumele vor fi adăugate a doua oară.`)) {
          continue;
        }
        statusEl.textContent = `Se procesează ${file.name}…`;
        try {
          const prepared = await prepareImageFile(file);
          const { names } = await readNamesFromImage(
            prepared,
            async (dataUrl) => {
              const res = await window.api.ocrRecognize(dataUrl);
              if (!res.ok) throw new Error(res.error);
              return res.text;
            },
            // Several segmentation attempts may run; report which one is in
            // flight so a slow import does not look frozen.
            (label, n) => { statusEl.textContent = `${file.name}: încercarea ${n} (${label})…`; },
          );
          if (names.length === 0) {
            alert(`Nicio linie recunoscută în ${file.name} — verifică poza și încearcă din nou.`);
          }
          state.session.kids.push(...names);
          state.photos.push({ name: file.name, url: URL.createObjectURL(file) });
          save(); render(); renderPhotos();
        } catch (err) {
          alert(err.message);
        }
      }
    } finally {
      statusEl.textContent = '';
      importBtn.disabled = false;
      importing = false;
    }
  }

  el.querySelector('#importBtn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    await importFiles(fileInput.files);
    fileInput.value = '';
  });

  const zone = el.querySelector('#importZone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) await importFiles(files);
  });

  render();
  renderPhotos();
}
