import { describe, expect, it } from "vitest";
import pageIntrouvable from "../public/404.html?raw";
import appli from "../public/app.js?raw";
import pageAppli from "../public/index.html?raw";
import { LANGUES, proposerLangue } from "../public/langues.js";
import { lirePays, PAYS, proposerPays } from "../public/pays.js";

const textes = Object.fromEntries(
  await Promise.all(
    Object.keys(LANGUES).map(async (langue) => [langue, (await import(`../public/textes/${langue}.js`)).default]),
  ),
);

describe("textes de l'interface", () => {
  it("existent en français et en anglais", () => {
    expect(Object.keys(textes)).toEqual(expect.arrayContaining(["fr", "en"]));
  });

  it.each(Object.keys(LANGUES))("ont les mêmes clés en %s qu'en français", (langue) => {
    expect(Object.keys(textes[langue]).sort()).toEqual(Object.keys(textes.fr).sort());
  });

  it("couvrent toutes les clés utilisées par les pages", () => {
    const utilisees = [
      ...`${pageAppli}${pageIntrouvable}`.matchAll(/data-texte="([^"]+)"/g),
      ...`${appli}${pageIntrouvable}`.matchAll(/texte\("([^"]+)"/g),
      ...appli.matchAll(/"((?:choix|reglages)\.[a-zA-Z]+)"/g),
    ].map(([, cle]) => cle);

    expect(utilisees.length).toBeGreaterThan(0);
    for (const langue of Object.keys(LANGUES)) {
      expect(utilisees.filter((cle) => !(cle in textes[langue])), langue).toEqual([]);
    }
  });
});

describe("proposerLangue", () => {
  it("prend la première langue du navigateur que l'interface connaît", () => {
    expect(proposerLangue(["de-DE", "fr-BE", "en"])).toBe("fr");
    expect(proposerLangue(["EN-us"])).toBe("en");
  });

  it("propose l'anglais sinon", () => {
    expect(proposerLangue(["de-DE", "ja"])).toBe("en");
    expect(proposerLangue([])).toBe("en");
  });
});

describe("proposerPays", () => {
  it("préfère le pays du profil Steam public", () => {
    expect(proposerPays("BE", ["fr-FR"])).toBe("BE");
  });

  it("déduit le pays du navigateur si le profil n'en donne pas", () => {
    expect(proposerPays(null, ["fr-CA", "fr-FR"])).toBe("CA");
    expect(proposerPays(null, ["fr"])).toBe("FR");
    expect(proposerPays("ZZ", ["n'importe quoi", "de-AT"])).toBe("AT");
  });

  it("ne propose rien s'il n'y a aucun indice", () => {
    expect(proposerPays(null, [])).toBeNull();
  });
});

describe("lirePays", () => {
  it("accepte tous les codes ISO 3166-1, une seule fois chacun", () => {
    expect(PAYS).toHaveLength(249);
    expect(new Set(PAYS).size).toBe(PAYS.length);
    expect(lirePays("fr")).toBe("FR");
  });

  it.each([["ZZ"], ["FRA"], [""], [null], [42]])("refuse %s", (texte) => {
    expect(lirePays(texte)).toBeNull();
  });
});
