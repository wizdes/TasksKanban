/* global __CONFIG__ */
const { apiUrl, apiKey } = window.__CONFIG__;
const headers = { "x-api-key": apiKey, "Content-Type": "application/json" };

let tasks = [];
let folders = [];
let tags = [];
let selectedTaskId = null;
let currentFolder = "";

// --- API ---

async function api(path, opts = {}) {
  const url = `${apiUrl}${path}`;
  const res = await fetch(url, { headers, ...opts });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// --- Toast ---

let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
}

// --- Date formatting ---

function formatDue(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- Rendering ---

function renderBoard() {
  const filtered = currentFolder
    ? tasks.filter((t) => String(t.folderId) === currentFolder)
    : tasks;

  const columns = {
    todo: [],
    in_progress: [],
    done: [],
    cancelled: [],
  };

  filtered.forEach((t) => {
    const status = (t.status || "todo").toLowerCase().replace(/ /g, "_");
    if (columns[status]) columns[status].push(t);
  });

  Object.entries(columns).forEach(([status, items]) => {
    const col = document.querySelector(`.column[data-status="${status}"]`);
    col.querySelector(".column-count").textContent = items.length;
    const container = col.querySelector(".column-cards");
    if (items.length === 0) {
      container.innerHTML = '<div class="column-empty">No tasks</div>';
      return;
    }
    container.innerHTML = items.map((t) => renderCard(t)).join("");
  });

  // Re-highlight selected card
  if (selectedTaskId) {
    const sel = document.querySelector(`.card[data-id="${selectedTaskId}"]`);
    if (sel) sel.classList.add("selected");
  }
}

function renderCard(task) {
  const priorityClass = task.priority ? task.priority.toLowerCase() : "";
  const priorityDot = priorityClass
    ? `<span class="priority-dot ${priorityClass}"></span>`
    : "";

  const taskTags = task.tags || [];
  const visibleTags = taskTags.slice(0, 3);
  const overflowCount = taskTags.length - 3;
  const tagChips = visibleTags
    .map((t) => `<span class="tag-chip">${escHtml(t.name)}</span>`)
    .join("");
  const overflow =
    overflowCount > 0
      ? `<span class="tag-overflow">+${overflowCount}</span>`
      : "";

  const due = formatDue(task.dueDate);
  const dueHtml = due ? `<span class="card-due">${due}</span>` : "";

  const doneClass = task.status === "done" ? " done" : "";

  return `<div class="card${doneClass}" data-id="${task.id}" draggable="true">
    <div class="card-title">${escHtml(task.title)}</div>
    <div class="card-meta">${priorityDot}${tagChips}${overflow}${dueHtml}</div>
  </div>`;
}

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Drag and Drop ---

let draggedTaskId = null;

document.getElementById("board").addEventListener("dragstart", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  draggedTaskId = card.dataset.id;
  card.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedTaskId);
});

document.getElementById("board").addEventListener("dragend", (e) => {
  const card = e.target.closest(".card");
  if (card) card.classList.remove("dragging");
  document
    .querySelectorAll(".column.drag-over")
    .forEach((c) => c.classList.remove("drag-over"));
  draggedTaskId = null;
});

document.getElementById("board").addEventListener("dragover", (e) => {
  const col = e.target.closest(".column");
  if (!col) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  col.classList.add("drag-over");
});

document.getElementById("board").addEventListener("dragleave", (e) => {
  const col = e.target.closest(".column");
  if (col && !col.contains(e.relatedTarget)) {
    col.classList.remove("drag-over");
  }
});

