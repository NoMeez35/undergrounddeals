// Liste de souhaits Steam : import, synchronisation quotidienne et suivi des
// produits que la limite de suivi a laissés de côté.
import { PAYS_PAR_DEFAUT } from "../../app/public/pays.js";
import { ERREURS_AJOUT, LIMITE_DE_SUIVI } from "../../app/public/suivis.js";
import { json, sansContenu } from "./reponses.js";
import { lireFichesSteam, lireListeDeSouhaits } from "./steam-boutique.js";
import {
  COLONNES_PRODUIT,
  PROVENANCES,
  refus,
  siSteamRepond,
  SQL_SOUHAIT_NON_SUIVI,
  sqlPlacesPrises,
  suivre,
} from "./suivis.js";
import { paysDe } from "./utilisateur.js";

const UN_JOUR_MS = 24 * 60 * 60 * 1000;
// Fiches demandées à Steam par synchronisation : 4 appels au plus (paquets de
// 100), en suivant l'ordre de la liste. Avec la lecture de la liste, une
// synchronisation coûte donc au plus 5 appels à Steam et une dizaine de requêtes
// à la base. shortcut: une liste de plus de 400 produits encore inconnus est
// complétée sur plusieurs jours ; augmenter avec l'offre payante.
const FICHES_PAR_SYNCHRONISATION = 400;
// Utilisateurs synchronisés à chaque passage planifié (toutes les 10 minutes,
// voir worker/wrangler.jsonc), pour rester sous les 50 appels externes et
// 50 requêtes à la base de l'offre gratuite.
// shortcut: 4 × 144 passages = 576 utilisateurs par jour, au-delà la
// synchronisation prend du retard ; passer à l'offre payante ou synchroniser plus souvent.
const UTILISATEURS_PAR_PASSAGE = 4;
// Délai minimal entre deux relectures demandées par l'utilisateur.
const DELAI_RELECTURE_MS = 60 * 1000;

