import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import { synchroniserSouhaits } from "../src/souhaits.js";
import { appeler, connecterUtilisateur } from "./outils.js";
import { simulerSteam } from "./steam-simule.js";

// Jeux factices pour remplir la limite de suivi : AppID 20 000 000 et suivants.
const PREMIER_JEU_FACTICE = 20_000_000;
const jeuxFactices = (nombre) => Array.from({ length: nombre }, (_, i) => PREMIER_JEU_FACTICE + i);

const FICHES = {
  620: { type: "game", name: "Portal 2" },
  730: { type: "game", name: "Counter-Strike 2" },
  1400: { type: "game", name: "Half-Life" },
  378648: { type: "dlc", name: "The Witcher 3: Wild Hunt - Blood and Wine" },
  378649: { type: "dlc", name: "The Witcher 3: Wild Hunt - Hearts of Stone" },
  323180: { type: "music", name: "Portal 2 Soundtrack" },
  1250: { type: "dlc", name: "Pack de skins gratuit", is_free: true },
  ...Object.fromEntries(jeuxFactices(202).map((appId) => [appId, { type: "game", name: `Jeu ${appId}` }])),
};

let steam;

beforeEach(() => {
  steam = { fiches: FICHES, souhaits: {} };
  vi.stubGlobal("fetch", simulerSteam(steam));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function synchroniser({ steamId }, appIds) {
  steam.souhaits[steamId] = appIds;
  await synchroniserSouhaits(env, steamId, "FR");
}

async function lister({ cookie }) {
  return (await appeler("/api/suivis", { cookies: [cookie] })).json();
}

const appIdsDe = (produits) => produits.map((produit) => produit.appId);

describe("synchronisation de la liste de souhaits", () => {
  it("suit les produits par ordre de priorité jusqu'à la limite, jeux et DLC séparément", async () => {
    const utilisateur = await connecterUtilisateur();

    await synchroniser(utilisateur, [378648, ...jeuxFactices(202), 378649]);

    const { produits, nonSuivis, souhaitsVisibles } = await lister(utilisateur);
    expect(souhaitsVisibles).toBe(true);
    expect(appIdsDe(produits.filter((produit) => produit.type === "jeu"))).toEqual(jeuxFactices(200));
    expect(appIdsDe(produits.filter((produit) => produit.type === "dlc"))).toEqual([378648, 378649]);
    expect(nonSuivis).toMatchObject([
      { appId: PREMIER_JEU_FACTICE + 200, ecarte: false },
      { appId: PREMIER_JEU_FACTICE + 201, ecarte: false },
    ]);
  });

  it("ignore les packs, les bandes-son, les DLC gratuits et les produits inconnus", async () => {
    const utilisateur = await connecterUtilisateur();

    await synchroniser(utilisateur, [323180, 620, 1250, 999999]);

    const { produits, nonSuivis } = await lister(utilisateur);
    expect(appIdsDe(produits)).toEqual([620]);
    expect(nonSuivis).toEqual([]);
  });

  it("ne suit plus un produit sorti de la liste, sauf s'il a aussi été ajouté à la main", async () => {
    const utilisateur = await connecterUtilisateur();
    await synchroniser(utilisateur, [620, 730]);
    await appeler("/api/suivis", { methode: "POST", cookies: [utilisateur.cookie], corps: '{"lien":"730"}' });

    await synchroniser(utilisateur, [1400]);

    expect(appIdsDe((await lister(utilisateur)).produits).sort()).toEqual([1400, 730]);
  });

  it("ne retire rien et le signale si la liste est vide ou privée", async () => {
    const utilisateur = await connecterUtilisateur();
    await synchroniser(utilisateur, [620]);

    await synchroniser(utilisateur, undefined);

    const { produits, souhaitsVisibles } = await lister(utilisateur);
    expect(souhaitsVisibles).toBe(false);
    expect(appIdsDe(produits)).toEqual([620]);
  });

  it("ne suit plus d'elle-même un produit que l'utilisateur a retiré", async () => {
    const utilisateur = await connecterUtilisateur();
    await synchroniser(utilisateur, [620, 730]);
    await appeler("/api/suivis/620", { methode: "DELETE", cookies: [utilisateur.cookie] });

    await synchroniser(utilisateur, [620, 730]);

    const { produits, nonSuivis } = await lister(utilisateur);
    expect(appIdsDe(produits)).toEqual([730]);
    expect(nonSuivis).toMatchObject([{ appId: 620, ecarte: true }]);
  });
});

describe("suivre un produit non suivi de la liste de souhaits", () => {
  it("le suit à nouveau s'il avait été retiré", async () => {
    const utilisateur = await connecterUtilisateur();
    await synchroniser(utilisateur, [620]);
    await appeler("/api/suivis/620", { methode: "DELETE", cookies: [utilisateur.cookie] });

    const reponse = await appeler("/api/souhaits/620", { methode: "POST", cookies: [utilisateur.cookie] });

    expect(reponse.status).toBe(201);
    const { produits, nonSuivis } = await lister(utilisateur);
    expect(appIdsDe(produits)).toEqual([620]);
    expect(nonSuivis).toEqual([]);
  });

  it("l'échange contre un produit suivi quand la limite est atteinte", async () => {
    const utilisateur = await connecterUtilisateur();
    await synchroniser(utilisateur, jeuxFactices(201));
    const enTrop = PREMIER_JEU_FACTICE + 200;
    const suivre = () => appeler(`/api/souhaits/${enTrop}`, { methode: "POST", cookies: [utilisateur.cookie] });

    const refuse = await suivre();
    await appeler(`/api/suivis/${PREMIER_JEU_FACTICE}`, { methode: "DELETE", cookies: [utilisateur.cookie] });
    const accepte = await suivre();

    expect(refuse.status).toBe(409);
    expect(accepte.status).toBe(201);
    const { produits, nonSuivis } = await lister(utilisateur);
    expect(appIdsDe(produits)).toContain(enTrop);
    expect(nonSuivis).toMatchObject([{ appId: PREMIER_JEU_FACTICE, ecarte: true }]);
  });

  it("refuse un produit qui n'est pas dans la liste de souhaits", async () => {
    const utilisateur = await connecterUtilisateur();

    const reponse = await appeler("/api/souhaits/620", { methode: "POST", cookies: [utilisateur.cookie] });

    expect(reponse.status).toBe(404);
  });
});

describe("POST /api/souhaits/relire", () => {
  it("relit la liste tout de suite, mais pas deux fois dans la même minute", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.souhaits[utilisateur.steamId] = [620];
    const relire = () => appeler("/api/souhaits/relire", { methode: "POST", cookies: [utilisateur.cookie] });

    const premiere = await relire();
    const seconde = await relire();

    expect(premiere.status).toBe(204);
    expect(seconde.status).toBe(429);
    expect(appIdsDe((await lister(utilisateur)).produits)).toEqual([620]);
  });

  it("répond 502 si Steam ne répond pas", async () => {
    const utilisateur = await connecterUtilisateur();
    steam.enPanne = true;

    const reponse = await appeler("/api/souhaits/relire", { methode: "POST", cookies: [utilisateur.cookie] });

    expect(reponse.status).toBe(502);
  });
});

describe("passage planifié", () => {
  async function passagePlanifie() {
    const taches = [];
    await worker.scheduled({}, env, { waitUntil: (tache) => taches.push(tache) });
    await Promise.all(taches);
  }

  // Seul l'utilisateur du test est en retard : les autres viennent d'être lus.
  async function seulEnRetard(utilisateur) {
    await env.DB.prepare("UPDATE utilisateurs SET souhaits_lus_le = ?").bind(new Date().toISOString()).run();
    await env.DB.prepare("UPDATE utilisateurs SET souhaits_lus_le = ? WHERE steam_id = ?")
      .bind(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), utilisateur.steamId)
      .run();
  }

  it("synchronise les listes qui n'ont pas été lues depuis un jour", async () => {
    const utilisateur = await connecterUtilisateur();
    await seulEnRetard(utilisateur);
    steam.souhaits[utilisateur.steamId] = [620];

    await passagePlanifie();

    expect(appIdsDe((await lister(utilisateur)).produits)).toEqual([620]);
  });

  it("reporte au lendemain un utilisateur quand Steam ne répond pas", async () => {
    const utilisateur = await connecterUtilisateur();
    await seulEnRetard(utilisateur);
    steam.enPanne = true;

    await passagePlanifie();

    const { souhaits_lus_le } = await env.DB.prepare("SELECT souhaits_lus_le FROM utilisateurs WHERE steam_id = ?")
      .bind(utilisateur.steamId)
      .first();
    expect(Date.now() - Date.parse(souhaits_lus_le)).toBeLessThan(60 * 1000);
  });
});
