export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/statut") {
      const ligne = await env.DB.prepare("SELECT valeur FROM statut WHERE cle = ?")
        .bind("message")
        .first();
      return Response.json({ message: ligne?.valeur ?? null });
    }

    return Response.json({ erreur: "introuvable" }, { status: 404 });
  },
};
