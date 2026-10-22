// Configuration Firebase — projet « Applis perso » (identifiant doucheco), partagé avec
// Douch'Eco, Bricolage Pro et Courses Pro. Firestore uniquement (photos en base64).
// Les collections du compteur sont toutes préfixées vac_ pour ne rien mélanger.
// Voir INSTALLATION.md pour la marche à suivre complète, pas à pas.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDhCmEw5c0hDEJZYox73mfW0BOdRicOSTk",
  authDomain: "doucheco.firebaseapp.com",
  projectId: "doucheco",
  storageBucket: "doucheco.firebasestorage.app",
  messagingSenderId: "961453430586",
  appId: "1:961453430586:web:d77427df31291b8d11a203",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

export const COL = {
  config: "vac_config",
  phrases: "vac_phrases",
  blagues: "vac_blagues",
  devinettes: "vac_devinettes",
  photos: "vac_photos",
};

// ---------- Déménagement automatique (oct. 2026) ----------
// Ancien projet « Vacances » (vacances-934b0), gardé en lecture seule.
// À la première ouverture de cette version, toutes les données (calendrier, phrases, blagues,
// devinettes, photos) sont recopiées dans le nouveau projet, avec les mêmes identifiants.
// Une marque « vac_config/migration » évite de recommencer. Si plusieurs téléphones le font
// en même temps, ils écrivent exactement la même chose : aucun doublon.
const ancienConfig = {
  apiKey: "AIzaSyC1DSCrXMxQ74XfJ9gU51O4HN0614S9LG4",
  authDomain: "vacances-934b0.firebaseapp.com",
  projectId: "vacances-934b0",
  storageBucket: "vacances-934b0.firebasestorage.app",
  messagingSenderId: "94300115202",
  appId: "1:94300115202:web:5eada3ab21f2e34f05f21b",
};
const ancienDb = getFirestore(initializeApp(ancienConfig, "ancien-projet-vacances"));
const ANCIENNES = { config: "config", phrases: "phrases", blagues: "blagues", devinettes: "devinettes", photos: "photos" };

export async function migrerSiBesoin() {
  const marque = doc(db, COL.config, "migration");
  if ((await getDoc(marque)).exists()) return { deja: true };
  const compte = {};
  for (const [cle, ancien] of Object.entries(ANCIENNES)) {
    const snap = await getDocs(collection(ancienDb, ancien));
    compte[cle] = snap.size;
    if (cle === "photos") {
      // une photo par écriture (chacune peut peser plusieurs centaines de Ko)
      for (const d of snap.docs) await setDoc(doc(db, COL.photos, d.id), d.data());
    } else {
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => b.set(doc(db, COL[cle], d.id), d.data()));
        await b.commit();
      }
    }
  }
  await setDoc(marque, { le: Date.now(), depuis: "vacances-934b0", compte });
  return { deja: false, compte };
}
