// SteamID : identifiant du compte Steam d'un utilisateur, au format SteamID64
// (17 chiffres). Toute valeur venant de l'extérieur passe par lireSteamId.
const FORMAT_STEAM_ID = /^\d{17}$/;

// Renvoie le SteamID si le texte en est un, sinon null.
export function lireSteamId(texte) {
  return typeof texte === "string" && FORMAT_STEAM_ID.test(texte) ? texte : null;
}
