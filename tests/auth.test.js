const auth = require("../src/middleware/auth");

describe("auth middleware", () => {
  let req, res, next;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "testpass123";
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it("rejects requests without authorization header", () => {
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with wrong credentials", () => {
    req.headers.authorization =
      "Basic " + Buffer.from("admin:wrongpass").toString("base64");
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects malformed authorization header", () => {
    req.headers.authorization = "Bearer some-token";
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("accepts correct credentials", () => {
    req.headers.authorization =
      "Basic " + Buffer.from("admin:testpass123").toString("base64");
    auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("sets WWW-Authenticate header on rejection", () => {
    auth(req, res, next);
    expect(res.set).toHaveBeenCalledWith(
      "WWW-Authenticate",
      'Basic realm="Kanban"'
    );
  });
});
