// Relevé horaire des prix : chaque heure, le prix de chaque produit suivi est
// relevé une seule fois par pays ayant au moins un utilisateur qui le suit.
//
// Limites (constatées le 2026-10-11) :
// - offre gratuite de Cloudflare, par passage planifié : 50 appels externes,
//   50 requêtes à la base, 10 ms de CPU ; 100 000 écritures par jour ;
// - Steam : environ 200 appels toutes les 5 minutes à appdetails.
// Un passage s'arrête avant de dépasser BUDGET_REQUETES : 1 requête pour la
// liste des pays, puis par paquet de 100 produits 6 requêtes et 1 à 2 appels à
// Steam (prix, puis fiches des produits sans prix), et 2 requêtes pour clore
// le relevé d'un pays. Avec un passage toutes les 5 minutes, cela fait au plus
// 12 × 700 = 8 400 couples (produit, pays) par heure.
// Écritures : chaque changement de prix, plus une par couple et par jour
// (vu_le), plus une par alerte.
// shortcut: au-delà d'environ 8 000 couples, un relevé dure plus d'une heure
// (il continue là où il s'était arrêté) ; passer à l'offre payante (1 000
// requêtes par passage) et augmenter BUDGET_REQUETES.
import { ETATS_PRIX } from "../../app/public/suivis.js";
import { lireFichesSteam, lirePrixSteam, SteamIndisponible, TAILLE_PAQUET } from "./steam-boutique.js";

const BUDGET_REQUETES = 46;
const REQUETES_PAR_PAQUET = 6;

// État d'un produit sans prix, d'après sa fiche Steam. Un jeu pas encore sorti
// peut être dit gratuit : la sortie passe d'abord.
function etatSansPrix(fiche) {
  if (fiche?.pasEncoreSorti) return ETATS_PRIX.pasEncoreSorti;
  if (fiche?.gratuit) return ETATS_PRIX.gratuit;
  return ETATS_PRIX.sansPrix;
}

// Condition SQL « le prix a changé » entre deux lignes (alias donnés).
const CHAMPS_COMPARES = ["etat", "devise", "prix", "prix_initial", "reduction"];
const sqlPrixChange = (avant, apres) => CHAMPS_COMPARES.map((champ) => `${avant}.${champ} IS NOT ${apres}.${champ}`).join(" OR ");

// Lignes d'un tableau JSON lié en ?1, avec les champs demandés (nom JSON → colonne).
const sqlDepuisJson = (champs) =>
  `SELECT ${Object.entries(champs)
    .map(([cle, colonne]) => `json_extract(value, '$.${cle}') AS ${colonne}`)
    .join(", ")} FROM json_each(?1)`;

const SQL_RELEVES = sqlDepuisJson({
  appId: "app_id",
  etat: "etat",
  devise: "devise",
  prix: "prix",
  prixInitial: "prix_initial",
  reduction: "reduction",
  prixAffiche: "prix_affiche",
  prixInitialAffiche: "prix_initial_affiche",
});

