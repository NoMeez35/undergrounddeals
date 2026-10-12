// Écran Mes suivis : ajout manuel (AppID, lien Steam ou recherche par nom),
// onglets Jeux / DLC, prix, retrait, et produits de la liste de souhaits
// restés non suivis.
import { CHEMIN_CONNEXION } from "/chemins.js";
import { afficherMessage, dateAffichee, element, elementMontants, elementParId, lienSteam } from "/page.js";
import { lireSaisieProduit, peutEtreUnNom } from "/saisie-produit.js";
import { ERREURS_AJOUT, ERREURS_RECHERCHE, ETATS_PRIX, TYPES_PRODUIT } from "/suivis.js";
import { poserTexte, texte } from "/textes.js";

// Affichage d'un produit sans prix, selon l'état de son dernier relevé.
const AFFICHAGE_SANS_PRIX = {
  [ETATS_PRIX.gratuit]: { cle: "suivis.gratuit", classe: "badge" },
  [ETATS_PRIX.pasEncoreSorti]: { cle: "suivis.pasEncoreSorti", classe: "sans-prix" },
  [ETATS_PRIX.sansPrix]: { cle: "suivis.sansPrix", classe: "sans-prix" },
};

let ongletActif = TYPES_PRODUIT[0];
// Dernière réponse de GET /api/suivis.
let etatSuivis = { produits: [], nonSuivis: [], limite: 0, releveLe: null, souhaitsVisibles: null };

// Dernier prix relevé, ou ce qui en tient lieu : badges « Retiré de Steam » et
// « Gratuit », pas encore sorti, pas en vente dans le pays, pas encore relevé.
function elementPrix({ prix, retireDeSteam }) {
  if (retireDeSteam) return element("span", { classe: "badge", texte: texte("suivis.retireDeSteam") });
  if (!prix) return element("span", { classe: "sans-prix", texte: texte("suivis.pasEncoreReleve") });
  const sansPrix = AFFICHAGE_SANS_PRIX[prix.etat];
  if (sansPrix) return element("span", { classe: sansPrix.classe, texte: texte(sansPrix.cle) });
  return elementMontants(prix);
}

function bouton(cle, action) {
  const nouveau = element("button", { classe: "bouton secondaire", texte: texte(cle) });
  nouveau.type = "button";
  nouveau.addEventListener("click", () => action(nouveau));
  return nouveau;
}

// Bouton qui ouvre la page Steam d'un produit de la liste de souhaits, pour
// l'enlever aussi de la liste de souhaits Steam, que l'appli ne peut pas modifier.
function boutonOuvrirSurSteam(produit) {
  const ouvrir = lienSteam(produit, texte("souhaits.ouvrirSurSteam"));
  ouvrir.className = "bouton secondaire";
  return ouvrir;
}

function elementProduit(produit) {
  const ligne = element("li", { classe: "suivi" });
  ligne.append(lienSteam(produit), elementPrix(produit));
  if (produit.dansListeDeSouhaits) ligne.append(boutonOuvrirSurSteam(produit));
  ligne.append(bouton("suivis.retirer", (retirer) => retirerProduit(produit, retirer)));
  return ligne;
}

// Places prises dans la limite de suivi pour ce type : comme côté serveur, les
// produits retirés de Steam ne comptent pas.
function placesPrises(type) {
  return etatSuivis.produits.filter((produit) => produit.type === type && !produit.retireDeSteam).length;
}

// Pourquoi un produit de la liste de souhaits n'est pas suivi.
function cleRaisonNonSuivi(produit) {
  if (produit.ecarte) return "souhaits.ecarte";
  if (produit.retireDeSteam) return "souhaits.retireDeSteam";
  if (placesPrises(produit.type) >= etatSuivis.limite) return "souhaits.limiteAtteinte";
  return "souhaits.nonSuivi";
}

// Produit de la liste de souhaits resté non suivi.
function elementNonSuivi(produit) {
  const ligne = element("li", { classe: "suivi" });
  ligne.append(lienSteam(produit), element("span", { classe: "note", texte: texte(cleRaisonNonSuivi(produit)) }));
  if (produit.ecarte) ligne.append(boutonOuvrirSurSteam(produit));
  ligne.append(bouton("souhaits.suivre", (suivre) => suivreSouhait(produit, suivre)));
  return ligne;
}

