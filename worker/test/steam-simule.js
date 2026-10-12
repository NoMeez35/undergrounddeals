// Steam simulé pour les tests : chaque API appelée par le Worker répond d'après
// `etat`, que le test peut modifier :
// - verification : réponse de Steam à la vérification OpenID ;
// - profil : réponse de GetPlayerSummaries ;
// - fiches : AppID → { type: "game" | "dlc" | "music", name, is_free, appid } ;
// - prix : pays → AppID → price_overview ;
// - recherches : texte cherché → AppID trouvés, dans l'ordre de Steam (leurs
//   fiches viennent de `fiches`) ;
// - souhaits : SteamID → AppID dans l'ordre de priorité (absent : liste vide ou
//   privée), ou réponse brute de GetWishlist si ce n'est pas un tableau ;
// - enPanne : Steam répond 503 à tout ;
// - requetes : adresses appelées, dans l'ordre.
import { vi } from "vitest";
import { TYPE_STEAM } from "../../app/public/suivis.js";

// Valeur du champ `type` de GetItems ; 11 : bande-son.
const TYPES_GET_ITEMS = { game: TYPE_STEAM.jeu, dlc: TYPE_STEAM.dlc, music: 11 };

// Fiche de GetItems ou de SearchSuggestions ; les images sont les fichiers de
// `assets` (ex. small_capsule).
function ficheSteam(appid, fiches) {
  const fiche = fiches[appid];
  if (!fiche) return { item_type: 0, id: appid, success: 15, appid: 0 };
  return {
    ...fiche,
    id: appid,
    success: 1,
    appid: fiche.appid ?? appid,
    type: TYPES_GET_ITEMS[fiche.type],
    assets: { asset_url_format: `steam/apps/${appid}/\${FILENAME}?t=1`, small_capsule: `capsule_${appid}.jpg` },
  };
}

function reponseGetItems(url, fiches) {
  const { ids } = JSON.parse(url.searchParams.get("input_json"));
  return { response: { store_items: ids.map(({ appid }) => ficheSteam(appid, fiches)) } };
}

function reponseSearchSuggestions(url, recherches, fiches) {
  const { search_term, max_results } = JSON.parse(url.searchParams.get("input_json"));
  const appIds = (recherches[search_term] ?? []).slice(0, max_results);
  return { response: { ids: appIds.map((appid) => ({ appid })), store_items: appIds.map((appid) => ficheSteam(appid, fiches)) } };
}

function reponseAppdetails(url, prix) {
  const pays = url.searchParams.get("cc").toUpperCase();
  const reponse = {};
  for (const appId of url.searchParams.get("appids").split(",")) {
    const prixPays = prix[pays]?.[appId];
    reponse[appId] = { success: true, data: prixPays ? { price_overview: prixPays } : [] };
  }
  return reponse;
}

function reponseGetWishlist(url, souhaits) {
  const appIds = souhaits[url.searchParams.get("steamid")];
  if (!appIds) return { response: {} };
  if (!Array.isArray(appIds)) return appIds;
  return { response: { items: appIds.map((appid, i) => ({ appid, priority: i + 1, date_added: 1_700_000_000 })) } };
}

export function simulerSteam(etat) {
  etat.requetes = [];
  return vi.fn(async (adresse) => {
    const url = new URL(String(adresse));
    etat.requetes.push(url);
    if (etat.enPanne) return new Response("", { status: 503 });

    switch (url.origin + url.pathname) {
      case "https://steamcommunity.com/openid/login":
        return new Response(etat.verification);
      case "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/":
        return Response.json(etat.profil);
      case "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/":
        return Response.json(reponseGetItems(url, etat.fiches ?? {}));
      case "https://api.steampowered.com/IStoreQueryService/SearchSuggestions/v1/":
        return Response.json(reponseSearchSuggestions(url, etat.recherches ?? {}, etat.fiches ?? {}));
      case "https://store.steampowered.com/api/appdetails":
        return Response.json(reponseAppdetails(url, etat.prix ?? {}));
      case "https://api.steampowered.com/IWishlistService/GetWishlist/v1/":
        return Response.json(reponseGetWishlist(url, etat.souhaits ?? {}));
      default:
        throw new Error(`Requête inattendue : ${url}`);
    }
  });
}

// price_overview d'appdetails pour un prix en centièmes ; montants mis en forme
// « 9.69 EUR ».
export function prixSteam(devise, centimes, reduction = 0) {
  const montant = (valeur) => `${(valeur / 100).toFixed(2)} ${devise}`;
  const initial = Math.round(centimes / (1 - reduction / 100));
  return {
    currency: devise,
    initial,
    final: centimes,
    discount_percent: reduction,
    initial_formatted: reduction ? montant(initial) : "",
    final_formatted: montant(centimes),
  };
}