// Enregistre les produits de la liste encore inconnus de l'appli : dans
// `produits` s'ils peuvent être suivis, sinon dans `produits_ignores`. Un
// produit est enregistré sous l'AppID de la liste, même si Steam en indique un
// autre, pour que la liste le retrouve.
async function enregistrerProduitsInconnus(env, appIds, pays) {
  const { results } = await env.DB.prepare(
    `SELECT value AS app_id FROM json_each(?1)
      WHERE value NOT IN (SELECT app_id FROM produits)
        AND value NOT IN (SELECT app_id FROM produits_ignores)
      ORDER BY key
      LIMIT ?2`,
  )
    .bind(JSON.stringify(appIds), FICHES_PAR_SYNCHRONISATION)
    .all();
  if (results.length === 0) return;

  const fiches = await lireFichesSteam(
    results.map(({ app_id }) => app_id),
    pays,
  );
  const suivables = [...fiches].filter(([, fiche]) => fiche.type).map(([appId, fiche]) => ({ ...fiche, appId }));
  const ignores = [...fiches].filter(([, fiche]) => !fiche.type).map(([appId]) => appId);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO produits (app_id, type, nom)
       SELECT json_extract(value, '$.appId'), json_extract(value, '$.type'), json_extract(value, '$.nom')
         FROM json_each(?)`,
    ).bind(JSON.stringify(suivables)),
    env.DB.prepare("INSERT OR IGNORE INTO produits_ignores (app_id) SELECT value FROM json_each(?)").bind(
      JSON.stringify(ignores),
    ),
  ]);
}

// Lit la liste de souhaits de l'utilisateur et met ses produits suivis à jour :
// les produits de la liste sont suivis par ordre de priorité jusqu'à la limite
// de suivi (jeux et DLC séparément), ceux qui en sont sortis ne sont plus suivis
// sauf s'ils ont aussi été ajoutés à la main. Une liste vide ou privée ne retire
// rien : Steam répond de la même façon dans les deux cas. Lève SteamIndisponible.
export async function synchroniserSouhaits(env, steamId, pays) {
  const maintenant = new Date().toISOString();
  const appIds = await lireListeDeSouhaits(steamId);
  if (!appIds) {
    await env.DB.prepare("UPDATE utilisateurs SET souhaits_visibles = 0, souhaits_lus_le = ? WHERE steam_id = ?")
      .bind(maintenant, steamId)
      .run();
    return;
  }

  await enregistrerProduitsInconnus(env, appIds, pays);
  const liste = JSON.stringify(appIds);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM souhaits WHERE steam_id = ?1 AND app_id NOT IN (SELECT value FROM json_each(?2))").bind(
      steamId,
      liste,
    ),
    env.DB.prepare(
      `INSERT INTO souhaits (steam_id, app_id, rang)
       SELECT ?1, j.value, j.key + 1 FROM json_each(?2) j JOIN produits p ON p.app_id = j.value WHERE true
       ON CONFLICT (steam_id, app_id) DO UPDATE SET rang = excluded.rang`,
    ).bind(steamId, liste),
    env.DB.prepare(
      "UPDATE suivis SET souhait = (app_id IN (SELECT app_id FROM souhaits WHERE steam_id = ?1)) WHERE steam_id = ?1",
    ).bind(steamId),
    env.DB.prepare("DELETE FROM suivis WHERE steam_id = ? AND manuel = 0 AND souhait = 0").bind(steamId),
    // Pour chaque type, les places libres vont aux produits de la liste non
    // suivis, par ordre de priorité.
    env.DB.prepare(
      `INSERT INTO suivis (steam_id, app_id, ajoute_le, manuel, souhait)
       SELECT ?1, c.app_id, ?2, 0, 1
         FROM (SELECT sh.app_id, p.type, ROW_NUMBER() OVER (PARTITION BY p.type ORDER BY sh.rang) AS place
                 FROM souhaits sh JOIN produits p ON p.app_id = sh.app_id
                WHERE sh.steam_id = ?1 AND sh.ecarte = 0 AND p.retire_de_steam = 0
                  AND ${SQL_SOUHAIT_NON_SUIVI}) c
        WHERE c.place <= ?3 - ${sqlPlacesPrises("c.type")}`,
    ).bind(steamId, maintenant, LIMITE_DE_SUIVI),
    env.DB.prepare("UPDATE utilisateurs SET souhaits_visibles = 1, souhaits_lus_le = ? WHERE steam_id = ?").bind(
      maintenant,
      steamId,
    ),
  ]);
}

// Synchronisation qui ne bloque jamais l'appelant (connexion, passage planifié) :
// en cas d'échec, l'erreur est journalisée et l'utilisateur reporté au lendemain.
// shortcut: un utilisateur en échec attend un jour ; le reprendre plus tôt si
// les pannes deviennent fréquentes.
export async function synchroniserSansBloquer(env, steamId, pays) {
  try {
    await synchroniserSouhaits(env, steamId, pays);
  } catch (erreur) {
    console.error(`Liste de souhaits de ${steamId} : ${erreur.message}`);
    await env.DB.prepare("UPDATE utilisateurs SET souhaits_lus_le = ? WHERE steam_id = ?")
      .bind(new Date().toISOString(), steamId)
      .run()
      .catch(() => {});
  }
}

// Passage planifié : synchronise les utilisateurs dont la liste de souhaits n'a
// pas été lue depuis un jour, les plus en retard d'abord.
export async function synchroniserLesListesEnRetard(env) {
  const { results } = await env.DB.prepare(
    `SELECT steam_id, pays FROM utilisateurs
      WHERE souhaits_lus_le IS NULL OR souhaits_lus_le < ?
      ORDER BY souhaits_lus_le
      LIMIT ?`,
  )
    .bind(new Date(Date.now() - UN_JOUR_MS).toISOString(), UTILISATEURS_PAR_PASSAGE)
    .all();

  for (const utilisateur of results) {
    await synchroniserSansBloquer(env, utilisateur.steam_id, paysDe(utilisateur));
  }
}

// Première connexion : la liste n'a encore jamais été lue et le pays n'est pas choisi.
export function importerSouhaits(env, steamId) {
  return synchroniserSansBloquer(env, steamId, PAYS_PAR_DEFAUT);
}

// Relecture demandée par l'utilisateur, par exemple après avoir rendu sa liste
// publique. Répond 204, 429 si la dernière lecture date de moins d'une minute,
// ou 502 si Steam ne répond pas.
export async function relireSouhaits({ utilisateur, env }) {
  const derniere = Date.parse(utilisateur.souhaits_lus_le ?? "");
  if (Date.now() - derniere < DELAI_RELECTURE_MS) return json({ erreur: "tropTot" }, { status: 429 });

  const relue = await siSteamRepond(
    synchroniserSouhaits(env, utilisateur.steam_id, paysDe(utilisateur)).then(() => true),
    false,
  );
  return relue ? sansContenu() : json({ erreur: "steamIndisponible" }, { status: 502 });
}

// Suit un produit de la liste de souhaits resté non suivi (limite atteinte ou
// écarté par l'utilisateur).
export async function suivreSouhait({ utilisateur, env, appId }) {
  const produit = await env.DB.prepare(
    `SELECT ${COLONNES_PRODUIT}
       FROM souhaits sh JOIN produits p ON p.app_id = sh.app_id
      WHERE sh.steam_id = ? AND sh.app_id = ?`,
  )
    .bind(utilisateur.steam_id, appId)
    .first();
  if (!produit) return refus(ERREURS_AJOUT.introuvable);
  return suivre(env, utilisateur.steam_id, produit, PROVENANCES.souhait);
}
