// Crée, s'ils n'existent pas encore, les ressources Cloudflare nécessaires au
// déploiement (base D1, projet Pages), écrit l'identifiant de la base dans
// worker/wrangler.jsonc et prépare les secrets du Worker dans FICHIER_SECRETS.
// Lancé par GitHub Actions avant chaque déploiement.
//
// Les noms (Worker, base, projet Pages) ne sont écrits qu'une fois, dans les
// fichiers de configuration de wrangler : ce script les y lit.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const CONFIG_WORKER = "worker/wrangler.jsonc";
const CONFIG_APPLI = "app/wrangler.jsonc";
// Lu par `wrangler deploy --secrets-file` ; ignoré par git.
const FICHIER_SECRETS = "worker/.secrets.json";
const API_CLOUDFLARE = "https://api.cloudflare.com/client/v4";

function variable(nom) {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`La variable d'environnement ${nom} est vide.`);
  return valeur;
}

// Nos fichiers .jsonc n'ont que des commentaires sur des lignes entières.
function lireConfig(chemin) {
  const texte = readFileSync(chemin, "utf8");
  return JSON.parse(texte.replace(/^\s*\/\/.*$/gm, ""));
}

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

const configWorker = lireConfig(CONFIG_WORKER);
const configAppli = lireConfig(CONFIG_APPLI);
const nomWorker = configWorker.name;
const nomBase = configWorker.d1_databases[0].database_name;
const nomProjetPages = configAppli.name;

const serviceAppli = configAppli.services?.find((service) => service.binding === "API")?.service;
if (serviceAppli !== nomWorker) {
  throw new Error(`${CONFIG_APPLI} relaie /api vers « ${serviceAppli} », mais le Worker s'appelle « ${nomWorker} ».`);
}

// Base D1
function trouverBase() {
  return wranglerJson("d1", "list").find((base) => base.name === nomBase);
}

let base = trouverBase();
if (!base) {
  console.log(`Création de la base D1 « ${nomBase} »…`);
  wrangler("d1", "create", nomBase, "--location", "weur");
  base = trouverBase();
}
if (!base) {
  throw new Error(`La base D1 « ${nomBase} » est introuvable après sa création.`);
}

const texteConfigWorker = readFileSync(CONFIG_WORKER, "utf8");
const champIdBase = /("database_id"\s*:\s*")[^"]*(")/g;
if (texteConfigWorker.match(champIdBase)?.length !== 1) {
  throw new Error(`${CONFIG_WORKER} doit contenir exactement un champ "database_id".`);
}
writeFileSync(CONFIG_WORKER, texteConfigWorker.replace(champIdBase, `$1${base.uuid}$2`));
console.log(`Base D1 « ${nomBase} » : ${base.uuid}`);

// Projet Pages
const projets = wranglerJson("pages", "project", "list");
if (!projets.some((projet) => projet["Project Name"] === nomProjetPages)) {
  console.log(`Création du projet Pages « ${nomProjetPages} »…`);
  wrangler("pages", "project", "create", nomProjetPages, "--production-branch", "main");
}
console.log(`Projet Pages « ${nomProjetPages} » prêt.`);

// Secrets du Worker. Liste vide seulement si le Worker n'existe pas encore (404) ;
// toute autre erreur arrête le déploiement, pour ne jamais recréer par erreur le
// secret de session (ce qui déconnecterait tout le monde).
async function secretsExistants() {
  const adresse = `${API_CLOUDFLARE}/accounts/${variable("CLOUDFLARE_ACCOUNT_ID")}/workers/scripts/${nomWorker}/secrets`;
  const reponse = await fetch(adresse, {
    headers: { Authorization: `Bearer ${variable("CLOUDFLARE_API_TOKEN")}` },
  });
  if (reponse.status === 404) return [];
  if (!reponse.ok) {
    throw new Error(`Lecture des secrets du Worker impossible (HTTP ${reponse.status}) : ${await reponse.text()}`);
  }
  return (await reponse.json()).result.map((secret) => secret.name);
}

const secrets = { STEAM_API_KEY: variable("STEAM_API_KEY") };
if (!(await secretsExistants()).includes("SESSION_SECRET")) {
  console.log("Création du secret de session (premier déploiement du Worker)…");
  secrets.SESSION_SECRET = randomBytes(32).toString("base64url");
}
writeFileSync(FICHIER_SECRETS, JSON.stringify(secrets), { mode: 0o600 });
console.log(`Secrets du Worker prêts : ${Object.keys(secrets).join(", ")}.`);
