// Produits suivis d'un utilisateur : liste avec derniers prix relevés, ajout manuel, retrait.
import { ERREURS_AJOUT, LIMITE_DE_SUIVI } from "../../app/public/suivis.js";
import { jourDeLaVeille } from "./releve.js";
import { json, sansContenu } from "./reponses.js";
import { lireSaisieProduit } from "./saisie-produit.js";
import { lireFichesSteam, SteamIndisponible } from "./steam-boutique.js";
import { paysDe } from "./utilisateur.js";

export const COLONNES_PRODUIT = "p.app_id, p.type, p.nom, p.retire_de_steam";

// Morceaux de SQL partagés avec souhaits.js ; ?1 y est toujours le SteamID.
// Nombre de produits du type donné qui comptent dans la limite de suivi.
export const sqlPlacesPrises = (type) =>
  `(SELECT COUNT(*) FROM suivis s JOIN produits p ON p.app_id = s.app_id
     WHERE s.steam_id = ?1 AND p.type = ${type} AND p.retire_de_steam = 0)`;
// Le produit `sh.app_id` de la liste de souhaits (alias sh) n'est pas suivi.
export const SQL_SOUHAIT_NON_SUIVI = "NOT EXISTS (SELECT 1 FROM suivis s WHERE s.steam_id = ?1 AND s.app_id = sh.app_id)";

// Provenance d'un produit suivi : chacune est une colonne de la table suivis.
export const PROVENANCES = { manuel: "manuel", souhait: "souhait" };

// Statut HTTP de chaque refus d'ajout.
const STATUT_REFUS = {
  [ERREURS_AJOUT.lienInvalide]: 400,
  [ERREURS_AJOUT.pack]: 422,
  [ERREURS_AJOUT.introuvable]: 404,
  [ERREURS_AJOUT.typeNonSuivi]: 422,
  [ERREURS_AJOUT.limiteAtteinte]: 409,
  [ERREURS_AJOUT.steamIndisponible]: 502,
};

export function refus(erreur, details = {}) {
  return json({ erreur, ...details }, { status: STATUT_REFUS[erreur] });
}

// Résultat de la promesse, ou `siPanne` si Steam ne répond pas ; les autres
// erreurs remontent.
export async function siSteamRepond(promesse, siPanne) {
  try {
    return await promesse;
  } catch (erreur) {
    if (!(erreur instanceof SteamIndisponible)) throw erreur;
    return siPanne;
  }
}

function produitVersJson({ app_id, type, nom, retire_de_steam }) {
  return { appId: app_id, type, nom, retireDeSteam: retire_de_steam === 1 };
}

// Dernier prix relevé dans le pays de l'utilisateur, ou null s'il ne l'a pas
// encore été (ou plus depuis la veille : prix périmé, voir worker/src/releve.js).
// Montants mis en forme par Steam ; etat : une valeur de ETATS_PRIX.
function prixVersJson(ligne) {
  if (!ligne.etat) return null;
  return { etat: ligne.etat, actuel: ligne.prix_affiche, initial: ligne.prix_initial_affiche, reduction: ligne.reduction };
}

// Produits suivis, du plus récent au plus ancien (ceux d'un même import dans
// l'ordre de la liste de souhaits), avec leur dernier prix relevé dans le pays
// de l'utilisateur et l'heure du dernier relevé complet (`releveLe`) ; puis les
// produits de sa liste de souhaits qui ne sont pas suivis.
export async function listerSuivis({ utilisateur, env }) {
  const [{ results: produits }, { results: nonSuivis }, releve] = await env.DB.batch([
    env.DB.prepare(
      `SELECT ${COLONNES_PRODUIT}, px.etat, px.prix_affiche, px.prix_initial_affiche, px.reduction
         FROM suivis s
         JOIN produits p ON p.app_id = s.app_id
         LEFT JOIN prix px ON px.app_id = s.app_id AND px.pays = ?2 AND px.vu_le >= ?3
         LEFT JOIN souhaits sh ON sh.steam_id = s.steam_id AND sh.app_id = s.app_id
        WHERE s.steam_id = ?1
        ORDER BY s.ajoute_le DESC, sh.rang, p.nom`,
    ).bind(utilisateur.steam_id, utilisateur.pays, jourDeLaVeille()),
    env.DB.prepare(
      `SELECT ${COLONNES_PRODUIT}, sh.ecarte
         FROM souhaits sh JOIN produits p ON p.app_id = sh.app_id
        WHERE sh.steam_id = ?1 AND ${SQL_SOUHAIT_NON_SUIVI}
        ORDER BY sh.rang`,
    ).bind(utilisateur.steam_id),
    env.DB.prepare("SELECT termine_le FROM releves_pays WHERE pays = ?").bind(utilisateur.pays),
  ]);

  return json({
    limite: LIMITE_DE_SUIVI,
    releveLe: releve.results[0]?.termine_le ?? null,
    // null tant que la liste n'a jamais été lue, false si elle est vide ou privée.
    souhaitsVisibles: utilisateur.souhaits_visibles === null ? null : utilisateur.souhaits_visibles === 1,
    produits: produits.map((produit) => ({ ...produitVersJson(produit), prix: prixVersJson(produit) })),
    nonSuivis: nonSuivis.map((produit) => ({ ...produitVersJson(produit), ecarte: produit.ecarte === 1 })),
  });
}

