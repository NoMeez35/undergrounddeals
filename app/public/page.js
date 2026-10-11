// Outils communs aux écrans de la page.
import { poserTexte } from "/textes.js";

export const elementParId = (id) => document.getElementById(id);

// Affiche le texte d'une clé dans un élément de message, en rouge si c'est une erreur.
export function afficherMessage(element, cle, { erreur = false } = {}) {
  poserTexte(element, cle);
  element.className = erreur ? "erreur" : "";
  element.hidden = false;
}
