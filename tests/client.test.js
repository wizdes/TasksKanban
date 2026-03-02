/**
 * @jest-environment jsdom
 */
const fs = require("fs");
const path = require("path");

// --- Test data ---

const TASK_1 = {
  id: "abc-001",
  title: "Buy groceries",
  status: "todo",
  priority: "medium",
  folderId: "folder-1",
  dueDate: null,
  startedAt: null,
  completedAt: null,
  tags: [{ id: "tag-1", name: "personal" }],
  notes: [{ id: "note-1", content: "Milk and eggs", createdAt: "2026-01-01T00:00:00Z" }],
  description: "Weekly shopping",
};

const TASK_2 = {
  id: "abc-002",
  title: "Write report",
  status: "in_progress",
  priority: "high",
  folderId: "folder-1",
  dueDate: "2026-03-02T00:00:00Z",
  startedAt: "2026-02-28T00:00:00Z",
  completedAt: null,
  tags: [],
  notes: [],
  description: "",
};

const TASK_3 = {
  id: "abc-003",
  title: "Deploy app",
  status: "done",
  priority: null,
  folderId: null,
  dueDate: null,
  startedAt: "2026-02-01T00:00:00Z",
  completedAt: "2026-02-15T00:00:00Z",
  tags: [],
  notes: [],
  description: "Production deploy",
};

const TASK_4 = {
  id: "abc-004",
  title: "Old feature",
  status: "cancelled",
  priority: null,
  folderId: null,
  dueDate: null,
  startedAt: null,
  completedAt: null,
  tags: [],
  notes: [],
  description: "",
};

const FOLDERS = [{ id: "folder-1", name: "Work" }];
const TAGS = [
  { id: "tag-1", name: "personal" },
  { id: "tag-2", name: "urgent" },
];

// --- Helpers ---

const HTML_TEMPLATE = `<div id="app">
  <header id="toolbar">
    <h1>Kanban Board</h1>
    <div class="toolbar-actions">
      <select id="folder-filter"><option value="">All Folders</option></select>
      <button id="new-task-btn">+ New Task</button>
    </div>
  </header>
  <div id="content">
    <div id="board">
      <div class="column" data-status="todo">
        <div class="column-header"><span class="column-title">Todo</span> <span class="column-count">0</span></div>
        <div class="column-cards"></div>
      </div>
      <div class="column" data-status="in_progress">
        <div class="column-header"><span class="column-title">In Progress</span> <span class="column-count">0</span></div>
        <div class="column-cards"></div>
      </div>
      <div class="column" data-status="done">
        <div class="column-header"><span class="column-title">Done</span> <span class="column-count">0</span></div>
        <div class="column-cards"></div>
      </div>
      <div class="column" data-status="cancelled">
        <div class="column-header"><span class="column-title">Cancelled</span> <span class="column-count">0</span></div>
        <div class="column-cards"></div>
      </div>
    </div>
    <div id="detail-pane" class="detail-pane hidden">
      <div class="detail-header">
        <h2 id="detail-title" contenteditable="false"></h2>
        <button id="detail-close" class="close-btn">&times;</button>
      </div>
      <div class="detail-body"></div>
    </div>
  </div>
  <div id="toast" class="hidden"></div>
  <div id="loading-spinner">Loading&hellip;</div>
</div>`;

