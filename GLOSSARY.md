# undergrounddeals

Application qui surveille les jeux et DLC Steam qui intéressent un utilisateur et le prévient des promos, des plus bas historiques, des sorties et des démos.

## Language

### Utilisateurs et produits suivis

**Utilisateur**:
Personne identifiée par son compte Steam, qui suit des produits et reçoit des alertes.
_Avoid_: Compte, membre, client

**Produit suivi**:
Jeu ou DLC Steam qu'un utilisateur a choisi de surveiller ; c'est soit un jeu suivi, soit un DLC suivi.
_Avoid_: Élément, article, item

**Jeu suivi**:
Produit suivi qui est un jeu Steam (hors DLC et packs), quelle que soit sa provenance (liste de souhaits ou ajout manuel).
_Avoid_: Favori, wishlist, watchlist

**DLC suivi**:
Produit suivi qui est un contenu additionnel payant d'un jeu Steam ; compté séparément des jeux suivis.
_Avoid_: Extension, add-on, jeu suivi (quand on parle d'un DLC)

**Limite de suivi**:
Nombre maximal de jeux suivis (200) et, séparément, de DLC suivis (200) par utilisateur ; les produits retirés de Steam n'y comptent pas.
_Avoid_: Quota, plafond

**Liste de souhaits**:
La liste de souhaits Steam de l'utilisateur, une des sources possibles de produits suivis.
_Avoid_: Wishlist (dans le code comme dans l'interface, préférer ce terme)

**Pack**:
Lot de plusieurs produits Steam vendus ensemble ; ne peut pas être suivi.
_Avoid_: Bundle

**Pays**:
Le pays Steam d'un utilisateur, qui détermine les prix et la devise qu'il voit.
_Avoid_: Région, locale, marché

### Prix et événements

**Promo**:
Période pendant laquelle Steam affiche une réduction sur le prix d'un produit dans un pays donné.
_Avoid_: Solde, réduction, deal

**Plus bas historique**:
Le prix Steam le plus bas relevé par undergrounddeals pour un produit dans un pays donné, depuis le début de sa surveillance.
_Avoid_: Record, prix minimum

**Prix cible**:
Prix fixé par un utilisateur pour un produit suivi ; quand il est défini, il remplace les alertes de promo et de plus bas historique pour ce produit.
_Avoid_: Seuil, prix d'alerte, prix souhaité

**Sortie**:
Le moment où un produit suivi, jusque-là non commercialisé, devient achetable sur Steam, accès anticipé compris. Une simple annonce de date n'est pas une sortie.
_Avoid_: Lancement, release, disponibilité

**Démo**:
Version d'essai gratuite d'un jeu, publiée sur Steam. Les DLC n'en ont pas.
_Avoid_: Trial, version d'essai

### Notifications

**Alerte**:
Message envoyé à un utilisateur pour signaler un événement sur un de ses produits suivis : début de promo, plus bas historique atteint, prix cible atteint, sortie ou démo disponible.
_Avoid_: Notification (réservé au mécanisme technique d'envoi), rappel
