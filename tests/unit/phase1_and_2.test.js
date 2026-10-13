import assert from 'node:assert/strict';
import {
  hashPassword,
  IssueCreateSchema,
  IssueUpdateSchema,
  LoginSchema,
  OrganizationSchema,
  OrgMemberRoleSchema,
  ProjectCreateSchema,
  SignupSchema,
  signJwtToken,
  verifyJwtToken,
  verifyPassword,
  WorkflowConfigSchema,
} from '../../src/utils/apiSchemas.js';
import { parseStructuredStoryFromExtractedText } from '../../src/utils/storyTextParser.js';

// ============================================================================
// PHASE 1 TESTS: Auth (JWT + Hashing), Organizations (RBAC), Projects, Issues
// ============================================================================

// 1. Password Hashing & Verification
const rawPassword = 'SuperSecretPassword!2026';
const hashed = hashPassword(rawPassword);
assert.equal(verifyPassword(rawPassword, hashed), true, 'Valid password must verify');
assert.equal(verifyPassword('WrongPassword', hashed), false, 'Invalid password must fail');

// 2. JWT Access & Refresh Token Signing and Verification
const accessToken = signJwtToken(
  { sub: 'usr-1', email: 'arjun.mehta@kawach.ai', role: 'ADMIN' },
  'access'
);
const decoded = verifyJwtToken(accessToken, 'access');
assert.ok(decoded, 'Signed JWT token must verify cleanly');
assert.equal(decoded.sub, 'usr-1');
assert.equal(decoded.role, 'ADMIN');

const refreshToken = signJwtToken(
  { sub: 'usr-1', email: 'arjun.mehta@kawach.ai', role: 'ADMIN' },
  'refresh'
);
const decodedRefresh = verifyJwtToken(refreshToken, 'refresh');
assert.ok(decodedRefresh, 'Signed JWT refresh token must verify cleanly');

// 3. Zod Input Validation for Auth, Organization RBAC, Project Key, and Issue CRUD
const validSignup = SignupSchema.safeParse({
  email: 'priya.nair@kawach.ai',
  password: 'Password123!',
  name: 'Priya Nair',
  role: 'Staff Security Engineer',
});
assert.equal(validSignup.success, true, 'SignupSchema should accept valid user');

const validLogin = LoginSchema.safeParse({
  email: 'arjun.mehta@kawach.ai',
  password: 'Password123!',
});
assert.equal(validLogin.success, true, 'LoginSchema should accept valid credentials');

const validOrg = OrganizationSchema.safeParse({
  name: 'Kawach Security Cloud',
  domain: 'kawach.ai',
  plan: 'ENTERPRISE',
});
assert.equal(validOrg.success, true, 'OrganizationSchema should validate org');

const validMemberRole = OrgMemberRoleSchema.safeParse({
  userId: 'usr-2',
  role: 'ADMIN',
});
assert.equal(validMemberRole.success, true, 'OrgMemberRoleSchema should validate RBAC role');

const validProject = ProjectCreateSchema.safeParse({
  name: 'Cloud Runtime Protection',
  key: 'CRP',
  template: 'SCRUM',
});
assert.equal(validProject.success, true, 'ProjectCreateSchema should validate unique key');

const invalidProjectKey = ProjectCreateSchema.safeParse({
  name: 'Invalid Key Project',
  key: 'x', // Too short (< 2 chars)
});
assert.equal(invalidProjectKey.success, false, 'Single-char project key must be rejected');

const validIssue = IssueCreateSchema.safeParse({
  projectId: 'prj-kawach',
  title: 'Fix memory leak in eBPF ring buffer consumer',
  description: '## Root Cause\nRing buffer pages were not released when `poll()` timed out.',
  type: 'BUG',
  status: 'TODO',
  priority: 'HIGH',
  labels: ['ebpf', 'memory-leak'],
  storyPoints: 5,
  dueDate: '2026-10-25',
});
assert.equal(validIssue.success, true, 'IssueCreateSchema should validate full issue payload');

const validPatch = IssueUpdateSchema.safeParse({
  status: 'IN_PROGRESS',
  storyPoints: 8,
  priority: 'HIGHEST',
});
assert.equal(validPatch.success, true, 'IssueUpdateSchema should validate inline edits');

// ============================================================================
// PHASE 2 TESTS: Configurable Workflows & Dynamic Story Extraction
// ============================================================================

const validWorkflow = WorkflowConfigSchema.safeParse({
  statuses: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
  allowedTransitions: {
    TODO: ['IN_PROGRESS'],
    IN_PROGRESS: ['IN_REVIEW', 'TODO'],
    IN_REVIEW: ['QA', 'IN_PROGRESS'],
    QA: ['DONE', 'IN_PROGRESS'],
    DONE: ['TODO'],
  },
});
assert.equal(validWorkflow.success, true, 'WorkflowConfigSchema should validate transition map');

// Verify dynamic story text parser never injects hardcoded fallback text on a plain Markdown issue
const plainMarkdownParsed = parseStructuredStoryFromExtractedText(
  '## Overview\nImplement Redis rate limiting for `/api/auth/login`.'
);
assert.equal(
  plainMarkdownParsed.title.includes('Vulnerabilities'),
  false,
  'Parser must never inject Vulnerabilities List into unrelated text'
);

console.log('✅ All Phase 1 (Core) & Phase 2 (Workflow and Boards) tests passed!');
