// Fil d'alertes d'un utilisateur. Les alertes sont créées par le relevé des
// prix (worker/src/releve.js).
import { EVENEMENTS } from "../../app/public/alertes.js";
import { json, montantsVersJson } from "./reponses.js";

// Nombre d'alertes renvoyées : les plus récentes.
const TAILLE_DU_FIL = 100;

// Événement → colonne de la table alertes qui le signale (le relevé y écrit 1).
export const COLONNES_EVENEMENTS = { [EVENEMENTS.debutPromo]: "debut_promo" };

function alerteVersJson(ligne) {
  return {
    id: ligne.id,
    evenements: Object.entries(COLONNES_EVENEMENTS)
      .filter(([, colonne]) => ligne[colonne] === 1)
      .map(([evenement]) => evenement),
    appId: ligne.app_id,
    nom: ligne.nom,
    creeLe: ligne.cree_le,
    prix: montantsVersJson(ligne),
  };
}

// Alertes de l'utilisateur, de la plus récente à la plus ancienne.
export async function listerAlertes({ utilisateur, env }) {
  const { results } = await env.DB.prepare(
    `SELECT a.*, p.nom FROM alertes a JOIN produits p ON p.app_id = a.app_id
      WHERE a.steam_id = ?
      ORDER BY a.cree_le DESC, a.id DESC
      LIMIT ?`,
  )
    .bind(utilisateur.steam_id, TAILLE_DU_FIL)
    .all();
  return json({ alertes: results.map(alerteVersJson) });
}
