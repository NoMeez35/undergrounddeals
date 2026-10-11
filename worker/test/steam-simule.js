// Steam simulé pour les tests : chaque API appelée par le Worker répond d'après
// `etat`, que le test peut modifier :
// - verification : réponse de Steam à la vérification OpenID ;
// - profil : réponse de GetPlayerSummaries ;
// - fiches : AppID → { type: "game" | "dlc" | "music", name, is_free, appid } ;
// - prix : pays → AppID → price_overview ;
// - souhaits : SteamID → AppID dans l'ordre de priorité (absent : liste vide ou privée) ;
// - enPanne : Steam répond 503 à tout ;
// - requetes : adresses appelées, dans l'ordre.
import { vi } from "vitest";

// Valeur du champ `type` de GetItems.
const TYPES_GET_ITEMS = { game: 0, dlc: 4, music: 11 };

function reponseGetItems(url, fiches) {
  const { ids } = JSON.parse(url.searchParams.get("input_json"));
  const store_items = ids.map(({ appid }) => {
    const fiche = fiches[appid];
    if (!fiche) return { item_type: 0, id: appid, success: 15, appid: 0 };
    return { ...fiche, id: appid, success: 1, appid: fiche.appid ?? appid, type: TYPES_GET_ITEMS[fiche.type] };
  });
  return { response: { store_items } };
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
      case "https://store.steampowered.com/api/appdetails":
        return Response.json(reponseAppdetails(url, etat.prix ?? {}));
      case "https://api.steampowered.com/IWishlistService/GetWishlist/v1/":
        return Response.json(reponseGetWishlist(url, etat.souhaits ?? {}));
      default:
        throw new Error(`Requête inattendue : ${url}`);
    }
  });
}
