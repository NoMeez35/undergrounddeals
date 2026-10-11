-- Table témoin du squelette : prouve que l'appli lit bien la base D1.
CREATE TABLE statut (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

INSERT INTO statut (cle, valeur) VALUES ('message', 'undergrounddeals est en ligne');
