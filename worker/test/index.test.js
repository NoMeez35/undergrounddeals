import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("GET /api/statut et chemins inconnus", () => {
  it("renvoie le message lu en base D1", async () => {
    const reponse = await SELF.fetch("https://exemple.test/api/statut");

    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ message: "undergrounddeals est en ligne" });
  });

  it("répond 404 aux chemins inconnus", async () => {
    const reponse = await SELF.fetch("https://exemple.test/api/inconnu");

    expect(reponse.status).toBe(404);
  });
});
