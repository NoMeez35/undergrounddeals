// Nom, avatar et pays Steam, demandés à Steam à chaque fois : ils ne sont jamais
// stockés. Le pays n'est fourni que si le profil est public et le renseigne.
import { lirePays } from "../../app/public/pays.js";

export async function lireProfilSteam(steamId, cleApi) {
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.search = new URLSearchParams({ key: cleApi, steamids: steamId }).toString();

  const reponse = await fetch(url);
  if (!reponse.ok) return null;
  const joueur = (await reponse.json()).response?.players?.[0];
  if (!joueur) return null;
  return { nom: joueur.personaname, avatar: joueur.avatarfull, pays: lirePays(joueur.loccountrycode) };
}
