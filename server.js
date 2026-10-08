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
const FIREBASE_CONFIG_PATH = path.resolve(__dirname, 'firebase-config.json');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Arij-Peer');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

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
      if (!issue || !issue.id) return ws;
      if (ws.issues.some((i) => i.id === issue.id)) {
        return ws;
      }
      const targetProj =
        ws.projects.find((p) => p.id === (projectId || issue.projectId)) ||
        ws.projects[0];
      const resolvedProjectId = targetProj ? targetProj.id : projectId;
      let resolvedCounter =
        nextCounter || (targetProj ? targetProj.issueCounter + 1 : 101);
      let resolvedKey =
        issue.key ||
        `${targetProj ? targetProj.key : 'KAW'}-${resolvedCounter}`;

      if (targetProj && ws.issues.some((i) => i.key === resolvedKey)) {
        resolvedCounter = Math.max(
          targetProj.issueCounter + 1,
          resolvedCounter + 1
        );
        resolvedKey = `${targetProj.key}-${resolvedCounter}`;
      }

      const activeProjSprint = ws.sprints.find(
        (s) =>
          s.projectId === resolvedProjectId &&
          s.status === SprintStatus.ACTIVE
      );
      const validProjSprint = issue.sprintId
        ? ws.sprints.find(
            (s) => s.id === issue.sprintId && s.projectId === resolvedProjectId
          )
        : null;

      const finalIssue = {
        ...issue,
        isUserCreated: true,
        projectId: resolvedProjectId,
        key: resolvedKey,
        sprintId:
          issue.type === 'EPIC'
            ? null
            : validProjSprint
            ? validProjSprint.id
            : activeProjSprint
            ? activeProjSprint.id
            : issue.sprintId || null,
        assigneeId:
          issue.assigneeId !== undefined
            ? issue.assigneeId
            : ws.currentUserId || 'usr-1',
      };

      return {
        ...ws,
        projects: ws.projects.map((p) =>
          p.id === resolvedProjectId
            ? {
                ...p,
                issueCounter: Math.max(p.issueCounter + 1, resolvedCounter),
              }
            : p
        ),
        issues: [finalIssue, ...ws.issues],
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
        const existingIdx = mergedIssues.findIndex((existing) => existing.id === iss.id);
        if (existingIdx === -1) {
          mergedIssues.unshift({ ...iss, isUserCreated: iss.isUserCreated ?? true });
        } else {
          const existingIss = mergedIssues[existingIdx];
          const existingTime = new Date(existingIss.updatedAt || 0).getTime();
          const incomingTime = new Date(iss.updatedAt || 0).getTime();
          if (incomingTime > existingTime) {
            mergedIssues[existingIdx] = { ...existingIss, ...iss };
          }
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

    if (!req.headers['x-arij-peer']) {
      void pushWorkspaceToSharedFreeDatabase(result.workspace);
    }

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
  res.json(authoritativeWorkspace.projects || []);
});

app.get('/api/issues', (_req, res) => {
  res.json(authoritativeWorkspace.issues || []);
});

