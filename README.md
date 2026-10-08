# Arij — Agile Project Management & Issue Tracking (React + JavaScript)

Full-featured Agile project management and issue tracking application built with React 19, JavaScript (ES Modules), Tailwind CSS, Express, and `@google/genai` multimodal Screenshot & Story PDF extraction.

## Features

- **Story PDF Auto-Extractor**: Upload any User Story or PRD `.pdf` document in the **Create Issue** modal or the **Upload Story PDF** importer to automatically populate `Title / Summary`, `Description & Acceptance Criteria`, `Issue Type`, `Priority`, `Story Points`, `Time Estimate`, `Due Date`, `Labels`, and `Subtasks`.
- **Screenshot-to-Arij Importer**: Upload or paste screenshots (`Ctrl+V` / `Cmd+V`) of an existing board, backlog, or issue list to automatically detect and create team member profiles, epics, sprints, stories, tasks, and bugs with their exact statuses, story points, and profile assignments.
- **Per-User Personal Workspace & Center-Line Split View**:
  - Every user has their own isolated personal project, scratchpad, and 5-column Kanban/Scrum board (`To Do`, `In Progress`, `In Review`, `QA Testing`, `Done`).
  - Select two or more users to compare boards with a horizontal **Center Line** and interactive **Show Down / Hide Below** toggle button.
- **Active Sprint & Kanban Board**:
  - 5-stage workflow with drag-and-drop and column WIP limits.
  - Swimlane grouping (`None`, `Epic`, `Assignee`, `Priority`).
  - Multi-facet filtering (Search, Assignee avatars, `Only My Issues`, Epic, Issue Type, Priority).
- **Scrum Backlog, Roadmap, Dashboards, OKRs, RICE, Automation, ITSM & AI Assistant**:
  - Complete 5-pillar enterprise work management (`PLAN · BUILD · TRACK · AUTOMATE · AI`).
- **Issue Navigator & AQL Search**:
  - Basic Filter Builder and live **AQL (Arij Query Language)** mode with CSV & JSON Export.

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
