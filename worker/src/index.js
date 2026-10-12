// Aiguillage des requêtes de l'API vers les modules qui les traitent, et
// passages planifiés (voir `triggers` dans worker/wrangler.jsonc).
import { CHEMIN_CONNEXION_STEAM } from "../../app/public/chemins.js";
import { listerAlertes } from "./alertes.js";
import { CHEMIN_RETOUR_STEAM, deconnecter, demarrerConnexion, terminerConnexion } from "./connexion.js";
import { enregistrerReglages } from "./reglages.js";
import { releverLesPrix } from "./releve.js";
import { json } from "./reponses.js";
import { relireSouhaits, suivreSouhait, synchroniserLesListesEnRetard } from "./souhaits.js";
import { ajouterSuivi, listerSuivis, retirerSuivi } from "./suivis.js";
import { renvoyerProfil, utilisateurConnecte } from "./utilisateur.js";

// Routes d'un produit, « /api/<collection>/<AppID> » : collection → route.
const ROUTES_PRODUIT = { suivis: "/api/suivis/:appId", souhaits: "/api/souhaits/:appId" };
const CHEMIN_PRODUIT = new RegExp(`^/api/(${Object.keys(ROUTES_PRODUIT).join("|")})/(\\d{1,10})$`);

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
  "GET /api/alertes": listerAlertes,
  "GET /api/suivis": listerSuivis,
  "POST /api/suivis": ajouterSuivi,
  [`DELETE ${ROUTES_PRODUIT.suivis}`]: retirerSuivi,
  "POST /api/souhaits/relire": relireSouhaits,
  [`POST ${ROUTES_PRODUIT.souhaits}`]: suivreSouhait,
};

// Passages planifiés : expression cron de worker/wrangler.jsonc → tâche. Chaque
// expression donne des passages distincts, avec chacun les limites de l'offre
// gratuite (50 appels externes, 50 requêtes à la base).
export const PASSAGES_PLANIFIES = {
  "*/10 * * * *": synchroniserLesListesEnRetard,
  "*/5 * * * *": releverLesPrix,
};

// Clé de route de la requête, et l'AppID quand le chemin en contient un.
function lireRoute(request, url) {
  const produit = url.pathname.match(CHEMIN_PRODUIT);
  if (!produit) return { route: `${request.method} ${url.pathname}` };
  return { route: `${request.method} ${ROUTES_PRODUIT[produit[1]]}`, appId: Number(produit[2]) };
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

  async scheduled(controleur, env, ctx) {
    const tache = PASSAGES_PLANIFIES[controleur.cron];
    if (tache) ctx.waitUntil(tache(env));
  },
};
