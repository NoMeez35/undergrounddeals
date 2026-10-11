// Relaie toutes les requêtes /api/* au Worker : l'appli et l'API partagent ainsi
// la même adresse (pas de CORS, cookies de session simples).
export function onRequest({ request, env }) {
  return env.API.fetch(request);
}
