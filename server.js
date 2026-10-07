import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  createPersonalWorkspaceBundle,
  INITIAL_WORKSPACE_STATE,
} from './src/data/initialWorkspace.js';
import {
  IssueStatus,
  SprintStatus,
} from './src/types/arij.js';

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
  constructor() {
    this.queue = Promise.resolve();
  }

  run(task) {
    const result = this.queue.then(() => task());
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}

const stateMutex = new AsyncMutex();
let authoritativeWorkspace = structuredClone(INITIAL_WORKSPACE_STATE);
let serverRevision = 1;

function ensureAllUsersHavePersonalWorkspace(ws) {
  const nextProjects = [...(ws.projects || [])];
  const nextSprints = [...(ws.sprints || [])];
  const nextIssues = [...(ws.issues || [])];
  let changed = false;

  (ws.users || []).forEach((u) => {
    const exists = nextProjects.some(
      (p) => p.ownerUserId === u.id || p.id === `prj-personal-${u.id}`
    );
    if (!exists) {
      const bundle = createPersonalWorkspaceBundle(u);
      nextProjects.push(bundle.project);
      nextSprints.push(bundle.sprint);
      nextIssues.push(...bundle.issues);
      changed = true;
    }
  });

  if (!changed) return ws;
  return {
    ...ws,
    projects: nextProjects,
    sprints: nextSprints,
    issues: nextIssues,
  };
}

