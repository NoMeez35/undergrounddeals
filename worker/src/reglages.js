// Réglages que l'utilisateur choisit lui-même : son pays et sa langue.
import { lireLangue } from "../../app/public/langues.js";
import { lirePays } from "../../app/public/pays.js";
import { json, sansContenu } from "./reponses.js";

// Renvoie { pays, langue } si le corps de la requête les donne tous deux valides, sinon null.
export function lireReglages(corps) {
  const pays = lirePays(corps?.pays);
  const langue = lireLangue(corps?.langue);
  return pays && langue ? { pays, langue } : null;
}

// Le pays ne sert qu'aux prix affichés et aux relevés et alertes à venir :
// en changer ne crée aucune alerte pour des événements passés.
export async function enregistrerReglages({ request, utilisateur, env }) {
  const reglages = lireReglages(await request.json().catch(() => null));
  if (!reglages) return json({ erreur: "pays ou langue invalide" }, { status: 400 });

  await env.DB.prepare("UPDATE utilisateurs SET pays = ?, langue = ? WHERE steam_id = ?")
    .bind(reglages.pays, reglages.langue, utilisateur.steam_id)
    .run();
  return sansContenu();
}
