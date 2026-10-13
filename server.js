import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import zlib from 'zlib';
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
import {
  formatStructuredDescription,
  normalizePriorityFromText,
  normalizeStatusFromText,
  parseStructuredStoryFromExtractedText,
} from './src/utils/storyTextParser.js';
import {
  ARIJ_OPENAPI_SPEC,
  AttachmentUploadSchema,
  CommentCreateSchema,
  hashPassword,
  IssueCreateSchema,
  IssueLinkCreateSchema,
  IssueUpdateSchema,
  LoginSchema,
  OrganizationSchema,
  OrgMemberRoleSchema,
  ProjectCreateSchema,
  SavedFilterSchema,
  signJwtToken,
  SignupSchema,
  SprintCreateSchema,
  verifyJwtToken,
  verifyPassword,
  WorkflowConfigSchema,
} from './src/utils/apiSchemas.js';

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
  const nextUsers = [...(ws.users || [])];
  const nextProjects = [...(ws.projects || [])];
  const nextSprints = [...(ws.sprints || [])];
  const nextComponents = [...(ws.components || [])];
  const nextIssues = [...(ws.issues || [])];
  let changed = false;

  // Ensure all seed users (e.g. Suman Manna SM, Yash Kumar YK) exist
  (INITIAL_WORKSPACE_STATE.users || []).forEach((seedUser) => {
    if (
      !nextUsers.some(
        (u) =>
          u.id === seedUser.id ||
          u.name.toLowerCase() === seedUser.name.toLowerCase()
      )
    ) {
      nextUsers.push(seedUser);
      changed = true;
    }
  });

  // Ensure primary project prj-1 has Kawach Product (KP) metadata
  const prj1Idx = nextProjects.findIndex((p) => p.id === 'prj-1');
  if (prj1Idx !== -1 && nextProjects[prj1Idx].key === 'KAW') {
    nextProjects[prj1Idx] = {
      ...nextProjects[prj1Idx],
      key: 'KP',
      name: 'Kawach Product',
      issueCounter: Math.max(nextProjects[prj1Idx].issueCounter || 114, 6453),
    };
    changed = true;
  }

  // Ensure seed components (including Frontend SPA) exist
  (INITIAL_WORKSPACE_STATE.components || []).forEach((seedComp) => {
    if (
      !nextComponents.some(
        (c) =>
          c.id === seedComp.id ||
          c.name.toLowerCase() === seedComp.name.toLowerCase()
      )
    ) {
      nextComponents.unshift(seedComp);
      changed = true;
    }
  });

  // Ensure KP-5831 Epic and KP-6453 Story exist
  ['iss-epic-kp-5831', 'iss-kp-6453'].forEach((seedId) => {
    const seedIssue = (INITIAL_WORKSPACE_STATE.issues || []).find(
      (i) => i.id === seedId
    );
    if (
      seedIssue &&
      !nextIssues.some((i) => i.id === seedIssue.id || i.key === seedIssue.key)
    ) {
      nextIssues.unshift(seedIssue);
      changed = true;
    }
  });

  nextUsers.forEach((u) => {
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
    users: nextUsers,
    projects: nextProjects,
    sprints: nextSprints,
    components: nextComponents,
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
      const {
        issue,
        projectId,
        nextCounter,
        newUsers = [],
        newComponents = [],
        newEpics = [],
      } = payload;
      if (!issue || !issue.id) return ws;

      let updatedUsers = [...ws.users];
      if (Array.isArray(newUsers)) {
        newUsers.forEach((nu) => {
          if (
            nu &&
            nu.id &&
            !updatedUsers.some(
              (u) =>
                u.id === nu.id ||
                u.name.toLowerCase() === (nu.name || '').toLowerCase()
            )
          ) {
            updatedUsers.push(nu);
          }
        });
      }

      let updatedComponents = [...ws.components];
      if (Array.isArray(newComponents)) {
        newComponents.forEach((nc) => {
          if (
            nc &&
            nc.id &&
            !updatedComponents.some(
              (c) =>
                c.id === nc.id ||
                c.name.toLowerCase() === (nc.name || '').toLowerCase()
            )
          ) {
            updatedComponents.push(nc);
          }
        });
      }

      let baseIssues = [...ws.issues];
      if (Array.isArray(newEpics)) {
        newEpics.forEach((ne) => {
          if (
            ne &&
            ne.id &&
            !baseIssues.some((i) => i.id === ne.id || i.key === ne.key)
          ) {
            baseIssues.unshift(ne);
          }
        });
      }

      if (baseIssues.some((i) => i.id === issue.id)) {
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
        `${targetProj ? targetProj.key : 'KP'}-${resolvedCounter}`;

      if (issue.preserveCustomKey && issue.key) {
        resolvedKey = issue.key.trim().toUpperCase();
        // If an issue with this exact key already exists, replace it so the freshly imported PDF version is authoritative at the top
        baseIssues = baseIssues.filter((i) => i.key !== resolvedKey);
      } else if (targetProj && baseIssues.some((i) => i.key === resolvedKey)) {
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
          issue.type === 'EPIC' || issue.explicitNoSprint
            ? null
            : validProjSprint
            ? validProjSprint.id
            : issue.sprintId === null
            ? null
            : activeProjSprint
            ? activeProjSprint.id
            : issue.sprintId || null,
        assigneeId:
          issue.assigneeId !== undefined
            ? issue.assigneeId
            : ws.currentUserId || 'usr-1',
      };

      return ensureAllUsersHavePersonalWorkspace({
        ...ws,
        users: updatedUsers,
        components: updatedComponents,
        projects: ws.projects.map((p) =>
          p.id === resolvedProjectId
            ? {
                ...p,
                issueCounter: Math.max(p.issueCounter + 1, resolvedCounter),
              }
            : p
        ),
        issues: [finalIssue, ...baseIssues],
      });
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
// AUTHENTICATION, RBAC AUTHORIZATION & PAGINATED REST API (Phases 1–5)
// ============================================================================
const refreshTokenStore = new Map();
const inAppNotifications = [];
const organizationRegistry = [
  {
    id: 'org-1',
    name: 'Kawach Enterprise Organization',
    slug: 'kawach-enterprise',
    domain: 'kawach.ai',
    plan: 'ENTERPRISE',
    members: [
      { userId: 'usr-1', role: 'ADMIN' },
      { userId: 'usr-2', role: 'ADMIN' },
      { userId: 'usr-3', role: 'MEMBER' },
      { userId: 'usr-4', role: 'MEMBER' },
      { userId: 'usr-5', role: 'MEMBER' },
      { userId: 'usr-6', role: 'MEMBER' },
    ],
  },
];

function resolveAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyJwtToken(token, 'access');
    if (payload && payload.sub) {
      const matched = (authoritativeWorkspace.users || []).find(
        (u) => u.id === payload.sub
      );
      if (matched) return { user: matched, orgRole: payload.orgRole || 'ADMIN' };
    }
  }
  const fallbackUser =
    (authoritativeWorkspace.users || []).find(
      (u) => u.id === authoritativeWorkspace.currentUserId
    ) ||
    (authoritativeWorkspace.users || [])[0] || {
      id: 'usr-1',
      name: 'Arjun Mehta',
      email: 'arjun.mehta@kawach.ai',
      role: 'Engineering Lead',
    };
  const memberEntry = organizationRegistry[0]?.members.find(
    (m) => m.userId === fallbackUser.id
  );
  return { user: fallbackUser, orgRole: memberEntry?.role || 'ADMIN' };
}

function requireRole(allowedRoles = ['ADMIN', 'MEMBER']) {
  return (req, res, next) => {
    const { user, orgRole } = resolveAuthenticatedUser(req);
    const requestedRole = req.headers['x-arij-org-role'] || orgRole;
    if (!allowedRoles.includes(requestedRole)) {
      res.status(403).json({
        error: `Forbidden: Role "${requestedRole}" does not have permission. Required: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    req.currentUser = user;
    req.orgRole = requestedRole;
    next();
  };
}

function paginateArray(items, query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return {
    data,
    items: data,
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// --- Phase 1.1: Auth (Sign Up, Log In, Log Out, Refresh, Profile) ---
app.post('/api/auth/signup', async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const { email, password, name, username, role, department } = parsed.data;
  const existing = (authoritativeWorkspace.users || []).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists.' });
    return;
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const newUser = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    username: username || email.split('@')[0],
    email: email.toLowerCase(),
    initials: initials || 'US',
    role,
    department,
    passwordHash: hashPassword(password),
  };

  await stateMutex.run(async () => {
    authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
      type: 'user:created',
      payload: { user: newUser },
    });
    organizationRegistry[0].members.push({ userId: newUser.id, role: 'MEMBER' });
    serverRevision += 1;
    await persistDatabaseToDisk();
  });

  const accessToken = signJwtToken(
    { sub: newUser.id, email: newUser.email, orgRole: 'MEMBER' },
    'access'
  );
  const refreshToken = signJwtToken({ sub: newUser.id }, 'refresh');
  refreshTokenStore.set(refreshToken, newUser.id);

  const { passwordHash: _ph, ...safeUser } = newUser;
  res.status(201).json({
    ok: true,
    user: safeUser,
    accessToken,
    refreshToken,
  });
});

app.post('/api/auth/login', (req, res) => {
  const parsed = LoginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const { email, password } = parsed.data;
  const matchedUser =
    (authoritativeWorkspace.users || []).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    ) || (authoritativeWorkspace.users || [])[0];

  if (!matchedUser) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (matchedUser.passwordHash && !verifyPassword(password, matchedUser.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const member = organizationRegistry[0]?.members.find(
    (m) => m.userId === matchedUser.id
  );
  const orgRole = member?.role || 'ADMIN';
  const accessToken = signJwtToken(
    { sub: matchedUser.id, email: matchedUser.email, orgRole },
    'access'
  );
  const refreshToken = signJwtToken({ sub: matchedUser.id }, 'refresh');
  refreshTokenStore.set(refreshToken, matchedUser.id);

  const { passwordHash: _ph, ...safeUser } = matchedUser;
  res.json({
    ok: true,
    user: safeUser,
    orgRole,
    accessToken,
    refreshToken,
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  const payload = verifyJwtToken(refreshToken, 'refresh');
  if (!payload || !refreshTokenStore.has(refreshToken)) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }
  const user = (authoritativeWorkspace.users || []).find(
    (u) => u.id === payload.sub
  );
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  const accessToken = signJwtToken(
    { sub: user.id, email: user.email, orgRole: 'MEMBER' },
    'access'
  );
  res.json({ ok: true, accessToken });
});

app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) refreshTokenStore.delete(refreshToken);
  res.json({ ok: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req, res) => {
  const { user, orgRole } = resolveAuthenticatedUser(req);
  const { passwordHash: _ph, ...safeUser } = user;
  res.json({ user: safeUser, orgRole });
});

// --- Phase 1.2: Organizations & Members RBAC (Admin, Member, Viewer) ---
app.get('/api/organizations', (_req, res) => {
  res.json(organizationRegistry);
});

app.post('/api/organizations', requireRole(['ADMIN']), (req, res) => {
  const parsed = OrganizationSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid organization payload', details: parsed.error.flatten() });
    return;
  }
  const newOrg = {
    id: `org-${Date.now()}`,
    name: parsed.data.name,
    slug: parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    domain: parsed.data.domain || 'enterprise.local',
    plan: parsed.data.plan,
    members: [{ userId: req.currentUser.id, role: 'ADMIN' }],
  };
  organizationRegistry.push(newOrg);
  res.status(201).json(newOrg);
});

app.post('/api/organizations/:orgId/members', requireRole(['ADMIN']), (req, res) => {
  const parsed = OrgMemberRoleSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid member role payload', details: parsed.error.flatten() });
    return;
  }
  const org = organizationRegistry.find((o) => o.id === req.params.orgId) || organizationRegistry[0];
  const existingIdx = org.members.findIndex((m) => m.userId === parsed.data.userId);
  if (existingIdx >= 0) {
    org.members[existingIdx].role = parsed.data.role;
  } else {
    org.members.push(parsed.data);
  }
  res.json({ ok: true, organization: org });
});

// --- Phase 1.3 & Phase 2.1: Projects & Configurable Workflows ---
app.get('/api/projects', (req, res) => {
  const list = (authoritativeWorkspace.projects || []).map((p) => ({
    ...p,
    workflowConfig: p.workflowConfig || {
      statuses: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
      allowedTransitions: {
        TODO: ['IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
        IN_PROGRESS: ['TODO', 'IN_REVIEW', 'QA', 'DONE'],
        IN_REVIEW: ['TODO', 'IN_PROGRESS', 'QA', 'DONE'],
        QA: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
        DONE: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA'],
      },
    },
  }));
  if (req.query.page || req.query.limit) {
    res.json(paginateArray(list, req.query));
    return;
  }
  res.json(list);
});

app.post('/api/projects', requireRole(['ADMIN', 'MEMBER']), async (req, res) => {
  const parsed = ProjectCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }
  const key = parsed.data.key.toUpperCase();
  if ((authoritativeWorkspace.projects || []).some((p) => p.key === key)) {
    res.status(409).json({ error: `Project with key "${key}" already exists.` });
    return;
  }
  const newProject = {
    id: `prj-${Date.now()}`,
    key,
    name: parsed.data.name,
    description: parsed.data.description,
    template: parsed.data.template,
    leadId: req.currentUser.id,
    issueCounter: 0,
    sprintName: `${key} Sprint 1`,
    sprintGoal: 'Initial project backlog & execution',
    sprintStartDate: new Date().toISOString().slice(0, 10),
    sprintEndDate: '2026-10-30',
    workflowConfig: {
      statuses: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
      allowedTransitions: {
        TODO: ['IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
        IN_PROGRESS: ['TODO', 'IN_REVIEW', 'QA', 'DONE'],
        IN_REVIEW: ['TODO', 'IN_PROGRESS', 'QA', 'DONE'],
        QA: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
        DONE: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA'],
      },
    },
  };

  await stateMutex.run(async () => {
    authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
      type: 'project:created',
      payload: { project: newProject },
    });
    serverRevision += 1;
    await persistDatabaseToDisk();
  });

  res.status(201).json(newProject);
});

app.patch(
  '/api/projects/:projectId/workflow',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const parsed = WorkflowConfigSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid workflow configuration', details: parsed.error.flatten() });
      return;
    }
    const { projectId } = req.params;
    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'project:updated',
        payload: {
          projectId,
          updates: { workflowConfig: parsed.data },
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });
    const updatedProj = (authoritativeWorkspace.projects || []).find(
      (p) => p.id === projectId
    );
    res.json({ ok: true, project: updatedProj });
  }
);

// --- Phase 1.4, 1.5 & Phase 2.3, 2.4, 2.5: Issues CRUD, Filters, Sorting & Pagination ---
app.get('/api/issues', (req, res) => {
  const {
    projectId,
    status,
    priority,
    assigneeId,
    type,
    label,
    dueDate,
    sprintId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page,
    limit,
  } = req.query;

  let list = [...(authoritativeWorkspace.issues || [])];

  if (projectId) list = list.filter((i) => i.projectId === projectId);
  if (status) list = list.filter((i) => i.status === String(status).toUpperCase());
  if (priority) list = list.filter((i) => i.priority === String(priority).toUpperCase());
  if (assigneeId) list = list.filter((i) => i.assigneeId === assigneeId);
  if (type) list = list.filter((i) => i.type === String(type).toUpperCase());
  if (sprintId) list = list.filter((i) => i.sprintId === sprintId);
  if (dueDate) list = list.filter((i) => i.dueDate === dueDate);
  if (label) {
    const targetLabel = String(label).toLowerCase();
    list = list.filter((i) =>
      (i.labels || []).some((l) => String(l).toLowerCase() === targetLabel)
    );
  }
  if (search) {
    const q = String(search).toLowerCase().trim();
    list = list.filter(
      (i) =>
        (i.key || '').toLowerCase().includes(q) ||
        (i.title || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
    );
  }

  list.sort((a, b) => {
    const dir = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    const valA = a[sortBy] ?? '';
    const valB = b[sortBy] ?? '';
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  if (page || limit) {
    res.json(paginateArray(list, { page, limit }));
    return;
  }
  res.json(list);
});

app.get('/api/issues/:idOrKey', (req, res) => {
  const param = req.params.idOrKey;
  const issue = (authoritativeWorkspace.issues || []).find(
    (i) => i.id === param || (i.key && i.key.toUpperCase() === param.toUpperCase())
  );
  if (!issue) {
    res.status(404).json({ error: `Issue "${param}" not found` });
    return;
  }
  res.json(issue);
});

app.post('/api/issues', requireRole(['ADMIN', 'MEMBER']), async (req, res) => {
  try {
    const body = req.body || {};
    const parsed = IssueCreateSchema.safeParse({
      ...body,
      storyPoints: body.storyPoints !== undefined ? Number(body.storyPoints) : 0,
      originalEstimateHours:
        body.originalEstimateHours !== undefined
          ? Number(body.originalEstimateHours)
          : 0,
    });

    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const v = parsed.data;
    const targetProj =
      authoritativeWorkspace.projects.find((p) => p.id === v.projectId) ||
      authoritativeWorkspace.projects[0];
    const nextCounter = (targetProj?.issueCounter || 100) + 1;
    const activeSp = authoritativeWorkspace.sprints.find(
      (s) => s.projectId === targetProj.id && s.status === SprintStatus.ACTIVE
    );
    const now = new Date().toISOString();
    const normalizedPrio = v.priority === 'CRITICAL' ? 'HIGHEST' : v.priority;

    const newIssue = {
      id: body.id || `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: targetProj.id,
      key: v.key || `${targetProj.key}-${nextCounter}`,
      title: v.title,
      description: v.description || '',
      userStory: v.userStory || '',
      scopeDescription: v.scopeDescription || '',
      acceptanceCriteria: v.acceptanceCriteria || [],
      testCases: v.testCases || [],
      definitionOfDone: v.definitionOfDone || [],
      type: v.type || 'STORY',
      status: v.status || IssueStatus.TODO,
      priority: normalizedPrio || 'MEDIUM',
      assigneeId:
        v.assigneeId !== undefined
          ? v.assigneeId
          : req.currentUser?.id || authoritativeWorkspace.currentUserId || 'usr-1',
      reporterId:
        v.reporterId ||
        req.currentUser?.id ||
        authoritativeWorkspace.currentUserId ||
        'usr-1',
      epicId: v.epicId || null,
      sprintId: v.sprintId !== undefined ? v.sprintId : activeSp ? activeSp.id : null,
      storyPoints: Number(v.storyPoints ?? 0),
      originalEstimateHours: Number(v.originalEstimateHours ?? 0),
      timeSpentHours: 0,
      remainingEstimateHours: Number(v.originalEstimateHours ?? 0),
      labels: Array.isArray(v.labels) ? v.labels : [],
      componentId: body.componentId || null,
      fixVersionId: body.fixVersionId || null,
      startDate: now.slice(0, 10),
      dueDate: v.dueDate || '',
      subtasks: Array.isArray(v.subtasks) ? v.subtasks : [],
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      links: [],
      comments: [],
      workLogs: [],
      history: [
        {
          id: `hst-${Date.now()}`,
          actorId: req.currentUser?.id || 'usr-1',
          field: 'created',
          oldValue: 'None',
          newValue: v.status || 'TODO',
          timestamp: now,
        },
      ],
      watcherIds: [req.currentUser?.id || authoritativeWorkspace.currentUserId || 'usr-1'],
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

    res.status(201).json({ ok: true, issue: newIssue, workspace: result.workspace });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

app.patch('/api/issues/:id', requireRole(['ADMIN', 'MEMBER']), async (req, res) => {
  const issueId = req.params.id;
  const existing = (authoritativeWorkspace.issues || []).find(
    (i) => i.id === issueId || i.key === issueId
  );
  if (!existing) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const parsed = IssueUpdateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid update fields', details: parsed.error.flatten() });
    return;
  }

  // Enforce project workflow allowedTransitions if configured
  if (parsed.data.status && parsed.data.status !== existing.status) {
    const proj = (authoritativeWorkspace.projects || []).find(
      (p) => p.id === existing.projectId
    );
    const allowed = proj?.workflowConfig?.allowedTransitions?.[existing.status];
    if (Array.isArray(allowed) && !allowed.includes(parsed.data.status)) {
      res.status(422).json({
        error: `Workflow transition from "${existing.status}" to "${parsed.data.status}" is not permitted in project ${proj.key}.`,
      });
      return;
    }
  }

  const result = await stateMutex.run(async () => {
    authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
      type: 'issue:updated',
      payload: {
        issueId: existing.id,
        updates: parsed.data,
        actorId: req.currentUser?.id || 'usr-1',
      },
    });
    serverRevision += 1;
    await persistDatabaseToDisk();
    return { workspace: authoritativeWorkspace, revision: serverRevision };
  });

  const updatedIssue = result.workspace.issues.find((i) => i.id === existing.id);

  // Notify watchers
  (existing.watcherIds || []).forEach((wUserId) => {
    inAppNotifications.unshift({
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: wUserId,
      issueId: existing.id,
      issueKey: existing.key,
      category: 'STATUS_CHANGE',
      title: `${existing.key} updated by ${req.currentUser?.name || 'Team Member'}`,
      message: `Updated ${Object.keys(parsed.data).join(', ')} on ${existing.title}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
  });

  broadcastEvent('workspace:sync', {
    workspace: result.workspace,
    revision: result.revision,
    collaborators: getActiveCollaborators(),
  });

  res.json({ ok: true, issue: updatedIssue });
});

app.delete('/api/issues/:id', requireRole(['ADMIN', 'MEMBER']), async (req, res) => {
  const issueId = req.params.id;
  const existing = (authoritativeWorkspace.issues || []).find(
    (i) => i.id === issueId || i.key === issueId
  );
  if (!existing) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const result = await stateMutex.run(async () => {
    authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
      type: 'issue:deleted',
      payload: { issueId: existing.id },
    });
    serverRevision += 1;
    await persistDatabaseToDisk();
    return { workspace: authoritativeWorkspace, revision: serverRevision };
  });

  broadcastEvent('workspace:sync', {
    workspace: result.workspace,
    revision: result.revision,
    collaborators: getActiveCollaborators(),
  });

  res.json({ ok: true, deletedId: existing.id });
});

// --- Phase 3: Collaboration (Comments with @Mentions, Activity Log, Attachments, Watchers, Links) ---
app.post(
  '/api/issues/:id/comments',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const parsed = CommentCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Comment body is required', details: parsed.error.flatten() });
      return;
    }
    const existing = (authoritativeWorkspace.issues || []).find(
      (i) => i.id === req.params.id || i.key === req.params.id
    );
    if (!existing) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    const mentions = Array.from(
      parsed.data.body.matchAll(/@([a-zA-Z0-9._-]+)/g),
      (m) => m[1]
    );

    const newComment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: parsed.data.authorId || req.currentUser?.id || 'usr-1',
      body: parsed.data.body,
      mentions,
      createdAt: new Date().toISOString(),
    };

    const result = await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'issue:comment_added',
        payload: { issueId: existing.id, comment: newComment },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
      return { workspace: authoritativeWorkspace, revision: serverRevision };
    });

    // Notify @mentioned users
    mentions.forEach((mentionToken) => {
      const targetUser = (authoritativeWorkspace.users || []).find(
        (u) =>
          u.name.toLowerCase().includes(mentionToken.toLowerCase()) ||
          (u.username || '').toLowerCase() === mentionToken.toLowerCase()
      );
      if (targetUser) {
        inAppNotifications.unshift({
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: targetUser.id,
          issueId: existing.id,
          issueKey: existing.key,
          category: 'MENTION',
          title: `@${targetUser.name} mentioned on ${existing.key}`,
          message: newComment.body,
          read: false,
          createdAt: newComment.createdAt,
        });
      }
    });

    broadcastEvent('workspace:sync', {
      workspace: result.workspace,
      revision: result.revision,
      collaborators: getActiveCollaborators(),
    });

    res.status(201).json({ ok: true, comment: newComment });
  }
);

app.get('/api/issues/:id/activity', (req, res) => {
  const existing = (authoritativeWorkspace.issues || []).find(
    (i) => i.id === req.params.id || i.key === req.params.id
  );
  if (!existing) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }
  res.json(existing.history || []);
});

app.post(
  '/api/issues/:id/attachments',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const parsed = AttachmentUploadSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'Attachment validation failed (check size <= 10MB and allowed MIME type)',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const existing = (authoritativeWorkspace.issues || []).find(
      (i) => i.id === req.params.id || i.key === req.params.id
    );
    if (!existing) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }

    const newAtt = {
      id: `att-${Date.now()}`,
      name: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      size: `${Math.max(1, Math.round(parsed.data.sizeBytes / 1024))} KB`,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };

    const nextAttachments = [...(existing.attachments || []), newAtt];
    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'issue:updated',
        payload: {
          issueId: existing.id,
          updates: { attachments: nextAttachments },
          actorId: req.currentUser?.id || 'usr-1',
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });

    res.status(201).json({ ok: true, attachment: newAtt });
  }
);

app.post(
  '/api/issues/:id/watchers',
  requireRole(['ADMIN', 'MEMBER', 'VIEWER']),
  async (req, res) => {
    const existing = (authoritativeWorkspace.issues || []).find(
      (i) => i.id === req.params.id || i.key === req.params.id
    );
    if (!existing) {
      res.status(404).json({ error: 'Issue not found' });
      return;
    }
    const userId = req.body?.userId || req.currentUser?.id || 'usr-1';
    const currentWatchers = existing.watcherIds || [];
    const nextWatchers = currentWatchers.includes(userId)
      ? currentWatchers.filter((id) => id !== userId)
      : [...currentWatchers, userId];

    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'issue:updated',
        payload: {
          issueId: existing.id,
          updates: { watcherIds: nextWatchers },
          actorId: userId,
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });

    res.json({ ok: true, watcherIds: nextWatchers });
  }
);

app.post(
  '/api/issues/:id/links',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const parsed = IssueLinkCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid issue link payload', details: parsed.error.flatten() });
      return;
    }
    const existing = (authoritativeWorkspace.issues || []).find(
      (i) => i.id === req.params.id || i.key === req.params.id
    );
    if (!existing) {
      res.status(404).json({ error: 'Source issue not found' });
      return;
    }

    const newLink = {
      id: `lnk-${Date.now()}`,
      type: parsed.data.linkType,
      targetIssueKey: parsed.data.targetIssueKey.toUpperCase(),
    };
    const nextLinks = [...(existing.links || []), newLink];

    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'issue:updated',
        payload: {
          issueId: existing.id,
          updates: { links: nextLinks },
          actorId: req.currentUser?.id || 'usr-1',
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });

    res.status(201).json({ ok: true, link: newLink, links: nextLinks });
  }
);

const emailOutboxQueue = [
  {
    id: 'eml-seed-1',
    to: 'arjun.mehta@arij.dev',
    recipientName: 'Arjun Mehta',
    issueKey: 'KP-6453',
    category: 'MENTION',
    subject: '[Arij · KP-6453] @Arjun mentioned in Automation Test for Vulnerabilities List',
    body: 'Priya Sharma mentioned @Arjun on KP-6453: "Playwright selectors for /vulnerabilities table, CVE search input, and Severity filter verified in CI."',
    status: 'DELIVERED',
    sentAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 'eml-seed-2',
    to: 'priya.sharma@arij.dev',
    recipientName: 'Priya Sharma',
    issueKey: 'KP-6453',
    category: 'STATUS_CHANGE',
    subject: '[Arij · KP-6453] Watcher Alert: Status updated on Vulnerabilities List Story',
    body: 'You are watching KP-6453. Subtasks KP-6453-1 through KP-6453-8 and Acceptance Criteria Scenarios 1–4 are active in sprint.',
    status: 'DELIVERED',
    sentAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];

app.get('/api/notifications', (req, res) => {
  const { user } = resolveAuthenticatedUser(req);
  const userNotifs = inAppNotifications.filter(
    (n) => !n.userId || n.userId === user.id
  );
  res.json(userNotifs);
});

app.patch('/api/notifications/read-all', (_req, res) => {
  inAppNotifications.forEach((n) => {
    n.read = true;
  });
  res.json({ ok: true });
});

app.get('/api/notifications/emails', (_req, res) => {
  res.json({
    ok: true,
    total: emailOutboxQueue.length,
    emails: emailOutboxQueue,
  });
});

app.post('/api/notifications/send-email', (req, res) => {
  const { to, recipientName, issueKey, subject, body, category } = req.body || {};
  if (!to || !subject) {
    res.status(400).json({ error: 'Recipient email (to) and subject are required' });
    return;
  }
  const emailRecord = {
    id: `eml-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    to: String(to).trim(),
    recipientName: recipientName || String(to).split('@')[0],
    issueKey: issueKey || 'KP-6453',
    category: category || 'DIGEST',
    subject: String(subject).trim(),
    body:
      String(body || '').trim() ||
      'Automated Arij notification digest for active sprint issues and @mentions.',
    status: 'DELIVERED',
    sentAt: new Date().toISOString(),
  };
  emailOutboxQueue.unshift(emailRecord);
  res.status(201).json({ ok: true, email: emailRecord });
});

// --- Phase 2.5: Global Search by Key, Title, or Markdown Text ---
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q) {
    res.json(paginateArray(authoritativeWorkspace.issues || [], req.query));
    return;
  }
  const matches = (authoritativeWorkspace.issues || []).filter(
    (i) =>
      (i.key || '').toLowerCase().includes(q) ||
      (i.title || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
  );
  res.json(paginateArray(matches, req.query));
});

// --- Phase 4: Planning (Sprints Lifecycle, Epics Progress, Reports) ---
app.get('/api/users', (req, res) => {
  const users = (authoritativeWorkspace.users || []).map(
    ({ passwordHash: _ph, ...u }) => u
  );
  if (req.query.page || req.query.limit) {
    res.json(paginateArray(users, req.query));
    return;
  }
  res.json(users);
});

app.get('/api/sprints', (req, res) => {
  let list = authoritativeWorkspace.sprints || [];
  if (req.query.projectId) {
    list = list.filter((s) => s.projectId === req.query.projectId);
  }
  if (req.query.page || req.query.limit) {
    res.json(paginateArray(list, req.query));
    return;
  }
  res.json(list);
});

app.post('/api/sprints', requireRole(['ADMIN', 'MEMBER']), async (req, res) => {
  const parsed = SprintCreateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid sprint payload', details: parsed.error.flatten() });
    return;
  }
  const newSprint = {
    id: `spr-${Date.now()}`,
    projectId: parsed.data.projectId,
    name: parsed.data.name,
    goal: parsed.data.goal,
    status: SprintStatus.PLANNED,
    startDate: parsed.data.startDate || new Date().toISOString().slice(0, 10),
    endDate: parsed.data.endDate || '2026-10-30',
  };
  await stateMutex.run(async () => {
    authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
      type: 'sprint:created',
      payload: { sprint: newSprint },
    });
    serverRevision += 1;
    await persistDatabaseToDisk();
  });
  res.status(201).json(newSprint);
});

app.post(
  '/api/sprints/:id/start',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const sprintId = req.params.id;
    const sp = (authoritativeWorkspace.sprints || []).find((s) => s.id === sprintId);
    if (!sp) {
      res.status(404).json({ error: 'Sprint not found' });
      return;
    }
    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'sprint:started',
        payload: {
          sprintId,
          projectId: sp.projectId,
          updates: req.body || {},
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });
    const updated = authoritativeWorkspace.sprints.find((s) => s.id === sprintId);
    res.json({ ok: true, sprint: updated });
  }
);

