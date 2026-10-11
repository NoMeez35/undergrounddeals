// Session sans stockage : un cookie signé (HMAC) qui contient le SteamID et sa
// date d'expiration. Rien d'autre que le SteamID n'est conservé côté serveur.
// Limite : se déconnecter efface le cookie du navigateur, mais une copie volée
// du cookie resterait valable jusqu'à son expiration.
import { enteteCookie, enteteCookieSupprime, lireCookie } from "./cookies.js";
import { lireSteamId } from "./steam-id.js";

const NOM_COOKIE = "ud_session";
const DUREE_SECONDES = 30 * 24 * 60 * 60;

const encodeur = new TextEncoder();

function versBase64Url(octets) {
  return btoa(String.fromCharCode(...new Uint8Array(octets)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function depuisBase64Url(texte) {
  const base64 = texte.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
}

function cleHmac(secret) {
  return crypto.subtle.importKey(
    "raw",
    encodeur.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function creerCookieSession(steamId, secret, maintenant = Date.now()) {
  const contenu = `${steamId}.${Math.floor(maintenant / 1000) + DUREE_SECONDES}`;
  const signature = await crypto.subtle.sign("HMAC", await cleHmac(secret), encodeur.encode(contenu));
  return enteteCookie(NOM_COOKIE, `${contenu}.${versBase64Url(signature)}`, {
    dureeSecondes: DUREE_SECONDES,
  });
}

export function cookieSessionSupprime() {
  return enteteCookieSupprime(NOM_COOKIE);
}

// Renvoie le SteamID de la session, ou null si elle est absente, falsifiée ou expirée.
export async function lireSession(request, secret, maintenant = Date.now()) {
  const morceaux = lireCookie(request, NOM_COOKIE)?.split(".");
  if (morceaux?.length !== 3) return null;

  const [steamId, expiration, signature] = morceaux;
  let octetsSignature;
  try {
    octetsSignature = depuisBase64Url(signature);
  } catch {
    return null;
  }
  const valide = await crypto.subtle.verify(
    "HMAC",
    await cleHmac(secret),
    octetsSignature,
    encodeur.encode(`${steamId}.${expiration}`),
  );
  if (!valide || Number(expiration) * 1000 <= maintenant) return null;
  return lireSteamId(steamId);
}
