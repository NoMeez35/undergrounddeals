export function lireCookie(request, nom) {
  const entete = request.headers.get("Cookie") ?? "";
  for (const morceau of entete.split(";")) {
    const [cle, ...valeur] = morceau.trim().split("=");
    if (cle === nom) return valeur.join("=");
  }
  return null;
}

export function enteteCookie(nom, valeur, { chemin = "/", dureeSecondes }) {
  return `${nom}=${valeur}; Path=${chemin}; Max-Age=${dureeSecondes}; HttpOnly; Secure; SameSite=Lax`;
}

export function enteteCookieSupprime(nom, { chemin = "/" } = {}) {
  return enteteCookie(nom, "", { chemin, dureeSecondes: 0 });
}