async function loadDatabaseFromDisk() {
  try {
    if (existsSync(DB_FILE_PATH)) {
      const raw = await fs.readFile(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.workspace && Array.isArray(parsed.workspace.projects)) {
        authoritativeWorkspace = ensureAllUsersHavePersonalWorkspace(
          parsed.workspace
        );
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

async function persistDatabaseToDisk() {
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
const connectedClients = new Map();

function getActiveCollaborators() {
  const list = [];
  connectedClients.forEach((client) => {
    list.push({
      clientId: client.clientId,
      userId: client.userId,
      connectedAt: client.connectedAt,
    });
  });
  return list;
}

function broadcastEvent(eventName, payload) {
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
    req.query.clientId ||
    `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const userId = req.query.userId || 'usr-1';

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

  res.write(
    `event: workspace:init\ndata: ${JSON.stringify({
      workspace: authoritativeWorkspace,
      revision: serverRevision,
      collaborators: getActiveCollaborators(),
    })}\n\n`
  );

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
  const { clientId, userId } = req.body || {};
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
function applyMutationEvent(ws, event) {
  const now = new Date().toISOString();
  const { type, payload } = event;

  switch (type) {
    case 'issue:updated': {
      const { issueId, updates, actorId } = payload;
      return {
        ...ws,
        issues: ws.issues.map((iss) => {
          if (iss.id !== issueId) return iss;
          const newHistory = [...iss.history];
          const trackedFields = [
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
      const { issue, projectId, nextCounter } = payload;
      if (ws.issues.some((i) => i.id === issue.id)) {
        return ws;
      }
      const targetProj = ws.projects.find((p) => p.id === projectId);
      let resolvedCounter =
        nextCounter || (targetProj ? targetProj.issueCounter + 1 : 101);
      let resolvedKey = issue.key;

      if (targetProj && ws.issues.some((i) => i.key === resolvedKey)) {
        resolvedCounter = Math.max(
          targetProj.issueCounter + 1,
          resolvedCounter + 1
        );
        resolvedKey = `${targetProj.key}-${resolvedCounter}`;
      }

      const finalIssue = {
        ...issue,
        key: resolvedKey,
      };

      return {
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                issueCounter: Math.max(p.issueCounter + 1, resolvedCounter),
              }
            : p
        ),
        issues: [...ws.issues, finalIssue],
      };
    }

    case 'issue:deleted': {
      const { issueId } = payload;
      return {
        ...ws,
        issues: ws.issues.filter((i) => i.id !== issueId),
      };
    }

    case 'issue:comment_added': {
      const { issueId, comment } = payload;
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
      const { issueId, workLog } = payload;
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
      const { sprint } = payload;
      if (ws.sprints.some((s) => s.id === sprint.id)) return ws;
      return {
        ...ws,
        sprints: [...ws.sprints, sprint],
      };
    }

    case 'sprint:started': {
      const { sprintId, projectId, updates } = payload;
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
      const {
        sprintId,
        destinationSprintId,
        committedPoints,
        completedPoints,
      } = payload;
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
      const { sprintId } = payload;
      return {
        ...ws,
        sprints: ws.sprints.filter((s) => s.id !== sprintId),
        issues: ws.issues.map((i) =>
          i.sprintId === sprintId ? { ...i, sprintId: null } : i
        ),
      };
    }

    case 'release:created': {
      const { release } = payload;
      if (ws.releases.some((r) => r.id === release.id)) return ws;
      return {
        ...ws,
        releases: [...ws.releases, release],
      };
    }

    case 'release:toggled': {
      const { releaseId } = payload;
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
      const { component } = payload;
      if (ws.components.some((c) => c.id === component.id)) return ws;
      return {
        ...ws,
        components: [...ws.components, component],
      };
    }

    case 'project:updated': {
      const { projectId, updates } = payload;
      return {
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === projectId ? { ...p, ...updates } : p
        ),
      };
    }

    case 'project:created': {
      const { project, initialSprint, starterIssue } = payload;
      if (ws.projects.some((p) => p.id === project.id)) return ws;
      return {
        ...ws,
        activeProjectId: project.id,
        projects: [...ws.projects, project],
        sprints: initialSprint ? [...ws.sprints, initialSprint] : ws.sprints,
        issues: starterIssue ? [...ws.issues, starterIssue] : ws.issues,
      };
    }

    case 'user:created': {
      const { user } = payload;
      if (ws.users.some((u) => u.id === user.id)) return ws;
      return ensureAllUsersHavePersonalWorkspace({
        ...ws,
        users: [...ws.users, user],
      });
    }

    case 'filter:saved': {
      const { filter } = payload;
      if (ws.savedFilters.some((f) => f.id === filter.id)) return ws;
      return {
        ...ws,
        savedFilters: [...ws.savedFilters, filter],
      };
    }

    case 'workspace:imported': {
      const { updatedWorkspace } = payload;
      if (!updatedWorkspace) return ws;

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

      return ensureAllUsersHavePersonalWorkspace({
        ...ws,
        activeProjectId: updatedWorkspace.activeProjectId || ws.activeProjectId,
        users: mergedUsers,
        projects: mergedProjects,
        sprints: mergedSprints,
        issues: mergedIssues,
      });
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
    const { clientId, events } = req.body || {};
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
  } catch (err) {
    console.error('Error processing concurrent workspace mutation:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to apply workspace event';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// REST API ENDPOINTS (Section 29: /api/projects, /api/issues, /api/users, /api/sprints, /api/boards)
// ============================================================================
app.get('/api/projects', (_req, res) => {
  res.json(workspaceState.projects || []);
});

app.get('/api/issues', (_req, res) => {
  res.json(workspaceState.issues || []);
});

app.get('/api/users', (_req, res) => {
  res.json(workspaceState.users || []);
});

app.get('/api/sprints', (_req, res) => {
  res.json(workspaceState.sprints || []);
});

app.get('/api/boards', (_req, res) => {
  res.json(
    (workspaceState.projects || []).map((p) => ({
      id: `board-${p.id}`,
      projectId: p.id,
      name: `${p.key} ${p.template} Board`,
      type: p.template,
    }))
  );
});

// ============================================================================
// ARIJ AI PROJECT ASSISTANT & AI ISSUE GENERATOR (Sections 35 & 36)
// ============================================================================
app.post('/api/arij/ai-assistant', async (req, res) => {
  try {
    const { prompt, project, currentUser, issues = [] } = req.body || {};
    const openIssues = issues.filter((i) => i.status !== 'DONE');
    const highBugs = openIssues.filter(
      (i) =>
        i.type === 'BUG' &&
        (i.priority === 'HIGHEST' || i.priority === 'HIGH')
    );
    const myTasks = openIssues.filter(
      (i) => i.assigneeId === currentUser?.id
    );
    const totalPts = issues.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const donePts = issues
      .filter((i) => i.status === 'DONE')
      .reduce((s, i) => s + (i.storyPoints || 0), 0);

    if (process.env.GEMINI_API_KEY) {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are the Arij AI Project Assistant for project "${project?.name}" (${project?.key}), active sprint "${project?.sprintName}".
Active user: ${currentUser?.name}.
Live telemetry: ${donePts} of ${totalPts} story points completed. ${openIssues.length} open issues (${highBugs.length} high-priority bugs).
Issues JSON summary: ${JSON.stringify(issues.slice(0, 18))}

User question: ${prompt}
Respond concisely with actionable bullet points referencing real issue keys (${project?.key}-*).`,
      });
      if (response.text) {
        res.json({ reply: response.text });
        return;
      }
    }

    const nextRecommended = myTasks[0] || openIssues[0];
    res.json({
      reply: `### Arij AI Analysis for ${project?.name || 'Workspace'}\n• **Sprint Progress**: The team has completed **${donePts} of ${totalPts} planned story points** (${openIssues.length} open work items remaining).\n• **Bottlenecks & Risks**: **${highBugs.length} high-priority bug(s)** require immediate triage.\n• **Recommended Next Action for ${currentUser?.name || 'You'}**: Prioritize **${nextRecommended ? `${nextRecommended.key} — ${nextRecommended.title}` : 'sprint review items'}** (${nextRecommended?.priority || 'HIGH'} priority).`,
    });
  } catch (err) {
    res.json({
      reply:
        'Sprint analysis complete: Focus on high-priority items in IN_REVIEW and IN_PROGRESS to maximize sprint completion.',
    });
  }
});

