// Boutique Steam : fiches et prix des produits, listes de souhaits.
// API non documentées, constats du 2026-10-11 :
// - appdetails avec `filters=price_overview` donne les prix de plusieurs AppID
//   en une requête ; un produit sans prix dans le pays (gratuit, pas encore sorti,
//   retiré de la vente ou bloqué dans ce pays) renvoie `data: []` ; un pays sans
//   boutique (ex. AQ, KP) reçoit les prix en dollars américains ;
// - IStoreBrowseService/GetItems donne le type, le nom, la gratuité et la
//   sortie (`release.is_coming_soon`) de 100 produits en une requête ; un AppID
//   inconnu y a `success: 15` ; un jeu pas encore sorti peut être dit gratuit ;
//   un produit retiré de la vente partout a `unlisted: true` (ex. F1 23, 2108330)
//   ou le type 14 (fiche de remplacement, ex. Darksiders II, 50650) ;
// - IWishlistService/GetWishlist renvoie `{ response: {} }` pour une liste de
//   souhaits vide ou privée (la confidentialité « Détails des jeux » du profil).
import { TYPE_STEAM, TYPES_PRODUIT } from "../../app/public/suivis.js";

const ADRESSE_APPDETAILS = "https://store.steampowered.com/api/appdetails";
const ADRESSE_GET_ITEMS = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
const ADRESSE_GET_WISHLIST = "https://api.steampowered.com/IWishlistService/GetWishlist/v1/";
// Produits demandés par paquets, pour garder des adresses de taille raisonnable.
const TAILLE_PAQUET = 100;
// Prix et fiches sont gardés en cache 15 minutes par Cloudflare, pour ménager Steam.
const EN_CACHE = { cf: { cacheTtl: 15 * 60, cacheEverything: true } };

// Type GetItems d'une fiche de remplacement d'un produit retiré de la vente.
const TYPE_STEAM_RETIRE = 14;

export class SteamIndisponible extends Error {}

async function lireJson(adresse, parametres, options) {
  const url = new URL(adresse);
  url.search = new URLSearchParams(parametres).toString();
  const reponse = await fetch(url, options).catch(() => null);
  if (!reponse?.ok) throw new SteamIndisponible(`${url.pathname} : HTTP ${reponse?.status ?? "injoignable"}`);
  return reponse.json().catch(() => {
    throw new SteamIndisponible(`${url.pathname} : réponse illisible`);
  });
}

function enPaquets(appIds) {
  const paquets = [];
  for (let debut = 0; debut < appIds.length; debut += TAILLE_PAQUET) {
    paquets.push(appIds.slice(debut, debut + TAILLE_PAQUET));
  }
  return paquets;
}

// Type de produit suivi d'une fiche Steam, ou null si elle ne peut pas être
// suivie : ni jeu ni DLC (pack, bande-son…), ou DLC gratuit (un DLC suivi est
// payant, voir GLOSSARY.md).
function typeProduit({ type, is_free }) {
  const typeSuivi = TYPES_PRODUIT.find((candidat) => TYPE_STEAM[candidat] === type) ?? null;
  return typeSuivi === "dlc" && is_free ? null : typeSuivi;
}

// Fiches des produits vus depuis le pays donné : Map AppID demandé →
// { appId, type, nom, pasEncoreSorti, gratuit, retire } (type null si le
// produit ne peut pas être suivi ; retire : retiré de Steam). Un
// produit inconnu de Steam ou à la fiche incomplète est absent de la Map.
// L'AppID de la fiche est celui de Steam, qui peut différer de celui demandé.
// Lève SteamIndisponible si Steam ne répond pas.
export async function lireFichesSteam(appIds, pays) {
  const reponses = await Promise.all(
    enPaquets(appIds).map((paquet) =>
      lireJson(
        ADRESSE_GET_ITEMS,
        {
          input_json: JSON.stringify({
            ids: paquet.map((appid) => ({ appid })),
            context: { language: "english", country_code: pays },
            data_request: { include_release: true },
          }),
        },
        EN_CACHE,
      ),
    ),
  );

  const fiches = new Map();
  for (const fiche of reponses.flatMap((reponse) => reponse?.response?.store_items ?? [])) {
    if (fiche.success !== 1 || typeof fiche.name !== "string" || !fiche.name) continue;
    fiches.set(fiche.id, {
      appId: fiche.appid || fiche.id,
      type: typeProduit(fiche),
      nom: fiche.name,
      pasEncoreSorti: fiche.release?.is_coming_soon === true,
      gratuit: fiche.is_free === true,
      retire: fiche.unlisted === true || fiche.type === TYPE_STEAM_RETIRE,
    });
  }
  return fiches;
}

function lirePrix(prix) {
  if (!Number.isInteger(prix?.final) || typeof prix.currency !== "string") return null;
  return {
    devise: prix.currency,
    prix: prix.final,
    prixInitial: Number.isInteger(prix.initial) ? prix.initial : prix.final,
    reduction: Number.isInteger(prix.discount_percent) ? prix.discount_percent : 0,
    prixAffiche: prix.final_formatted ?? null,
    prixInitialAffiche: prix.discount_percent > 0 ? (prix.initial_formatted ?? null) : null,
  };
}

// Prix actuels dans le pays donné : Map AppID → { devise, prix, prixInitial,
// reduction, prixAffiche, prixInitialAffiche } (montants en centièmes de la
// devise du pays, et mis en forme par Steam), ou null pour un produit sans prix.
// Lève SteamIndisponible si Steam ne répond pas.
export async function lirePrixSteam(appIds, pays) {
  const reponses = await Promise.all(
    enPaquets(appIds).map((paquet) =>
      lireJson(
        ADRESSE_APPDETAILS,
        { appids: paquet.join(","), cc: pays, filters: "price_overview" },
        EN_CACHE,
      ),
    ),
  );

  const prix = new Map();
  for (const reponse of reponses) {
    for (const [appId, fiche] of Object.entries(reponse ?? {})) {
      prix.set(Number(appId), lirePrix(fiche?.data?.price_overview));
    }
  }
  return prix;
}

// Liste de souhaits de l'utilisateur, dans l'ordre de priorité Steam : les
// produits classés (priorité 1, 2…) puis les non classés (priorité 0), du plus
// ancien au plus récent. Renvoie une liste d'AppID, ou null si la liste est vide,
// privée ou illisible : dans le doute, la synchronisation ne retire rien.
// Lève SteamIndisponible si Steam ne répond pas.
export async function lireListeDeSouhaits(steamId) {
  const reponse = await lireJson(ADRESSE_GET_WISHLIST, { steamid: steamId });
  const items = reponse?.response?.items;
  const souhaits = (Array.isArray(items) ? items : []).filter((souhait) => Number.isInteger(souhait?.appid));
  if (souhaits.length === 0) return null;

  const rang = ({ priority }) => (priority > 0 ? priority : Infinity);
  return souhaits
    .sort((a, b) => rang(a) - rang(b) || (a.date_added ?? 0) - (b.date_added ?? 0))
    .map((souhait) => souhait.appid);
}