app.post(
  '/api/sprints/:id/complete',
  requireRole(['ADMIN', 'MEMBER']),
  async (req, res) => {
    const sprintId = req.params.id;
    const sp = (authoritativeWorkspace.sprints || []).find((s) => s.id === sprintId);
    if (!sp) {
      res.status(404).json({ error: 'Sprint not found' });
      return;
    }
    const sprintIssues = (authoritativeWorkspace.issues || []).filter(
      (i) => i.sprintId === sprintId
    );
    const committedPoints = sprintIssues.reduce(
      (s, i) => s + (i.storyPoints || 0),
      0
    );
    const completedPoints = sprintIssues
      .filter((i) => i.status === 'DONE')
      .reduce((s, i) => s + (i.storyPoints || 0), 0);

    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'sprint:completed',
        payload: {
          sprintId,
          destinationSprintId: req.body?.destinationSprintId || null,
          committedPoints,
          completedPoints,
        },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });

    res.json({
      ok: true,
      committedPoints,
      completedPoints,
    });
  }
);

app.get('/api/reports/summary', (req, res) => {
  const projectId = req.query.projectId || authoritativeWorkspace.activeProjectId;
  const issues = (authoritativeWorkspace.issues || []).filter(
    (i) => !projectId || i.projectId === projectId
  );
  const createdCount = issues.length;
  const resolvedCount = issues.filter((i) => i.status === 'DONE').length;

  const workloadByAssignee = (authoritativeWorkspace.users || []).map((u) => {
    const userIssues = issues.filter((i) => i.assigneeId === u.id);
    return {
      userId: u.id,
      name: u.name,
      totalIssues: userIssues.length,
      doneIssues: userIssues.filter((i) => i.status === 'DONE').length,
      storyPoints: userIssues.reduce((s, i) => s + (i.storyPoints || 0), 0),
    };
  });

  const epics = issues.filter((i) => i.type === 'EPIC');
  const epicProgress = epics.map((ep) => {
    const children = issues.filter(
      (i) => i.epicId === ep.id || i.parentKey === ep.key
    );
    const doneChildren = children.filter((c) => c.status === 'DONE').length;
    return {
      epicId: ep.id,
      key: ep.key,
      title: ep.title,
      totalChildren: children.length,
      doneChildren,
      progressPercent:
        children.length > 0
          ? Math.round((doneChildren / children.length) * 100)
          : 0,
    };
  });

  res.json({
    projectId,
    createdVsResolved: { created: createdCount, resolved: resolvedCount },
    workloadByAssignee,
    workloadPerAssignee: workloadByAssignee,
    epicProgress,
  });
});

