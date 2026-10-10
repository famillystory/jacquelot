function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Site privé", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const expectedUser = env.JACQ_USER;
    const expectedPass = env.JACQ_PASS;

    if (!expectedUser || !expectedPass) {
      return new Response("Authentication not configured", {
        status: 500,
      });
    }

    const authorization = request.headers.get("Authorization") || "";
    const match = authorization.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/);

    if (!match) {
      return unauthorized();
    }

    let decoded;

    try {
      decoded = atob(match[1]);
    } catch {
      return unauthorized();
    }

    const separator = decoded.indexOf(":");

    if (separator < 0) {
      return unauthorized();
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (username !== expectedUser || password !== expectedPass) {
      return unauthorized();
    }

    return env.ASSETS.fetch(request);
  },
};