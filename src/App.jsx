import React, { useEffect, useRef, useState } from "react";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc,
} from "firebase/firestore";
import confetti from "canvas-confetti";
import { db } from "./firebase.js";
import {
  ZONES, FERIES_COMMUNS, PALIERS, palierPour,
  PHRASES_DEFAUT, DEVINETTES_DEFAUT, BLAGUES_DEFAUT,
} from "./donnees.js";
import {
  Settings, Share2, RefreshCw, Plus, Trash2, Pencil, X, Camera,
  Image as ImageIcon, Quote, HelpCircle, Smile, Calendar as CalendarIcon,
  Clock, User, ChevronLeft,
} from "lucide-react";

const APP_VERSION = "1.3.0";
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- Couleurs (mêmes variables CSS que index.html) ----------
const INK = "var(--ink)";
const MUTED = "var(--muted)";
const MUTED_SOFT = "var(--muted-soft)";
const LINE = "var(--line)";
const CARD = "var(--card)";
const PRIMARY = "var(--primary)";
const PRIMARY_SOFT = "var(--primary-soft)";
const ACCENT = "var(--accent)";
const ACCENT_SOFT = "var(--accent-soft)";

// ---------- Stockage local (réglages personnels : prénom, rythme, thème) ----------
const CLE_PROFIL = "vacances-jx-profil";
const CLE_THEME = "vacances-jx-theme";

function chargerProfil() {
  try {
    const brut = localStorage.getItem(CLE_PROFIL);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}
function sauverProfil(p) {
  try { localStorage.setItem(CLE_PROFIL, JSON.stringify(p)); } catch {}
}

// ---------- Dates ----------
function dateISOLocale(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function ajouterJoursISO(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return dateISOLocale(d);
}
function normaliserTexte(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function estDansVacances(edt, date) {
  const iso = dateISOLocale(date);
  return (edt?.vacances || []).find((v) => iso >= v.dateDebut && iso <= v.dateFin) || null;
}
function estJourFerie(edt, date) {
  const iso = dateISOLocale(date);
  return (edt?.feries || []).find((f) => f.date === iso) || null;
}
function trouverVacancesEte(edt) {
  const liste = edt?.vacances || [];
  if (liste.length === 0) return null;
  const parNom = liste.find((v) => normaliserTexte(v.nom).includes("ete"));
  if (parNom) return parNom;
  return [...liste].sort((a, b) => (a.dateDebut < b.dateDebut ? 1 : -1))[0];
}
function trouverProchainesVacances(edt, dateRef) {
  const iso = dateISOLocale(dateRef);
  const liste = (edt?.vacances || []).filter((v) => v.dateDebut > iso).sort((a, b) => (a.dateDebut > b.dateDebut ? 1 : -1));
  return liste[0] || null;
}
function joursCalendairesAvant(dateDebutISO, dateRefISO) {
  const debut = new Date(dateDebutISO + "T00:00:00");
  const ref = new Date(dateRefISO + "T00:00:00");
  return Math.max(Math.round((debut - ref) / 86400000) - 1, 0);
}
function joursOuvresStandardAvant(edt, dateDebutISO, dateRefISO) {
  let compte = 0;
  const cur = new Date(dateRefISO + "T00:00:00");
  cur.setDate(cur.getDate() + 1);
  const limite = new Date(dateDebutISO + "T00:00:00");
  while (cur < limite) {
    const js = cur.getDay();
    if (js !== 0 && js !== 6 && !estJourFerie(edt, cur) && !estDansVacances(edt, cur)) compte++;
    cur.setDate(cur.getDate() + 1);
  }
  return compte;
}
function periodePrecedente(edt, dateCibleISO) {
  const passees = (edt?.vacances || []).filter((v) => v.dateFin < dateCibleISO).sort((a, b) => (a.dateFin < b.dateFin ? 1 : -1));
  return passees[0] || null;
}
function choixStable(liste, seedStr) {
  if (!liste || liste.length === 0) return null;
  let h = 0;
  for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return liste[h % liste.length];
}

// ---------- Calcul d'un compteur (prochaines vacances ou vacances d'été) ----------
function calculerCompteur(edt, profil, cible, maintenant, aujourdhuiISO) {
  if (!cible) return null;
  const joursStd = joursOuvresStandardAvant(edt, cible.dateDebut, aujourdhuiISO);
  const ratioJours = profil.joursSemaine > 0 ? profil.joursSemaine / 5 : 1;
  const joursTravail = Math.max(Math.round(joursStd * ratioJours), 0);
  const joursTotal = joursCalendairesAvant(cible.dateDebut, aujourdhuiISO);
  const heuresParJour = profil.joursSemaine > 0 ? profil.heuresEffectives / profil.joursSemaine : 0;
  const heuresRestantes = Math.max(Math.round(joursTravail * heuresParJour), 0);

  const prec = periodePrecedente(edt, cible.dateDebut);
  const reference = prec ? ajouterJoursISO(prec.dateFin, 1) : (edt.rentree || aujourdhuiISO);
  const totalPeriode = Math.max(joursCalendairesAvant(cible.dateDebut, reference) + 1, 1);
  const ecoule = Math.max(joursCalendairesAvant(aujourdhuiISO, reference) + 1, 0);
  const progression = Math.min(100, Math.max(0, Math.round((ecoule / totalPeriode) * 100)));

  const cibleDate = new Date(cible.dateDebut + "T00:00:00");
  const diffMs = Math.max(cibleDate - maintenant, 0);
  const live = {
    j: Math.floor(diffMs / 86400000),
    h: Math.floor((diffMs % 86400000) / 3600000),
    m: Math.floor((diffMs % 3600000) / 60000),
    s: Math.floor((diffMs % 60000) / 1000),
  };
  const dodosRestants = Math.max(Math.round((cibleDate - new Date(aujourdhuiISO + "T00:00:00")) / 86400000), 0);
  return { nom: cible.nom, joursTravail, joursTotal, heuresRestantes, dodosRestants, progression, live };
}

// ---------- Seed Firestore (première ouverture : peuple les bibliothèques) ----------
async function seedCollection(nomCollection, items) {
  for (const item of items) {
    try { await addDoc(collection(db, nomCollection), item); } catch {}
  }
}

// ============================================================
// Écran 1 — Réglages initiaux (prénom, rythme de travail, zone)
// ============================================================
function EcranProfil({ onValider }) {
  const [prenom, setPrenom] = useState("");
  const [joursSemaine, setJoursSemaine] = useState(5);
  const [heuresEffectives, setHeuresEffectives] = useState(18);
  const [zone, setZone] = useState("C");

  const valide = prenom.trim().length > 0 && joursSemaine > 0 && heuresEffectives > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "linear-gradient(135deg, var(--primary), var(--accent))" }}>
      <div style={{ width: "100%", maxWidth: 380, background: CARD, borderRadius: 20, padding: 26, boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 24, color: INK, marginBottom: 4 }}>Vacances J-X</div>
        <div style={{ fontSize: 12.5, color: MUTED_SOFT, marginBottom: 22 }}>by C. Guilhem · v{APP_VERSION}</div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED_SOFT, marginBottom: 6 }}>Ton prénom</label>
        <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex : Sophie" style={champStyle} />

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED_SOFT, margin: "16px 0 6px" }}>Jours de travail par semaine</label>
        <input type="number" min={1} max={6} value={joursSemaine} onChange={(e) => setJoursSemaine(Number(e.target.value))} style={champStyle} />

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED_SOFT, margin: "16px 0 6px" }}>Heures effectives par semaine</label>
        <input type="number" min={1} step={0.5} value={heuresEffectives} onChange={(e) => setHeuresEffectives(Number(e.target.value))} style={champStyle} />

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: MUTED_SOFT, margin: "16px 0 6px" }}>Zone scolaire</label>
        <select value={zone} onChange={(e) => setZone(e.target.value)} style={champStyle}>
          <option value="A">Zone A</option>
          <option value="B">Zone B</option>
          <option value="C">Zone C</option>
        </select>

        <button
          disabled={!valide}
          onClick={() => onValider({ prenom: prenom.trim(), joursSemaine, heuresEffectives, zone })}
          style={{ width: "100%", marginTop: 22, padding: "13px 0", borderRadius: 12, border: "none", background: valide ? PRIMARY : LINE, color: "#fff", fontWeight: 800, fontSize: 15, cursor: valide ? "pointer" : "not-allowed" }}
        >
          C'est parti 🎉
        </button>
      </div>
    </div>
  );
}
const champStyle = { width: "100%", padding: "11px 12px", borderRadius: 10, border: `1.5px solid ${LINE}`, background: "var(--bg)", color: INK, fontSize: 14.5 };

