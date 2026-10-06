# 🚀 Sprintify - Collaborative Project Management, Video Meetings, Subtasks, AI Task Assistant & Analytics

Sprintify is a full-stack, real-time collaborative project management application featuring an interactive drag-and-drop Kanban board, **Productivity Analytics Dashboard**, **Socket.io Real-Time Sync**, **Task Due Dates & Notifications System**, **AI Task Assistant**, **Task Subtasks & Checklists**, integrated project video meetings (powered by Jitsi Meet & 8x8 JaaS), and rich task collaboration with **Task Comments** & **File Attachments**.

Designed with a warm cream background (`#FAF7F2`), soft pastel accents, and paper notebook aesthetics.

---

## 🔔 New Feature: Task Due Dates & Notifications System

- **Task Due Dates**:
  - Optional `due_date` field (`YYYY-MM-DD` standard) selectable via native `<input type="date">` in task creation and edit modals.
  - Visual badges on Kanban task cards: **Due Today** (soft orange), **Due Tomorrow** (soft neutral), **Overdue** (soft red when task is not DONE and date is past), or formatted date badge.
  - Generates activity log entries (`UPDATED` with metadata `{ field: 'due_date', from, to }`) when due dates change.
  - Integrates with the **Analytics Tab** by tracking and displaying an **Overdue Tasks** card when overdue tasks exist.
- **In-App Notification Center**:
  - Top Navbar Bell icon displaying a live red unread badge count.
  - Interactive Popover with "All" and "Unread" tabs, "Mark all as read", and click-to-navigate action links.
  - Real-Time Socket.io sync via `notification:new` events sent directly to private `user:<id>` socket rooms.
  - Notification Types: `TASK_ASSIGNED`, `TASK_DUE_SOON`, `TASK_OVERDUE`, `COMMENT_ADDED`, `ADDED_TO_PROJECT`, and `MEETING_INVITE`.
