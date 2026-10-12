-- Alerte : créée par le relevé des prix (voir worker/src/releve.js) pour chaque
-- utilisateur du pays qui suit le produit, et affichée dans le fil d'alertes.
CREATE TABLE alertes (
  id INTEGER PRIMARY KEY,
  steam_id TEXT NOT NULL REFERENCES utilisateurs (steam_id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES produits (app_id),
  -- Date ISO 8601 du relevé qui a détecté l'événement.
  cree_le TEXT NOT NULL,
  -- Événements signalés : une colonne par type, 1 s'il fait partie de l'alerte.
  debut_promo INTEGER NOT NULL DEFAULT 0,
  -- Prix au moment de l'alerte, mis en forme par Steam.
  prix_affiche TEXT,
  prix_initial_affiche TEXT,
  reduction INTEGER
);

CREATE INDEX alertes_par_utilisateur ON alertes (steam_id, cree_le);
