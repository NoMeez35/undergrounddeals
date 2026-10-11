// Aiguillage des requêtes de l'API vers les modules qui les traitent.
import { CHEMIN_CONNEXION_STEAM } from "../../app/public/chemins.js";
import { CHEMIN_RETOUR_STEAM, deconnecter, demarrerConnexion, terminerConnexion } from "./connexion.js";
import { enregistrerReglages } from "./reglages.js";
import { json } from "./reponses.js";
import { ajouterSuivi, listerSuivis, retirerSuivi } from "./suivis.js";
import { renvoyerProfil, utilisateurConnecte } from "./utilisateur.js";

// Route d'un produit suivi : `:appId` est l'AppID lu par CHEMIN_SUIVI.
const ROUTE_SUIVI = "/api/suivis/:appId";
const CHEMIN_SUIVI = /^\/api\/suivis\/(\d{1,10})$/;

// Routes ouvertes à tous.
const ROUTES_PUBLIQUES = {
  [`GET ${CHEMIN_CONNEXION_STEAM}`]: demarrerConnexion,
  [`GET ${CHEMIN_RETOUR_STEAM}`]: terminerConnexion,
  "POST /api/deconnexion": deconnecter,
};

// Routes réservées aux utilisateurs connectés : elles reçoivent `utilisateur`.
const ROUTES_CONNECTEES = {
  "GET /api/moi": renvoyerProfil,
  "PUT /api/reglages": enregistrerReglages,
  "GET /api/suivis": listerSuivis,
  "POST /api/suivis": ajouterSuivi,
  [`DELETE ${ROUTE_SUIVI}`]: retirerSuivi,
};

// Clé de route de la requête, et l'AppID quand le chemin en contient un.
function lireRoute(request, url) {
  const suivi = url.pathname.match(CHEMIN_SUIVI);
  if (suivi) return { route: `${request.method} ${ROUTE_SUIVI}`, appId: Number(suivi[1]) };
  return { route: `${request.method} ${url.pathname}` };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { route, appId } = lireRoute(request, url);
    const contexte = { request, url, env, appId };

    if (Object.hasOwn(ROUTES_PUBLIQUES, route)) return ROUTES_PUBLIQUES[route](contexte);
    if (!Object.hasOwn(ROUTES_CONNECTEES, route)) return json({ erreur: "introuvable" }, { status: 404 });

    const utilisateur = await utilisateurConnecte(request, env);
    if (!utilisateur) return json({ erreur: "nonConnecte" }, { status: 401 });
    return ROUTES_CONNECTEES[route]({ ...contexte, utilisateur });
  },
};
