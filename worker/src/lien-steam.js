// Ce que l'utilisateur colle pour ajouter un produit : un AppID, ou un lien
// de la boutique ou de la communauté Steam.
const APP_ID = /^\d{1,10}$/;
// ex. store.steampowered.com/app/620/Portal_2/, steamcommunity.com/app/620,
// store.steampowered.com/agecheck/app/620/, store.steampowered.com/bundle/232/
const LIEN_STEAM =
  /^(?:https?:\/\/)?(?:store\.steampowered\.com|steamcommunity\.com)\/(?:agecheck\/)?(app|sub|bundle)\/(\d{1,10})(?:[/?#]|$)/i;

// Renvoie { appId }, { pack: true } pour un lien de pack, ou null si le texte
// n'est ni un AppID ni un lien Steam reconnu.
export function lireLienSteam(texte) {
  if (typeof texte !== "string") return null;
  const saisie = texte.trim();
  if (APP_ID.test(saisie)) return { appId: Number(saisie) };

  const lien = saisie.match(LIEN_STEAM);
  if (!lien) return null;
  if (lien[1].toLowerCase() !== "app") return { pack: true };
  return { appId: Number(lien[2]) };
}
