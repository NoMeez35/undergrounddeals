# Relevé horaire des prix

Status: ready-for-agent
Blocked by: 05

## Quoi

Une tâche planifiée (Cron Triggers) relève toutes les heures le prix de chaque produit suivi, une seule fois par couple (produit, pays) quel que soit le nombre d'utilisateurs, uniquement pour les pays ayant au moins un utilisateur. Chaque relevé est conservé : c'est la base du plus bas historique (ADR 0004).

## Critères d'acceptation

- [ ] Les requêtes vers Steam sont regroupées et respectent les limites de Steam et de l'offre gratuite de Cloudflare (à vérifier et documenter dans le code).
- [ ] Une erreur ou une limite atteinte côté Steam ne fait pas planter le relevé ; les produits manqués sont repris à l'heure suivante.
- [ ] L'écran Mes suivis affiche le dernier prix relevé et l'heure du relevé.
- [ ] Un produit devenu gratuit affiche le badge « Gratuit » ; un produit retiré de Steam affiche « Retiré de Steam ». Aucune alerte n'est créée dans ces cas.
