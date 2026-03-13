const request = require("supertest");
const app = require("../src/app");

beforeAll(() => {
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "testpass123";
});

describe("GET /kanban", () => {
  it("returns 401 without auth", async () => {
    const res = await request(app).get("/kanban");
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong credentials", async () => {
    const res = await request(app).get("/kanban").auth("admin", "wrong");
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct auth", async () => {
    const res = await request(app)
      .get("/kanban")
      .auth("admin", "testpass123");
    expect(res.status).toBe(200);
  });

  it("returns HTML containing kanban board structure", async () => {
    const res = await request(app)
      .get("/kanban")
      .auth("admin", "testpass123");
    expect(res.text).toContain("Kanban Board");
    expect(res.text).toContain('data-status="not_started"');
    expect(res.text).toContain('data-status="in_progress"');
    expect(res.text).toContain('data-status="complete"');
    expect(res.text).toContain('data-status="cancelled"');
  });

  it("contains all four column headers", async () => {
    const res = await request(app)
      .get("/kanban")
      .auth("admin", "testpass123");
    expect(res.text).toContain("Not Started");
    expect(res.text).toContain("In Progress");
    expect(res.text).toContain("Complete");
    expect(res.text).toContain("Cancelled");
  });

  it("injects config script with API settings", async () => {
    const res = await request(app)
      .get("/kanban")
      .auth("admin", "testpass123");
    expect(res.text).toContain("window.__CONFIG__");
    expect(res.text).toContain("apiUrl");
    expect(res.text).toContain("apiKey");
  });
});
