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

/** (Re)build every section's UI from the current state. Safe to call again
 *  after replacing state.session — each init rewrites its section from scratch. */
export async function initSections() {
  for (const mod of ['setup', 'kids', 'teachers', 'templates', 'generate']) {
    try {
      const m = await import(`./ui/${mod}.js`);
      m.init(state, save);
    } catch (err) {
      console.debug(`[renderer] section '${mod}' unavailable:`, err);
    }
  }
}

async function main() {
  state.session = mergeSession(await window.api.loadSession());
  initNav();
  await initSections();
}

main();
