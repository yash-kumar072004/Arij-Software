import assert from 'node:assert/strict';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function runLiveApiTests() {
  console.log(
    '=== Running Phase 6 Live REST API & Email Outbox Integration Tests ==='
  );

  // 1. Verify OpenAPI 3.1 Specification endpoint
  const openApiRes = await fetch(`${BASE_URL}/api/docs/openapi.json`);
  assert.equal(openApiRes.status, 200, 'OpenAPI 3.1 endpoint should return 200');
  const openApiSpec = await openApiRes.json();
  assert.equal(openApiSpec.openapi, '3.1.0');
  console.log('  ✓ Live OpenAPI 3.1 endpoint (/api/docs/openapi.json) verified');

  // 2. Verify Paginated Issues List endpoint
  const issuesRes = await fetch(`${BASE_URL}/api/issues?page=1&limit=5`);
  assert.equal(issuesRes.status, 200, 'GET /api/issues should return 200');
  const issuesData = await issuesRes.json();
  assert.equal(issuesData.page, 1);
  assert.equal(issuesData.limit, 5);
  assert.ok(Array.isArray(issuesData.items), 'Paginated items array present');
  assert.ok(typeof issuesData.total === 'number', 'Total count present');
  console.log(
    `  ✓ Paginated GET /api/issues?page=1&limit=5 verified (${issuesData.items.length} of ${issuesData.total} issues)`
  );

  // 3. Verify Global Search endpoint
  const searchRes = await fetch(
    `${BASE_URL}/api/search?q=${encodeURIComponent('Vulnerabilities')}`
  );
  assert.equal(searchRes.status, 200, 'GET /api/search should return 200');
  const searchData = await searchRes.json();
  assert.ok(Array.isArray(searchData.items));
  console.log(
    `  ✓ Global Search GET /api/search?q=Vulnerabilities verified (${searchData.total} matches)`
  );

  // 4. Verify Email Notification Outbox & SMTP Dispatch
  const emailListRes = await fetch(`${BASE_URL}/api/notifications/emails`);
  assert.equal(emailListRes.status, 200);
  const emailListData = await emailListRes.json();
  assert.equal(emailListData.ok, true);
  assert.ok(Array.isArray(emailListData.emails));

  const sendEmailRes = await fetch(`${BASE_URL}/api/notifications/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'qa.automation@kawach.ai',
      recipientName: 'Kawach QA Bot',
      issueKey: 'KP-6453',
      category: 'E2E_VERIFICATION',
      subject: '[Arij · KP-6453] Automated E2E Verification Digest',
      body: 'All 8 subtasks (KP-6453-1 to KP-6453-8) and 4 Acceptance Criteria scenarios verified.',
    }),
  });
  assert.equal(sendEmailRes.status, 201);
  const sendEmailData = await sendEmailRes.json();
  assert.equal(sendEmailData.ok, true);
  assert.equal(sendEmailData.email.status, 'DELIVERED');
  console.log(
    '  ✓ Transactional Email Outbox (GET/POST /api/notifications/send-email) verified'
  );

  // 5. Verify Reports Summary endpoint (Created vs Resolved & Assignee Workload)
  const reportsRes = await fetch(`${BASE_URL}/api/reports/summary`);
  assert.equal(reportsRes.status, 200);
  const reportsData = await reportsRes.json();
  assert.ok(typeof reportsData.createdVsResolved?.created === 'number');
  assert.ok(Array.isArray(reportsData.workloadPerAssignee));
  console.log(
    '  ✓ Planning & Analytics endpoint (/api/reports/summary) verified'
  );

  console.log('=== ALL LIVE REST API INTEGRATION TESTS PASSED! ===');
}

runLiveApiTests().catch((err) => {
  console.error('Live API Integration test error:', err);
  process.exit(1);
});
