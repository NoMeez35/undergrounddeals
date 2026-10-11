-- La migration 0008 a laissé vu_le vide pour les prix déjà relevés : l'appli
-- les prenait pour périmés. Leur dernier relevé est au plus tard la fin du
-- dernier relevé complet de leur pays.
UPDATE prix
   SET vu_le = (SELECT substr(r.termine_le, 1, 10) FROM releves_pays r WHERE r.pays = prix.pays)
 WHERE vu_le IS NULL;
