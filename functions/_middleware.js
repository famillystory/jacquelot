function unauthorized() {
  return new Response("Mot de passe requis", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Site privé"',
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest({ request, next, env }) {
  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");

  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const separator = decoded.indexOf(":");
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);

  if (
    separator < 0 ||
    username !== env.JACQ_USER ||
    password !== env.JACQ_PASSWORD
  ) {
    return unauthorized();
  }

  return next();
}