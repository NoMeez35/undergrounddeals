// Connexion via Steam (voir docs/adr/0001) et déconnexion.
import { PAYS_PAR_DEFAUT } from "../../app/public/pays.js";
import { CHEMIN_ACCUEIL, CHEMIN_CONNEXION, CHEMIN_CONNEXION_STEAM, ERREUR_CONNEXION_STEAM } from "../../app/public/chemins.js";
import { enteteCookie, enteteCookieSupprime, lireCookie } from "./cookies.js";
import { redirection, sansContenu } from "./reponses.js";
import { cookieSessionSupprime, creerCookieSession } from "./session.js";
import { synchroniserSouhaits } from "./souhaits.js";
import { urlConnexionSteam, verifierRetourSteam } from "./steam-openid.js";

export const CHEMIN_RETOUR_STEAM = `${CHEMIN_CONNEXION_STEAM}/retour`;
// Jeton à usage unique qui relie le retour de Steam au navigateur qui a lancé la connexion.
const COOKIE_ETAT = "ud_etat";
const CHEMIN_COOKIE_ETAT = "/api/auth";

function adresseRetourSteam(url, etat) {
  return `${url.origin}${CHEMIN_RETOUR_STEAM}?etat=${etat}`;
}

export function demarrerConnexion({ url }) {
  const etat = crypto.randomUUID();
  return redirection(urlConnexionSteam(adresseRetourSteam(url, etat), url.origin), [
    enteteCookie(COOKIE_ETAT, etat, { chemin: CHEMIN_COOKIE_ETAT, dureeSecondes: 600 }),
  ]);
}

export async function terminerConnexion({ request, url, env }) {
  const etatSupprime = enteteCookieSupprime(COOKIE_ETAT, { chemin: CHEMIN_COOKIE_ETAT });
  const etat = url.searchParams.get("etat");
  const steamId =
    etat && etat === lireCookie(request, COOKIE_ETAT)
      ? await verifierRetourSteam(url, adresseRetourSteam(url, etat))
      : null;
  if (!steamId) {
    return redirection(`${CHEMIN_CONNEXION}?erreur=${ERREUR_CONNEXION_STEAM}`, [etatSupprime]);
  }

  const { meta } = await env.DB.prepare("INSERT OR IGNORE INTO utilisateurs (steam_id) VALUES (?)").bind(steamId).run();
  if (meta.changes > 0) {
    // Première connexion : la liste de souhaits est importée tout de suite. Un
    // échec n'empêche pas la connexion ; le passage planifié la reprendra.
    await synchroniserSouhaits(env, steamId, PAYS_PAR_DEFAUT).catch((erreur) =>
      console.error(`Import de la liste de souhaits de ${steamId} : ${erreur.message}`),
    );
  }
  return redirection(CHEMIN_ACCUEIL, [etatSupprime, await creerCookieSession(steamId, env.SESSION_SECRET)]);
}

export function deconnecter() {
  return sansContenu(cookieSessionSupprime());
}
