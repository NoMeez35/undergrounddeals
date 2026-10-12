// Réponses HTTP communes à toutes les routes de l'API.
const SANS_CACHE = { "Cache-Control": "no-store" };

// Réponse JSON jamais mise en cache : elle dépend de l'utilisateur.
export function json(donnees, { status = 200, cookie } = {}) {
  const entetes = new Headers(SANS_CACHE);
  if (cookie) entetes.append("Set-Cookie", cookie);
  return Response.json(donnees, { status, headers: entetes });
}

export function sansContenu(cookie) {
  return new Response(null, { status: 204, headers: cookie ? { "Set-Cookie": cookie } : {} });
}

export function redirection(adresse, cookies = []) {
  const entetes = new Headers({ Location: adresse });
  for (const cookie of cookies) entetes.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: entetes });
}

// Montants mis en forme par Steam d'une ligne de prix (colonnes prix_affiche,
// prix_initial_affiche, reduction), tels que l'appli les affiche.
export function montantsVersJson(ligne) {
  return { actuel: ligne.prix_affiche, initial: ligne.prix_initial_affiche, reduction: ligne.reduction };
}
