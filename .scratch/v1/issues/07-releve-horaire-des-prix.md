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

## Comments

- 2026-10-11 (ticket 04) : le pays de chaque utilisateur est la colonne `utilisateurs.pays` ; elle est vide tant qu'il n'a pas confirmé son choix, et ces utilisateurs sont ignorés. Un utilisateur peut changer de pays à tout moment : le nouveau pays doit être relevé dès l'heure suivante.
- 2026-10-11 (ticket 05) : la colonne `produits.retire_de_steam` existe déjà et la limite de suivi l'ignore ; ce ticket doit la renseigner. Attention : un produit retiré de la vente (ex. F1 23, AppID 2108330) répond encore `success: true` mais sans prix, exactement comme un produit bloqué dans un pays (ex. DLC 378648 au Japon). Le retrait doit donc se juger sur plusieurs pays, pas sur un seul. Les prix de Mes suivis sont aujourd'hui lus en direct chez Steam (`lirePrixSteam`) : les remplacer par le dernier relevé.
