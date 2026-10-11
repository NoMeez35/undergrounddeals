// Outils communs aux tests du Worker.
import { env } from "cloudflare:test";
import worker from "../src/index.js";
import { creerCookieSession } from "../src/session.js";

export const ORIGINE = "https://exemple.test";

export function appeler(chemin, { methode = "GET", cookies = [], corps } = {}) {
  const entetes = cookies.length ? { Cookie: cookies.join("; ") } : {};
  return worker.fetch(new Request(`${ORIGINE}${chemin}`, { method: methode, headers: entetes, body: corps }), env);
}

// La base n'est pas vidée entre les tests : chaque utilisateur créé ici a son
// propre SteamID.
let dernierSteamId = 76561198000000000n;

// Crée un utilisateur qui a déjà confirmé son pays et sa langue, et renvoie son
// SteamID et son cookie de session (« ud_session=… »).
export async function connecterUtilisateur({ pays = "FR", langue = "fr" } = {}) {
  dernierSteamId += 1n;
  const steamId = String(dernierSteamId);
  await env.DB.prepare("INSERT INTO utilisateurs (steam_id, pays, langue) VALUES (?, ?, ?)")
    .bind(steamId, pays, langue)
    .run();
  const cookie = (await creerCookieSession(steamId, env.SESSION_SECRET)).split(";")[0];
  return { steamId, cookie };
}
