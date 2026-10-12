// Partagé par l'appli et le Worker. Langues de l'interface, chacune écrite dans
// sa propre langue. Ajouter une langue : l'inscrire ici et dans LANGUES_STEAM,
// et créer textes/<code>.js.
export const LANGUES = {
  fr: "Français",
  en: "English",
};

// Nom de chaque langue pour Steam : la recherche par nom se fait dans la langue
// de l'utilisateur.
export const LANGUES_STEAM = {
  fr: "french",
  en: "english",
};

export const LANGUE_PAR_DEFAUT = "en";

// Renvoie le code si c'est une langue de l'interface, sinon null.
export function lireLangue(texte) {
  return typeof texte === "string" && Object.hasOwn(LANGUES, texte) ? texte : null;
}

// Première langue du navigateur que l'interface connaît, sinon l'anglais.
export function proposerLangue(languesNavigateur = []) {
  for (const etiquette of languesNavigateur) {
    const langue = lireLangue(etiquette.split("-")[0].toLowerCase());
    if (langue) return langue;
  }
  return LANGUE_PAR_DEFAUT;
}