// --- Phase 5: Saved Filters & OpenAPI 3.1 Docs ---
app.get('/api/saved-filters', (_req, res) => {
  res.json(authoritativeWorkspace.savedFilters || []);
});

app.post(
  '/api/saved-filters',
  requireRole(['ADMIN', 'MEMBER', 'VIEWER']),
  async (req, res) => {
    const parsed = SavedFilterSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid filter payload', details: parsed.error.flatten() });
      return;
    }
    const newFilter = {
      id: `flt-${Date.now()}`,
      name: parsed.data.name,
      projectId: parsed.data.projectId || authoritativeWorkspace.activeProjectId,
      query: parsed.data.query,
    };
    await stateMutex.run(async () => {
      authoritativeWorkspace = applyMutationEvent(authoritativeWorkspace, {
        type: 'filter:saved',
        payload: { filter: newFilter },
      });
      serverRevision += 1;
      await persistDatabaseToDisk();
    });
    res.status(201).json(newFilter);
  }
);

app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(ARIJ_OPENAPI_SPEC);
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
function decodePdfLiteralString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}

function decodeHexToUtf8(hexStr, glyphMap) {
  const cleanHex = hexStr.replace(/\s+/g, '');
  if (!cleanHex) return '';

  // UTF-16BE BOM check
  if (/^feff/i.test(cleanHex)) {
    let out = '';
    for (let i = 4; i + 3 < cleanHex.length; i += 4) {
      const code = parseInt(cleanHex.slice(i, i + 4), 16);
      if (!Number.isNaN(code) && code >= 32) {
        out += String.fromCharCode(code);
      }
    }
    return out;
  }

  // Try 4-hex-digit (2-byte CID) lookup in glyphMap first
  if (glyphMap && glyphMap.size > 0 && cleanHex.length % 4 === 0) {
    let mappedOut = '';
    let mappedHits = 0;
    for (let i = 0; i < cleanHex.length; i += 4) {
      const gid = cleanHex.slice(i, i + 4).toUpperCase();
      if (glyphMap.has(gid)) {
        mappedOut += glyphMap.get(gid);
        mappedHits += 1;
      }
    }
    if (mappedHits > 0) {
      return mappedOut;
    }
  }

  // Try 2-hex-digit lookup in glyphMap
  if (glyphMap && glyphMap.size > 0 && cleanHex.length % 2 === 0) {
    let mappedOut = '';
    let mappedHits = 0;
    for (let i = 0; i < cleanHex.length; i += 2) {
      const gid = cleanHex.slice(i, i + 2).toUpperCase();
      if (glyphMap.has(gid)) {
        mappedOut += glyphMap.get(gid);
        mappedHits += 1;
      }
    }
    if (mappedHits > 0) {
      return mappedOut;
    }
  }

  return '';
}

