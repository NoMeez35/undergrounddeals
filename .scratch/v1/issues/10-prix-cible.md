# Prix cible

Status: ready-for-agent
Blocked by: 08

## Quoi

Dans Mes suivis, l'utilisateur peut fixer, modifier ou retirer un prix cible sur un produit suivi. Tant qu'il est défini, il remplace les alertes de début de promo et de plus bas historique pour ce produit.

## Critères d'acceptation

- [ ] Une alerte à chaque passage du prix sous la cible ; pas de répétition tant que le prix reste en dessous.
- [ ] Scénario : cible 15 €, prix 12 € → alerte ; remontée à 30 € ; retour à 12 € → nouvelle alerte (2 au total).
- [ ] Avec un prix cible, aucune alerte de début de promo ni de plus bas historique pour ce produit ; les alertes de sortie et de démo restent.
- [ ] Fixer une cible alors que le prix est déjà en dessous ne déclenche pas d'alerte rétroactive.
