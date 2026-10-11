# Relevé horaire des prix

Status: claimed
Blocked by: 05

## Quoi

Une tâche planifiée (Cron Triggers) relève toutes les heures le prix de chaque produit suivi, une seule fois par couple (produit, pays) quel que soit le nombre d'utilisateurs, uniquement pour les pays ayant au moins un utilisateur. Chaque relevé est conservé : c'est la base du plus bas historique (ADR 0004).

## Critères d'acceptation

- [x] Les requêtes vers Steam sont regroupées et respectent les limites de Steam et de l'offre gratuite de Cloudflare (à vérifier et documenter dans le code).
- [x] Une erreur ou une limite atteinte côté Steam ne fait pas planter le relevé ; les produits manqués sont repris à l'heure suivante.
- [x] L'écran Mes suivis affiche le dernier prix relevé et l'heure du relevé.
- [x] Un produit devenu gratuit affiche le badge « Gratuit » ; un produit retiré de Steam affiche « Retiré de Steam ». Aucune alerte n'est créée dans ces cas.

## Comments

- 2026-10-11 (ticket 04) : le pays de chaque utilisateur est la colonne `utilisateurs.pays` ; elle est vide tant qu'il n'a pas confirmé son choix, et ces utilisateurs sont ignorés. Un utilisateur peut changer de pays à tout moment : le nouveau pays doit être relevé dès l'heure suivante.
- 2026-10-11 (ticket 05) : la colonne `produits.retire_de_steam` existe déjà et la limite de suivi l'ignore ; ce ticket doit la renseigner. Attention : un produit retiré de la vente (ex. F1 23, AppID 2108330) répond encore `success: true` mais sans prix, exactement comme un produit bloqué dans un pays (ex. DLC 378648 au Japon). Le retrait doit donc se juger sur plusieurs pays, pas sur un seul. Les prix de Mes suivis sont aujourd'hui lus en direct chez Steam (`lirePrixSteam`) : les remplacer par le dernier relevé.
- 2026-10-11 (relecture) : « Pas de prix dans votre pays » s'affiche aussi pour un produit gratuit ou pas encore sorti ; à remplacer par le badge « Gratuit » et un texte adapté.
- 2026-10-11 (ticket 06) : un passage planifié existe déjà (`*/10 * * * *` dans `worker/wrangler.jsonc`, `scheduled` dans `worker/src/index.js`). Le relevé horaire doit le réutiliser : l'offre gratuite n'a que 5 tâches planifiées par compte, et chaque passage partage ses 50 requêtes à la base, ses 50 appels externes et ses 10 ms de CPU avec la synchronisation des listes de souhaits.
- 2026-10-11 : Mes suivis distingue déjà, pour un produit sans prix, « Pas encore sorti », « Gratuit » et « Pas en vente dans votre pays » (fiche GetItems demandée pour ces produits seulement, `raisonSansPrix` dans `worker/src/suivis.js`). Ce ticket garde le badge « Gratuit », le badge « Retiré de Steam » (qui s'affiche aujourd'hui comme « Pas en vente dans votre pays ») et l'absence d'alerte.
- 2026-10-11 : implémenté (`worker/src/releve.js`, migration 0007).
  - Passage planifié distinct toutes les 5 minutes, avec ses propres limites. Chaque pays est relevé par AppID croissant, au plus 8 paquets de 100 produits par passage, soit 9 600 couples (produit, pays) par heure avec l'offre gratuite.
  - Si Steam ne répond pas, le passage s'arrête et le paquet est repris au passage suivant ; ce qui n'est pas relevé à la fin de l'heure l'est à l'heure suivante.
  - Seuls les changements de prix sont écrits (table `historique_prix`), pour rester sous les 100 000 écritures par jour : un relevé identique au précédent n'ajoute rien.
  - Retiré de Steam : `unlisted: true` ou type 14 dans GetItems ; un produit de nouveau en vente ne l'est plus.
  - Mes suivis lit le dernier relevé (plus aucun appel à Steam pour afficher la page), avec l'heure du dernier relevé complet du pays. Un produit pas encore relevé l'indique.
  - En attente du test manuel du porteur du projet.
