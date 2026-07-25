// src/ui/kids.js
import { preprocessImageFile } from '../ocr/preprocess.js';
import { parseNamesFromOcrText } from '../shared/nameParsing.js';

export function init(state, save) {
  const el = document.getElementById('step-kids');
  el.innerHTML = `
    <h2>Copii</h2>
    <div class="row">
      <div id="importZone">
        <input type="file" id="kidPhotos" accept="image/*" multiple hidden>
        <button class="primary" id="importBtn">Importă poze cu liste…</button>
        <label class="muted" style="margin-left:12px">Tip poză:
          <select id="ocrLayout">
            <option value="table">Tabel / listă pe o coloană</option>
            <option value="auto">Alt format (detectare automată)</option>
          </select>
        </label>
        <span class="muted" id="ocrStatus"></span>
        <p class="muted">Trage pozele aici sau folosește butonul. Numele extrase apar mai jos — verifică-le cu poza alăturată și corectează unde e nevoie.</p>
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

  async function importFiles(files) {
    for (const file of files) {
      statusEl.textContent = `Se procesează ${file.name}…`;
      try {
        const png = await preprocessImageFile(file);
        const text = await window.api.ocrRecognize(png, state.session.ocrLayout);
        const names = parseNamesFromOcrText(text);
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
    statusEl.textContent = '';
  }

  const layoutEl = el.querySelector('#ocrLayout');
  layoutEl.value = state.session.ocrLayout || 'table';
  layoutEl.addEventListener('change', () => { state.session.ocrLayout = layoutEl.value; save(); });

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