function afficherListe() {
  for (const type of TYPES_PRODUIT) {
    elementParId(`compte-${type}`).textContent = `${placesPrises(type)} / ${etatSuivis.limite}`;
    elementParId(`onglet-${type}`).setAttribute("aria-selected", String(type === ongletActif));
  }
  elementParId("releve").hidden = !etatSuivis.releveLe;
  if (etatSuivis.releveLe) elementParId("heure-releve").textContent = dateAffichee(etatSuivis.releveLe);

  const produits = etatSuivis.produits.filter((produit) => produit.type === ongletActif);
  elementParId("liste-suivis").replaceChildren(...produits.map(elementProduit));
  const vide = elementParId("liste-vide");
  vide.hidden = produits.length > 0;
  poserTexte(vide, `suivis.vide.${ongletActif}`);

  const nonSuivis = etatSuivis.nonSuivis.filter((produit) => produit.type === ongletActif);
  elementParId("titre-non-suivis").hidden = nonSuivis.length === 0;
  elementParId("liste-non-suivis").replaceChildren(...nonSuivis.map(elementNonSuivi));
  elementParId("souhaits-prives").hidden = etatSuivis.souhaitsVisibles !== false;
  // La colonne de la liste de souhaits n'apparaît que si elle a quelque chose à montrer.
  elementParId("colonne-souhaits").hidden = nonSuivis.length === 0 && etatSuivis.souhaitsVisibles !== false;
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

// Ajout manuel d'un produit à partir d'un AppID ou d'un lien Steam ;
// `boutonAjout` est désactivé pendant l'ajout.
async function ajouterProduit(saisie, boutonAjout) {
  const message = elementParId("message-ajout");
  message.hidden = true;
  boutonAjout.disabled = true;

  const reponse = await fetch("/api/suivis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lien: saisie }),
  }).catch(() => null);
  const resultat = await reponse?.json().catch(() => null);
  boutonAjout.disabled = false;

  if (!reponse?.ok || !resultat?.produit) {
    afficherMessage(message, cleRefus(resultat ?? {}), { erreur: true });
    return;
  }
  elementParId("lien").value = "";
  cacherRecherche();
  ongletActif = resultat.produit.type;
  afficherMessage(message, resultat.dejaSuivi ? "ajout.dejaSuivi" : "ajout.ajoute");
  await chargerSuivis();
}

// Recherche par nom : elle part après une pause dans la frappe. Seule la
// réponse de la dernière recherche lancée est affichée.
const PAUSE_AVANT_RECHERCHE = 400;
let minuterieRecherche;
let derniereRecherche = 0;

function cacherRecherche() {
  clearTimeout(minuterieRecherche);
  derniereRecherche += 1;
  elementParId("resultats-recherche").hidden = true;
  elementParId("message-recherche").hidden = true;
}

function elementResultat(resultat) {
  const ligne = element("li", { classe: "suivi" });
  if (resultat.image) {
    const image = element("img", { classe: "vignette" });
    image.src = resultat.image;
    image.alt = "";
    ligne.append(image);
  }
  ligne.append(lienSteam(resultat), element("span", { classe: "note", texte: texte(`recherche.type.${resultat.type}`) }));
  if (resultat.suivi) ligne.append(element("span", { classe: "note", texte: texte("recherche.dejaSuivi") }));
  else ligne.append(bouton("recherche.suivre", (suivre) => ajouterProduit(String(resultat.appId), suivre)));
  return ligne;
}

// Clé du texte qui explique pourquoi la recherche a échoué.
function cleEchecRecherche({ erreur } = {}) {
  return Object.hasOwn(ERREURS_RECHERCHE, erreur) ? `recherche.erreur.${erreur}` : "recherche.erreur.inconnue";
}

async function rechercher(nom) {
  cacherRecherche();
  const numero = derniereRecherche;
  const reponse = await fetch(`/api/recherche?texte=${encodeURIComponent(nom)}`).catch(() => null);
  const resultat = await reponse?.json().catch(() => null);
  if (numero !== derniereRecherche) return;

  if (reponse?.status === 401) {
    // Session expirée : l'utilisateur doit se reconnecter.
    location.replace(CHEMIN_CONNEXION);
    return;
  }
  const message = elementParId("message-recherche");
  if (!reponse?.ok || !resultat?.resultats) {
    afficherMessage(message, cleEchecRecherche(resultat ?? {}), { erreur: true });
    return;
  }
  if (resultat.resultats.length === 0) {
    // Un nombre est sans doute un AppID : « aucun résultat » l'embrouillerait.
    if (!lireSaisieProduit(nom)) afficherMessage(message, "recherche.aucunResultat");
    return;
  }
  const liste = elementParId("resultats-recherche");
  liste.replaceChildren(...resultat.resultats.map(elementResultat));
  liste.hidden = false;
}

function surSaisie() {
  cacherRecherche();
  const saisie = elementParId("lien").value.trim();
  if (peutEtreUnNom(saisie)) minuterieRecherche = setTimeout(() => rechercher(saisie), PAUSE_AVANT_RECHERCHE);
}

// Valider le formulaire ajoute un AppID ou un lien Steam, ou cherche tout de
// suite un nom ; le reste est refusé par le serveur avec un message clair.
function surEnvoi(evenement) {
  evenement.preventDefault();
  const saisie = elementParId("lien").value.trim();
  if (!lireSaisieProduit(saisie) && peutEtreUnNom(saisie)) rechercher(saisie);
  else ajouterProduit(saisie, elementParId("valider-ajout"));
}

export function preparerMesSuivis() {
  elementParId("formulaire-ajout").addEventListener("submit", surEnvoi);
  elementParId("lien").addEventListener("input", surSaisie);
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
