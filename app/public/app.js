import {
  CHEMIN_ACCUEIL,
  CHEMIN_CONNEXION,
  CHEMIN_CONNEXION_STEAM,
  CHEMIN_REGLAGES,
  ERREUR_CONNEXION_STEAM,
} from "/chemins.js";
import { LANGUES, proposerLangue } from "/langues.js";
import { PAYS, proposerPays } from "/pays.js";
import { preparerMesSuivis } from "/mes-suivis.js";
import { chargerLangue, poserTexte, texte } from "/textes.js";

const elementParId = (id) => document.getElementById(id);

// Écrans de la page, chacun repéré par l'identifiant de sa section.
const ECRANS = {
  connexion: "ecran-connexion",
  accueil: "ecran-accueil",
  reglages: "ecran-reglages",
};

// L'écran Réglages sert aussi à la première connexion, pour confirmer les choix proposés.
const MODES_REGLAGES = {
  premiereConnexion: { titre: "choix.titre", bouton: "choix.confirmer", explication: true, retour: false },
  reglages: { titre: "reglages.titre", bouton: "reglages.enregistrer", explication: false, retour: true },
};

elementParId("lien-connexion-steam").href = CHEMIN_CONNEXION_STEAM;
elementParId("lien-reglages").href = CHEMIN_REGLAGES;
elementParId("retour-reglages").href = CHEMIN_ACCUEIL;

function afficher(ecran) {
  elementParId("chargement").hidden = true;
  for (const id of Object.values(ECRANS)) elementParId(id).hidden = id !== ecran;
}

function afficherConnexion() {
  const parametres = new URLSearchParams(location.search);
  elementParId("erreur-connexion").hidden = parametres.get("erreur") !== ERREUR_CONNEXION_STEAM;
  afficher(ECRANS.connexion);
}

function afficherAccueil({ steamId, nom, avatar }) {
  elementParId("nom").textContent = nom ?? steamId;
  if (avatar) {
    elementParId("avatar").src = avatar;
    elementParId("avatar").hidden = false;
  }
  afficher(ECRANS.accueil);
  preparerMesSuivis();
}

function option(valeur, libelle) {
  const element = document.createElement("option");
  element.value = valeur;
  element.textContent = libelle;
  return element;
}

// Noms des pays dans la langue de l'interface, triés alphabétiquement.
function remplirPays(langue, paysChoisi) {
  const noms = new Intl.DisplayNames([langue], { type: "region" });
  const tri = new Intl.Collator(langue);
  const pays = PAYS.map((code) => ({ code, nom: noms.of(code) })).sort((a, b) => tri.compare(a.nom, b.nom));

  const aChoisir = option("", texte("champ.paysAChoisir"));
  aChoisir.disabled = true;
  elementParId("pays").replaceChildren(aChoisir, ...pays.map(({ code, nom }) => option(code, nom)));
  elementParId("pays").value = paysChoisi ?? "";
}

function afficherReglages(mode, { langue, pays }) {
  poserTexte(elementParId("titre-reglages"), mode.titre);
  poserTexte(elementParId("valider-reglages"), mode.bouton);
  elementParId("explication-choix").hidden = !mode.explication;
  elementParId("retour-reglages").hidden = !mode.retour;

  const choixLangue = elementParId("langue");
  choixLangue.replaceChildren(...Object.entries(LANGUES).map(([code, nom]) => option(code, nom)));
  choixLangue.value = langue;
  remplirPays(langue, pays);

  // L'interface passe tout de suite dans la langue choisie, pour aperçu.
  choixLangue.addEventListener("change", async () => {
    await chargerLangue(choixLangue.value);
    remplirPays(choixLangue.value, elementParId("pays").value || null);
  });

  elementParId("formulaire-reglages").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const message = elementParId("message-reglages");
    message.hidden = true;
    const reponse = await fetch("/api/reglages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ langue: choixLangue.value, pays: elementParId("pays").value }),
    }).catch(() => null);

    if (reponse?.ok && mode === MODES_REGLAGES.premiereConnexion) {
      location.replace(CHEMIN_ACCUEIL);
      return;
    }
    poserTexte(message, reponse?.ok ? "reglages.enregistres" : "reglages.erreur");
    message.className = reponse?.ok ? "" : "erreur";
    message.hidden = false;
  });

  afficher(ECRANS.reglages);
}

elementParId("deconnexion").addEventListener("click", async () => {
  await fetch("/api/deconnexion", { method: "POST" });
  location.replace(CHEMIN_CONNEXION);
});

// Avant de connaître l'utilisateur, l'interface suit la langue du navigateur.
const langueNavigateur = proposerLangue(navigator.languages);
await chargerLangue(langueNavigateur);

try {
  const reponse = await fetch("/api/moi");
  if (reponse.status === 401) {
    // Tout écran autre que Connexion est réservé aux utilisateurs connectés.
    if (location.pathname === CHEMIN_CONNEXION) afficherConnexion();
    else location.replace(CHEMIN_CONNEXION);
  } else if (!reponse.ok) {
    throw new Error(`HTTP ${reponse.status}`);
  } else {
    const moi = await reponse.json();
    if (moi.langue && moi.langue !== langueNavigateur) await chargerLangue(moi.langue);

    if (!moi.pays) {
      // Première connexion : langue et pays proposés, à confirmer.
      if (location.pathname !== CHEMIN_ACCUEIL) history.replaceState(null, "", CHEMIN_ACCUEIL);
      afficherReglages(MODES_REGLAGES.premiereConnexion, {
        langue: langueNavigateur,
        pays: proposerPays(moi.paysProfil, navigator.languages),
      });
    } else if (location.pathname === CHEMIN_REGLAGES) {
      afficherReglages(MODES_REGLAGES.reglages, moi);
    } else {
      if (location.pathname !== CHEMIN_ACCUEIL) history.replaceState(null, "", CHEMIN_ACCUEIL);
      afficherAccueil(moi);
    }
  }
} catch (erreur) {
  // Le détail technique, en anglais, ne va que dans la console.
  console.error(erreur);
  poserTexte(elementParId("chargement"), "serveurIndisponible");
}
