import assert from 'node:assert/strict';
import { parseStructuredStoryFromExtractedText } from '../../src/utils/storyTextParser.js';

// Unit Test 1: Dynamic parsing of a Payment Gateway PDF text (verifies zero hardcoding of KP-6453)
const paymentPdfText = `Billing Platform / PAY-900 Checkout Redesign IN PROGRESS / PAY-914
Story Title
Multi-Currency Settlement & FX Rate Locking
User Story
As a Merchant Administrator,
I want FX rates locked for 15 minutes during checkout,
So that currency fluctuations do not cause settlement mismatches.
Scope / Description
Covers FX rate caching and checkout session expiration:
1. Fetch live FX quote from provider
2. Cache quote with 15-minute TTL
3. Validate quote upon payment capture
Acceptance Criteria
Scenario 1: Quote Within 15-Minute Window
Given a checkout session with locked EUR/USD rate
When the customer completes payment within 15 minutes
Then settlement uses the locked FX rate
Scenario 2: Expired Quote Refresh
Given an expired 15-minute FX lock
When capture is attempted
Then the system prompts for rate refresh
Test Cases to Automate
1. Verify locked FX rate is applied within 15m TTL
2. Verify expired quote triggers rate refresh response
Definition of Done (DoD)
• 100% unit test coverage on FX lock service
• Load tested at 500 req/sec
--- DETAILS SIDEBAR ---
Assignee: Rohan Verma
Reporter: Priya Nair
Priority: Highest
Status: IN REVIEW
Components: Checkout Service
Labels: payments, fx-engine
Story point estimate: 13`;

const parsedPayment = parseStructuredStoryFromExtractedText({
  rawText: paymentPdfText,
  fileName: '[PAY-914] Multi-Currency Settlement - Jira.pdf',
  defaultProjectKey: 'PAY',
});

assert.equal(parsedPayment.issueKey, 'PAY-914');
assert.equal(parsedPayment.parentKey, 'PAY-900');
assert.equal(
  parsedPayment.title,
  'Multi-Currency Settlement & FX Rate Locking'
);
assert.equal(parsedPayment.assigneeName, 'Rohan Verma');
assert.equal(parsedPayment.reporterName, 'Priya Nair');
assert.equal(parsedPayment.priority, 'HIGHEST');
assert.equal(parsedPayment.status, 'IN_REVIEW');
assert.equal(parsedPayment.componentName, 'Checkout Service');
assert.deepEqual(parsedPayment.labels, ['payments', 'fx-engine']);
assert.equal(parsedPayment.storyPoints, 13);
assert.equal(parsedPayment.acceptanceCriteria.length, 2);
assert.equal(parsedPayment.testCases.length, 2);
assert.equal(parsedPayment.definitionOfDone.length, 2);

// Unit Test 2: Dynamic parsing of KP-6453 Vulnerabilities List PDF text from actual text tokens
const kp6453Text = `Kawach Product / KP-5831 Automation Test Cases IN PROGRESS / KP-6453
Automation Test for Vulnerabilities List – Search, Filter and Show Page
Description
Story Title
Automation Test for Vulnerabilities List – Search, Filter and Show Page
User Story
As a Kawach user / QA engineer,
I want automated tests to verify the Vulnerabilities List page functionalities including search, filters, and viewing vulnerability details,
So that we can ensure the vulnerabilities module works reliably and regression issues are caught early.
Scope / Description
This story covers automation testing for the Vulnerabilities section (/vulnerabilities) in the Kawach application.
Acceptance Criteria
Scenario 1: Verify Vulnerabilities List Page Load
Given the user is logged into the Kawach portal
When the user navigates to /vulnerabilities
Then the Vulnerabilities list page should load successfully
Test Cases to Automate
1. Verify navigation to /vulnerabilities page and initial table load
2. Verify search with valid vulnerability name / CVE ID
Definition of Done (DoD)
• Automation scripts written and executed successfully
--- DETAILS SIDEBAR ---
Assignee: Suman Manna
Reporter: Suman Manna
Priority: Medium
Status: TO DO
Components: Frontend SPA
Labels: None
Sprint: None
Story point estimate: None`;

const parsedKp = parseStructuredStoryFromExtractedText({
  rawText: kp6453Text,
  fileName:
    '[KP-6453] Automation Test for Vulnerabilities List – Search, Filter and Show Page - Jira.pdf',
  defaultProjectKey: 'KP',
});

assert.equal(parsedKp.issueKey, 'KP-6453');
assert.equal(parsedKp.parentKey, 'KP-5831');
assert.equal(parsedKp.assigneeName, 'Suman Manna');
assert.deepEqual(parsedKp.labels, []);
assert.equal(parsedKp.storyPoints, 0);
assert.equal(parsedKp.sprintName, 'None');

console.log('All dynamic PDF storyTextParser unit assertions passed!');
