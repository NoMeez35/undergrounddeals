import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TYPES_PRODUIT } from "../../app/public/suivis.js";
import { appeler, connecterUtilisateur } from "./outils.js";
import { simulerSteam } from "./steam-simule.js";

// Boutique Steam simulée : fiches des produits et prix par pays.
const FICHES = {
  620: { type: "game", name: "Portal 2" },
  378648: { type: "dlc", name: "The Witcher 3: Wild Hunt - Blood and Wine" },
  323180: { type: "music", name: "Portal 2 Soundtrack" },
  // Ancien AppID que Steam redirige vers un autre.
  400: { type: "game", name: "Portal", appid: 401 },
  // Jamais ajouté ailleurs : sa fiche n'est connue que de Steam.
  730: { type: "game", name: "Counter-Strike 2" },
  // DLC gratuit : un DLC suivi est payant.
  1250: { type: "dlc", name: "Skins gratuits", is_free: true },
  // Fiche incomplète : Steam répond sans nom.
  1300: { type: "game" },
  // Jamais ajoutés ailleurs : pour les ajouts simultanés.
  1400: { type: "game", name: "Half-Life" },
};

function prix(devise, centimes, reduction = 0) {
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

const PRIX = {
  FR: { 620: prix("EUR", 969), 378648: prix("EUR", 999, 50) },
  US: { 620: prix("USD", 999) },
};

let steam;

beforeEach(() => {
  steam = { fiches: FICHES, prix: PRIX };
  vi.stubGlobal("fetch", simulerSteam(steam));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ajouter(cookie, lien) {
  return appeler("/api/suivis", { methode: "POST", cookies: [cookie], corps: JSON.stringify({ lien }) });
}

async function lister(cookie) {
  return (await appeler("/api/suivis", { cookies: [cookie] })).json();
}

// Remplit la limite de suivi avec des jeux factices, directement en base.
async function remplirLimite(steamId, premierAppId) {
  const requetes = [];
  for (let i = 0; i < 200; i++) {
    const appId = premierAppId + i;
    requetes.push(
      env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, 'jeu', ?)").bind(appId, `Jeu ${i}`),
      env.DB.prepare("INSERT INTO suivis (steam_id, app_id, ajoute_le) VALUES (?, ?, ?)").bind(
        steamId,
        appId,
        new Date(2026, 0, 1, 0, 0, i).toISOString(),
      ),
    );
  }
  await env.DB.batch(requetes);
}

describe("ajout manuel", () => {
  it("range un jeu dans les jeux et un DLC dans les DLC", async () => {
    const { cookie } = await connecterUtilisateur();

    expect((await ajouter(cookie, "620")).status).toBe(201);
    expect((await ajouter(cookie, "https://store.steampowered.com/app/378648/Blood_and_Wine/")).status).toBe(201);

    const { produits } = await lister(cookie);
    expect(produits.map(({ appId, type }) => ({ appId, type }))).toEqual([
      { appId: 378648, type: "dlc" },
      { appId: 620, type: "jeu" },
    ]);
  });

  it.each([
    ["un lien de la communauté Steam", "https://steamcommunity.com/app/620"],
    ["un lien avec vérification de l'âge", "store.steampowered.com/agecheck/app/620/"],
    ["un AppID entouré d'espaces", "  620 "],
  ])("accepte %s", async (_cas, lien) => {
    const { cookie } = await connecterUtilisateur();

    const reponse = await ajouter(cookie, lien);

    expect(reponse.status).toBe(201);
    expect((await reponse.json()).produit).toMatchObject({ appId: 620, nom: "Portal 2" });
  });

  it.each([
    ["un pack (sub)", "https://store.steampowered.com/sub/7932/", 422, "pack"],
    ["un pack (bundle)", "https://store.steampowered.com/bundle/232/Valve_Complete_Pack/", 422, "pack"],
    ["un lien qui n'est pas de Steam", "https://exemple.test/app/620", 400, "lienInvalide"],
    ["un texte quelconque", "Portal 2", 400, "lienInvalide"],
    ["un produit inexistant", "999999", 404, "introuvable"],
    ["une bande-son", "323180", 422, "typeNonSuivi"],
    ["un DLC gratuit", "1250", 422, "typeNonSuivi"],
    ["une fiche Steam incomplète", "1300", 404, "introuvable"],
  ])("refuse %s avec un message clair", async (_cas, lien, status, erreur) => {
    const { cookie } = await connecterUtilisateur();

    const reponse = await ajouter(cookie, lien);

    expect(reponse.status).toBe(status);
    expect(await reponse.json()).toMatchObject({ erreur });
    expect((await lister(cookie)).produits).toEqual([]);
  });

  it("ne crée pas de doublon quand on ajoute deux fois le même produit", async () => {
    const { cookie } = await connecterUtilisateur();
    await ajouter(cookie, "620");

    const reponse = await ajouter(cookie, "https://store.steampowered.com/app/620/");

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toMatchObject({ dejaSuivi: true });
    expect((await lister(cookie)).produits).toHaveLength(1);
  });

  it("répond « déjà suivi » au second de deux ajouts simultanés du même produit", async () => {
    const { cookie } = await connecterUtilisateur();

    const reponses = await Promise.all([ajouter(cookie, "1400"), ajouter(cookie, "1400")]);

    expect(reponses.map((reponse) => reponse.status).sort()).toEqual([200, 201]);
    expect((await lister(cookie)).produits).toHaveLength(1);
  });

  it("suit l'AppID que Steam indique quand l'ancien est redirigé", async () => {
    const { cookie } = await connecterUtilisateur();

    await ajouter(cookie, "400");

    expect((await lister(cookie)).produits).toMatchObject([{ appId: 401, nom: "Portal" }]);
  });

  it("répond 502 si Steam ne répond pas pour un produit encore inconnu", async () => {
    const { cookie } = await connecterUtilisateur();
    steam.enPanne = true;

    const reponse = await ajouter(cookie, "730");

    expect(reponse.status).toBe(502);
    expect(await reponse.json()).toMatchObject({ erreur: "steamIndisponible" });
  });
});

describe("limite de suivi", () => {
  it("refuse un 201e jeu en invitant à libérer une place, mais accepte encore un DLC", async () => {
    const { steamId, cookie } = await connecterUtilisateur();
    await remplirLimite(steamId, 2_000_000);

    const jeu = await ajouter(cookie, "620");
    const dlc = await ajouter(cookie, "378648");

    expect(jeu.status).toBe(409);
    expect(await jeu.json()).toEqual({ erreur: "limiteAtteinte", type: "jeu", limite: 200 });
    expect(dlc.status).toBe(201);
  });

  it("ne compte pas les produits retirés de Steam", async () => {
    const { steamId, cookie } = await connecterUtilisateur();
    await remplirLimite(steamId, 3_000_000);
    await env.DB.prepare("UPDATE produits SET retire_de_steam = 1 WHERE app_id = ?").bind(3_000_000).run();

    const reponse = await ajouter(cookie, "620");

    expect(reponse.status).toBe(201);
  });

  it("libère une place quand on retire un produit", async () => {
    const { steamId, cookie } = await connecterUtilisateur();
    await remplirLimite(steamId, 4_000_000);
    await appeler("/api/suivis/4000000", { methode: "DELETE", cookies: [cookie] });

    const reponse = await ajouter(cookie, "620");

    expect(reponse.status).toBe(201);
  });
});

describe("Mes suivis", () => {
  it("affiche le prix et la réduction dans le pays de l'utilisateur", async () => {
    const { cookie } = await connecterUtilisateur({ pays: "FR" });
    await ajouter(cookie, "620");
    await ajouter(cookie, "378648");

    const suivis = await lister(cookie);

    expect(suivis).toMatchObject({ limite: 200, prixDisponibles: true });
    expect(suivis.produits.map(({ appId, prix }) => ({ appId, prix }))).toEqual([
      { appId: 378648, prix: { actuel: "9.99 EUR", initial: "19.98 EUR", reduction: 50 } },
      { appId: 620, prix: { actuel: "9.69 EUR", initial: null, reduction: 0 } },
    ]);
  });

  it("affiche les prix du nouveau pays après un changement dans les Réglages", async () => {
    const { cookie } = await connecterUtilisateur({ pays: "FR" });
    await ajouter(cookie, "620");

    await appeler("/api/reglages", {
      methode: "PUT",
      cookies: [cookie],
      corps: JSON.stringify({ pays: "US", langue: "fr" }),
    });

    const { produits } = await lister(cookie);
    expect(produits[0].prix).toMatchObject({ actuel: "9.99 USD" });
    expect(steam.requetes.at(-1).searchParams.get("cc")).toBe("US");
  });

  it("indique un produit sans prix dans le pays", async () => {
    const { cookie } = await connecterUtilisateur({ pays: "US" });
    await ajouter(cookie, "378648");

    const { produits } = await lister(cookie);

    expect(produits[0].prix).toBeNull();
  });

  it("liste les produits sans prix si Steam ne répond pas", async () => {
    const { cookie } = await connecterUtilisateur();
    await ajouter(cookie, "620");
    steam.enPanne = true;

    const suivis = await lister(cookie);

    expect(suivis.prixDisponibles).toBe(false);
    expect(suivis.produits).toMatchObject([{ appId: 620, prix: null }]);
  });

  it("demande les prix de tous les produits en une seule requête", async () => {
    const { cookie } = await connecterUtilisateur();
    await ajouter(cookie, "620");
    await ajouter(cookie, "378648");
    steam.requetes = [];

    await lister(cookie);

    expect(steam.requetes).toHaveLength(1);
    expect(steam.requetes[0].searchParams.get("appids").split(",").sort()).toEqual(["378648", "620"]);
  });

  it("retire un produit", async () => {
    const { cookie } = await connecterUtilisateur();
    await ajouter(cookie, "620");

    const reponse = await appeler("/api/suivis/620", { methode: "DELETE", cookies: [cookie] });

    expect(reponse.status).toBe(204);
    expect((await lister(cookie)).produits).toEqual([]);
  });

  it("ne montre que les produits de l'utilisateur", async () => {
    const alice = await connecterUtilisateur();
    const bob = await connecterUtilisateur();
    await ajouter(alice.cookie, "620");

    expect((await lister(bob.cookie)).produits).toEqual([]);
  });
});

it.each([
  ["GET", "/api/suivis"],
  ["POST", "/api/suivis"],
  ["DELETE", "/api/suivis/620"],
])("%s %s répond 401 sans session", async (methode, chemin) => {
  const reponse = await appeler(chemin, { methode });

  expect(reponse.status).toBe(401);
});

it("la base n'accepte que les types de produits suivis", async () => {
  for (const type of TYPES_PRODUIT) {
    await env.DB.prepare("INSERT INTO produits (app_id, type, nom) VALUES (?, ?, 'Test')").bind(5_000_000 + TYPES_PRODUIT.indexOf(type), type).run();
  }

  await expect(
    env.DB.prepare("INSERT INTO produits (app_id, type, nom) VALUES (5000100, 'pack', 'Test')").run(),
  ).rejects.toThrow();
});
