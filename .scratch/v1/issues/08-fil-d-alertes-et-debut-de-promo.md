# Fil d'alertes et alerte de début de promo

Status: claimed
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
- 2026-10-11 (relecture du ticket 07) : une ligne de `historique_prix` avec `apres_interruption = 1` (premier relevé d'un couple, ou reprise après un prix périmé, non vu depuis la veille) n'est pas un changement observé : elle ne crée aucune alerte. C'est ce qui empêche les alertes rétroactives après un changement de pays.
- 2026-10-12 : implémenté (`worker/src/releve.js`, `worker/src/alertes.js`, migration 0010, écran `/alertes`).
  - Le relevé crée les alertes dans le même lot d'écritures que l'historique, avant de mettre à jour le prix connu : un début de promo, c'est un produit réduit alors que son prix connu, encore à jour, ne l'était pas. Un premier relevé ou un prix périmé n'alerte pas.
  - Coût : une requête de plus par paquet de 100 produits, donc 7 paquets par passage au lieu de 9, soit 8 400 couples (produit, pays) par heure.
  - Fil d'alertes : les 100 plus récentes, lien depuis Mes suivis.
  - En attente du test manuel du porteur du projet.
- 2026-10-12 : test manuel de l'écran réussi (bouton, fil vide, retour, anglais) ; une vraie alerte reste à observer. Corrections après relecture :
  - Les alertes partent des lignes que le relevé vient d'ajouter à l'historique (`apres_interruption = 0`), comme le demandait la relecture du ticket 07.
  - L'état précédent ignore les relevés sans prix : un prix que Steam omet une fois en pleine promo ne crée plus de seconde alerte.
  - Tests ajoutés : produit plus en vente ou retiré de Steam, utilisateur qui quitte le pays, prix omis pendant la promo, promo après une période sans prix.
  - Mise en forme des prix partagée (`montantsVersJson`), colonne d'événement lue dans `COLONNES_EVENEMENTS`, test des textes renommé `app/test/interface.test.js`.
  - Gardé : le fil montre les 100 alertes les plus récentes, pour que l'écran reste rapide.
