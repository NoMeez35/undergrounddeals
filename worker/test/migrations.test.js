// Les migrations s'appliquent à une base déjà remplie : ces tests remplissent
// la base au schéma d'avant une migration, l'appliquent, puis vérifient que
// l'appli lit correctement les données existantes.
import { applyD1Migrations, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { creerCookieSession } from "../src/session.js";

const STEAM_ID = "76561198000009999";

// Vide la base de test des migrations, puis l'amène au schéma de la migration
// donnée (préfixe de son nom, ex. « 0007 »).
async function baseAuSchema(derniere) {
  const db = env.DB_MIGRATIONS;
  const { results } = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY rowid DESC")
    .all();
  for (const { name } of results) await db.prepare(`DROP TABLE "${name}"`).run();

  const index = env.TEST_MIGRATIONS.findIndex((migration) => migration.name.startsWith(derniere));
  await applyD1Migrations(db, env.TEST_MIGRATIONS.slice(0, index + 1));
  return db;
}

async function appliquerLaSuite(db) {
  await applyD1Migrations(db, env.TEST_MIGRATIONS);
}

async function appelerAvec(db, chemin) {
  const cookie = (await creerCookieSession(STEAM_ID, env.SESSION_SECRET)).split(";")[0];
  const requete = new Request(`https://exemple.test${chemin}`, { headers: { Cookie: cookie } });
  return worker.fetch(requete, { ...env, DB: db });
}

describe("migrations sur des données existantes", () => {
  it("0008 : les prix relevés avant la trace quotidienne restent affichés", async () => {
    const db = await baseAuSchema("0007");
    const maintenant = new Date().toISOString();
    await db.batch([
      db.prepare("INSERT INTO utilisateurs (steam_id, pays, langue) VALUES (?, 'FR', 'fr')").bind(STEAM_ID),
      db.prepare("INSERT INTO produits (app_id, type, nom) VALUES (620, 'jeu', 'Portal 2')"),
      db.prepare("INSERT INTO suivis (steam_id, app_id, ajoute_le) VALUES (?, 620, ?)").bind(STEAM_ID, maintenant),
      db.prepare(
        `INSERT INTO prix (app_id, pays, etat, devise, prix, prix_initial, reduction, prix_affiche, depuis)
         VALUES (620, 'FR', 'enVente', 'EUR', 969, 969, 0, '9,69€', ?)`,
      ).bind(maintenant),
      db.prepare("INSERT INTO releves_pays (pays, heure, apres_app_id, termine_le) VALUES ('FR', ?, NULL, ?)").bind(
        maintenant.slice(0, 13),
        maintenant,
      ),
    ]);

    await appliquerLaSuite(db);

    const { produits } = await (await appelerAvec(db, "/api/suivis")).json();
    expect(produits[0].prix).toMatchObject({ actuel: "9,69€" });
  });
});
