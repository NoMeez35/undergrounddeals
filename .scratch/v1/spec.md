# undergrounddeals v1 : les alertes

Status: ready-for-agent

Vocabulaire : voir `GLOSSARY.md`. Décisions structurantes : voir `docs/adr/` (0001 connexion Steam, 0002 serveur central + PWA, 0003 Cloudflare gratuit, 0004 plus bas historique par nos relevés).

## Objectif

Une PWA gratuite et open source (MIT), installable sur PC et téléphone, qui surveille les produits suivis (jeux et DLC Steam) de chaque utilisateur et lui envoie des alertes. Budget : 0 €. Le porteur du projet ne code pas : tout le code est écrit par l'agent, toute action manuelle est guidée pas à pas.

## Périmètre

- Connexion via Steam uniquement (OpenID).
- Langue : français ou anglais (repli : anglais). Pays : tous ceux de Steam. Proposés à la première connexion (pays : profil Steam public, sinon navigateur ; langue : navigateur), modifiables dans les Réglages.
- Produits suivis : jeux et DLC, limite de suivi de 200 jeux et 200 DLC par utilisateur (ajouts manuels compris ; produits retirés de Steam non comptés). Packs exclus.
- Sources : liste de souhaits (import + resynchronisation quotidienne, ordre de priorité Steam ; relecture à la demande si elle était vide ou privée) et ajout manuel (lien Steam, AppID ou recherche par nom). Un produit de la liste retiré par l'utilisateur devient un produit écarté.
- Alertes : début de promo, plus bas historique, prix cible (remplace les deux précédentes pour ce produit), sortie (accès anticipé compris), démo disponible (jeux uniquement). Événements simultanés fusionnés en une alerte. Un interrupteur par type, pour tous les produits.
- Envoi : Web Push + fil d'alertes dans l'appli. Pas d'e-mail, pas de Discord.
- Relevé des prix toutes les heures, requêtes regroupées, uniquement pour les pays ayant au moins un utilisateur.
- Badges : Démo disponible, Retiré de Steam, Gratuit (pas d'alerte pour ces deux derniers).
- Écrans : Connexion, Mes suivis (onglets Jeux / DLC), Fil d'alertes, Réglages (pays, langue, interrupteurs, notifications, bouton Ko-fi, suppression du compte, lien vers la page de confidentialité).
- RGPD : on ne stocke que le SteamID, le pays, la langue, les produits suivis (avec leur date d'ajout et leur provenance), la liste de souhaits (produits, ordre, produits écartés) avec la date et le résultat de sa dernière lecture, les prix cibles, les alertes et les abonnements push.

## Hors périmètre

Tout ce qui n'est pas listé ci-dessus. Les versions suivantes sont préparées dans `futur/` (dépôt privé, jamais publié ici).

## Tickets

Voir `issues/`, dans l'ordre des numéros ; chaque ticket indique ce qui le bloque.
