import { test, expect } from '@playwright/test';

test.describe('Arij Full-Stack Issue Tracking & Agile Platform E2E', () => {
  test('1. Create Issue flow & inline detail verification', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Arij').first()).toBeVisible();

    // Open Create Issue modal via create button
    await page.click('button:has-text("Create")');
    await expect(page.locator('h2:has-text("Create Issue")')).toBeVisible();

    const uniqueTitle = `E2E OAuth Token Rotation Verification ${Date.now()}`;
    await page.fill(
      'input[placeholder*="Short, actionable summary"]',
      uniqueTitle
    );
    await page.fill(
      'textarea[placeholder*="Describe technical context"]',
      'Verify JWT access and refresh token rotation under concurrent load.'
    );
    await page.click('button[type="submit"]:has-text("Create Issue")');

    // Issue card should appear on the board or in modal
    await expect(page.locator(`text=${uniqueTitle}`).first()).toBeVisible();
  });

  test('2. Dynamic PDF Text Extraction (Zero Hardcoding) & Story Creation', async ({
    request,
  }) => {
    const customStoryText = `Billing Platform / FIN-100 Payment Gateway Epic IN PROGRESS / FIN-402
Story Title
Stripe Webhook Idempotency & Retry Queue
User Story
As a Billing Engineer,
I want incoming Stripe webhook events deduplicated by event_id,
So that duplicate network deliveries never double-charge customers.
Scope / Description
Implement Redis idempotency lock and dead-letter queue for /webhooks/stripe:
1. Validate Stripe-Signature header
2. Check event_id in idempotency table
3. Process invoice.payment_succeeded event
Acceptance Criteria
Scenario 1: Valid First-Time Webhook Delivery
Given a valid signed Stripe event evt_101
When POST /webhooks/stripe is called
Then the event is processed and returns HTTP 200
Test Cases to Automate
1. Verify valid signature returns 200 OK
2. Verify duplicate event_id returns 200 idempotent response
Definition of Done (DoD)
• Unit and integration tests passing in CI
• Idempotency key TTL configured to 72 hours
--- DETAILS SIDEBAR ---
Assignee: Priya Nair
Reporter: Arjun Mehta
Priority: High
Status: IN PROGRESS
Components: Backend API
Story point estimate: 8`;

    const res = await request.post('/api/arij/extract-story-pdf', {
      data: {
        fileName: '[FIN-402] Stripe Webhook Idempotency - Jira.pdf',
        extractedTextHint: customStoryText,
        projectKey: 'FIN',
      },
    });
    expect(res.ok()).toBeTruthy();
    const parsed = await res.json();

    expect(parsed.issueKey).toBe('FIN-402');
    expect(parsed.parentKey).toBe('FIN-100');
    expect(parsed.title).toBe('Stripe Webhook Idempotency & Retry Queue');
    expect(parsed.assigneeName).toBe('Priya Nair');
    expect(parsed.priority).toBe('HIGH');
    expect(parsed.status).toBe('IN_PROGRESS');
    expect(parsed.storyPoints).toBe(8);
    expect(parsed.acceptanceCriteria.length).toBe(1);
    expect(parsed.testCases).toEqual([
      'Verify valid signature returns 200 OK',
      'Verify duplicate event_id returns 200 idempotent response',
    ]);
  });

  test('3. Kanban Board status transition & Activity Audit Log', async ({
    request,
  }) => {
    const createRes = await request.post('/api/issues', {
      data: {
        title: 'Kanban Drag Transition Test Issue',
        type: 'TASK',
        status: 'TODO',
        priority: 'HIGH',
        storyPoints: 5,
      },
    });
    expect(createRes.status()).toBe(201);
    const { issue } = await createRes.json();

    // Move from TODO -> IN_PROGRESS
    const patchRes = await request.patch(`/api/issues/${issue.id}`, {
      data: { status: 'IN_PROGRESS' },
    });
    expect(patchRes.ok()).toBeTruthy();

    // Verify Activity Log recorded the transition
    const actRes = await request.get(`/api/issues/${issue.id}/activity`);
    const logs = await actRes.json();
    expect(
      logs.some(
        (l: any) =>
          l.field === 'status' &&
          l.oldValue === 'TODO' &&
          l.newValue === 'IN_PROGRESS'
      )
    ).toBeTruthy();
  });

  test('4. Comment with @mentions & In-App Notification generation', async ({
    request,
  }) => {
    const issuesRes = await request.get('/api/issues?page=1&limit=5');
    const paginated = await issuesRes.json();
    expect(paginated.pagination).toBeDefined();
    const targetIssue = paginated.data[0];

    const commentRes = await request.post(
      `/api/issues/${targetIssue.id}/comments`,
      {
        data: {
          body: 'Hey @Arjun please review the updated SQL migration schema.',
        },
      }
    );
    expect(commentRes.status()).toBe(201);
    const { comment } = await commentRes.json();
    expect(comment.mentions).toContain('Arjun');

    const notifRes = await request.get('/api/notifications');
    const notifs = await notifRes.json();
    expect(notifs.some((n: any) => n.category === 'MENTION')).toBeTruthy();
  });

  test('5. Sprint Lifecycle: Create, Start, and Complete Sprint', async ({
    request,
  }) => {
    const sprintRes = await request.post('/api/sprints', {
      data: {
        projectId: 'prj-1',
        name: 'Sprint 45 — E2E Verification',
        goal: 'Complete automated E2E suite',
      },
    });
    expect(sprintRes.status()).toBe(201);
    const sprint = await sprintRes.json();

    const startRes = await request.post(`/api/sprints/${sprint.id}/start`, {
      data: { goal: 'Updated active sprint goal' },
    });
    expect(startRes.ok()).toBeTruthy();

    const completeRes = await request.post(
      `/api/sprints/${sprint.id}/complete`,
      {
        data: { destinationSprintId: null },
      }
    );
    expect(completeRes.ok()).toBeTruthy();
  });
});
