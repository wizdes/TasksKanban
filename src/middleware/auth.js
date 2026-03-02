function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Kanban"');
    return res.status(401).send("Unauthorized");
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const [username, password] = decoded.split(":");

  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (username !== expectedUser || password !== expectedPass) {
    res.set("WWW-Authenticate", 'Basic realm="Kanban"');
    return res.status(401).send("Unauthorized");
  }

  next();
}

module.exports = auth;
