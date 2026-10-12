# Lien « Ouvrir sur Steam » pour un produit écarté

Status: claimed
Blocked by: 06

## Quoi

L'appli ne peut pas modifier la liste de souhaits Steam. Quand l'utilisateur a retiré de ses suivis un produit de sa liste de souhaits (produit écarté, affiché « Retiré de vos suivis »), un lien « Ouvrir sur Steam » à côté du produit ouvre sa page Steam, pour qu'il l'enlève aussi de sa liste de souhaits en un clic.

## Critères d'acceptation

- [ ] Chaque produit écarté affiche un lien « Ouvrir sur Steam », en français et en anglais, qui ouvre sa page Steam dans un nouvel onglet.
- [ ] Chaque produit suivi qui est dans la liste de souhaits affiche aussi « Ouvrir sur Steam », à côté de « Retirer » (demandé par le porteur du projet au test : la section des non suivis est tout en bas de la page).
- [ ] Les autres produits non suivis (limite atteinte, place libre, retiré de Steam) n'ont pas ce lien.

## Comments

- 2026-10-12 : le nom du produit est déjà un lien vers sa page Steam (`lienSteam` dans `app/public/page.js`), mais rien ne l'indique. Une fois le produit enlevé de la liste de souhaits Steam, la synchronisation quotidienne le retire de la table `souhaits` (`worker/src/souhaits.js`), et il disparaît de la liste des non suivis ; « Réessayer l'import » n'apparaît que si la liste est vide ou privée.
- 2026-10-12 : implémenté (`elementNonSuivi` dans `app/public/mes-suivis.js`) : un produit écarté affiche un bouton « Ouvrir sur Steam » (« Open on Steam ») qui ouvre sa page Steam dans un nouvel onglet. `lienSteam` accepte un libellé à la place du nom. Rien ne change côté serveur : `GET /api/suivis` renvoie déjà `ecarte`. En attente du test manuel du porteur du projet.
- 2026-10-12 : au test, le porteur du projet a demandé le bouton à côté de « Retirer », la section des non suivis étant tout en bas d'une longue liste. `GET /api/suivis` indique désormais `dansListeDeSouhaits` pour chaque produit suivi ; le bouton du bas reste pour les produits écartés. En attente du test manuel.
- 2026-10-12 : à la demande du porteur du projet, les produits de la liste de souhaits non suivis passent dans une colonne à droite (« Dans votre liste de souhaits Steam, non suivis »), qui reste visible en faisant défiler les suivis ; sur un écran de moins de 960 px, elle passe au-dessus des suivis. La colonne est cachée quand elle est vide. Rendu vérifié par capture (1280 px et 375 px).
