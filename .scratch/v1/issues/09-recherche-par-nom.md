# Recherche d'un produit par son nom

Status: ready-for-agent
Blocked by: 05

## Quoi

Dans Mes suivis, l'utilisateur peut taper le nom d'un jeu ou d'un DLC au lieu de coller un lien Steam ou un AppID. L'appli affiche une courte liste des produits Steam correspondants, avec leur nom et leur image, car plusieurs produits ont souvent des noms proches (Portal, Portal 2, leurs DLC…). Il choisit le bon, qui est ajouté comme un ajout manuel.

## Critères d'acceptation

- [ ] Taper un nom (au moins 2 caractères) affiche les produits Steam correspondants, avec leur nom et leur image, dans la langue et le pays de l'utilisateur.
- [ ] La recherche ne part qu'après une courte pause dans la frappe, pas à chaque lettre.
- [ ] Choisir un résultat l'ajoute aux suivis, avec les mêmes règles qu'un ajout manuel : packs et types non suivis refusés, limite de suivi, pas de doublon.
- [ ] Un produit déjà suivi est signalé comme tel dans la liste.
- [ ] Un lien Steam ou un AppID collé dans le champ marche toujours comme avant.
- [ ] Aucun résultat, ou Steam qui ne répond pas : un message clair.

## Comments

- 2026-10-12 : la recherche publique de la boutique Steam répond sans clé : `GET https://store.steampowered.com/api/storesearch/?term=portal&cc=FR&l=french` renvoie `{ total, items: [{ type: "app", name, id, price, tiny_image }] }` (Portal 2, Portal, Portal Knights…). Elle n'est pas documentée officiellement, comme `appdetails`. La faire passer par le Worker : le navigateur ne peut pas l'appeler directement (CORS), et les limites de Steam valent par adresse IP du serveur.
- 2026-10-12 : les DLC ont aussi `type: "app"` dans ces résultats ; le type est vérifié à l'ajout par GetItems, comme aujourd'hui (`trouverProduit` dans `worker/src/suivis.js`).
- 2026-10-12 : les images viennent du CDN de Steam (`shared.akamai.steamstatic.com`) : le navigateur de l'utilisateur les charge directement chez Steam. À citer dans la page de confidentialité (ticket 17).
