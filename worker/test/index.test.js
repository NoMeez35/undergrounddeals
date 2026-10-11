import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

const ORIGINE = "https://exemple.test";
const STEAM_ID = "76561197960287930";
const CINQ_MINUTES = 5 * 60 * 1000;
const CHAMPS_SIGNES = "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle";

let reponsesSteam;

beforeEach(() => {
  reponsesSteam = {
    verification: "ns:http://specs.openid.net/auth/2.0\nis_valid:true\n",
    profil: {
      response: {
        players: [{ personaname: "Gabe", avatarfull: "https://avatars.test/gabe.jpg", loccountrycode: "BE" }],
      },
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (adresse) => {
      const url = String(adresse);
      if (url === "https://steamcommunity.com/openid/login") return new Response(reponsesSteam.verification);
      if (url.startsWith("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/")) {
        return Response.json(reponsesSteam.profil);
      }
      throw new Error(`Requête inattendue : ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function appeler(chemin, { methode = "GET", cookies = [], corps } = {}) {
  const entetes = cookies.length ? { Cookie: cookies.join("; ") } : {};
  return worker.fetch(new Request(`${ORIGINE}${chemin}`, { method: methode, headers: entetes, body: corps }), env);
}

function enregistrerReglages(cookieSession, reglages) {
  return appeler("/api/reglages", { methode: "PUT", cookies: [cookieSession], corps: JSON.stringify(reglages) });
}

// « nom=valeur » de chaque cookie posé par la réponse.
function cookiesPoses(reponse) {
  return reponse.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
}

// Nonce OpenID : date de la réponse de Steam suivie d'un suffixe aléatoire.
function nonce(date = new Date()) {
  return `${date.toISOString().slice(0, 19)}Z${Math.random().toString(36).slice(2)}`;
}

function retourSteam(etat, modifications = {}) {
  const retour = `${ORIGINE}/api/auth/steam/retour?etat=${etat}`;
  const parametres = new URLSearchParams({
    etat,
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "id_res",
    "openid.op_endpoint": "https://steamcommunity.com/openid/login",
    "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
    "openid.return_to": retour,
    "openid.response_nonce": nonce(),
    "openid.assoc_handle": "1234567890",
    "openid.signed": CHAMPS_SIGNES,
    "openid.sig": "signature",
    ...modifications,
  });
  return `/api/auth/steam/retour?${parametres}`;
}

async function demarrerConnexion() {
  const reponse = await appeler("/api/auth/steam");
  const cookieEtat = cookiesPoses(reponse).find((cookie) => cookie.startsWith("ud_etat="));
  return { reponse, cookieEtat, etat: cookieEtat.split("=")[1] };
}

async function seConnecter() {
  const { cookieEtat, etat } = await demarrerConnexion();
  const reponse = await appeler(retourSteam(etat), { cookies: [cookieEtat] });
  const cookieSession = cookiesPoses(reponse).find((cookie) => cookie.startsWith("ud_session="));
  return { reponse, cookieSession };
}

describe("connexion via Steam", () => {
  it("redirige vers Steam avec une adresse de retour liée au navigateur", async () => {
    const { reponse, etat } = await demarrerConnexion();

    expect(reponse.status).toBe(302);
    const steam = new URL(reponse.headers.get("Location"));
    expect(steam.origin + steam.pathname).toBe("https://steamcommunity.com/openid/login");
    expect(steam.searchParams.get("openid.return_to")).toBe(`${ORIGINE}/api/auth/steam/retour?etat=${etat}`);
    expect(steam.searchParams.get("openid.realm")).toBe(ORIGINE);
  });

  it("crée l'utilisateur et ouvre une session quand Steam confirme la réponse", async () => {
    const { reponse, cookieSession } = await seConnecter();

    expect(reponse.status).toBe(302);
    expect(reponse.headers.get("Location")).toBe("/");
    expect(cookieSession).toBeDefined();
    const utilisateur = await env.DB.prepare("SELECT steam_id FROM utilisateurs").first();
    expect(utilisateur).toEqual({ steam_id: STEAM_ID });
  });

  it("refuse une réponse que Steam ne confirme pas", async () => {
    reponsesSteam.verification = "ns:http://specs.openid.net/auth/2.0\nis_valid:false\n";

    const { reponse, cookieSession } = await seConnecter();

    expect(reponse.headers.get("Location")).toBe("/connexion?erreur=steam");
    expect(cookieSession).toBeUndefined();
  });

  it("refuse un retour qui ne vient pas du navigateur ayant lancé la connexion", async () => {
    const { etat } = await demarrerConnexion();

    const reponse = await appeler(retourSteam(etat), { cookies: ["ud_etat=autre"] });

    expect(reponse.headers.get("Location")).toBe("/connexion?erreur=steam");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["l'identité n'est pas couverte par la signature", { "openid.signed": "signed,op_endpoint,return_to" }],
    ["le fournisseur n'est pas Steam", { "openid.op_endpoint": "https://pirate.test/openid/login" }],
    ["l'adresse de retour a été modifiée", { "openid.return_to": "https://pirate.test/retour" }],
    ["l'identité diffère de l'identité revendiquée", { "openid.identity": "https://steamcommunity.com/openid/id/76561197960287931" }],
    ["la réponse de Steam date de plus de 5 minutes", { "openid.response_nonce": nonce(new Date(Date.now() - CINQ_MINUTES - 1000)) }],
    ["l'identité n'est pas un compte Steam", { "openid.claimed_id": "https://pirate.test/id/1", "openid.identity": "https://pirate.test/id/1" }],
  ])("refuse une réponse falsifiée : %s", async (_cas, modifications) => {
    const { cookieEtat, etat } = await demarrerConnexion();

    const reponse = await appeler(retourSteam(etat, modifications), { cookies: [cookieEtat] });

    expect(reponse.headers.get("Location")).toBe("/connexion?erreur=steam");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("GET /api/moi", () => {
  it("renvoie le profil Steam et, à la première connexion, ni pays ni langue", async () => {
    const { cookieSession } = await seConnecter();

    const reponse = await appeler("/api/moi", { cookies: [cookieSession] });

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({
      steamId: STEAM_ID,
      nom: "Gabe",
      avatar: "https://avatars.test/gabe.jpg",
      pays: null,
      langue: null,
      paysProfil: "BE",
    });
  });

  it("ne propose pas de pays si le profil Steam n'en donne pas", async () => {
    delete reponsesSteam.profil.response.players[0].loccountrycode;
    const { cookieSession } = await seConnecter();

    const reponse = await appeler("/api/moi", { cookies: [cookieSession] });

    expect((await reponse.json()).paysProfil).toBeNull();
  });

  it("prolonge la session de 30 jours à chaque visite", async () => {
    const { cookieSession } = await seConnecter();

    const reponse = await appeler("/api/moi", { cookies: [cookieSession] });

    expect(reponse.headers.get("Set-Cookie")).toMatch(/^ud_session=.+; .*Max-Age=2592000/);
  });

  it("répond 401 sans session", async () => {
    const reponse = await appeler("/api/moi");

    expect(reponse.status).toBe(401);
  });

  it("répond 401 si le cookie de session a été modifié", async () => {
    const { cookieSession } = await seConnecter();
    const falsifie = cookieSession.replace(STEAM_ID, "76561197960287931");

    const reponse = await appeler("/api/moi", { cookies: [falsifie] });

    expect(reponse.status).toBe(401);
  });
});

describe("PUT /api/reglages", () => {
  it("enregistre le pays et la langue, que /api/moi renvoie ensuite", async () => {
    const { cookieSession } = await seConnecter();

    const reponse = await enregistrerReglages(cookieSession, { pays: "fr", langue: "fr" });
    const moi = await (await appeler("/api/moi", { cookies: [cookieSession] })).json();

    expect(reponse.status).toBe(204);
    expect(moi).toMatchObject({ pays: "FR", langue: "fr" });
  });

  it("permet de changer de pays et de langue", async () => {
    const { cookieSession } = await seConnecter();
    await enregistrerReglages(cookieSession, { pays: "FR", langue: "fr" });

    await enregistrerReglages(cookieSession, { pays: "US", langue: "en" });

    const utilisateur = await env.DB.prepare("SELECT pays, langue FROM utilisateurs").first();
    expect(utilisateur).toEqual({ pays: "US", langue: "en" });
  });

  it.each([
    ["un pays inconnu", JSON.stringify({ pays: "ZZ", langue: "fr" })],
    ["une langue non traduite", JSON.stringify({ pays: "FR", langue: "de" })],
    ["un réglage manquant", JSON.stringify({ pays: "FR" })],
    ["un corps qui n'est pas du JSON", "pays=FR"],
  ])("refuse %s sans rien modifier", async (_cas, corps) => {
    const { cookieSession } = await seConnecter();
    await enregistrerReglages(cookieSession, { pays: "FR", langue: "fr" });

    const reponse = await appeler("/api/reglages", { methode: "PUT", cookies: [cookieSession], corps });

    expect(reponse.status).toBe(400);
    const utilisateur = await env.DB.prepare("SELECT pays, langue FROM utilisateurs").first();
    expect(utilisateur).toEqual({ pays: "FR", langue: "fr" });
  });

  it("répond 401 sans session", async () => {
    const corps = JSON.stringify({ pays: "FR", langue: "fr" });

    const reponse = await appeler("/api/reglages", { methode: "PUT", corps });

    expect(reponse.status).toBe(401);
  });
});

describe("POST /api/deconnexion", () => {
  it("supprime le cookie de session", async () => {
    const reponse = await appeler("/api/deconnexion", { methode: "POST" });

    expect(reponse.status).toBe(204);
    expect(reponse.headers.get("Set-Cookie")).toMatch(/^ud_session=; .*Max-Age=0/);
  });
});

it("répond 404 aux chemins inconnus", async () => {
  const reponse = await appeler("/api/inconnu");

  expect(reponse.status).toBe(404);
});
