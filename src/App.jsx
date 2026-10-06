import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  FolderGit2,
  Kanban,
  Layers,
  ListFilter,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  NavigationTab,
  SprintStatus,
} from './types/jira.js';
import {
  createPersonalWorkspaceBundle,
  INITIAL_WORKSPACE_STATE,
} from './data/initialWorkspace.js';
import { IssueTypeIcon, UserAvatar } from './components/JiraPrimitives.jsx';
import { BoardView } from './components/BoardView.jsx';
import { BacklogView } from './components/BacklogView.jsx';
import { TimelineView } from './components/TimelineView.jsx';
import { IssuesNavigatorView } from './components/IssuesNavigatorView.jsx';
import { ReportsView } from './components/ReportsView.jsx';
import { ReleasesAndComponentsView } from './components/ReleasesAndComponentsView.jsx';
import { ProjectSettingsView } from './components/ProjectSettingsView.jsx';
import { MyWorkspaceView } from './components/MyWorkspaceView.jsx';
import {
  CompleteSprintModal,
  CreateIssueModal,
  CreateProjectModal,
  StartSprintModal,
} from './components/ActionModals.jsx';
import { IssueDetailModal } from './components/IssueDetailModal.jsx';
import { ScreenshotImporterModal } from './components/ScreenshotImporterModal.jsx';
import { GitHubPushModal } from './components/GitHubPushModal.jsx';

const STORAGE_KEY = 'arij_enterprise_workspace_js_v2';
const CLIENT_ID_KEY = 'arij_system_client_id_v2';
const SESSION_USER_KEY = 'arij_session_user_id_v2';
const SESSION_PROJECT_KEY = 'arij_session_project_id_v2';

function getOrCreateClientId() {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const generated = `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem(CLIENT_ID_KEY, generated);
    return generated;
  } catch {
    return `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}

/**
 * Ensures every user in the workspace has a dedicated personal project and sprint.
 */
function ensurePersonalWorkspacesForAllUsers(ws) {
  let updated = false;
  const nextProjects = [...(ws.projects || [])];
  const nextSprints = [...(ws.sprints || [])];
  const nextIssues = [...(ws.issues || [])];
  const nextTodos = { ...(ws.personalTodosByUser || {}) };

  (ws.users || []).forEach((u) => {
    const hasPersonalProj = nextProjects.some(
      (p) => p.ownerUserId === u.id || p.id === `prj-personal-${u.id}`
    );
    if (!hasPersonalProj) {
      const bundle = createPersonalWorkspaceBundle(u);
      nextProjects.push(bundle.project);
      nextSprints.push(bundle.sprint);
      nextIssues.push(...bundle.issues);
      updated = true;
    }
    if (!nextTodos[u.id]) {
      nextTodos[u.id] = [
        {
          id: `todo-init-${u.id}`,
          text: `Review ${u.name}'s sprint tasks and board priorities`,
          done: false,
        },
      ];
      updated = true;
    }
  });

  if (!updated) return ws;
  return {
    ...ws,
    projects: nextProjects,
    sprints: nextSprints,
    issues: nextIssues,
    personalTodosByUser: nextTodos,
  };
}

