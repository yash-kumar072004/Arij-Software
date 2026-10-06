export enum IssueType {
  EPIC = 'EPIC',
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
  SUBTASK = 'SUBTASK',
}

export enum IssueStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  QA = 'QA',
  DONE = 'DONE',
}

export enum IssuePriority {
  HIGHEST = 'HIGHEST',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  LOWEST = 'LOWEST',
}

export enum SprintStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum LinkType {
  BLOCKS = 'blocks',
  IS_BLOCKED_BY = 'is blocked by',
  RELATES_TO = 'relates to',
  DUPLICATES = 'duplicates',
}

export enum NavigationTab {
  BOARD = 'BOARD',
  BACKLOG = 'BACKLOG',
  TIMELINE = 'TIMELINE',
  ISSUES = 'ISSUES',
  REPORTS = 'REPORTS',
  RELEASES = 'RELEASES',
  SETTINGS = 'SETTINGS',
}

export enum SwimlaneMode {
  NONE = 'NONE',
  EPIC = 'EPIC',
  ASSIGNEE = 'ASSIGNEE',
  PRIORITY = 'PRIORITY',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string;
  initials: string;
  department: string;
}

export interface SubtaskItem {
  id: string;
  key: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
}

export interface IssueLink {
  id: string;
  type: LinkType;
  targetIssueId: string;
}

export interface IssueComment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkLogEntry {
  id: string;
  authorId: string;
  hoursSpent: number;
  comment: string;
  loggedAt: string;
}

export interface AuditHistoryItem {
  id: string;
  actorId: string;
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  projectId: string;
  key: string; // e.g., KAW-101
  title: string;
  description: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string | null;
  reporterId: string;
  epicId: string | null;
  sprintId: string | null; // null = Backlog
  storyPoints: number;
  originalEstimateHours: number;
  timeSpentHours: number;
  remainingEstimateHours: number;
  labels: string[];
  componentId: string | null;
  fixVersionId: string | null;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  subtasks: SubtaskItem[];
  links: IssueLink[];
  comments: IssueComment[];
  workLogs: WorkLogEntry[];
  history: AuditHistoryItem[];
  watcherIds: string[];
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  completedAt?: string;
  committedPoints?: number;
  completedPoints?: number;
}

export interface ReleaseVersion {
  id: string;
  projectId: string;
  name: string;
  description: string;
  releaseDate: string;
  status: 'UNRELEASED' | 'RELEASED';
  createdAt: string;
}

export interface ProjectComponent {
  id: string;
  projectId: string;
  name: string;
  description: string;
  leadId: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  category: 'Software Engineering' | 'Platform Infrastructure' | 'Security & Compliance' | 'Product Design';
  template: 'Scrum' | 'Kanban';
  leadId: string;
  defaultAssigneeId: string | null;
  issueCounter: number;
  wipLimits: Record<IssueStatus, number>; // 0 = no limit
  createdAt: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  jql: string;
  isSystem?: boolean;
}

export interface JiraWorkspaceState {
  currentUserId: string;
  activeProjectId: string;
  users: User[];
  projects: Project[];
  sprints: Sprint[];
  issues: Issue[];
  releases: ReleaseVersion[];
  components: ProjectComponent[];
  savedFilters: SavedFilter[];
}
