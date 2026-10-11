// Produits suivis d'un utilisateur : liste avec prix, ajout manuel, retrait.
import { ERREURS_AJOUT, LIMITE_DE_SUIVI } from "../../app/public/suivis.js";
import { lireLienSteam } from "./lien-steam.js";
import { json, sansContenu } from "./reponses.js";
import { lireFicheSteam, lirePrixSteam, SteamIndisponible } from "./steam-boutique.js";

function refus(erreur, status, details = {}) {
  return json({ erreur, ...details }, { status });
}

function produitVersJson({ app_id, type, nom, retire_de_steam }) {
  return { appId: app_id, type, nom, retireDeSteam: retire_de_steam === 1 };
}

// Produits suivis, du plus récent au plus ancien, avec leur prix actuel dans le
// pays de l'utilisateur. Si Steam ne répond pas, la liste est renvoyée sans prix
// et `prixDisponibles` vaut false.
export async function listerSuivis({ utilisateur, env }) {
  const { results: produits } = await env.DB.prepare(
    `SELECT p.app_id, p.type, p.nom, p.retire_de_steam
       FROM suivis s JOIN produits p ON p.app_id = s.app_id
      WHERE s.steam_id = ?
      ORDER BY s.ajoute_le DESC, p.nom`,
  )
    .bind(utilisateur.steam_id)
    .all();

  let prix = new Map();
  let prixDisponibles = true;
  if (produits.length > 0 && utilisateur.pays) {
    try {
      prix = await lirePrixSteam(
        produits.map((produit) => produit.app_id),
        utilisateur.pays,
      );
    } catch (erreur) {
      if (!(erreur instanceof SteamIndisponible)) throw erreur;
      prixDisponibles = false;
    }
  }

  return json({
    limite: LIMITE_DE_SUIVI,
    prixDisponibles,
    produits: produits.map((produit) => ({
      ...produitVersJson(produit),
      prix: prix.get(produit.app_id) ?? null,
    })),
  });
}

function lireProduit(env, appId) {
  return env.DB.prepare("SELECT app_id, type, nom, retire_de_steam FROM produits WHERE app_id = ?")
    .bind(appId)
    .first();
}

// Produit déjà connu de l'appli, sinon fiche demandée à Steam puis enregistrée.
// Renvoie { produit } ou { erreur }.
async function trouverProduit(env, appId, pays) {
  const connu = await lireProduit(env, appId);
  if (connu) return { produit: connu };

  let fiche;
  try {
    fiche = await lireFicheSteam(appId, pays);
  } catch (erreur) {
    if (!(erreur instanceof SteamIndisponible)) throw erreur;
    return { erreur: ERREURS_AJOUT.steamIndisponible };
  }
  if (!fiche) return { erreur: ERREURS_AJOUT.introuvable };
  if (!fiche.type) return { erreur: ERREURS_AJOUT.typeNonSuivi };

  await env.DB.prepare("INSERT OR IGNORE INTO produits (app_id, type, nom) VALUES (?, ?, ?)")
    .bind(fiche.appId, fiche.type, fiche.nom)
    .run();
  return { produit: await lireProduit(env, fiche.appId) };
}

const STATUT_REFUS = {
  [ERREURS_AJOUT.introuvable]: 404,
  [ERREURS_AJOUT.typeNonSuivi]: 422,
  [ERREURS_AJOUT.steamIndisponible]: 502,
};

// Ajout manuel à partir d'un AppID ou d'un lien Steam (corps : { lien }).
// Répond 201 avec le produit ajouté, 200 avec `dejaSuivi` s'il l'était déjà,
// ou une erreur de ERREURS_AJOUT.
export async function ajouterSuivi({ request, utilisateur, env }) {
  const corps = await request.json().catch(() => null);
  const lien = lireLienSteam(corps?.lien);
  if (!lien) return refus(ERREURS_AJOUT.lienInvalide, 400);
  if (lien.pack) return refus(ERREURS_AJOUT.pack, 422);

  const { produit, erreur } = await trouverProduit(env, lien.appId, utilisateur.pays ?? "US");
  if (erreur) return refus(erreur, STATUT_REFUS[erreur]);

  const dejaSuivi = await env.DB.prepare("SELECT 1 FROM suivis WHERE steam_id = ? AND app_id = ?")
    .bind(utilisateur.steam_id, produit.app_id)
    .first();
  if (dejaSuivi) return json({ produit: produitVersJson(produit), dejaSuivi: true });

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
    return refus(ERREURS_AJOUT.limiteAtteinte, 409, { type: produit.type, limite: LIMITE_DE_SUIVI });
  }

  return json({ produit: produitVersJson(produit), dejaSuivi: false }, { status: 201 });
}

export async function retirerSuivi({ utilisateur, env, appId }) {
  await env.DB.prepare("DELETE FROM suivis WHERE steam_id = ? AND app_id = ?")
    .bind(utilisateur.steam_id, appId)
    .run();
  return sansContenu();
}
