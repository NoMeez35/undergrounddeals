# Squelette de l'appli déployé de bout en bout

Status: claimed
Blocked by: 01

## Quoi

Mettre en place le dépôt, une PWA vide, un Worker, une base D1 et le déploiement automatique, pour qu'une page « undergrounddeals » soit en ligne sur `*.pages.dev` et appelle le Worker avec succès. Voir ADR 0003.

## Critères d'acceptation

- [ ] Un push sur `main` déploie automatiquement l'appli et le Worker (GitHub Actions).
- [ ] La page en ligne affiche une réponse du Worker lue en base D1.
- [ ] Les tests tournent en CI et bloquent le déploiement s'ils échouent.
- [ ] Un README explique en français ce qu'est le projet et comment il est déployé.
- [ ] Aucun coût : tout reste dans l'offre gratuite de Cloudflare.
