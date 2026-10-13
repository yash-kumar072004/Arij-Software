import crypto from 'crypto';
import { z } from 'zod';

// ============================================================================
// 1. ZOD INPUT VALIDATION SCHEMAS (Phases 1–5)
// ============================================================================

export const SignupSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Display name is required'),
  username: z.string().min(2).optional(),
  role: z.string().optional().default('Software Engineer'),
  department: z.string().optional().default('Engineering'),
});

export const LoginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export const OrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  domain: z.string().optional(),
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional().default('ENTERPRISE'),
});

export const OrgMemberRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

export const ProjectCreateSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z][A-Z0-9]+$/i, 'Project key must be alphanumeric (e.g. PROJ)'),
  name: z.string().min(2, 'Project name is required'),
  description: z.string().optional().default(''),
  template: z.enum(['SCRUM', 'KANBAN', 'BUG_TRACKING']).optional().default('SCRUM'),
  orgId: z.string().optional(),
});

export const WorkflowConfigSchema = z.object({
  statuses: z
    .array(z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE']))
    .min(2),
  allowedTransitions: z.record(z.string(), z.array(z.string())).optional(),
});

export const IssueCreateSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(2, 'Issue title is required').max(300),
  description: z.string().optional().default(''),
  userStory: z.string().optional(),
  scopeDescription: z.string().optional(),
  acceptanceCriteria: z
    .array(
      z.object({
        scenarioTitle: z.string(),
        steps: z.array(z.string()),
      })
    )
    .optional(),
  testCases: z.array(z.string()).optional(),
  definitionOfDone: z.array(z.string()).optional(),
  type: z
    .enum([
      'BUG',
      'TASK',
      'STORY',
      'EPIC',
      'SUBTASK',
      'FEATURE',
      'IMPROVEMENT',
      'INITIATIVE',
      'REQUEST',
      'INCIDENT',
      'PROBLEM',
      'CHANGE',
    ])
    .optional()
    .default('STORY'),
  status: z
    .enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'])
    .optional()
    .default('TODO'),
  priority: z
    .enum(['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST', 'CRITICAL'])
    .optional()
    .default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  reporterId: z.string().optional(),
  epicId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  storyPoints: z.number().min(0).max(100).optional().default(0),
  originalEstimateHours: z.number().min(0).optional().default(0),
  labels: z.array(z.string()).optional().default([]),
  dueDate: z.string().optional(),
  key: z.string().optional(),
  subtasks: z
    .array(
      z.object({
        id: z.string().optional(),
        key: z.string().optional(),
        title: z.string(),
        completed: z.boolean().optional().default(false),
      })
    )
    .optional(),
});

export const IssueUpdateSchema = IssueCreateSchema.partial();

export const CommentCreateSchema = z.object({
  body: z.string().min(1, 'Comment text cannot be empty').max(10000),
  authorId: z.string().optional(),
});

export const AttachmentUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  mimeType: z
    .string()
    .refine(
      (mime) =>
        /^(application\/pdf|image\/(png|jpeg|jpg|webp|gif|svg\+xml)|text\/(plain|markdown|csv)|application\/json|application\/zip|application\/msword|application\/vnd\.openxmlformats)/i.test(
          mime
        ),
      { message: 'Unsupported file type. Allowed: PDF, Images, Markdown, Text, Docs, ZIP.' }
    ),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'Attachment exceeds 10 MB maximum file size limit'),
  dataUrl: z.string().optional(),
});

export const IssueLinkCreateSchema = z.object({
  targetIssueKey: z.string().min(2, 'Target issue key (e.g. KP-6453) is required'),
  linkType: z
    .enum(['BLOCKS', 'IS_BLOCKED_BY', 'RELATES_TO', 'DUPLICATES', 'PARENT_OF', 'CHILD_OF'])
    .default('RELATES_TO'),
});

export const SprintCreateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2, 'Sprint name is required'),
  goal: z.string().optional().default(''),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const SavedFilterSchema = z.object({
  name: z.string().min(2, 'Filter name is required'),
  projectId: z.string().optional(),
  query: z.union([z.string().min(1), z.record(z.string(), z.any())]),
});

// ============================================================================
// 2. JWT ACCESS & REFRESH TOKENS + PASSWORD HASHING (Zero native deps)
// ============================================================================

const ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'arij-enterprise-jwt-access-secret-2026';
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'arij-enterprise-jwt-refresh-secret-2026';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .pbkdf2Sync(String(password), salt, 10000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return true;
  const [salt, originalHash] = storedHash.split(':');
  const candidate = crypto
    .pbkdf2Sync(String(password), salt, 10000, 64, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(originalHash, 'hex'),
    Buffer.from(candidate, 'hex')
  );
}

