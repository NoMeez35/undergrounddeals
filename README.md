# undergrounddeals

Appli gratuite et open source qui surveille les jeux et DLC Steam qui vous intéressent et vous prévient des promos, des plus bas historiques, des sorties et des démos.

Elle pourra s'installer sur PC et téléphone comme une application (PWA) et se connectera avec votre compte Steam.

> En construction : on peut déjà se connecter via Steam, choisir sa langue et son pays, et suivre, avec leur prix, des jeux et DLC ajoutés à la main ou importés de la liste de souhaits Steam. Les alertes arrivent dans les prochaines versions.

## Comment c'est fait

Tout est hébergé sur Cloudflare, en offre gratuite :

| Partie | Dossier | Rôle |
|---|---|---|
| Appli (Cloudflare Pages) | `app/` | Les pages affichées dans le navigateur. Les requêtes `/api/…` sont relayées au serveur. |
| Serveur (Cloudflare Worker) | `worker/` | L'API, la connexion via Steam et la synchronisation des listes de souhaits ; plus tard, la vérification horaire des prix et l'envoi des alertes. |
| Base de données (Cloudflare D1) | `worker/migrations/` | Les fichiers SQL qui créent et font évoluer la base, appliqués dans l'ordre. |

Les choix structurants sont expliqués dans `docs/adr/` et le vocabulaire dans `GLOSSARY.md`.

## Déploiement

Chaque envoi sur la branche `main` déclenche GitHub Actions (`.github/workflows/deployer.yml`) :

1. les tests sont lancés ; s'ils échouent, rien n'est déployé ;
2. la base D1 et le projet Pages sont créés s'ils n'existent pas encore ;
3. la base est mise à jour avec les nouvelles migrations ;
4. le serveur, puis l'appli, sont publiés.

Le dépôt a besoin de trois secrets GitHub : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` et `STEAM_API_KEY`. Le secret qui signe les sessions (`SESSION_SECRET`) est créé automatiquement au premier déploiement.

## Développement

Avec Node.js 24 :

```sh
npm install
npm test
```

## Licence

MIT, voir `LICENSE`.
