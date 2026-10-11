// Réglages que l'utilisateur choisit lui-même : son pays et sa langue.
import { lireLangue } from "../../app/public/langues.js";
import { lirePays } from "../../app/public/pays.js";

// Renvoie { pays, langue } si le corps de la requête les donne tous deux valides, sinon null.
export function lireReglages(corps) {
  const pays = lirePays(corps?.pays);
  const langue = lireLangue(corps?.langue);
  return pays && langue ? { pays, langue } : null;
}
