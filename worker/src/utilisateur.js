// Utilisateur connecté et son profil.
import { json } from "./reponses.js";
import { creerCookieSession, lireSession } from "./session.js";
import { lireProfilSteam } from "./steam-profil.js";

// Renvoie l'utilisateur de la session (SteamID, pays, langue), ou null.
export async function utilisateurConnecte(request, env) {
  const steamId = await lireSession(request, env.SESSION_SECRET);
  if (!steamId) return null;
  return env.DB.prepare("SELECT steam_id, pays, langue FROM utilisateurs WHERE steam_id = ?")
    .bind(steamId)
    .first();
}

// `pays` et `langue` restent null tant que l'utilisateur ne les a pas confirmés ;
// `paysProfil` (profil Steam public) sert alors à proposer un pays.
// Chaque visite prolonge la session : seul un utilisateur absent 30 jours est déconnecté.
export async function renvoyerProfil({ utilisateur, env }) {
  const profil = await lireProfilSteam(utilisateur.steam_id, env.STEAM_API_KEY);
  return json(
    {
      steamId: utilisateur.steam_id,
      nom: profil?.nom ?? null,
      avatar: profil?.avatar ?? null,
      pays: utilisateur.pays,
      langue: utilisateur.langue,
      paysProfil: profil?.pays ?? null,
    },
    { cookie: await creerCookieSession(utilisateur.steam_id, env.SESSION_SECRET) },
  );
}
