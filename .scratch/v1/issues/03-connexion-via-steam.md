# Connexion via Steam

Status: claimed
Blocked by: 02

## Quoi

Écran Connexion avec le bouton « Se connecter via Steam » (OpenID 2.0 de Steam). Au retour, le serveur vérifie la réponse auprès de Steam, crée l'utilisateur s'il n'existe pas (identifié par son SteamID) et ouvre une session. Voir ADR 0001.

## Critères d'acceptation

- [ ] Un utilisateur peut se connecter et se déconnecter ; la session persiste entre les visites.
- [ ] Une réponse OpenID falsifiée ou non vérifiée est refusée.
- [ ] Un utilisateur non connecté qui ouvre une autre page est renvoyé vers l'écran Connexion.
- [ ] Après connexion, l'appli affiche le nom et l'avatar Steam de l'utilisateur.

## Comments

- 2026-10-11 : implémenté et déployé, en attente du test manuel du porteur du projet. Session sans stockage : cookie signé (HMAC, secret `SESSION_SECRET` créé une seule fois au premier déploiement) valable 30 jours. Limite connue : se déconnecter efface le cookie du navigateur, mais une copie volée resterait valable jusqu'à son expiration. Les réponses de Steam de plus de 5 minutes sont refusées (limite le rejeu). Pages inconnues : `404.html` ; `/connexion` est servi par `index.html` via `_redirects`.
