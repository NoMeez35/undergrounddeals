// Partagé par l'appli et le Worker : règles des produits suivis.

// Types de produits suivis, comptés séparément dans la limite de suivi, et le
// type correspondant dans la boutique Steam.
export const TYPE_STEAM = { jeu: "game", dlc: "dlc" };
export const TYPES_PRODUIT = Object.keys(TYPE_STEAM);

// Limite de suivi, par type (voir GLOSSARY.md).
export const LIMITE_DE_SUIVI = 200;

// Raisons pour lesquelles un ajout est refusé (champ `erreur` de la réponse) ;
// l'appli affiche le texte `ajout.erreur.<raison>`.
export const ERREURS_AJOUT = {
  lienInvalide: "lienInvalide",
  pack: "pack",
  introuvable: "introuvable",
  typeNonSuivi: "typeNonSuivi",
  limiteAtteinte: "limiteAtteinte",
  steamIndisponible: "steamIndisponible",
};