app.post('/api/issues', async (req, res) => {
  try {
    const body = req.body || {};
    const targetProj =
      authoritativeWorkspace.projects.find((p) => p.id === body.projectId) ||
      authoritativeWorkspace.projects[0];
    const nextCounter = (targetProj?.issueCounter || 100) + 1;
    const activeSp = authoritativeWorkspace.sprints.find(
      (s) => s.projectId === targetProj.id && s.status === SprintStatus.ACTIVE
    );
    const now = new Date().toISOString();
    const newIssue = {
      id: body.id || `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: targetProj.id,
      key: body.key || `${targetProj.key}-${nextCounter}`,
      title: body.title || 'Untitled Story',
      description: body.description || '',
      type: body.type || 'STORY',
      status: body.status || IssueStatus.TODO,
      priority: body.priority || 'MEDIUM',
      assigneeId: body.assigneeId || authoritativeWorkspace.currentUserId || 'usr-1',
      reporterId: body.reporterId || authoritativeWorkspace.currentUserId || 'usr-1',
      epicId: body.epicId || null,
      sprintId: body.sprintId || (activeSp ? activeSp.id : null),
      storyPoints: Number(body.storyPoints ?? 5),
      originalEstimateHours: Number(body.originalEstimateHours ?? 12),
      timeSpentHours: 0,
      remainingEstimateHours: Number(body.originalEstimateHours ?? 12),
      labels: Array.isArray(body.labels) ? body.labels : ['story'],
      componentId: body.componentId || null,
      fixVersionId: body.fixVersionId || null,
      startDate: now.slice(0, 10),
      dueDate: body.dueDate || '2026-10-22',
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      links: [],
      comments: [],
      workLogs: [],
      history: [],
      watcherIds: [authoritativeWorkspace.currentUserId || 'usr-1'],
      createdAt: now,
      updatedAt: now,
      order: authoritativeWorkspace.issues.length + 1,
    };

    const result = await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'issue:created',
        payload: {
          issue: newIssue,
          projectId: targetProj.id,
          nextCounter,
        },
      });
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
      collaborators: getActiveCollaborators(),
    });

    res.json({ ok: true, issue: newIssue, workspace: result.workspace });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

app.get('/api/users', (_req, res) => {
  res.json(authoritativeWorkspace.users || []);
});

app.get('/api/sprints', (_req, res) => {
  res.json(authoritativeWorkspace.sprints || []);
});

app.get('/api/boards', (_req, res) => {
  res.json(
    (authoritativeWorkspace.projects || []).map((p) => ({
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
// STORY PDF AUTO-EXTRACTOR (Extracts Title, Description, Points, Subtasks, etc. from PDF)
// ============================================================================
function extractReadableTextFromPdfBase64(base64Data) {
  try {
    const buf = Buffer.from(base64Data || '', 'base64');
    const rawLatin = buf.toString('latin1');
    // Extract literal strings inside PDF parentheses (...) and readable ASCII runs
    const literalMatches = [];
    const parenRegex = /\(([^()\\]{3,200})\)/g;
    let m;
    while ((m = parenRegex.exec(rawLatin)) !== null) {
      const cleaned = m[1].replace(/[^\x20-\x7E]/g, ' ').trim();
      if (cleaned.length >= 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
        literalMatches.push(cleaned);
      }
    }
    if (literalMatches.length > 0) {
      return literalMatches.join('\n').slice(0, 12000);
    }
    // Fallback for plain text / markdown files uploaded alongside PDFs
    const utf8Text = buf
      .toString('utf8')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
    return utf8Text.slice(0, 12000);
  } catch {
    return '';
  }
}

function buildFallbackStoryFromText(fileName, rawText, projectKey = 'KAW') {
  const cleanName = (fileName || 'user-story-specification.pdf')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !/^%PDF|obj|endobj|stream|endstream|xref/i.test(l));

  // Detect explicit Title / Summary if present
  const titleLine =
    lines.find((l) => /^(title|summary|story|feature)\s*:/i.test(l)) ||
    lines[0] ||
    cleanName;
  const parsedTitle = titleLine
    .replace(/^(title|summary|story|feature)\s*:\s*/i, '')
    .trim();

  const finalTitle =
    parsedTitle.length >= 4
      ? parsedTitle.charAt(0).toUpperCase() + parsedTitle.slice(1)
      : `Implement ${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}`;

  const bodyLines = lines.slice(1, 25).join('\n');
  const finalDescription =
    bodyLines.length > 20
      ? `### Extracted from Story PDF (${fileName})\n${bodyLines}\n\n### Acceptance Criteria\n- Verify all functional requirements specified in ${fileName}\n- Complete unit and integration test coverage\n- Validate performance and edge cases before QA sign-off`
      : `### User Story Specification (${fileName})\nAs an enterprise user of ${projectKey}, I want **${finalTitle}** implemented according to the uploaded specification PDF so that workflow reliability, telemetry, and acceptance criteria are satisfied.\n\n### Acceptance Criteria\n1. Implement core story workflow and UI/API validation as defined in \`${fileName}\`\n2. Ensure error handling, audit logging, and permission checks are enforced\n3. Add automated test assertions and verify in QA Testing`;

  const lowerAll = `${fileName} ${rawText}`.toLowerCase();
  const inferredType = lowerAll.includes('bug')
    ? 'BUG'
    : lowerAll.includes('epic')
    ? 'EPIC'
    : lowerAll.includes('task')
    ? 'TASK'
    : 'STORY';

  const inferredPriority =
    lowerAll.includes('critical') || lowerAll.includes('highest') || lowerAll.includes('p0')
      ? 'HIGHEST'
      : lowerAll.includes('low')
      ? 'LOW'
      : 'HIGH';

  const storyPoints = 5;
  const originalEstimateHours = 12;

  const subtasks = [
    {
      title: `Design & implement core logic for: ${finalTitle.slice(0, 60)}`,
      completed: false,
    },
    {
      title: `Validate acceptance criteria from ${fileName || 'Story PDF'}`,
      completed: false,
    },
    {
      title: 'Write automated regression tests and complete QA verification',
      completed: false,
    },
  ];

  const singleStory = {
    title: finalTitle,
    description: finalDescription,
    type: inferredType,
    priority: inferredPriority,
    storyPoints,
    originalEstimateHours,
    dueDate: '2026-10-22',
    labels: ['pdf-story', 'auto-extracted', projectKey.toLowerCase()],
    subtasks,
  };

  return {
    ...singleStory,
    stories: [singleStory],
  };
}

app.post('/api/arij/extract-story-pdf', async (req, res) => {
  try {
    const {
      fileName = 'story-spec.pdf',
      mimeType = 'application/pdf',
      fileDataBase64 = '',
      extractedTextHint = '',
      projectKey = 'KAW',
    } = req.body || {};

    if (!fileDataBase64 && !extractedTextHint) {
      res.status(400).json({ error: 'Please upload a Story PDF document.' });
      return;
    }

    const decodedText =
      extractedTextHint || extractReadableTextFromPdfBase64(fileDataBase64);

    if (process.env.GEMINI_API_KEY && fileDataBase64) {
      try {
        const ai = getGeminiClient();
        const parts = [];

        if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: fileDataBase64,
            },
          });
        }

        parts.push({
          text: `You are an expert Arij Agile Product Manager & Story PDF Parser.
Analyze the uploaded Story / PRD PDF document ("${fileName}") for project "${projectKey}".
${decodedText ? `Extracted text stream from document:\n${decodedText.slice(0, 6000)}\n` : ''}

Extract ALL fields needed to populate an Arij Story / Work Item automatically:
1. title: Clear, actionable Story Summary / Title extracted from the document.
2. description: Full structured description including User Story ("As a... I want... So that..."), detailed requirements, and bulleted Acceptance Criteria extracted from the PDF.
3. type: One of "STORY", "TASK", "BUG", "EPIC", "FEATURE", "IMPROVEMENT", "REQUEST". (Default to "STORY").
4. priority: One of "HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST".
5. storyPoints: Integer story points estimate (e.g. 3, 5, 8, 13).
6. originalEstimateHours: Numeric engineering hours estimate (e.g. 8, 12, 16, 24).
7. dueDate: YYYY-MM-DD (if not mentioned, use "2026-10-22").
8. labels: Array of relevant lowercase hyphenated tags (e.g. ["pdf-import", "user-story", "frontend"]).
9. subtasks: Array of actionable child subtasks ({ title, completed: false }) broken down from the document's requirements or acceptance criteria.
10. stories: If the PDF contains multiple stories/tasks, include all of them in the "stories" array (and put the primary/first story in the top-level fields).`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                type: { type: Type.STRING },
                priority: { type: Type.STRING },
                storyPoints: { type: Type.INTEGER },
                originalEstimateHours: { type: Type.NUMBER },
                dueDate: { type: Type.STRING },
                labels: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                stories: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      type: { type: Type.STRING },
                      priority: { type: Type.STRING },
                      storyPoints: { type: Type.INTEGER },
                      originalEstimateHours: { type: Type.NUMBER },
                      dueDate: { type: Type.STRING },
                      labels: { type: Type.ARRAY, items: { type: Type.STRING } },
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
                    required: ['title', 'description', 'type', 'priority'],
                  },
                },
              },
              required: [
                'title',
                'description',
                'type',
                'priority',
                'storyPoints',
                'originalEstimateHours',
                'labels',
                'subtasks',
              ],
            },
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          if (!Array.isArray(parsed.stories) || parsed.stories.length === 0) {
            parsed.stories = [
              {
                title: parsed.title,
                description: parsed.description,
                type: parsed.type || 'STORY',
                priority: parsed.priority || 'HIGH',
                storyPoints: parsed.storyPoints || 5,
                originalEstimateHours: parsed.originalEstimateHours || 12,
                dueDate: parsed.dueDate || '2026-10-22',
                labels: parsed.labels || ['pdf-story'],
                subtasks: parsed.subtasks || [],
              },
            ];
          }
          res.json(parsed);
          return;
        }
      } catch (aiErr) {
        console.warn('Gemini PDF extraction fallback triggered:', aiErr);
      }
    }

    const fallbackResult = buildFallbackStoryFromText(
      fileName,
      decodedText,
      projectKey
    );
    res.json(fallbackResult);
  } catch (error) {
    console.error('Error extracting Story PDF:', error);
    const fallbackResult = buildFallbackStoryFromText(
      req.body?.fileName || 'story.pdf',
      '',
      req.body?.projectKey || 'KAW'
    );
    res.json(fallbackResult);
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
    // Always flush the latest workspace-db.json (including all created stories) to disk before committing
    await persistDatabaseToDisk();

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

// Pull and merge stories/workspace from a friend's GitHub repository (workspace-db.json)
app.post('/api/github/pull-stories', async (req, res) => {
  try {
    const { repoInput, branch = 'main', token = '' } = req.body || {};
    if (!repoInput || !repoInput.trim()) {
      res.status(400).json({
        error: 'Please enter your friend’s GitHub repository (e.g., username/repo-name or full GitHub URL).',
      });
      return;
    }

    const cleaned = repoInput
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '');
    const parts = cleaned.split('/');
    if (parts.length < 2) {
      res.status(400).json({
        error: 'Repository must be in the format "owner/repo" or "https://github.com/owner/repo".',
      });
      return;
    }
    const owner = parts[0];
    const repo = parts[1];

    const headers = {
      Accept: 'application/vnd.github.v3.raw',
      'User-Agent': 'arij-javascript-platform',
    };
    if (token && token.trim()) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/workspace-db.json?ref=${encodeURIComponent(
      branch || 'main'
    )}`;
    const ghRes = await fetch(apiUrl, { headers });
    if (!ghRes.ok) {
      res.status(404).json({
        error: `Could not find workspace-db.json in ${owner}/${repo} (${branch}). Make sure your friend pushed their repo or paste their exported JSON directly.`,
      });
      return;
    }

    const remoteData = await ghRes.json();
    const remoteWs = remoteData.workspace || remoteData;
    if (!remoteWs || !Array.isArray(remoteWs.issues)) {
      res.status(400).json({
        error: 'Remote workspace-db.json did not contain a valid issues array.',
      });
      return;
    }

    const beforeCount = authoritativeWorkspace.issues.length;
    const result = await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'workspace:imported',
        payload: { updatedWorkspace: remoteWs },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
      return {
        workspace: authoritativeWorkspace,
        revision: serverRevision,
      };
    });

    const addedCount = Math.max(0, result.workspace.issues.length - beforeCount);
    broadcastEvent('workspace:sync', {
      workspace: result.workspace,
      revision: result.revision,
      collaborators: getActiveCollaborators(),
    });

    res.json({
      ok: true,
      owner,
      repo,
      addedCount,
      totalIssues: result.workspace.issues.length,
      workspace: result.workspace,
      revision: result.revision,
    });
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Failed to pull stories from GitHub repository.',
    });
  }
});

// ============================================================================
// FIREBASE SPARK FREE PLAN ($0/MO) + SHARED TEAM CLOUD SYNC ENGINE
// Guarantees 100% Free Tier usage (single-document coalescing + daily quota guard)
// and stores config in Git-tracked firebase-config.json so any friend who clones
// the repository can watch and add stories without owner login or a paid plan.
// ============================================================================
let firebaseFreeConfig = {
  plan: 'SPARK_FREE_TIER_ONLY',
  billingRequired: false,
  enabled: true,
  provider: 'firebase_spark_and_cloud_hub',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || '',
  apiKey: process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || '',
  appId: process.env.VITE_FIREBASE_APP_ID || '',
  collectionName: 'arij_shared_workspace',
  documentId: 'main',
  remoteHubUrl:
    process.env.APP_URL ||
    'https://ais-pre-7xgyqayxy5qqaqfqzqmoor-237735571835.asia-southeast1.run.app',
  allowTeamWatchAndAdd: true,
};

const sparkQuotaTracker = {
  dayKey: new Date().toISOString().slice(0, 10),
  readsToday: 0,
  writesToday: 0,
  maxDailyReads: 45000,
  maxDailyWrites: 18000,
  freeTierReadLimit: 50000,
  freeTierWriteLimit: 20000,
  lastSyncAt: null,
  lastSyncSource: 'Local + Shared Hub',
};

function checkSparkQuota(opType = 'read') {
  const today = new Date().toISOString().slice(0, 10);
  if (sparkQuotaTracker.dayKey !== today) {
    sparkQuotaTracker.dayKey = today;
    sparkQuotaTracker.readsToday = 0;
    sparkQuotaTracker.writesToday = 0;
  }
  if (opType === 'write') {
    if (sparkQuotaTracker.writesToday >= sparkQuotaTracker.maxDailyWrites) {
      return false;
    }
    sparkQuotaTracker.writesToday += 1;
    return true;
  }
  if (sparkQuotaTracker.readsToday >= sparkQuotaTracker.maxDailyReads) {
    return false;
  }
  sparkQuotaTracker.readsToday += 1;
  return true;
}

async function loadFirebaseConfigFromDisk() {
  try {
    if (existsSync(FIREBASE_CONFIG_PATH)) {
      const raw = await fs.readFile(FIREBASE_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        firebaseFreeConfig = {
          ...firebaseFreeConfig,
          ...parsed,
          plan: 'SPARK_FREE_TIER_ONLY',
          billingRequired: false,
        };
      }
    } else {
      await saveFirebaseConfigToDisk();
    }
  } catch (err) {
    console.warn('Could not read firebase-config.json:', err);
  }
}

async function saveFirebaseConfigToDisk() {
  try {
    const payload = JSON.stringify(
      {
        ...firebaseFreeConfig,
        plan: 'SPARK_FREE_TIER_ONLY',
        billingRequired: false,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    );
    await fs.writeFile(FIREBASE_CONFIG_PATH, payload, 'utf-8');
  } catch (err) {
    console.warn('Could not write firebase-config.json:', err);
  }
}

async function pushWorkspaceToSharedFreeDatabase(ws) {
  try {
    const compactPayload = {
      updatedAt: new Date().toISOString(),
      revision: serverRevision,
      workspace: ws,
    };

    // 1. Firebase Realtime Database Free Tier (if databaseURL configured)
    if (firebaseFreeConfig.databaseURL && checkSparkQuota('write')) {
      const cleanDbUrl = firebaseFreeConfig.databaseURL.replace(/\/+$/, '');
      await fetch(`${cleanDbUrl}/arij_shared_workspace.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compactPayload),
      }).catch(() => {});
      sparkQuotaTracker.lastSyncAt = compactPayload.updatedAt;
      sparkQuotaTracker.lastSyncSource = 'Firebase Realtime DB (Spark Free)';
    }

    // 2. Cloud Firestore Free Tier Single-Document Coalesced Sync (1 write per sync!)
    if (firebaseFreeConfig.projectId && checkSparkQuota('write')) {
      const keyParam = firebaseFreeConfig.apiKey
        ? `?key=${encodeURIComponent(firebaseFreeConfig.apiKey)}`
        : '';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        firebaseFreeConfig.projectId
      )}/databases/(default)/documents/arij_shared_workspace/main${keyParam}`;
      const workspaceJson = JSON.stringify(ws).slice(0, 890000);
      await fetch(firestoreUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            workspaceJson: { stringValue: workspaceJson },
            updatedAt: { stringValue: compactPayload.updatedAt },
            revision: { integerValue: String(serverRevision) },
          },
        }),
      }).catch(() => {});
      sparkQuotaTracker.lastSyncAt = compactPayload.updatedAt;
      sparkQuotaTracker.lastSyncSource = 'Cloud Firestore (Spark Free)';
    }

    // 3. Shared Arij Cloud Hub Sync (so friends running localhost automatically push to the shared hub!)
    const hubUrl = (firebaseFreeConfig.remoteHubUrl || '').replace(/\/+$/, '');
    const selfUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
    if (hubUrl && hubUrl.startsWith('http') && hubUrl !== selfUrl) {
      await fetch(`${hubUrl}/api/workspace/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arij-Peer': 'true',
        },
        body: JSON.stringify({
          clientId: 'peer-sync',
          events: [
            {
              type: 'workspace:imported',
              payload: { updatedWorkspace: ws },
            },
          ],
        }),
      }).catch(() => {});
    }
  } catch {
    // Non-fatal background sync
  }
}

