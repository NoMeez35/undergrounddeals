# Créer les comptes GitHub, Cloudflare et Ko-fi

Status: ready-for-human
Blocked by: —

## Quoi

Le porteur du projet crée les comptes nécessaires, guidé pas à pas par l'agent (idéalement via un assistant interactif `/wizard`).

## Critères d'acceptation

- [x] Compte GitHub créé, dépôt public `undergrounddeals` créé avec la licence MIT.
- [x] Compte Cloudflare (offre gratuite) créé, sans moyen de paiement enregistré.
- [x] Jeton d'API Cloudflare et identifiant de compte enregistrés comme secrets du dépôt GitHub.
- [x] Clé d'API Steam Web (gratuite) obtenue et enregistrée comme secret.
- [ ] Page Ko-fi créée (facultatif à ce stade) ; son lien est noté dans ce ticket.

## Notes

- Guidage conversationnel, un compte à la fois, dans cet ordre : GitHub, Cloudflare, clé Steam, Ko-fi.
- GitHub : compte existant `NoMeez35` ; double authentification obligatoire ; cocher « Keep my email addresses private ».
- Créer les dépôts **vides** sur GitHub (sans README, licence ni .gitignore) : `undergrounddeals` (public) et `undergrounddeals-futur` (privé, versions à venir, voir `futur/README.md`). Le fichier LICENSE (MIT) est ajouté localement par l'agent, puis on pousse.
- Identité des commits : `NoMeez35 <262562210+NoMeez35@users.noreply.github.com>`.

## Comments

- 2026-10-11 : étapes de création du compte GitHub données à l'utilisateur (inscription, double authentification, e-mail masqué). En attente de son nom d'utilisateur et de son adresse noreply.
- 2026-10-11 : compte GitHub déjà existant : `NoMeez35`, noreply `262562210+NoMeez35@users.noreply.github.com`. Double authentification activée. Dépôt public conservé, à condition que les versions futures n'y soient jamais visibles : elles sont déplacées dans `futur/` (dépôt privé) et l'historique local est reconstruit sans elles avant le premier push.
- 2026-10-11 : dépôts poussés. `NoMeez35/undergrounddeals` (public, MIT) et `NoMeez35/undergrounddeals-futur` (privé). Le PC a aussi un autre compte GitHub enregistré (`blknomeez-ai`) : les URL des remotes précisent `NoMeez35@` pour forcer le bon compte. Étape suivante : Cloudflare.
- 2026-10-11 : compte Cloudflare créé (offre gratuite, sans carte bancaire, double authentification activée). Jeton d'API personnalisé `github-undergrounddeals` (Workers Scripts, D1, Cloudflare Pages : Edit ; Account Settings : Read). Secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` enregistrés. Étape suivante : clé Steam.
- 2026-10-11 : clé d'API Steam Web obtenue (domaine déclaré : `undergrounddeals.pages.dev`) et enregistrée dans le secret GitHub `STEAM_API_KEY`. Reste : Ko-fi (facultatif).
