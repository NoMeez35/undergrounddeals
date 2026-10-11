import { describe, expect, it } from "vitest";
import { creerCookieSession, lireSession } from "../src/session.js";

const SECRET = "secret-de-test";
const STEAM_ID = "76561197960287930";
const UN_JOUR = 24 * 60 * 60 * 1000;

function requeteAvec(entete) {
  return new Request("https://exemple.test/", { headers: { Cookie: entete.split(";")[0] } });
}

describe("session", () => {
  it("reste valable entre deux visites, jusqu'à 30 jours", async () => {
    const maintenant = Date.UTC(2026, 9, 11);
    const cookie = await creerCookieSession(STEAM_ID, SECRET, maintenant);

    expect(await lireSession(requeteAvec(cookie), SECRET, maintenant + 29 * UN_JOUR)).toBe(STEAM_ID);
    expect(await lireSession(requeteAvec(cookie), SECRET, maintenant + 31 * UN_JOUR)).toBeNull();
  });

  it("est refusée si elle a été signée avec un autre secret", async () => {
    const cookie = await creerCookieSession(STEAM_ID, "autre-secret");

    expect(await lireSession(requeteAvec(cookie), SECRET)).toBeNull();
  });

  it("est refusée si le cookie est mal formé", async () => {
    expect(await lireSession(requeteAvec("ud_session=n.importe.quoi!"), SECRET)).toBeNull();
    expect(await lireSession(requeteAvec("ud_session=abc"), SECRET)).toBeNull();
  });
});