async function pullWorkspaceFromSharedFreeDatabase() {
  let pulledCount = 0;

  // 1. Pull from Firebase Realtime Database Free Tier if configured
  if (firebaseFreeConfig.databaseURL && checkSparkQuota('read')) {
    try {
      const cleanDbUrl = firebaseFreeConfig.databaseURL.replace(/\/+$/, '');
      const rtRes = await fetch(`${cleanDbUrl}/arij_shared_workspace.json`);
      if (rtRes.ok) {
        const rtData = await rtRes.json();
        const remoteWs = rtData?.workspace || rtData;
        if (remoteWs && Array.isArray(remoteWs.issues)) {
          await stateMutex.run(async () => {
            authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
              type: 'workspace:imported',
              payload: { updatedWorkspace: remoteWs },
            });
            serverRevision += 1;
            await persistDatabaseToDisk();
          });
          pulledCount += remoteWs.issues.length;
          sparkQuotaTracker.lastSyncAt = new Date().toISOString();
          sparkQuotaTracker.lastSyncSource = 'Firebase Realtime DB (Spark Free)';
        }
      }
    } catch {
      // Ignore network error
    }
  }

  // 2. Pull from Cloud Firestore Free Tier Single-Document Coalesced Sync
  if (firebaseFreeConfig.projectId && checkSparkQuota('read')) {
    try {
      const keyParam = firebaseFreeConfig.apiKey
        ? `?key=${encodeURIComponent(firebaseFreeConfig.apiKey)}`
        : '';
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        firebaseFreeConfig.projectId
      )}/databases/(default)/documents/arij_shared_workspace/main${keyParam}`;
      const fsRes = await fetch(firestoreUrl);
      if (fsRes.ok) {
        const fsDoc = await fsRes.json();
        const rawJson = fsDoc?.fields?.workspaceJson?.stringValue;
        if (rawJson) {
          const remoteWs = JSON.parse(rawJson);
          if (remoteWs && Array.isArray(remoteWs.issues)) {
            await stateMutex.run(async () => {
              authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
                type: 'workspace:imported',
                payload: { updatedWorkspace: remoteWs },
              });
              serverRevision += 1;
              await persistDatabaseToDisk();
            });
            pulledCount += remoteWs.issues.length;
            sparkQuotaTracker.lastSyncAt = new Date().toISOString();
            sparkQuotaTracker.lastSyncSource = 'Cloud Firestore (Spark Free)';
          }
        }
      }
    } catch {
      // Ignore network error
    }
  }

  // 3. Pull from Shared Arij Cloud Hub (when friend runs localhost)
  const hubUrl = (firebaseFreeConfig.remoteHubUrl || '').replace(/\/+$/, '');
  const selfUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  if (hubUrl && hubUrl.startsWith('http') && hubUrl !== selfUrl) {
    try {
      const hubRes = await fetch(`${hubUrl}/api/workspace`, {
        headers: { 'X-Arij-Peer': 'true' },
      });
      if (hubRes.ok) {
        const hubData = await hubRes.json();
        const remoteWs = hubData?.workspace;
        if (remoteWs && Array.isArray(remoteWs.issues)) {
          await stateMutex.run(async () => {
            authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
              type: 'workspace:imported',
              payload: { updatedWorkspace: remoteWs },
            });
            serverRevision += 1;
            await persistDatabaseToDisk();
          });
          pulledCount += remoteWs.issues.length;
          sparkQuotaTracker.lastSyncAt = new Date().toISOString();
        }
      }
    } catch {
      // Ignore network error
    }
  }

  broadcastEvent('workspace:sync', {
    workspace: authoritativeWorkspace,
    revision: serverRevision,
    collaborators: getActiveCollaborators(),
  });

  return pulledCount;
}

app.get('/api/firebase/status', (_req, res) => {
  res.json({
    ok: true,
    config: firebaseFreeConfig,
    quotaStats: {
      ...sparkQuotaTracker,
      totalSharedIssues: authoritativeWorkspace.issues.length,
    },
  });
});

app.post('/api/firebase/config', async (req, res) => {
  try {
    const body = req.body || {};
    firebaseFreeConfig = {
      ...firebaseFreeConfig,
      projectId:
        body.projectId !== undefined ? String(body.projectId).trim() : firebaseFreeConfig.projectId,
      apiKey:
        body.apiKey !== undefined ? String(body.apiKey).trim() : firebaseFreeConfig.apiKey,
      databaseURL:
        body.databaseURL !== undefined
          ? String(body.databaseURL).trim()
          : firebaseFreeConfig.databaseURL,
      authDomain:
        body.authDomain !== undefined
          ? String(body.authDomain).trim()
          : firebaseFreeConfig.authDomain,
      appId:
        body.appId !== undefined ? String(body.appId).trim() : firebaseFreeConfig.appId,
      remoteHubUrl:
        body.remoteHubUrl !== undefined
          ? String(body.remoteHubUrl).trim()
          : firebaseFreeConfig.remoteHubUrl,
      plan: 'SPARK_FREE_TIER_ONLY',
      billingRequired: false,
    };

    await saveFirebaseConfigToDisk();
    await pullWorkspaceFromSharedFreeDatabase();
    await pushWorkspaceToSharedFreeDatabase(authoritativeWorkspace);

    res.json({
      ok: true,
      config: firebaseFreeConfig,
      workspace: authoritativeWorkspace,
      revision: serverRevision,
      quotaStats: {
        ...sparkQuotaTracker,
        totalSharedIssues: authoritativeWorkspace.issues.length,
      },
    });
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error ? err.message : 'Failed to save Firebase Free-Tier configuration',
    });
  }
});

app.post('/api/firebase/sync-now', async (req, res) => {
  try {
    const { direction = 'both' } = req.body || {};
    if (direction === 'pull' || direction === 'both') {
      await pullWorkspaceFromSharedFreeDatabase();
    }
    if (direction === 'push' || direction === 'both') {
      await pushWorkspaceToSharedFreeDatabase(authoritativeWorkspace);
    }
    res.json({
      ok: true,
      workspace: authoritativeWorkspace,
      revision: serverRevision,
      quotaStats: {
        ...sparkQuotaTracker,
        totalSharedIssues: authoritativeWorkspace.issues.length,
      },
      message: `Synced with Shared Free Database (${authoritativeWorkspace.issues.length} total stories active across all views).`,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to sync with shared database',
    });
  }
});

async function startServer() {
  await loadDatabaseFromDisk();
  await loadFirebaseConfigFromDisk();
  void pullWorkspaceFromSharedFreeDatabase();

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
