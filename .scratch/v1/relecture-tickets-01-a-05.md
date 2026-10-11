# Relecture des tickets 01 à 05 : corrections à faire

Status: ready-for-agent

Relecture `/code-review` du 2026-10-11, de `ff91ef6` à `c339030`. Le porteur du projet a demandé de tout corriger, mineurs compris. Constats vérifiés dans le code.

## Conformité aux tickets

- [ ] Compteur « n / 200 » de Mes suivis : il compte les produits retirés de Steam, que le serveur exclut de la limite (`app/public/mes-suivis.js`, `afficherListe`).
- [ ] DLC gratuits acceptés et comptés, alors que le glossaire définit un DLC suivi comme « payant » (`worker/src/steam-boutique.js` ne lit pas `is_free`).
- [ ] Deux ajouts simultanés du même produit : le second reçoit « limite atteinte » (409) au lieu de « déjà suivi » (`worker/src/suivis.js`, `meta.changes === 0`).
- [ ] Fiche Steam incomplète (`success: true` sans `data` ou sans `name`) : erreur 500 au lieu de `introuvable` ou `steamIndisponible` ; ajouter un test.

## Règles du projet et qualité du code

- [ ] Glossaire : « Bundles » dans `app/public/textes/en.js` (Pack : _Avoid_ Bundle) ; « traduit » dans un commentaire de `app/public/textes.js` et le libellé de test « langue non traduite » (`worker/test/index.test.js`).
- [ ] `elementParId` défini dans `app/public/app.js` et `app/public/mes-suivis.js` : le partager.
- [ ] Affichage d'un message (clé, classe `erreur`, `hidden`) : `afficherMessage` de `mes-suivis.js` refait à la main dans `app.js` (Réglages).
- [ ] Colonnes `app_id, type, nom, retire_de_steam` répétées dans `worker/src/suivis.js`.
- [ ] Bloc try/catch `SteamIndisponible` répété dans `worker/src/suivis.js`.
- [ ] Statuts HTTP des refus d'ajout éparpillés (`STATUT_REFUS` + valeurs en dur) : une seule table pour toutes les `ERREURS_AJOUT`.
- [ ] Types de produit écrits à 5 endroits (`TYPES_PRODUIT`, `TYPES_STEAM`, `CHECK` SQL, `CLES_LISTE_VIDE`, clés de textes) : relier au moins `TYPES_PRODUIT` et `TYPES_STEAM`.
- [ ] Noms : `lireLienSteam` accepte aussi un AppID nu (→ `lireSaisieProduit`) ; variable `lien` dans `ajouterSuivi` ; `let suivis` de `mes-suivis.js` contient toute la réponse (→ `etatSuivis`).
- [ ] Pays de repli `"US"` en dur dans `worker/src/suivis.js` : créer `PAYS_PAR_DEFAUT` dans `app/public/pays.js`.
- [ ] Route `/api/suivis/:appId` écrite deux fois dans `worker/src/index.js` (clé et regex).
- [ ] Erreurs de l'API tantôt en phrases (« non connecté », « introuvable », « pays ou langue invalide »), tantôt en codes (`ERREURS_AJOUT`) : uniformiser en codes.

## Reporté (noté dans les tickets concernés)

- Ticket 06 : provenance des suivis (liste de souhaits ou ajout manuel).
- Ticket 07 : « Pas de prix dans votre pays » affiché aussi pour un produit gratuit ou pas encore sorti.
- Ticket 15 : la date d'ajout des suivis (`suivis.ajoute_le`) est une donnée stockée à citer dans la page de confidentialité.
