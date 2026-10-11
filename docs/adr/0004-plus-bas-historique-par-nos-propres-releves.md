# Plus bas historique calculé uniquement à partir de nos propres relevés

Le plus bas historique est calculé à partir des prix Steam qu'undergrounddeals relève lui-même chaque heure, et non importé d'IsThereAnyDeal. Leur API donnerait un historique complet dès le premier jour, mais leurs conditions d'utilisation interdisent les applis concurrentes (ils font eux-mêmes des alertes de prix) et l'accès peut être retiré à tout moment : on préfère une alerte moins riche au départ plutôt qu'une fonctionnalité qui peut disparaître du jour au lendemain.

## Consequences

- Pendant les premiers mois, un « plus bas historique » ne couvre que la période surveillée ; l'appli affiche « plus bas depuis le [date de début de surveillance] ».
- Un produit suivi pour la première fois dans un pays repart sans historique, même si d'autres pays en ont un.
