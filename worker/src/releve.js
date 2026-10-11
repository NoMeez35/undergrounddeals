// Relevé horaire des prix : chaque heure, le prix de chaque produit suivi est
// relevé une seule fois par pays ayant au moins un utilisateur qui le suit.
//
// Limites (constatées le 2026-10-11) :
// - offre gratuite de Cloudflare, par passage planifié : 50 appels externes,
//   50 requêtes à la base, 10 ms de CPU ; 100 000 écritures par jour ;
// - Steam : environ 200 appels toutes les 5 minutes à appdetails.
// Un passage relève au plus PAQUETS_PAR_PASSAGE paquets de 100 produits : par
// paquet, 1 à 2 appels à Steam (prix, puis fiches des produits sans prix) et
// 5 requêtes à la base. Avec un passage toutes les 5 minutes, cela fait
// 12 × 800 = 9 600 couples (produit, pays) par heure ; seuls les changements
// de prix sont écrits.
// shortcut: au-delà de 9 600 couples, le relevé d'une heure n'est pas fini ;
// passer à l'offre payante (1 000 requêtes par passage) et augmenter PAQUETS_PAR_PASSAGE.
import { ETATS_PRIX } from "../../app/public/suivis.js";
import { lireFichesSteam, lirePrixSteam, SteamIndisponible } from "./steam-boutique.js";

const PAQUETS_PAR_PASSAGE = 8;
const TAILLE_PAQUET = 100;

// État d'un produit sans prix, d'après sa fiche Steam. Un jeu pas encore sorti
// peut être dit gratuit : la sortie passe d'abord.
function etatSansPrix(fiche) {
  if (fiche?.pasEncoreSorti) return ETATS_PRIX.pasEncoreSorti;
  if (fiche?.gratuit) return ETATS_PRIX.gratuit;
  return ETATS_PRIX.sansPrix;
}

// Champs comparés pour savoir si un relevé change le prix connu.
const CHAMPS_COMPARES = ["etat", "devise", "prix", "prix_initial", "reduction"];
const SQL_RELEVE = `SELECT json_extract(value, '$.appId') AS app_id, json_extract(value, '$.etat') AS etat,
       json_extract(value, '$.devise') AS devise, json_extract(value, '$.prix') AS prix,
       json_extract(value, '$.prixInitial') AS prix_initial, json_extract(value, '$.reduction') AS reduction,
       json_extract(value, '$.prixAffiche') AS prix_affiche,
       json_extract(value, '$.prixInitialAffiche') AS prix_initial_affiche
  FROM json_each(?1)`;

