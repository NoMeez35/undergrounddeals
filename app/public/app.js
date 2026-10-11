const statut = document.getElementById("statut");

try {
  const reponse = await fetch("/api/statut");
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const { message } = await reponse.json();
  statut.textContent = message;
} catch (erreur) {
  statut.textContent = `Le serveur ne répond pas (${erreur.message}).`;
}
