# Alerte de plus bas historique et fusion des événements

Status: ready-for-agent
Blocked by: 08

## Quoi

Détecter quand le prix d'un produit atteint son plus bas historique (calculé à partir de nos relevés, ADR 0004) et fusionner les événements simultanés en une seule alerte.

## Critères d'acceptation

- [ ] Une alerte quand le prix atteint un nouveau plus bas historique ; une baisse pendant une promo n'alerte que si elle atteint un nouveau plus bas historique.
- [ ] Une promo qui démarre au plus bas historique donne une seule alerte combinée (« En promo à −60 %, plus bas historique ! »).
- [ ] L'appli affiche « plus bas depuis le [date de début de surveillance] » tant que l'historique est court.
- [ ] Le premier relevé d'un produit ne déclenche pas d'alerte de plus bas historique.

## Comments
- 2026-10-11 (ticket 07) : `historique_prix` ne garde que les changements (état, devise, prix, réduction) ; sa première ligne pour un couple (produit, pays) date le début de la surveillance. Le plus bas historique est le plus petit `prix` à l'état `enVente` dans la même devise.
- 2026-10-11 (relecture du ticket 07) : le début de surveillance est la dernière ligne d'historique avec `apres_interruption = 1` ; une interruption (prix non vu depuis la veille) remet donc à zéro la période du « plus bas depuis ».
