// Partagé par l'appli et le Worker : ce que l'utilisateur colle pour ajouter
// un produit, un AppID ou un lien de la boutique ou de la communauté Steam, ou
// le nom d'un produit à chercher.
import { LONGUEUR_MIN_RECHERCHE } from "./suivis.js";

const APP_ID = /^\d{1,10}$/;
// ex. store.steampowered.com/app/620/Portal_2/, steamcommunity.com/app/620,
// store.steampowered.com/agecheck/app/620/, store.steampowered.com/bundle/232/
const LIEN_STEAM =
  /^(?:https?:\/\/)?(?:store\.steampowered\.com|steamcommunity\.com)\/(?:agecheck\/)?(app|sub|bundle)\/(\d{1,10})(?:[/?#]|$)/i;

// Renvoie { appId }, { pack: true } pour un lien de pack, ou null si le texte
// n'est ni un AppID ni un lien Steam reconnu.
export function lireSaisieProduit(texte) {
  if (typeof texte !== "string") return null;
  const saisie = texte.trim();
  if (APP_ID.test(saisie)) return { appId: Number(saisie) };

  const lien = saisie.match(LIEN_STEAM);
  if (!lien) return null;
  if (lien[1].toLowerCase() !== "app") return { pack: true };
  return { appId: Number(lien[2]) };
}

// Texte qui ressemble à une adresse web (ex. www.store.steampowered.com/app/620,
// s.team/a/620) : ce n'est pas un nom à chercher, même si le lien n'est pas
// reconnu.
const ADRESSE = /^(?:[a-z]+:\/\/|www\.|[\w-]+(?:\.[\w-]+)+\/)/i;

// Le texte peut être le nom d'un produit à chercher : assez long, et ni lien
// Steam ni adresse web. Un nombre peut être un nom (ex. « 2048 ») comme un AppID.
export function peutEtreUnNom(texte) {
  if (typeof texte !== "string") return false;
  const saisie = texte.trim();
  return saisie.length >= LONGUEUR_MIN_RECHERCHE && !ADRESSE.test(saisie);
}
