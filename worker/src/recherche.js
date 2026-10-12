// Recherche d'un produit par son nom, pour l'ajouter à ses suivis.
import { ERREURS_AJOUT, LONGUEUR_MIN_RECHERCHE } from "../../app/public/suivis.js";
import { json } from "./reponses.js";
import { chercherProduitsSteam } from "./steam-boutique.js";
import { refus, siSteamRepond } from "./suivis.js";
import { paysDe } from "./utilisateur.js";

// Nombre de résultats renvoyés, et longueur maximale du texte cherché.
const NOMBRE_DE_RESULTATS = 10;
const LONGUEUR_MAX_RECHERCHE = 100;

// Jeux et DLC suivables dont le nom correspond au paramètre `texte`, dans le
// pays et la langue de l'utilisateur, en signalant ceux qu'il suit déjà.
export async function rechercherProduits({ url, utilisateur, env }) {
  const texte = (url.searchParams.get("texte") ?? "").trim().slice(0, LONGUEUR_MAX_RECHERCHE);
  if (texte.length < LONGUEUR_MIN_RECHERCHE) return json({ erreur: "rechercheTropCourte" }, { status: 400 });

  const produits = await siSteamRepond(
    chercherProduitsSteam(texte, paysDe(utilisateur), utilisateur.langue, NOMBRE_DE_RESULTATS),
    null,
  );
  if (!produits) return refus(ERREURS_AJOUT.steamIndisponible);

  const { results } = await env.DB.prepare(
    "SELECT app_id FROM suivis WHERE steam_id = ? AND app_id IN (SELECT value FROM json_each(?))",
  )
    .bind(utilisateur.steam_id, JSON.stringify(produits.map(({ appId }) => appId)))
    .all();
  const suivis = new Set(results.map(({ app_id }) => app_id));
  return json({ resultats: produits.map((produit) => ({ ...produit, suivi: suivis.has(produit.appId) })) });
}