// Relève un paquet de produits dans un pays et enregistre ce qui a changé.
// Lève SteamIndisponible si Steam ne répond pas.
async function releverPaquet(env, appIds, pays, maintenant) {
  const prix = await lirePrixSteam(appIds, pays);
  const sansPrix = appIds.filter((appId) => !prix.get(appId));
  const fiches = sansPrix.length > 0 ? await lireFichesSteam(sansPrix, pays) : new Map();

  const releves = appIds.map((appId) => {
    const prixProduit = prix.get(appId);
    if (prixProduit) return { appId, etat: ETATS_PRIX.enVente, ...prixProduit };
    return { appId, etat: etatSansPrix(fiches.get(appId)) };
  });
  // Un produit en vente n'est pas retiré de Steam ; un produit sans prix l'est
  // si sa fiche le dit. Sans fiche, on ne change rien.
  const retraits = appIds
    .filter((appId) => prix.get(appId) || fiches.has(appId))
    .map((appId) => ({ appId, retire: fiches.get(appId)?.retire === true ? 1 : 0 }));

  const change = CHAMPS_COMPARES.map((champ) => `p.${champ} IS NOT r.${champ}`).join(" OR ");
  const json = JSON.stringify(releves);
  await env.DB.batch([
    // L'historique d'abord : il compare avec le prix connu avant sa mise à jour.
    env.DB.prepare(
      `INSERT INTO historique_prix (app_id, pays, releve_le, etat, devise, prix, prix_initial, reduction)
       SELECT r.app_id, ?2, ?3, r.etat, r.devise, r.prix, r.prix_initial, r.reduction
         FROM (${SQL_RELEVE}) r LEFT JOIN prix p ON p.app_id = r.app_id AND p.pays = ?2
        WHERE p.app_id IS NULL OR ${change}`,
    ).bind(json, pays, maintenant),
    env.DB.prepare(
      `INSERT INTO prix (app_id, pays, etat, devise, prix, prix_initial, reduction, prix_affiche, prix_initial_affiche, depuis)
       SELECT r.app_id, ?2, r.etat, r.devise, r.prix, r.prix_initial, r.reduction, r.prix_affiche, r.prix_initial_affiche, ?3
         FROM (${SQL_RELEVE}) r WHERE true
       ON CONFLICT (app_id, pays) DO UPDATE SET
         etat = excluded.etat, devise = excluded.devise, prix = excluded.prix, prix_initial = excluded.prix_initial,
         reduction = excluded.reduction, prix_affiche = excluded.prix_affiche,
         prix_initial_affiche = excluded.prix_initial_affiche, depuis = excluded.depuis
       WHERE ${CHAMPS_COMPARES.map((champ) => `prix.${champ} IS NOT excluded.${champ}`).join(" OR ")}`,
    ).bind(json, pays, maintenant),
    env.DB.prepare(
      `UPDATE produits SET retire_de_steam = r.retire
         FROM (SELECT json_extract(value, '$.appId') AS app_id, json_extract(value, '$.retire') AS retire
                 FROM json_each(?1)) r
        WHERE produits.app_id = r.app_id AND produits.retire_de_steam IS NOT r.retire`,
    ).bind(JSON.stringify(retraits)),
  ]);
}

function avancer(env, pays, heure, apresAppId, termineLe) {
  return env.DB.prepare(
    `INSERT INTO releves_pays (pays, heure, apres_app_id, termine_le) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT (pays) DO UPDATE SET heure = ?2, apres_app_id = ?3, termine_le = coalesce(?4, termine_le)`,
  )
    .bind(pays, heure, apresAppId, termineLe)
    .run();
}

// Passage planifié : avance le relevé de l'heure, pays par pays. Si Steam ne
// répond pas, le passage s'arrête et le paquet sera repris au passage suivant ;
// ce qui n'a pas été relevé à la fin de l'heure l'est à l'heure suivante.
export async function releverLesPrix(env, maintenant = new Date()) {
  const heure = maintenant.toISOString().slice(0, 13);
  const { results: pays } = await env.DB.prepare(
    `SELECT DISTINCT u.pays, r.heure, r.apres_app_id
       FROM utilisateurs u
       JOIN suivis s ON s.steam_id = u.steam_id
       LEFT JOIN releves_pays r ON r.pays = u.pays
      WHERE u.pays IS NOT NULL
      ORDER BY u.pays`,
  ).all();

  let paquets = 0;
  for (const releve of pays) {
    // Une nouvelle heure repart du début ; null : relevé de l'heure terminé.
    let apres = releve.heure === heure ? releve.apres_app_id : 0;
    while (apres !== null && paquets < PAQUETS_PAR_PASSAGE) {
      const { results } = await env.DB.prepare(
        `SELECT DISTINCT s.app_id FROM suivis s JOIN utilisateurs u ON u.steam_id = s.steam_id
          WHERE u.pays = ? AND s.app_id > ?
          ORDER BY s.app_id
          LIMIT ?`,
      )
        .bind(releve.pays, apres, TAILLE_PAQUET)
        .all();
      if (results.length === 0) {
        await avancer(env, releve.pays, heure, null, maintenant.toISOString());
        break;
      }

      const appIds = results.map(({ app_id }) => app_id);
      try {
        await releverPaquet(env, appIds, releve.pays, maintenant.toISOString());
      } catch (erreur) {
        if (!(erreur instanceof SteamIndisponible)) throw erreur;
        console.error(`Relevé des prix (${releve.pays}) : ${erreur.message}`);
        return;
      }
      apres = appIds.at(-1);
      await avancer(env, releve.pays, heure, apres, null);
      paquets += 1;
    }
    if (paquets >= PAQUETS_PAR_PASSAGE) return;
  }
}
