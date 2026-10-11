import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { PASSAGES_PLANIFIES } from "../src/index.js";
import { releverLesPrix } from "../src/releve.js";
import configuration from "../wrangler.jsonc?raw";
import { appeler, connecterUtilisateur } from "./outils.js";
import { prixSteam, simulerSteam } from "./steam-simule.js";

const FICHES = {
  620: { type: "game", name: "Portal 2" },
  730: { type: "game", name: "Counter-Strike 2" },
  378648: { type: "dlc", name: "The Witcher 3: Wild Hunt - Blood and Wine" },
  1500: { type: "game", name: "Jeu à venir", is_free: true, release: { is_coming_soon: true } },
  570: { type: "game", name: "Dota 2", is_free: true },
  2108330: { type: "game", name: "F1 23", unlisted: true },
};

const QUATORZE_HEURES = new Date("2026-10-11T14:05:00Z");
const uneHeurePlusTard = (date) => new Date(date.getTime() + 60 * 60 * 1000);

let steam;

beforeEach(async () => {
  steam = {
    fiches: FICHES,
    prix: {
      FR: { 620: prixSteam("EUR", 969), 378648: prixSteam("EUR", 999, 50) },
      US: { 620: prixSteam("USD", 999), 378648: prixSteam("USD", 1999) },
    },
  };
  vi.stubGlobal("fetch", simulerSteam(steam));
  // Chaque test part d'une base sans utilisateurs ni relevés.
  for (const table of ["prix", "historique_prix", "releves_pays", "suivis", "souhaits", "utilisateurs"]) {
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
    const nom = FICHES[appId]?.name ?? `Jeu ${appId}`;
    const type = FICHES[appId]?.type === "dlc" ? "dlc" : "jeu";
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, ?, ?)").bind(appId, type, nom),
      env.DB.prepare("INSERT INTO suivis (steam_id, app_id, ajoute_le) VALUES (?, ?, ?)").bind(
        utilisateur.steamId,
        appId,
        new Date().toISOString(),
      ),
    ]);
  }
  return utilisateur;
}

async function lister({ cookie }) {
  return (await appeler("/api/suivis", { cookies: [cookie] })).json();
}

const appelsPrix = () =>
  steam.requetes
    .filter((url) => url.pathname === "/api/appdetails")
    .map((url) => `${url.searchParams.get("cc")} ${url.searchParams.get("appids")}`);

