// ⚠️ À REMPLACER : colle ici la configuration de TON projet Firebase
// (Console Firebase > Paramètres du projet > Tes applications > Config).
// Voir INSTALLATION.md pour la marche à suivre complète, pas à pas.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC1DSCrXMxQ74XfJ9gU51O4HN0614S9LG4",
  authDomain: "vacances-934b0.firebaseapp.com",
  projectId: "vacances-934b0",
  storageBucket: "vacances-934b0.firebasestorage.app",
  messagingSenderId: "94300115202",
  appId: "1:94300115202:web:5eada3ab21f2e34f05f21b",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
