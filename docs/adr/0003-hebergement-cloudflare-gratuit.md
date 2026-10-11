# Hébergement entièrement sur Cloudflare (offre gratuite)

L'appli (PWA), le serveur (Workers), la base de données (D1) et la vérification horaire (Cron Triggers) sont tous hébergés sur Cloudflare, en offre gratuite. Le projet doit démarrer à 0 € et être maintenu sans administrateur système (le porteur du projet ne code pas) : Cloudflare est la seule option qui réunit gratuitement hébergement, base de données et tâches planifiées, sans machine à mettre à jour ni base mise en pause faute d'activité.

## Considered Options

- **Serveur classique (VPS, ou VM gratuite Oracle Cloud)** : rejeté, il faut l'administrer (mises à jour, sécurité, sauvegardes).
- **Supabase gratuit** : rejeté, les projets gratuits sont mis en pause après une période d'inactivité.
- **Vercel / Netlify gratuits** : rejetés, les tâches planifiées gratuites sont trop rares pour une vérification horaire.

## Consequences

- Le code doit respecter les limites de l'offre gratuite (temps CPU et nombre d'appels sortants par exécution), d'où le regroupement des requêtes vers Steam.
- L'adresse est en `.pages.dev` tant qu'on ne paie pas de nom de domaine ; si l'appli grandit, l'offre payante (environ 5 $/mois) prend le relais sans réécriture.