describe("relevé des prix", () => {
  it("relève chaque couple (produit, pays) une seule fois, pour les seuls pays ayant des utilisateurs", async () => {
    await suivant([620]);
    await suivant([620], { pays: "FR" });
    await suivant([378648, 620], { pays: "US" });
    const sansPays = await suivant([730]);
    await env.DB.prepare("UPDATE utilisateurs SET pays = NULL WHERE steam_id = ?").bind(sansPays.steamId).run();

    await releverLesPrix(env, QUATORZE_HEURES);

    expect(appelsPrix()).toEqual(["FR 620", "US 620,378648"]);
  });

  it("affiche dans Mes suivis le dernier prix relevé et l'heure du relevé", async () => {
    const utilisateur = await suivant([620, 378648]);

    await releverLesPrix(env, QUATORZE_HEURES);

    const { produits, releveLe } = await lister(utilisateur);
    expect(releveLe).toBe(QUATORZE_HEURES.toISOString());
    expect(produits.map(({ appId, prix }) => ({ appId, prix }))).toEqual(
      expect.arrayContaining([
        { appId: 620, prix: { etat: "enVente", actuel: "9.69 EUR", initial: null, reduction: 0, depuis: QUATORZE_HEURES.toISOString() } },
        {
          appId: 378648,
          prix: { etat: "enVente", actuel: "9.99 EUR", initial: "19.98 EUR", reduction: 50, depuis: QUATORZE_HEURES.toISOString() },
        },
      ]),
    );
  });

  it("indique un produit pas encore relevé", async () => {
    const utilisateur = await suivant([620]);

    const { produits, releveLe } = await lister(utilisateur);

    expect(releveLe).toBeNull();
    expect(produits[0].prix).toBeNull();
  });

  it("distingue pas encore sorti, gratuit, pas en vente dans le pays, et retiré de Steam", async () => {
    const utilisateur = await suivant([1500, 570, 730, 2108330]);

    await releverLesPrix(env, QUATORZE_HEURES);

    const { produits } = await lister(utilisateur);
    const etats = Object.fromEntries(produits.map((p) => [p.appId, [p.prix.etat, p.retireDeSteam]]));
    expect(etats).toEqual({
      1500: ["pasEncoreSorti", false],
      570: ["gratuit", false],
      730: ["sansPrix", false],
      2108330: ["sansPrix", true],
    });
  });

  it("ne marque plus retiré de Steam un produit de nouveau en vente", async () => {
    const utilisateur = await suivant([2108330]);
    await releverLesPrix(env, QUATORZE_HEURES);
    steam.prix.FR[2108330] = prixSteam("EUR", 1999);

    await releverLesPrix(env, uneHeurePlusTard(QUATORZE_HEURES));

    expect((await lister(utilisateur)).produits[0]).toMatchObject({ retireDeSteam: false, prix: { etat: "enVente" } });
  });

  it("ne garde dans l'historique que les changements de prix", async () => {
    await suivant([620]);
    const historique = async () =>
      (await env.DB.prepare("SELECT releve_le, prix, reduction FROM historique_prix ORDER BY releve_le").all()).results;

    await releverLesPrix(env, QUATORZE_HEURES);
    await releverLesPrix(env, uneHeurePlusTard(QUATORZE_HEURES));
    steam.prix.FR[620] = prixSteam("EUR", 484, 50);
    const seizeHeures = uneHeurePlusTard(uneHeurePlusTard(QUATORZE_HEURES));
    await releverLesPrix(env, seizeHeures);

    expect(await historique()).toEqual([
      { releve_le: QUATORZE_HEURES.toISOString(), prix: 969, reduction: 0 },
      { releve_le: seizeHeures.toISOString(), prix: 484, reduction: 50 },
    ]);
  });

  it("ne relève un pays qu'une fois par heure", async () => {
    await suivant([620]);

    await releverLesPrix(env, QUATORZE_HEURES);
    await releverLesPrix(env, new Date("2026-10-11T14:40:00Z"));

    expect(appelsPrix()).toHaveLength(1);
  });

  it("relève le nouveau pays d'un utilisateur dès le passage suivant", async () => {
    const utilisateur = await suivant([620]);
    await releverLesPrix(env, QUATORZE_HEURES);
    await appeler("/api/reglages", {
      methode: "PUT",
      cookies: [utilisateur.cookie],
      corps: JSON.stringify({ pays: "US", langue: "fr" }),
    });

    await releverLesPrix(env, new Date("2026-10-11T14:10:00Z"));

    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ actuel: "9.99 USD" });
  });

  it("reprend au passage suivant le paquet manqué quand Steam ne répond pas", async () => {
    const utilisateur = await suivant([620]);
    steam.enPanne = true;

    await releverLesPrix(env, QUATORZE_HEURES);
    steam.enPanne = false;
    await releverLesPrix(env, new Date("2026-10-11T14:10:00Z"));

    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ actuel: "9.69 EUR" });
  });

  it("relève au plus 8 paquets de 100 produits par passage, la suite au passage suivant", async () => {
    await suivant(Array.from({ length: 850 }, (_, i) => 30_000_000 + i));

    await releverLesPrix(env, QUATORZE_HEURES);
    const premierPassage = appelsPrix().length;
    steam.requetes = [];
    await releverLesPrix(env, new Date("2026-10-11T14:10:00Z"));

    expect(premierPassage).toBe(8);
    expect(appelsPrix()).toHaveLength(1);
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM prix").first();
    expect(n).toBe(850);
  });
});

describe("passages planifiés", () => {
  it("chaque expression cron de wrangler.jsonc a sa tâche", () => {
    const crons = JSON.parse(configuration.replace(/^\s*\/\/.*$/gm, "")).triggers.crons;

    expect(crons.sort()).toEqual(Object.keys(PASSAGES_PLANIFIES).sort());
  });

  it("le passage de 5 minutes relève les prix", async () => {
    const utilisateur = await suivant([620]);
    const taches = [];

    await worker.scheduled({ cron: "*/5 * * * *" }, env, { waitUntil: (tache) => taches.push(tache) });
    await Promise.all(taches);

    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ etat: "enVente" });
  });
});
