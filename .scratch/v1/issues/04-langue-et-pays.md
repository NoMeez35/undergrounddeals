# Choix de la langue et du pays

Status: claimed
Blocked by: 03

## Quoi

Interface traduite en français et en anglais, structurée pour ajouter d'autres langues. À la première connexion, l'appli propose une langue (celle du navigateur si disponible, sinon l'anglais) et un pays (profil Steam s'il est public, sinon navigateur), parmi tous les pays de Steam ; l'utilisateur confirme. Les deux sont modifiables dans l'écran Réglages.

## Critères d'acceptation

- [x] Tous les textes de l'interface existent en français et en anglais.
- [x] La première connexion affiche l'écran de choix, prérempli selon les règles ci-dessus.
- [ ] Le pays détermine la devise et les prix affichés partout dans l'appli.
- [ ] Changer de pays ne déclenche aucune alerte rétroactive.

## Comments

- 2026-10-11 : implémenté. Textes dans `app/public/textes/<langue>.js` (ajouter une langue : l'inscrire dans `app/public/langues.js` et créer son fichier ; un test vérifie que chaque langue a toutes les clés). Pays : les 249 codes ISO 3166-1 utilisés par Steam, noms traduits par le navigateur. Pays et langue stockés dans `utilisateurs` (vides jusqu'à la confirmation) ; `PUT /api/reglages` les enregistre. Écran Réglages minimal (`/reglages`), complété au ticket 15. La page 404 suit la langue du navigateur. Les deux derniers critères ne sont pas encore vérifiables (aucun prix ni alerte avant les tickets 05 à 08) : le pays enregistré est celui que ces tickets devront utiliser, et un rappel est noté au ticket 08. En attente du test manuel du porteur du projet.
