// Écran Mes suivis : ajout manuel, onglets Jeux / DLC, prix, retrait, et
// produits de la liste de souhaits restés non suivis.
import { afficherMessage, elementParId } from "/page.js";
import { ERREURS_AJOUT, TYPES_PRODUIT } from "/suivis.js";
import { poserTexte, texte } from "/textes.js";

const ADRESSE_PRODUIT_STEAM = "https://store.steampowered.com/app/";

let ongletActif = TYPES_PRODUIT[0];
// Dernière réponse de GET /api/suivis.
let etatSuivis = { produits: [], nonSuivis: [], limite: 0, prixDisponibles: true, souhaitsVisibles: null };

// « −50 % » en français, « -50% » en anglais.
function reductionAffichee(reduction) {
  return new Intl.NumberFormat(document.documentElement.lang, { style: "percent" }).format(-reduction / 100);
}

function element(balise, { classe, texte: contenu } = {}) {
  const nouveau = document.createElement(balise);
  if (classe) nouveau.className = classe;
  if (contenu) nouveau.textContent = contenu;
  return nouveau;
}

function elementPrix(prix) {
  if (!prix) return element("span", { classe: "sans-prix", texte: texte("suivis.sansPrix") });
  const bloc = element("span", { classe: "prix" });
  bloc.append(element("strong", { texte: prix.actuel }));
  if (prix.reduction > 0) {
    if (prix.initial) bloc.append(" ", element("s", { texte: prix.initial }));
    bloc.append(" ", element("span", { classe: "reduction", texte: reductionAffichee(prix.reduction) }));
  }
  return bloc;
}

function lienSteam(produit) {
  const lien = element("a", { texte: produit.nom });
  lien.href = `${ADRESSE_PRODUIT_STEAM}${produit.appId}/`;
  lien.target = "_blank";
  lien.rel = "noopener";
  return lien;
}

function bouton(cle, action) {
  const nouveau = element("button", { classe: "bouton secondaire", texte: texte(cle) });
  nouveau.type = "button";
  nouveau.addEventListener("click", () => action(nouveau));
  return nouveau;
}

function elementProduit(produit) {
  const ligne = element("li", { classe: "suivi" });
  ligne.append(
    lienSteam(produit),
    etatSuivis.prixDisponibles ? elementPrix(produit.prix) : "",
    bouton("suivis.retirer", (retirer) => retirerProduit(produit, retirer)),
  );
  return ligne;
}

// Produit de la liste de souhaits resté non suivi.
function elementNonSuivi(produit) {
  const ligne = element("li", { classe: "suivi" });
  ligne.append(
    lienSteam(produit),
    element("span", { classe: "note", texte: texte(produit.ecarte ? "souhaits.ecarte" : "souhaits.limiteAtteinte") }),
    bouton("souhaits.suivre", (suivre) => suivreSouhait(produit, suivre)),
  );
  return ligne;
}

function afficherListe() {
  for (const type of TYPES_PRODUIT) {
    // Comme pour la limite côté serveur, les produits retirés de Steam ne comptent pas.
    const nombre = etatSuivis.produits.filter((produit) => produit.type === type && !produit.retireDeSteam).length;
    elementParId(`compte-${type}`).textContent = `${nombre} / ${etatSuivis.limite}`;
    elementParId(`onglet-${type}`).setAttribute("aria-selected", String(type === ongletActif));
  }
  elementParId("prix-indisponibles").hidden = etatSuivis.prixDisponibles;

  const produits = etatSuivis.produits.filter((produit) => produit.type === ongletActif);
  elementParId("liste-suivis").replaceChildren(...produits.map(elementProduit));
  const vide = elementParId("liste-vide");
  vide.hidden = produits.length > 0;
  poserTexte(vide, `suivis.vide.${ongletActif}`);

  const nonSuivis = etatSuivis.nonSuivis.filter((produit) => produit.type === ongletActif);
  elementParId("titre-non-suivis").hidden = nonSuivis.length === 0;
  elementParId("liste-non-suivis").replaceChildren(...nonSuivis.map(elementNonSuivi));
  elementParId("souhaits-prives").hidden = etatSuivis.souhaitsVisibles !== false;
}

