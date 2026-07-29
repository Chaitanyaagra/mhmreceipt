// Test stub for the Firestore SDK import in app-common.js. None of the pure
// functions under test call these; they exist only so the module loads.
export const doc = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const setDoc = async () => {};
export const addDoc = async () => ({ id: 'stub' });
export const collection = () => ({});
export const runTransaction = async (_db, fn) => fn({ get: async () => ({ exists: () => false }), set(){}, update(){}, delete(){} });
export const serverTimestamp = () => new Date();
