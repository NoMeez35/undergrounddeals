import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { releverLesPrix } from "../src/releve.js";
import { appeler, connecterUtilisateur } from "./outils.js";
import { prixSteam, simulerSteam } from "./steam-simule.js";

const FICHES = {
  620: { type: "game", name: "Portal 2" },
  1500: { type: "game", name: "Jeu à venir", release: { is_coming_soon: true } },
  2108330: { type: "game", name: "F1 23", unlisted: true },
};

// Relevés successifs, une heure d'écart, à partir de l'heure actuelle (un prix
// vu avant la veille serait périmé).
const debutDHeure = Math.floor(Date.now() / 3_600_000) * 3_600_000;
const heure = (n) => new Date(debutDHeure + n * 3_600_000 + 5 * 60 * 1000);

let steam;

beforeEach(async () => {
  steam = { fiches: FICHES, prix: { FR: { 620: prixSteam("EUR", 969) }, US: { 620: prixSteam("USD", 999) } } };
  vi.stubGlobal("fetch", simulerSteam(steam));
  for (const table of ["alertes", "prix", "historique_prix", "releves_pays", "suivis", "utilisateurs"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Utilisateur qui suit les produits donnés (ajoutés directement en base).
async function suivant(appIds, { pays = "FR" } = {}) {
  const utilisateur = await connecterUtilisateur({ pays });
  for (const appId of appIds) {
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, 'jeu', ?)").bind(appId, FICHES[appId].name),
      env.DB.prepare("INSERT INTO suivis (steam_id, app_id, ajoute_le) VALUES (?, ?, ?)").bind(
        utilisateur.steamId,
        appId,
        new Date().toISOString(),
      ),
    ]);
  }
  return utilisateur;
}

async function filDAlertes({ cookie }) {
  const reponse = await appeler("/api/alertes", { cookies: [cookie] });
  expect(reponse.status).toBe(200);
  return (await reponse.json()).alertes;
}

// Relève les prix à chaque heure donnée, en appliquant avant chaque relevé le
// prix de 620 en France : [prix, réduction], ou SANS_PRIX.
const SANS_PRIX = null;
async function releverSuccessivement(prixFrance) {
  for (const [n, releve] of prixFrance.entries()) {
    if (releve === SANS_PRIX) delete steam.prix.FR[620];
    else steam.prix.FR[620] = prixSteam("EUR", ...releve);
    await releverLesPrix(env, heure(n));
  }
}

describe("alerte de début de promo", () => {
  it("prévient chaque utilisateur du pays qui suit le produit, une seule fois", async () => {
    const premier = await suivant([620]);
    const second = await suivant([620]);
    const americain = await suivant([620], { pays: "US" });

    await releverSuccessivement([
      [969, 0],
      [484, 50],
    ]);

    for (const utilisateur of [premier, second]) {
      expect(await filDAlertes(utilisateur)).toEqual([
        {
          id: expect.any(Number),
          evenements: ["debutPromo"],
          appId: 620,
          nom: "Portal 2",
          creeLe: heure(1).toISOString(),
          prix: { actuel: "4.84 EUR", initial: "9.68 EUR", reduction: 50 },
        },
      ]);
    }
    expect(await filDAlertes(americain)).toEqual([]);
  });

  it("ne prévient pas de nouveau tant que la promo continue, même si la réduction change", async () => {
    const utilisateur = await suivant([620]);

    await releverSuccessivement([
      [969, 0],
      [484, 50],
      [387, 60],
      [387, 60],
    ]);

    expect(await filDAlertes(utilisateur)).toHaveLength(1);
  });

  it("prévient de nouveau quand une promo reprend après une interruption", async () => {
    const utilisateur = await suivant([620]);

    await releverSuccessivement([
      [969, 0],
      [484, 50],
      [969, 0],
      [484, 50],
    ]);

    expect((await filDAlertes(utilisateur)).map(({ creeLe }) => creeLe)).toEqual([heure(3).toISOString(), heure(1).toISOString()]);
  });

  it("compte une réduction de lancement comme un début de promo", async () => {
    const utilisateur = await suivant([1500]);
    await releverLesPrix(env, heure(0));
    steam.prix.FR[1500] = prixSteam("EUR", 1799, 10);

    await releverLesPrix(env, heure(1));

    expect(await filDAlertes(utilisateur)).toMatchObject([{ appId: 1500, prix: { reduction: 10 } }]);
  });

  it("ne prévient pas d'une promo déjà en cours au premier relevé", async () => {
    const utilisateur = await suivant([620]);

    await releverSuccessivement([
      [484, 50],
      [484, 50],
    ]);

    expect(await filDAlertes(utilisateur)).toEqual([]);
  });

  it("ne prévient pas d'une promo commencée pendant que le prix n'était plus relevé", async () => {
    const utilisateur = await suivant([620]);
    await releverSuccessivement([[969, 0]]);
    await env.DB.prepare("UPDATE prix SET vu_le = '2020-01-01'").run();

    steam.prix.FR[620] = prixSteam("EUR", 484, 50);
    await releverLesPrix(env, heure(1));

    expect(await filDAlertes(utilisateur)).toEqual([]);
  });

  it("ne prévient pas d'une promo déjà en cours dans le nouveau pays d'un utilisateur", async () => {
    await suivant([620], { pays: "US" });
    const voyageur = await suivant([620]);
    steam.prix.US[620] = prixSteam("USD", 999);
    await releverLesPrix(env, heure(0));
    steam.prix.US[620] = prixSteam("USD", 499, 50);
    await releverLesPrix(env, heure(1));

    await appeler("/api/reglages", {
      methode: "PUT",
      cookies: [voyageur.cookie],
      corps: JSON.stringify({ pays: "US", langue: "fr" }),
    });
    await releverLesPrix(env, heure(2));

    expect(await filDAlertes(voyageur)).toEqual([]);
  });

  it("ne prévient pas de nouveau quand Steam omet un prix pendant la promo", async () => {
    const utilisateur = await suivant([620]);

    await releverSuccessivement([[969, 0], [484, 50], SANS_PRIX, [484, 50]]);

    expect(await filDAlertes(utilisateur)).toHaveLength(1);
  });

  it("prévient quand une promo commence après une période sans prix", async () => {
    const utilisateur = await suivant([620]);

    await releverSuccessivement([[969, 0], SANS_PRIX, [484, 50]]);

    expect(await filDAlertes(utilisateur)).toHaveLength(1);
  });

  it("ne prévient pas pour un produit qui n'est plus en vente ou qui est retiré de Steam", async () => {
    const utilisateur = await suivant([620, 2108330]);
    steam.prix.FR[2108330] = prixSteam("EUR", 1999);
    await releverSuccessivement([[969, 0]]);
    delete steam.prix.FR[620];
    delete steam.prix.FR[2108330];

    await releverLesPrix(env, heure(1));

    expect(await filDAlertes(utilisateur)).toEqual([]);
    const { retire_de_steam } = await env.DB.prepare("SELECT retire_de_steam FROM produits WHERE app_id = 2108330").first();
    expect(retire_de_steam).toBe(1);
  });

  it("ne prévient pas un utilisateur qui a quitté le pays de la promo", async () => {
    await suivant([620]);
    const voyageur = await suivant([620]);
    await releverSuccessivement([[969, 0]]);
    await appeler("/api/reglages", {
      methode: "PUT",
      cookies: [voyageur.cookie],
      corps: JSON.stringify({ pays: "US", langue: "fr" }),
    });

    steam.prix.FR[620] = prixSteam("EUR", 484, 50);
    await releverLesPrix(env, heure(1));

    expect(await filDAlertes(voyageur)).toEqual([]);
  });

  it("ne prévient plus pour un produit qui n'est plus suivi", async () => {
    const utilisateur = await suivant([620]);
    await releverSuccessivement([[969, 0]]);
    await env.DB.prepare("DELETE FROM suivis WHERE steam_id = ?").bind(utilisateur.steamId).run();

    await releverSuccessivement([[484, 50]]);

    expect(await filDAlertes(utilisateur)).toEqual([]);
  });
});

describe("fil d'alertes", () => {
  it("liste les alertes de l'utilisateur, de la plus récente à la plus ancienne", async () => {
    steam.prix.FR[1500] = prixSteam("EUR", 1999);
    const utilisateur = await suivant([620, 1500]);
    await releverSuccessivement([
      [969, 0],
      [484, 50],
    ]);
    steam.prix.FR[1500] = prixSteam("EUR", 999, 50);
    await releverLesPrix(env, heure(2));

    expect((await filDAlertes(utilisateur)).map(({ appId }) => appId)).toEqual([1500, 620]);
  });

  it("est réservé aux utilisateurs connectés", async () => {
    expect((await appeler("/api/alertes")).status).toBe(401);
  });
});