app.post('/api/arij/ai-generate-issue', async (req, res) => {
  try {
    const { prompt, projectKey = 'KAW' } = req.body || {};
    if (process.env.GEMINI_API_KEY) {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a structured Arij work item specification for project ${projectKey} from this brief: "${prompt}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING },
              priority: { type: Type.STRING },
              storyPoints: { type: Type.INTEGER },
              description: { type: Type.STRING },
              labels: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'type', 'priority', 'storyPoints', 'description'],
          },
        },
      });
      if (response.text) {
        res.json(JSON.parse(response.text.trim()));
        return;
      }
    }
    res.json({
      title: prompt,
      type: prompt.toLowerCase().includes('bug') || prompt.toLowerCase().includes('timeout') ? 'BUG' : 'STORY',
      priority: 'HIGH',
      storyPoints: 5,
      description: `### Summary\n${prompt}\n\n### Acceptance Criteria\n1. Verify reproduction steps and edge cases\n2. Add automated test coverage\n3. Validate metrics in staging before production rollout`,
      labels: ['ai-generated', 'triage'],
    });
  } catch {
    res.json({
      title: req.body?.prompt || 'New AI-Generated Work Item',
      type: 'STORY',
      priority: 'HIGH',
      storyPoints: 5,
      description: 'Generated by Arij AI with acceptance criteria and subtask checklist.',
      labels: ['ai-generated'],
    });
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

app.post('/api/arij/extract-screenshot', async (req, res) => {
  try {
    const { images, customInstructions } = req.body || {};

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ error: 'Please upload at least one board screenshot.' });
      return;
    }

    const ai = getGeminiClient();

    const imageParts = images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data,
      },
    }));

    const promptText = `You are an expert Arij Workspace Migration & Computer Vision engine.
Analyze the uploaded board screenshot(s) (which may show a Kanban/Scrum Board, Backlog, Sprint, Issue Detail view, Roadmap, or Team list) and extract EVERY detail accurately so we can recreate the exact same profiles, tasks, statuses, priorities, story points, epics, and task assignments.

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
   - Map each issue's type icon/color to one of: "STORY", "TASK", "BUG", "EPIC", "SUBTASK".
   - Map each issue's priority icon/label to one of: "HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST".
   - Match each issue's assignee (assigneeName and assigneeInitials) to the exact profile seen on that card/row so the task is assigned to that exact user profile!
   - Extract exact issue key (e.g. "ENG-104"), title, description, storyPoints (number), labels (array of strings), epicTitle (if linked to an epic), dueDate (YYYY-MM-DD if visible), and any subtasks.

${customInstructions ? `Additional user instructions: ${customInstructions}` : ''}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [...imageParts, { text: promptText }],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            projectKey: { type: Type.STRING },
            sprintName: { type: Type.STRING },
            sprintGoal: { type: Type.STRING },
            profiles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  initials: { type: Type.STRING },
                  email: { type: Type.STRING },
                  role: { type: Type.STRING },
                  department: { type: Type.STRING },
                },
                required: ['name', 'initials', 'role'],
              },
            },
            epics: {
              type: Type.ARRAY,
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
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING },
                  status: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  assigneeName: { type: Type.STRING },
                  assigneeInitials: { type: Type.STRING },
                  epicTitle: { type: Type.STRING },
                  storyPoints: { type: Type.NUMBER },
                  dueDate: { type: Type.STRING },
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
  } catch (error) {
    console.error('Error extracting board screenshot:', error);
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
    const { token, repoName, isPrivate, description } = req.body || {};

    if (!token || !token.trim()) {
      res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
      return;
    }

    const cleanToken = token.trim();
    const cleanRepo = (repoName || 'arij-javascript-platform')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-');

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'arij-javascript-platform',
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

    const ghUser = await userRes.json();
    const owner = ghUser.login;

    const checkRepoRes = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}`,
      {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'arij-javascript-platform',
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
          'User-Agent': 'arij-javascript-platform',
        },
        body: JSON.stringify({
          name: cleanRepo,
          description:
            description ||
            'Arij — Full-featured Agile Project Management & Screenshot Importer built in React & JavaScript',
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
          'Arij: Full-featured React JavaScript Agile platform with multi-system sync & Page-Wise Split View',
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
  } catch (error) {
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
    console.log(`Arij full-stack JavaScript server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
