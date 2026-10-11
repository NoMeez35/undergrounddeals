# Import et synchronisation de la liste de souhaits

Status: resolved
Blocked by: 05

## Quoi

À la première connexion puis chaque jour, l'appli lit la liste de souhaits Steam de l'utilisateur et met à jour ses produits suivis.

## Critères d'acceptation

- [x] Les produits sont importés dans l'ordre de priorité Steam, jusqu'à la limite de suivi (jeux et DLC remplis indépendamment).
- [x] Les produits en trop sont visibles comme « non suivis (limite atteinte) » ; l'utilisateur peut en échanger un contre un produit suivi.
- [x] Un produit retiré de la liste de souhaits n'est plus suivi, sauf s'il a aussi été ajouté à la main.
- [x] Les packs de la liste de souhaits sont ignorés.
- [x] Si le profil est privé, l'appli explique comment rendre la liste de souhaits visible ; l'ajout manuel reste possible.

## Comments
- 2026-10-11 (relecture) : la table `suivis` n'a pas de colonne de provenance. L'ajouter (liste de souhaits, ajout manuel, ou les deux) pour qu'un produit retiré de la liste de souhaits reste suivi s'il a aussi été ajouté à la main. Aujourd'hui, l'ajout manuel d'un produit déjà suivi répond `dejaSuivi` sans rien enregistrer : il devra marquer la provenance manuelle.
- 2026-10-11 : implémenté.
  - Liste lue avec `IWishlistService/GetWishlist` (sans clé). Une liste vide et une liste privée donnent la même réponse : dans ce cas, l'appli ne retire rien et affiche l'explication, avec un lien vers la confidentialité Steam et un bouton « Réessayer l'import » (une fois par minute au plus).
  - Ordre de priorité : produits classés, puis non classés (priorité 0) du plus ancien au plus récent.
  - Types et gratuité lus par paquets de 100 avec `IStoreBrowseService/GetItems`, désormais aussi utilisé pour l'ajout manuel.
  - Import à la première connexion, puis passage planifié toutes les 10 minutes : il synchronise 4 utilisateurs non lus depuis 24 h, soit 576 par jour avec l'offre gratuite (50 requêtes à la base et 50 appels externes par passage).
  - Échange : on retire un produit suivi, puis on clique « Suivre » sur un non suivi. Un produit retiré par l'utilisateur est « écarté » : la synchronisation ne le suit plus d'elle-même.
  - En attente du test manuel du porteur du projet.
- 2026-10-11 : corrections après relecture.
  - Le passage planifié ne se bloque plus sur une erreur inattendue : l'utilisateur concerné est reporté au lendemain et les autres passent.
  - Une liste illisible est traitée comme vide ou privée, donc rien n'est retiré.
  - Au plus 400 fiches demandées à Steam par synchronisation, soit 5 appels au plus ; les produits qui ne peuvent pas être suivis sont mémorisés (table `produits_ignores`).
  - Un produit est enregistré sous l'AppID de la liste.
  - L'étiquette d'un non suivi donne la vraie raison : écarté, retiré de Steam, limite atteinte, ou place libre.
  - Les packs n'apparaissent jamais : une liste de souhaits Steam ne contient que des AppID.
  - Liste vidée : Steam répond comme pour une liste privée, compteur `GetWishlistItemCount` compris. Piste non vérifiée : `IPlayerService/GetOwnedGames` (avec la clé) indique si les détails des jeux, dont dépend la liste, sont publics. Comportement gardé : ne rien retirer.
  - Risque accepté : entre « Retirer » et « Suivre », la synchronisation peut occuper la place libérée ; le clic répond alors « limite atteinte », avec l'invitation à libérer une place.
- 2026-10-11 : test manuel réussi par le porteur du projet (import de la liste de souhaits, retrait puis « Suivre »). Ticket clos.
