// Recherche d'un produit par son nom, pour l'ajouter à ses suivis.
import { ERREURS_RECHERCHE, LONGUEUR_MIN_RECHERCHE } from "../../app/public/suivis.js";
import { json } from "./reponses.js";
import { chercherProduitsSteam } from "./steam-boutique.js";
import { appIdsSuivis, siSteamRepond } from "./suivis.js";
import { paysDe } from "./utilisateur.js";

// Nombre de résultats renvoyés, et longueur maximale du texte cherché.
const NOMBRE_DE_RESULTATS = 10;
const LONGUEUR_MAX_RECHERCHE = 100;

// Statut HTTP de chaque échec de la recherche.
const STATUT_ERREUR = {
  [ERREURS_RECHERCHE.tropCourte]: 400,
  [ERREURS_RECHERCHE.steamIndisponible]: 502,
};

const echec = (erreur) => json({ erreur }, { status: STATUT_ERREUR[erreur] });

// Jeux et DLC suivables dont le nom correspond au paramètre `texte`, dans le
// pays et la langue de l'utilisateur, en signalant ceux qu'il suit déjà.
// shortcut: aucune limite par utilisateur ; seuls la pause de frappe de
// l'appli et le cache de 15 minutes ménagent Steam. En ajouter une si des
// abus apparaissent.
export async function rechercherProduits({ url, utilisateur, env }) {
  const texte = (url.searchParams.get("texte") ?? "").trim().slice(0, LONGUEUR_MAX_RECHERCHE);
  if (texte.length < LONGUEUR_MIN_RECHERCHE) return echec(ERREURS_RECHERCHE.tropCourte);

  const produits = await siSteamRepond(
    chercherProduitsSteam(texte, { pays: paysDe(utilisateur), langue: utilisateur.langue }, NOMBRE_DE_RESULTATS),
    null,
  );
  if (!produits) return echec(ERREURS_RECHERCHE.steamIndisponible);

  const suivis = await appIdsSuivis(env, utilisateur.steam_id, produits.map(({ appId }) => appId));
  return json({ resultats: produits.map((produit) => ({ ...produit, suivi: suivis.has(produit.appId) })) });
}
