import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { INITIAL_WORKSPACE_STATE } from './src/data/initialWorkspace.ts';
import {
  AuditHistoryItem,
  Issue,
  IssueStatus,
  IssueType,
  JiraWorkspaceState,
  Project,
  ProjectComponent,
  ReleaseVersion,
  SavedFilter,
  Sprint,
  SprintStatus,
  User,
} from './src/types/jira.ts';

dotenv.config();

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DB_FILE_PATH = path.resolve(__dirname, 'workspace-db.json');

app.use(express.json({ limit: '50mb' }));

// ============================================================================
// CONCURRENCY & PARALLEL REQUEST MUTEX LOCK + SERVER-AUTHORITATIVE STATE
// ============================================================================
class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(() => task());
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

const stateMutex = new AsyncMutex();
let authoritativeWorkspace: JiraWorkspaceState = structuredClone(
  INITIAL_WORKSPACE_STATE
);
let serverRevision = 1;

async function loadDatabaseFromDisk(): Promise<void> {
  try {
    if (existsSync(DB_FILE_PATH)) {
      const raw = await fs.readFile(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.workspace && Array.isArray(parsed.workspace.projects)) {
        authoritativeWorkspace = parsed.workspace;
        serverRevision =
          typeof parsed.revision === 'number' ? parsed.revision : 1;
      }
    } else {
      await persistDatabaseToDisk();
    }
  } catch (err) {
    console.error('Failed to load workspace-db.json, using initial seed:', err);
  }
}

async function persistDatabaseToDisk(): Promise<void> {
  const tmpPath = `${DB_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(
    {
      revision: serverRevision,
      updatedAt: new Date().toISOString(),
      workspace: authoritativeWorkspace,
    },
    null,
    2
  );
  await fs.writeFile(tmpPath, payload, 'utf-8');
  await fs.rename(tmpPath, DB_FILE_PATH);
}

// ============================================================================
// REAL-TIME MULTI-SYSTEM SSE STREAMING & PRESENCE REGISTRY
// ============================================================================
interface ConnectedClient {
  clientId: string;
  userId: string;
  connectedAt: string;
  res: express.Response;
}

const connectedClients = new Map<string, ConnectedClient>();

function getActiveCollaborators() {
  const list: { clientId: string; userId: string; connectedAt: string }[] = [];
  connectedClients.forEach((client) => {
    list.push({
      clientId: client.clientId,
      userId: client.userId,
      connectedAt: client.connectedAt,
    });
  });
  return list;
}

function broadcastEvent(eventName: string, payload: unknown) {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  connectedClients.forEach((client, id) => {
    try {
      client.res.write(frame);
    } catch {
      connectedClients.delete(id);
    }
  });
}

// Initial state endpoint
app.get('/api/workspace', (_req, res) => {
  res.json({
    workspace: authoritativeWorkspace,
    revision: serverRevision,
    collaborators: getActiveCollaborators(),
  });
});

// Real-time SSE stream for parallel connected systems
app.get('/api/workspace/stream', (req, res) => {
  const clientId =
    (req.query.clientId as string) ||
    `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const userId = (req.query.userId as string) || 'usr-1';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  connectedClients.set(clientId, {
    clientId,
    userId,
    connectedAt: new Date().toISOString(),
    res,
  });

  // Send immediate authoritative snapshot to the newly connected system
  res.write(
    `event: workspace:init\ndata: ${JSON.stringify({
      workspace: authoritativeWorkspace,
      revision: serverRevision,
      collaborators: getActiveCollaborators(),
    })}\n\n`
  );

  // Broadcast updated collaborator presence to all parallel systems
  broadcastEvent('presence:updated', {
    collaborators: getActiveCollaborators(),
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    connectedClients.delete(clientId);
    broadcastEvent('presence:updated', {
      collaborators: getActiveCollaborators(),
    });
  });
});

// Update active user presence for a connected system
app.post('/api/workspace/presence', (req, res) => {
  const { clientId, userId } = req.body as { clientId: string; userId: string };
  const client = connectedClients.get(clientId);
  if (client && userId) {
    client.userId = userId;
    broadcastEvent('presence:updated', {
      collaborators: getActiveCollaborators(),
    });
  }
  res.json({ ok: true, collaborators: getActiveCollaborators() });
});