// Jour (AAAA-MM-JJ) précédant la date donnée : un prix vu pour la dernière
// fois avant ce jour est périmé.
export function jourDeLaVeille(date = new Date()) {
  return new Date(date.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Un prix est périmé s'il n'a pas été vu depuis la veille (?4).
const sqlPerime = (ligne) => `(${ligne}.vu_le IS NULL OR ${ligne}.vu_le < ?4)`;

// Relève un paquet de produits dans un pays, enregistre ce qui a changé et crée
// les alertes des utilisateurs du pays qui suivent ces produits. Lève SteamIndisponible si Steam ne répond pas.
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

  const jour = maintenant.slice(0, 10);
  const veille = jourDeLaVeille(new Date(maintenant));
  const json = JSON.stringify(releves);
  await env.DB.batch([
    // L'historique et les alertes d'abord : ils comparent avec le prix connu
    // avant sa mise à jour.
    env.DB.prepare(
      `INSERT INTO historique_prix (app_id, pays, releve_le, etat, devise, prix, prix_initial, reduction, apres_interruption)
       SELECT r.app_id, ?2, ?3, r.etat, r.devise, r.prix, r.prix_initial, r.reduction,
              px.app_id IS NULL OR ${sqlPerime("px")}
         FROM (${SQL_RELEVES}) r LEFT JOIN prix px ON px.app_id = r.app_id AND px.pays = ?2
        WHERE px.app_id IS NULL OR ${sqlPerime("px")} OR ${sqlPrixChange("px", "r")}`,
    ).bind(json, pays, maintenant, veille),
    // Début de promo : le produit est réduit alors que son prix connu, encore à
    // jour, ne l'était pas (pas en vente, ou sans réduction). Un premier relevé
    // ou une reprise après interruption n'est pas un changement observé : il
    // n'alerte pas, ce qui évite les alertes rétroactives après un changement
    // de pays.
    env.DB.prepare(
      `INSERT INTO alertes (steam_id, app_id, cree_le, debut_promo, prix_affiche, prix_initial_affiche, reduction)
       SELECT s.steam_id, r.app_id, ?3, 1, r.prix_affiche, r.prix_initial_affiche, r.reduction
         FROM (${SQL_RELEVES}) r
         JOIN prix px ON px.app_id = r.app_id AND px.pays = ?2
         JOIN suivis s ON s.app_id = r.app_id
         JOIN utilisateurs u ON u.steam_id = s.steam_id AND u.pays = ?2
        WHERE r.etat = '${ETATS_PRIX.enVente}' AND r.reduction > 0 AND NOT ${sqlPerime("px")}
          AND NOT (px.etat = '${ETATS_PRIX.enVente}' AND px.reduction > 0)`,
    ).bind(json, pays, maintenant, veille),
    // Le prix connu n'est réécrit que s'il change, ou une fois par jour pour vu_le.
    env.DB.prepare(
      `INSERT INTO prix (app_id, pays, etat, devise, prix, prix_initial, reduction, prix_affiche, prix_initial_affiche, depuis, vu_le)
       SELECT r.app_id, ?2, r.etat, r.devise, r.prix, r.prix_initial, r.reduction, r.prix_affiche, r.prix_initial_affiche, ?3, ?5
         FROM (${SQL_RELEVES}) r WHERE true
       ON CONFLICT (app_id, pays) DO UPDATE SET
         depuis = CASE WHEN ${sqlPrixChange("prix", "excluded")} OR ${sqlPerime("prix")} THEN excluded.depuis ELSE prix.depuis END,
         etat = excluded.etat, devise = excluded.devise, prix = excluded.prix, prix_initial = excluded.prix_initial,
         reduction = excluded.reduction, prix_affiche = excluded.prix_affiche,
         prix_initial_affiche = excluded.prix_initial_affiche, vu_le = excluded.vu_le
       WHERE ${sqlPrixChange("prix", "excluded")} OR prix.vu_le IS NOT excluded.vu_le`,
    ).bind(json, pays, maintenant, veille, jour),
    env.DB.prepare(
      `UPDATE produits SET retire_de_steam = r.retire
         FROM (${sqlDepuisJson({ appId: "app_id", retire: "retire" })}) r
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

// Relève un pays jusqu'à la fin de son relevé ou de `budget` requêtes ;
// renvoie le nombre de requêtes faites. Lève SteamIndisponible si Steam ne
// répond pas : le paquet en cours sera repris au passage suivant.
async function releverPays(env, { pays, heure, apres_app_id }, maintenant, budget) {
  const heureActuelle = maintenant.slice(0, 13);
  // Sans ligne dans releves_pays (heure null), le pays n'a jamais été relevé.
  const termine = apres_app_id === null;
  // Un relevé terminé repart du début à l'heure suivante ; un relevé inachevé
  // continue là où il s'était arrêté, même si l'heure a changé.
  if (termine && heure === heureActuelle) return 0;
  let apres = termine || heure === null ? 0 : apres_app_id;
  const heureDuReleve = apres === 0 ? heureActuelle : heure;

  let requetes = 0;
  while (budget - requetes >= REQUETES_PAR_PAQUET) {
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT s.app_id FROM suivis s JOIN utilisateurs u ON u.steam_id = s.steam_id
        WHERE u.pays = ? AND s.app_id > ?
        ORDER BY s.app_id
        LIMIT ?`,
    )
      .bind(pays, apres, TAILLE_PAQUET)
      .all();
    requetes += 1;
    if (results.length === 0) {
      await avancer(env, pays, heureDuReleve, null, maintenant);
      return requetes + 1;
    }

    const appIds = results.map(({ app_id }) => app_id);
    await releverPaquet(env, appIds, pays, maintenant);
    apres = appIds.at(-1);
    await avancer(env, pays, heureDuReleve, apres, null);
    requetes += REQUETES_PAR_PAQUET - 1;
  }
  return requetes;
}

// Passage planifié : avance le relevé de chaque pays, les plus en retard
// d'abord. Si Steam ne répond pas, le passage s'arrête ; une autre erreur ne
// touche que le pays concerné. Ce qui reste est repris au passage suivant.
export async function releverLesPrix(env, maintenant = new Date()) {
  const { results: avancements } = await env.DB.prepare(
    `SELECT DISTINCT u.pays, r.heure, r.apres_app_id, r.termine_le
       FROM utilisateurs u
       JOIN suivis s ON s.steam_id = u.steam_id
       LEFT JOIN releves_pays r ON r.pays = u.pays
      WHERE u.pays IS NOT NULL
      ORDER BY r.termine_le, u.pays`,
  ).all();

  let budget = BUDGET_REQUETES - 1;
  for (const avancement of avancements) {
    if (budget < REQUETES_PAR_PAQUET) return;
    try {
      budget -= await releverPays(env, avancement, maintenant.toISOString(), budget);
    } catch (erreur) {
      console.error(`Relevé des prix (${avancement.pays}) : ${erreur.message}`);
      if (erreur instanceof SteamIndisponible) return;
      budget -= REQUETES_PAR_PAQUET;
    }
  }
}
