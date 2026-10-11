# Import et synchronisation de la liste de souhaits

Status: ready-for-agent
Blocked by: 05

## Quoi

À la première connexion puis chaque jour, l'appli lit la liste de souhaits Steam de l'utilisateur et met à jour ses produits suivis.

## Critères d'acceptation

- [ ] Les produits sont importés dans l'ordre de priorité Steam, jusqu'à la limite de suivi (jeux et DLC remplis indépendamment).
- [ ] Les produits en trop sont visibles comme « non suivis (limite atteinte) » ; l'utilisateur peut en échanger un contre un produit suivi.
- [ ] Un produit retiré de la liste de souhaits n'est plus suivi, sauf s'il a aussi été ajouté à la main.
- [ ] Les packs de la liste de souhaits sont ignorés.
- [ ] Si le profil est privé, l'appli explique comment rendre la liste de souhaits visible ; l'ajout manuel reste possible.

## Comments
- 2026-10-11 (relecture) : la table `suivis` n'a pas de colonne de provenance. L'ajouter (liste de souhaits, ajout manuel, ou les deux) pour qu'un produit retiré de la liste de souhaits reste suivi s'il a aussi été ajouté à la main. Aujourd'hui, l'ajout manuel d'un produit déjà suivi répond `dejaSuivi` sans rien enregistrer : il devra marquer la provenance manuelle.