export default function App() {
  const clientIdRef = useRef(getOrCreateClientId());
  const pendingEventsRef = useRef([]);
  const revisionRef = useRef(0);

  // Per-user isolation filter: 'ALL' (Shared + Personal) or 'MY_OWN' (Strictly current user's own workspace & tasks)
  const [workspaceScopeMode, setWorkspaceScopeMode] = useState('ALL');

  const [workspace, setWorkspace] = useState(() => {
    let baseState = INITIAL_WORKSPACE_STATE;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.issues)) {
          baseState = ensurePersonalWorkspacesForAllUsers(parsed);
        }
      }
    } catch {
      // Fallback to initial state
    }

    try {
      const sessionUser = sessionStorage.getItem(SESSION_USER_KEY);
      const sessionProject = sessionStorage.getItem(SESSION_PROJECT_KEY);
      return {
        ...baseState,
        currentUserId:
          sessionUser && baseState.users.some((u) => u.id === sessionUser)
            ? sessionUser
            : baseState.currentUserId,
        activeProjectId:
          sessionProject && baseState.projects.some((p) => p.id === sessionProject)
            ? sessionProject
            : baseState.activeProjectId,
      };
    } catch {
      return baseState;
    }
  });

  const [collaborators, setCollaborators] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      sessionStorage.setItem(SESSION_USER_KEY, workspace.currentUserId);
      sessionStorage.setItem(SESSION_PROJECT_KEY, workspace.activeProjectId);
    } catch {
      // Ignore storage quota errors
    }
  }, [workspace]);

  const reconcileServerState = useCallback((incomingWorkspace, incomingRevision) => {
    if (
      typeof incomingRevision === 'number' &&
      incomingRevision < revisionRef.current
    ) {
      return;
    }
    if (typeof incomingRevision === 'number') {
      revisionRef.current = incomingRevision;
    }

    const hydrated = ensurePersonalWorkspacesForAllUsers(incomingWorkspace);

    setWorkspace((prev) => {
      const keepUserId = hydrated.users.some((u) => u.id === prev.currentUserId)
        ? prev.currentUserId
        : hydrated.currentUserId;

      const keepProjectId = hydrated.projects.some(
        (p) => p.id === prev.activeProjectId
      )
        ? prev.activeProjectId
        : hydrated.activeProjectId;

      return {
        ...hydrated,
        personalTodosByUser: {
          ...(hydrated.personalTodosByUser || {}),
          ...(prev.personalTodosByUser || {}),
        },
        currentUserId: keepUserId,
        activeProjectId: keepProjectId,
      };
    });
  }, []);

  const dispatchWorkspaceEvent = useCallback(
    async (event) => {
      const eventsArray = Array.isArray(event) ? event : [event];
      try {
        const res = await fetch('/api/workspace/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientIdRef.current,
            events: eventsArray,
          }),
        });
        if (!res.ok) {
          throw new Error('Server rejected mutation');
        }
        const data = await res.json();
        if (data && data.workspace) {
          reconcileServerState(data.workspace, data.revision);
        }
      } catch {
        pendingEventsRef.current.push(...eventsArray);
      }
    },
    [reconcileServerState]
  );

  // Connect to real-time multi-system SSE stream + auto-reconnect
  useEffect(() => {
    let es = null;
    let reconnectTimer = null;
    let isMounted = true;

    const connectStream = () => {
      if (!isMounted) return;
      const url = `/api/workspace/stream?clientId=${encodeURIComponent(
        clientIdRef.current
      )}&userId=${encodeURIComponent(workspace.currentUserId)}`;

      es = new EventSource(url);

      es.addEventListener('workspace:init', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.workspace) {
            reconcileServerState(data.workspace, data.revision);
          }
          if (Array.isArray(data.collaborators)) {
            setCollaborators(data.collaborators);
          }
          if (pendingEventsRef.current.length > 0) {
            const queued = [...pendingEventsRef.current];
            pendingEventsRef.current = [];
            void dispatchWorkspaceEvent(queued);
          }
        } catch {
          // Ignore malformed event
        }
      });

      es.addEventListener('workspace:sync', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.workspace) {
            reconcileServerState(data.workspace, data.revision);
          }
          if (Array.isArray(data.collaborators)) {
            setCollaborators(data.collaborators);
          }
        } catch {
          // Ignore malformed event
        }
      });

      es.addEventListener('presence:updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.collaborators)) {
            setCollaborators(data.collaborators);
          }
        } catch {
          // Ignore malformed event
        }
      });

      es.onerror = () => {
        es?.close();
        if (isMounted) {
          reconnectTimer = setTimeout(connectStream, 2500);
        }
      };
    };

    connectStream();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [reconcileServerState, dispatchWorkspaceEvent]);

  // Notify server when current user changes on this system
  useEffect(() => {
    void fetch('/api/workspace/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientIdRef.current,
        userId: workspace.currentUserId,
      }),
    }).catch(() => {});
  }, [workspace.currentUserId]);

  const [activeTab, setActiveTab] = useState(NavigationTab.BOARD);
  const [selectedIssueId, setSelectedIssueId] = useState(null);

  // Modals state
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showScreenshotImporter, setShowScreenshotImporter] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [sprintToStart, setSprintToStart] = useState(null);
  const [showCompleteSprintModal, setShowCompleteSprintModal] = useState(false);
  const [importBanner, setImportBanner] = useState(null);

  // Global Quick Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const currentUser = useMemo(() => {
    return (
      workspace.users.find((u) => u.id === workspace.currentUserId) ||
      workspace.users[0]
    );
  }, [workspace.users, workspace.currentUserId]);

  // Visible projects: when in 'MY_OWN' mode, show only current user's personal or lead projects;
  // in 'ALL' mode, show shared projects + current user's own personal projects (hiding other users' private personal spaces!)
  const visibleProjects = useMemo(() => {
    if (workspaceScopeMode === 'MY_OWN') {
      const own = workspace.projects.filter(
        (p) => p.ownerUserId === currentUser.id || p.id === `prj-personal-${currentUser.id}`
      );
      return own.length > 0 ? own : workspace.projects;
    }
    return workspace.projects.filter(
      (p) => !p.isPersonal || p.ownerUserId === currentUser.id
    );
  }, [workspace.projects, workspaceScopeMode, currentUser.id]);

  const activeProject = useMemo(() => {
    return (
      visibleProjects.find((p) => p.id === workspace.activeProjectId) ||
      visibleProjects[0] ||
      workspace.projects[0]
    );
  }, [visibleProjects, workspace.activeProjectId, workspace.projects]);

  // Switch active user and optionally jump to their own personal project if in MY_OWN mode
  const handleSwitchUser = (userId) => {
    setWorkspace((prev) => {
      const personalProj = prev.projects.find(
        (p) => p.ownerUserId === userId || p.id === `prj-personal-${userId}`
      );
      const currentProj = prev.projects.find((p) => p.id === prev.activeProjectId);
      const shouldSwitchProj =
        workspaceScopeMode === 'MY_OWN' || (currentProj && currentProj.isPersonal);

      return {
        ...prev,
        currentUserId: userId,
        activeProjectId:
          shouldSwitchProj && personalProj
            ? personalProj.id
            : prev.activeProjectId,
      };
    });
  };

  const projectIssues = useMemo(() => {
    const base = workspace.issues.filter((i) => i.projectId === activeProject.id);
    if (workspaceScopeMode === 'MY_OWN' && !activeProject.isPersonal) {
      return base.filter(
        (i) => i.type === IssueType.EPIC || i.assigneeId === currentUser.id
      );
    }
    return base;
  }, [workspace.issues, activeProject, workspaceScopeMode, currentUser.id]);

  const projectEpics = useMemo(() => {
    return projectIssues.filter((i) => i.type === IssueType.EPIC);
  }, [projectIssues]);

  const projectSprints = useMemo(() => {
    return workspace.sprints.filter((s) => s.projectId === activeProject.id);
  }, [workspace.sprints, activeProject.id]);

  const activeSprint = useMemo(() => {
    return (
      projectSprints.find((s) => s.status === SprintStatus.ACTIVE) || null
    );
  }, [projectSprints]);

  const projectReleases = useMemo(() => {
    return workspace.releases.filter((r) => r.projectId === activeProject.id);
  }, [workspace.releases, activeProject.id]);

  const projectComponents = useMemo(() => {
    return workspace.components.filter((c) => c.projectId === activeProject.id);
  }, [workspace.components, activeProject.id]);

  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return workspace.issues.find((i) => i.id === selectedIssueId) || null;
  }, [workspace.issues, selectedIssueId]);

  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase();
    return workspace.issues
      .filter(
        (i) =>
          i.key.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.labels.some((l) => l.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [workspace.issues, globalSearch]);

  // Core Mutation Handlers
  const handleUpdateIssue = (issueId, updates) => {
    const now = new Date().toISOString();
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) => {
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
              actorId: prev.currentUserId,
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
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:updated',
      payload: {
        issueId,
        updates,
        actorId: workspace.currentUserId,
      },
    });
  };

  const handleQuickCreateIssue = (payload) => {
    const now = new Date().toISOString();
    const nextNumber = activeProject.issueCounter + 1;
    const newKey = `${activeProject.key}-${nextNumber}`;
    const newIssue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      key: newKey,
      title: payload.title,
      description: '',
      type: payload.type,
      status: payload.status,
      priority: IssuePriority.MEDIUM,
      assigneeId:
        workspaceScopeMode === 'MY_OWN'
          ? workspace.currentUserId
          : activeProject.defaultAssigneeId || workspace.currentUserId,
      reporterId: workspace.currentUserId,
      epicId: payload.epicId,
      sprintId: payload.sprintId,
      storyPoints: payload.type === IssueType.EPIC ? 0 : 3,
      originalEstimateHours: 8,
      timeSpentHours: 0,
      remainingEstimateHours: 8,
      labels: [],
      componentId: projectComponents[0]?.id || null,
      fixVersionId:
        projectReleases.find((r) => r.status === 'UNRELEASED')?.id || null,
      startDate: now.slice(0, 10),
      dueDate: '2026-10-19',
      subtasks: [],
      links: [],
      comments: [],
      workLogs: [],
      history: [],
      watcherIds: [workspace.currentUserId],
      createdAt: now,
      updatedAt: now,
      order: projectIssues.length + 1,
    };

    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...p, issueCounter: nextNumber } : p
      ),
      issues: [...prev.issues, newIssue],
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:created',
      payload: {
        issue: newIssue,
        projectId: activeProject.id,
        nextCounter: nextNumber,
      },
    });
  };

  const handleQuickCreatePersonalIssue = (payload) => {
    const personalProj =
      workspace.projects.find(
        (p) =>
          p.ownerUserId === currentUser.id ||
          p.id === `prj-personal-${currentUser.id}`
      ) || activeProject;
    const personalSprint = workspace.sprints.find(
      (s) => s.projectId === personalProj.id && s.status === SprintStatus.ACTIVE
    );

    const now = new Date().toISOString();
    const nextNumber = personalProj.issueCounter + 1;
    const newKey = `${personalProj.key}-${nextNumber}`;
    const newIssue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: personalProj.id,
      key: newKey,
      title: payload.title,
      description: `Created in ${currentUser.name}'s Personal Workspace.`,
      type: payload.type,
      status: payload.status,
      priority: IssuePriority.MEDIUM,
      assigneeId: currentUser.id,
      reporterId: currentUser.id,
      epicId: null,
      sprintId: personalSprint ? personalSprint.id : null,
      storyPoints: 3,
      originalEstimateHours: 6,
      timeSpentHours: 0,
      remainingEstimateHours: 6,
      labels: ['personal'],
      componentId: null,
      fixVersionId: null,
      startDate: now.slice(0, 10),
      dueDate: '2026-10-18',
      subtasks: [],
      links: [],
      comments: [],
      workLogs: [],
      history: [],
      watcherIds: [currentUser.id],
      createdAt: now,
      updatedAt: now,
      order: workspace.issues.length + 1,
    };

    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === personalProj.id ? { ...p, issueCounter: nextNumber } : p
      ),
      issues: [...prev.issues, newIssue],
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:created',
      payload: {
        issue: newIssue,
        projectId: personalProj.id,
        nextCounter: nextNumber,
      },
    });
  };

  const handleFullCreateIssue = (payload) => {
    const targetProject =
      workspace.projects.find((p) => p.id === payload.projectId) || activeProject;
    const nextNumber = targetProject.issueCounter + 1;
    const newKey = `${targetProject.key}-${nextNumber}`;
    const now = new Date().toISOString();

    const newIssue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: targetProject.id,
      key: newKey,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      status: payload.status,
      priority: payload.priority,
      assigneeId: payload.assigneeId,
      reporterId: workspace.currentUserId,
      epicId: payload.epicId,
      sprintId: payload.sprintId,
      storyPoints: payload.storyPoints,
      originalEstimateHours: payload.originalEstimateHours,
      timeSpentHours: 0,
      remainingEstimateHours: payload.originalEstimateHours,
      labels: payload.labels,
      componentId: payload.componentId,
      fixVersionId: payload.fixVersionId,
      startDate: now.slice(0, 10),
      dueDate: payload.dueDate,
      subtasks: [],
      links: [],
      comments: [],
      workLogs: [],
      history: [],
      watcherIds: [workspace.currentUserId],
      createdAt: now,
      updatedAt: now,
      order: workspace.issues.length + 1,
    };

    setWorkspace((prev) => ({
      ...prev,
      activeProjectId: targetProject.id,
      projects: prev.projects.map((p) =>
        p.id === targetProject.id ? { ...p, issueCounter: nextNumber } : p
      ),
      issues: [...prev.issues, newIssue],
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:created',
      payload: {
        issue: newIssue,
        projectId: targetProject.id,
        nextCounter: nextNumber,
      },
    });
  };

  const handleDeleteIssue = (issueId) => {
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.filter((i) => i.id !== issueId),
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:deleted',
      payload: { issueId },
    });
  };

  const handleCloneIssue = (source) => {
    const nextNumber = activeProject.issueCounter + 1;
    const newKey = `${activeProject.key}-${nextNumber}`;
    const now = new Date().toISOString();
    const cloned = {
      ...source,
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key: newKey,
      title: `CLONE — ${source.title}`,
      status: IssueStatus.TODO,
      createdAt: now,
      updatedAt: now,
      order: workspace.issues.length + 1,
    };
    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...p, issueCounter: nextNumber } : p
      ),
      issues: [...prev.issues, cloned],
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:created',
      payload: {
        issue: cloned,
        projectId: activeProject.id,
        nextCounter: nextNumber,
      },
    });
  };

  const handleAddComment = (issueId, body) => {
    const now = new Date().toISOString();
    const comment = {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: workspace.currentUserId,
      body,
      createdAt: now,
    };
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) =>
        iss.id === issueId
          ? {
              ...iss,
              comments: [...iss.comments, comment],
              updatedAt: now,
            }
          : iss
      ),
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:comment_added',
      payload: { issueId, comment },
    });
  };

  const handleLogWork = (issueId, hours, comment) => {
    const now = new Date().toISOString();
    const workLog = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorId: workspace.currentUserId,
      hoursSpent: hours,
      comment,
      loggedAt: now,
    };
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) => {
        if (iss.id !== issueId) return iss;
        const newSpent = +(iss.timeSpentHours + hours).toFixed(1);
        const newRem = Math.max(0, +(iss.remainingEstimateHours - hours).toFixed(1));
        return {
          ...iss,
          timeSpentHours: newSpent,
          remainingEstimateHours: newRem,
          workLogs: [workLog, ...iss.workLogs],
          updatedAt: now,
        };
      }),
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:work_logged',
      payload: { issueId, workLog },
    });
  };

  // Sprint Handlers
  const handleCreateSprint = () => {
    const nextNum = projectSprints.length + 22;
    const newSprint = {
      id: `spr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      name: `${activeProject.key} Sprint ${nextNum} — Planned Iteration`,
      goal: 'Define sprint goal and drag backlog items into this sprint.',
      status: SprintStatus.PLANNED,
      startDate: '2026-11-03',
      endDate: '2026-11-17',
    };
    setWorkspace((prev) => ({
      ...prev,
      sprints: [...prev.sprints, newSprint],
    }));

    void dispatchWorkspaceEvent({
      type: 'sprint:created',
      payload: { sprint: newSprint },
    });
  };

  const handleConfirmStartSprint = (sprintId, updates) => {
    setWorkspace((prev) => ({
      ...prev,
      sprints: prev.sprints.map((s) => {
        if (s.projectId !== activeProject.id) return s;
        if (s.id === sprintId) {
          return {
            ...s,
            ...updates,
            status: SprintStatus.ACTIVE,
          };
        }
        if (s.status === SprintStatus.ACTIVE) {
          return { ...s, status: SprintStatus.PLANNED };
        }
        return s;
      }),
    }));
    setActiveTab(NavigationTab.BOARD);

    void dispatchWorkspaceEvent({
      type: 'sprint:started',
      payload: {
        sprintId,
        projectId: activeProject.id,
        updates,
      },
    });
  };

  const handleConfirmCompleteSprint = (sprintId, destinationSprintId) => {
    const spIssues = projectIssues.filter(
      (i) => i.sprintId === sprintId && i.type !== IssueType.EPIC
    );
    const committedPts = spIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const completedPts = spIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    setWorkspace((prev) => ({
      ...prev,
      sprints: prev.sprints.map((s) =>
        s.id === sprintId
          ? {
              ...s,
              status: SprintStatus.COMPLETED,
              completedAt: new Date().toISOString(),
              committedPoints: committedPts,
              completedPoints: completedPts,
            }
          : s
      ),
      issues: prev.issues.map((i) => {
        if (i.sprintId === sprintId && i.status !== IssueStatus.DONE) {
          return {
            ...i,
            sprintId: destinationSprintId,
          };
        }
        return i;
      }),
    }));

    void dispatchWorkspaceEvent({
      type: 'sprint:completed',
      payload: {
        sprintId,
        destinationSprintId,
        committedPoints: committedPts,
        completedPoints: completedPts,
      },
    });
  };

  const handleDeleteSprint = (sprintId) => {
    setWorkspace((prev) => ({
      ...prev,
      sprints: prev.sprints.filter((s) => s.id !== sprintId),
      issues: prev.issues.map((i) =>
        i.sprintId === sprintId ? { ...i, sprintId: null } : i
      ),
    }));

    void dispatchWorkspaceEvent({
      type: 'sprint:deleted',
      payload: { sprintId },
    });
  };

  // Releases & Components Handlers
  const handleCreateRelease = (payload) => {
    const release = {
      id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      name: payload.name,
      description: payload.description,
      releaseDate: payload.releaseDate,
      status: 'UNRELEASED',
      createdAt: new Date().toISOString(),
    };
    setWorkspace((prev) => ({
      ...prev,
      releases: [...prev.releases, release],
    }));

    void dispatchWorkspaceEvent({
      type: 'release:created',
      payload: { release },
    });
  };

  const handleToggleReleaseStatus = (releaseId) => {
    setWorkspace((prev) => ({
      ...prev,
      releases: prev.releases.map((r) =>
        r.id === releaseId
          ? {
              ...r,
              status: r.status === 'RELEASED' ? 'UNRELEASED' : 'RELEASED',
            }
          : r
      ),
    }));

    void dispatchWorkspaceEvent({
      type: 'release:toggled',
      payload: { releaseId },
    });
  };

  const handleCreateComponent = (payload) => {
    const component = {
      id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      name: payload.name,
      description: payload.description,
      leadId: payload.leadId,
    };
    setWorkspace((prev) => ({
      ...prev,
      components: [...prev.components, component],
    }));

    void dispatchWorkspaceEvent({
      type: 'component:created',
      payload: { component },
    });
  };

  const handleUpdateProject = (updates) => {
    setWorkspace((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === activeProject.id ? { ...p, ...updates } : p
      ),
    }));

    void dispatchWorkspaceEvent({
      type: 'project:updated',
      payload: { projectId: activeProject.id, updates },
    });
  };

  const handleCreateProject = (payload) => {
    const newProjId = `prj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newSprintId = `spr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newProj = {
      id: newProjId,
      key: payload.key,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      template: payload.template,
      leadId: payload.leadId,
      defaultAssigneeId: payload.leadId,
      isPersonal: Boolean(payload.isPersonal),
      ownerUserId: payload.ownerUserId || null,
      issueCounter: 101,
      wipLimits: {
        [IssueStatus.TODO]: 0,
        [IssueStatus.IN_PROGRESS]: 5,
        [IssueStatus.IN_REVIEW]: 3,
        [IssueStatus.QA]: 3,
        [IssueStatus.DONE]: 0,
      },
      createdAt: new Date().toISOString(),
    };

    const initialSprint = {
      id: newSprintId,
      projectId: newProjId,
      name: `${payload.key} Sprint 1 — Initial Launch`,
      goal: 'Deliver core architecture and MVP stories.',
      status: SprintStatus.ACTIVE,
      startDate: '2026-10-05',
      endDate: '2026-10-19',
    };

    const starterIssue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      projectId: newProjId,
      key: `${payload.key}-101`,
      title: `Set up foundational architecture and CI/CD pipeline for ${payload.name}`,
      description:
        'Initialize repository structure, automated test runner, and deployment workflows.',
      type: IssueType.STORY,
      status: IssueStatus.IN_PROGRESS,
      priority: IssuePriority.HIGH,
      assigneeId: payload.leadId,
      reporterId: workspace.currentUserId,
      epicId: null,
      sprintId: newSprintId,
      storyPoints: 5,
      originalEstimateHours: 12,
      timeSpentHours: 2,
      remainingEstimateHours: 10,
      labels: ['architecture', 'setup'],
      componentId: null,
      fixVersionId: null,
      startDate: '2026-10-05',
      dueDate: '2026-10-12',
      subtasks: [],
      links: [],
      comments: [],
      workLogs: [],
      history: [],
      watcherIds: [workspace.currentUserId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 1,
    };

    setWorkspace((prev) => ({
      ...prev,
      activeProjectId: newProjId,
      projects: [...prev.projects, newProj],
      sprints: [...prev.sprints, initialSprint],
      issues: [...prev.issues, starterIssue],
    }));
    setActiveTab(NavigationTab.BOARD);

    void dispatchWorkspaceEvent({
      type: 'project:created',
      payload: {
        project: newProj,
        initialSprint,
        starterIssue,
      },
    });
  };

  // Create a new user AND automatically create their dedicated personal project & tasks
  const handleAddUser = (payload, switchToNewUser = false) => {
    const initials = payload.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const user = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      department: payload.department,
      avatarUrl: '',
      initials,
    };

    const bundle = createPersonalWorkspaceBundle(user);

    setWorkspace((prev) => ({
      ...prev,
      currentUserId: switchToNewUser ? user.id : prev.currentUserId,
      activeProjectId: switchToNewUser ? bundle.project.id : prev.activeProjectId,
      users: [...prev.users, user],
      projects: [...prev.projects, bundle.project],
      sprints: [...prev.sprints, bundle.sprint],
      issues: [...prev.issues, ...bundle.issues],
      personalTodosByUser: {
        ...(prev.personalTodosByUser || {}),
        [user.id]: [
          {
            id: `todo-${Date.now()}`,
            text: `Welcome ${user.name}! Track your personal tasks here.`,
            done: false,
          },
        ],
      },
    }));

    void dispatchWorkspaceEvent([
      {
        type: 'user:created',
        payload: { user },
      },
      {
        type: 'project:created',
        payload: {
          project: bundle.project,
          initialSprint: bundle.sprint,
          starterIssue: bundle.issues[0],
        },
      },
    ]);
  };

  // Personal Private Scratchpad Handlers (Per-User)
  const handleAddPersonalTodo = (text) => {
    setWorkspace((prev) => {
      const uid = prev.currentUserId;
      const list = prev.personalTodosByUser?.[uid] || [];
      return {
        ...prev,
        personalTodosByUser: {
          ...(prev.personalTodosByUser || {}),
          [uid]: [
            ...list,
            { id: `todo-${Date.now()}`, text, done: false },
          ],
        },
      };
    });
  };

  const handleTogglePersonalTodo = (todoId) => {
    setWorkspace((prev) => {
      const uid = prev.currentUserId;
      const list = prev.personalTodosByUser?.[uid] || [];
      return {
        ...prev,
        personalTodosByUser: {
          ...(prev.personalTodosByUser || {}),
          [uid]: list.map((t) =>
            t.id === todoId ? { ...t, done: !t.done } : t
          ),
        },
      };
    });
  };

  const handleDeletePersonalTodo = (todoId) => {
    setWorkspace((prev) => {
      const uid = prev.currentUserId;
      const list = prev.personalTodosByUser?.[uid] || [];
      return {
        ...prev,
        personalTodosByUser: {
          ...(prev.personalTodosByUser || {}),
          [uid]: list.filter((t) => t.id !== todoId),
        },
      };
    });
  };

  const handleSaveFilter = (name, jql) => {
    const filter = {
      id: `flt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      jql,
    };
    setWorkspace((prev) => ({
      ...prev,
      savedFilters: [...prev.savedFilters, filter],
    }));

    void dispatchWorkspaceEvent({
      type: 'filter:saved',
      payload: { filter },
    });
  };

  const handleApplyScreenshotImport = (payload, mode) => {
    const now = new Date().toISOString();
    let syncedWorkspaceSnapshot = null;

    setWorkspace((prev) => {
      const updatedUsers = [...prev.users];

      const resolveUserProfile = (
        nameRaw,
        initialsRaw,
        roleRaw,
        emailRaw,
        deptRaw
      ) => {
        const cleanName = (nameRaw || '').trim();
        const cleanInit = (initialsRaw || '').trim().toUpperCase();
        if (!cleanName && !cleanInit) return null;

        const existing = updatedUsers.find(
          (u) =>
            (cleanName && u.name.toLowerCase() === cleanName.toLowerCase()) ||
            (cleanInit && u.initials.toUpperCase() === cleanInit) ||
            (cleanName && u.initials.toUpperCase() === cleanName.toUpperCase())
        );
        if (existing) return existing.id;

        const computedInitials =
          cleanInit ||
          cleanName
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) ||
          'TM';

        const displayName = cleanName || `Engineer (${computedInitials})`;
        const newUser = {
          id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: displayName,
          initials: computedInitials,
          email:
            emailRaw ||
            `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@kawach.ai`,
          role: roleRaw || 'Software Engineer',
          department: deptRaw || 'Engineering',
          avatarUrl: '',
        };
        updatedUsers.push(newUser);
        return newUser.id;
      };

      const initialUserCount = prev.users.length;
      payload.profiles.forEach((p) => {
        resolveUserProfile(p.name, p.initials, p.role, p.email, p.department);
      });

      let targetProjectId = prev.activeProjectId;
      let targetProjectKey = activeProject.key;
      let nextCounter = activeProject.issueCounter;
      const updatedProjects = [...prev.projects];
      const updatedSprints = [...prev.sprints];
      let targetSprintId = activeSprint?.id || null;

      if (mode === 'CREATE_NEW_PROJECT') {
        targetProjectId = `prj-${Date.now()}`;
        targetProjectKey = (payload.projectKey || 'IMP').toUpperCase().slice(0, 6);
        nextCounter = 100;
        const newSprintId = `spr-${Date.now()}`;
        targetSprintId = newSprintId;

        updatedProjects.push({
          id: targetProjectId,
          key: targetProjectKey,
          name: payload.projectName || `${targetProjectKey} Imported Project`,
          description:
            'Imported directly from board screenshot with replicated profiles and task assignments.',
          category: 'Software Engineering',
          template: 'Scrum',
          leadId: updatedUsers[0]?.id || prev.currentUserId,
          defaultAssigneeId: updatedUsers[0]?.id || prev.currentUserId,
          issueCounter: 100 + payload.issues.length + payload.epics.length,
          wipLimits: {
            [IssueStatus.TODO]: 0,
            [IssueStatus.IN_PROGRESS]: 6,
            [IssueStatus.IN_REVIEW]: 4,
            [IssueStatus.QA]: 4,
            [IssueStatus.DONE]: 0,
          },
          createdAt: now,
        });

        updatedSprints.push({
          id: newSprintId,
          projectId: targetProjectId,
          name: payload.sprintName || `${targetProjectKey} Active Sprint (Imported)`,
          goal:
            payload.sprintGoal ||
            'Replicated sprint tasks and assignments from board screenshot.',
          status: SprintStatus.ACTIVE,
          startDate: now.slice(0, 10),
          endDate: '2026-10-24',
        });
      } else if (!targetSprintId) {
        const newSprintId = `spr-${Date.now()}`;
        targetSprintId = newSprintId;
        updatedSprints.push({
          id: newSprintId,
          projectId: targetProjectId,
          name: payload.sprintName || `${targetProjectKey} Active Sprint`,
          goal: payload.sprintGoal || 'Imported sprint tasks.',
          status: SprintStatus.ACTIVE,
          startDate: now.slice(0, 10),
          endDate: '2026-10-24',
        });
      }

      const epicTitleToId = {};
      prev.issues
        .filter((i) => i.projectId === targetProjectId && i.type === IssueType.EPIC)
        .forEach((ep) => {
          epicTitleToId[ep.title.toLowerCase()] = ep.id;
        });

      const createdIssues = [];
      payload.epics.forEach((ep) => {
        if (!ep.title) return;
        const lower = ep.title.toLowerCase();
        if (epicTitleToId[lower]) return;
        nextCounter += 1;
        const epId = `iss-epic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        epicTitleToId[lower] = epId;
        createdIssues.push({
          id: epId,
          projectId: targetProjectId,
          key: ep.key || `${targetProjectKey}-${nextCounter}`,
          title: ep.title,
          description: ep.description || 'Imported Epic from screenshot.',
          type: IssueType.EPIC,
          status: IssueStatus.IN_PROGRESS,
          priority: IssuePriority.HIGH,
          assigneeId: prev.currentUserId,
          reporterId: prev.currentUserId,
          epicId: null,
          sprintId: null,
          storyPoints: 0,
          originalEstimateHours: 40,
          timeSpentHours: 0,
          remainingEstimateHours: 40,
          labels: ['imported'],
          componentId: null,
          fixVersionId: null,
          startDate: now.slice(0, 10),
          dueDate: '2026-10-30',
          subtasks: [],
          links: [],
          comments: [],
          workLogs: [],
          history: [],
          watcherIds: [prev.currentUserId],
          createdAt: now,
          updatedAt: now,
          order: prev.issues.length + createdIssues.length + 1,
        });
      });

      payload.issues.forEach((iss, idx) => {
        nextCounter += 1;
        const matchedAssigneeId = resolveUserProfile(
          iss.assigneeName,
          iss.assigneeInitials
        );

        let linkedEpicId = null;
        if (iss.epicTitle) {
          const lowerEpic = iss.epicTitle.toLowerCase();
          if (!epicTitleToId[lowerEpic]) {
            const autoEpicId = `iss-epic-${Date.now()}-${idx}`;
            epicTitleToId[lowerEpic] = autoEpicId;
            createdIssues.push({
              id: autoEpicId,
              projectId: targetProjectId,
              key: `${targetProjectKey}-${nextCounter}`,
              title: iss.epicTitle,
              description: 'Epic automatically created from screenshot card badge.',
              type: IssueType.EPIC,
              status: IssueStatus.IN_PROGRESS,
              priority: IssuePriority.MEDIUM,
              assigneeId: matchedAssigneeId || prev.currentUserId,
              reporterId: prev.currentUserId,
              epicId: null,
              sprintId: null,
              storyPoints: 0,
              originalEstimateHours: 32,
              timeSpentHours: 0,
              remainingEstimateHours: 32,
              labels: ['imported-epic'],
              componentId: null,
              fixVersionId: null,
              startDate: now.slice(0, 10),
              dueDate: '2026-10-30',
              subtasks: [],
              links: [],
              comments: [],
              workLogs: [],
              history: [],
              watcherIds: [prev.currentUserId],
              createdAt: now,
              updatedAt: now,
              order: prev.issues.length + createdIssues.length + 1,
            });
            nextCounter += 1;
          }
          linkedEpicId = epicTitleToId[lowerEpic];
        }

        const issueKey = iss.key?.trim()
          ? iss.key.trim().toUpperCase()
          : `${targetProjectKey}-${nextCounter}`;

        createdIssues.push({
          id: `iss-imp-${Date.now()}-${idx}`,
          projectId: targetProjectId,
          key: issueKey,
          title: iss.title,
          description:
            iss.description ||
            'Imported from board screenshot with profile and status assignment.',
          type: iss.type,
          status: iss.status,
          priority: iss.priority,
          assigneeId: matchedAssigneeId,
          reporterId: prev.currentUserId,
          epicId: linkedEpicId,
          sprintId: iss.type === IssueType.EPIC ? null : targetSprintId,
          storyPoints: iss.storyPoints || 0,
          originalEstimateHours: (iss.storyPoints || 2) * 3,
          timeSpentHours:
            iss.status === IssueStatus.DONE ? (iss.storyPoints || 2) * 3 : 0,
          remainingEstimateHours:
            iss.status === IssueStatus.DONE ? 0 : (iss.storyPoints || 2) * 3,
          labels:
            iss.labels && iss.labels.length > 0 ? iss.labels : ['screenshot-import'],
          componentId: null,
          fixVersionId: null,
          startDate: now.slice(0, 10),
          dueDate: iss.dueDate || '2026-10-20',
          subtasks: (iss.subtasks || []).map((st, sIdx) => ({
            id: `sub-imp-${Date.now()}-${idx}-${sIdx}`,
            key: `${issueKey}-${sIdx + 1}`,
            title: st.title,
            completed: !!st.completed,
            assigneeId: matchedAssigneeId || undefined,
          })),
          links: [],
          comments: [],
          workLogs: [],
          history: [],
          watcherIds: [prev.currentUserId],
          createdAt: now,
          updatedAt: now,
          order: prev.issues.length + createdIssues.length + 1,
        });
      });

      const finalProjects = updatedProjects.map((p) =>
        p.id === targetProjectId ? { ...p, issueCounter: nextCounter } : p
      );

      const newProfilesCreated = updatedUsers.length - initialUserCount;
      setImportBanner(
        `Imported ${payload.issues.length} tasks and ${payload.profiles.length} team profiles (${newProfilesCreated} newly created) into Arij from your screenshot.`
      );
      setTimeout(() => setImportBanner(null), 6000);

      const nextWs = ensurePersonalWorkspacesForAllUsers({
        ...prev,
        activeProjectId: targetProjectId,
        users: updatedUsers,
        projects: finalProjects,
        sprints: updatedSprints,
        issues: [...prev.issues, ...createdIssues],
      });
      syncedWorkspaceSnapshot = nextWs;
      return nextWs;
    });

    if (syncedWorkspaceSnapshot) {
      void dispatchWorkspaceEvent({
        type: 'workspace:imported',
        payload: { updatedWorkspace: syncedWorkspaceSnapshot },
      });
    }

    setActiveTab(NavigationTab.BOARD);
  };

  const activeCollaboratorUsers = useMemo(() => {
    const map = new Map();
    collaborators.forEach((c) => {
      const usr =
        workspace.users.find((u) => u.id === c.userId) || workspace.users[0];
      if (!usr) return;
      const existing = map.get(usr.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(usr.id, { user: usr, count: 1 });
      }
    });
    return Array.from(map.values());
  }, [collaborators, workspace.users]);

  const openIssuesCount = projectIssues.filter(
    (i) => i.type !== IssueType.EPIC && i.status !== IssueStatus.DONE
  ).length;

  const myAssignedCount = workspace.issues.filter(
    (i) =>
      i.type !== IssueType.EPIC &&
      i.assigneeId === currentUser.id &&
      i.status !== IssueStatus.DONE
  ).length;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-14 px-6 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0 z-30">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#board"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab(NavigationTab.BOARD);
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap"
        >
          Arij
        </a>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab(NavigationTab.MY_SPACE)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.MY_SPACE
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            My Personal Space ({currentUser.initials})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(NavigationTab.BOARD)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.BOARD
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            Active Board
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(NavigationTab.BACKLOG)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.BACKLOG
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            Backlog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(NavigationTab.ISSUES)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.ISSUES
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            Issues & JQL
          </button>
          <button
            type="button"
            onClick={() => setActiveTab(NavigationTab.REPORTS)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.REPORTS
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            Reports
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions (+ Create Issue & Active User Selector) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateIssueModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Issue
          </button>

          <select
            value={workspace.currentUserId}
            onChange={(e) => handleSwitchUser(e.target.value)}
            aria-label="Switch active user profile"
            className="text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {workspace.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.initials})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Workspace Canvas: Left Sidebar (260px) + Main Content Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Project & Navigation Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Per-User Workspace Scope Toggle ("Every User Has Their Own") */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Workspace Scope</span>
                <span className="font-mono text-[10px] text-blue-700">
                  {currentUser.name.split(' ')[0]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-md text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceScopeMode('MY_OWN');
                    const personalProj = workspace.projects.find(
                      (p) =>
                        p.ownerUserId === currentUser.id ||
                        p.id === `prj-personal-${currentUser.id}`
                    );
                    if (personalProj) {
                      setWorkspace((prev) => ({
                        ...prev,
                        activeProjectId: personalProj.id,
                      }));
                    }
                  }}
                  className={`py-1.5 px-2 rounded font-semibold transition-all ${
                    workspaceScopeMode === 'MY_OWN'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Own Only
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceScopeMode('ALL')}
                  className={`py-1.5 px-2 rounded font-semibold transition-all ${
                    workspaceScopeMode === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All + Shared
                </button>
              </div>
            </div>

            {/* Project Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">
                  Active Project
                </span>
                <button
                  type="button"
                  onClick={() => setShowCreateProjectModal(true)}
                  className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  New Project
                </button>
              </div>

              <select
                value={activeProject.id}
                onChange={(e) => {
                  setWorkspace((prev) => ({
                    ...prev,
                    activeProjectId: e.target.value,
                  }));
                }}
                aria-label="Select project"
                className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
              >
                {visibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
                <span>{activeProject.template} Project</span>
                <span>·</span>
                <span className="truncate">
                  {activeProject.isPersonal ? 'Personal Space' : activeProject.category}
                </span>
              </div>

              {/* Prominent Screenshot Importer CTA */}
              <button
                type="button"
                onClick={() => setShowScreenshotImporter(true)}
                className="w-full mt-2 py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                Import Board Screenshot
              </button>

              {/* Push to GitHub Button */}
              <button
                type="button"
                onClick={() => setShowGitHubModal(true)}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                Push Project to GitHub
              </button>
            </div>

            {/* Quick Global Issue Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Quick jump (key or text)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {searchFocused && globalSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-40 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {globalSearchResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onMouseDown={() => {
                        setSelectedIssueId(res.id);
                        setGlobalSearch('');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-xs"
                    >
                      <IssueTypeIcon type={res.type} className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums font-semibold text-blue-700 shrink-0">
                        {res.key}
                      </span>
                      <span className="text-slate-800 truncate">{res.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Planning & Development Navigation */}
            <div className="space-y-1">
              <div className="px-2 pb-1 text-[11px] font-semibold text-slate-400">
                Personal & Project Views
              </div>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.MY_SPACE)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === NavigationTab.MY_SPACE
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  My Personal Space
                </span>
                <span className="font-mono tabular-nums text-[11px] text-blue-600 font-bold">
                  {myAssignedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.BOARD)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === NavigationTab.BOARD
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Kanban className="w-4 h-4" />
                  Active Sprint Board
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {activeSprint
                    ? projectIssues.filter((i) => i.sprintId === activeSprint.id).length
                    : projectIssues.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.BACKLOG)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === NavigationTab.BACKLOG
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  Backlog & Sprints
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {projectIssues.filter((i) => !i.sprintId && i.type !== IssueType.EPIC).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.TIMELINE)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  activeTab === NavigationTab.TIMELINE
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Timeline Roadmap
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.ISSUES)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === NavigationTab.ISSUES
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <ListFilter className="w-4 h-4" />
                  Issues & JQL Filters
                </span>
                <span className="font-mono tabular-nums text-[11px] text-slate-400">
                  {openIssuesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.REPORTS)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  activeTab === NavigationTab.REPORTS
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Agile Reports
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.RELEASES)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  activeTab === NavigationTab.RELEASES
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Package className="w-4 h-4" />
                Releases & Components
              </button>

              <button
                type="button"
                onClick={() => setActiveTab(NavigationTab.SETTINGS)}
                className={`w-full px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2.5 transition-colors ${
                  activeTab === NavigationTab.SETTINGS
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="w-4 h-4" />
                Project Settings
              </button>
            </div>
          </div>

          {/* Sidebar Footer: Connected Parallel Systems, Active User & Workspace Reset */}
          <div className="p-4 border-t border-slate-200 space-y-3">
            {activeCollaboratorUsers.length > 0 && (
              <div className="pb-2.5 border-b border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Connected Systems
                  </span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {collaborators.length}
                  </span>
                </div>
                <div className="flex items-center flex-wrap gap-1.5">
                  {activeCollaboratorUsers.map(({ user, count }) => (
                    <div
                      key={user.id}
                      title={`${user.name} (${count} active session${count > 1 ? 's' : ''})`}
                      className="flex items-center gap-1 pr-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-700"
                    >
                      <UserAvatar user={user} size="xs" />
                      <span className="truncate max-w-[96px]">{user.initials}</span>
                      {count > 1 && (
                        <span className="font-mono text-[9px] text-blue-700 font-bold">
                          ×{count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <UserAvatar user={currentUser} size="sm" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {currentUser.role}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setWorkspace(INITIAL_WORKSPACE_STATE);
                void dispatchWorkspaceEvent({
                  type: 'workspace:reset',
                  payload: {},
                });
              }}
              className="w-full py-1.5 px-2.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Sample Workspace
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {importBanner && (
            <div className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportBanner(null)}
                className="text-emerald-100 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeTab === NavigationTab.MY_SPACE && (
            <MyWorkspaceView
              currentUser={currentUser}
              users={workspace.users}
              projects={workspace.projects}
              allIssues={workspace.issues}
              personalTodos={
                workspace.personalTodosByUser?.[currentUser.id] || []
              }
              onSwitchUser={handleSwitchUser}
              onSelectProject={(projId) => {
                setWorkspace((prev) => ({
                  ...prev,
                  activeProjectId: projId,
                }));
                setActiveTab(NavigationTab.BOARD);
              }}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onUpdateIssueStatus={(id, status) =>
                handleUpdateIssue(id, { status })
              }
              onQuickCreatePersonalIssue={handleQuickCreatePersonalIssue}
              onAddUserAccount={(u) => handleAddUser(u, true)}
              onAddPersonalTodo={handleAddPersonalTodo}
              onTogglePersonalTodo={handleTogglePersonalTodo}
              onDeletePersonalTodo={handleDeletePersonalTodo}
            />
          )}

          {activeTab === NavigationTab.BOARD && (
            <BoardView
              project={activeProject}
              activeSprint={activeSprint}
              issues={projectIssues}
              epics={projectEpics}
              users={workspace.users}
              currentUserId={workspace.currentUserId}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onUpdateIssueStatus={(id, status) =>
                handleUpdateIssue(id, { status })
              }
              onQuickCreateIssue={handleQuickCreateIssue}
              onOpenCompleteSprintModal={() => setShowCompleteSprintModal(true)}
              onOpenScreenshotImporter={() => setShowScreenshotImporter(true)}
              onNavigateToBacklog={() => setActiveTab(NavigationTab.BACKLOG)}
            />
          )}

          {activeTab === NavigationTab.BACKLOG && (
            <BacklogView
              project={activeProject}
              sprints={projectSprints}
              issues={projectIssues}
              epics={projectEpics}
              users={workspace.users}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onUpdateIssue={handleUpdateIssue}
              onQuickCreateIssue={handleQuickCreateIssue}
              onCreateSprint={handleCreateSprint}
              onStartSprintModal={(sp) => setSprintToStart(sp)}
              onOpenCompleteSprintModal={() => setShowCompleteSprintModal(true)}
              onDeleteSprint={handleDeleteSprint}
            />
          )}

          {activeTab === NavigationTab.TIMELINE && (
            <TimelineView
              project={activeProject}
              issues={projectIssues}
              epics={projectEpics}
              users={workspace.users}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onQuickCreateIssue={handleQuickCreateIssue}
            />
          )}

          {activeTab === NavigationTab.ISSUES && (
            <IssuesNavigatorView
              project={activeProject}
              issues={projectIssues}
              sprints={projectSprints}
              components={projectComponents}
              users={workspace.users}
              currentUserId={workspace.currentUserId}
              savedFilters={workspace.savedFilters}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onUpdateIssue={handleUpdateIssue}
              onSaveFilter={handleSaveFilter}
            />
          )}

          {activeTab === NavigationTab.REPORTS && (
            <ReportsView
              project={activeProject}
              sprints={projectSprints}
              issues={projectIssues}
              epics={projectEpics}
              users={workspace.users}
              onSelectIssue={(id) => setSelectedIssueId(id)}
            />
          )}

          {activeTab === NavigationTab.RELEASES && (
            <ReleasesAndComponentsView
              project={activeProject}
              releases={projectReleases}
              components={projectComponents}
              issues={projectIssues}
              users={workspace.users}
              onSelectIssue={(id) => setSelectedIssueId(id)}
              onCreateRelease={handleCreateRelease}
              onToggleReleaseStatus={handleToggleReleaseStatus}
              onCreateComponent={handleCreateComponent}
            />
          )}

          {activeTab === NavigationTab.SETTINGS && (
            <ProjectSettingsView
              project={activeProject}
              users={workspace.users}
              onUpdateProject={handleUpdateProject}
              onAddUser={(u) => handleAddUser(u, false)}
            />
          )}
        </main>
      </div>

      {/* Full Issue Detail Inspector Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          allIssues={projectIssues}
          epics={projectEpics}
          sprints={projectSprints}
          releases={projectReleases}
          components={projectComponents}
          users={workspace.users}
          currentUserId={workspace.currentUserId}
          onClose={() => setSelectedIssueId(null)}
          onSelectIssue={(id) => setSelectedIssueId(id)}
          onUpdateIssue={handleUpdateIssue}
          onDeleteIssue={handleDeleteIssue}
          onCloneIssue={handleCloneIssue}
          onAddComment={handleAddComment}
          onLogWork={handleLogWork}
        />
      )}

      {/* Create Issue Modal */}
      {showCreateIssueModal && (
        <CreateIssueModal
          projects={visibleProjects}
          activeProjectId={activeProject.id}
          epics={projectEpics}
          sprints={projectSprints}
          releases={projectReleases}
          components={projectComponents}
          users={workspace.users}
          currentUserId={workspace.currentUserId}
          onClose={() => setShowCreateIssueModal(false)}
          onCreate={handleFullCreateIssue}
        />
      )}

      {/* Start Sprint Modal */}
      {sprintToStart && (
        <StartSprintModal
          sprint={sprintToStart}
          issueCount={
            projectIssues.filter((i) => i.sprintId === sprintToStart.id).length
          }
          totalPoints={projectIssues
            .filter((i) => i.sprintId === sprintToStart.id)
            .reduce((s, i) => s + (i.storyPoints || 0), 0)}
          onClose={() => setSprintToStart(null)}
          onConfirmStart={handleConfirmStartSprint}
        />
      )}

      {/* Complete Sprint Modal */}
      {showCompleteSprintModal && activeSprint && (
        <CompleteSprintModal
          sprint={activeSprint}
          sprintIssues={projectIssues.filter(
            (i) => i.sprintId === activeSprint.id && i.type !== IssueType.EPIC
          )}
          plannedSprints={projectSprints.filter(
            (s) => s.status === SprintStatus.PLANNED
          )}
          onClose={() => setShowCompleteSprintModal(false)}
          onConfirmComplete={handleConfirmCompleteSprint}
        />
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <CreateProjectModal
          users={workspace.users}
          currentUserId={workspace.currentUserId}
          onClose={() => setShowCreateProjectModal(false)}
          onCreateProject={handleCreateProject}
        />
      )}

      {/* Screenshot-to-Arij Importer Modal */}
      {showScreenshotImporter && (
        <ScreenshotImporterModal
          activeProject={activeProject}
          existingUsers={workspace.users}
          onClose={() => setShowScreenshotImporter(false)}
          onApplyImport={handleApplyScreenshotImport}
        />
      )}

      {/* Push to GitHub Modal */}
      {showGitHubModal && (
        <GitHubPushModal onClose={() => setShowGitHubModal(false)} />
      )}
    </div>
  );
}
