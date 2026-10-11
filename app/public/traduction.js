// Traduction de l'interface : chaque élément porteur de `data-texte="clé"`
// reçoit le texte de cette clé dans la langue chargée.
let textes = {};

export async function chargerLangue(langue) {
  textes = (await import(`/textes/${langue}.js`)).default;
  document.documentElement.lang = langue;
  for (const element of document.querySelectorAll("[data-texte]")) {
    element.textContent = texte(element.dataset.texte);
  }
}

export function texte(cle, valeurs = {}) {
  return (textes[cle] ?? cle).replace(/\{(\w+)\}/g, (_, nom) => valeurs[nom]);
}