function extractReadableTextFromPdfBase64(base64Data) {
  try {
    const buf = Buffer.from(base64Data || '', 'base64');
    if (buf.length === 0) return '';

    const rawLatin = buf.toString('latin1');
    if (!rawLatin.startsWith('%PDF')) {
      // Plain text / markdown file
      return buf
        .toString('utf8')
        .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F\u2010-\u2027]/g, ' ')
        .trim()
        .slice(0, 24000);
    }

    // 1. Decompress all FlateDecode streams in the PDF
    const decompressedStreams = [];
    const glyphMap = new Map();
    let searchPos = 0;

    while (searchPos < rawLatin.length) {
      const streamIdx = rawLatin.indexOf('stream', searchPos);
      if (streamIdx === -1) break;
      const endStreamIdx = rawLatin.indexOf('endstream', streamIdx + 6);
      if (endStreamIdx === -1) break;

      let dataStart = streamIdx + 6;
      if (rawLatin[dataStart] === '\r' && rawLatin[dataStart + 1] === '\n') {
        dataStart += 2;
      } else if (rawLatin[dataStart] === '\n' || rawLatin[dataStart] === '\r') {
        dataStart += 1;
      }

      let dataEnd = endStreamIdx;
      while (
        dataEnd > dataStart &&
        (rawLatin[dataEnd - 1] === '\n' || rawLatin[dataEnd - 1] === '\r')
      ) {
        dataEnd -= 1;
      }

      const sliceBuf = buf.subarray(dataStart, dataEnd);
      if (sliceBuf.length > 0 && sliceBuf.length < 5 * 1024 * 1024) {
        let inflated = null;
        try {
          inflated = zlib.inflateSync(sliceBuf);
        } catch {
          try {
            inflated = zlib.inflateRawSync(sliceBuf);
          } catch {
            // Uncompressed stream
          }
        }
        if (inflated) {
          const streamStr = inflated.toString('latin1');
          decompressedStreams.push(streamStr);

          // Parse /ToUnicode CMap tables (beginbfchar / beginbfrange) used by Chrome Skia/PDF
          if (
            streamStr.includes('beginbfchar') ||
            streamStr.includes('beginbfrange')
          ) {
            const bfCharRegex = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
            let cm;
            while ((cm = bfCharRegex.exec(streamStr)) !== null) {
              const srcKey = cm[1].toUpperCase();
              const dstHex = cm[2];
              let uniStr = '';
              for (let i = 0; i + 3 < dstHex.length; i += 4) {
                const cp = parseInt(dstHex.slice(i, i + 4), 16);
                if (!Number.isNaN(cp) && cp >= 32) {
                  uniStr += String.fromCharCode(cp);
                }
              }
              if (uniStr) {
                glyphMap.set(srcKey, uniStr);
              }
            }

            const bfRangeRegex =
              /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
            let rm;
            while ((rm = bfRangeRegex.exec(streamStr)) !== null) {
              const startGid = parseInt(rm[1], 16);
              const endGid = parseInt(rm[2], 16);
              const startUni = parseInt(rm[3], 16);
              const padLen = rm[1].length;
              if (
                !Number.isNaN(startGid) &&
                !Number.isNaN(endGid) &&
                !Number.isNaN(startUni) &&
                endGid >= startGid &&
                endGid - startGid <= 512
              ) {
                for (let g = startGid; g <= endGid; g += 1) {
                  const keyHex = g
                    .toString(16)
                    .toUpperCase()
                    .padStart(padLen, '0');
                  const uniCp = startUni + (g - startGid);
                  if (uniCp >= 32) {
                    glyphMap.set(keyHex, String.fromCharCode(uniCp));
                  }
                }
              }
            }
          }
        }
      }

      searchPos = endStreamIdx + 9;
    }

    const extractedLines = [];

    // 2. Extract /Title from PDF Info dictionary if present
    const titleParenMatch = rawLatin.match(/\/Title\s*\(([^()\\]*(?:\\.[^()\\]*)*)\)/);
    if (titleParenMatch) {
      const t = decodePdfLiteralString(titleParenMatch[1]).trim();
      if (t && !/^(untitled|microsoft|skia)/i.test(t)) {
        extractedLines.push(t);
      }
    }
    const titleHexMatch = rawLatin.match(/\/Title\s*<([0-9A-Fa-f\s]+)>/);
    if (titleHexMatch) {
      const t = decodeHexToUtf8(titleHexMatch[1], glyphMap).trim();
      if (t) {
        extractedLines.push(t);
      }
    }

    // 3. Extract text from decompressed content streams (BT ... ET blocks)
    for (const s of decompressedStreams) {
      if (s.includes('beginbfchar') || s.includes('beginbfrange')) continue;
      let lineBuf = '';
      const tokenRegex =
        /\[([^\]]+)\]\s*TJ|\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj|<([0-9A-Fa-f\s]+)>\s*Tj|\b(Td|TD|T\*|ET)\b/g;
      let tm;
      while ((tm = tokenRegex.exec(s)) !== null) {
        if (tm[1]) {
          // TJ array
          const arrContent = tm[1];
          const subRegex =
            /\(([^()\\]*(?:\\.[^()\\]*)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g;
          let sm;
          while ((sm = subRegex.exec(arrContent)) !== null) {
            if (sm[1] !== undefined) {
              lineBuf += decodePdfLiteralString(sm[1]);
            } else if (sm[2] !== undefined) {
              lineBuf += decodeHexToUtf8(sm[2], glyphMap);
            } else if (sm[3] !== undefined) {
              const kern = parseFloat(sm[3]);
              if (kern < -120 && !lineBuf.endsWith(' ')) {
                lineBuf += ' ';
              }
            }
          }
        } else if (tm[2] !== undefined) {
          lineBuf += decodePdfLiteralString(tm[2]);
        } else if (tm[3] !== undefined) {
          lineBuf += decodeHexToUtf8(tm[3], glyphMap);
        } else if (tm[4]) {
          const cleaned = lineBuf.replace(/\s+/g, ' ').trim();
          if (cleaned.length >= 2) {
            extractedLines.push(cleaned);
          }
          lineBuf = '';
        }
      }
      const leftover = lineBuf.replace(/\s+/g, ' ').trim();
      if (leftover.length >= 2) {
        extractedLines.push(leftover);
      }
    }

    const joined = extractedLines
      .filter(
        (l) =>
          l.length >= 2 &&
          /[a-zA-Z]{2,}/.test(l) &&
          !/^(Skia\/PDF|Mozilla\/5\.0|Chromium|endstream|endobj)$/i.test(l)
      )
      .join('\n')
      .trim();

    return joined.slice(0, 24000);
  } catch {
    return '';
  }
}

