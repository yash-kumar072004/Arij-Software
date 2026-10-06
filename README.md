# Jira — Agile Project Management & Issue Tracking (React + TypeScript)

Full-featured Agile project management and issue tracking application built with React 19, TypeScript, Tailwind CSS, Express, and `@google/genai` multimodal screenshot extraction.

## Features

- **Screenshot-to-Jira Importer**: Upload or paste screenshots (`Ctrl+V` / `Cmd+V`) of an existing Jira board, backlog, or issue list to automatically detect and create team member profiles, epics, sprints, stories, tasks, and bugs with their exact statuses, story points, and profile assignments.
- **Active Sprint & Kanban Board**:
  - 5-stage workflow (`To Do`, `In Progress`, `In Review`, `QA Testing`, `Done`) with drag-and-drop and column WIP limits.
  - Swimlane grouping (`None`, `Epic`, `Assignee`, `Priority`).
  - Multi-facet filtering (Search, Assignee avatars, `Only My Issues`, Epic, Issue Type, Priority).
- **Scrum Backlog & Sprint Planning**:
  - Collapsible sprint containers and backlog planning with story point summaries.
  - Epics side panel with completion progress bars.
  - Start Sprint & Complete Sprint workflows with automatic rollover of incomplete issues.
- **Timeline / Epic Roadmap (Gantt View)**:
  - Interactive timeline plotting Epics and child issues across weeks.
- **Issue Navigator & JQL Search**:
  - Basic Filter Builder and live **JQL (Jira Query Language)** mode.
  - High-density List View, Detail Split View, custom saved filters, and CSV Export.
- **Agile Reports & Analytics**:
  - Sprint Burndown Chart, Velocity Chart, and Team Workload distribution.
- **Releases, Components & Project Settings**:
  - Version tracking, architectural components, multi-project workspace switcher, and WIP limit configuration.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```

3. Start the full-stack development server on port 3000:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm start
   ```
