# Lien « Ouvrir sur Steam » pour un produit écarté

Status: ready-for-agent
Blocked by: 06

## Quoi

L'appli ne peut pas modifier la liste de souhaits Steam. Quand l'utilisateur a retiré de ses suivis un produit de sa liste de souhaits (produit écarté, affiché « Retiré de vos suivis »), un lien « Ouvrir sur Steam » à côté du produit ouvre sa page Steam, pour qu'il l'enlève aussi de sa liste de souhaits en un clic.

## Critères d'acceptation

- [ ] Chaque produit écarté affiche un lien « Ouvrir sur Steam », en français et en anglais, qui ouvre sa page Steam dans un nouvel onglet.
- [ ] Les autres produits non suivis (limite atteinte, place libre, retiré de Steam) n'ont pas ce lien.

## Comments

- 2026-10-12 : le nom du produit est déjà un lien vers sa page Steam (`lienSteam` dans `app/public/page.js`), mais rien ne l'indique. Une fois le produit enlevé de la liste de souhaits Steam, la synchronisation quotidienne le retire de la table `souhaits` (`worker/src/souhaits.js`), et il disparaît de la liste des non suivis ; « Réessayer l'import » n'apparaît que si la liste est vide ou privée.