function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function signJwtToken(payload, type = 'access') {
  const secret = type === 'refresh' ? REFRESH_SECRET : ACCESS_SECRET;
  const expiresInSec = type === 'refresh' ? 7 * 24 * 3600 : 3600;
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    tokenType: type,
    iat: nowSec,
    exp: nowSec + expiresInSec,
  };
  const unsigned = `${base64UrlEncode(header)}.${base64UrlEncode(fullPayload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

export function verifyJwtToken(token, type = 'access') {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const secret = type === 'refresh' ? REFRESH_SECRET : ACCESS_SECRET;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(unsigned)
      .digest('base64url');
    if (parts[2] !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// 3. OPENAPI 3.1 / SWAGGER SPECIFICATION
// ============================================================================
export const ARIJ_OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Arij Enterprise Issue Tracking & Agile Project Management API',
    version: '2.5.0',
    description:
      'REST API for Arij covering JWT Authentication, Organizations & RBAC (Admin/Member/Viewer), Projects with Configurable Workflows, Auto-Incrementing Issues, Dynamic PDF Story Extraction, Kanban Boards, Sprints, Comments with @Mentions, Activity Logs, Attachments, Watchers, Notifications, and Saved Filters.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  paths: {
    '/api/auth/signup': {
      post: {
        tags: ['Phase 1: Auth'],
        summary: 'Register a new user account and provision personal workspace',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  name: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created user + JWT access/refresh tokens' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Phase 1: Auth'],
        summary: 'Authenticate user and issue JWT access and refresh tokens',
        responses: { 200: { description: 'Access token, refresh token, and user profile' } },
      },
    },
    '/api/organizations': {
      get: {
        tags: ['Phase 1: Organizations & RBAC'],
        summary: 'List organizations and member roles (ADMIN, MEMBER, VIEWER)',
      },
      post: {
        tags: ['Phase 1: Organizations & RBAC'],
        summary: 'Create a new organization workspace',
      },
    },
    '/api/projects': {
      get: {
        tags: ['Phase 1 & 2: Projects & Workflows'],
        summary: 'List projects with pagination and configurable workflow transitions',
      },
      post: {
        tags: ['Phase 1 & 2: Projects & Workflows'],
        summary: 'Create project with unique key (e.g. PROJ) and auto-incrementing counter',
      },
    },
    '/api/issues': {
      get: {
        tags: ['Phase 1 & 2: Issues, Filters & Pagination'],
        summary:
          'List issues with pagination (?page=1&limit=20), sorting, and filters (assignee, status, priority, label, type, dueDate, search)',
      },
      post: {
        tags: ['Phase 1: Issues'],
        summary: 'Create a new issue with Zod input validation and auto-incrementing key',
      },
    },
    '/api/issues/{id}': {
      get: {
        tags: ['Phase 1: Issues'],
        summary: 'Get issue detail including comments, activity log, attachments, links, watchers',
      },
      patch: {
        tags: ['Phase 1 & 2: Issues & Workflow Transitions'],
        summary: 'Inline edit issue fields or transition status with automatic audit logging',
      },
      delete: {
        tags: ['Phase 1: Issues'],
        summary: 'Delete an issue (requires ADMIN or MEMBER role)',
      },
    },
    '/api/issues/{id}/comments': {
      post: {
        tags: ['Phase 3: Collaboration'],
        summary: 'Add comment with @mentions parsing and automatic watcher/mention notifications',
      },
    },
    '/api/issues/{id}/activity': {
      get: {
        tags: ['Phase 3: Collaboration'],
        summary: 'Retrieve chronological activity/audit log for an issue',
      },
    },
    '/api/issues/{id}/attachments': {
      post: {
        tags: ['Phase 3: Collaboration'],
        summary: 'Upload attachment with size limit (10MB) and MIME type validation',
      },
    },
    '/api/issues/{id}/links': {
      post: {
        tags: ['Phase 3: Collaboration'],
        summary: 'Create issue link (BLOCKS, IS_BLOCKED_BY, RELATES_TO)',
      },
    },
    '/api/issues/{id}/watchers': {
      post: {
        tags: ['Phase 3: Collaboration'],
        summary: 'Toggle watcher subscription on an issue for in-app notifications',
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Phase 3: Collaboration'],
        summary: 'List in-app notifications for @mentions and watched issue updates',
      },
    },
    '/api/search': {
      get: {
        tags: ['Phase 2: Global Search'],
        summary: 'Global search across issues by key, title, or markdown text (?q=...)',
      },
    },
    '/api/sprints': {
      get: { tags: ['Phase 4: Planning'], summary: 'List sprints across projects' },
      post: { tags: ['Phase 4: Planning'], summary: 'Create a new planned sprint' },
    },
    '/api/sprints/{id}/start': {
      post: { tags: ['Phase 4: Planning'], summary: 'Start a sprint with start/end dates and goal' },
    },
    '/api/sprints/{id}/complete': {
      post: {
        tags: ['Phase 4: Planning'],
        summary: 'Complete sprint and move unfinished issues to backlog or next sprint',
      },
    },
    '/api/reports/summary': {
      get: {
        tags: ['Phase 4: Planning'],
        summary: 'Burndown chart metrics, issues created vs resolved, epic progress, and workload per assignee',
      },
    },
    '/api/saved-filters': {
      get: {
        tags: ['Phase 5: Polish & Saved Filters'],
        summary: 'List saved custom filters and views',
      },
      post: {
        tags: ['Phase 5: Polish & Saved Filters'],
        summary: 'Save a new custom filter or AQL view',
      },
    },
    '/api/arij/extract-story-pdf': {
      post: {
        tags: ['PDF & AI Extraction'],
        summary: 'Dynamically extract structured Story fields, Scenarios, Test Cases, and DoD from uploaded PDF text',
      },
    },
  },
};
