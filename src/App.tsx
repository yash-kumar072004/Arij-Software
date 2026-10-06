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
  Users,
  X,
} from 'lucide-react';
import {
  AuditHistoryItem,
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  JiraWorkspaceState,
  NavigationTab,
  Project,
  ProjectComponent,
  ReleaseVersion,
  SavedFilter,
  Sprint,
  SprintStatus,
  User,
} from './types/jira';
import { INITIAL_WORKSPACE_STATE } from './data/initialWorkspace';
import { IssueTypeIcon, UserAvatar } from './components/JiraPrimitives';
import { BoardView } from './components/BoardView';
import { BacklogView } from './components/BacklogView';
import { TimelineView } from './components/TimelineView';
import { IssuesNavigatorView } from './components/IssuesNavigatorView';
import { ReportsView } from './components/ReportsView';
import { ReleasesAndComponentsView } from './components/ReleasesAndComponentsView';
import { ProjectSettingsView } from './components/ProjectSettingsView';
import {
  CompleteSprintModal,
  CreateIssueModal,
  CreateProjectModal,
  StartSprintModal,
} from './components/ActionModals';
import { IssueDetailModal } from './components/IssueDetailModal';
import {
  ExtractedJiraPayload,
  ScreenshotImporterModal,
} from './components/ScreenshotImporterModal';
import { GitHubPushModal } from './components/GitHubPushModal';

const STORAGE_KEY = 'jira_enterprise_workspace_v1';
const CLIENT_ID_KEY = 'jira_system_client_id_v1';
const SESSION_USER_KEY = 'jira_session_user_id_v1';
const SESSION_PROJECT_KEY = 'jira_session_project_id_v1';

interface CollaboratorPresence {
  clientId: string;
  userId: string;
  connectedAt: string;
}

interface WorkspaceMutationEvent {
  type: string;
  payload: Record<string, unknown>;
}

