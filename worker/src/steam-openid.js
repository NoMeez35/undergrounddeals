// Connexion via Steam (OpenID 2.0) : voir docs/adr/0001.
import { lireSteamId } from "./steam-id.js";

export const ADRESSE_OPENID_STEAM = "https://steamcommunity.com/openid/login";

const ESPACE_OPENID = "http://specs.openid.net/auth/2.0";
const IDENTIFIANT_A_CHOISIR = `${ESPACE_OPENID}/identifier_select`;
const PREFIXE_IDENTITE_STEAM = "https://steamcommunity.com/openid/id/";
// Champs qui doivent être couverts par la signature de Steam.
const CHAMPS_SIGNES_REQUIS = ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"];
// Une réponse de Steam plus ancienne est refusée, pour limiter le rejeu d'une
// adresse de retour qui aurait fuité (historique, journaux).
const AGE_MAXIMAL_REPONSE_MS = 5 * 60 * 1000;
// Tolérance pour un léger décalage d'horloge entre Steam et Cloudflare.
const AVANCE_TOLEREE_MS = 60 * 1000;

export function urlConnexionSteam(adresseRetour, origine) {
  const url = new URL(ADRESSE_OPENID_STEAM);
  url.search = new URLSearchParams({
    "openid.ns": ESPACE_OPENID,
    "openid.mode": "checkid_setup",
    "openid.return_to": adresseRetour,
    "openid.realm": origine,
    "openid.identity": IDENTIFIANT_A_CHOISIR,
    "openid.claimed_id": IDENTIFIANT_A_CHOISIR,
  }).toString();
  return url.toString();
}

function steamIdDeLIdentite(identite) {
  if (!identite?.startsWith(PREFIXE_IDENTITE_STEAM)) return null;
  return lireSteamId(identite.slice(PREFIXE_IDENTITE_STEAM.length));
}

// Le nonce commence par la date de la réponse, ex. « 2026-10-11T08:30:00Z… ».
function reponseRecente(nonce, maintenant) {
  const date = Date.parse(nonce?.slice(0, 20) ?? "");
  return date > maintenant - AGE_MAXIMAL_REPONSE_MS && date < maintenant + AVANCE_TOLEREE_MS;
}

// Vérifie la réponse renvoyée par Steam, puis la fait confirmer par Steam.
// Renvoie le SteamID, ou null si la réponse est falsifiée, trop ancienne ou non vérifiée.
export async function verifierRetourSteam(url, adresseRetourAttendue, maintenant = Date.now()) {
  const parametres = url.searchParams;
  const champ = (nom) => parametres.get(`openid.${nom}`);

  if (champ("mode") !== "id_res") return null;
  if (champ("op_endpoint") !== ADRESSE_OPENID_STEAM) return null;
  if (champ("return_to") !== adresseRetourAttendue) return null;
  if (champ("identity") !== champ("claimed_id")) return null;
  if (!reponseRecente(champ("response_nonce"), maintenant)) return null;

  const steamId = steamIdDeLIdentite(champ("claimed_id"));
  if (!steamId) return null;

  const signes = (champ("signed") ?? "").split(",");
  if (!CHAMPS_SIGNES_REQUIS.every((nom) => signes.includes(nom))) return null;

  const verification = new URLSearchParams();
  for (const [cle, valeur] of parametres) {
    if (cle.startsWith("openid.")) verification.set(cle, valeur);
  }
  verification.set("openid.mode", "check_authentication");

  const reponse = await fetch(ADRESSE_OPENID_STEAM, { method: "POST", body: verification });
  if (!reponse.ok) return null;
  const lignes = (await reponse.text()).split("\n").map((ligne) => ligne.trim());
  if (!lignes.includes("is_valid:true")) return null;

  return steamId;
}
