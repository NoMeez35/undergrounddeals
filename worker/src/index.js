// Aiguillage des requêtes de l'API vers les modules qui les traitent, et
// passages planifiés (voir `triggers` dans worker/wrangler.jsonc).
import { CHEMIN_CONNEXION_STEAM } from "../../app/public/chemins.js";
import { CHEMIN_RETOUR_STEAM, deconnecter, demarrerConnexion, terminerConnexion } from "./connexion.js";
import { enregistrerReglages } from "./reglages.js";
import { json } from "./reponses.js";
import { relireSouhaits, suivreSouhait, synchroniserLesListesEnRetard } from "./souhaits.js";
import { ajouterSuivi, listerSuivis, retirerSuivi } from "./suivis.js";
import { renvoyerProfil, utilisateurConnecte } from "./utilisateur.js";

// Routes d'un produit : `:appId` est l'AppID lu par CHEMIN_PRODUIT.
const ROUTE_SUIVI = "/api/suivis/:appId";
const ROUTE_SOUHAIT = "/api/souhaits/:appId";
const CHEMIN_PRODUIT = /^\/api\/(suivis|souhaits)\/(\d{1,10})$/;

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
  "POST /api/souhaits/relire": relireSouhaits,
  [`POST ${ROUTE_SOUHAIT}`]: suivreSouhait,
};

// Clé de route de la requête, et l'AppID quand le chemin en contient un.
function lireRoute(request, url) {
  const produit = url.pathname.match(CHEMIN_PRODUIT);
  if (!produit) return { route: `${request.method} ${url.pathname}` };
  const route = produit[1] === "suivis" ? ROUTE_SUIVI : ROUTE_SOUHAIT;
  return { route: `${request.method} ${route}`, appId: Number(produit[2]) };
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

  async scheduled(_controleur, env, ctx) {
    ctx.waitUntil(synchroniserLesListesEnRetard(env));
  },
};
