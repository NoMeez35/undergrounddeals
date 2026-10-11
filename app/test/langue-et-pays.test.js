import { describe, expect, it } from "vitest";
import redirections from "../public/_redirects?raw";
import pageIntrouvable from "../public/404.html?raw";
import appli from "../public/app.js?raw";
import mesSuivis from "../public/mes-suivis.js?raw";
import { CHEMIN_CONNEXION, CHEMIN_REGLAGES } from "../public/chemins.js";
import pageAppli from "../public/index.html?raw";
import { LANGUES, proposerLangue } from "../public/langues.js";
import { lirePays, PAYS, proposerPays } from "../public/pays.js";
import { ERREURS_AJOUT, LIMITE_DE_SUIVI, TYPES_PRODUIT } from "../public/suivis.js";

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
      ...`${appli}${mesSuivis}${pageIntrouvable}`.matchAll(/texte\("([^"]+)"/g),
      ...`${appli}${mesSuivis}`.matchAll(/poserTexte\(.+, "([^"]+)"\)/g),
      // Clés écrites à part : « choix.titre », « suivis.videJeu »…
      ...`${appli}${mesSuivis}`.matchAll(/"([a-z]+(?:\.[a-zA-Z]+)+)"/g),
      // Clés composées : une par raison de refus d'un ajout.
      ...Object.keys(ERREURS_AJOUT)
        .filter((erreur) => erreur !== ERREURS_AJOUT.limiteAtteinte)
        .map((erreur) => [, `ajout.erreur.${erreur}`]),
      ...TYPES_PRODUIT.map((type) => [, `ajout.erreur.limiteAtteinte.${type}`]),
    ].map(([, cle]) => cle);

    expect(utilisees.length).toBeGreaterThan(0);
    for (const langue of Object.keys(LANGUES)) {
      expect(utilisees.filter((cle) => !(cle in textes[langue])), langue).toEqual([]);
    }
  });
});

it.each(Object.keys(LANGUES))("les messages de limite en %s citent la limite de suivi", (langue) => {
  for (const type of TYPES_PRODUIT) {
    expect(textes[langue][`ajout.erreur.limiteAtteinte.${type}`]).toContain(String(LIMITE_DE_SUIVI));
  }
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
  it("accepte les 250 pays de Steam (ISO 3166-1 et Kosovo), une seule fois chacun", () => {
    expect(PAYS).toHaveLength(250);
    expect(lirePays("XK")).toBe("XK");
    expect(new Set(PAYS).size).toBe(PAYS.length);
    expect(lirePays("fr")).toBe("FR");
  });

  it.each([["ZZ"], ["FRA"], [""], [null], [42]])("refuse %s", (texte) => {
    expect(lirePays(texte)).toBeNull();
  });
});

it("chaque écran de l'appli est servi par la page principale (_redirects)", () => {
  for (const chemin of [CHEMIN_CONNEXION, CHEMIN_REGLAGES]) {
    expect(redirections).toMatch(new RegExp(`^${chemin} / 200$`, "m"));
  }
});
