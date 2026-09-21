import { LIMITS, validateSession } from './core.js';
export const STORAGE_KEY = 'answer-lens.session.v1';
// Storage is injected for tests and accessed inside try/catch (private-mode getters can throw).
export function saveLocal(session, getStorage = () => localStorage) {
  if (!session.remember) return clearLocal(getStorage);
  try { getStorage().setItem(STORAGE_KEY, JSON.stringify(validateSession(session))); return { ok: true }; }
  catch { return { ok: false, message: 'Device saving is unavailable. This tab still works, but changes may not survive a reload.' }; }
}
export function clearLocal(getStorage = () => localStorage) {
  try { getStorage().removeItem(STORAGE_KEY); return { ok: true }; }
  catch { return { ok: false, message: 'The browser blocked deleting saved data. Clear this site’s storage in browser settings before leaving.' }; }
}
export function loadLocal(getStorage = () => localStorage) {
  try {
    const json = getStorage().getItem(STORAGE_KEY);
    if (json === null) return { session: null, ok: true };
    if (json.length > LIMITS.json) throw new Error('Oversized saved data.');
    const session = validateSession(JSON.parse(json));
    if (!session.remember) throw new Error('Persistence was not enabled.');
    return { session, ok: true };
  } catch {
    const cleared = clearLocal(getStorage);
    return { session: null, ok: false, message: cleared.ok
      ? 'Saved data could not be read and was removed. Start a fresh comparison.'
      : 'Device storage is unavailable. This tab still works; older saved data could not be removed.' };
  }
}