function lireProduit(env, appId) {
  return env.DB.prepare(`SELECT ${COLONNES_PRODUIT} FROM produits p WHERE p.app_id = ?`).bind(appId).first();
}

// Produit déjà connu de l'appli, sinon fiche demandée à Steam puis enregistrée.
// Renvoie { produit } ou { erreur }.
async function trouverProduit(env, appId, pays) {
  const connu = await lireProduit(env, appId);
  if (connu) return { produit: connu };

  const fiches = await siSteamRepond(lireFichesSteam([appId], pays), null);
  if (!fiches) return { erreur: ERREURS_AJOUT.steamIndisponible };
  const fiche = fiches.get(appId);
  if (!fiche) return { erreur: ERREURS_AJOUT.introuvable };
  if (!fiche.type) return { erreur: ERREURS_AJOUT.typeNonSuivi };

  await env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, ?, ?)")
    .bind(fiche.appId, fiche.type, fiche.nom)
    .run();
  return { produit: await lireProduit(env, fiche.appId) };
}

// Note la provenance d'un produit déjà suivi ; renvoie true s'il l'était.
async function noterProvenance(env, steamId, appId, provenance) {
  const { meta } = await env.DB.prepare(`UPDATE suivis SET ${provenance} = 1 WHERE steam_id = ? AND app_id = ?`)
    .bind(steamId, appId)
    .run();
  return meta.changes > 0;
}

// Suit le produit pour l'utilisateur, dans la limite de suivi, en notant sa
// provenance (une valeur de PROVENANCES). Répond 201 si le produit est ajouté,
// 200 avec `dejaSuivi` s'il l'était déjà, ou 409 si la limite est atteinte.
export async function suivre(env, steamId, produit, provenance) {
  if (!Object.hasOwn(PROVENANCES, provenance)) throw new Error(`Provenance inconnue : ${provenance}`);
  const reponse = (dejaSuivi) => json({ produit: produitVersJson(produit), dejaSuivi }, { status: dejaSuivi ? 200 : 201 });
  if (await noterProvenance(env, steamId, produit.app_id, provenance)) return reponse(true);

  // L'ajout et la vérification de la limite se font en une seule requête, pour
  // que deux ajouts simultanés ne puissent pas la dépasser. Un produit de la
  // liste de souhaits garde aussi cette provenance.
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO suivis (steam_id, app_id, ajoute_le, manuel, souhait)
     SELECT ?1, ?2, ?3, ?5, EXISTS (SELECT 1 FROM souhaits WHERE steam_id = ?1 AND app_id = ?2)
      WHERE ${sqlPlacesPrises("?4")} < ?6`,
  )
    .bind(
      steamId,
      produit.app_id,
      new Date().toISOString(),
      produit.type,
      provenance === PROVENANCES.manuel ? 1 : 0,
      LIMITE_DE_SUIVI,
    )
    .run();
  if (meta.changes === 0) {
    // Rien d'inséré : soit la limite est atteinte, soit un ajout simultané du
    // même produit vient de passer.
    if (await noterProvenance(env, steamId, produit.app_id, provenance)) return reponse(true);
    return refus(ERREURS_AJOUT.limiteAtteinte, { type: produit.type, limite: LIMITE_DE_SUIVI });
  }

  // Suivi à nouveau : il n'est plus écarté de la liste de souhaits.
  await env.DB.prepare("UPDATE souhaits SET ecarte = 0 WHERE steam_id = ? AND app_id = ?")
    .bind(steamId, produit.app_id)
    .run();
  return reponse(false);
}

// Ajout manuel à partir d'un AppID ou d'un lien Steam (corps : { lien }).
export async function ajouterSuivi({ request, utilisateur, env }) {
  const corps = await request.json().catch(() => null);
  const saisie = lireSaisieProduit(corps?.lien);
  if (!saisie) return refus(ERREURS_AJOUT.lienInvalide);
  if (saisie.pack) return refus(ERREURS_AJOUT.pack);

  const { produit, erreur } = await trouverProduit(env, saisie.appId, paysDe(utilisateur));
  if (erreur) return refus(erreur);
  return suivre(env, utilisateur.steam_id, produit, PROVENANCES.manuel);
}

// Un produit retiré qui est dans la liste de souhaits y reste, écarté : la
// synchronisation ne le suivra plus d'elle-même.
export async function retirerSuivi({ utilisateur, env, appId }) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM suivis WHERE steam_id = ? AND app_id = ?").bind(utilisateur.steam_id, appId),
    env.DB.prepare("UPDATE souhaits SET ecarte = 1 WHERE steam_id = ? AND app_id = ?").bind(utilisateur.steam_id, appId),
  ]);
  return sansContenu();
}
