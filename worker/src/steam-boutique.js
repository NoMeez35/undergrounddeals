// Fiches et prix de la boutique Steam (API non documentée « appdetails »).
// Constats du 2026-10-11 :
// - un AppID inconnu renvoie `success: false` ;
// - avec `filters=price_overview`, plusieurs AppID tiennent en une requête ; un
//   produit sans prix dans le pays (gratuit, pas encore sorti, retiré de la vente
//   ou bloqué dans ce pays) renvoie `data: []` ;
// - un pays sans boutique (ex. AQ, KP) reçoit les prix en dollars américains.
import { TYPE_STEAM, TYPES_PRODUIT } from "../../app/public/suivis.js";

const ADRESSE_APPDETAILS = "https://store.steampowered.com/api/appdetails";
// Prix demandés par paquets, pour garder des adresses de taille raisonnable.
const TAILLE_PAQUET_PRIX = 100;
// Les prix sont gardés en cache 15 minutes par Cloudflare, pour ménager Steam.
const CACHE_PRIX_SECONDES = 15 * 60;

export class SteamIndisponible extends Error {}

async function appdetails(parametres, options) {
  const url = new URL(ADRESSE_APPDETAILS);
  url.search = new URLSearchParams(parametres).toString();
  const reponse = await fetch(url, options).catch(() => null);
  if (!reponse?.ok) throw new SteamIndisponible(`appdetails : HTTP ${reponse?.status ?? "injoignable"}`);
  return reponse.json().catch(() => {
    throw new SteamIndisponible("appdetails : réponse illisible");
  });
}

// Type de produit suivi d'une fiche Steam, ou null si elle ne peut pas être
// suivie : ni jeu ni DLC, ou DLC gratuit (un DLC suivi est payant, voir GLOSSARY.md).
function typeProduit({ type, is_free }) {
  const typeSuivi = TYPES_PRODUIT.find((candidat) => TYPE_STEAM[candidat] === type) ?? null;
  return typeSuivi === "dlc" && is_free ? null : typeSuivi;
}

// Fiche d'un produit vu depuis le pays donné. Renvoie { appId, type, nom } (type
// null si le produit ne peut pas être suivi), ou null si Steam ne le connaît pas
// ou renvoie une fiche incomplète. L'AppID renvoyé est celui de Steam, qui peut
// différer de celui demandé. Lève SteamIndisponible si Steam ne répond pas.
export async function lireFicheSteam(appId, pays) {
  const reponse = await appdetails({ appids: appId, cc: pays, l: "english" });
  const fiche = reponse?.[appId];
  if (!fiche?.success || typeof fiche.data?.name !== "string") return null;
  return {
    appId: fiche.data.steam_appid ?? appId,
    type: typeProduit(fiche.data),
    nom: fiche.data.name,
  };
}

function prixAffiche(prix) {
  if (!prix) return null;
  return {
    actuel: prix.final_formatted,
    initial: prix.discount_percent > 0 ? prix.initial_formatted : null,
    reduction: prix.discount_percent,
  };
}

// Prix actuels dans le pays donné : Map AppID → { actuel, initial, reduction }
// (montants déjà mis en forme par Steam, dans la devise du pays), ou null pour
// un produit sans prix. Lève SteamIndisponible si Steam ne répond pas.
export async function lirePrixSteam(appIds, pays) {
  const paquets = [];
  for (let debut = 0; debut < appIds.length; debut += TAILLE_PAQUET_PRIX) {
    paquets.push(appIds.slice(debut, debut + TAILLE_PAQUET_PRIX));
  }
  const reponses = await Promise.all(
    paquets.map((paquet) =>
      appdetails(
        { appids: paquet.join(","), cc: pays, filters: "price_overview" },
        { cf: { cacheTtl: CACHE_PRIX_SECONDES, cacheEverything: true } },
      ),
    ),
  );

  const prix = new Map();
  for (const reponse of reponses) {
    for (const [appId, fiche] of Object.entries(reponse ?? {})) {
      prix.set(Number(appId), prixAffiche(fiche?.data?.price_overview));
    }
  }
  return prix;
}
