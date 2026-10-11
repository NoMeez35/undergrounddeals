import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { PASSAGES_PLANIFIES } from "../src/index.js";
import { ETATS_PRIX } from "../../app/public/suivis.js";
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

// Les relevés des tests partent de l'heure actuelle : un prix vu avant la
// veille serait périmé. QUATORZE_HEURES : 5 minutes après le début de l'heure.
const minutesPlusTard = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);
const QUATORZE_HEURES = minutesPlusTard(new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000), 5);
const uneHeurePlusTard = (date) => minutesPlusTard(date, 60);

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
  vi.restoreAllMocks();
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
        { appId: 620, prix: { etat: "enVente", actuel: "9.69 EUR", initial: null, reduction: 0 } },
        { appId: 378648, prix: { etat: "enVente", actuel: "9.99 EUR", initial: "19.98 EUR", reduction: 50 } },
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
    await releverLesPrix(env, minutesPlusTard(QUATORZE_HEURES, 35));

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

    await releverLesPrix(env, minutesPlusTard(QUATORZE_HEURES, 5));

    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ actuel: "9.99 USD" });
  });

  it("reprend au passage suivant le paquet manqué quand Steam ne répond pas", async () => {
    const utilisateur = await suivant([620]);
    steam.enPanne = true;

    await releverLesPrix(env, QUATORZE_HEURES);
    steam.enPanne = false;
    await releverLesPrix(env, minutesPlusTard(QUATORZE_HEURES, 5));

    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ actuel: "9.69 EUR" });
  });

  it("relève au plus 9 paquets de 100 produits par passage, et poursuit un relevé inachevé l'heure suivante", async () => {
    const utilisateur = await suivant(Array.from({ length: 950 }, (_, i) => 30_000_000 + i));
    const finDHeure = minutesPlusTard(QUATORZE_HEURES, 50);

    await releverLesPrix(env, finDHeure);
    const premierPassage = appelsPrix().length;
    steam.requetes = [];
    await releverLesPrix(env, uneHeurePlusTard(finDHeure));

    expect(premierPassage).toBe(9);
    expect(appelsPrix()).toEqual([`FR ${Array.from({ length: 50 }, (_, i) => 30_000_900 + i).join(",")}`]);
    expect((await lister(utilisateur)).releveLe).toBe(uneHeurePlusTard(finDHeure).toISOString());
  });

  it("reste sous 50 requêtes à la base par passage, même avec beaucoup de pays", async () => {
    const pays = ["AT", "BE", "CA", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "IE", "IT", "NL", "NO", "PL", "PT", "SE", "US"];
    for (const code of pays) await suivant([620], { pays: code });
    const requetes = vi.spyOn(env.DB, "prepare");
    const requetesParPassage = [];

    for (const minutes of [0, 5, 10]) {
      requetes.mockClear();
      await releverLesPrix(env, minutesPlusTard(QUATORZE_HEURES, minutes));
      requetesParPassage.push(requetes.mock.calls.length);
    }

    expect(Math.max(...requetesParPassage)).toBeLessThanOrEqual(50);
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM releves_pays WHERE apres_app_id IS NULL").first();
    expect(n).toBe(pays.length);
  });

  it("relève les autres pays quand un pays échoue", async () => {
    const belge = await suivant([620], { pays: "BE" });
    const francais = await suivant([620], { pays: "FR" });
    const batch = env.DB.batch.bind(env.DB);
    vi.spyOn(env.DB, "batch")
      .mockImplementationOnce(() => Promise.reject(new Error("panne de la base")))
      .mockImplementation(batch);

    await releverLesPrix(env, QUATORZE_HEURES);

    expect((await lister(belge)).produits[0].prix).toBeNull();
    expect((await lister(francais)).produits[0].prix).toMatchObject({ actuel: "9.69 EUR" });
  });

  it("n'affiche plus un prix périmé et marque sa reprise dans l'historique", async () => {
    const utilisateur = await suivant([620]);
    await releverLesPrix(env, QUATORZE_HEURES);
    await env.DB.prepare("UPDATE prix SET vu_le = '2020-01-01'").run();

    const avantReprise = (await lister(utilisateur)).produits[0].prix;
    await releverLesPrix(env, uneHeurePlusTard(QUATORZE_HEURES));

    expect(avantReprise).toBeNull();
    const { results } = await env.DB.prepare("SELECT apres_interruption FROM historique_prix ORDER BY releve_le").all();
    expect(results).toEqual([{ apres_interruption: 1 }, { apres_interruption: 1 }]);
    expect((await lister(utilisateur)).produits[0].prix).toMatchObject({ actuel: "9.69 EUR" });
  });

  it("ne relève plus un produit qui n'est plus suivi", async () => {
    const utilisateur = await suivant([620, 378648]);
    await releverLesPrix(env, QUATORZE_HEURES);
    await env.DB.prepare("DELETE FROM suivis WHERE steam_id = ? AND app_id = 620").bind(utilisateur.steamId).run();
    steam.requetes = [];

    await releverLesPrix(env, uneHeurePlusTard(QUATORZE_HEURES));

    expect(appelsPrix()).toEqual(["FR 378648"]);
  });

  it("la base n'accepte que les états de prix connus", async () => {
    await suivant([620]);
    const inserer = (etat) =>
      env.DB.prepare("INSERT OR REPLACE INTO prix (app_id, pays, etat, depuis) VALUES (620, 'FR', ?, '')").bind(etat).run();

    for (const etat of Object.values(ETATS_PRIX)) await inserer(etat);

    await expect(inserer("soldé")).rejects.toThrow();
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
