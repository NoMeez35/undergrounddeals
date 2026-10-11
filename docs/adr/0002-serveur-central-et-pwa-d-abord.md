# Serveur central et PWA d'abord

Un serveur central vérifie les prix de chaque produit une seule fois pour tous les utilisateurs et envoie les alertes par Web Push ; les applis ne sont que des clients. Le client est d'abord une PWA (site installable sur PC et téléphone), les stores (Play Store, App Store) viendront plus tard. Un téléphone, iOS surtout, ne peut pas interroger Steam en tâche de fond de façon fiable, et des milliers d'appareils interrogeant Steam chacun se heurteraient à ses limites de requêtes ; la PWA couvre toutes les plateformes avec un seul code, gratuitement, sans validation des stores ni compte développeur Apple payant.

## Consequences

- Sur iOS, l'utilisateur doit ajouter l'appli à l'écran d'accueil (iOS 16.4 ou plus récent) pour recevoir les notifications.
- L'appli n'est pas trouvable dans les stores tant qu'on n'y publie pas.
