// Test-only stub for the Firestore SDK functions app-common.js imports from
// gstatic. Implements a real in-memory store with genuine transaction
// buffer-commit-or-discard semantics (a callback that throws leaves NOTHING
// applied) — the same behavior verified against the real app in the browser
// throughout this project's development. This is what lets
// generateReceiptNumberAtomic()'s actual atomicity be tested here, not just
// its happy path.

let STORE = {};

export function __resetStore(seed = {}) {
  STORE = JSON.parse(JSON.stringify(seed));
}
export function __getStore() {
  return STORE;
}

export const doc = (a, b, c) => {
  // Two real call shapes: doc(db, collectionName, id) and
  // doc(collectionRef) which auto-generates an id.
  if (b === undefined) {
    const id = 'auto_' + Math.random().toString(36).slice(2, 10);
    return { p: `${a.c}/${id}`, c: a.c, id };
  }
  return { p: `${b}/${c}`, c: b, id: c };
};

export const collection = (_db, c) => ({ c });

export const getDoc = async (ref) => ({
  exists: () => STORE[ref.p] !== undefined,
  data: () => STORE[ref.p] || {}
});

export const setDoc = async (ref, data, opts) => {
  STORE[ref.p] = opts?.merge ? { ...(STORE[ref.p] || {}), ...data } : data;
};

export const addDoc = async (colRef, data) => {
  const id = 'auto_' + Math.random().toString(36).slice(2, 10);
  STORE[`${colRef.c}/${id}`] = data;
  return { id };
};

export const updateDoc = async (ref, data) => {
  STORE[ref.p] = { ...(STORE[ref.p] || {}), ...data };
};

export const deleteDoc = async (ref) => { delete STORE[ref.p]; };

export const query = (colRef) => ({ c: colRef.c });
export const where = () => ({});
export const orderBy = () => ({});
export const limit = () => ({});

export const getDocs = async (q) => {
  const c = q?.c || '';
  const entries = Object.entries(STORE).filter(([k]) => k.startsWith(c + '/'));
  const arr = entries.map(([k, v]) => ({ id: k.split('/')[1], ...v }));
  return {
    docs: arr.map(x => ({ id: x.id, data: () => x })),
    forEach(fn) { arr.forEach(x => fn({ id: x.id, data: () => x })); },
    size: arr.length,
    empty: arr.length === 0
  };
};

export const serverTimestamp = () => ({ __serverTimestamp: true, toMillis: () => Date.now() });

export const runTransaction = async (_db, callback) => {
  const pending = [];
  const tx = {
    get: async (ref) => ({ exists: () => STORE[ref.p] !== undefined, data: () => STORE[ref.p] || {} }),
    set: (ref, data, opts) => { pending.push({ p: ref.p, data, merge: opts?.merge }); },
    update: (ref, data) => { pending.push({ p: ref.p, data, merge: true }); },
    delete: (ref) => { pending.push({ p: ref.p, del: true }); }
  };
  // A thrown callback discards everything buffered — the real behavior
  // under test for the receipt-counter atomicity fix.
  const result = await callback(tx);
  for (const w of pending) {
    if (w.del) delete STORE[w.p];
    else STORE[w.p] = w.merge ? { ...(STORE[w.p] || {}), ...w.data } : w.data;
  }
  return result;
};

export const writeBatch = (_db) => {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push({ p: ref.p, data, merge: opts?.merge }); },
    update(ref, data) { ops.push({ p: ref.p, data, merge: true }); },
    delete(ref) { ops.push({ p: ref.p, del: true }); },
    commit: async () => { for (const w of ops) { if (w.del) delete STORE[w.p]; else STORE[w.p] = w.merge ? { ...(STORE[w.p] || {}), ...w.data } : w.data; } }
  };
};
