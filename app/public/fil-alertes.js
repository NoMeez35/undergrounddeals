// Écran Fil d'alertes : les alertes de l'utilisateur, de la plus récente à la
// plus ancienne, avec le produit, le prix et la réduction.
import { afficherMessage, dateAffichee, element, elementMontants, elementParId, lienSteam } from "/page.js";
import { texte } from "/textes.js";

function elementAlerte(alerte) {
  const ligne = element("li", { classe: "alerte" });
  const date = element("time", { classe: "note", texte: dateAffichee(alerte.creeLe) });
  date.dateTime = alerte.creeLe;
  const evenements = alerte.evenements.map((evenement) => texte(`alertes.evenement.${evenement}`)).join(" · ");
  ligne.append(
    date,
    element("strong", { classe: "evenement", texte: evenements }),
    lienSteam(alerte),
    elementMontants(alerte.prix),
  );
  return ligne;
}

export async function preparerFilAlertes() {
  const reponse = await fetch("/api/alertes").catch(() => null);
  if (!reponse?.ok) {
    afficherMessage(elementParId("erreur-alertes"), "alertes.erreur", { erreur: true });
    return;
  }
  const { alertes } = await reponse.json();
  elementParId("liste-alertes").replaceChildren(...alertes.map(elementAlerte));
  elementParId("alertes-vide").hidden = alertes.length > 0;
}
