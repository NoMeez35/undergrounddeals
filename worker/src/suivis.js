// Produits suivis d'un utilisateur : liste avec prix, ajout manuel, retrait.
import { PAYS_PAR_DEFAUT } from "../../app/public/pays.js";
import { ERREURS_AJOUT, LIMITE_DE_SUIVI } from "../../app/public/suivis.js";
import { json, sansContenu } from "./reponses.js";
import { lireSaisieProduit } from "./saisie-produit.js";
import { lireFichesSteam, lirePrixSteam, SteamIndisponible } from "./steam-boutique.js";

export const COLONNES_PRODUIT = "p.app_id, p.type, p.nom, p.retire_de_steam";

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

// Produits suivis, du plus récent au plus ancien (ceux d'un même import dans
// l'ordre de la liste de souhaits), avec leur prix actuel dans le pays de
// l'utilisateur ; puis les produits de sa liste de souhaits qui ne sont pas
// suivis. Si Steam ne répond pas, les prix manquent et `prixDisponibles` vaut false.
export async function listerSuivis({ utilisateur, env }) {
  const [{ results: produits }, { results: nonSuivis }] = await env.DB.batch([
    env.DB.prepare(
      `SELECT ${COLONNES_PRODUIT}
         FROM suivis s
         JOIN produits p ON p.app_id = s.app_id
         LEFT JOIN souhaits w ON w.steam_id = s.steam_id AND w.app_id = s.app_id
        WHERE s.steam_id = ?
        ORDER BY s.ajoute_le DESC, w.rang, p.nom`,
    ).bind(utilisateur.steam_id),
    env.DB.prepare(
      `SELECT ${COLONNES_PRODUIT}, w.ecarte
         FROM souhaits w JOIN produits p ON p.app_id = w.app_id
        WHERE w.steam_id = ?1
          AND NOT EXISTS (SELECT 1 FROM suivis s WHERE s.steam_id = ?1 AND s.app_id = w.app_id)
        ORDER BY w.rang`,
    ).bind(utilisateur.steam_id),
  ]);

  const prix =
    produits.length > 0 && utilisateur.pays
      ? await siSteamRepond(
          lirePrixSteam(
            produits.map((produit) => produit.app_id),
            utilisateur.pays,
          ),
          null,
        )
      : new Map();

  return json({
    limite: LIMITE_DE_SUIVI,
    prixDisponibles: prix !== null,
    // null tant que la liste n'a jamais été lue, false si elle est vide ou privée.
    souhaitsVisibles: utilisateur.souhaits_visibles === null ? null : utilisateur.souhaits_visibles === 1,
    produits: produits.map((produit) => ({
      ...produitVersJson(produit),
      prix: prix?.get(produit.app_id) ?? null,
    })),
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
// provenance : "manuel" (ajout manuel) ou "souhait" (liste de souhaits).
// Répond 201 si le produit est ajouté, 200 avec `dejaSuivi` s'il l'était déjà,
// ou 409 si la limite est atteinte.
export async function suivre(env, steamId, produit, provenance) {
  const reponse = (dejaSuivi) => json({ produit: produitVersJson(produit), dejaSuivi }, { status: dejaSuivi ? 200 : 201 });
  if (await noterProvenance(env, steamId, produit.app_id, provenance)) return reponse(true);

  // L'ajout et la vérification de la limite se font en une seule requête, pour
  // que deux ajouts simultanés ne puissent pas la dépasser.
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO suivis (steam_id, app_id, ajoute_le, manuel, souhait)
     SELECT ?1, ?2, ?3, ?6 = 'manuel',
            EXISTS (SELECT 1 FROM souhaits WHERE steam_id = ?1 AND app_id = ?2)
      WHERE (SELECT COUNT(*)
               FROM suivis s JOIN produits p ON p.app_id = s.app_id
              WHERE s.steam_id = ?1 AND p.type = ?4 AND p.retire_de_steam = 0) < ?5`,
  )
    .bind(steamId, produit.app_id, new Date().toISOString(), produit.type, LIMITE_DE_SUIVI, provenance)
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

  const { produit, erreur } = await trouverProduit(env, saisie.appId, utilisateur.pays ?? PAYS_PAR_DEFAUT);
  if (erreur) return refus(erreur);
  return suivre(env, utilisateur.steam_id, produit, "manuel");
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
