// Partagé par l'appli et le Worker (worker/src/index.js l'importe).
// Écrans de l'appli : chacun doit aussi figurer dans _redirects (un test le vérifie).
export const CHEMIN_ACCUEIL = "/";
export const CHEMIN_CONNEXION = "/connexion";
export const CHEMIN_REGLAGES = "/reglages";
// Adresse qui lance la connexion via Steam.
export const CHEMIN_CONNEXION_STEAM = "/api/auth/steam";
// Valeur du paramètre `erreur` de l'écran Connexion quand Steam a refusé la connexion.
export const ERREUR_CONNEXION_STEAM = "steam";