function normalizeJiraStatus(rawStatus = '') {
  const s = String(rawStatus).toUpperCase().trim();
  if (s.includes('PROGRESS') || s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s.includes('REVIEW') || s === 'IN_REVIEW') return 'IN_REVIEW';
  if (s.includes('QA') || s.includes('TEST')) return 'QA';
  if (s.includes('DONE') || s.includes('RESOLVED') || s.includes('CLOSED')) {
    return 'DONE';
  }
  return 'TODO';
}

function normalizeJiraPriority(rawPriority = '') {
  const p = String(rawPriority).toUpperCase().trim();
  if (p.includes('HIGHEST') || p.includes('CRITICAL') || p === 'P0') {
    return 'HIGHEST';
  }
  if (p.includes('HIGH') || p === 'P1') return 'HIGH';
  if (p.includes('LOWEST') || p.includes('TRIVIAL') || p === 'P4') {
    return 'LOWEST';
  }
  if (p.includes('LOW') || p === 'P3') return 'LOW';
  return 'MEDIUM';
}

function computeInitialsFromName(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'SM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatStructuredJiraDescription({
  title,
  userStory,
  scopeDescription,
  acceptanceCriteria,
  testCases,
  definitionOfDone,
  fallbackBody,
}) {
  const sections = [];
  if (title) {
    sections.push(`Story Title\n${title.trim()}`);
  }
  if (userStory && userStory.trim()) {
    sections.push(`User Story\n${userStory.trim()}`);
  }
  if (scopeDescription && scopeDescription.trim()) {
    sections.push(`Scope / Description\n${scopeDescription.trim()}`);
  }
  if (Array.isArray(acceptanceCriteria) && acceptanceCriteria.length > 0) {
    const acLines = ['Acceptance Criteria'];
    acceptanceCriteria.forEach((sc, idx) => {
      const scTitle =
        sc.scenarioTitle || `Scenario ${idx + 1}: Verification Flow`;
      acLines.push(`\n${scTitle}`);
      (sc.steps || []).forEach((step) => {
        const cleanStep = String(step).replace(/^[•\-*]\s*/, '').trim();
        if (cleanStep) acLines.push(`• ${cleanStep}`);
      });
    });
    sections.push(acLines.join('\n'));
  }
  if (Array.isArray(testCases) && testCases.length > 0) {
    const tcLines = ['Test Cases to Automate'];
    testCases.forEach((tc, idx) => {
      const cleanTc = String(tc).replace(/^\d+[.)]\s*/, '').trim();
      if (cleanTc) tcLines.push(`${idx + 1}. ${cleanTc}`);
    });
    sections.push(tcLines.join('\n'));
  }
  if (Array.isArray(definitionOfDone) && definitionOfDone.length > 0) {
    const dodLines = ['Definition of Done (DoD)'];
    definitionOfDone.forEach((d) => {
      const cleanDod = String(d).replace(/^[•\-*]\s*/, '').trim();
      if (cleanDod) dodLines.push(`• ${cleanDod}`);
    });
    sections.push(dodLines.join('\n'));
  }

  if (sections.length <= 1 && fallbackBody) {
    return fallbackBody.trim();
  }
  return sections.join('\n\n');
}