function libelleTypeIntro(type) {
  return { phrase: "Phrase du jour", blague: "Blague surprise", devinette: "Devinette surprise", photo: "Photo souvenir" }[type];
}

// ============================================================
// Écran de chargement (attente des données Firestore)
// ============================================================
function EcranChargement() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, var(--primary), var(--accent))" }}>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Chargement…</div>
    </div>
  );
}

// ============================================================
// Écran d'ouverture — un élément surprise de la bibliothèque,
// tiré au sort à CHAQUE lancement, avant d'afficher les compteurs.
// ============================================================
function EcranIntro({ phrases, blagues, devinettes, photos, onContinuer }) {
  const [choix] = useState(() => {
    const dispo = [];
    if (phrases.length) dispo.push("phrase");
    if (blagues.length) dispo.push("blague");
    if (devinettes.length) dispo.push("devinette");
    if (photos.length) dispo.push("photo");
    if (dispo.length === 0) return null;
    const type = dispo[Math.floor(Math.random() * dispo.length)];
    if (type === "phrase") return { type, item: phrases[Math.floor(Math.random() * phrases.length)] };
    if (type === "blague") return { type, item: blagues[Math.floor(Math.random() * blagues.length)] };
    if (type === "devinette") return { type, item: devinettes[Math.floor(Math.random() * devinettes.length)] };
    return { type, item: photos[Math.floor(Math.random() * photos.length)] };
  });
  const [devinetteRevelee, setDevinetteRevelee] = useState(false);

  useEffect(() => {
    if (!choix) onContinuer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!choix) return <EcranChargement />;

  return (
    <div style={{ minHeight: "100vh", position: "relative", display: "flex", flexDirection: "column", background: "linear-gradient(160deg, var(--primary), var(--accent))", overflow: "hidden" }}>
      {choix.type === "photo" && (
        <>
          <img src={choix.item.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,0,0,0.15), rgba(0,0,0,0.6))" }} />
        </>
      )}
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: 14 }}>
          {libelleTypeIntro(choix.type)}
        </div>
        {choix.type === "phrase" && (
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 26, color: "#fff", lineHeight: 1.35 }}>{choix.item.texte}</div>
        )}
        {choix.type === "blague" && (
          <div style={{ fontSize: 18, color: "#fff", lineHeight: 1.5, maxWidth: 320 }}>{choix.item.texte}</div>
        )}
        {choix.type === "devinette" && (
          <>
            <div style={{ fontSize: 18, color: "#fff", lineHeight: 1.5, maxWidth: 320 }}>{choix.item.question}</div>
            {devinetteRevelee ? (
              <div style={{ marginTop: 16, fontSize: 16, color: "#FFE9A8", fontWeight: 700 }}>{choix.item.reponse}</div>
            ) : (
              <button onClick={() => setDevinetteRevelee(true)} style={{ marginTop: 18, padding: "10px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Voir la réponse
              </button>
            )}
          </>
        )}
        {choix.type === "photo" && choix.item.auteur && (
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", marginTop: 10 }}>Photo ajoutée par {choix.item.auteur}</div>
        )}
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "0 24px 34px" }}>
        <button onClick={onContinuer} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "#fff", color: PRIMARY, fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}>
          Voir mes compteurs →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Écran 2 — Accueil (gros compteurs plein écran)
