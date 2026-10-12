# Notifications Web Push et interrupteurs par type

Status: ready-for-agent
Blocked by: 08, 13

## Quoi

Envoyer chaque alerte en notification Web Push sur tous les appareils où l'utilisateur a activé les notifications. Dans les Réglages : activer ou désactiver les notifications, et un interrupteur par type d'alerte (promo, plus bas historique, prix cible, sortie, démo), valable pour tous les produits.

## Critères d'acceptation

- [ ] Une alerte arrive en notification au plus une heure après l'événement.
- [ ] Toucher la notification ouvre l'appli sur l'alerte.
- [ ] Un type désactivé ne crée plus d'alerte de ce type (ni notification, ni entrée dans le fil d'alertes).
- [ ] Un abonnement expiré ou révoqué est supprimé sans faire échouer les autres envois.
- [ ] Aucun service payant n'est utilisé (clés VAPID générées par nous).

## Comments

- 2026-10-12 (ticket 08) : les alertes sont créées dans `releverPaquet` (`worker/src/releve.js`), table `alertes`. Un type désactivé doit être filtré dans cette requête, pas à l'affichage.
