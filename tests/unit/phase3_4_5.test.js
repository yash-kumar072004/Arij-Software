import assert from 'node:assert/strict';
import {
  ARIJ_OPENAPI_SPEC,
  AttachmentUploadSchema,
  CommentCreateSchema,
  IssueLinkCreateSchema,
  SavedFilterSchema,
  SprintCreateSchema,
} from '../../src/utils/apiSchemas.js';

console.log(
  '=== Running Phase 3 (Collaboration), Phase 4 (Planning) & Phase 5 (Polish/OpenAPI) Unit Tests ==='
);

// --- PHASE 3.1: Comments with @Mentions Validation & Parsing ---
{
  const validComment = CommentCreateSchema.safeParse({
    body: 'Hey @Arjun and @Priya, please review the SQL schema and E2E tests.',
    authorId: 'usr-1',
  });
  assert.equal(validComment.success, true, 'Valid @mention comment should pass');
  const mentions = Array.from(
    validComment.data.body.matchAll(/@([a-zA-Z0-9._-]+)/g),
    (m) => m[1]
  );
  assert.deepEqual(
    mentions,
    ['Arjun', 'Priya'],
    'Should extract @mentions from comment body'
  );

  const emptyComment = CommentCreateSchema.safeParse({ body: '' });
  assert.equal(emptyComment.success, false, 'Empty comment should fail validation');
  console.log('✓ Phase 3.1 Passed: Comments with @mentions parsing & Zod validation');
}

// --- PHASE 3.3: Attachments Validation (10 MB Size Limit & Allowed MIME Types) ---
{
  const validPdf = AttachmentUploadSchema.safeParse({
    fileName: '[KP-6453] Automation-Spec.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 284 * 1024,
  });
  assert.equal(validPdf.success, true, 'Valid PDF under 10MB should pass');

  const oversizedFile = AttachmentUploadSchema.safeParse({
    fileName: 'huge-dump.zip',
    mimeType: 'application/zip',
    sizeBytes: 12 * 1024 * 1024, // 12 MB > 10 MB limit
  });
  assert.equal(
    oversizedFile.success,
    false,
    'File exceeding 10MB should be rejected by AttachmentUploadSchema'
  );

  const invalidMime = AttachmentUploadSchema.safeParse({
    fileName: 'malware.exe',
    mimeType: 'application/x-msdownload',
    sizeBytes: 1024,
  });
  assert.equal(
    invalidMime.success,
    false,
    'Disallowed MIME type should be rejected by AttachmentUploadSchema'
  );
  console.log(
    '✓ Phase 3.3 Passed: Attachment size limit (<=10MB) and MIME type validation'
  );
}

// --- PHASE 3.5: Issue Links (BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES) ---
{
  const validLink = IssueLinkCreateSchema.safeParse({
    linkType: 'BLOCKS',
    targetIssueKey: 'KP-6453',
  });
  assert.equal(validLink.success, true, 'Valid BLOCKS link should pass');

  const invalidLink = IssueLinkCreateSchema.safeParse({
    linkType: 'UNKNOWN_RELATION',
    targetIssueKey: 'KP-6453',
  });
  assert.equal(invalidLink.success, false, 'Invalid linkType should be rejected');
  console.log(
    '✓ Phase 3.5 Passed: Issue Links (BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES)'
  );
}

// --- PHASE 4.1: Sprints Creation & Planning Validation ---
{
  const validSprint = SprintCreateSchema.safeParse({
    projectId: 'prj-1',
    name: 'KP Sprint 23 — Security Hardening',
    goal: 'Zero high-severity vulnerabilities in production',
    startDate: '2026-10-15',
    endDate: '2026-10-29',
  });
  assert.equal(validSprint.success, true, 'Valid sprint payload should pass');

  const invalidSprint = SprintCreateSchema.safeParse({
    projectId: 'prj-1',
    name: 'A', // Too short
  });
  assert.equal(invalidSprint.success, false, 'Too short sprint name should fail');
  console.log('✓ Phase 4.1 Passed: Sprint creation and lifecycle schema validation');
}

// --- PHASE 5.1 & 5.5: Saved Filters & OpenAPI 3.1 Specification ---
{
  const validFilter = SavedFilterSchema.safeParse({
    name: 'Critical Unresolved Blockers',
    projectId: 'prj-1',
    query: 'project = KP AND priority = "HIGHEST" AND status != "DONE"',
  });
  assert.equal(validFilter.success, true, 'Valid saved filter should pass');

  assert.equal(
    ARIJ_OPENAPI_SPEC.openapi,
    '3.1.0',
    'OpenAPI spec version should be 3.1.0'
  );
  assert.ok(
    ARIJ_OPENAPI_SPEC.paths['/api/issues'],
    'OpenAPI spec should document /api/issues'
  );
  assert.ok(
    ARIJ_OPENAPI_SPEC.paths['/api/sprints'],
    'OpenAPI spec should document /api/sprints'
  );
  assert.ok(
    ARIJ_OPENAPI_SPEC.paths['/api/search'],
    'OpenAPI spec should document /api/search'
  );
  console.log(
    '✓ Phase 5.1 & 5.5 Passed: Saved Filters schema & OpenAPI 3.1 specification verified'
  );
}

console.log('=== ALL PHASE 3, PHASE 4 & PHASE 5 UNIT TESTS PASSED! ===');
