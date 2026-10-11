# Suppression du compte, page de confidentialité et bouton Ko-fi

Status: ready-for-agent
Blocked by: 03

## Quoi

Compléter l'écran Réglages : bouton « Supprimer mon compte », lien vers une page de confidentialité en français et en anglais, et bouton Ko-fi pour les dons.

## Critères d'acceptation

- [ ] « Supprimer mon compte » demande une confirmation puis efface toutes les données de l'utilisateur (produits suivis, prix cibles, alertes, abonnements push, session).
- [ ] La page de confidentialité liste les données stockées, pourquoi, et comment les supprimer.
- [ ] Le bouton Ko-fi ouvre la page Ko-fi (lien noté dans le ticket 01) ; il est masqué si aucun lien n'est configuré.

## Comments
- 2026-10-11 (relecture) : en plus des données listées dans la spec, la date d'ajout de chaque produit suivi est stockée (`suivis.ajoute_le`, sert à l'ordre de la liste) ; la page de confidentialité doit la citer. La suppression des suivis à la suppression du compte est déjà assurée par `ON DELETE CASCADE`.
- 2026-10-11 (ticket 06) : la liste de souhaits de l'utilisateur est aussi stockée (table `souhaits` : produits, ordre, produits écartés), ainsi que la date et le résultat de sa dernière lecture (`utilisateurs.souhaits_lus_le`, `souhaits_visibles`). La page de confidentialité doit les citer. Leur suppression avec le compte est assurée par `ON DELETE CASCADE`.