function flush() {
  return new Promise((r) => setTimeout(r, 10));
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeFetchMock(taskList) {
  return jest.fn((url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();

    if (url.endsWith("/tasks") && method === "GET") {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(taskList))),
        text: () => Promise.resolve(""),
      });
    }
    if (url.endsWith("/folders") && method === "GET") {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(FOLDERS))),
        text: () => Promise.resolve(""),
      });
    }
    if (url.endsWith("/tags") && method === "GET") {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(TAGS))),
        text: () => Promise.resolve(""),
      });
    }
    if (/\/tasks\/[^/]+$/.test(url) && method === "GET") {
      const id = url.split("/tasks/")[1];
      const task = taskList.find((t) => t.id === id);
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(task || taskList[0]))),
        text: () => Promise.resolve(""),
      });
    }
    if (/\/tasks\/[^/]+\/status$/.test(url) && method === "PATCH") {
      const body = JSON.parse(opts.body);
      const id = url.split("/tasks/")[1].split("/status")[0];
      const task = taskList.find((t) => t.id === id);
      if (task) task.status = body.status;
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve(JSON.parse(JSON.stringify(task))),
        text: () => Promise.resolve(""),
      });
    }
    if (/\/tasks\/[^/]+$/.test(url) && method === "PUT") {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      });
    }
    if (url.endsWith("/tasks") && method === "POST") {
      const body = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: "new-task-id", ...body, tags: [], notes: [], createdAt: new Date().toISOString() }),
        text: () => Promise.resolve(""),
      });
    }
    if (/\/tasks\/[^/]+$/.test(url) && method === "DELETE") {
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
    }
    if (/\/tasks\/[^/]+\/tags\/[^/]+$/.test(url) && (method === "POST" || method === "DELETE")) {
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
    }
    if (/\/tasks\/[^/]+\/notes/.test(url) && method === "DELETE") {
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null), text: () => Promise.resolve("") });
    }
    if (/\/tasks\/[^/]+\/notes$/.test(url) && method === "POST") {
      const body = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ id: "new-note-id", content: body.content, createdAt: new Date().toISOString() }),
        text: () => Promise.resolve(""),
      });
    }
    if (/\/tasks\/[^/]+\/move$/.test(url) && method === "PATCH") {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve("Not found") });
  });
}

const scriptContent = fs.readFileSync(path.join(__dirname, "../src/public/app.js"), "utf8");

function loadClientScript() {
  const wrapped = `(function() {\n${scriptContent}\n})();`;
  const fn = new Function(wrapped);
  fn();
}

function getColumn(status) {
  return document.querySelector(`.column[data-status="${status}"]`);
}
function getCardsIn(status) {
  return getColumn(status).querySelectorAll(".card");
}
function columnCount(status) {
  return getColumn(status).querySelector(".column-count").textContent;
}
function detailIsOpen() {
  const p = document.getElementById("detail-pane");
  return !p.classList.contains("hidden");
}
function openDetail(id) {
  document.querySelector(`.card[data-id="${id}"]`).click();
}
function makeDT() {
  return { data: {}, effectAllowed: "none", dropEffect: "none", setData(f, v) { this.data[f] = v; }, getData(f) { return this.data[f]; } };
}
function dragEv(type, dt) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  e.dataTransfer = dt || makeDT();
  return e;
}

// --- Tests ---