- **Notification Preferences & Optional Email Delivery**:
  - Preference modal allowing users to toggle in-app notifications and email notifications (per-event toggles for task assigned, due reminders, and comments).
  - Fire-and-forget email service using `nodemailer` (SMTP configured via optional env vars `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `FRONTEND_URL`). If SMTP is unconfigured, email delivery degrades gracefully without throwing errors or blocking HTTP requests.
- **Background Scheduler Design**:
  - Built-in background job (`server/src/jobs/dueReminders.js`) executing on server startup and every 30 minutes via plain Node `setInterval` (no external cron dependencies).
  - Single set-based PostgreSQL query fetching open tasks due within 24 hours (`TASK_DUE_SOON`) or past due date (`TASK_OVERDUE`).
  - Strict deduplication enforced via `UNIQUE (user_id, dedupe_key)` constraints with dedupe keys formatted as `due_soon:<taskId>:<due_date>` and `overdue:<taskId>:<due_date>`.
  - **UTC Standard**: All dates and time comparisons in the database and scheduler are evaluated in UTC.

---

## 📊 New Feature: Productivity Analytics Dashboard

- **KPI Metrics**: Total tasks, completion rate %, in-progress count, average cycle time, and period-over-period trend comparison chips.
- **6 Recharts Visualizations (Token Color System)**:
  1. **Status Distribution**: Donut chart displaying proportion of tasks across To Do (`#7FB2D9`), In Progress (`#F2B84B`), and Done (`#5DB67A`).
  2. **Burndown Trend**: Line chart comparing actual remaining open workload (`#3FA796`) vs ideal linear trajectory (`#7A746B`).
  3. **Daily Throughput**: Bar chart showing tasks completed per day.
  4. **Workload by Member**: Horizontal stacked bar chart showing task distribution per team member (and Unassigned tasks).
  5. **Priority Breakdown**: Grouped bar chart comparing total vs completed tasks per priority level using the soft badge color palette.
  6. **Top Contributors**: Ranked leaderboard highlighting team members with the most completed tasks.
- **Metric Definitions**:
  - **Cycle Time**: Duration (in hours or days) from a task's first transition into `IN_PROGRESS` until its latest transition to `DONE`.
  - **Lead Time**: Duration from task `created_at` until its latest transition to `DONE`.
  - **Burndown Calculation**: Evaluates each task's exact status at 23:59:59.999 UTC of each day based on its `activity_logs` event history.
  - **UTC Standard**: All dates and time series calculations are evaluated in UTC.
- **Accessibility & Features**:
  - **View as Table**: Every chart card includes a toggle button switching to an accessible HTML data table.
  - **CSV Export**: `GET /api/projects/:id/analytics/export.csv` streams standard RFC-4180 escaped CSV files via `apiDownloadBlob`.
  - **Deterministic Insights**: Server-generated summary strings (e.g. member workload leader, throughput percentage change, open high priority tasks).
  - **Real-Time Integration**: Automatically refetches analytics data (1.5s debounced) when real-time task movement events arrive while viewing the Analytics tab.

---

## 🤖 AI Task Assistant

- **Provider Adapter Architecture**: Supports **Gemini** (default) and **OpenAI** directly via Node's native `fetch` (Node 18+) without heavy SDK dependencies.
- **Smart Task & Bug Draft Generation**: Generates structured task descriptions (Goal, Acceptance Criteria) or bug reports (Steps to reproduce, Expected/Actual behavior, Possible cause) based on brief titles.
- **Actionable Checklist Generation**: Automatically generates 3 to 8 concise, actionable subtasks starting with action verbs.
- **Suggested Priority**: Analyzes task intent and proposes initial priority (`LOW`, `MEDIUM`, `HIGH`).
- **Interactive Preview & Control**:
  - Edit generated description text before saving.
  - Interactive subtask checkboxes & inline edits before inserting.
  - **Replace or Append** prompt if description field already contains user text.
  - "Generate subtasks with AI" button inside existing task details modal.
- **Security & Safety**:
  - Strict prompt-injection isolation (`<user_provided_title>` delimiters, explicit safety instructions).
  - Automated JSON parsing, Zod validation, and single-retry fallback on format errors.
  - In-memory per-user rate limiting (10 requests/min, 100 requests/day).
  - 20-second request timeouts (`AbortController`).
  - Graceful degradation: Hides AI buttons automatically when no provider API keys are configured.

---

## ☑️ Task Subtasks & Checklists

- **Checklist Progress Bar**: Visual progress bar on task detail modal indicating percentage completed.
- **Inline Editing & Drag-Free Ordering**: Double-click to edit any subtask title inline, hover to delete, enter key to add new items.
- **Bulk Subtask Creation**: Support for creating multiple subtasks (up to 15) in a single API transaction during task creation or AI assistant application.
- **Kanban Card Subtask Chips**: Displays a muted progress chip (`"2/5"`) with a checklist icon on Kanban cards. Turns pastel success-tinted when all subtasks are finished.
- **Real-Time Live Synchronization**: Socket.io emits `subtask:created`, `subtask:updated`, and `subtask:deleted` events live across all active project members.

---

## ⚡ Real-Time Collaboration (Socket.io)

- **Instant Live Synchronization**: Any task created, edited, moved, or deleted, subtask toggled/added, comment posted/edited/deleted, or file uploaded immediately syncs across all project members' screens without manual refreshing.
- **Project Rooms & JWT Security**: Connections authenticated via JWT token handshake; users join isolated `project:<id>` room after project-membership verification.
- **Sender Exclusion (`X-Socket-Id`)**: REST calls include the client socket ID header so performing actions locally applies optimistically while remote members receive real-time Socket.io events without duplicate triggers.
- **Member Presence & Avatars**: Real-time tracking of online team members with green live indicators on header avatars and a total "N online" count.
- **Card Highlight & Animations**: Remote card moves animate smoothly (200ms) with a soft pastel ring highlight.
- **Toast Notifications**: Bottom-left auto-dismissing toast notifications for remote team actions (`"<name> moved <task title> to Done"`), throttled to 1 toast/sec.
- **Live Typing Indicator**: Real-time `"<name> is typing..."` feedback when team members type comments in the Task Modal.

---

## 💬 Task Comments & File Attachments

- **Chat-Style Task Discussion**: Full chat thread, author avatars, relative timestamps, inline edit/delete, character counter (max 2000), and auto-scrolling composer.
- **Drag & Drop / Clipboard Paste File Attachments**: Drag-and-drop zone + **Clipboard (Ctrl+V) Paste** to attach screenshots directly.
- **Allowed Formats**: PNG, JPG/JPEG, WEBP, GIF, PDF, TXT, LOG, CSV, JSON (max 5 MB per file).

---

## 📹 Video Meetings

- **Jitsi & 8x8 JaaS Integration**: Supports both zero-config public Jitsi Meet (`meet.jit.si`) and 8x8 JaaS RS256 JWT signed iframe embeds (`8x8.vc`).
- **Instant & Scheduled Meetings**: Start an instant meeting in 1 click or schedule syncs with custom date/time, duration (15/30/45/60m), and team invitees.

---

## 🛠 Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, `recharts`, `socket.io-client`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `lucide-react`
- **Backend**: Node.js, Express.js (CommonJS), `socket.io`, `multer` (file uploads), JWT (`jsonwebtoken`), `bcryptjs`, `zod`
- **Database**: PostgreSQL with raw parameterized SQL queries via `pg` Pool (No ORM)

---

## 📂 Repository Structure

```
sprintify/
├── server/
│   ├── uploads/             # Task attachment files directory (.gitignore preserved)
│   ├── src/
│   │   ├── config/          # DB connection pool & environment variables
│   │   ├── db/              # schema.sql, migrate.js, seed.js
│   │   ├── middleware/      # auth, upload (Multer), validate, errorHandler
│   │   ├── services/        # ai.service.js (Gemini/OpenAI adapters)
│   │   ├── controllers/     # auth, projects, tasks, subtasks, ai, analytics, meetings, comments, attachments
│   │   ├── routes/          # auth, projects, tasks, subtasks, ai, analytics, meetings, comments, attachments
│   │   ├── app.js           # Express app setup & CORS configuration
│   │   └── server.js        # Server listener
│   ├── .env.example
│   └── package.json
├── client/
│   ├── src/
│   │   ├── app/             # App Router pages (/login, /signup, /dashboard, /projects/[id], /projects/[id]/meetings/[meetingId])
│   │   ├── components/      # AnalyticsTab, TaskModal, SubtasksList, AiAssistModal, CreateTaskModal, KanbanBoard, TaskCard...
│   │   └── lib/             # api.ts fetch/upload wrapper, auth-context.tsx, avatar.ts, types.ts, useProjectRealtime.ts
│   ├── .env.local.example
│   └── package.json
└── README.md
```

---

## ⚙️ Environment Configuration

### Server Environment (`server/.env`)
```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/sprintify_db
JWT_SECRET=sprintify_super_secret_jwt_key_2026
CLIENT_ORIGIN=http://localhost:3000

# Optional AI Task Assistant Configuration
# Select provider: 'gemini' (default) or 'openai'
AI_PROVIDER=gemini

# Google Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenAI API Configuration (Optional alternative)
# OPENAI_API_KEY=your_openai_api_key_here
# OPENAI_MODEL=gpt-4o-mini

# Optional 8x8 JaaS (Jitsi as a Service) Configuration
# If omitted, Sprintify automatically uses public Jitsi Meet (meet.jit.si).
# JAAS_APP_ID=vpaas-magic-cookie-xxxxxx
# JAAS_KID=vpaas-magic-cookie-xxxxxx/key-id-xxxxxx
# JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

### Client Environment (`client/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## 🚀 Setup & Execution Instructions

### 1. Database Migration & Seeding
From the `server` directory:

```bash
cd server
npm install
npm run migrate
npm run seed
```

- `npm run migrate`: Creates `sprintify_db`, ENUMs, tables (`subtasks`, `meetings`, `comments`, `attachments`, etc.), and performance indexes.
- `npm run seed`: Seeds demo users, project, 25 historical tasks over 21 days with full activity logs, subtasks, comments, and demo meetings.

### 2. Start Backend API Server
```bash
cd server
npm run dev
# Server listening on http://localhost:5000
```

### 3. Start Frontend Client Application
```bash
cd client
npm install
npm run dev
# Client available on http://localhost:3000
```

---

## 🔑 Demo Login Credentials

| Email | Password | Role |
| :--- | :--- | :--- |
| `rahul@example.com` | `password123` | Project Owner |
| `sarah@example.com` | `password123` | Team Member |
| `alex@example.com` | `password123` | Team Member |

---

## 🧪 Testing Productivity Analytics

1. Log in as `rahul@example.com` / `password123` and open the **"Sprintify Web & Mobile App"** project.
2. Click the **"Analytics"** tab in the project header navigation.
3. **KPI Cards & Insights**:
   - Inspect top KPI cards: Total Tasks (25), Completed (16, 64%), In Progress (4), Avg Cycle Time (~3.6 days).
   - Review the top **Productivity Insights** banner.
4. **Interactive Recharts Visualizations**:
   - Inspect the 6 charts (Status Donut, Burndown Line, Daily Throughput Bar, Member Workload Stacked Bar, Priority Grouped Bar, Top Contributors Leaderboard).
   - Click the **table icon** in any chart header to switch to an accessible data table.
5. **Date Range Filter**:
   - Switch range between `7d`, `14d`, `30d`, and `All`. Notice smooth re-fetching and period comparisons.
6. **CSV Export**:
   - Click **"Export CSV"** to download `project-1-tasks.csv` with full task history and cycle times.

---

## 🧪 Testing Due Dates & Notifications

1. **In-App Notification Center**:
   - Log in as `rahul@example.com` / `password123`.
   - Observe the bell icon in the top right navbar showing the red unread count badge.
   - Click the bell icon to open the popover. Filter between "All" and "Unread" tabs.
   - Click any notification to mark it as read and navigate directly to the target task/project.
2. **Notification Preferences**:
   - Click the gear icon inside the notification popover to view preferences.
   - Toggle in-app notifications or email preferences and save.
3. **Due Dates on Tasks**:
   - Open a task or create a new task with a due date set to today, tomorrow, or past date.
   - View Kanban cards displaying **Due Today** (amber), **Due Tomorrow** (neutral), or **Overdue** (soft red) badges.
   - Check the **Analytics** tab to verify the **Overdue Tasks** card is active when overdue open tasks exist.
4. **Trigger Notifications**:
   - Assign a task to another user (`sarah@example.com`) or comment on a task where others are involved to see instant real-time `notification:new` events delivered via Socket.io.
