-- Produit : jeu ou DLC Steam connu de l'appli, partagé par tous les utilisateurs
-- qui le suivent. Les packs ne sont jamais enregistrés.
CREATE TABLE produits (
  app_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('jeu', 'dlc')),
  nom TEXT NOT NULL,
  -- Renseigné par le relevé des prix (ticket 07). Un produit retiré de Steam ne
  -- compte pas dans la limite de suivi.
  retire_de_steam INTEGER NOT NULL DEFAULT 0
);

-- Produit suivi : un produit qu'un utilisateur a choisi de surveiller.
CREATE TABLE suivis (
  steam_id TEXT NOT NULL REFERENCES utilisateurs (steam_id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES produits (app_id),
  -- Date ISO 8601 de l'ajout.
  ajoute_le TEXT NOT NULL,
  PRIMARY KEY (steam_id, app_id)
);
