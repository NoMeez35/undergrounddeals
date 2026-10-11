-- Provenance d'un produit suivi : ajout manuel, liste de souhaits, ou les deux.
-- Il reste suivi tant que l'une des deux vaut 1. Les suivis existants sont manuels.
ALTER TABLE suivis ADD COLUMN manuel INTEGER NOT NULL DEFAULT 1;
ALTER TABLE suivis ADD COLUMN souhait INTEGER NOT NULL DEFAULT 0;

-- Liste de souhaits Steam de l'utilisateur, réduite aux produits qui peuvent
-- être suivis (jeux et DLC payants ; les packs et le reste sont ignorés).
CREATE TABLE souhaits (
  steam_id TEXT NOT NULL REFERENCES utilisateurs (steam_id) ON DELETE CASCADE,
  app_id INTEGER NOT NULL REFERENCES produits (app_id),
  -- Ordre de priorité Steam : 1 = le plus prioritaire.
  rang INTEGER NOT NULL,
  -- 1 si l'utilisateur a retiré ce produit de ses suivis : la synchronisation
  -- ne le suit plus d'elle-même, il reste visible parmi les non suivis.
  ecarte INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (steam_id, app_id)
);

-- Dernière lecture de la liste de souhaits (date ISO 8601), et son résultat :
-- 1 si elle a pu être lue, 0 si elle était vide ou privée.
ALTER TABLE utilisateurs ADD COLUMN souhaits_lus_le TEXT;
ALTER TABLE utilisateurs ADD COLUMN souhaits_visibles INTEGER;
