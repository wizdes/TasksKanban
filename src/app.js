const express = require("express");
const path = require("path");
const auth = require("./middleware/auth");

const app = express();

const apiUrl =
  process.env.TASKS_API_PUBLIC_URL ||
  process.env.TASKS_API_URL ||
  "http://127.0.0.1:5000";
const apiKey = process.env.TASKS_API_KEY || "";

app.use("/kanban/static", express.static(path.join(__dirname, "public")));

app.get("/kanban", auth, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Board</title>
  <link rel="stylesheet" href="/kanban/static/styles.css">
</head>
<body>
  <div id="app">
    <header id="toolbar">
      <h1>Kanban Board</h1>
      <div class="toolbar-actions">
        <select id="folder-filter">
          <option value="">All Folders</option>
        </select>
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
  </div>
  <script>
    window.__CONFIG__ = {
      apiUrl: "${apiUrl}",
      apiKey: "${apiKey}"
    };
  </script>
  <script src="/kanban/static/app.js"></script>
</body>
</html>`);
});

module.exports = app;
