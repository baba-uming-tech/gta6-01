const KEY = 'velamar.save.v1';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(data) {
  const store = storage();
  if (!store || !data) return false;
  try {
    store.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (!envelope || envelope.version !== 1 || !envelope.data) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

export function clearSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    return;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
