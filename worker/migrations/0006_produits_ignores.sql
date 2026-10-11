-- Produits Steam qui ne peuvent pas être suivis (bandes-son, DLC gratuits,
-- logiciels…), mémorisés pour ne pas les redemander à Steam à chaque
-- synchronisation d'une liste de souhaits. Aucune donnée personnelle.
CREATE TABLE produits_ignores (
  app_id INTEGER PRIMARY KEY
);
