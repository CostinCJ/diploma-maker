// src/renderer.js
import { mergeSession } from './shared/session.js';

export const state = { sessionId: null, session: null };

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    window.api.saveSession(state.sessionId, state.session);
  }, 300);
}

/** Write anything still pending right now. Used before switching sessions: a
 *  debounced save would otherwise land in whichever session is open by then. */
export async function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  await window.api.saveSession(state.sessionId, state.session);
}

// Names typed in the last 300ms would otherwise be lost when the window closes.
window.addEventListener('beforeunload', () => {
  if (!saveTimer || !state.session) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  window.api.saveSessionSync(state.sessionId, state.session);
});

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
 *  after replacing state.session — each init rewrites its section from scratch.
 *  A failing step is isolated to its own section so the other four stay usable,
 *  but it is reported loudly: a silent empty step looks like a missing feature. */
export async function initSections() {
  for (const mod of ['setup', 'kids', 'teachers', 'templates', 'generate']) {
    try {
      const m = await import(`./ui/${mod}.js`);
      m.init(state, save);
    } catch (err) {
      console.error(`[renderer] step '${mod}' failed to initialise:`, err);
      const section = document.getElementById('step-' + mod);
      if (section) {
        const p = document.createElement('p');
        p.className = 'error';
        p.textContent = `Pasul nu a putut fi încărcat: ${err.message}`;
        section.replaceChildren(p);
      }
    }
  }
}

/** Put a session on screen. `loadedSession` is what the main process handed
 *  back — every step is rebuilt from it. */
export async function useSession({ id, session }) {
  state.sessionId = id;
  state.session = mergeSession(session);
  await initSections();
}

async function main() {
  initNav();
  await useSession(await window.api.loadSession());
}

main();
