-- Dernier jour (AAAA-MM-JJ) où le prix a été relevé, mis à jour au plus une
-- fois par jour. Un prix qui n'a pas été vu depuis la veille est périmé : il
-- n'est plus affiché, et son prochain relevé compte comme une reprise.
ALTER TABLE prix ADD COLUMN vu_le TEXT;

-- 1 pour le premier relevé d'un couple (produit, pays) et pour le premier
-- relevé après une interruption (prix périmé) : ce n'est pas un changement de
-- prix observé, il ne doit déclencher aucune alerte.
ALTER TABLE historique_prix ADD COLUMN apres_interruption INTEGER NOT NULL DEFAULT 0;
