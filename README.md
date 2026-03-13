# TasksKanban

Kanban board UI for [yili.dev/kanban](https://yili.dev/kanban). Connects to [ServerAPI](../ServerAPI/) for data persistence.

## Features

- **Four columns** — Not Started, In Progress, Complete, Cancelled
- **Drag-and-drop** — Move tasks between columns with optimistic updates and error rollback
- **Detail pane** — Right sidebar with full task editing (title, status, priority, folder, due date, description, tags, notes, AI status)
- **Folder filtering** — Filter board by folder via dropdown
- **Tags** — Assign/remove tags, up to 3 visible per card (+N overflow)
- **Notes** — Add, edit, and delete notes per task
- **AI status tracking** — Separate workflow status field (planning_ready, review_ready, agent_execution_ready, agent_complete)
- **Priority indicators** — Color-coded dots (low, medium, high, urgent)
- **Due date display** — Smart formatting (Today, Tomorrow, Yesterday) with overdue highlighting
- **Keyboard shortcuts** — `N` new task, `Escape` close detail pane

## Tech Stack

Node.js, Express, vanilla JavaScript (no frontend framework)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3003` |
| `TASKS_API_URL` | Internal API base URL | `http://127.0.0.1:5000` |
| `TASKS_API_PUBLIC_URL` | Public API URL for browser requests | Falls back to `TASKS_API_URL` |
| `TASKS_API_KEY` | API key for `x-api-key` header | |
| `ADMIN_USERNAME` | Basic Auth username | `admin` |
| `ADMIN_PASSWORD` | Basic Auth password (required) | |

## Setup

```bash
npm install
npm start       # http://localhost:3003
npm test        # 71 tests (auth + app rendering + client UI)
```

## Authentication

- **UI access:** HTTP Basic Auth (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- **API calls:** `x-api-key` header sent with all requests to ServerAPI
