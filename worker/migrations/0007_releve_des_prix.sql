-- Dernier prix relevé de chaque produit suivi dans chaque pays ayant au moins
-- un utilisateur (voir worker/src/releve.js).
CREATE TABLE prix (
  app_id INTEGER NOT NULL REFERENCES produits (app_id),
  pays TEXT NOT NULL,
  -- enVente (prix connu), gratuit, pasEncoreSorti, ou sansPrix (pas en vente
  -- dans ce pays, ou retiré de Steam : voir produits.retire_de_steam).
  etat TEXT NOT NULL CHECK (etat IN ('enVente', 'gratuit', 'pasEncoreSorti', 'sansPrix')),
  -- Montants en centièmes de la devise, comme Steam les donne ; null hors vente.
  devise TEXT,
  prix INTEGER,
  prix_initial INTEGER,
  reduction INTEGER,
  -- Montants mis en forme par Steam, pour l'affichage.
  prix_affiche TEXT,
  prix_initial_affiche TEXT,
  -- Date ISO 8601 du relevé où ce prix est apparu.
  depuis TEXT NOT NULL,
  PRIMARY KEY (app_id, pays)
);

-- Historique des prix : une ligne à chaque changement relevé (état, devise,
-- prix ou réduction). Un relevé identique au précédent n'ajoute rien, pour
-- rester sous les 100 000 écritures par jour de l'offre gratuite ; la première
-- ligne d'un produit dans un pays date le début de sa surveillance (ADR 0004).
CREATE TABLE historique_prix (
  app_id INTEGER NOT NULL,
  pays TEXT NOT NULL,
  releve_le TEXT NOT NULL,
  etat TEXT NOT NULL,
  devise TEXT,
  prix INTEGER,
  prix_initial INTEGER,
  reduction INTEGER,
  PRIMARY KEY (app_id, pays, releve_le)
);

-- Avancement du relevé horaire, par pays : les produits sont relevés par AppID
-- croissant, par paquets, au fil des passages planifiés de l'heure.
CREATE TABLE releves_pays (
  pays TEXT PRIMARY KEY,
  -- Heure en cours de relevé, ex. « 2026-10-11T14 ».
  heure TEXT NOT NULL,
  -- Produits déjà relevés cette heure-ci : AppID inférieurs ou égaux ; null
  -- quand tous l'ont été.
  apres_app_id INTEGER,
  -- Date ISO 8601 de la fin du dernier relevé complet.
  termine_le TEXT
);
