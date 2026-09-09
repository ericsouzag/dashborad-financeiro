import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, DEMO_EMAIL, DEMO_PASSWORD } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/**
 * accountKind: 'owner' | 'demo' | 'visitor'
 * Salvamos isso no documento do usuário para a UI se comportar de forma
 * diferente (ex.: conta demo é somente leitura, visitante começa vazio).
 */
async function ensureUserDoc(user, accountKind) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      accountKind,
      createdAt: serverTimestamp(),
      fixedFieldsInitialized: accountKind === "owner",
    });
  }
  return ref;
}

export async function loginEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user, "owner");
  return cred.user;
}

export async function signUpEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user, "owner");
  return cred.user;
}

export async function loginDemo() {
  const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
  await ensureUserDoc(cred.user, "demo");
  return cred.user;
}

export async function loginVisitor() {
  const cred = await signInAnonymously(auth);
  await ensureUserDoc(cred.user, "visitor");
  return cred.user;
}

export function logout() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getAccountKind(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().accountKind : null;
}
