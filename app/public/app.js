import { CHEMIN_CONNEXION, CHEMIN_REGLAGES, ERREUR_CONNEXION_STEAM } from "/chemins.js";
import { LANGUES, proposerLangue } from "/langues.js";
import { PAYS, proposerPays } from "/pays.js";
import { chargerLangue, texte } from "/traduction.js";

const elementParId = (id) => document.getElementById(id);

function afficher(ecran) {
  elementParId("chargement").hidden = true;
  elementParId("ecran-connexion").hidden = ecran !== "connexion";
  elementParId("ecran-accueil").hidden = ecran !== "accueil";
  elementParId("ecran-preferences").hidden = ecran !== "preferences";
}

function afficherConnexion() {
  const parametres = new URLSearchParams(location.search);
  elementParId("erreur-connexion").hidden = parametres.get("erreur") !== ERREUR_CONNEXION_STEAM;
  afficher("connexion");
}

function afficherAccueil({ steamId, nom, avatar }) {
  elementParId("nom").textContent = nom ?? steamId;
  if (avatar) {
    elementParId("avatar").src = avatar;
    elementParId("avatar").hidden = false;
  }
  afficher("accueil");
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

// Même formulaire pour la première connexion (choix à confirmer) et pour les Réglages.
function afficherPreferences({ premiereConnexion, langue, pays }) {
  const cleTitre = premiereConnexion ? "choix.titre" : "reglages.titre";
  const cleBouton = premiereConnexion ? "choix.confirmer" : "reglages.enregistrer";
  elementParId("titre-preferences").dataset.texte = cleTitre;
  elementParId("titre-preferences").textContent = texte(cleTitre);
  elementParId("valider-preferences").dataset.texte = cleBouton;
  elementParId("valider-preferences").textContent = texte(cleBouton);
  elementParId("explication-choix").hidden = !premiereConnexion;
  elementParId("retour-reglages").hidden = premiereConnexion;

  const choixLangue = elementParId("langue");
  choixLangue.replaceChildren(...Object.entries(LANGUES).map(([code, nom]) => option(code, nom)));
  choixLangue.value = langue;
  remplirPays(langue, pays);

  // L'interface passe tout de suite dans la langue choisie, pour aperçu.
  choixLangue.addEventListener("change", async () => {
    await chargerLangue(choixLangue.value);
    remplirPays(choixLangue.value, elementParId("pays").value || null);
  });

  elementParId("preferences").addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const message = elementParId("message-preferences");
    message.hidden = true;
    const reponse = await fetch("/api/reglages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ langue: choixLangue.value, pays: elementParId("pays").value }),
    }).catch(() => null);

    if (reponse?.ok && premiereConnexion) {
      location.replace("/");
      return;
    }
    message.textContent = texte(reponse?.ok ? "reglages.enregistres" : "reglages.erreur");
    message.className = reponse?.ok ? "" : "erreur";
    message.hidden = false;
  });

  afficher("preferences");
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
    if (location.pathname === CHEMIN_CONNEXION) history.replaceState(null, "", "/");

    if (!moi.pays) {
      // Première connexion : langue et pays proposés, à confirmer.
      if (location.pathname !== "/") history.replaceState(null, "", "/");
      afficherPreferences({
        premiereConnexion: true,
        langue: langueNavigateur,
        pays: proposerPays(moi.paysProfil, navigator.languages),
      });
    } else if (location.pathname === CHEMIN_REGLAGES) {
      afficherPreferences({ premiereConnexion: false, langue: moi.langue, pays: moi.pays });
    } else {
      afficherAccueil(moi);
    }
  }
} catch (erreur) {
  elementParId("chargement").textContent = texte("serveurIndisponible", { erreur: erreur.message });
}
