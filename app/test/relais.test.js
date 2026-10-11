import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/[[chemin]].js";

describe("relais /api", () => {
  it("transmet la requête au Worker et renvoie sa réponse", async () => {
    const recues = [];
    const env = {
      API: {
        fetch: async (requete) => {
          recues.push(requete);
          return new Response("réponse du Worker", { status: 201 });
        },
      },
    };
    const requete = new Request("https://exemple.test/api/statut");

    const reponse = await onRequest({ request: requete, env });

    expect(recues).toEqual([requete]);
    expect(reponse.status).toBe(201);
    expect(await reponse.text()).toBe("réponse du Worker");
  });
});
