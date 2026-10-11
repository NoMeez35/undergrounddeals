const CHEMIN_CONNEXION = "/connexion";

const element = (id) => document.getElementById(id);

function afficher(ecran) {
  element("chargement").hidden = true;
  element("ecran-connexion").hidden = ecran !== "connexion";
  element("ecran-accueil").hidden = ecran !== "accueil";
}

function afficherConnexion() {
  const parametres = new URLSearchParams(location.search);
  element("erreur-connexion").hidden = parametres.get("erreur") !== "steam";
  afficher("connexion");
}

function afficherAccueil({ steamId, nom, avatar }) {
  element("nom").textContent = nom ?? steamId;
  if (avatar) {
    element("avatar").src = avatar;
    element("avatar").hidden = false;
  }
  afficher("accueil");
}

element("deconnexion").addEventListener("click", async () => {
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
  element("chargement").textContent = `Le serveur ne répond pas (${erreur.message}).`;
}