async function chargerSuivis() {
  const reponse = await fetch("/api/suivis").catch(() => null);
  if (!reponse?.ok) {
    afficherMessage(elementParId("erreur-suivis"), "suivis.erreur", { erreur: true });
    return;
  }
  elementParId("erreur-suivis").hidden = true;
  etatSuivis = await reponse.json();
  afficherListe();
}

// Rechargée après un retrait : un produit de la liste de souhaits passe dans les non suivis.
async function retirerProduit(produit, retirer) {
  retirer.disabled = true;
  const reponse = await fetch(`/api/suivis/${produit.appId}`, { method: "DELETE" }).catch(() => null);
  if (!reponse?.ok) {
    retirer.disabled = false;
    afficherMessage(elementParId("message-ajout"), "suivis.erreurRetrait", { erreur: true });
    return;
  }
  await chargerSuivis();
}

// Clé du texte qui explique pourquoi l'ajout a été refusé.
function cleRefus({ erreur, type } = {}) {
  if (erreur === ERREURS_AJOUT.limiteAtteinte) return `ajout.erreur.limiteAtteinte.${type}`;
  if (Object.hasOwn(ERREURS_AJOUT, erreur)) return `ajout.erreur.${erreur}`;
  return "ajout.erreur.inconnue";
}

async function suivreSouhait(produit, suivre) {
  suivre.disabled = true;
  const reponse = await fetch(`/api/souhaits/${produit.appId}`, { method: "POST" }).catch(() => null);
  if (!reponse?.ok) {
    suivre.disabled = false;
    const resultat = await reponse?.json().catch(() => null);
    afficherMessage(elementParId("message-ajout"), cleRefus(resultat ?? {}), { erreur: true });
    return;
  }
  await chargerSuivis();
}

// Relecture de la liste de souhaits, par exemple après l'avoir rendue publique.
async function relireSouhaits() {
  const relire = elementParId("relire-souhaits");
  const message = elementParId("message-souhaits");
  relire.disabled = true;
  const reponse = await fetch("/api/souhaits/relire", { method: "POST" }).catch(() => null);
  relire.disabled = false;
  if (reponse?.ok) {
    afficherMessage(message, "souhaits.relue");
    await chargerSuivis();
    return;
  }
  afficherMessage(message, reponse?.status === 429 ? "souhaits.tropTot" : "souhaits.erreur", { erreur: true });
}

async function ajouterProduit(evenement) {
  evenement.preventDefault();
  const champ = elementParId("lien");
  const bouton = elementParId("valider-ajout");
  const message = elementParId("message-ajout");
  message.hidden = true;
  bouton.disabled = true;

  const reponse = await fetch("/api/suivis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lien: champ.value }),
  }).catch(() => null);
  const resultat = await reponse?.json().catch(() => null);
  bouton.disabled = false;

  if (!reponse?.ok || !resultat?.produit) {
    afficherMessage(message, cleRefus(resultat ?? {}), { erreur: true });
    return;
  }
  champ.value = "";
  ongletActif = resultat.produit.type;
  afficherMessage(message, resultat.dejaSuivi ? "ajout.dejaSuivi" : "ajout.ajoute");
  await chargerSuivis();
}

export function preparerMesSuivis() {
  elementParId("formulaire-ajout").addEventListener("submit", ajouterProduit);
  elementParId("relire-souhaits").addEventListener("click", relireSouhaits);
  for (const type of TYPES_PRODUIT) {
    elementParId(`onglet-${type}`).addEventListener("click", () => {
      ongletActif = type;
      afficherListe();
    });
  }
  afficherListe();
  return chargerSuivis();
}
