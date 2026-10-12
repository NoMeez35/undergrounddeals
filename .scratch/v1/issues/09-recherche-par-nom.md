# Recherche d'un produit par son nom

Status: resolved
Blocked by: 05

## Quoi

Dans Mes suivis, l'utilisateur peut taper le nom d'un jeu ou d'un DLC au lieu de coller un lien Steam ou un AppID. L'appli affiche une courte liste des produits Steam correspondants, avec leur nom et leur image, car plusieurs produits ont souvent des noms proches (Portal, Portal 2, leurs DLC…). Il choisit le bon, qui est ajouté comme un ajout manuel.

## Critères d'acceptation

- [x] Taper un nom (au moins 2 caractères) affiche les produits Steam correspondants, avec leur nom et leur image, dans la langue et le pays de l'utilisateur.
- [x] La recherche ne part qu'après une courte pause dans la frappe, pas à chaque lettre.
- [x] Choisir un résultat l'ajoute aux suivis, avec les mêmes règles qu'un ajout manuel : packs et types non suivis refusés, limite de suivi, pas de doublon.
- [x] Un produit déjà suivi est signalé comme tel dans la liste.
- [x] Un lien Steam ou un AppID collé dans le champ marche toujours comme avant.
- [x] Aucun résultat, ou Steam qui ne répond pas : un message clair.

## Comments

- 2026-10-12 : la recherche publique de la boutique Steam répond sans clé : `GET https://store.steampowered.com/api/storesearch/?term=portal&cc=FR&l=french` renvoie `{ total, items: [{ type: "app", name, id, price, tiny_image }] }` (Portal 2, Portal, Portal Knights…). Elle n'est pas documentée officiellement, comme `appdetails`. La faire passer par le Worker : le navigateur ne peut pas l'appeler directement (CORS), et les limites de Steam valent par adresse IP du serveur.
- 2026-10-12 : les DLC ont aussi `type: "app"` dans ces résultats ; le type est vérifié à l'ajout par GetItems, comme aujourd'hui (`trouverProduit` dans `worker/src/suivis.js`).
- 2026-10-12 : les images viennent du CDN de Steam (`shared.akamai.steamstatic.com`) : le navigateur de l'utilisateur les charge directement chez Steam. À citer dans la page de confidentialité (ticket 17).
- 2026-10-12 : implémenté (`worker/src/recherche.js`, `chercherProduitsSteam` dans `worker/src/steam-boutique.js`, `GET /api/recherche?texte=…`).
  - Recherche par l'API officielle `IStoreQueryService/SearchSuggestions` plutôt que `storesearch` : elle donne le type de chaque produit (jeu, DLC, bande-son…), ce qui permet de ne proposer que les jeux et DLC payants suivables, et ne demande pas de clé. Résultats gardés 15 minutes en cache par Cloudflare.
  - Au plus 10 résultats, dans la langue et le pays de l'utilisateur, ceux déjà suivis signalés « Déjà suivi ».
  - Le champ d'ajout accepte un nom : la recherche part 400 ms après la dernière frappe (ou tout de suite avec « Ajouter ») ; un AppID ou un lien est ajouté comme avant. `lireSaisieProduit` est déplacé dans `app/public/saisie-produit.js`, partagé par l'appli et le Worker.
  - Limite de Steam : certains vieux DLC (ex. Blood and Wine, 378648) n'apparaissent dans aucune recherche Steam, même avec leur nom exact ; ils restent ajoutables par lien ou AppID.
  - En attente du test manuel du porteur du projet.
- 2026-10-12 : test manuel réussi par le porteur du projet (recherche, ajout depuis la liste, déjà suivi, DLC, aucun résultat, lien et AppID, anglais). Relecture du code à faire avant de clore.
- 2026-10-12 : corrections après relecture, puis ticket clos :
  - Une adresse web non reconnue (ex. `www.store.steampowered.com/app/620`, `s.team/…`) n'est plus cherchée comme un nom : elle est refusée comme avant (`peutEtreUnNom` dans `app/public/saisie-produit.js`, testée).
  - Un nombre est cherché comme un nom pendant la frappe (ex. « 2048 »), mais « Ajouter » l'ajoute comme un AppID ; « aucun résultat » n'est pas affiché pour un nombre.
  - Un produit que Steam trouve sous deux AppID n'apparaît qu'une fois ; une session expirée renvoie à l'écran Connexion.
  - Erreurs de recherche dans `ERREURS_RECHERCHE`, avec leurs textes ; noms des langues pour Steam dans `app/public/langues.js` (`LANGUES_STEAM`) ; lecture des suivis dans `suivis.js` (`appIdsSuivis`).
  - Non testés automatiquement (pas de tests de navigateur dans le projet) : la pause de frappe et l'abandon des réponses dépassées ; vérifiés au test manuel.
  - Gardés : le type (Jeu/DLC) et le lien vers la page Steam dans chaque résultat, pour distinguer les noms proches ; le texte d'exemple « Portal 2 », identique dans les deux langues. Pas de limite de recherches par utilisateur (shortcut noté dans `worker/src/recherche.js`).