document.getElementById("board").addEventListener("drop", async (e) => {
  e.preventDefault();
  const col = e.target.closest(".column");
  if (!col || !draggedTaskId) return;
  col.classList.remove("drag-over");

  const newStatus = col.dataset.status;
  const task = tasks.find((t) => t.id === draggedTaskId);
  if (!task) return;

  const oldStatus = (task.status || "todo").toLowerCase().replace(/ /g, "_");
  if (oldStatus === newStatus) return;

  // Optimistic update
  task.status = newStatus;
  renderBoard();

  try {
    await api(`/tasks/${task.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    // Refresh task data to get updated timestamps
    const updated = await api(`/tasks/${task.id}`);
    Object.assign(task, updated);
    renderBoard();
    if (selectedTaskId === task.id) renderDetail(task);
  } catch (err) {
    toast("Failed to update status");
    task.status = oldStatus;
    renderBoard();
  }
});

// --- Card click handlers ---

document.getElementById("board").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  selectCard(card.dataset.id);
});

document.getElementById("board").addEventListener("dblclick", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const id = card.dataset.id;
  selectCard(id);
  openDetailPane(id);
});

function selectCard(id) {
  selectedTaskId = id;
  document.querySelectorAll(".card").forEach((c) => c.classList.remove("selected"));
  const card = document.querySelector(`.card[data-id="${id}"]`);
  if (card) card.classList.add("selected");
}

// --- Detail pane ---

function openDetailPane(taskId) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;

  selectedTaskId = taskId;
  const pane = document.getElementById("detail-pane");
  pane.classList.remove("hidden");
  // Force reflow then add open class for animation
  pane.offsetHeight;
  pane.classList.add("open");
  document.getElementById("board").classList.add("detail-open");

  renderDetail(task);
}

function closeDetailPane() {
  const pane = document.getElementById("detail-pane");
  pane.classList.remove("open");
  document.getElementById("board").classList.remove("detail-open");
  setTimeout(() => pane.classList.add("hidden"), 150);
  selectedTaskId = null;
  document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
}

document.getElementById("detail-close").addEventListener("click", closeDetailPane);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDetailPane();
});

function renderDetail(task) {
  const body = document.querySelector(".detail-body");
  const folder = folders.find((f) => f.id === task.folderId);
  const folderOptions = folders
    .map(
      (f) =>
        `<option value="${f.id}"${f.id === task.folderId ? " selected" : ""}>${escHtml(f.name)}</option>`
    )
    .join("");

  const taskTags = task.tags || [];
  const tagHtml = taskTags
    .map(
      (t) =>
        `<span class="detail-tag">${escHtml(t.name)}<span class="remove-tag" data-tag-id="${t.id}">&times;</span></span>`
    )
    .join("");

  const notes = task.notes || [];
  const notesHtml = notes
    .map(
      (n) => `<div class="note-item" data-note-id="${n.id}">
      <div class="note-meta">
        <span>${new Date(n.createdAt).toLocaleString()}</span>
        <div class="note-actions">
          <button class="edit-note" data-note-id="${n.id}">Edit</button>
          <button class="delete-note" data-note-id="${n.id}">Delete</button>
        </div>
      </div>
      <div class="note-content">${escHtml(n.content)}</div>
    </div>`
    )
    .join("");

  body.innerHTML = `
    <div class="detail-field">
      <label>Title</label>
      <input type="text" id="detail-title" value="${escHtml(task.title)}">
    </div>
    <div class="detail-field">
      <label>Status</label>
      <select id="detail-status">
        <option value="todo"${task.status === "todo" ? " selected" : ""}>Todo</option>
        <option value="in_progress"${task.status === "in_progress" ? " selected" : ""}>In Progress</option>
        <option value="done"${task.status === "done" ? " selected" : ""}>Done</option>
        <option value="cancelled"${task.status === "cancelled" ? " selected" : ""}>Cancelled</option>
      </select>
    </div>
    <div class="detail-field">
      <label>Priority</label>
      <select id="detail-priority">
        <option value=""${!task.priority ? " selected" : ""}>None</option>
        <option value="low"${task.priority === "low" ? " selected" : ""}>Low</option>
        <option value="medium"${task.priority === "medium" ? " selected" : ""}>Medium</option>
        <option value="high"${task.priority === "high" ? " selected" : ""}>High</option>
        <option value="urgent"${task.priority === "urgent" ? " selected" : ""}>Urgent</option>
      </select>
    </div>
    <div class="detail-field">
      <label>Folder</label>
      <select id="detail-folder">
        <option value="">None</option>
        ${folderOptions}
      </select>
    </div>
    <div class="detail-field">
      <label>Tags</label>
      <div class="detail-tags">
        ${tagHtml}
        <button class="add-tag-btn" id="add-tag-trigger">+</button>
      </div>
    </div>
    <div class="detail-field">
      <label>Due Date</label>
      <input type="date" id="detail-due" value="${task.dueDate ? task.dueDate.split("T")[0] : ""}">
    </div>
    <div class="detail-field">
      <label>Started</label>
      <span style="font-size:13px;color:var(--text-muted)">${task.startedAt ? new Date(task.startedAt).toLocaleDateString() : "—"}</span>
    </div>
    <div class="detail-field">
      <label>Completed</label>
      <span style="font-size:13px;color:var(--text-muted)">${task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "—"}</span>
    </div>
    <div class="detail-field">
      <label>Description</label>
      <textarea id="detail-description">${escHtml(task.description || "")}</textarea>
    </div>
    <div class="notes-section">
      <h3>Notes</h3>
      ${notesHtml}
      <button class="add-note-btn" id="add-note-btn">+ Add note</button>
    </div>
    <button class="delete-task-btn" id="delete-task-btn">Delete Task</button>
  `;

  bindDetailEvents(task);
}

// --- Detail pane event bindings ---

let descSaveTimer;

function bindDetailEvents(task) {
  const titleInput = document.getElementById("detail-title");
  const statusSelect = document.getElementById("detail-status");
  const prioritySelect = document.getElementById("detail-priority");
  const folderSelect = document.getElementById("detail-folder");
  const dueInput = document.getElementById("detail-due");
  const descInput = document.getElementById("detail-description");

  titleInput.addEventListener("blur", async () => {
    const val = titleInput.value.trim();
    if (val && val !== task.title) {
      task.title = val;
      renderBoard();
      try {
        await api(`/tasks/${task.id}`, {
          method: "PUT",
          body: JSON.stringify({ title: val }),
        });
      } catch (err) {
        toast("Failed to update title");
      }
    }
  });

  statusSelect.addEventListener("change", async () => {
    const newStatus = statusSelect.value;
    const oldStatus = task.status;
    task.status = newStatus;
    renderBoard();
    try {
      await api(`/tasks/${task.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await api(`/tasks/${task.id}`);
      Object.assign(task, updated);
      renderDetail(task);
    } catch (err) {
      toast("Failed to update status");
      task.status = oldStatus;
      renderBoard();
      renderDetail(task);
    }
  });

  prioritySelect.addEventListener("change", async () => {
    const val = prioritySelect.value || null;
    task.priority = val;
    renderBoard();
    try {
      await api(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ priority: val }),
      });
    } catch (err) {
      toast("Failed to update priority");
    }
  });

  folderSelect.addEventListener("change", async () => {
    const val = folderSelect.value || null;
    task.folderId = val;
    try {
      await api(`/tasks/${task.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({ folderId: val }),
      });
      renderBoard();
    } catch (err) {
      toast("Failed to move task");
    }
  });

  dueInput.addEventListener("change", async () => {
    const val = dueInput.value || null;
    task.dueDate = val;
    renderBoard();
    try {
      await api(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ dueDate: val }),
      });
    } catch (err) {
      toast("Failed to update due date");
    }
  });

  descInput.addEventListener("input", () => {
    clearTimeout(descSaveTimer);
    descSaveTimer = setTimeout(async () => {
      const val = descInput.value;
      task.description = val;
      try {
        await api(`/tasks/${task.id}`, {
          method: "PUT",
          body: JSON.stringify({ description: val }),
        });
      } catch (err) {
        toast("Failed to save description");
      }
    }, 300);
  });

  // Tag removal
  document.querySelectorAll(".remove-tag").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tagId = btn.dataset.tagId;
      try {
        await api(`/tasks/${task.id}/tags/${tagId}`, { method: "DELETE" });
        task.tags = task.tags.filter((t) => String(t.id) !== tagId);
        renderDetail(task);
        renderBoard();
      } catch (err) {
        toast("Failed to remove tag");
      }
    });
  });

  // Add tag
  document.getElementById("add-tag-trigger").addEventListener("click", () => {
    showTagPicker(task);
  });

  // Notes
  document.getElementById("add-note-btn").addEventListener("click", () => {
    showNoteInput(task);
  });

  document.querySelectorAll(".delete-note").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const noteId = btn.dataset.noteId;
      if (!confirm("Delete this note?")) return;
      try {
        await api(`/tasks/${task.id}/notes/${noteId}`, { method: "DELETE" });
        task.notes = task.notes.filter((n) => String(n.id) !== noteId);
        renderDetail(task);
      } catch (err) {
        toast("Failed to delete note");
      }
    });
  });

  document.querySelectorAll(".edit-note").forEach((btn) => {
    btn.addEventListener("click", () => {
      const noteId = btn.dataset.noteId;
      const note = task.notes.find((n) => String(n.id) === noteId);
      if (!note) return;
      showNoteEdit(task, note);
    });
  });

  // Delete task
  document.getElementById("delete-task-btn").addEventListener("click", async () => {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await api(`/tasks/${task.id}`, { method: "DELETE" });
      tasks = tasks.filter((t) => t.id !== task.id);
      closeDetailPane();
      renderBoard();
      toast("Task deleted");
    } catch (err) {
      toast("Failed to delete task");
    }
  });
}

// --- Tag picker ---

function showTagPicker(task) {
  const container = document.querySelector(".detail-tags");
  const existing = document.getElementById("tag-picker");
  if (existing) {
    existing.remove();
    return;
  }

  const taskTagIds = new Set((task.tags || []).map((t) => String(t.id)));
  const available = tags.filter((t) => !taskTagIds.has(String(t.id)));

  const picker = document.createElement("div");
  picker.id = "tag-picker";
  picker.style.cssText =
    "position:absolute;background:#fff;border:1px solid var(--border);border-radius:6px;padding:8px;box-shadow:var(--shadow-md);z-index:20;max-height:160px;overflow-y:auto;min-width:140px;";

  if (available.length === 0) {
    picker.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">No more tags</div>';
  } else {
    picker.innerHTML = available
      .map(
        (t) =>
          `<div class="tag-pick-item" data-tag-id="${t.id}" style="padding:4px 8px;cursor:pointer;font-size:12px;border-radius:4px;">${escHtml(t.name)}</div>`
      )
      .join("");
  }

  container.style.position = "relative";
  container.appendChild(picker);

  picker.addEventListener("click", async (e) => {
    const item = e.target.closest(".tag-pick-item");
    if (!item) return;
    const tagId = item.dataset.tagId;
    try {
      await api(`/tasks/${task.id}/tags/${tagId}`, { method: "POST" });
      const tag = tags.find((t) => String(t.id) === tagId);
      if (tag) {
        task.tags = task.tags || [];
        task.tags.push(tag);
      }
      renderDetail(task);
      renderBoard();
    } catch (err) {
      toast("Failed to add tag");
    }
  });

  // Close picker on outside click
  setTimeout(() => {
    document.addEventListener(
      "click",
      function closePicker(e) {
        if (!picker.contains(e.target) && e.target.id !== "add-tag-trigger") {
          picker.remove();
          document.removeEventListener("click", closePicker);
        }
      }
    );
  }, 0);
}

// --- Note input ---

function showNoteInput(task) {
  const btn = document.getElementById("add-note-btn");
  btn.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <textarea class="note-input" placeholder="Write a note..."></textarea>
    <div class="note-save-actions">
      <button class="cancel-btn">Cancel</button>
      <button class="save-btn">Save</button>
    </div>
  `;
  btn.parentNode.insertBefore(wrapper, btn);

  const textarea = wrapper.querySelector("textarea");
  textarea.focus();

  wrapper.querySelector(".cancel-btn").addEventListener("click", () => {
    wrapper.remove();
    btn.style.display = "";
  });

  wrapper.querySelector(".save-btn").addEventListener("click", async () => {
    const content = textarea.value.trim();
    if (!content) return;
    try {
      const note = await api(`/tasks/${task.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      task.notes = task.notes || [];
      task.notes.push(note);
      renderDetail(task);
    } catch (err) {
      toast("Failed to add note");
    }
  });
}

function showNoteEdit(task, note) {
  const noteEl = document.querySelector(`.note-item[data-note-id="${note.id}"]`);
  if (!noteEl) return;
  const contentEl = noteEl.querySelector(".note-content");
  const original = note.content;

  contentEl.innerHTML = `
    <textarea class="note-input">${escHtml(original)}</textarea>
    <div class="note-save-actions">
      <button class="cancel-btn">Cancel</button>
      <button class="save-btn">Save</button>
    </div>
  `;

  const textarea = contentEl.querySelector("textarea");
  textarea.focus();

  contentEl.querySelector(".cancel-btn").addEventListener("click", () => {
    renderDetail(task);
  });

  contentEl.querySelector(".save-btn").addEventListener("click", async () => {
    const content = textarea.value.trim();
    if (!content) return;
    try {
      await api(`/tasks/${task.id}/notes/${note.id}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      note.content = content;
      renderDetail(task);
    } catch (err) {
      toast("Failed to update note");
    }
  });
}

// --- Create task ---

document.getElementById("new-task-btn").addEventListener("click", async () => {
  const title = prompt("Task title:");
  if (!title || !title.trim()) return;
  try {
    const task = await api("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        status: "todo",
        folderId: currentFolder || null,
      }),
    });
    tasks.unshift(task);
    renderBoard();
    openDetailPane(task.id);
    toast("Task created");
  } catch (err) {
    toast("Failed to create task");
  }
});

// --- Folder filter ---

document.getElementById("folder-filter").addEventListener("change", (e) => {
  currentFolder = e.target.value;
  const url = new URL(window.location);
  if (currentFolder) {
    url.searchParams.set("folder", currentFolder);
  } else {
    url.searchParams.delete("folder");
  }
  history.replaceState(null, "", url);
  renderBoard();
});

function populateFolderFilter() {
  const select = document.getElementById("folder-filter");
  select.innerHTML =
    '<option value="">All Folders</option>' +
    folders
      .map(
        (f) =>
          `<option value="${f.id}"${String(f.id) === currentFolder ? " selected" : ""}>${escHtml(f.name)}</option>`
      )
      .join("");
}

// --- Init ---

async function init() {
  // Read folder from URL
  const params = new URLSearchParams(window.location.search);
  currentFolder = params.get("folder") || "";

  try {
    const [tasksData, foldersData, tagsData] = await Promise.all([
      api("/tasks"),
      api("/folders"),
      api("/tags"),
    ]);
    tasks = tasksData || [];
    folders = foldersData || [];
    tags = tagsData || [];

    populateFolderFilter();
    renderBoard();
  } catch (err) {
    toast("Failed to load data");
  }

  document.getElementById("loading-spinner").classList.add("hidden");
}

init();
