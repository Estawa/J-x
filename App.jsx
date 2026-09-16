import React, { useState, useMemo, useEffect } from "react";
import {
  loadAllVideos, saveVideoForElement, loadHistorique, ajouterEssai, sauvegarderModeRetenu,
  slugifyNom, loadFautesPerso, sauvegarderFautesPerso, loadBrouillon, saveBrouillon,
  loadAcces, saveAcces, loadClassesIndex, loadRoster, appliquerImportClasse, modifierEleve, supprimerEleve, supprimerClasse,
} from "./firebase.js";
import { uploadVideoFile, deleteVideoFile } from "./blob.js";
import { FILLES, GARCONS, VALEURS, EXIGENCES, LETTRES, FAUTES_COMMUNES, FAUTES_FILLES, FAUTES_REPETABLES } from "./data.js";
import { styles } from "./styles.js";
import { CHANGELOG } from "./changelog.js";
import ImportEleves from "./ImportEleves.jsx";

const APP_VERSION = "2.2.0";

function elementKey(genre, lettre, n) {
  return `${genre}-${lettre}-${n}`;
}

function decomposeCivilite(v) {
  const m = /^(Mr|Mme)\s+(.*)$/.exec(v || "");
  return m ? { civilite: m[1], nom: m[2] } : { civilite: "Mr", nom: v || "" };
}

function AccesAdminBloc({ acces, onSauver }) {
  const [editionNom, setEditionNom] = useState(false);
  const d0 = decomposeCivilite(acces.nomAdmin);
  const [civ, setCiv] = useState(d0.civilite);
  const [nom, setNom] = useState(d0.nom);

  async function sauverNom() {
    if (!nom.trim()) return;
    await onSauver({ ...acces, nomAdmin: `${civ} ${nom.trim()}` });
    setEditionNom(false);
  }

  return (
    <div>
      {editionNom ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select style={styles.ensSelect} value={civ} onChange={(e) => setCiv(e.target.value)}>
            <option value="Mr">Mr</option><option value="Mme">Mme</option>
          </select>
          <input style={{ ...styles.ensInputSm, flex: 1 }} value={nom} onChange={(e) => setNom(e.target.value)} />
          <button style={styles.ensSmallBtnAccent} onClick={sauverNom}>OK</button>
        </div>
      ) : (
        <p style={{ fontSize: 13, marginBottom: 4 }}>Nom affiché : <b>{acces.nomAdmin}</b> · <span style={styles.ensLink} onClick={() => setEditionNom(true)}>modifier</span></p>
      )}
      <p style={{ fontSize: 13 }}>Code d'accès : <b>{acces.pinAdmin}</b> (modifiable via "Changer le code" en haut de l'appli)</p>
    </div>
  );
}