// ============================================================
function EcranAccueil({ profil, edt, phrases, blagues, devinettes, photos, onOuvrirParametres }) {
  const [maintenant, setMaintenant] = useState(new Date());
  const [vueCompteur, setVueCompteur] = useState("prochaines");
  const [surprise, setSurprise] = useState(null); // { type, contenu, revele }
  const [fond, setFond] = useState(null);
  const confettiTire = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!fond && photos.length > 0) {
      setFond(photos[Math.floor(Math.random() * photos.length)]);
    }
  }, [photos, fond]);

  const aujourdhuiISO = dateISOLocale(maintenant);
  const vacancesActuelles = estDansVacances(edt, maintenant);
  const ferieAujourdhui = estJourFerie(edt, maintenant);
  const prochaines = trouverProchainesVacances(edt, maintenant);
  const ete = trouverVacancesEte(edt);
  const enVacancesEte = ete ? estDansVacances({ vacances: [ete] }, maintenant) : null;

  const compteurProchaines = !vacancesActuelles && prochaines ? calculerCompteur(edt, profil, prochaines, maintenant, aujourdhuiISO) : null;
  const compteurEte = ete && !enVacancesEte && ete.dateDebut > aujourdhuiISO ? calculerCompteur(edt, profil, ete, maintenant, aujourdhuiISO) : null;

  useEffect(() => {
    const premierJourVacances = vacancesActuelles && vacancesActuelles.dateDebut === aujourdhuiISO;
    if ((premierJourVacances || ferieAujourdhui) && !confettiTire.current) {
      confettiTire.current = true;
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.4 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enVacancesLa = vueCompteur === "prochaines" ? !!vacancesActuelles : !!enVacancesEte;
  const compteur = vueCompteur === "prochaines" ? compteurProchaines : compteurEte;
  const nomAffiche = vueCompteur === "prochaines"
    ? (vacancesActuelles ? vacancesActuelles.nom : compteurProchaines?.nom)
    : (enVacancesEte ? enVacancesEte.nom : compteurEte?.nom);

  const palier = palierPour(compteur ? compteur.joursTravail : 0, enVacancesLa);
  const phrase = choixStable((phrases || []).filter((p) => p.palier === palier).map((p) => p.texte), aujourdhuiISO + palier + vueCompteur) || "Bon courage, une journée de plus dans la boîte !";

  const piocherSurprise = (type) => {
    const source = type === "blague" ? blagues : devinettes;
    if (!source || source.length === 0) return;
    const item = source[Math.floor(Math.random() * source.length)];
    setSurprise({ type, item, revele: type === "blague" });
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "linear-gradient(160deg, var(--primary), var(--accent))" }}>
      {fond && (
        <>
          <img src={fond.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.32 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55))" }} />
        </>
      )}

      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", padding: "18px 18px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Salut {profil.prenom} 👋</div>
          <button onClick={onOuvrirParametres} style={{ width: 38, height: 38, borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Settings size={19} color="#fff" />
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
          {[["prochaines", "Prochaines vacances"], ["ete", "Vacances d'été"]].map(([v, label]) => (
            <button key={v} onClick={() => setVueCompteur(v)} style={{
              flex: 1, padding: "9px 4px", borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: "pointer",
              border: "1.5px solid rgba(255,255,255,0.5)",
              background: vueCompteur === v ? "#fff" : "rgba(255,255,255,0.12)",
              color: vueCompteur === v ? PRIMARY : "#fff",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          {enVacancesLa ? (
            <>
              <div style={{ fontSize: 46 }}>🎉</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 30, color: "#fff", marginTop: 6 }}>En vacances !</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5, marginTop: 10, maxWidth: 280 }}>{phrase}</div>
            </>
          ) : compteur ? (
            <>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{nomAffiche}</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 96, color: "#fff", lineHeight: 1, fontWeight: 600 }}>{compteur.joursTravail}</div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5, marginBottom: 14 }}>jour(s) de travail restant(s)</div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 6, color: "#fff", marginBottom: 14 }}>
                <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 700 }}>🛌 {compteur.dodosRestants}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>dodo{compteur.dodosRestants > 1 ? "s" : ""} restant{compteur.dodosRestants > 1 ? "s" : ""}</span>
              </div>

              <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>{compteur.joursTotal}</div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5 }}>jours au total</div>
                </div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>{compteur.heuresRestantes}h</div>
                  <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5 }}>de travail restantes</div>
                </div>
              </div>

              <div style={{ width: "100%", maxWidth: 300, height: 10, borderRadius: 6, background: "rgba(255,255,255,0.22)", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${compteur.progression}%`, height: "100%", background: "#fff", borderRadius: 6, transition: "width 0.4s" }} />
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, marginBottom: 16 }}>{compteur.progression}% de la période écoulée</div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: "monospace", marginBottom: 14 }}>
                <Clock size={15} />
                {compteur.live.j}j {String(compteur.live.h).padStart(2, "0")}h {String(compteur.live.m).padStart(2, "0")}m {String(compteur.live.s).padStart(2, "0")}s
              </div>

              <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontStyle: "italic", maxWidth: 290 }}>{phrase}</div>
            </>
          ) : (
            <div style={{ color: "#fff", fontSize: 14 }}>Aucune période renseignée pour l'instant.</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={() => piocherSurprise("blague")} style={boutonSurpriseStyle}>
            <Smile size={15} /> Blague surprise
          </button>
          <button onClick={() => piocherSurprise("devinette")} style={boutonSurpriseStyle}>
            <HelpCircle size={15} /> Devinette
          </button>
        </div>
      </div>

      {surprise && (
        <div onClick={() => setSurprise(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: CARD, borderRadius: 16, padding: 22, maxWidth: 340, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: PRIMARY, textTransform: "uppercase" }}>
                {surprise.type === "blague" ? "Blague" : "Devinette"}
              </div>
              <button onClick={() => setSurprise(null)} style={{ border: "none", background: "none", cursor: "pointer" }}><X size={18} color={MUTED_SOFT} /></button>
            </div>
            <div style={{ fontSize: 15, color: INK, lineHeight: 1.5 }}>
              {surprise.type === "blague" ? surprise.item.texte : surprise.item.question}
            </div>
            {surprise.type === "devinette" && (
              surprise.revele ? (
                <div style={{ marginTop: 12, fontSize: 14, color: PRIMARY, fontWeight: 700 }}>{surprise.item.reponse}</div>
              ) : (
                <button onClick={() => setSurprise({ ...surprise, revele: true })} style={{ marginTop: 14, padding: "9px 14px", borderRadius: 9, border: "none", background: PRIMARY, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Voir la réponse
                </button>
              )
            )}
            <button onClick={() => piocherSurprise(surprise.type)} style={{ marginTop: 14, marginLeft: surprise.type === "devinette" && !surprise.revele ? 8 : 0, padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${LINE}`, background: "none", color: MUTED_SOFT, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Une autre !
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
const boutonSurpriseStyle = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 0", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };

// ============================================================
// Écran 3 — Paramètres (roue crantée)
// ============================================================
function EcranParametres({ profil, setProfil, edt, phrases, blagues, devinettes, photos, theme, setTheme, onFermer }) {
  const [onglet, setOnglet] = useState("profil");
  const onglets = [
    ["profil", "Profil", User],
    ["calendrier", "Calendrier", CalendarIcon],
    ["phrases", "Phrases", Quote],
    ["blagues", "Blagues", Smile],
    ["devinettes", "Devinettes", HelpCircle],
    ["photos", "Photos", ImageIcon],
    ["partage", "Partager", Share2],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 10px" }}>
        <button onClick={onFermer} style={{ border: "none", background: "none", cursor: "pointer", display: "flex" }}><ChevronLeft size={22} color={INK} /></button>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 19, color: INK }}>Réglages</div>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 16px 14px" }}>
        {onglets.map(([id, label, Icone]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{
            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 10, cursor: "pointer",
            border: `1.5px solid ${onglet === id ? PRIMARY : LINE}`, background: onglet === id ? PRIMARY : CARD, color: onglet === id ? "#fff" : MUTED_SOFT, fontWeight: 700, fontSize: 12.5,
          }}>
            <Icone size={13} /> {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 40px" }}>
        {onglet === "profil" && <GestionProfil profil={profil} setProfil={setProfil} theme={theme} setTheme={setTheme} />}
        {onglet === "calendrier" && <GestionCalendrier edt={edt} />}
        {onglet === "phrases" && <GestionPhrases phrases={phrases} />}
        {onglet === "blagues" && <GestionBlagues blagues={blagues} />}
        {onglet === "devinettes" && <GestionDevinettes devinettes={devinettes} />}
        {onglet === "photos" && <GestionPhotos photos={photos} profil={profil} />}
        {onglet === "partage" && <GestionPartage />}
      </div>
    </div>
  );
}

// ---------- Profil ----------
function GestionProfil({ profil, setProfil, theme, setTheme }) {
  const [local, setLocal] = useState(profil);
  const modifie = JSON.stringify(local) !== JSON.stringify(profil);

  const enregistrer = () => {
    sauverProfil(local);
    setProfil(local);
  };

  return (
    <div>
      <label style={libelleStyle}>Prénom</label>
      <input value={local.prenom} onChange={(e) => setLocal({ ...local, prenom: e.target.value })} style={champStyle} />
      <label style={{ ...libelleStyle, marginTop: 14 }}>Jours de travail par semaine</label>
      <input type="number" min={1} max={6} value={local.joursSemaine} onChange={(e) => setLocal({ ...local, joursSemaine: Number(e.target.value) })} style={champStyle} />
      <label style={{ ...libelleStyle, marginTop: 14 }}>Heures effectives par semaine</label>
      <input type="number" min={1} step={0.5} value={local.heuresEffectives} onChange={(e) => setLocal({ ...local, heuresEffectives: Number(e.target.value) })} style={champStyle} />

      {modifie && (
        <button onClick={enregistrer} style={{ marginTop: 16, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: PRIMARY, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
          Enregistrer
        </button>
      )}

      <div style={{ marginTop: 26, marginBottom: 8, fontSize: 12, fontWeight: 700, color: MUTED_SOFT, textTransform: "uppercase" }}>Apparence</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[["auto", "Auto"], ["light", "Jour"], ["dark", "Nuit"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTheme(id); try { localStorage.setItem(CLE_THEME, id); } catch {} }} style={{
            flex: 1, padding: "9px 0", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 12.5,
            border: `1.5px solid ${theme === id ? PRIMARY : LINE}`, background: theme === id ? PRIMARY : CARD, color: theme === id ? "#fff" : MUTED_SOFT,
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}
const libelleStyle = { display: "block", fontSize: 12, fontWeight: 700, color: MUTED_SOFT, marginBottom: 6 };

// ---------- Calendrier ----------
function GestionCalendrier({ edt }) {
  const [formOuvert, setFormOuvert] = useState(null); // "vacances" | "ferie" | null
  const [nom, setNom] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [dateFerie, setDateFerie] = useState("");

  const refCal = doc(db, "config", "calendrier");

  const recharger = async (zone) => {
    if (!confirm(`Recharger les dates officielles de la zone ${zone} ? Cela remplace toutes les périodes actuelles.`)) return;
    await updateDoc(refCal, { zone, vacances: ZONES[zone].vacances, feries: FERIES_COMMUNS });
  };

  const ajouterVacances = async () => {
    if (!nom || !dateDebut || !dateFin) return;
    const nouvelle = [...(edt.vacances || []), { id: uid(), nom, dateDebut, dateFin }];
    await updateDoc(refCal, { vacances: nouvelle });
    setNom(""); setDateDebut(""); setDateFin(""); setFormOuvert(null);
  };
  const supprimerVacances = async (id) => {
    await updateDoc(refCal, { vacances: (edt.vacances || []).filter((v) => v.id !== id) });
  };
  const modifierVacances = async (id, champ, valeur) => {
    await updateDoc(refCal, { vacances: (edt.vacances || []).map((v) => (v.id === id ? { ...v, [champ]: valeur } : v)) });
  };

  const ajouterFerie = async () => {
    if (!nom || !dateFerie) return;
    const nouveau = [...(edt.feries || []), { id: uid(), nom, date: dateFerie }];
    await updateDoc(refCal, { feries: nouveau });
    setNom(""); setDateFerie(""); setFormOuvert(null);
  };
  const supprimerFerie = async (id) => {
    await updateDoc(refCal, { feries: (edt.feries || []).filter((f) => f.id !== id) });
  };

  return (
    <div>
      <div style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}`, borderRadius: 10, padding: 12, fontSize: 12, color: ACCENT, marginBottom: 18 }}>
        Dates valables pour l'année scolaire 2026-2027. L'an prochain : mets l'appli à jour puis reviens ici recharger la zone, ou corrige les dates toi-même ci-dessous.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: MUTED_SOFT, textTransform: "uppercase", marginBottom: 8 }}>Zone scolaire actuelle : {edt.zone}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {["A", "B", "C"].map((z) => (
          <button key={z} onClick={() => recharger(z)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${LINE}`, background: CARD, color: MUTED_SOFT, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            <RefreshCw size={12} /> Zone {z}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: MUTED_SOFT, textTransform: "uppercase" }}>Vacances</div>
        <button onClick={() => { setFormOuvert("vacances"); setNom(""); setDateDebut(""); setDateFin(""); }} style={lienAjoutStyle}><Plus size={13} /> Ajouter</button>
      </div>
      {(edt.vacances || []).sort((a, b) => (a.dateDebut > b.dateDebut ? 1 : -1)).map((v) => (
        <LigneVacances key={v.id} v={v} onModifier={modifierVacances} onSupprimer={() => supprimerVacances(v.id)} />
      ))}

      {formOuvert === "vacances" && (
        <div style={carteFormStyle}>
          <input placeholder="Nom (ex : Vacances de Noël)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={champStyle} />
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={champStyle} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={ajouterVacances} style={boutonValiderStyle}>Ajouter</button>
            <button onClick={() => setFormOuvert(null)} style={boutonAnnulerStyle}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "22px 0 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: MUTED_SOFT, textTransform: "uppercase" }}>Jours fériés</div>
        <button onClick={() => { setFormOuvert("ferie"); setNom(""); setDateFerie(""); }} style={lienAjoutStyle}><Plus size={13} /> Ajouter</button>
      </div>
      {(edt.feries || []).sort((a, b) => (a.date > b.date ? 1 : -1)).map((f) => (
        <div key={f.id} style={ligneStyle}>
          <div style={{ flex: 1, fontSize: 12.5, color: INK }}><b>{f.nom}</b> · {new Date(f.date).toLocaleDateString("fr-FR")}</div>
          <button onClick={() => supprimerFerie(f.id)} style={boutonIconeStyle}><Trash2 size={14} color={ACCENT} /></button>
        </div>
      ))}

      {formOuvert === "ferie" && (
        <div style={carteFormStyle}>
          <input placeholder="Nom (ex : Ascension)" value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
          <input type="date" value={dateFerie} onChange={(e) => setDateFerie(e.target.value)} style={{ ...champStyle, marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={ajouterFerie} style={boutonValiderStyle}>Ajouter</button>
            <button onClick={() => setFormOuvert(null)} style={boutonAnnulerStyle}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LigneVacances({ v, onModifier, onSupprimer }) {
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(v.nom);
  const [dateDebut, setDateDebut] = useState(v.dateDebut);
  const [dateFin, setDateFin] = useState(v.dateFin);

  if (!edition) {
    return (
      <div style={ligneStyle}>
        <div style={{ flex: 1, fontSize: 12.5, color: INK }}>
          <b>{v.nom}</b> · du {new Date(v.dateDebut).toLocaleDateString("fr-FR")} au {new Date(v.dateFin).toLocaleDateString("fr-FR")}
        </div>
        <button onClick={() => setEdition(true)} style={boutonIconeStyle}><Pencil size={14} color={MUTED_SOFT} /></button>
        <button onClick={onSupprimer} style={boutonIconeStyle}><Trash2 size={14} color={ACCENT} /></button>
      </div>
    );
  }
  return (
    <div style={carteFormStyle}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} style={champStyle} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} style={champStyle} />
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} style={champStyle} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => { onModifier(v.id, "nom", nom); onModifier(v.id, "dateDebut", dateDebut); onModifier(v.id, "dateFin", dateFin); setEdition(false); }} style={boutonValiderStyle}>Enregistrer</button>
        <button onClick={() => setEdition(false)} style={boutonAnnulerStyle}>Annuler</button>
      </div>
    </div>
  );
}

// ---------- Phrases punchy ----------
function GestionPhrases({ phrases }) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [palier, setPalier] = useState(PALIERS[0].id);

  const ajouter = async () => {
    if (!texte.trim()) return;
    await addDoc(collection(db, "phrases"), { texte: texte.trim(), palier, dateAjout: Date.now() });
    setTexte(""); setFormOuvert(false);
  };
  const supprimer = async (id) => deleteDoc(doc(db, "phrases", id));
  const modifier = async (id, nouveauTexte) => updateDoc(doc(db, "phrases", id), { texte: nouveauTexte });

  return (
    <div>
      <BoutonAjouter label="Ajouter une phrase" ouvert={formOuvert} setOuvert={setFormOuvert} />
      {formOuvert && (
        <div style={carteFormStyle}>
          <select value={palier} onChange={(e) => setPalier(e.target.value)} style={champStyle}>
            {PALIERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Ta phrase..." style={{ ...champStyle, marginTop: 8, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={ajouter} style={boutonValiderStyle}>Ajouter</button>
            <button onClick={() => setFormOuvert(false)} style={boutonAnnulerStyle}>Annuler</button>
          </div>
        </div>
      )}
      {PALIERS.map((p) => (
        <div key={p.id} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: PRIMARY, textTransform: "uppercase", marginBottom: 6 }}>{p.label}</div>
          {phrases.filter((ph) => ph.palier === p.id).map((ph) => (
            <LigneTexteEditable key={ph.id} texte={ph.texte} onModifier={(t) => modifier(ph.id, t)} onSupprimer={() => supprimer(ph.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Blagues ----------
function GestionBlagues({ blagues }) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [texte, setTexte] = useState("");

  const ajouter = async () => {
    if (!texte.trim()) return;
    await addDoc(collection(db, "blagues"), { texte: texte.trim(), dateAjout: Date.now() });
    setTexte(""); setFormOuvert(false);
  };
  const supprimer = async (id) => deleteDoc(doc(db, "blagues", id));
  const modifier = async (id, nouveauTexte) => updateDoc(doc(db, "blagues", id), { texte: nouveauTexte });

  return (
    <div>
      <BoutonAjouter label="Ajouter une blague" ouvert={formOuvert} setOuvert={setFormOuvert} />
      {formOuvert && (
        <div style={carteFormStyle}>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} placeholder="Ta blague..." style={{ ...champStyle, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={ajouter} style={boutonValiderStyle}>Ajouter</button>
            <button onClick={() => setFormOuvert(false)} style={boutonAnnulerStyle}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {blagues.map((b) => (
          <LigneTexteEditable key={b.id} texte={b.texte} onModifier={(t) => modifier(b.id, t)} onSupprimer={() => supprimer(b.id)} />
        ))}
      </div>
    </div>
  );
}

// ---------- Devinettes ----------
function GestionDevinettes({ devinettes }) {
  const [formOuvert, setFormOuvert] = useState(false);
  const [question, setQuestion] = useState("");
  const [reponse, setReponse] = useState("");

  const ajouter = async () => {
    if (!question.trim() || !reponse.trim()) return;
    await addDoc(collection(db, "devinettes"), { question: question.trim(), reponse: reponse.trim(), dateAjout: Date.now() });
    setQuestion(""); setReponse(""); setFormOuvert(false);
  };
  const supprimer = async (id) => deleteDoc(doc(db, "devinettes", id));

  return (
    <div>
      <BoutonAjouter label="Ajouter une devinette" ouvert={formOuvert} setOuvert={setFormOuvert} />
      {formOuvert && (
        <div style={carteFormStyle}>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} placeholder="La question..." style={{ ...champStyle, resize: "vertical" }} />
          <input value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="La réponse..." style={{ ...champStyle, marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={ajouter} style={boutonValiderStyle}>Ajouter</button>
            <button onClick={() => setFormOuvert(false)} style={boutonAnnulerStyle}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        {devinettes.map((d) => (
          <div key={d.id} style={ligneStyle}>
            <div style={{ flex: 1, fontSize: 12.5, color: INK }}>{d.question} <span style={{ color: MUTED_SOFT }}>→ {d.reponse}</span></div>
            <button onClick={() => supprimer(d.id)} style={boutonIconeStyle}><Trash2 size={14} color={ACCENT} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LigneTexteEditable({ texte, onModifier, onSupprimer }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(texte);
  if (!edition) {
    return (
      <div style={ligneStyle}>
        <div style={{ flex: 1, fontSize: 12.5, color: INK }}>{texte}</div>
        <button onClick={() => setEdition(true)} style={boutonIconeStyle}><Pencil size={14} color={MUTED_SOFT} /></button>
        <button onClick={onSupprimer} style={boutonIconeStyle}><Trash2 size={14} color={ACCENT} /></button>
      </div>
    );
  }
  return (
    <div style={carteFormStyle}>
      <textarea value={valeur} onChange={(e) => setValeur(e.target.value)} rows={3} style={{ ...champStyle, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => { onModifier(valeur); setEdition(false); }} style={boutonValiderStyle}>Enregistrer</button>
        <button onClick={() => setEdition(false)} style={boutonAnnulerStyle}>Annuler</button>
      </div>
    </div>
  );
}

// ---------- Photos : compression côté appareil, stockage en base64 dans Firestore ----------
// Pas de Firebase Storage (qui exige le forfait payant Blaze) : chaque photo est
// redimensionnée et compressée en JPEG, puis enregistrée comme simple champ texte
// du document Firestore. Un document Firestore est limité à 1 Mo : on vise donc
// une marge confortable en dessous (700 Ko), quitte à réduire encore la qualité.
const LIMITE_OCTETS_PHOTO = 700 * 1024;
const PALIERS_COMPRESSION = [
  [1000, 0.8], [1000, 0.6], [800, 0.6], [800, 0.45], [600, 0.4], [500, 0.35],
];
function tailleApproxDataUrl(dataUrl) {
  return Math.round((dataUrl.length * 3) / 4);
}
function comprimerImage(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        for (const [maxDim, qualite] of PALIERS_COMPRESSION) {
          const ratio = Math.min(1, maxDim / Math.max(image.width, image.height));
          const largeur = Math.max(1, Math.round(image.width * ratio));
          const hauteur = Math.max(1, Math.round(image.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = largeur;
          canvas.height = hauteur;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0, largeur, hauteur);
          const dataUrlCompresse = canvas.toDataURL("image/jpeg", qualite);
          if (tailleApproxDataUrl(dataUrlCompresse) <= LIMITE_OCTETS_PHOTO) {
            resolve(dataUrlCompresse);
            return;
          }
        }
        reject(new Error("trop-lourd"));
      };
      image.onerror = () => reject(new Error("image-invalide"));
      image.src = lecteur.result;
    };
    lecteur.onerror = () => reject(new Error("lecture-echouee"));
    lecteur.readAsDataURL(fichier);
  });
}

function GestionPhotos({ photos, profil }) {
  const inputGalerie = useRef(null);
  const inputCamera = useRef(null);
  const [enCours, setEnCours] = useState(false);

  const televerser = async (fichier) => {
    if (!fichier) return;
    setEnCours(true);
    try {
      const url = await comprimerImage(fichier);
      await addDoc(collection(db, "photos"), { url, auteur: profil.prenom, dateAjout: Date.now() });
    } catch (e) {
      if (e && e.message === "trop-lourd") alert("Cette photo est trop lourde même après compression. Essaie une autre photo.");
      else alert("Échec de l'ajout de la photo. Réessaie.");
    }
    setEnCours(false);
  };

  const supprimer = async (photo) => {
    if (!confirm("Supprimer cette photo pour tout le monde ?")) return;
    await deleteDoc(doc(db, "photos", photo.id));
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => inputGalerie.current?.click()} style={boutonSecondaireStyle}><ImageIcon size={14} /> Galerie</button>
        <button onClick={() => inputCamera.current?.click()} style={boutonSecondaireStyle}><Camera size={14} /> Appareil photo</button>
      </div>
      <input ref={inputGalerie} type="file" accept="image/*" hidden onChange={(e) => televerser(e.target.files?.[0])} />
      <input ref={inputCamera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => televerser(e.target.files?.[0])} />
      {enCours && <div style={{ fontSize: 12.5, color: MUTED_SOFT, marginBottom: 10 }}>Compression et envoi en cours…</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
        {photos.map((p) => (
          <div key={p.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1 / 1", border: `1px solid ${LINE}` }}>
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => supprimer(p)} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 7, border: "none", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <Trash2 size={12} color="#fff" />
            </button>
          </div>
        ))}
      </div>
      {photos.length === 0 && <div style={{ fontSize: 12.5, color: MUTED_SOFT }}>Aucune photo pour l'instant.</div>}
    </div>
  );
}

// ---------- Partage ----------
function GestionPartage() {
  const lien = typeof window !== "undefined" ? window.location.origin : "";
  const [copie, setCopie] = useState(false);

  const partager = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Vacances J-X", url: lien }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(lien);
        setCopie(true);
        setTimeout(() => setCopie(false), 2000);
      } catch {}
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>Partage le lien de l'appli avec tes collègues pour qu'ils profitent des compteurs et alimentent la bibliothèque commune.</div>
      <button onClick={partager} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: PRIMARY, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        <Share2 size={16} /> {copie ? "Lien copié !" : "Partager l'appli"}
      </button>
    </div>
  );
}

// ---------- Petits composants réutilisables ----------
function BoutonAjouter({ label, ouvert, setOuvert }) {
  return (
    <button onClick={() => setOuvert(!ouvert)} style={lienAjoutStyle}>
      {ouvert ? <X size={13} /> : <Plus size={13} />} {label}
    </button>
  );
}
const lienAjoutStyle = { display: "flex", alignItems: "center", gap: 5, border: "none", background: "none", color: PRIMARY, fontWeight: 700, fontSize: 12.5, cursor: "pointer", marginBottom: 10 };
const ligneStyle = { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 9, marginBottom: 6, background: CARD };
const boutonIconeStyle = { border: "none", background: "none", cursor: "pointer", display: "flex" };
const carteFormStyle = { border: `1.5px dashed ${PRIMARY}`, background: PRIMARY_SOFT, borderRadius: 12, padding: 12, marginBottom: 12 };
const boutonValiderStyle = { flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: PRIMARY, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const boutonAnnulerStyle = { flex: 1, padding: "9px 0", borderRadius: 9, border: `1.5px solid ${LINE}`, background: "none", color: MUTED_SOFT, fontWeight: 700, fontSize: 12.5, cursor: "pointer" };
const boutonSecondaireStyle = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${LINE}`, background: CARD, color: INK, fontWeight: 700, fontSize: 12.5, cursor: "pointer" };

// ============================================================
// App — routage, thème, abonnements Firestore
// ============================================================
export default function App() {
  const [profil, setProfil] = useState(() => chargerProfil());
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem(CLE_THEME) || "auto"; } catch { return "auto"; } });
  const [edt, setEdt] = useState(null);
  const [phrases, setPhrases] = useState([]);
  const [blagues, setBlagues] = useState([]);
  const [devinettes, setDevinettes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [vue, setVue] = useState("intro");
  const [introPret, setIntroPret] = useState(false);
  const seedFait = useRef({ phrases: false, blagues: false, devinettes: false });
  const contenuCharge = phrases.length > 0 || blagues.length > 0 || devinettes.length > 0 || photos.length > 0;

  useEffect(() => {
    if (vue !== "intro" || introPret) return;
    if (contenuCharge) { setIntroPret(true); return; }
    // Si rien n'a pu être chargé après un délai raisonnable (connexion lente/coupée),
    // on ne bloque pas l'accès aux compteurs.
    const t = setTimeout(() => setVue("accueil"), 4000);
    return () => clearTimeout(t);
  }, [vue, introPret, contenuCharge]);

  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const refCal = doc(db, "config", "calendrier");
    const unsubCal = onSnapshot(refCal, async (snap) => {
      if (snap.exists()) setEdt(snap.data());
      else {
        const donnees = { zone: "C", vacances: ZONES.C.vacances, feries: FERIES_COMMUNS, rentree: "2026-09-01" };
        try { await setDoc(refCal, donnees); } catch {}
      }
    });

    const unsubPhrases = onSnapshot(collection(db, "phrases"), (snap) => {
      setPhrases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (snap.empty && !seedFait.current.phrases) {
        seedFait.current.phrases = true;
        seedCollection("phrases", PHRASES_DEFAUT.map(([palier, texte]) => ({ palier, texte, auteur: "Christophe", dateAjout: Date.now() })));
      }
    });
    const unsubBlagues = onSnapshot(collection(db, "blagues"), (snap) => {
      setBlagues(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (snap.empty && !seedFait.current.blagues) {
        seedFait.current.blagues = true;
        seedCollection("blagues", BLAGUES_DEFAUT.map((texte) => ({ texte, auteur: "Christophe", dateAjout: Date.now() })));
      }
    });
    const unsubDevinettes = onSnapshot(collection(db, "devinettes"), (snap) => {
      setDevinettes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (snap.empty && !seedFait.current.devinettes) {
        seedFait.current.devinettes = true;
        seedCollection("devinettes", DEVINETTES_DEFAUT.map(([question, reponse]) => ({ question, reponse, auteur: "Christophe", dateAjout: Date.now() })));
      }
    });
    const unsubPhotos = onSnapshot(collection(db, "photos"), (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubCal(); unsubPhrases(); unsubBlagues(); unsubDevinettes(); unsubPhotos(); };
  }, []);

  if (!profil) {
    return <EcranProfil onValider={(p) => { sauverProfil(p); setProfil(p); }} />;
  }
  if (!edt) {
    return <EcranChargement />;
  }

  if (vue === "intro") {
    if (!introPret) return <EcranChargement />;
    return <EcranIntro phrases={phrases} blagues={blagues} devinettes={devinettes} photos={photos} onContinuer={() => setVue("accueil")} />;
  }

  return vue === "accueil" ? (
    <EcranAccueil profil={profil} edt={edt} phrases={phrases} blagues={blagues} devinettes={devinettes} photos={photos} onOuvrirParametres={() => setVue("parametres")} />
  ) : (
    <EcranParametres profil={profil} setProfil={setProfil} edt={edt} phrases={phrases} blagues={blagues} devinettes={devinettes} photos={photos} theme={theme} setTheme={setTheme} onFermer={() => setVue("accueil")} />
  );
}
