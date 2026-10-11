# Squelette de l'appli déployé de bout en bout

Status: resolved
Blocked by: 01

## Quoi

Mettre en place le dépôt, une PWA vide, un Worker, une base D1 et le déploiement automatique, pour qu'une page « undergrounddeals » soit en ligne sur `*.pages.dev` et appelle le Worker avec succès. Voir ADR 0003.

## Critères d'acceptation

- [x] Un push sur `main` déploie automatiquement l'appli et le Worker (GitHub Actions).
- [x] La page en ligne affiche une réponse du Worker lue en base D1.
- [x] Les tests tournent en CI et bloquent le déploiement s'ils échouent.
- [x] Un README explique en français ce qu'est le projet et comment il est déployé.
- [x] Aucun coût : tout reste dans l'offre gratuite de Cloudflare.

## Comments

- 2026-10-11 : en ligne sur https://undergrounddeals.pages.dev (`/api/statut` renvoie le message lu en D1). Architecture : Cloudflare Pages (`app/`) dont la fonction `/api/*` relaie au Worker `undergrounddeals-api` (`worker/`, sans adresse publique) par liaison de service ; base D1 `undergrounddeals` (région weur), créée par `scripts/preparer-cloudflare.mjs` qui injecte son identifiant au déploiement. Le job `deployer` dépend du job `tests`. Les tâches planifiées (ticket 07) iront dans le Worker.