function AccesCollegues({ acces, onSauver }) {
  const [civ, setCiv] = useState("Mr");
  const [nom, setNom] = useState("");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState("");
  const [reinitPour, setReinitPour] = useState(null);
  const [reinitPin, setReinitPin] = useState("");
  const [reinitErreur, setReinitErreur] = useState("");
  const collegues = acces.collegues || [];

  function pinDejaUtilise(candidat, sauf) {
    if (candidat === acces.pinAdmin) return true;
    return collegues.some((c) => c.pin === candidat && c.nom !== sauf);
  }

  async function ajouter() {
    setErreur("");
    if (!nom.trim()) { setErreur("Indique le nom du collègue."); return; }
    if (!/^\d{4}$/.test(pin)) { setErreur("Le code doit contenir 4 chiffres."); return; }
    if (pinDejaUtilise(pin)) { setErreur("Ce code est déjà utilisé."); return; }
    await onSauver({ ...acces, collegues: [...collegues, { nom: `${civ} ${nom.trim()}`, pin }] });
    setNom(""); setPin("");
  }

  async function retirer(c) {
    if (!confirm(`Retirer l'accès de ${c.nom} ? Ses classes et données déjà enregistrées seront conservées mais ne seront plus accessibles que depuis "Vue globale".`)) return;
    await onSauver({ ...acces, collegues: collegues.filter((x) => x.nom !== c.nom) });
  }

  function ouvrirReinit(c) {
    setReinitPour(c.nom);
    setReinitPin("");
    setReinitErreur("");
  }

  function genererPin() {
    setReinitPin(String(Math.floor(1000 + Math.random() * 9000)));
    setReinitErreur("");
  }

  async function validerReinit(c) {
    if (!/^\d{4}$/.test(reinitPin)) { setReinitErreur("Le code doit contenir 4 chiffres."); return; }
    if (pinDejaUtilise(reinitPin, c.nom)) { setReinitErreur("Ce code est déjà utilisé."); return; }
    await onSauver({ ...acces, collegues: collegues.map((x) => (x.nom === c.nom ? { ...x, pin: reinitPin } : x)) });
    setReinitPour(null);
    setReinitPin("");
  }

  return (
    <div>
      <div style={styles.ensCard}>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <select style={styles.ensSelect} value={civ} onChange={(e) => setCiv(e.target.value)}>
            <option value="Mr">Mr</option><option value="Mme">Mme</option>
          </select>
          <input style={{ ...styles.ensInputSm, flex: 1 }} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du collègue" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ ...styles.ensInputSm, flex: 1 }} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={4} placeholder="Code PIN (4 chiffres)" />
          <button style={styles.ensSmallBtnAccent} onClick={ajouter}>Ajouter</button>
        </div>
        {erreur && <p style={{ fontSize: 12, color: "#B8443D", marginTop: 6 }}>{erreur}</p>}
      </div>
      {collegues.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9A9484" }}>Aucun collègue ajouté pour l'instant.</p>
      ) : (
        collegues.map((c) => (
          <div key={c.nom} style={styles.ensCard}>
            <div style={styles.ensRow}>
              <span style={{ fontSize: 13, fontWeight: "bold" }}>{c.nom}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.ensSmallBtn} onClick={() => ouvrirReinit(c)}>Réinitialiser le code</button>
                <button style={styles.ensSmallBtnDanger} onClick={() => retirer(c)}>Retirer</button>
              </div>
            </div>
            {reinitPour === c.nom && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
                <input style={{ ...styles.ensInputSm, flex: 1 }} value={reinitPin} onChange={(e) => setReinitPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={4} placeholder="Nouveau code (4 chiffres)" />
                <button style={styles.ensSmallBtn} onClick={genererPin}>Générer</button>
                <button style={styles.ensSmallBtnAccent} onClick={() => validerReinit(c)}>Valider</button>
                <button style={styles.ensSmallBtn} onClick={() => setReinitPour(null)}>Annuler</button>
              </div>
            )}
            {reinitPour === c.nom && reinitErreur && <p style={{ fontSize: 12, color: "#B8443D", marginTop: 6 }}>{reinitErreur}</p>}
          </div>
        ))
      )}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("eleve");
  const [genre, setGenre] = useState("filles");
  const [onglet, setOnglet] = useState("referentiel");
  const [videos, setVideos] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [uploading, setUploading] = useState({}); // { "key|slot": pourcentage }
  const [selection, setSelection] = useState({});
  const [exigencesCochees, setExigencesCochees] = useState({});
  const [fautesSimples, setFautesSimples] = useState({});
  const [fautesRepetables, setFautesRepetables] = useState({});
  const [penalites, setPenalites] = useState("");
  const [demandePin, setDemandePin] = useState(false);
  const [pinSaisi, setPinSaisi] = useState("");
  const [pinErreur, setPinErreur] = useState("");
  const [changerPin, setChangerPin] = useState(false);
  const [ancienPin, setAncienPin] = useState("");
  const [nouveauPin, setNouveauPin] = useState("");
  const [nouveauPinConfirm, setNouveauPinConfirm] = useState("");
  const [changerPinErreur, setChangerPinErreur] = useState("");
  const [changerPinSucces, setChangerPinSucces] = useState(false);
  const [afficherJournal, setAfficherJournal] = useState(false);
  const [ficheOuverte, setFicheOuverte] = useState(null);
  const [historique, setHistorique] = useState({});
  const [classeSaisie, setClasseSaisie] = useState("");
  const [classesSaisie, setClassesSaisie] = useState([]);
  const [rosterSaisie, setRosterSaisie] = useState([]);
  const [numeroSaisi, setNumeroSaisi] = useState("");
  const [messageBrouillon, setMessageBrouillon] = useState("");
  const [brouillonInfo, setBrouillonInfo] = useState("");
  const [messageEnregistrement, setMessageEnregistrement] = useState("");
  const [eleveOuvert, setEleveOuvert] = useState(null);
  const [profSelectionne, setProfSelectionne] = useState(() => localStorage.getItem("gympro_prof_selectionne") || "");
  const [choixProfTemp, setChoixProfTemp] = useState("");
  const [acces, setAcces] = useState({ pinAdmin: "1234", nomAdmin: "Mr Guilhem", collegues: [] });
  const [verrouComposition, setVerrouComposition] = useState({ rotation: false, atr: false, changements: false });
  const [fautesPerso, setFautesPerso] = useState([]);
  const [nouvelleFautePersoLabel, setNouvelleFautePersoLabel] = useState("");
  const [nouvelleFautePersoValeur, setNouvelleFautePersoValeur] = useState("");
  const [fautePersoErreur, setFautePersoErreur] = useState("");

  // ---- Espace "Élèves & Accès" (mode prof) ----
  const [vueEnseignant, setVueEnseignant] = useState("mes-classes"); // mes-classes | globale | acces
  const [collegueVu, setCollegueVu] = useState("");
  const [classesEns, setClassesEns] = useState(null);
  const [classeOuverteEns, setClasseOuverteEns] = useState(null);
  const [rosterEns, setRosterEns] = useState([]);
  const [importOuvert, setImportOuvert] = useState(false);
  const [ajoutEleveOuvert, setAjoutEleveOuvert] = useState(false);
  const [aPrenom, setAPrenom] = useState("");
  const [aNom, setANom] = useState("");
  const [aSexe, setASexe] = useState("");
  const [editionEleve, setEditionEleve] = useState(null);
  const [editPrenom, setEditPrenom] = useState("");
  const [editNom, setEditNom] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [appInstallee, setAppInstallee] = useState(false);

  const PROFS = useMemo(() => [acces.nomAdmin, ...(acces.collegues || []).map((c) => c.nom)], [acces]);
  const estAdmin = profSelectionne === acces.nomAdmin;

  useEffect(() => {
    const gererPromptInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const gererInstalle = () => setAppInstallee(true);
    window.addEventListener("beforeinstallprompt", gererPromptInstall);
    window.addEventListener("appinstalled", gererInstalle);
    return () => {
      window.removeEventListener("beforeinstallprompt", gererPromptInstall);
      window.removeEventListener("appinstalled", gererInstalle);
    };
  }, []);

  async function installerApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  useEffect(() => {
    loadAllVideos()
      .then((v) => setVideos(v))
      .catch((e) => setErreur("Connexion à la sauvegarde impossible : " + e.message))
      .finally(() => setChargement(false));
    loadAcces()
      .then((a) => setAcces(a))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!profSelectionne) return;
    const profId = slugifyNom(profSelectionne);
    loadHistorique(profSelectionne)
      .then((h) => setHistorique(h))
      .catch(() => {});
    loadFautesPerso(profId)
      .then((f) => setFautesPerso(f))
      .catch(() => {});
    loadClassesIndex(profSelectionne).then(setClassesSaisie).catch(() => {});
  }, [profSelectionne]);

  const data = genre === "filles" ? FILLES : GARCONS;
  const exigences = genre === "filles" ? EXIGENCES.filles : EXIGENCES.garcons;

  const elementsChoisis = useMemo(() => {
    const arr = [];
    for (const lettre of LETTRES) {
      for (const el of data[lettre]) {
        const key = elementKey(genre, lettre, el.n);
        if (selection[key]) arr.push({ ...el, lettre, key });
      }
    }
    return arr;
  }, [selection, data, genre]);

  const noteD = useMemo(() => {
    const valeurs = elementsChoisis.map((e) => VALEURS[e.lettre]).sort((a, b) => b - a).slice(0, 8);
    const difficultes = valeurs.reduce((s, v) => s + v, 0);
    const nbExigences = Object.values(exigencesCochees).filter(Boolean).length;
    const verrouOk = verrouComposition.rotation && verrouComposition.atr && verrouComposition.changements;
    const exigencesPts = verrouOk ? nbExigences * 0.5 : 0;
    let penaliteCourt = 0;
    if (elementsChoisis.length > 0 && elementsChoisis.length <= 5) penaliteCourt = 2;
    return {
      difficultes: Math.round(difficultes * 100) / 100,
      exigencesPts: Math.round(exigencesPts * 100) / 100,
      penaliteCourt,
      verrouOk,
      total: Math.round((difficultes + exigencesPts - penaliteCourt) * 100) / 100,
    };
  }, [elementsChoisis, exigencesCochees, verrouComposition]);

  const fautesActives = useMemo(() => {
    return genre === "filles" ? [...FAUTES_COMMUNES, ...FAUTES_FILLES] : FAUTES_COMMUNES;
  }, [genre]);

  const noteE = useMemo(() => {
    let penalite = 0;
    for (const f of fautesActives) {
      penalite += fautesSimples[f.id] || 0;
    }
    for (const f of fautesPerso) {
      penalite += fautesSimples[f.id] || 0;
    }
    for (const f of FAUTES_REPETABLES) {
      const count = fautesRepetables[f.id] || 0;
      const brut = count * f.unite;
      penalite += f.max ? Math.min(brut, f.max) : brut;
    }
    return Math.max(0, Math.round((10 - penalite) * 100) / 100);
  }, [fautesActives, fautesSimples, fautesRepetables, fautesPerso]);

  const penaliteETotal = useMemo(() => Math.round((10 - noteE) * 100) / 100, [noteE]);

  // Liste itemisée des fautes actives, utilisée pour l'aperçu "points de correction"
  // lors de l'évaluation entre élèves.
  const pointsCorrection = useMemo(() => {
    const points = [];
    for (const f of fautesActives) {
      const v = fautesSimples[f.id] || 0;
      if (v > 0) points.push({ label: f.label, valeur: v });
    }
    for (const f of fautesPerso) {
      const v = fautesSimples[f.id] || 0;
      if (v > 0) points.push({ label: f.label, valeur: v });
    }
    for (const f of FAUTES_REPETABLES) {
      const count = fautesRepetables[f.id] || 0;
      if (count > 0) {
        const brut = count * f.unite;
        const total = f.max ? Math.min(brut, f.max) : brut;
        points.push({ label: `${f.label} (×${count})`, valeur: total });
      }
    }
    return points;
  }, [fautesActives, fautesSimples, fautesRepetables, fautesPerso]);

  const noteFinale = useMemo(() => {
    const p = parseFloat(penalites) || 0;
    return Math.round((noteD.total + noteE - p) * 100) / 100;
  }, [noteD, noteE, penalites]);

  function definirFauteSimple(id, valeur) {
    setFautesSimples((f) => ({ ...f, [id]: f[id] === valeur ? 0 : valeur }));
  }

  function changerFauteRepetable(id, delta, max, unite) {
    setFautesRepetables((f) => {
      const cur = f[id] || 0;
      let next = Math.max(0, cur + delta);
      if (max) next = Math.min(next, Math.ceil(max / unite));
      return { ...f, [id]: next };
    });
  }

  function toggleVerrouComposition(cle) {
    setVerrouComposition((v) => ({ ...v, [cle]: !v[cle] }));
  }

  async function ajouterFautePerso() {
    const label = nouvelleFautePersoLabel.trim();
    const valeur = parseFloat(nouvelleFautePersoValeur);
    if (!label) {
      setFautePersoErreur("Indique le nom de la faute.");
      return;
    }
    if (!valeur || valeur <= 0) {
      setFautePersoErreur("Indique une valeur de pénalité supérieure à 0.");
      return;
    }
    const nouvelle = { id: `perso-${Date.now()}`, label, valeur: Math.round(valeur * 100) / 100 };
    const next = [...fautesPerso, nouvelle];
    try {
      const profId = slugifyNom(profSelectionne);
      await sauvegarderFautesPerso(profId, next);
      setFautesPerso(next);
      setNouvelleFautePersoLabel("");
      setNouvelleFautePersoValeur("");
      setFautePersoErreur("");
    } catch (e) {
      setFautePersoErreur("Échec de l'enregistrement : " + e.message);
    }
  }

  async function supprimerFautePerso(id) {
    const next = fautesPerso.filter((f) => f.id !== id);
    try {
      const profId = slugifyNom(profSelectionne);
      await sauvegarderFautesPerso(profId, next);
      setFautesPerso(next);
    } catch (e) {
      setErreur("Échec de la suppression : " + e.message);
    }
  }

  function toggleSelection(key) {
    setSelection((s) => ({ ...s, [key]: !s[key] }));
  }
  function toggleExigence(code) {
    setExigencesCochees((s) => ({ ...s, [code]: !s[code] }));
  }

  function getPinActuel() {
    if (profSelectionne === acces.nomAdmin) return acces.pinAdmin;
    const c = (acces.collegues || []).find((x) => x.nom === profSelectionne);
    return c ? c.pin : "";
  }

  function demarrerPassageProf() {
    if (mode === "prof") return;
    setPinSaisi("");
    setPinErreur("");
    setDemandePin(true);
  }

  function validerPin() {
    if (pinSaisi === getPinActuel()) {
      setDemandePin(false);
      setPinSaisi("");
      setPinErreur("");
      setMode("prof");
    } else {
      setPinErreur("Code incorrect, réessaie.");
      setPinSaisi("");
    }
  }

  function annulerPin() {
    setDemandePin(false);
    setPinSaisi("");
    setPinErreur("");
  }

  function ouvrirChangementPin() {
    setAncienPin("");
    setNouveauPin("");
    setNouveauPinConfirm("");
    setChangerPinErreur("");
    setChangerPinSucces(false);
    setChangerPin(true);
  }

  async function validerChangementPin() {
    if (ancienPin !== getPinActuel()) {
      setChangerPinErreur("L'ancien code est incorrect.");
      return;
    }
    if (!/^\d{4}$/.test(nouveauPin)) {
      setChangerPinErreur("Le nouveau code doit comporter 4 chiffres.");
      return;
    }
    if (nouveauPin !== nouveauPinConfirm) {
      setChangerPinErreur("Les deux codes ne correspondent pas.");
      return;
    }
    const next = profSelectionne === acces.nomAdmin
      ? { ...acces, pinAdmin: nouveauPin }
      : { ...acces, collegues: acces.collegues.map((c) => (c.nom === profSelectionne ? { ...c, pin: nouveauPin } : c)) };
    try {
      await saveAcces(next);
      setAcces(next);
      setChangerPinErreur("");
      setChangerPinSucces(true);
    } catch (e) {
      setChangerPinErreur("Échec de l'enregistrement : " + e.message);
    }
  }
  async function persist(key, next) {
    setVideos((v) => ({ ...v, [key]: next }));
    try {
      await saveVideoForElement(key, next);
    } catch (e) {
      setErreur("Échec de la sauvegarde : " + e.message);
    }
  }
  function saveVideo(key, field, value, idx) {
    const cur = videos[key] || { demo: "", phases: [] };
    if (field === "demo") return persist(key, { ...cur, demo: value });
    const phases = [...cur.phases];
    if (idx === undefined) phases.push(value);
    else phases[idx] = value;
    persist(key, { ...cur, phases });
  }
  function removePhase(key, idx) {
    const cur = videos[key] || { demo: "", phases: [] };
    const ancienneUrl = cur.phases[idx];
    persist(key, { ...cur, phases: cur.phases.filter((_, i) => i !== idx) });
    if (ancienneUrl) deleteVideoFile(ancienneUrl);
  }

  // Upload d'un fichier vidéo depuis l'ordinateur/téléphone du prof.
  // slot: "demo" pour la vidéo de démonstration, "phase" pour une vidéo de phase (idx optionnel pour remplacer une phase existante).
  async function handleFileUpload(key, slot, file, idx) {
    if (!file) return;
    const progressKey = `${key}|${slot}${idx !== undefined ? "-" + idx : ""}`;
    setUploading((u) => ({ ...u, [progressKey]: 0 }));
    try {
      const url = await uploadVideoFile(key, slot === "demo" ? "demo" : `phase-${idx !== undefined ? idx : "nouvelle"}`, file, (pct) =>
        setUploading((u) => ({ ...u, [progressKey]: pct }))
      );
      const cur = videos[key] || { demo: "", phases: [] };
      if (slot === "demo") {
        const ancienneUrl = cur.demo;
        await persist(key, { ...cur, demo: url });
        if (ancienneUrl) deleteVideoFile(ancienneUrl);
      } else {
        const phases = [...(cur.phases || [])];
        const ancienneUrl = idx !== undefined ? phases[idx] : undefined;
        if (idx !== undefined) phases[idx] = url;
        else phases.push(url);
        await persist(key, { ...cur, phases });
        if (ancienneUrl) deleteVideoFile(ancienneUrl);
      }
    } catch (e) {
      setErreur("Échec de l'envoi de la vidéo : " + e.message);
    } finally {
      setUploading((u) => {
        const next = { ...u };
        delete next[progressKey];
        return next;
      });
    }
  }

  function calculerNoteRetenue(essais, mode, idsRetenus) {
    if (!essais || essais.length === 0) return null;
    if (mode === "derniere") return essais[essais.length - 1].noteFinale;
    let pris = essais;
    if (mode === "certaines") {
      pris = essais.filter((e) => (idsRetenus || []).includes(e.id));
      if (pris.length === 0) return null;
    }
    const somme = pris.reduce((s, e) => s + e.noteFinale, 0);
    return somme / pris.length;
  }

  function reinitialiserEvaluation() {
    setSelection({});
    setExigencesCochees({});
    setVerrouComposition({ rotation: false, atr: false, changements: false });
    setFautesSimples({});
    setFautesRepetables({});
    setPenalites("");
    setClasseSaisie("");
    setNumeroSaisi("");
    setMessageEnregistrement("");
    setMessageBrouillon("");
    setBrouillonInfo("");
  }

  async function choisirClasseSaisie(c) {
    setClasseSaisie(c);
    setNumeroSaisi("");
    setBrouillonInfo("");
    setMessageBrouillon("");
    setMessageEnregistrement("");
    const r = await loadRoster(profSelectionne, c);
    setRosterSaisie(r.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
  }

  // Sélection de l'élève, en mode élève ("c'est moi") comme en mode prof
  // ("élève évalué") : recharge sa composition déclarée (Note D uniquement)
  // et repart toujours sur une Note E vierge, évaluée en direct.
  async function choisirEleveSaisi(numero) {
    setNumeroSaisi(numero);
    setMessageEnregistrement("");
    setMessageBrouillon("");
    setFautesSimples({});
    setFautesRepetables({});
    setPenalites("");
    if (!numero) { setBrouillonInfo(""); return; }
    const b = await loadBrouillon(profSelectionne, classeSaisie, numero);
    if (b) {
      setSelection(b.selection || {});
      setExigencesCochees(b.exigencesCochees || {});
      setVerrouComposition(b.verrouComposition || { rotation: false, atr: false, changements: false });
      if (b.genre) setGenre(b.genre);
      setBrouillonInfo(
        mode === "prof"
          ? "Composition et exigences pré-remplies depuis la fiche de l'élève — vérifie et corrige si besoin."
          : "Ta dernière composition enregistrée a été rechargée."
      );
    } else {
      setSelection({});
      setExigencesCochees({});
      setVerrouComposition({ rotation: false, atr: false, changements: false });
      setBrouillonInfo(mode === "prof" ? "Aucune composition déclarée par l'élève : coche les éléments réalisés." : "");
    }
  }

  async function enregistrerBrouillon() {
    if (!numeroSaisi) { setMessageBrouillon("Sélectionne ta classe et ton nom avant d'enregistrer."); return; }
    try {
      await saveBrouillon(profSelectionne, classeSaisie, numeroSaisi, {
        genre, selection, exigencesCochees, verrouComposition, updatedAt: new Date().toISOString(),
      });
      setMessageBrouillon("Ta composition est enregistrée. Ton/ta professeur(e) la retrouvera lors de ton passage.");
    } catch (e) {
      setMessageBrouillon("Échec de l'enregistrement : " + e.message);
    }
  }

  async function enregistrerEssai() {
    const eleve = rosterSaisie.find((m) => String(m.numero) === String(numeroSaisi));
    if (!eleve) {
      setMessageEnregistrement("Sélectionne la classe puis l'élève avant d'enregistrer.");
      return;
    }
    const nomComplet = `${eleve.prenom} ${eleve.nom}`;
    const essai = {
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      genre,
      noteD: noteD.total,
      noteE: noteE,
      penalites: parseFloat(penalites) || 0,
      noteFinale,
    };
    try {
      const id = await ajouterEssai(profSelectionne, classeSaisie, eleve.numero, nomComplet, essai);
      setHistorique((h) => {
        const existant = h[id] || { nom: nomComplet, essais: [], modeRetenu: "toutes", essaisRetenusIds: [] };
        return { ...h, [id]: { ...existant, nom: nomComplet, essais: [...(existant.essais || []), essai] } };
      });
      setMessageEnregistrement(`Note enregistrée pour ${nomComplet}.`);
    } catch (e) {
      setMessageEnregistrement("Échec de l'enregistrement : " + e.message);
    }
  }

  async function changerModeRetenu(id, modeRetenu) {
    setHistorique((h) => ({ ...h, [id]: { ...h[id], modeRetenu } }));
    try {
      await sauvegarderModeRetenu(id, modeRetenu, historique[id]?.essaisRetenusIds || []);
    } catch (e) {
      setErreur("Échec de la sauvegarde : " + e.message);
    }
  }

  async function toggleEssaiRetenu(id, essaiId) {
    const eleve = historique[id];
    const current = eleve.essaisRetenusIds || [];
    const next = current.includes(essaiId) ? current.filter((x) => x !== essaiId) : [...current, essaiId];
    setHistorique((h) => ({ ...h, [id]: { ...h[id], essaisRetenusIds: next } }));
    try {
      await sauvegarderModeRetenu(id, eleve.modeRetenu || "toutes", next);
    } catch (e) {
      setErreur("Échec de la sauvegarde : " + e.message);
    }
  }

  useEffect(() => {
    if (mode === "eleve" && onglet === "historique") setOnglet("referentiel");
  }, [mode]);

  function validerChoixProf() {
    if (!choixProfTemp) return;
    localStorage.setItem("gympro_prof_selectionne", choixProfTemp);
    setProfSelectionne(choixProfTemp);
  }

  function changerDeProf() {
    localStorage.removeItem("gympro_prof_selectionne");
    setProfSelectionne("");
    setChoixProfTemp("");
    setMode("eleve");
    setOnglet("referentiel");
  }

  // ---- Espace "Élèves & Accès" : Mes classes / Vue globale (admin) / Accès (admin) ----
  const profActifEns = vueEnseignant === "globale" ? collegueVu : profSelectionne;

  useEffect(() => {
    if (onglet !== "historique") return;
    if (!profActifEns) { setClassesEns(null); return; }
    setClasseOuverteEns(null);
    loadClassesIndex(profActifEns).then(setClassesEns);
  }, [onglet, profActifEns]);

  async function ouvrirClasseEns(c) {
    setClasseOuverteEns(c);
    const r = await loadRoster(profActifEns, c);
    setRosterEns(r.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    const h = await loadHistorique(profActifEns);
    setHistorique((prev) => ({ ...prev, ...h }));
  }

  async function rafraichirRosterEns() {
    const r = await loadRoster(profActifEns, classeOuverteEns);
    setRosterEns(r.slice().sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
  }

  async function ajouterEleveEns() {
    if (!aPrenom.trim() || !aNom.trim()) return;
    await appliquerImportClasse(profActifEns, classeOuverteEns, [{ nom: aNom.trim(), prenom: aPrenom.trim(), sexe: aSexe || null }], "ajouter");
    setAPrenom(""); setANom(""); setASexe(""); setAjoutEleveOuvert(false);
    rafraichirRosterEns();
  }

  async function enregistrerEditionEleve(numero) {
    if (!editPrenom.trim() || !editNom.trim()) return;
    await modifierEleve(profActifEns, classeOuverteEns, numero, { nom: editNom, prenom: editPrenom });
    setEditionEleve(null);
    rafraichirRosterEns();
  }

  async function retirerEleveEns(numero) {
    await supprimerEleve(profActifEns, classeOuverteEns, numero);
    rafraichirRosterEns();
  }

  async function supprimerClasseEns(c) {
    if (!confirm(`Supprimer la classe ${c} et toutes ses données ? Impossible à annuler.`)) return;
    await supprimerClasse(profActifEns, c);
    setClassesEns((cs) => cs.filter((x) => x !== c));
    if (classeOuverteEns === c) { setClasseOuverteEns(null); setRosterEns([]); }
  }

  if (!profSelectionne) {
    return (
      <div style={styles.portailWrap}>
        <div style={styles.portailBox}>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Gym Pro</h1>
            <span style={styles.byline}>By C. Guilhem</span>
            <span style={styles.version}>v{APP_VERSION}</span>
          </div>
          <p style={styles.calcHint}>Sélectionne ton professeur pour continuer.</p>
          <select style={styles.portailSelect} value={choixProfTemp} onChange={(e) => setChoixProfTemp(e.target.value)}>
            <option value="">— Choisir un professeur —</option>
            {PROFS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button style={styles.doneBtn} onClick={validerChoixProf} disabled={!choixProfTemp}>Continuer</button>

          <div style={styles.portailPartage}>
            <img
              style={styles.portailQr}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(window.location.origin)}`}
              alt="QR code de partage de Gym Pro"
            />
            <span style={styles.portailPartageTexte}>Scannez pour ouvrir Gym Pro sur un téléphone</span>
            <a style={styles.portailLien} href={window.location.origin}>{window.location.origin}</a>
            {!appInstallee && (
              <button style={styles.portailInstallBtn} onClick={installerApp} disabled={!installPrompt}>
                {installPrompt ? "📲 Installer l'application" : "Sur iPhone : Partager → Sur l'écran d'accueil"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>UNSS · Équipe Établissement 2024-2028</div>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Gym Pro</h1>
            <span style={styles.byline}>By C. Guilhem</span>
            <span style={styles.version}>v{APP_VERSION}</span>
          </div>
        </div>
        <div style={styles.modeSwitch}>
          <span style={styles.profContexte}>Classe de {profSelectionne} · <button style={styles.changerPinLink} onClick={changerDeProf}>Changer</button></span>
          <button style={mode === "eleve" ? styles.modeBtnActive : styles.modeBtn} onClick={() => setMode("eleve")}>Élève</button>
          <button style={mode === "prof" ? styles.modeBtnActive : styles.modeBtn} onClick={demarrerPassageProf}>Prof</button>
          {mode === "prof" && (
            <button style={styles.changerPinLink} onClick={ouvrirChangementPin}>Changer le code</button>
          )}
        </div>
      </header>

      {demandePin && (
        <div style={styles.pinOverlay}>
          <div style={styles.pinBox}>
            <h3 style={styles.boxTitle}>Code d'accès Mode Prof</h3>
            <input
              style={styles.pinInput}
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pinSaisi}
              onChange={(e) => setPinSaisi(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && validerPin()}
              placeholder="••••"
            />
            {pinErreur && <div style={styles.pinErreur}>{pinErreur}</div>}
            <div style={styles.pinBoutons}>
              <button style={styles.doneBtn} onClick={validerPin}>Valider</button>
              <button style={styles.editBtn} onClick={annulerPin}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {changerPin && (
        <div style={styles.pinOverlay}>
          <div style={styles.pinBox}>
            <h3 style={styles.boxTitle}>Changer le code d'accès</h3>
            {changerPinSucces ? (
              <>
                <div style={styles.pinSucces}>Code mis à jour avec succès.</div>
                <button style={styles.doneBtn} onClick={() => setChangerPin(false)}>Fermer</button>
              </>
            ) : (
              <>
                <label style={styles.editLabel}>Code actuel</label>
                <input style={styles.pinInput} type="password" inputMode="numeric" maxLength={4} value={ancienPin} onChange={(e) => setAncienPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                <label style={styles.editLabel}>Nouveau code (4 chiffres)</label>
                <input style={styles.pinInput} type="password" inputMode="numeric" maxLength={4} value={nouveauPin} onChange={(e) => setNouveauPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                <label style={styles.editLabel}>Confirmer le nouveau code</label>
                <input style={styles.pinInput} type="password" inputMode="numeric" maxLength={4} value={nouveauPinConfirm} onChange={(e) => setNouveauPinConfirm(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                {changerPinErreur && <div style={styles.pinErreur}>{changerPinErreur}</div>}
                <div style={styles.pinBoutons}>
                  <button style={styles.doneBtn} onClick={validerChangementPin}>Valider</button>
                  <button style={styles.editBtn} onClick={() => setChangerPin(false)}>Annuler</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {erreur && <div style={styles.errorBanner}>{erreur}</div>}
      {chargement && <div style={styles.loading}>Chargement des données...</div>}

      <div style={styles.controls}>
        <div style={styles.genreSwitch}>
          <button style={genre === "filles" ? styles.genreBtnActive : styles.genreBtn} onClick={() => setGenre("filles")}>Filles</button>
          <button style={genre === "garcons" ? styles.genreBtnActive : styles.genreBtn} onClick={() => setGenre("garcons")}>Garçons</button>
        </div>
        <div style={styles.ongletSwitch}>
          <button style={onglet === "referentiel" ? styles.ongletBtnActive : styles.ongletBtn} onClick={() => setOnglet("referentiel")}>Référentiel</button>
          <button style={onglet === "calculateur" ? styles.ongletBtnActive : styles.ongletBtn} onClick={() => setOnglet("calculateur")}>Calculateur de note</button>
          {mode === "prof" && (
            <button style={onglet === "historique" ? styles.ongletBtnActive : styles.ongletBtn} onClick={() => setOnglet("historique")}>Élèves & Accès</button>
          )}
        </div>
      </div>

      {onglet === "referentiel" && (
        <div style={styles.grid}>
          {LETTRES.map((lettre) => (
            <div key={lettre} style={styles.colonne}>
              <div style={styles.colHeader}>
                <span style={styles.colLettre}>{lettre}</span>
                <span style={styles.colValeur}>{VALEURS[lettre].toFixed(2)} pt</span>
              </div>
              <button style={styles.ficheBtn} onClick={() => setFicheOuverte(lettre)}>📄 Fiche officielle (croquis)</button>
              {data[lettre].map((el) => {
                const key = elementKey(genre, lettre, el.n);
                const v = videos[key] || { demo: "", phases: [] };
                return (
                  <div key={key} style={styles.card}>
                    <div style={styles.cardTop}>
                      <span style={styles.cardNum}>{el.n}</span>
                      <span style={styles.cardCat}>{el.cat}</span>
                    </div>
                    <img
                      src={`/croquis/${genre}-${lettre}-${el.n}.jpg`}
                      alt={`Croquis ${genre} ${lettre}${el.n}`}
                      style={styles.cardCroquis}
                      loading="lazy"
                    />
                    <p style={styles.cardTexte}>{el.texte}</p>
                    {el.precisions && <p style={styles.cardPrecisions}>⚠ {el.precisions}</p>}

                    {v.demo && (
                      <a href={v.demo} target="_blank" rel="noreferrer" style={styles.videoLink}>▶ Voir la vidéo de démonstration</a>
                    )}
                    {v.phases && v.phases.length > 0 && (
                      <div style={styles.phasesList}>
                        {v.phases.map((p, i) => (
                          <a key={i} href={p} target="_blank" rel="noreferrer" style={styles.videoLinkSmall}>▶ Phase d'apprentissage {i + 1}</a>
                        ))}
                      </div>
                    )}

                    {mode === "prof" && (
                      <button style={styles.editBtn} onClick={() => setEditingVideo(key)}>
                        {v.demo || (v.phases && v.phases.length) ? "Gérer les vidéos" : "+ Ajouter une vidéo"}
                      </button>
                    )}

                    {editingVideo === key && (
                      <div style={styles.editPanel}>
                        <label style={styles.editLabel}>Vidéo de démonstration</label>
                        <input style={styles.editInput} defaultValue={v.demo} placeholder="https://..." onBlur={(e) => saveVideo(key, "demo", e.target.value)} />
                        <div style={styles.uploadRow}>
                          <label style={styles.uploadLabel}>
                            📹 Choisir un fichier vidéo
                            <input
                              type="file"
                              accept="video/*"
                              style={styles.uploadInputHidden}
                              onChange={(e) => handleFileUpload(key, "demo", e.target.files[0])}
                            />
                          </label>
                          {uploading[`${key}|demo`] !== undefined && (
                            <span style={styles.progressText}>Envoi... {uploading[`${key}|demo`]}%</span>
                          )}
                        </div>

                        <label style={styles.editLabel}>Vidéos d'apprentissage par phases</label>
                        {(v.phases || []).map((p, i) => (
                          <div key={i}>
                            <div style={styles.phaseRow}>
                              <input style={styles.editInput} defaultValue={p} placeholder="https://..." onBlur={(e) => saveVideo(key, "phases", e.target.value, i)} />
                              <button style={styles.removeBtn} onClick={() => removePhase(key, i)}>✕</button>
                            </div>
                            <div style={styles.uploadRow}>
                              <label style={styles.uploadLabel}>
                                📹 Remplacer le fichier
                                <input
                                  type="file"
                                  accept="video/*"
                                  style={styles.uploadInputHidden}
                                  onChange={(e) => handleFileUpload(key, "phase", e.target.files[0], i)}
                                />
                              </label>
                              {uploading[`${key}|phase-${i}`] !== undefined && (
                                <span style={styles.progressText}>Envoi... {uploading[`${key}|phase-${i}`]}%</span>
                              )}
                            </div>
                          </div>
                        ))}
                        <div style={styles.uploadRow}>
                          <button style={styles.addPhaseBtn} onClick={() => saveVideo(key, "phases", "")}>+ Ajouter une phase (URL)</button>
                          <label style={styles.uploadLabel}>
                            📹 Ajouter une phase (fichier)
                            <input
                              type="file"
                              accept="video/*"
                              style={styles.uploadInputHidden}
                              onChange={(e) => handleFileUpload(key, "phase", e.target.files[0])}
                            />
                          </label>
                          {uploading[`${key}|phase`] !== undefined && (
                            <span style={styles.progressText}>Envoi... {uploading[`${key}|phase`]}%</span>
                          )}
                        </div>
                        <button style={styles.doneBtn} onClick={() => setEditingVideo(null)}>Terminé</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {onglet === "calculateur" && (
        <div style={styles.calcWrap}>
          <p style={styles.calcHint}>Sélectionne les éléments réalisés dans l'enchaînement (les 8 meilleurs seront comptés automatiquement), puis coche les exigences de composition remplies.</p>

          <div style={styles.enregistrerBox}>
            <label style={styles.editLabel}>Classe</label>
            <select style={styles.idSelect} value={classeSaisie} onChange={(e) => choisirClasseSaisie(e.target.value)}>
              <option value="" disabled>Sélectionne la classe...</option>
              {classesSaisie.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {classesSaisie.length === 0 && <p style={styles.calcHint}>Aucune classe importée pour l'instant (onglet Élèves & Accès).</p>}
            {classeSaisie && (
              <>
                <label style={styles.editLabel}>{mode === "eleve" ? "C'est moi :" : "Élève évalué"}</label>
                <select style={styles.idSelect} value={numeroSaisi} onChange={(e) => choisirEleveSaisi(e.target.value)}>
                  <option value="" disabled>{mode === "eleve" ? "Sélectionne ton nom..." : "Sélectionne l'élève..."}</option>
                  {rosterSaisie.map((el) => <option key={el.numero} value={el.numero}>{el.prenom} {el.nom}</option>)}
                </select>
              </>
            )}
            {brouillonInfo && <p style={{ fontSize: 12, color: "#6B7A5E", marginTop: 6 }}>{brouillonInfo}</p>}
            {mode === "eleve" && numeroSaisi && (
              <>
                <button style={styles.doneBtn} onClick={enregistrerBrouillon}>Enregistrer ma composition</button>
                {messageBrouillon && <div style={styles.pinSucces}>{messageBrouillon}</div>}
              </>
            )}
          </div>

          <div style={styles.grid}>
            {LETTRES.map((lettre) => (
              <div key={lettre} style={styles.colonne}>
                <div style={styles.colHeader}>
                  <span style={styles.colLettre}>{lettre}</span>
                  <span style={styles.colValeur}>{VALEURS[lettre].toFixed(2)} pt</span>
                </div>
                {data[lettre].map((el) => {
                  const key = elementKey(genre, lettre, el.n);
                  const checked = !!selection[key];
                  return (
                    <label key={key} style={{ ...styles.card, ...(checked ? styles.cardChecked : {}) }}>
                      <div style={styles.cardTop}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(key)} />
                        <span style={styles.cardNum}>{el.n}</span>
                        <span style={styles.cardCat}>{el.cat}</span>
                      </div>
                      <p style={styles.cardTexteSm}>{el.texte}</p>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={styles.exigencesBox}>
            <h3 style={styles.boxTitle}>Exigences de composition (0,5 pt chacune)</h3>
            {exigences.map((ex) => (
              <label key={ex.code} style={styles.exigenceRow}>
                <input type="checkbox" checked={!!exigencesCochees[ex.code]} onChange={() => toggleExigence(ex.code)} />
                <span style={styles.exigenceCode}>{ex.code}</span>
                <span>{ex.label}</span>
              </label>
            ))}
            <div style={styles.verrouBox}>
              <h4 style={styles.verrouTitle}>Verrou des points de composition</h4>
              <p style={styles.pinInfo}>Les points d'exigences ci-dessus ne sont accordés que si les 3 conditions suivantes sont réunies :</p>
              <label style={styles.exigenceRow}>
                <input type="checkbox" checked={verrouComposition.rotation} onChange={() => toggleVerrouComposition("rotation")} />
                <span>Une rotation arrière réalisée</span>
              </label>
              <label style={styles.exigenceRow}>
                <input type="checkbox" checked={verrouComposition.atr} onChange={() => toggleVerrouComposition("atr")} />
                <span>Un ATR réalisé</span>
              </label>
              <label style={styles.exigenceRow}>
                <input type="checkbox" checked={verrouComposition.changements} onChange={() => toggleVerrouComposition("changements")} />
                <span>2 changements de direction réalisés</span>
              </label>
              {!noteD.verrouOk && (
                <div style={styles.pinErreur}>Verrou non validé : 0 pt d'exigences tant que les 3 conditions ne sont pas toutes cochées.</div>
              )}
            </div>
          </div>

          <div style={styles.resultBox}>
            <h3 style={styles.boxTitle}>Note D — Difficultés et exigences</h3>
            <div style={styles.resultRow}>
              <span>Éléments retenus ({Math.min(elementsChoisis.length, 8)}/8 max)</span>
              <span>{noteD.difficultes.toFixed(2)} pts</span>
            </div>
            <div style={styles.resultRow}>
              <span>Exigences de composition</span>
              <span>{noteD.exigencesPts.toFixed(2)} pts</span>
            </div>
            {noteD.penaliteCourt > 0 && (
              <div style={{ ...styles.resultRow, color: "#B8443D" }}>
                <span>Pénalité enchaînement trop court (≤ 5 éléments)</span>
                <span>-{noteD.penaliteCourt.toFixed(2)} pts</span>
              </div>
            )}
            <div style={styles.resultTotal}>
              <span>Note D</span>
              <span>{noteD.total.toFixed(2)} / 10</span>
            </div>

            <h3 style={{ ...styles.boxTitle, marginTop: 20 }}>Note E — Exécution (grille de fautes)</h3>
            <div style={styles.fautesGrille}>
              {fautesActives.map((f) => (
                <div key={f.id} style={styles.fauteRow}>
                  <span style={styles.fauteLabel}>{f.label}</span>
                  <div style={styles.fauteOptions}>
                    {f.options.map((opt) => {
                      const valeur = typeof opt === "object" ? opt.value : opt;
                      const libelle = typeof opt === "object" ? opt.label : valeur === 0 ? "Aucune" : valeur.toFixed(2);
                      const actif = (fautesSimples[f.id] || 0) === valeur;
                      return (
                        <button
                          key={valeur}
                          style={actif ? styles.fauteBtnActive : styles.fauteBtn}
                          onClick={() => definirFauteSimple(f.id, valeur)}
                        >
                          {libelle}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {FAUTES_REPETABLES.map((f) => {
                const count = fautesRepetables[f.id] || 0;
                const total = f.max ? Math.min(count * f.unite, f.max) : count * f.unite;
                return (
                  <div key={f.id} style={styles.fauteRow}>
                    <span style={styles.fauteLabel}>
                      {f.label} <span style={styles.fauteUnite}>(-{f.unite.toFixed(2)} chacune{f.max ? `, max -${f.max.toFixed(2)}` : ""})</span>
                    </span>
                    <div style={styles.fauteStepper}>
                      <button style={styles.fauteStepBtn} onClick={() => changerFauteRepetable(f.id, -1, f.max, f.unite)}>−</button>
                      <span style={styles.fauteCount}>{count}</span>
                      <button style={styles.fauteStepBtn} onClick={() => changerFauteRepetable(f.id, 1, f.max, f.unite)}>+</button>
                      {total > 0 && <span style={styles.fauteUnite}>−{total.toFixed(2)}</span>}
                    </div>
                  </div>
                );
              })}
              {fautesPerso.map((f) => {
                const valeurActuelle = fautesSimples[f.id] || 0;
                const actif = valeurActuelle === f.valeur;
                return (
                  <div key={f.id} style={styles.fauteRow}>
                    <span style={styles.fauteLabel}>
                      {f.label} <span style={styles.fauteUnite}>(perso, -{f.valeur.toFixed(2)})</span>
                    </span>
                    <div style={styles.fauteOptions}>
                      <button
                        style={valeurActuelle === 0 ? styles.fauteBtnActive : styles.fauteBtn}
                        onClick={() => definirFauteSimple(f.id, 0)}
                      >
                        Aucune
                      </button>
                      <button
                        style={actif ? styles.fauteBtnActive : styles.fauteBtn}
                        onClick={() => definirFauteSimple(f.id, f.valeur)}
                      >
                        {f.valeur.toFixed(2)}
                      </button>
                      {mode === "prof" && (
                        <button style={styles.removeBtn} onClick={() => supprimerFautePerso(f.id)}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {mode === "prof" && (
              <div style={styles.fautePersoForm}>
                <label style={styles.editLabel}>Ajouter une faute d'exécution personnalisée</label>
                <div style={styles.fautePersoFormRow}>
                  <input
                    style={styles.editInput}
                    value={nouvelleFautePersoLabel}
                    onChange={(e) => { setNouvelleFautePersoLabel(e.target.value); setFautePersoErreur(""); }}
                    placeholder="Ex : mâche un chewing-gum"
                  />
                  <input
                    style={styles.fautePersoValeurInput}
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={nouvelleFautePersoValeur}
                    onChange={(e) => { setNouvelleFautePersoValeur(e.target.value); setFautePersoErreur(""); }}
                    placeholder="Valeur"
                  />
                  <button style={styles.doneBtn} onClick={ajouterFautePerso}>+ Ajouter</button>
                </div>
                {fautePersoErreur && <div style={styles.pinErreur}>{fautePersoErreur}</div>}
              </div>
            )}

            <div style={styles.resultRow}>
              <span>Total des pénalités Note E</span>
              <span>−{penaliteETotal.toFixed(2)} pts</span>
            </div>
            <div style={styles.resultTotal}>
              <span>Note E</span>
              <span>{noteE.toFixed(2)} / 10</span>
            </div>
            <button style={styles.addPhaseBtn} onClick={reinitialiserEvaluation}>↺ Réinitialiser pour un nouvel élève</button>

            <div style={styles.inputRow}>
              <span>Autres pénalités (durée, sortie, comportement...)</span>
              <input style={styles.smallInput} type="number" step="0.1" value={penalites} onChange={(e) => setPenalites(e.target.value)} placeholder="0.0" />
            </div>

            <div style={styles.finalTotal}>
              <span>Note finale</span>
              <span>{noteFinale.toFixed(2)} / 20</span>
            </div>

            {mode === "eleve" && (
              <div style={{ ...styles.ensCard, marginTop: 14, borderColor: "#D8D3C4" }}>
                <p style={{ fontSize: 12, fontWeight: "bold", color: "#6B7A5E", marginBottom: 6 }}>APERÇU — ÉVALUATION ENTRE ÉLÈVES</p>
                <p style={{ fontSize: 12, color: "#9A9484", marginBottom: 10 }}>Un(e) ami(e) peut coter les critères d'exécution ci-dessus pour te donner un aperçu. Cette note n'est pas officielle : seul(e) ton/ta professeur(e) enregistre la note finale, le jour de ton passage.</p>
                {pointsCorrection.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#9A9484" }}>Aucune faute d'exécution cochée pour l'instant.</p>
                ) : (
                  <>
                    <p style={{ fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>Points de correction :</p>
                    {pointsCorrection.map((p, i) => (
                      <div key={i} style={{ ...styles.resultRow, fontSize: 13 }}>
                        <span>{p.label}</span>
                        <span>−{p.valeur.toFixed(2)}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {mode === "prof" && (
              <div style={styles.enregistrerBox}>
                {!numeroSaisi && <p style={styles.calcHint}>Sélectionne la classe et l'élève en haut de page avant d'enregistrer.</p>}
                <button style={styles.doneBtn} onClick={enregistrerEssai}>Enregistrer cette note</button>
                {messageEnregistrement && <div style={styles.pinSucces}>{messageEnregistrement}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {onglet === "historique" && mode === "prof" && (
        <div style={styles.historiqueWrap}>
          <div style={styles.ensTabs}>
            <button style={vueEnseignant === "mes-classes" ? styles.ensTabActive : styles.ensTab} onClick={() => { setVueEnseignant("mes-classes"); setClasseOuverteEns(null); }}>Mes classes</button>
            {estAdmin && <button style={vueEnseignant === "globale" ? styles.ensTabActive : styles.ensTab} onClick={() => { setVueEnseignant("globale"); setClasseOuverteEns(null); }}>Vue globale</button>}
            {estAdmin && <button style={vueEnseignant === "acces" ? styles.ensTabActive : styles.ensTab} onClick={() => setVueEnseignant("acces")}>Accès</button>}
          </div>

          {vueEnseignant === "globale" && (
            <select style={{ ...styles.idSelect, maxWidth: 320 }} value={collegueVu} onChange={(e) => setCollegueVu(e.target.value)}>
              <option value="" disabled>Choisir un collègue...</option>
              {(acces.collegues || []).map((c) => <option key={c.nom} value={c.nom}>{c.nom}</option>)}
            </select>
          )}

          {vueEnseignant === "acces" && (
            <div>
              <div style={styles.ensCard}>
                <p style={{ fontSize: 12, fontWeight: "bold", color: "#6B7A5E", marginBottom: 8 }}>MON ACCÈS (ADMINISTRATEUR)</p>
                <AccesAdminBloc acces={acces} onSauver={async (next) => { await saveAcces(next); setAcces(next); }} />
              </div>
              <p style={{ fontSize: 12, fontWeight: "bold", color: "#6B7A5E", margin: "16px 0 6px" }}>COLLÈGUES AUTORISÉS</p>
              <p style={{ fontSize: 12, color: "#9A9484", marginBottom: 10 }}>Chacun a sa propre base (classes, élèves, notes), séparée de la tienne. Toi seul peux consulter l'espace d'un collègue, depuis "Vue globale". Le référentiel (vidéos) reste partagé par tous.</p>
              <AccesCollegues acces={acces} onSauver={async (next) => { await saveAcces(next); setAcces(next); }} />
            </div>
          )}

          {(vueEnseignant === "mes-classes" || (vueEnseignant === "globale" && collegueVu)) && (
            <>
              {!classeOuverteEns ? (
                <div>
                  <button style={styles.ensImportBtn} onClick={() => setImportOuvert(true)}>+ Importer une liste d'élèves</button>
                  {classesEns === null && <p style={styles.calcHint}>Chargement…</p>}
                  {classesEns && classesEns.length === 0 && <p style={styles.calcHint}>Aucune classe pour l'instant.</p>}
                  {classesEns && classesEns.map((c) => (
                    <button key={c} style={{ ...styles.ensClasseBtn, width: "100%", marginBottom: 8 }} onClick={() => ouvrirClasseEns(c)}>
                      <span>{c}</span><span style={{ color: "#9A9484" }}>→</span>
                    </button>
                  ))}
                  {importOuvert && (
                    <ImportEleves prof={profActifEns} onFermer={() => setImportOuvert(false)} onImporte={async () => { setImportOuvert(false); const cs = await loadClassesIndex(profActifEns); setClassesEns(cs); }} />
                  )}
                </div>
              ) : (
                <div>
                  <button style={styles.ensLink} onClick={() => setClasseOuverteEns(null)}>← Changer de classe</button>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0" }}>
                    <p style={{ fontSize: 13, fontWeight: "bold" }}>{classeOuverteEns} — {rosterEns.length} élève(s)</p>
                    <button style={styles.ensSmallBtnDanger} onClick={() => supprimerClasseEns(classeOuverteEns)}>Supprimer la classe</button>
                  </div>

                  <button style={styles.ensImportBtn} onClick={() => setAjoutEleveOuvert((v) => !v)}>+ Ajouter un élève</button>
                  {ajoutEleveOuvert && (
                    <div style={styles.ensCard}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input style={{ ...styles.ensInputSm, flex: 1 }} value={aPrenom} onChange={(e) => setAPrenom(e.target.value)} placeholder="Prénom" />
                        <input style={{ ...styles.ensInputSm, flex: 1 }} value={aNom} onChange={(e) => setANom(e.target.value)} placeholder="Nom" />
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <select style={styles.ensSelect} value={aSexe} onChange={(e) => setASexe(e.target.value)}>
                          <option value="">Sexe</option><option value="F">F</option><option value="M">M</option>
                        </select>
                        <button style={styles.ensSmallBtnAccent} onClick={ajouterEleveEns}>Ajouter</button>
                      </div>
                    </div>
                  )}

                  {rosterEns.map((eleve) => {
                    const entree = Object.entries(historique).find(([, d]) => d.classe === classeOuverteEns && d.numero === eleve.numero);
                    const id = entree ? entree[0] : null;
                    const donnees = entree ? entree[1] : null;
                    const essais = donnees?.essais || [];
                    const modeRetenu = donnees?.modeRetenu || "toutes";
                    const essaisRetenusIds = donnees?.essaisRetenusIds || [];
                    const noteRetenue = calculerNoteRetenue(essais, modeRetenu, essaisRetenusIds);
                    const ouvert = eleveOuvert === eleve.numero;
                    const enEdition = editionEleve === eleve.numero;
                    return (
                      <div key={eleve.numero} style={styles.eleveCard}>
                        <div style={styles.eleveHeaderRow} onClick={() => setEleveOuvert(ouvert ? null : eleve.numero)}>
                          <span style={styles.eleveNom}>{eleve.prenom} {eleve.nom}</span>
                          <span style={styles.eleveResume}>
                            {essais.length} essai{essais.length > 1 ? "s" : ""} · Note retenue : {noteRetenue !== null ? noteRetenue.toFixed(2) : "—"} / 20
                          </span>
                          <span>{ouvert ? "▲" : "▼"}</span>
                        </div>
                        {ouvert && (
                          <div style={styles.eleveDetail}>
                            {enEdition ? (
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                <input style={{ ...styles.ensInputSm, flex: 1 }} value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} placeholder="Prénom" />
                                <input style={{ ...styles.ensInputSm, flex: 1 }} value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom" />
                                <button style={styles.ensSmallBtnAccent} onClick={() => enregistrerEditionEleve(eleve.numero)}>OK</button>
                                <button style={styles.ensSmallBtn} onClick={() => setEditionEleve(null)}>Annuler</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                <button style={styles.ensSmallBtn} onClick={() => { setEditionEleve(eleve.numero); setEditPrenom(eleve.prenom); setEditNom(eleve.nom); }}>✎ Modifier</button>
                                <button style={styles.ensSmallBtnDanger} onClick={() => { if (confirm(`Retirer ${eleve.prenom} ${eleve.nom} de la classe ?`)) retirerEleveEns(eleve.numero); }}>Retirer de la classe</button>
                              </div>
                            )}
                            {essais.length === 0 ? (
                              <p style={styles.calcHint}>Aucune note enregistrée pour l'instant.</p>
                            ) : (
                              <>
                                <div style={styles.modeChoixRow}>
                                  <label><input type="radio" checked={modeRetenu === "toutes"} onChange={() => changerModeRetenu(id, "toutes")} /> Toutes (moyenne)</label>
                                  <label><input type="radio" checked={modeRetenu === "certaines"} onChange={() => changerModeRetenu(id, "certaines")} /> Certaines (moyenne des cochées)</label>
                                  <label><input type="radio" checked={modeRetenu === "derniere"} onChange={() => changerModeRetenu(id, "derniere")} /> Dernière seulement</label>
                                </div>
                                <table style={styles.essaisTable}>
                                  <tbody>
                                    {essais.map((essai) => (
                                      <tr key={essai.id} style={{ borderTop: "1px solid #EEE9DC" }}>
                                        {modeRetenu === "certaines" && (
                                          <td style={{ padding: "6px 8px" }}>
                                            <input type="checkbox" checked={essaisRetenusIds.includes(essai.id)} onChange={() => toggleEssaiRetenu(id, essai.id)} />
                                          </td>
                                        )}
                                        <td style={{ padding: "6px 8px" }}>{new Date(essai.date).toLocaleDateString("fr-FR")}</td>
                                        <td style={{ padding: "6px 8px" }}>{essai.genre === "filles" ? "Filles" : "Garçons"}</td>
                                        <td style={{ padding: "6px 8px" }}>D : {essai.noteD.toFixed(2)}</td>
                                        <td style={{ padding: "6px 8px" }}>E : {essai.noteE.toFixed(2)}</td>
                                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>Final : {essai.noteFinale.toFixed(2)}/20</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <footer style={styles.footer}>
        Gym Pro — By C. Guilhem — v{APP_VERSION}
        {estAdmin && mode === "prof" && (
          <>
            {" · "}
            <button style={styles.journalLink} onClick={() => setAfficherJournal(true)}>Journal des modifications</button>
          </>
        )}
      </footer>

      {estAdmin && mode === "prof" && afficherJournal && (
        <div style={styles.pinOverlay} onClick={() => setAfficherJournal(false)}>
          <div style={styles.journalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.journalHeader}>
              <h3 style={styles.boxTitle}>Journal des modifications</h3>
              <button style={styles.editBtn} onClick={() => setAfficherJournal(false)}>Fermer</button>
            </div>
            <pre style={styles.journalTexte}>{CHANGELOG}</pre>
          </div>
        </div>
      )}

      {ficheOuverte && (
        <div style={styles.pinOverlay} onClick={() => setFicheOuverte(null)}>
          <div style={styles.ficheBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.journalHeader}>
              <h3 style={styles.boxTitle}>
                Fiche officielle — {genre === "filles" ? "Filles" : "Garçons"} {ficheOuverte}
              </h3>
              <button style={styles.editBtn} onClick={() => setFicheOuverte(null)}>Fermer</button>
            </div>
            <img
              src={`/fiches/${genre}-${ficheOuverte}.jpg`}
              alt={`Fiche officielle ${genre} ${ficheOuverte}`}
              style={styles.ficheImage}
            />
            <div style={styles.ficheLiens}>
              <span style={styles.editLabel}>Vidéos correspondantes (par numéro sur la fiche)</span>
              {data[ficheOuverte].map((el) => {
                const key = elementKey(genre, ficheOuverte, el.n);
                const v = videos[key];
                return (
                  <div key={el.n} style={styles.ficheLienRow}>
                    <span style={styles.ficheLienNum}>{el.n}</span>
                    <span style={styles.ficheLienCat}>{el.cat}</span>
                    {v && v.demo ? (
                      <a href={v.demo} target="_blank" rel="noreferrer" style={styles.ficheLienBtn}>▶ Voir la vidéo</a>
                    ) : (
                      <span style={styles.ficheLienVide}>Pas de vidéo</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
