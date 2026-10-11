import { CHEMIN_CONNEXION, ERREUR_CONNEXION_STEAM } from "../../app/public/chemins.js";
import { lireLangue } from "../../app/public/langues.js";
import { lirePays } from "../../app/public/pays.js";
import { enteteCookie, enteteCookieSupprime, lireCookie } from "./cookies.js";
import { cookieSessionSupprime, creerCookieSession, lireSession } from "./session.js";
import { lireProfilSteam } from "./steam-profil.js";
import { urlConnexionSteam, verifierRetourSteam } from "./steam-openid.js";

const CHEMIN_RETOUR_STEAM = "/api/auth/steam/retour";
// Jeton à usage unique qui relie le retour de Steam au navigateur qui a lancé la connexion.
const COOKIE_ETAT = "ud_etat";
const CHEMIN_COOKIE_ETAT = "/api/auth";
const SANS_CACHE = { "Cache-Control": "no-store" };

function redirection(adresse, cookies = []) {
  const entetes = new Headers({ Location: adresse });
  for (const cookie of cookies) entetes.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: entetes });
}

function adresseRetourSteam(url, etat) {
  return `${url.origin}${CHEMIN_RETOUR_STEAM}?etat=${etat}`;
}

function demarrerConnexion(url) {
  const etat = crypto.randomUUID();
  return redirection(urlConnexionSteam(adresseRetourSteam(url, etat), url.origin), [
    enteteCookie(COOKIE_ETAT, etat, { chemin: CHEMIN_COOKIE_ETAT, dureeSecondes: 600 }),
  ]);
}

async function terminerConnexion(request, url, env) {
  const etatSupprime = enteteCookieSupprime(COOKIE_ETAT, { chemin: CHEMIN_COOKIE_ETAT });
  const etat = url.searchParams.get("etat");
  const steamId =
    etat && etat === lireCookie(request, COOKIE_ETAT)
      ? await verifierRetourSteam(url, adresseRetourSteam(url, etat))
      : null;
  if (!steamId) {
    return redirection(`${CHEMIN_CONNEXION}?erreur=${ERREUR_CONNEXION_STEAM}`, [etatSupprime]);
  }

  await env.DB.prepare("INSERT OR IGNORE INTO utilisateurs (steam_id) VALUES (?)").bind(steamId).run();
  return redirection("/", [etatSupprime, await creerCookieSession(steamId, env.SESSION_SECRET)]);
}

// Renvoie l'utilisateur de la session (SteamID, pays, langue), ou null.
async function utilisateurConnecte(request, env) {
  const steamId = await lireSession(request, env.SESSION_SECRET);
  if (!steamId) return null;
  return env.DB.prepare("SELECT steam_id, pays, langue FROM utilisateurs WHERE steam_id = ?")
    .bind(steamId)
    .first();
}

function nonConnecte() {
  return Response.json({ erreur: "non connecté" }, { status: 401, headers: SANS_CACHE });
}

// `pays` et `langue` restent null tant que l'utilisateur ne les a pas confirmés ;
// `paysProfil` (profil Steam public) sert alors à proposer un pays.
async function profilConnecte(request, env) {
  const utilisateur = await utilisateurConnecte(request, env);
  if (!utilisateur) return nonConnecte();

  const profil = await lireProfilSteam(utilisateur.steam_id, env.STEAM_API_KEY);
  return Response.json(
    {
      steamId: utilisateur.steam_id,
      nom: profil?.nom ?? null,
      avatar: profil?.avatar ?? null,
      pays: utilisateur.pays,
      langue: utilisateur.langue,
      paysProfil: profil?.pays ?? null,
    },
    { headers: SANS_CACHE },
  );
}

// Le pays ne sert qu'aux relevés et alertes à venir : en changer ne crée
// aucune alerte pour des événements passés.
async function enregistrerReglages(request, env) {
  const utilisateur = await utilisateurConnecte(request, env);
  if (!utilisateur) return nonConnecte();

  const corps = await request.json().catch(() => null);
  const pays = lirePays(corps?.pays);
  const langue = lireLangue(corps?.langue);
  if (!pays || !langue) {
    return Response.json({ erreur: "pays ou langue invalide" }, { status: 400, headers: SANS_CACHE });
  }

  await env.DB.prepare("UPDATE utilisateurs SET pays = ?, langue = ? WHERE steam_id = ?")
    .bind(pays, langue, utilisateur.steam_id)
    .run();
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    switch (`${request.method} ${url.pathname}`) {
      case "GET /api/auth/steam":
        return demarrerConnexion(url);
      case `GET ${CHEMIN_RETOUR_STEAM}`:
        return terminerConnexion(request, url, env);
      case "POST /api/deconnexion":
        return new Response(null, { status: 204, headers: { "Set-Cookie": cookieSessionSupprime() } });
      case "GET /api/moi":
        return profilConnecte(request, env);
      case "PUT /api/reglages":
        return enregistrerReglages(request, env);
      default:
        return Response.json({ erreur: "introuvable" }, { status: 404 });
    }
  },
};
