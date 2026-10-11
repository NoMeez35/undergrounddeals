// Crée, s'ils n'existent pas encore, les ressources Cloudflare nécessaires au
// déploiement (base D1, projet Pages), écrit l'identifiant de la base dans
// worker/wrangler.jsonc et prépare les secrets du Worker dans FICHIER_SECRETS.
// Lancé par GitHub Actions avant chaque déploiement.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const NOM_BASE = "undergrounddeals";
const NOM_PROJET_PAGES = "undergrounddeals";
const CONFIG_WORKER = "worker/wrangler.jsonc";
// Lu par `wrangler deploy --secrets-file` ; ignoré par git.
const FICHIER_SECRETS = "worker/.secrets.json";
// Doit rester identique au `database_id` écrit dans worker/wrangler.jsonc.
const ID_FICTIF = "00000000-0000-0000-0000-000000000000";

function wrangler(...args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8" });
}

// Wrangler peut afficher des avertissements avant le JSON : on ne garde que ce
// qui suit la première ligne commençant par « [ ».
function wranglerJson(...args) {
  const sortie = wrangler(...args, "--json");
  const debut = sortie.search(/^\[/m);
  if (debut === -1) {
    throw new Error(`Réponse JSON introuvable pour « wrangler ${args.join(" ")} » :\n${sortie}`);
  }
  return JSON.parse(sortie.slice(debut));
}

function trouverBase() {
  return wranglerJson("d1", "list").find((base) => base.name === NOM_BASE);
}

function ecrireIdBase(id) {
  const config = readFileSync(CONFIG_WORKER, "utf8");
  if (!config.includes(ID_FICTIF)) {
    throw new Error(`${CONFIG_WORKER} ne contient pas l'identifiant fictif ${ID_FICTIF} à remplacer.`);
  }
  writeFileSync(CONFIG_WORKER, config.replace(ID_FICTIF, id));
}

let base = trouverBase();
if (!base) {
  console.log(`Création de la base D1 « ${NOM_BASE} »…`);
  wrangler("d1", "create", NOM_BASE, "--location", "weur");
  base = trouverBase();
}
if (!base) {
  throw new Error(`La base D1 « ${NOM_BASE} » est introuvable après sa création.`);
}
ecrireIdBase(base.uuid);
console.log(`Base D1 « ${NOM_BASE} » : ${base.uuid}`);

const projets = wranglerJson("pages", "project", "list");
if (!projets.some((projet) => projet["Project Name"] === NOM_PROJET_PAGES)) {
  console.log(`Création du projet Pages « ${NOM_PROJET_PAGES} »…`);
  wrangler("pages", "project", "create", NOM_PROJET_PAGES, "--production-branch", "main");
}
console.log(`Projet Pages « ${NOM_PROJET_PAGES} » prêt.`);

// Secrets existants du Worker ; liste vide s'il n'a encore jamais été déployé.
function secretsExistants() {
  try {
    return wranglerJson("secret", "list", "--config", CONFIG_WORKER, "--format", "json").map((s) => s.name);
  } catch (erreur) {
    console.warn(`Secrets du Worker illisibles (normal au tout premier déploiement) : ${erreur.message}`);
    return [];
  }
}

if (!process.env.STEAM_API_KEY) {
  throw new Error("La variable d'environnement STEAM_API_KEY est vide.");
}
const secrets = { STEAM_API_KEY: process.env.STEAM_API_KEY };
// Le secret de session n'est créé qu'une fois : le changer déconnecterait tout le monde.
if (!secretsExistants().includes("SESSION_SECRET")) {
  console.log("Création du secret de session…");
  secrets.SESSION_SECRET = randomBytes(32).toString("base64url");
}
writeFileSync(FICHIER_SECRETS, JSON.stringify(secrets), { mode: 0o600 });
console.log(`Secrets du Worker prêts : ${Object.keys(secrets).join(", ")}.`);
