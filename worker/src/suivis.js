// Produits suivis d'un utilisateur : liste avec prix, ajout manuel, retrait.
import { PAYS_PAR_DEFAUT } from "../../app/public/pays.js";
import { ERREURS_AJOUT, LIMITE_DE_SUIVI } from "../../app/public/suivis.js";
import { json, sansContenu } from "./reponses.js";
import { lireSaisieProduit } from "./saisie-produit.js";
import { lireFicheSteam, lirePrixSteam, SteamIndisponible } from "./steam-boutique.js";

const COLONNES_PRODUIT = "p.app_id, p.type, p.nom, p.retire_de_steam";

// Statut HTTP de chaque refus d'ajout.
const STATUT_REFUS = {
  [ERREURS_AJOUT.lienInvalide]: 400,
  [ERREURS_AJOUT.pack]: 422,
  [ERREURS_AJOUT.introuvable]: 404,
  [ERREURS_AJOUT.typeNonSuivi]: 422,
  [ERREURS_AJOUT.limiteAtteinte]: 409,
  [ERREURS_AJOUT.steamIndisponible]: 502,
};

function refus(erreur, details = {}) {
  return json({ erreur, ...details }, { status: STATUT_REFUS[erreur] });
}

// Résultat de la promesse, ou `siPanne` si Steam ne répond pas ; les autres
// erreurs remontent.
async function siSteamRepond(promesse, siPanne) {
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

// Produits suivis, du plus récent au plus ancien, avec leur prix actuel dans le
// pays de l'utilisateur. Si Steam ne répond pas, la liste est renvoyée sans prix
// et `prixDisponibles` vaut false.
export async function listerSuivis({ utilisateur, env }) {
  const { results: produits } = await env.DB.prepare(
    `SELECT ${COLONNES_PRODUIT}
       FROM suivis s JOIN produits p ON p.app_id = s.app_id
      WHERE s.steam_id = ?
      ORDER BY s.ajoute_le DESC, p.nom`,
  )
    .bind(utilisateur.steam_id)
    .all();

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
    produits: produits.map((produit) => ({
      ...produitVersJson(produit),
      prix: prix?.get(produit.app_id) ?? null,
    })),
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

  const fiche = await siSteamRepond(lireFicheSteam(appId, pays), { erreur: ERREURS_AJOUT.steamIndisponible });
  if (fiche?.erreur) return fiche;
  if (!fiche) return { erreur: ERREURS_AJOUT.introuvable };
  if (!fiche.type) return { erreur: ERREURS_AJOUT.typeNonSuivi };

  await env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, ?, ?)")
    .bind(fiche.appId, fiche.type, fiche.nom)
    .run();
  return { produit: await lireProduit(env, fiche.appId) };
}

function estSuivi(env, steamId, appId) {
  return env.DB.prepare("SELECT 1 FROM suivis WHERE steam_id = ? AND app_id = ?").bind(steamId, appId).first();
}

// Ajout manuel à partir d'un AppID ou d'un lien Steam (corps : { lien }).
// Répond 201 avec le produit ajouté, 200 avec `dejaSuivi` s'il l'était déjà,
// ou une erreur de ERREURS_AJOUT.
export async function ajouterSuivi({ request, utilisateur, env }) {
  const corps = await request.json().catch(() => null);
  const saisie = lireSaisieProduit(corps?.lien);
  if (!saisie) return refus(ERREURS_AJOUT.lienInvalide);
  if (saisie.pack) return refus(ERREURS_AJOUT.pack);

  const { produit, erreur } = await trouverProduit(env, saisie.appId, utilisateur.pays ?? PAYS_PAR_DEFAUT);
  if (erreur) return refus(erreur);

  const dejaSuivi = { produit: produitVersJson(produit), dejaSuivi: true };
  if (await estSuivi(env, utilisateur.steam_id, produit.app_id)) return json(dejaSuivi);

  // L'ajout et la vérification de la limite se font en une seule requête, pour
  // que deux ajouts simultanés ne puissent pas la dépasser.
  const { meta } = await env.DB.prepare(
    `INSERT OR IGNORE INTO suivis (steam_id, app_id, ajoute_le)
     SELECT ?1, ?2, ?3
      WHERE (SELECT COUNT(*)
               FROM suivis s JOIN produits p ON p.app_id = s.app_id
              WHERE s.steam_id = ?1 AND p.type = ?4 AND p.retire_de_steam = 0) < ?5`,
  )
    .bind(utilisateur.steam_id, produit.app_id, new Date().toISOString(), produit.type, LIMITE_DE_SUIVI)
    .run();
  if (meta.changes === 0) {
    // Rien d'inséré : soit la limite est atteinte, soit un ajout simultané du
    // même produit vient de passer.
    if (await estSuivi(env, utilisateur.steam_id, produit.app_id)) return json(dejaSuivi);
    return refus(ERREURS_AJOUT.limiteAtteinte, { type: produit.type, limite: LIMITE_DE_SUIVI });
  }

  return json({ produit: produitVersJson(produit), dejaSuivi: false }, { status: 201 });
}

export async function retirerSuivi({ utilisateur, env, appId }) {
  await env.DB.prepare("DELETE FROM suivis WHERE steam_id = ? AND app_id = ?")
    .bind(utilisateur.steam_id, appId)
    .run();
  return sansContenu();
}
