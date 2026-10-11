import { CHEMIN_CONNEXION, ERREUR_CONNEXION_STEAM } from "/chemins.js";

const elementParId = (id) => document.getElementById(id);

function afficher(ecran) {
  elementParId("chargement").hidden = true;
  elementParId("ecran-connexion").hidden = ecran !== "connexion";
  elementParId("ecran-accueil").hidden = ecran !== "accueil";
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

elementParId("deconnexion").addEventListener("click", async () => {
  await fetch("/api/deconnexion", { method: "POST" });
  location.replace(CHEMIN_CONNEXION);
});

try {
  const reponse = await fetch("/api/moi");
  if (reponse.status === 401) {
    // Tout écran autre que Connexion est réservé aux utilisateurs connectés.
    if (location.pathname === CHEMIN_CONNEXION) afficherConnexion();
    else location.replace(CHEMIN_CONNEXION);
  } else if (!reponse.ok) {
    throw new Error(`HTTP ${reponse.status}`);
  } else {
    if (location.pathname === CHEMIN_CONNEXION) history.replaceState(null, "", "/");
    afficherAccueil(await reponse.json());
  }
} catch (erreur) {
  elementParId("chargement").textContent = `Le serveur ne répond pas (${erreur.message}).`;
}
