# Ajout manuel et écran Mes suivis

Status: ready-for-agent
Blocked by: 04

## Quoi

L'utilisateur ajoute un produit en collant un lien Steam ou un AppID. L'écran Mes suivis liste ses produits suivis en deux onglets, Jeux et DLC, avec le prix actuel dans son pays et la réduction en cours. Il peut retirer un produit.

## Critères d'acceptation

- [ ] Un jeu ajouté apparaît dans l'onglet Jeux, un DLC dans l'onglet DLC.
- [ ] Un pack, un lien invalide ou un produit inexistant est refusé avec un message clair.
- [ ] La limite de suivi s'applique : au-delà de 200 jeux (ou 200 DLC), l'ajout est refusé avec un message invitant à libérer une place.
- [ ] Ajouter deux fois le même produit n'en crée pas de doublon.
- [ ] Les produits retirés de Steam ne comptent pas dans la limite.
- [ ] Les prix et la devise affichés sont ceux du pays de l'utilisateur (transféré du ticket 04) ; après un changement de pays dans les Réglages, ce sont ceux du nouveau pays.