describe("Kanban Board Client", () => {
  let fetchMock;

  beforeEach(async () => {
    document.body.innerHTML = HTML_TEMPLATE;
    window.__CONFIG__ = { apiUrl: "http://test-api", apiKey: "test-key" };
    fetchMock = makeFetchMock([
      JSON.parse(JSON.stringify(TASK_1)),
      JSON.parse(JSON.stringify(TASK_2)),
      JSON.parse(JSON.stringify(TASK_3)),
      JSON.parse(JSON.stringify(TASK_4)),
    ]);
    global.fetch = fetchMock;
    global.prompt = jest.fn();
    global.confirm = jest.fn(() => true);

    loadClientScript();
    await flush();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  // --- Rendering ---

  describe("Board Rendering", () => {
    test("renders tasks in correct columns", () => {
      expect(getCardsIn("todo").length).toBe(1);
      expect(getCardsIn("in_progress").length).toBe(1);
      expect(getCardsIn("done").length).toBe(1);
      expect(getCardsIn("cancelled").length).toBe(1);
    });

    test("shows correct column counts", () => {
      expect(columnCount("todo")).toBe("1");
      expect(columnCount("in_progress")).toBe("1");
      expect(columnCount("done")).toBe("1");
      expect(columnCount("cancelled")).toBe("1");
    });

    test("renders card titles", () => {
      expect(getCardsIn("todo")[0].querySelector(".card-title").textContent).toBe("Buy groceries");
    });

    test("renders priority dots", () => {
      const dot = getCardsIn("todo")[0].querySelector(".priority-dot");
      expect(dot).toBeTruthy();
      expect(dot.classList.contains("medium")).toBe(true);
    });

    test("renders tag chips", () => {
      const chip = getCardsIn("todo")[0].querySelector(".tag-chip");
      expect(chip).toBeTruthy();
      expect(chip.textContent).toBe("personal");
    });

    test("done cards have done class", () => {
      expect(getCardsIn("done")[0].classList.contains("done")).toBe(true);
    });

    test("cards are draggable", () => {
      expect(getCardsIn("todo")[0].getAttribute("draggable")).toBe("true");
    });

    test("cards have correct string data-id (GUID)", () => {
      expect(getCardsIn("todo")[0].dataset.id).toBe("abc-001");
    });

    test("hides loading spinner", () => {
      expect(document.getElementById("loading-spinner").classList.contains("hidden")).toBe(true);
    });
  });

  // --- Selection ---

  describe("Card Selection", () => {
    test("click selects card and opens detail", () => {
      const card = getCardsIn("todo")[0];
      card.click();
      expect(card.classList.contains("selected")).toBe(true);
      expect(detailIsOpen()).toBe(true);
    });

    test("clicking new card deselects previous", () => {
      const c1 = getCardsIn("todo")[0];
      const c2 = getCardsIn("in_progress")[0];
      c1.click();
      c2.click();
      expect(c1.classList.contains("selected")).toBe(false);
      expect(c2.classList.contains("selected")).toBe(true);
    });
  });

  // --- Detail pane open/close ---

  describe("Detail Pane", () => {
    test("click opens detail pane", () => {
      openDetail("abc-001");
      expect(detailIsOpen()).toBe(true);
    });

    test("click with GUID IDs works (core bug fix)", () => {
      expect(getCardsIn("todo")[0].dataset.id).toBe("abc-001");
      openDetail("abc-001");
      expect(detailIsOpen()).toBe(true);
      expect(document.getElementById("detail-title").textContent).toBe("Buy groceries");
    });

    test("shows task title in contenteditable header", () => {
      openDetail("abc-001");
      const titleEl = document.getElementById("detail-title");
      expect(titleEl.textContent).toBe("Buy groceries");
      expect(titleEl.contentEditable).toBe("true");
    });

    test("shows correct status", () => {
      openDetail("abc-001");
      expect(document.getElementById("detail-status").value).toBe("todo");
    });

    test("shows correct priority", () => {
      openDetail("abc-001");
      expect(document.getElementById("detail-priority").value).toBe("medium");
    });

    test("shows description", () => {
      openDetail("abc-001");
      expect(document.getElementById("detail-description").value).toBe("Weekly shopping");
    });

    test("shows tags", () => {
      openDetail("abc-001");
      const tags = document.querySelectorAll(".detail-tag");
      expect(tags.length).toBe(1);
      expect(tags[0].textContent).toContain("personal");
    });

    test("shows notes", () => {
      openDetail("abc-001");
      const notes = document.querySelectorAll(".note-item");
      expect(notes.length).toBe(1);
      expect(notes[0].querySelector(".note-content").textContent).toBe("Milk and eggs");
    });

    test("shows folder selection", () => {
      openDetail("abc-001");
      expect(document.getElementById("detail-folder").value).toBe("folder-1");
    });

    test("shows started date for in-progress task", () => {
      openDetail("abc-002");
      expect(document.querySelector(".detail-body").innerHTML).toContain("Started");
    });

    test("shows completed date for done task", () => {
      openDetail("abc-003");
      expect(document.querySelector(".detail-body").innerHTML).toContain("Completed");
    });

    test("close button closes pane", () => {
      openDetail("abc-001");
      expect(detailIsOpen()).toBe(true);
      document.getElementById("detail-close").click();
      expect(document.getElementById("detail-pane").classList.contains("hidden")).toBe(true);
    });

    test("Escape closes pane", () => {
      openDetail("abc-001");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(document.getElementById("detail-pane").classList.contains("hidden")).toBe(true);
    });

    test("closing removes selection", () => {
      openDetail("abc-001");
      document.getElementById("detail-close").click();
      expect(document.querySelectorAll(".card.selected").length).toBe(0);
    });
  });

  // --- Drag and Drop ---

  describe("Drag and Drop", () => {
    test("dragstart sets dragging class", () => {
      const card = getCardsIn("todo")[0];
      const dt = makeDT();
      card.dispatchEvent(dragEv("dragstart", dt));
      expect(card.classList.contains("dragging")).toBe(true);
      expect(dt.effectAllowed).toBe("move");
      expect(dt.data["text/plain"]).toBe("abc-001");
    });

    test("dragover adds drag-over class", () => {
      const col = getColumn("in_progress");
      col.querySelector(".column-cards").dispatchEvent(dragEv("dragover", { dropEffect: "none" }));
      expect(col.classList.contains("drag-over")).toBe(true);
    });

    test("drop on different column calls status API", async () => {
      const card = getCardsIn("todo")[0];
      const dt = makeDT();
      card.dispatchEvent(dragEv("dragstart", dt));
      getColumn("in_progress").querySelector(".column-cards").dispatchEvent(dragEv("drop", dt));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/status") && opts && opts.method === "PATCH"
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body)).toEqual({ status: "in_progress" });
    });

    test("drop moves card optimistically", () => {
      const dt = makeDT();
      getCardsIn("todo")[0].dispatchEvent(dragEv("dragstart", dt));
      getColumn("in_progress").querySelector(".column-cards").dispatchEvent(dragEv("drop", dt));
      expect(getCardsIn("in_progress").length).toBe(2);
      expect(getCardsIn("todo").length).toBe(0);
    });

    test("drop on same column is a no-op", async () => {
      const dt = makeDT();
      getCardsIn("todo")[0].dispatchEvent(dragEv("dragstart", dt));
      getColumn("todo").querySelector(".column-cards").dispatchEvent(dragEv("drop", dt));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/status") && opts && opts.method === "PATCH"
      );
      expect(call).toBeFalsy();
    });

    test("failed API reverts status", async () => {
      const origFetch = global.fetch;
      global.fetch = jest.fn((url, opts = {}) => {
        if (opts.method === "PATCH" && url.includes("/status")) {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("fail") });
        }
        return origFetch(url, opts);
      });

      const dt = makeDT();
      getCardsIn("todo")[0].dispatchEvent(dragEv("dragstart", dt));
      getColumn("done").querySelector(".column-cards").dispatchEvent(dragEv("drop", dt));
      expect(getCardsIn("todo").length).toBe(0); // optimistic

      await flush();
      expect(getCardsIn("todo").length).toBe(1); // reverted
    });

    test("dragend removes dragging class", () => {
      const card = getCardsIn("todo")[0];
      const dt = makeDT();
      card.dispatchEvent(dragEv("dragstart", dt));
      card.dispatchEvent(dragEv("dragend", dt));
      expect(card.classList.contains("dragging")).toBe(false);
    });

    test("drag and drop works with GUID IDs (core bug fix)", async () => {
      const card = getCardsIn("todo")[0];
      expect(card.dataset.id).toBe("abc-001");
      const dt = makeDT();
      card.dispatchEvent(dragEv("dragstart", dt));
      getColumn("in_progress").querySelector(".column-cards").dispatchEvent(dragEv("drop", dt));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/status") && opts && opts.method === "PATCH"
      );
      expect(call).toBeTruthy();
    });
  });

  // --- Editing ---

  describe("Detail Pane Editing", () => {
    test("status change calls PATCH", async () => {
      openDetail("abc-001");
      const sel = document.getElementById("detail-status");
      sel.value = "in_progress";
      sel.dispatchEvent(new Event("change"));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/status") && opts && opts.method === "PATCH"
      );
      expect(call).toBeTruthy();
    });

    test("priority change calls PUT", async () => {
      openDetail("abc-001");
      const sel = document.getElementById("detail-priority");
      sel.value = "urgent";
      sel.dispatchEvent(new Event("change"));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001") && opts && opts.method === "PUT" && opts.body && JSON.parse(opts.body).priority === "urgent"
      );
      expect(call).toBeTruthy();
    });

    test("due date change calls PUT", async () => {
      openDetail("abc-001");
      const input = document.getElementById("detail-due");
      input.value = "2026-04-01";
      input.dispatchEvent(new Event("change"));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001") && opts && opts.method === "PUT" && opts.body && JSON.parse(opts.body).dueDate === "2026-04-01"
      );
      expect(call).toBeTruthy();
    });

    test("folder change calls PATCH move", async () => {
      openDetail("abc-001");
      const sel = document.getElementById("detail-folder");
      sel.value = "";
      sel.dispatchEvent(new Event("change"));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/move") && opts && opts.method === "PATCH"
      );
      expect(call).toBeTruthy();
    });

    test("title blur calls PUT when changed", async () => {
      openDetail("abc-001");
      const titleEl = document.getElementById("detail-title");
      titleEl.textContent = "New Title";
      titleEl.dispatchEvent(new Event("blur"));
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001") && opts && opts.method === "PUT" && opts.body && JSON.parse(opts.body).title === "New Title"
      );
      expect(call).toBeTruthy();
    });

    test("description saves after debounce", async () => {
      openDetail("abc-001");
      const desc = document.getElementById("detail-description");
      desc.value = "Updated";
      desc.dispatchEvent(new Event("input"));

      // Not yet saved
      await flush();
      let call = fetchMock.mock.calls.find(
        ([url, opts]) => opts && opts.method === "PUT" && opts.body && JSON.parse(opts.body).description === "Updated"
      );
      expect(call).toBeFalsy();

      // After debounce (300ms)
      await delay(400);
      call = fetchMock.mock.calls.find(
        ([url, opts]) => opts && opts.method === "PUT" && opts.body && JSON.parse(opts.body).description === "Updated"
      );
      expect(call).toBeTruthy();
    });
  });

  // --- Task CRUD ---

  describe("Task Creation", () => {
    test("prompts for title", async () => {
      global.prompt.mockReturnValue("New task");
      document.getElementById("new-task-btn").click();
      await flush();
      expect(global.prompt).toHaveBeenCalledWith("Task title:");
    });

    test("calls POST API", async () => {
      global.prompt.mockReturnValue("New task");
      document.getElementById("new-task-btn").click();
      await flush();

      const call = fetchMock.mock.calls.find(
        ([url, opts]) => url.endsWith("/tasks") && opts && opts.method === "POST"
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(call[1].body).title).toBe("New task");
    });

    test("opens detail pane after creation", async () => {
      global.prompt.mockReturnValue("New task");
      document.getElementById("new-task-btn").click();
      await flush();
      expect(detailIsOpen()).toBe(true);
    });

    test("empty title skips creation", async () => {
      global.prompt.mockReturnValue("");
      document.getElementById("new-task-btn").click();
      await flush();
      expect(fetchMock.mock.calls.find(([, opts]) => opts && opts.method === "POST")).toBeFalsy();
    });

    test("null prompt skips creation", async () => {
      global.prompt.mockReturnValue(null);
      document.getElementById("new-task-btn").click();
      await flush();
      expect(fetchMock.mock.calls.find(([, opts]) => opts && opts.method === "POST")).toBeFalsy();
    });
  });

  describe("Task Deletion", () => {
    test("deletes task and removes from board", async () => {
      openDetail("abc-001");
      global.confirm.mockReturnValue(true);
      document.getElementById("delete-task-btn").click();
      await flush();

      expect(fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001") && opts && opts.method === "DELETE"
      )).toBeTruthy();
      expect(getCardsIn("todo").length).toBe(0);
    });

    test("cancelled delete keeps task", async () => {
      openDetail("abc-001");
      global.confirm.mockReturnValue(false);
      document.getElementById("delete-task-btn").click();
      await flush();
      expect(getCardsIn("todo").length).toBe(1);
    });
  });

  // --- Folder filter ---

  describe("Folder Filter", () => {
    test("filters tasks by folder", () => {
      const sel = document.getElementById("folder-filter");
      sel.value = "folder-1";
      sel.dispatchEvent(new Event("change"));
      expect(document.querySelectorAll(".card").length).toBe(2);
    });

    test("All Folders shows everything", () => {
      const sel = document.getElementById("folder-filter");
      sel.value = "folder-1";
      sel.dispatchEvent(new Event("change"));
      sel.value = "";
      sel.dispatchEvent(new Event("change"));
      expect(document.querySelectorAll(".card").length).toBe(4);
    });

    test("folder dropdown is populated", () => {
      const opts = document.getElementById("folder-filter").querySelectorAll("option");
      expect(opts.length).toBe(2);
      expect(opts[1].value).toBe("folder-1");
      expect(opts[1].textContent).toBe("Work");
    });
  });

  // --- Tags ---

  describe("Tag Management", () => {
    test("remove tag calls DELETE", async () => {
      openDetail("abc-001");
      document.querySelector(".remove-tag").click();
      await flush();
      expect(fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/tags/tag-1") && opts && opts.method === "DELETE"
      )).toBeTruthy();
    });

    test("add tag opens picker", () => {
      openDetail("abc-001");
      document.getElementById("add-tag-trigger").click();
      expect(document.getElementById("tag-picker")).toBeTruthy();
    });

    test("picker excludes assigned tags", () => {
      openDetail("abc-001");
      document.getElementById("add-tag-trigger").click();
      const items = document.querySelectorAll(".tag-pick-item");
      expect(items.length).toBe(1);
      expect(items[0].textContent).toBe("urgent");
    });
  });

  // --- Notes ---

  describe("Note Management", () => {
    test("add note shows input", () => {
      openDetail("abc-001");
      document.getElementById("add-note-btn").click();
      expect(document.querySelector(".note-input")).toBeTruthy();
    });

    test("delete note calls DELETE", async () => {
      openDetail("abc-001");
      global.confirm.mockReturnValue(true);
      document.querySelector(".delete-note").click();
      await flush();
      expect(fetchMock.mock.calls.find(
        ([url, opts]) => url.includes("/tasks/abc-001/notes/note-1") && opts && opts.method === "DELETE"
      )).toBeTruthy();
    });
  });

  // --- Keyboard shortcuts ---

  describe("Keyboard Shortcuts", () => {
    test("n key triggers new task creation", () => {
      global.prompt.mockReturnValue(null);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
      expect(global.prompt).toHaveBeenCalledWith("Task title:");
    });

    test("n key does not trigger when focused on input", () => {
      openDetail("abc-001");
      const desc = document.getElementById("detail-description");
      desc.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "n" }));
      // prompt should not have been called (only the initial load calls, not from 'n' key)
      const promptCalls = global.prompt.mock.calls.filter(c => c[0] === "Task title:");
      expect(promptCalls.length).toBe(0);
    });
  });

  // --- Toast ---

  describe("Toast", () => {
    test("shows on API failure", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve("fail") })
      );
      global.prompt.mockReturnValue("Test");
      document.getElementById("new-task-btn").click();
      await flush();
      const toast = document.getElementById("toast");
      expect(toast.classList.contains("hidden")).toBe(false);
      expect(toast.textContent).toBe("Failed to create task");
    });
  });

  // --- Init ---

  describe("Init", () => {
    test("fetches tasks, folders, and tags", () => {
      const urls = fetchMock.mock.calls.map(([url]) => url);
      expect(urls).toContain("http://test-api/tasks");
      expect(urls).toContain("http://test-api/folders");
      expect(urls).toContain("http://test-api/tags");
    });

    test("sends auth headers", () => {
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers["x-api-key"]).toBe("test-key");
    });
  });
});
