// Crée, s'ils n'existent pas encore, les ressources Cloudflare nécessaires au
// déploiement (base D1, projet Pages), puis écrit l'identifiant de la base dans
// worker/wrangler.jsonc. Lancé par GitHub Actions avant chaque déploiement.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NOM_BASE = "undergrounddeals";
const NOM_PROJET_PAGES = "undergrounddeals";
const CONFIG_WORKER = "worker/wrangler.jsonc";
const ID_FICTIF = "00000000-0000-0000-0000-000000000000";

function wrangler(...args) {
  return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8" });
}

function wranglerJson(...args) {
  const sortie = wrangler(...args, "--json");
  return JSON.parse(sortie.slice(sortie.indexOf("[")));
}

function trouverBase() {
  return wranglerJson("d1", "list").find((base) => base.name === NOM_BASE);
}

let base = trouverBase();
if (!base) {
  console.log(`Création de la base D1 « ${NOM_BASE} »…`);
  wrangler("d1", "create", NOM_BASE, "--location", "weur");
  base = trouverBase();
}
writeFileSync(CONFIG_WORKER, readFileSync(CONFIG_WORKER, "utf8").replace(ID_FICTIF, base.uuid));
console.log(`Base D1 « ${NOM_BASE} » : ${base.uuid}`);

const projets = wranglerJson("pages", "project", "list");
const projetExiste = projets.some((projet) => Object.values(projet).includes(NOM_PROJET_PAGES));
if (!projetExiste) {
  console.log(`Création du projet Pages « ${NOM_PROJET_PAGES} »…`);
  wrangler("pages", "project", "create", NOM_PROJET_PAGES, "--production-branch", "main");
}
console.log(`Projet Pages « ${NOM_PROJET_PAGES} » prêt.`);
