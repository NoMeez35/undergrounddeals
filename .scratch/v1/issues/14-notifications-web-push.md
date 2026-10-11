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
