# Fil d'alertes et alerte de début de promo

Status: ready-for-agent
Blocked by: 07

## Quoi

Premier type d'alerte de bout en bout : quand un relevé détecte qu'une promo commence sur un produit suivi, une alerte est créée pour chaque utilisateur concerné et apparaît dans l'écran Fil d'alertes.

## Critères d'acceptation

- [ ] Une alerte par début de promo ; pas de nouvelle alerte tant que la promo continue.
- [ ] Une promo qui reprend après une interruption crée une nouvelle alerte.
- [ ] Une réduction de lancement compte comme un début de promo.
- [ ] Changer de pays ne déclenche aucune alerte rétroactive (transféré du ticket 04).
- [ ] Le Fil d'alertes liste les alertes, de la plus récente à la plus ancienne, avec le produit, le prix, la réduction et un lien vers la page Steam.

## Comments

- 2026-10-11 (ticket 04) : un utilisateur peut changer de pays dans les Réglages. Ne créer une alerte que pour les utilisateurs du pays au moment où le relevé détecte l'événement ; changer de pays ne doit déclencher aucune alerte pour une promo déjà en cours ou passée dans le nouveau pays.
- 2026-10-11 (ticket 07) : le relevé est dans `worker/src/releve.js` (`releverPaquet`). Un début de promo se repère quand un relevé change `prix.reduction` de 0 (ou d'un état autre que `enVente`) à plus de 0 ; `historique_prix` garde chaque changement. Aucune alerte pour un produit à l'état `gratuit`, `pasEncoreSorti` ou `sansPrix`, ni pour un produit retiré de Steam. Le premier relevé d'un produit dans un pays (aucune ligne avant) ne doit pas compter comme un début de promo. Une alerte vise les utilisateurs du pays au moment du relevé.