// ============================================================================
// IDEMPOTENT ATOMIC EVENT PROCESSOR FOR CONCURRENT REQUESTS
// ============================================================================
export interface WorkspaceMutationEvent {
  type:
    | 'issue:updated'
    | 'issue:created'
    | 'issue:deleted'
    | 'issue:comment_added'
    | 'issue:work_logged'
    | 'sprint:created'
    | 'sprint:started'
    | 'sprint:completed'
    | 'sprint:deleted'
    | 'release:created'
    | 'release:toggled'
    | 'component:created'
    | 'project:updated'
    | 'project:created'
    | 'user:created'
    | 'filter:saved'
    | 'workspace:imported'
    | 'workspace:reset';
  payload: Record<string, any>;
}

function applyMutationEvent(
  ws: JiraWorkspaceState,
  event: WorkspaceMutationEvent
): JiraWorkspaceState {
  const now = new Date().toISOString();
  const { type, payload } = event;

  switch (type) {
    case 'issue:updated': {
      const { issueId, updates, actorId } = payload as {
        issueId: string;
        updates: Partial<Issue>;
        actorId: string;
      };
      return {
        ...ws,
        issues: ws.issues.map((iss) => {
          if (iss.id !== issueId) return iss;
          const newHistory: AuditHistoryItem[] = [...iss.history];
          const trackedFields: (keyof Issue)[] = [
            'status',
            'priority',
            'assigneeId',
            'sprintId',
            'storyPoints',
            'type',
          ];
          trackedFields.forEach((field) => {
            if (updates[field] !== undefined && updates[field] !== iss[field]) {
              newHistory.unshift({
                id: `hst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                actorId: actorId || ws.currentUserId,
                field,
                oldValue: String(iss[field] ?? 'None'),
                newValue: String(updates[field] ?? 'None'),
                timestamp: now,
              });
            }
          });
          return {
            ...iss,
            ...updates,
            history: newHistory,
            updatedAt: now,
          };
        }),
      };
    }

    case 'issue:created': {
      const { issue, projectId, nextCounter } = payload as {
        issue: Issue;
        projectId: string;
        nextCounter: number;
      };
      // Idempotency guard: skip if issue ID already exists
      if (ws.issues.some((i) => i.id === issue.id)) {
        return ws;
      }
      const targetProj = ws.projects.find((p) => p.id === projectId);
      let resolvedCounter = nextCounter || (targetProj ? targetProj.issueCounter + 1 : 101);
      let resolvedKey = issue.key;

      // Resolve key collision if two parallel systems created an issue at the exact same time
      if (targetProj && ws.issues.some((i) => i.key === resolvedKey)) {
        resolvedCounter = Math.max(targetProj.issueCounter + 1, resolvedCounter + 1);
        resolvedKey = `${targetProj.key}-${resolvedCounter}`;
      }

      const finalIssue: Issue = {
        ...issue,
        key: resolvedKey,
      };

      return {
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === projectId
            ? { ...p, issueCounter: Math.max(p.issueCounter + 1, resolvedCounter) }
            : p
        ),
        issues: [...ws.issues, finalIssue],
      };
    }

    case 'issue:deleted': {
      const { issueId } = payload as { issueId: string };
      return {
        ...ws,
        issues: ws.issues.filter((i) => i.id !== issueId),
      };
    }

    case 'issue:comment_added': {
      const { issueId, comment } = payload as {
        issueId: string;
        comment: { id: string; authorId: string; body: string; createdAt: string };
      };
      return {
        ...ws,
        issues: ws.issues.map((iss) => {
          if (iss.id !== issueId) return iss;
          if (iss.comments.some((c) => c.id === comment.id)) return iss;
          return {
            ...iss,
            comments: [...iss.comments, comment],
            updatedAt: now,
          };
        }),
      };
    }

    case 'issue:work_logged': {
      const { issueId, workLog } = payload as {
        issueId: string;
        workLog: {
          id: string;
          authorId: string;
          hoursSpent: number;
          comment: string;
          loggedAt: string;
        };
      };
      return {
        ...ws,
        issues: ws.issues.map((iss) => {
          if (iss.id !== issueId) return iss;
          if (iss.workLogs.some((w) => w.id === workLog.id)) return iss;
          const newSpent = +(iss.timeSpentHours + workLog.hoursSpent).toFixed(1);
          const newRem = Math.max(
            0,
            +(iss.remainingEstimateHours - workLog.hoursSpent).toFixed(1)
          );
          return {
            ...iss,
            timeSpentHours: newSpent,
            remainingEstimateHours: newRem,
            workLogs: [workLog, ...iss.workLogs],
            updatedAt: now,
          };
        }),
      };
    }

    case 'sprint:created': {
      const { sprint } = payload as { sprint: Sprint };
      if (ws.sprints.some((s) => s.id === sprint.id)) return ws;
      return {
        ...ws,
        sprints: [...ws.sprints, sprint],
      };
    }

    case 'sprint:started': {
      const { sprintId, projectId, updates } = payload as {
        sprintId: string;
        projectId: string;
        updates: { name: string; goal: string; startDate: string; endDate: string };
      };
      return {
        ...ws,
        sprints: ws.sprints.map((s) => {
          if (s.projectId !== projectId) return s;
          if (s.id === sprintId) {
            return { ...s, ...updates, status: SprintStatus.ACTIVE };
          }
          if (s.status === SprintStatus.ACTIVE) {
            return { ...s, status: SprintStatus.PLANNED };
          }
          return s;
        }),
      };
    }

    case 'sprint:completed': {
      const { sprintId, destinationSprintId, committedPoints, completedPoints } =
        payload as {
          sprintId: string;
          destinationSprintId: string | null;
          committedPoints: number;
          completedPoints: number;
        };
      return {
        ...ws,
        sprints: ws.sprints.map((s) =>
          s.id === sprintId
            ? {
                ...s,
                status: SprintStatus.COMPLETED,
                completedAt: now,
                committedPoints,
                completedPoints,
              }
            : s
        ),
        issues: ws.issues.map((i) => {
          if (i.sprintId === sprintId && i.status !== IssueStatus.DONE) {
            return { ...i, sprintId: destinationSprintId };
          }
          return i;
        }),
      };
    }

    case 'sprint:deleted': {
      const { sprintId } = payload as { sprintId: string };
      return {
        ...ws,
        sprints: ws.sprints.filter((s) => s.id !== sprintId),
        issues: ws.issues.map((i) =>
          i.sprintId === sprintId ? { ...i, sprintId: null } : i
        ),
      };
    }

    case 'release:created': {
      const { release } = payload as { release: ReleaseVersion };
      if (ws.releases.some((r) => r.id === release.id)) return ws;
      return {
        ...ws,
        releases: [...ws.releases, release],
      };
    }

    case 'release:toggled': {
      const { releaseId } = payload as { releaseId: string };
      return {
        ...ws,
        releases: ws.releases.map((r) =>
          r.id === releaseId
            ? {
                ...r,
                status: r.status === 'RELEASED' ? 'UNRELEASED' : 'RELEASED',
              }
            : r
        ),
      };
    }

    case 'component:created': {
      const { component } = payload as { component: ProjectComponent };
      if (ws.components.some((c) => c.id === component.id)) return ws;
      return {
        ...ws,
        components: [...ws.components, component],
      };
    }

    case 'project:updated': {
      const { projectId, updates } = payload as {
        projectId: string;
        updates: Partial<Project>;
      };
      return {
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === projectId ? { ...p, ...updates } : p
        ),
      };
    }

    case 'project:created': {
      const { project, initialSprint, starterIssue } = payload as {
        project: Project;
        initialSprint: Sprint;
        starterIssue: Issue;
      };
      if (ws.projects.some((p) => p.id === project.id)) return ws;
      return {
        ...ws,
        activeProjectId: project.id,
        projects: [...ws.projects, project],
        sprints: [...ws.sprints, initialSprint],
        issues: [...ws.issues, starterIssue],
      };
    }

    case 'user:created': {
      const { user } = payload as { user: User };
      if (ws.users.some((u) => u.id === user.id)) return ws;
      return {
        ...ws,
        users: [...ws.users, user],
      };
    }

    case 'filter:saved': {
      const { filter } = payload as { filter: SavedFilter };
      if (ws.savedFilters.some((f) => f.id === filter.id)) return ws;
      return {
        ...ws,
        savedFilters: [...ws.savedFilters, filter],
      };
    }

    case 'workspace:imported': {
      const { updatedWorkspace } = payload as {
        updatedWorkspace: JiraWorkspaceState;
      };
      if (!updatedWorkspace) return ws;

      // Merge idempotently so concurrent writes from parallel systems are preserved
      const mergedUsers = [...ws.users];
      updatedWorkspace.users.forEach((u) => {
        if (!mergedUsers.some((existing) => existing.id === u.id)) {
          mergedUsers.push(u);
        }
      });

      const mergedProjects = ws.projects.map((existingProj) => {
        const updatedProj = updatedWorkspace.projects.find(
          (p) => p.id === existingProj.id
        );
        if (!updatedProj) return existingProj;
        return {
          ...existingProj,
          ...updatedProj,
          issueCounter: Math.max(
            existingProj.issueCounter,
            updatedProj.issueCounter
          ),
        };
      });
      updatedWorkspace.projects.forEach((p) => {
        if (!mergedProjects.some((existing) => existing.id === p.id)) {
          mergedProjects.push(p);
        }
      });

      const mergedSprints = [...ws.sprints];
      updatedWorkspace.sprints.forEach((s) => {
        if (!mergedSprints.some((existing) => existing.id === s.id)) {
          mergedSprints.push(s);
        }
      });

      const mergedIssues = [...ws.issues];
      updatedWorkspace.issues.forEach((iss) => {
        if (!mergedIssues.some((existing) => existing.id === iss.id)) {
          mergedIssues.push(iss);
        }
      });

      return {
        ...ws,
        activeProjectId: updatedWorkspace.activeProjectId || ws.activeProjectId,
        users: mergedUsers,
        projects: mergedProjects,
        sprints: mergedSprints,
        issues: mergedIssues,
      };
    }

    case 'workspace:reset': {
      return structuredClone(INITIAL_WORKSPACE_STATE);
    }

    default:
      return ws;
  }
}

app.post('/api/workspace/events', async (req, res) => {
  try {
    const { clientId, events } = req.body as {
      clientId?: string;
      events: WorkspaceMutationEvent | WorkspaceMutationEvent[];
    };

    const eventList = Array.isArray(events) ? events : [events];

    const result = await stateMutex.run(async () => {
      let nextState = authoritativeWorkspace;
      for (const ev of eventList) {
        if (ev && ev.type) {
          nextState = applyMutationEvent(nextState, ev);
        }
      }
      authoritativeWorkspace = nextState;
      serverRevision += 1;
      await persistDatabaseToDisk();
      return {
        workspace: authoritativeWorkspace,
        revision: serverRevision,
      };
    });

    // Broadcast authoritative state to all connected parallel systems
    broadcastEvent('workspace:sync', {
      workspace: result.workspace,
      revision: result.revision,
      originClientId: clientId || null,
      collaborators: getActiveCollaborators(),
    });

    res.json({
      ok: true,
      revision: result.revision,
      workspace: result.workspace,
    });
  } catch (err: unknown) {
    console.error('Error processing concurrent workspace mutation:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to apply workspace event';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// GEMINI MULTIMODAL SCREENSHOT EXTRACTOR
// ============================================================================
function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/jira/extract-screenshot', async (req, res) => {
  try {
    const { images, customInstructions } = req.body as {
      images: { mimeType: string; data: string }[];
      customInstructions?: string;
    };

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: 'Please upload at least one Jira screenshot.' });
      return;
    }

    const ai = getGeminiClient();

    const imageParts = images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data,
      },
    }));

    const promptText = `You are an expert Jira Workspace Migration & Computer Vision engine.
Analyze the uploaded Jira screenshot(s) (which may show a Jira Kanban/Scrum Board, Backlog, Sprint, Issue Detail view, Roadmap, or Team list) and extract EVERY detail accurately so we can recreate the exact same profiles, tasks, statuses, priorities, story points, epics, and task assignments.

Rules for Extraction:
1. PROFILES / USERS:
   - Identify every team member, assignee, or reporter visible in the screenshot(s) — whether shown by full name, partial name, or avatar initials/monogram on issue cards or filter bars.
   - If only initials are visible on a card avatar (e.g., "AK", "SR", "JD"), create a profile with those exact initials and a clear display name (e.g., "AK (Team Member)" or inferred name if shown elsewhere in the screenshot).
   - Provide a role (e.g., "Software Engineer", "Product Manager", "QA Engineer", "Project Lead") and department.

2. PROJECT & SPRINT METADATA:
   - Extract the project name and project key prefix (e.g., if issue keys are "WEB-102", the projectKey is "WEB").
   - Extract the active sprint name and sprint goal if visible.

3. EPICS:
   - Extract any Epics visible as card badges, swimlane headers, epic panel items, or roadmap bars.

4. ISSUES / TASKS & EXACT ASSIGNMENTS:
   - Extract EVERY issue/card/row visible in the screenshot(s).
   - Map each issue's column or status badge to one of: "TODO", "IN_PROGRESS", "IN_REVIEW", "QA", "DONE".
     (For example: "To Do" / "Open" / "Backlog" -> "TODO"; "In Progress" / "Doing" / "Active" -> "IN_PROGRESS"; "In Review" / "Code Review" / "PR" -> "IN_REVIEW"; "QA" / "Testing" / "Ready for QA" -> "QA"; "Done" / "Closed" / "Resolved" -> "DONE").
   - Map each issue's type icon/color to one of: "STORY", "TASK", "BUG", "EPIC", "SUBTASK".
   - Map each issue's priority icon/label to one of: "HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST".
   - Match each issue's assignee (assigneeName and assigneeInitials) to the exact profile seen on that card/row so the task is assigned to that exact user profile!
   - Extract exact issue key (e.g. "ENG-104"), title, description, storyPoints (number), labels (array of strings), epicTitle (if linked to an epic), dueDate (YYYY-MM-DD if visible), and any subtasks.

${customInstructions ? `Additional user instructions: ${customInstructions}` : ''}`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [...imageParts, { text: promptText }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: {
              type: Type.STRING,
              description: 'Detected project name from the Jira screenshot.',
            },
            projectKey: {
              type: Type.STRING,
              description: 'Detected uppercase project key prefix (2-6 chars), e.g. ENG, KAW, PROJ.',
            },
            sprintName: {
              type: Type.STRING,
              description: 'Detected active sprint name if visible.',
            },
            sprintGoal: {
              type: Type.STRING,
              description: 'Detected sprint goal if visible.',
            },
            profiles: {
              type: Type.ARRAY,
              description: 'All user profiles / assignees / reporters detected in the screenshot(s).',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: 'Full name or display identifier of the person.',
                  },
                  initials: {
                    type: Type.STRING,
                    description: '1-2 character uppercase initials shown on avatar.',
                  },
                  email: {
                    type: Type.STRING,
                    description: 'Email if visible, or generated workspace email.',
                  },
                  role: {
                    type: Type.STRING,
                    description: 'Role title, e.g. Software Engineer, QA Lead, Product Manager.',
                  },
                  department: {
                    type: Type.STRING,
                    description: 'Department or team name.',
                  },
                },
                required: ['name', 'initials', 'role'],
              },
            },
            epics: {
              type: Type.ARRAY,
              description: 'Epics detected in the screenshot(s).',
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['title'],
              },
            },
            issues: {
              type: Type.ARRAY,
              description: 'All tasks, stories, bugs, and issues detected in the screenshot(s).',
              items: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description: 'Exact issue key from screenshot if visible, e.g. PROJ-101.',
                  },
                  title: {
                    type: Type.STRING,
                    description: 'Exact issue summary/title.',
                  },
                  description: {
                    type: Type.STRING,
                    description: 'Issue description or details if visible.',
                  },
                  type: {
                    type: Type.STRING,
                    description: 'One of: STORY, TASK, BUG, EPIC, SUBTASK.',
                  },
                  status: {
                    type: Type.STRING,
                    description: 'One of: TODO, IN_PROGRESS, IN_REVIEW, QA, DONE.',
                  },
                  priority: {
                    type: Type.STRING,
                    description: 'One of: HIGHEST, HIGH, MEDIUM, LOW, LOWEST.',
                  },
                  assigneeName: {
                    type: Type.STRING,
                    description: 'Name of the profile assigned to this issue, or empty string if unassigned.',
                  },
                  assigneeInitials: {
                    type: Type.STRING,
                    description: 'Initials on the assignee avatar for this issue.',
                  },
                  epicTitle: {
                    type: Type.STRING,
                    description: 'Title of the parent Epic if shown on the card.',
                  },
                  storyPoints: {
                    type: Type.NUMBER,
                    description: 'Story points estimate shown on the card (0 if none).',
                  },
                  dueDate: {
                    type: Type.STRING,
                    description: 'Due date in YYYY-MM-DD format if visible.',
                  },
                  labels: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  subtasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        completed: { type: Type.BOOLEAN },
                      },
                      required: ['title', 'completed'],
                    },
                  },
                },
                required: ['title', 'type', 'status', 'priority'],
              },
            },
          },
          required: ['profiles', 'issues'],
        },
      },
    });

    const rawText = response.text || '{}';
    const extracted = JSON.parse(rawText);
    res.json(extracted);
  } catch (error: unknown) {
    console.error('Error extracting Jira screenshot:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to analyze screenshot';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// GITHUB REPOSITORY CREATION & DIRECT GIT PUSH
// ============================================================================
app.post('/api/github/push', async (req, res) => {
  try {
    const { token, repoName, isPrivate, description } = req.body as {
      token: string;
      repoName: string;
      isPrivate?: boolean;
      description?: string;
    };

    if (!token || !token.trim()) {
      res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
      return;
    }

    const cleanToken = token.trim();
    const cleanRepo = (repoName || 'jira-react-platform')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-');

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'jira-react-platform',
      },
    });

    if (!userRes.ok) {
      const errBody = await userRes.json().catch(() => ({}));
      res.status(401).json({
        error:
          errBody.message ||
          'Invalid GitHub token. Make sure your token has "repo" scope.',
      });
      return;
    }

    const ghUser = (await userRes.json()) as {
      login: string;
      name?: string;
      email?: string;
    };
    const owner = ghUser.login;

    const checkRepoRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}`,
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'jira-react-platform',
        },
      }
    );

    if (checkRepoRes.status === 404) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'jira-react-platform',
        },
        body: JSON.stringify({
          name: cleanRepo,
          description:
            description ||
            'Full-featured Agile Jira Project Management & Screenshot Importer built in React & TypeScript',
          private: !!isPrivate,
          auto_init: false,
        }),
      });

      if (!createRes.ok) {
        const createErr = await createRes.json().catch(() => ({}));
        res.status(400).json({
          error:
            createErr.message ||
            'Could not create repository on GitHub. Check token permissions.',
        });
        return;
      }
    }

    const repoRoot = __dirname;
    try {
      await execFileAsync('git', ['init', '-b', 'main'], { cwd: repoRoot });
    } catch {
      // Already initialized
    }
    await execFileAsync(
      'git',
      ['config', 'user.name', ghUser.name || owner],
      { cwd: repoRoot }
    );
    await execFileAsync(
      'git',
      ['config', 'user.email', ghUser.email || `${owner}@users.noreply.github.com`],
      { cwd: repoRoot }
    );
    await execFileAsync('git', ['add', '-A'], { cwd: repoRoot });
    try {
      await execFileAsync(
        'git',
        [
          'commit',
          '-m',
          'Full-featured React Jira platform with multi-system real-time sync & Screenshot Importer',
        ],
        { cwd: repoRoot }
      );
    } catch {
      // Nothing new to commit
    }

    const remoteUrl = `https://x-access-token:${encodeURIComponent(
      cleanToken
    )}@github.com/${owner}/${cleanRepo}.git`;

    await execFileAsync(
      'git',
      ['push', '--force', remoteUrl, 'HEAD:refs/heads/main'],
      { cwd: repoRoot }
    );

    res.json({
      success: true,
      owner,
      repoName: cleanRepo,
      repoUrl: `https://github.com/${owner}/${cleanRepo}`,
    });
  } catch (error: unknown) {
    console.error('GitHub push error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to push repository to GitHub';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  await loadDatabaseFromDisk();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jira full-stack multi-system server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
