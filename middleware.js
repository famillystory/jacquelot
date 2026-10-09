export default {
  async fetch(request, env) {
    // --- your two env vars, compared in constant time ---
    const expectedUser = env.JACQ_USER;
    const expectedPass = env.JACQ_PASS;
    if (!expectedUser || !expectedPass) {
      return new Response("Auth not configured", { status: 500 });
    }

    // --- check the Authorization header ---
    const auth = request.headers.get("Authorization");
    if (auth?.startsWith("Basic ")) {
      const [user, pass] = atob(auth.slice(6)).split(":");
      if (user === expectedUser && pass === expectedPass) {
        return env.ASSETS.fetch(request); // serve the file
      }
    }

    // --- not authenticated: ask for credentials ---
    return new Response("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Private", charset="UTF-8"'
      }
    });
  }
};