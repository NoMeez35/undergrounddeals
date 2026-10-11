-- Langue et pays choisis par l'utilisateur ; vides tant qu'il ne les a pas
-- confirmés à sa première connexion.
ALTER TABLE utilisateurs ADD COLUMN pays TEXT;
ALTER TABLE utilisateurs ADD COLUMN langue TEXT;
