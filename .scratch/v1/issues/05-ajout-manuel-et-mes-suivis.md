# Ajout manuel et écran Mes suivis

Status: resolved
Blocked by: 04

## Quoi

L'utilisateur ajoute un produit en collant un lien Steam ou un AppID. L'écran Mes suivis liste ses produits suivis en deux onglets, Jeux et DLC, avec le prix actuel dans son pays et la réduction en cours. Il peut retirer un produit.

## Critères d'acceptation

- [x] Un jeu ajouté apparaît dans l'onglet Jeux, un DLC dans l'onglet DLC.
- [x] Un pack, un lien invalide ou un produit inexistant est refusé avec un message clair.
- [x] La limite de suivi s'applique : au-delà de 200 jeux (ou 200 DLC), l'ajout est refusé avec un message invitant à libérer une place.
- [x] Ajouter deux fois le même produit n'en crée pas de doublon.
- [x] Les produits retirés de Steam ne comptent pas dans la limite (colonne `retire_de_steam`, renseignée par le ticket 07).
- [x] Les prix et la devise affichés sont ceux du pays de l'utilisateur (transféré du ticket 04) ; après un changement de pays dans les Réglages, ce sont ceux du nouveau pays.

## Comments

- 2026-10-11 : implémenté. L'accueil devient l'écran Mes suivis. Fiches et prix lus sur l'API « appdetails » de la boutique Steam : une requête pour la fiche d'un nouveau produit (ensuite gardée dans la table `produits`, partagée par tous), une requête par paquet de 100 produits pour les prix, gardés 15 minutes en cache par Cloudflare. Les prix affichés sont mis en forme par Steam dans la devise du pays de l'utilisateur ; un pays sans boutique (ex. Antarctique) reçoit des prix en dollars. Seuls les types Steam « game » et « dlc » sont acceptés (une bande-son est refusée). Le serveur est découpé en modules (connexion, utilisateur, réglages, suivis). En attente du test manuel du porteur du projet.
- 2026-10-11 : test manuel réussi par le porteur du projet (ajout d'un jeu et d'un DLC, refus des packs et liens invalides, doublon, prix après changement de pays, retrait). Ticket clos.
