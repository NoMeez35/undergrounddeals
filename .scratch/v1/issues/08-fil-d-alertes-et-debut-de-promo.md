# Fil d'alertes et alerte de début de promo

Status: ready-for-agent
Blocked by: 07

## Quoi

Premier type d'alerte de bout en bout : quand un relevé détecte qu'une promo commence sur un produit suivi, une alerte est créée pour chaque utilisateur concerné et apparaît dans l'écran Fil d'alertes.

## Critères d'acceptation

- [ ] Une alerte par début de promo ; pas de nouvelle alerte tant que la promo continue.
- [ ] Une promo qui reprend après une interruption crée une nouvelle alerte.
- [ ] Une réduction de lancement compte comme un début de promo.
- [ ] Le Fil d'alertes liste les alertes, de la plus récente à la plus ancienne, avec le produit, le prix, la réduction et un lien vers la page Steam.

## Comments

- 2026-10-11 (ticket 04) : un utilisateur peut changer de pays dans les Réglages. Ne créer une alerte que pour les utilisateurs du pays au moment où le relevé détecte l'événement ; changer de pays ne doit déclencher aucune alerte pour une promo déjà en cours ou passée dans le nouveau pays.