function getOrCreateClientId(): string {
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

export default function App() {
  const clientIdRef = useRef<string>(getOrCreateClientId());
  const pendingEventsRef = useRef<WorkspaceMutationEvent[]>([]);
  const revisionRef = useRef<number>(0);

  const [workspace, setWorkspace] = useState<JiraWorkspaceState>(() => {
    let baseState = INITIAL_WORKSPACE_STATE;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.issues)) {
          baseState = parsed;
        }
      }
    } catch {
      // Fallback to initial state
    }

    // Per-system session user & active project isolation
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

  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      sessionStorage.setItem(SESSION_USER_KEY, workspace.currentUserId);
      sessionStorage.setItem(SESSION_PROJECT_KEY, workspace.activeProjectId);
    } catch {
      // Ignore storage quota errors
    }
  }, [workspace]);

  const reconcileServerState = useCallback(
    (incomingWorkspace: JiraWorkspaceState, incomingRevision?: number) => {
      if (
        typeof incomingRevision === 'number' &&
        incomingRevision < revisionRef.current
      ) {
        return;
      }
      if (typeof incomingRevision === 'number') {
        revisionRef.current = incomingRevision;
      }

      setWorkspace((prev) => {
        const keepUserId = incomingWorkspace.users.some(
          (u) => u.id === prev.currentUserId
        )
          ? prev.currentUserId
          : incomingWorkspace.currentUserId;

        const keepProjectId = incomingWorkspace.projects.some(
          (p) => p.id === prev.activeProjectId
        )
          ? prev.activeProjectId
          : incomingWorkspace.activeProjectId;

        return {
          ...incomingWorkspace,
          currentUserId: keepUserId,
          activeProjectId: keepProjectId,
        };
      });
    },
    []
  );

  const dispatchWorkspaceEvent = useCallback(
    async (event: WorkspaceMutationEvent | WorkspaceMutationEvent[]) => {
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
        // Queue events for automatic replay upon reconnection
        pendingEventsRef.current.push(...eventsArray);
      }
    },
    [reconcileServerState]
  );

  // Connect to real-time multi-system SSE stream + auto-reconnect
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectStream = () => {
      if (!isMounted) return;
      const url = `/api/workspace/stream?clientId=${encodeURIComponent(
        clientIdRef.current
      )}&userId=${encodeURIComponent(workspace.currentUserId)}`;

      es = new EventSource(url);

      es.addEventListener('workspace:init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.workspace) {
            reconcileServerState(data.workspace, data.revision);
          }
          if (Array.isArray(data.collaborators)) {
            setCollaborators(data.collaborators);
          }
          // Flush any pending offline mutations
          if (pendingEventsRef.current.length > 0) {
            const queued = [...pendingEventsRef.current];
            pendingEventsRef.current = [];
            void dispatchWorkspaceEvent(queued);
          }
        } catch {
          // Ignore malformed event
        }
      });

      es.addEventListener('workspace:sync', (e: MessageEvent) => {
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

      es.addEventListener('presence:updated', (e: MessageEvent) => {
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

  const [activeTab, setActiveTab] = useState<NavigationTab>(NavigationTab.BOARD);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Modals state
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showScreenshotImporter, setShowScreenshotImporter] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [sprintToStart, setSprintToStart] = useState<Sprint | null>(null);
  const [showCompleteSprintModal, setShowCompleteSprintModal] = useState(false);
  const [importBanner, setImportBanner] = useState<string | null>(null);

  // Global Quick Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const activeProject = useMemo(() => {
    return (
      workspace.projects.find((p) => p.id === workspace.activeProjectId) ||
      workspace.projects[0]
    );
  }, [workspace.projects, workspace.activeProjectId]);

  const currentUser = useMemo(() => {
    return (
      workspace.users.find((u) => u.id === workspace.currentUserId) ||
      workspace.users[0]
    );
  }, [workspace.users, workspace.currentUserId]);

  const projectIssues = useMemo(() => {
    return workspace.issues.filter((i) => i.projectId === activeProject.id);
  }, [workspace.issues, activeProject.id]);

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

  // Core Mutation Handlers (Optimistic UI + Server-Authoritative Event Dispatch)
  const handleUpdateIssue = (issueId: string, updates: Partial<Issue>) => {
    const now = new Date().toISOString();
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.map((iss) => {
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

  const handleQuickCreateIssue = (payload: {
    title: string;
    type: IssueType;
    status: IssueStatus;
    sprintId: string | null;
    epicId: string | null;
  }) => {
    const now = new Date().toISOString();
    const nextNumber = activeProject.issueCounter + 1;
    const newKey = `${activeProject.key}-${nextNumber}`;
    const newIssue: Issue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId: activeProject.id,
      key: newKey,
      title: payload.title,
      description: '',
      type: payload.type,
      status: payload.status,
      priority: IssuePriority.MEDIUM,
      assigneeId: activeProject.defaultAssigneeId || workspace.currentUserId,
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

  const handleFullCreateIssue = (payload: {
    projectId: string;
    title: string;
    description: string;
    type: IssueType;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId: string | null;
    epicId: string | null;
    sprintId: string | null;
    storyPoints: number;
    originalEstimateHours: number;
    componentId: string | null;
    fixVersionId: string | null;
    dueDate: string;
    labels: string[];
  }) => {
    const targetProject =
      workspace.projects.find((p) => p.id === payload.projectId) || activeProject;
    const nextNumber = targetProject.issueCounter + 1;
    const newKey = `${targetProject.key}-${nextNumber}`;
    const now = new Date().toISOString();

    const newIssue: Issue = {
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

  const handleDeleteIssue = (issueId: string) => {
    setWorkspace((prev) => ({
      ...prev,
      issues: prev.issues.filter((i) => i.id !== issueId),
    }));

    void dispatchWorkspaceEvent({
      type: 'issue:deleted',
      payload: { issueId },
    });
  };

  const handleCloneIssue = (source: Issue) => {
    const nextNumber = activeProject.issueCounter + 1;
    const newKey = `${activeProject.key}-${nextNumber}`;
    const now = new Date().toISOString();
    const cloned: Issue = {
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

  const handleAddComment = (issueId: string, body: string) => {
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

  const handleLogWork = (issueId: string, hours: number, comment: string) => {
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
    const newSprint: Sprint = {
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

  const handleConfirmStartSprint = (
    sprintId: string,
    updates: { name: string; goal: string; startDate: string; endDate: string }
  ) => {
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

  const handleConfirmCompleteSprint = (
    sprintId: string,
    destinationSprintId: string | null
  ) => {
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

  const handleDeleteSprint = (sprintId: string) => {
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
  const handleCreateRelease = (payload: {
    name: string;
    description: string;
    releaseDate: string;
  }) => {
    const release: ReleaseVersion = {
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

  const handleToggleReleaseStatus = (releaseId: string) => {
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

  const handleCreateComponent = (payload: {
    name: string;
    description: string;
    leadId: string;
  }) => {
    const component: ProjectComponent = {
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

  // Project & Team Handlers
  const handleUpdateProject = (updates: Partial<Project>) => {
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

  const handleCreateProject = (payload: {
    name: string;
    key: string;
    description: string;
    category: Project['category'];
    template: Project['template'];
    leadId: string;
  }) => {
    const newProjId = `prj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newSprintId = `spr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newProj: Project = {
      id: newProjId,
      key: payload.key,
      name: payload.name,
      description: payload.description,
      category: payload.category,
      template: payload.template,
      leadId: payload.leadId,
      defaultAssigneeId: payload.leadId,
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

    const initialSprint: Sprint = {
      id: newSprintId,
      projectId: newProjId,
      name: `${payload.key} Sprint 1 — Initial Launch`,
      goal: 'Deliver core architecture and MVP stories.',
      status: SprintStatus.ACTIVE,
      startDate: '2026-10-05',
      endDate: '2026-10-19',
    };

    const starterIssue: Issue = {
      id: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      projectId: newProjId,
      key: `${payload.key}-101`,
      title: `Set up foundational architecture and CI/CD pipeline for ${payload.name}`,
      description: 'Initialize repository structure, automated test runner, and deployment workflows.',
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

  const handleAddUser = (payload: {
    name: string;
    email: string;
    role: string;
    department: string;
  }) => {
    const initials = payload.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const user: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      department: payload.department,
      avatarUrl: '',
      initials,
    };
    setWorkspace((prev) => ({
      ...prev,
      users: [...prev.users, user],
    }));

    void dispatchWorkspaceEvent({
      type: 'user:created',
      payload: { user },
    });
  };

  const handleSaveFilter = (name: string, jql: string) => {
    const filter: SavedFilter = {
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

  const handleApplyScreenshotImport = (
    payload: ExtractedJiraPayload,
    mode: 'MERGE_CURRENT' | 'CREATE_NEW_PROJECT'
  ) => {
    const now = new Date().toISOString();

    let syncedWorkspaceSnapshot: JiraWorkspaceState | null = null;

    setWorkspace((prev) => {
      const updatedUsers: User[] = [...prev.users];

      const resolveUserProfile = (
        nameRaw?: string,
        initialsRaw?: string,
        roleRaw?: string,
        emailRaw?: string,
        deptRaw?: string
      ): string | null => {
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
        const newUser: User = {
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
          description: 'Imported directly from Jira screenshot with replicated profiles and task assignments.',
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
          goal: payload.sprintGoal || 'Replicated sprint tasks and assignments from Jira screenshot.',
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

      const epicTitleToId: Record<string, string> = {};
      prev.issues
        .filter((i) => i.projectId === targetProjectId && i.type === IssueType.EPIC)
        .forEach((ep) => {
          epicTitleToId[ep.title.toLowerCase()] = ep.id;
        });

      const createdIssues: Issue[] = [];
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

        let linkedEpicId: string | null = null;
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
            'Imported from Jira screenshot with profile and status assignment.',
          type: iss.type,
          status: iss.status,
          priority: iss.priority,
          assigneeId: matchedAssigneeId,
          reporterId: prev.currentUserId,
          epicId: linkedEpicId,
          sprintId: iss.type === IssueType.EPIC ? null : targetSprintId,
          storyPoints: iss.storyPoints || 0,
          originalEstimateHours: (iss.storyPoints || 2) * 3,
          timeSpentHours: iss.status === IssueStatus.DONE ? (iss.storyPoints || 2) * 3 : 0,
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
        `Imported ${payload.issues.length} tasks and ${payload.profiles.length} team profiles (${newProfilesCreated} newly created) from your Jira screenshot.`
      );
      setTimeout(() => setImportBanner(null), 6000);

      const nextWs: JiraWorkspaceState = {
        ...prev,
        activeProjectId: targetProjectId,
        users: updatedUsers,
        projects: finalProjects,
        sprints: updatedSprints,
        issues: [...prev.issues, ...createdIssues],
      };
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
    const map = new Map<string, { user: User; count: number }>();
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
          Jira
        </a>

        {/* Zone 2: 5 Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
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
            onClick={() => setActiveTab(NavigationTab.TIMELINE)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === NavigationTab.TIMELINE
                ? 'text-white underline underline-offset-8 decoration-2 decoration-blue-400 font-semibold'
                : 'hover:text-white hover:underline underline-offset-8'
            }`}
          >
            Timeline
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
            onChange={(e) =>
              setWorkspace((prev) => ({
                ...prev,
                currentUserId: e.target.value,
              }))
            }
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
                {workspace.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 px-1">
                <span>{activeProject.template} Project</span>
                <span>·</span>
                <span className="truncate">{activeProject.category}</span>
              </div>

              {/* Prominent Screenshot Importer CTA */}
              <button
                type="button"
                onClick={() => setShowScreenshotImporter(true)}
                className="w-full mt-2 py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md flex items-center justify-center gap-2 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                Import Jira Screenshot
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

              {/* Instant Search Results Popover */}
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
                Planning & Execution
              </div>

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
                    : 0}
                </span>
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
              onAddUser={handleAddUser}
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
          projects={workspace.projects}
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

      {/* Screenshot-to-Jira Importer Modal */}
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
