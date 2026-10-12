import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appeler, connecterUtilisateur } from "./outils.js";
import { simulerSteam } from "./steam-simule.js";

const FICHES = {
  620: { type: "game", name: "Portal 2" },
  400: { type: "game", name: "Portal" },
  323180: { type: "music", name: "Portal 2 Soundtrack" },
  2138330: { type: "dlc", name: "Cyberpunk 2077: Phantom Liberty" },
  1250: { type: "dlc", name: "Skins gratuits", is_free: true },
  570: { type: "game", name: "Dota 2", is_free: true },
};

let steam;

beforeEach(() => {
  steam = { fiches: FICHES, recherches: {} };
  vi.stubGlobal("fetch", simulerSteam(steam));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function rechercher({ cookie }, texte) {
  return appeler(`/api/recherche?texte=${encodeURIComponent(texte)}`, { cookies: [cookie] });
}

const appelsRecherche = () =>
  steam.requetes
    .filter((url) => url.pathname.endsWith("/SearchSuggestions/v1/"))
    .map((url) => JSON.parse(url.searchParams.get("input_json")));

describe("recherche d'un produit par son nom", () => {
  it("renvoie les jeux et DLC suivables trouvés par Steam, dans son ordre, avec leur image", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.recherches.portal = [620, 323180, 400, 1250, 2138330, 570];

    const reponse = await rechercher(utilisateur, "portal");

    expect(reponse.status).toBe(200);
    expect((await reponse.json()).resultats).toEqual([
      {
        appId: 620,
        nom: "Portal 2",
        type: "jeu",
        image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/capsule_620.jpg?t=1",
        suivi: false,
      },
      expect.objectContaining({ appId: 400, nom: "Portal", type: "jeu" }),
      expect.objectContaining({ appId: 2138330, type: "dlc" }),
      expect.objectContaining({ appId: 570, nom: "Dota 2", type: "jeu" }),
    ]);
  });

  it("cherche dans le pays et la langue de l'utilisateur", async () => {
    const utilisateur = await connecterUtilisateur({ pays: "US", langue: "en" });
    const francais = await connecterUtilisateur({ pays: "BE", langue: "fr" });

    await rechercher(utilisateur, "  portal ");
    await rechercher(francais, "portal");

    expect(appelsRecherche().map(({ search_term, context }) => [search_term, context.country_code, context.language])).toEqual([
      ["portal", "US", "english"],
      ["portal", "BE", "french"],
    ]);
  });

  it("signale les produits déjà suivis", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.recherches.portal = [620, 400];
    await appeler("/api/suivis", { methode: "POST", cookies: [utilisateur.cookie], corps: JSON.stringify({ lien: "620" }) });

    const { resultats } = await (await rechercher(utilisateur, "portal")).json();

    expect(resultats.map(({ appId, suivi }) => [appId, suivi])).toEqual([
      [620, true],
      [400, false],
    ]);
  });

  it("renvoie un produit sans image quand Steam n'en donne pas", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.fiches = { ...FICHES, 4000: { type: "game", name: "Jeu sans image", sansImage: true } };
    steam.recherches.image = [4000];

    const { resultats } = await (await rechercher(utilisateur, "image")).json();

    expect(resultats).toEqual([expect.objectContaining({ appId: 4000, image: null })]);
  });

  it("ne renvoie qu'une fois un produit que Steam trouve sous deux AppID", async () => {
    const utilisateur = await connecterUtilisateur();
    // 401 est un ancien AppID que Steam redirige vers 400.
    steam.fiches = { ...FICHES, 401: { type: "game", name: "Portal", appid: 400 } };
    steam.recherches.portal = [400, 401, 620];

    const { resultats } = await (await rechercher(utilisateur, "portal")).json();

    expect(resultats.map(({ appId }) => appId)).toEqual([400, 620]);
  });

  it("renvoie au plus 10 résultats", async () => {
    const utilisateur = await connecterUtilisateur();
    const beaucoup = Array.from({ length: 15 }, (_, i) => 40_000_000 + i);
    for (const appId of beaucoup) steam.fiches = { ...steam.fiches, [appId]: { type: "game", name: `Jeu ${appId}` } };
    steam.recherches.jeu = beaucoup;

    const { resultats } = await (await rechercher(utilisateur, "jeu")).json();

    expect(resultats).toHaveLength(10);
  });

  it("renvoie une liste vide quand Steam ne trouve rien", async () => {
    const utilisateur = await connecterUtilisateur();

    const { resultats } = await (await rechercher(utilisateur, "zzzzzz")).json();

    expect(resultats).toEqual([]);
  });

  it("refuse un texte trop court sans appeler Steam", async () => {
    const utilisateur = await connecterUtilisateur();

    const reponse = await rechercher(utilisateur, " p ");

    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({ erreur: "tropCourte" });
    expect(steam.requetes).toEqual([]);
  });

  it("répond 502 quand Steam ne répond pas", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.enPanne = true;

    const reponse = await rechercher(utilisateur, "portal");

    expect(reponse.status).toBe(502);
    expect(await reponse.json()).toEqual({ erreur: "steamIndisponible" });
  });

  it("est réservée aux utilisateurs connectés", async () => {
    expect((await appeler("/api/recherche?texte=portal")).status).toBe(401);
  });
});
