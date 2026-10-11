-- La table témoin du squelette n'a plus d'usage.
DROP TABLE statut;

-- Utilisateur : identifié uniquement par son SteamID (voir docs/adr/0001).
CREATE TABLE utilisateurs (
  steam_id TEXT PRIMARY KEY
);
