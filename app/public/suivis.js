// Partagé par l'appli et le Worker : règles des produits suivis.

// Types de produits suivis, comptés séparément dans la limite de suivi, et le
// type correspondant dans la boutique Steam (champ `type` de GetItems).
export const TYPE_STEAM = { jeu: 0, dlc: 4 };
export const TYPES_PRODUIT = Object.keys(TYPE_STEAM);

// Limite de suivi, par type (voir GLOSSARY.md).
export const LIMITE_DE_SUIVI = 200;

// Recherche d'un produit par son nom : longueur minimale du texte cherché.
export const LONGUEUR_MIN_RECHERCHE = 2;

// État du dernier prix relevé d'un produit dans un pays.
export const ETATS_PRIX = {
  enVente: "enVente",
  gratuit: "gratuit",
  pasEncoreSorti: "pasEncoreSorti",
  // Pas en vente dans ce pays, ou retiré de Steam (signalé à part).
  sansPrix: "sansPrix",
};

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
