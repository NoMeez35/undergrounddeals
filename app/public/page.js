// Outils communs aux écrans de la page.
import { poserTexte } from "/textes.js";

const ADRESSE_PRODUIT_STEAM = "https://store.steampowered.com/app/";

export const elementParId = (id) => document.getElementById(id);

// Affiche le texte d'une clé dans un élément de message, en rouge si c'est une erreur.
export function afficherMessage(element, cle, { erreur = false } = {}) {
  poserTexte(element, cle);
  element.className = erreur ? "erreur" : "";
  element.hidden = false;
}

export function element(balise, { classe, texte: contenu } = {}) {
  const nouveau = document.createElement(balise);
  if (classe) nouveau.className = classe;
  if (contenu) nouveau.textContent = contenu;
  return nouveau;
}

// « −50 % » en français, « -50% » en anglais.
function reductionAffichee(reduction) {
  return new Intl.NumberFormat(document.documentElement.lang, { style: "percent" }).format(-reduction / 100);
}

// Heure seule si c'est aujourd'hui, sinon date et heure, dans la langue de l'interface.
export function dateAffichee(iso) {
  const date = new Date(iso);
  const options =
    date.toDateString() === new Date().toDateString() ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat(document.documentElement.lang, options).format(date);
}

// Prix mis en forme par Steam : actuel, et s'il est réduit, initial barré et réduction.
export function elementMontants({ actuel, initial, reduction }) {
  const bloc = element("span", { classe: "prix" });
  bloc.append(element("strong", { texte: actuel }));
  if (reduction > 0) {
    if (initial) bloc.append(" ", element("s", { texte: initial }));
    bloc.append(" ", element("span", { classe: "reduction", texte: reductionAffichee(reduction) }));
  }
  return bloc;
}

// Nom du produit, avec un lien vers sa page Steam.
export function lienSteam({ appId, nom }) {
  const lien = element("a", { texte: nom });
  lien.href = `${ADRESSE_PRODUIT_STEAM}${appId}/`;
  lien.target = "_blank";
  lien.rel = "noopener";
  return lien;
}