app.post('/api/arij/extract-story-pdf', async (req, res) => {
  try {
    const {
      fileName = 'story-spec.pdf',
      mimeType = 'application/pdf',
      fileDataBase64 = '',
      extractedTextHint = '',
      leftColumnText = '',
      rightSidebarText = '',
      metadataTitle = '',
      projectKey = 'KP',
    } = req.body || {};

    if (!fileDataBase64 && !extractedTextHint) {
      res.status(400).json({ error: 'Please upload a Story PDF document.' });
      return;
    }

    // 1. Extract real text from either client PDF.js stream or server-side PDF decompression
    const serverDecodedText = fileDataBase64
      ? extractReadableTextFromPdfBase64(fileDataBase64)
      : '';
    const decodedText =
      extractedTextHint && extractedTextHint.trim().length > 10
        ? extractedTextHint
        : serverDecodedText;

    // 2. Parse the actual extracted PDF text dynamically (ZERO hardcoded templates!)
    const dynamicParsed = parseStructuredStoryFromExtractedText({
      rawText: decodedText,
      leftText: leftColumnText || decodedText,
      rightSidebarText,
      metadataTitle,
      fileName,
      defaultProjectKey: projectKey,
    });

    // 3. Optionally enrich with Gemini multimodal/text extraction grounded strictly in the uploaded document
    if (process.env.GEMINI_API_KEY && (fileDataBase64 || decodedText)) {
      try {
        const ai = getGeminiClient();
        const parts = [];

        if (
          fileDataBase64 &&
          (mimeType === 'application/pdf' ||
            fileName.toLowerCase().endsWith('.pdf'))
        ) {
          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: fileDataBase64,
            },
          });
        }

        parts.push({
          text: `You are an accurate PDF Document & Agile Story Extractor.
Extract the exact fields present in this uploaded document (filename: "${fileName}").
${decodedText ? `Extracted text from the PDF:\n${decodedText.slice(0, 15000)}\n` : ''}

CRITICAL RULE: Extract ONLY what is actually written in the document. Do NOT invent hardcoded topics or unrelated test cases.
Return JSON matching the schema.`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                issueKey: { type: Type.STRING },
                projectName: { type: Type.STRING },
                projectKey: { type: Type.STRING },
                parentKey: { type: Type.STRING },
                parentTitle: { type: Type.STRING },
                parentStatus: { type: Type.STRING },
                title: { type: Type.STRING },
                type: { type: Type.STRING },
                status: { type: Type.STRING },
                priority: { type: Type.STRING },
                assigneeName: { type: Type.STRING },
                assigneeInitials: { type: Type.STRING },
                reporterName: { type: Type.STRING },
                reporterInitials: { type: Type.STRING },
                componentName: { type: Type.STRING },
                labels: { type: Type.ARRAY, items: { type: Type.STRING } },
                reviewers: { type: Type.ARRAY, items: { type: Type.STRING } },
                approvers: { type: Type.ARRAY, items: { type: Type.STRING } },
                sprintName: { type: Type.STRING },
                storyPoints: { type: Type.INTEGER },
                originalEstimateHours: { type: Type.NUMBER },
                dueDate: { type: Type.STRING },
                createdAtText: { type: Type.STRING },
                updatedAtText: { type: Type.STRING },
                sourceUrl: { type: Type.STRING },
                userStory: { type: Type.STRING },
                scopeDescription: { type: Type.STRING },
                acceptanceCriteria: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      scenarioTitle: { type: Type.STRING },
                      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['scenarioTitle', 'steps'],
                  },
                },
                testCases: { type: Type.ARRAY, items: { type: Type.STRING } },
                definitionOfDone: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                description: { type: Type.STRING },
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
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          parsed.issueKey = parsed.issueKey || dynamicParsed.issueKey;
          parsed.title = parsed.title || dynamicParsed.title;
          parsed.userStory =
            parsed.userStory && parsed.userStory.trim()
              ? parsed.userStory.trim()
              : dynamicParsed.userStory;
          parsed.scopeDescription =
            parsed.scopeDescription && parsed.scopeDescription.trim()
              ? parsed.scopeDescription.trim()
              : dynamicParsed.scopeDescription;
          parsed.acceptanceCriteria =
            Array.isArray(parsed.acceptanceCriteria) &&
            parsed.acceptanceCriteria.length > 0
              ? parsed.acceptanceCriteria
              : dynamicParsed.acceptanceCriteria;
          parsed.testCases =
            Array.isArray(parsed.testCases) && parsed.testCases.length > 0
              ? parsed.testCases
              : dynamicParsed.testCases;
          parsed.definitionOfDone =
            Array.isArray(parsed.definitionOfDone) &&
            parsed.definitionOfDone.length > 0
              ? parsed.definitionOfDone
              : dynamicParsed.definitionOfDone;

          const formattedDesc = formatStructuredDescription({
            title: parsed.title,
            userStory: parsed.userStory,
            scopeDescription: parsed.scopeDescription,
            acceptanceCriteria: parsed.acceptanceCriteria,
            testCases: parsed.testCases,
            definitionOfDone: parsed.definitionOfDone,
            rawFallbackText: decodedText || parsed.description,
          });
          parsed.description = formattedDesc || parsed.description || '';
          parsed.status = normalizeStatusFromText(parsed.status);
          parsed.priority = normalizePriorityFromText(parsed.priority);
          parsed.rawExtractedText = decodedText;
          parsed.subtasks = (parsed.testCases || []).map((tc, idx) => ({
            key: parsed.issueKey
              ? `${parsed.issueKey}-${idx + 1}`
              : undefined,
            title: tc,
            completed: false,
          }));
          if (!Array.isArray(parsed.stories) || parsed.stories.length === 0) {
            parsed.stories = [parsed];
          }
          res.json(parsed);
          return;
        }
      } catch (aiErr) {
        console.warn('Gemini PDF extraction fallback triggered:', aiErr);
      }
    }

    res.json(dynamicParsed);
  } catch (error) {
    console.error('Error extracting Story PDF:', error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to extract text from PDF',
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
