import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  GitPullRequest,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import { STATUS_CONFIG, STATUS_ORDER } from './ArijPrimitives.jsx';

export const AutomationAndWorkflowsView = ({
  project,
  issues,
  users,
  currentUserId,
  onUpdateIssue,
  onAddComment,
}) => {
  // 'AUTOMATION_RULES' | 'WORKFLOW_ENGINE' | 'WEBHOOKS'
  const [subTab, setSubTab] = useState('AUTOMATION_RULES');

  // ==================== 1. AUTOMATION RULES (WHEN -> IF -> THEN + SMART VALUES) ====================
  const [rules, setRules] = useState([
    {
      id: 'rule-1',
      name: 'Auto-Notify Manager & Stamp Smart Value When High Priority Issue Moves to Done',
      enabled: true,
      trigger: 'WHEN Issue Status transitions to DONE',
      condition: 'IF Priority IN (HIGHEST, HIGH)',
      actionType: 'ADD_SMART_COMMENT',
      smartTemplate:
        'Automated Arij Rule: {{issue.key}} ({{issue.title}}) completed by {{issue.assignee}} at {{now}}. Verified SLA compliance.',
      runsCount: 14,
      lastRunAt: '2026-10-06 09:30',
    },
    {
      id: 'rule-2',
      name: 'Auto-Assign Unassigned Critical Bugs to Project Lead',
      enabled: true,
      trigger: 'WHEN Issue Created or Updated',
      condition: 'IF Type = BUG AND Assignee is Empty',
      actionType: 'ASSIGN_PROJECT_LEAD',
      smartTemplate:
        'Assigned {{issue.key}} to project lead automatically via Arij Triage Rule.',
      runsCount: 8,
      lastRunAt: '2026-10-06 08:15',
    },
    {
      id: 'rule-3',
      name: 'CI/CD Pull Request Merged -> Transition Linked Issue to QA Testing',
      enabled: true,
      trigger: 'WHEN GitHub Pull Request Merged',
      condition: 'IF Status = IN_REVIEW',
      actionType: 'TRANSITION_TO_QA',
      smartTemplate:
        'PR merged for {{issue.key}}. Automatically transitioned to QA Testing.',
      runsCount: 21,
      lastRunAt: '2026-10-05 18:40',
    },
  ]);

  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('WHEN Issue Status Changes');
  const [ruleCondition, setRuleCondition] = useState('IF Priority = HIGH');
  const [ruleActionType, setRuleActionType] = useState('ADD_SMART_COMMENT');
  const [ruleSmartTemplate, setRuleSmartTemplate] = useState(
    'Arij Automation executed on {{issue.key}}: "{{issue.title}}" (Priority: {{issue.priority}}) at {{now}}'
  );
  const [executionLogs, setExecutionLogs] = useState([
    {
      id: 'alog-1',
      timestamp: '2026-10-06 09:30:12',
      ruleName: 'Auto-Notify Manager & Stamp Smart Value',
      detail: 'Evaluated KAW-101 — Condition matched (Priority = HIGHEST). Posted smart-value comment.',
    },
  ]);

  const handleCreateRule = (e) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    const newRule = {
      id: `rule-${Date.now()}`,
      name: ruleName.trim(),
      enabled: true,
      trigger: ruleTrigger,
      condition: ruleCondition,
      actionType: ruleActionType,
      smartTemplate: ruleSmartTemplate,
      runsCount: 0,
      lastRunAt: 'Never',
    };
    setRules((prev) => [newRule, ...prev]);
    setRuleName('');
  };

  // Execute a rule live against the active project's issues and interpolate Smart Values!
  const handleRunRuleNow = (rule) => {
    const targetIssue =
      issues.find((i) => i.type !== IssueType.EPIC) || issues[0];
    if (!targetIssue) return;

    const assigneeUser = users.find((u) => u.id === targetIssue.assigneeId);
    const interpolated = (rule.smartTemplate || '')
      .replace(/\{\{issue\.key\}\}/g, targetIssue.key)
      .replace(/\{\{issue\.title\}\}/g, targetIssue.title)
      .replace(/\{\{issue\.priority\}\}/g, targetIssue.priority)
      .replace(/\{\{issue\.status\}\}/g, targetIssue.status)
      .replace(
        /\{\{issue\.assignee\}\}/g,
        assigneeUser ? assigneeUser.name : 'Unassigned'
      )
      .replace(/\{\{now\}\}/g, new Date().toLocaleTimeString());

    if (rule.actionType === 'ASSIGN_PROJECT_LEAD') {
      onUpdateIssue(targetIssue.id, { assigneeId: project.leadId });
    } else if (rule.actionType === 'TRANSITION_TO_QA') {
      onUpdateIssue(targetIssue.id, { status: IssueStatus.QA });
    }
    onAddComment(targetIssue.id, interpolated);

    setRules((prev) =>
      prev.map((r) =>
        r.id === rule.id
          ? {
              ...r,
              runsCount: r.runsCount + 1,
              lastRunAt: new Date().toLocaleTimeString(),
            }
          : r
      )
    );

    setExecutionLogs((prev) => [
      {
        id: `alog-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        ruleName: rule.name,
        detail: `Executed on ${targetIssue.key}: "${interpolated}"`,
      },
      ...prev,
    ]);
  };

  // ==================== 2. WORKFLOW CONDITIONS, VALIDATORS & POST-FUNCTIONS (Section 6) ====================
  const [workflowRules, setWorkflowRules] = useState([
    {
      id: 'wf-1',
      fromStatus: IssueStatus.IN_PROGRESS,
      toStatus: IssueStatus.IN_REVIEW,
      condition: 'Only assigned Developer or Project Lead can transition to In Review',
      validator: 'Story Points must be > 0 and Pull Request branch linked',
      postFunction: 'Automatically notify code reviewers and log transition in history',
    },
    {
      id: 'wf-2',
      fromStatus: IssueStatus.QA,
      toStatus: IssueStatus.DONE,
      condition: 'QA Engineer or Project Admin role required',
      validator: 'All Subtasks must be completed before marking Done',
      postFunction: 'Set Remaining Estimate to 0h and set Resolution = Fixed',
    },
  ]);

  // ==================== 3. WEBHOOKS (Section 30) ====================
  const [webhooks, setWebhooks] = useState([
    {
      id: 'wh-1',
      name: 'GitHub Actions & Deployment Trigger Webhook',
      url: 'https://ci.kawach.ai/webhooks/arij-events',
      events: ['issue:created', 'issue:status_changed', 'sprint:completed'],
      active: true,
      lastDeliveryStatus: '200 OK (18ms)',
    },
    {
      id: 'wh-2',
      name: 'Slack #engineering-alerts Channel Stream',
      url: 'https://hooks.slack.com/services/T000/B000/ARIJLIVE',
      events: ['issue:created', 'sprint:started', 'release:published'],
      active: true,
      lastDeliveryStatus: '200 OK (24ms)',
    },
  ]);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');

  const handleAddWebhook = (e) => {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) return;
    setWebhooks((prev) => [
      ...prev,
      {
        id: `wh-${Date.now()}`,
        name: whName.trim(),
        url: whUrl.trim(),
        events: ['issue:created', 'issue:updated', 'sprint:completed'],
        active: true,
        lastDeliveryStatus: 'Ready (Verified)',
      },
    ]);
    setWhName('');
    setWhUrl('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Arij Automate Pillar
            </span>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Automation Rules (`WHEN → IF → THEN`), Workflows &amp; Webhooks
          </h1>
        </div>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('AUTOMATION_RULES')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'AUTOMATION_RULES'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Automation Rules
          </button>
          <button
            type="button"
            onClick={() => setSubTab('WORKFLOW_ENGINE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'WORKFLOW_ENGINE'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Workflow Conditions &amp; Validators
          </button>
          <button
            type="button"
            onClick={() => setSubTab('WEBHOOKS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'WEBHOOKS'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            Webhooks
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {subTab === 'AUTOMATION_RULES' && (
          <>
            {/* Create Automation Rule Builder */}
            <form
              onSubmit={handleCreateRule}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Create New Automation Rule (Supports Smart Values:{' '}
                  <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {'{{issue.key}}'}
                  </code>{' '}
                  <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {'{{issue.title}}'}
                  </code>{' '}
                  <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {'{{issue.assignee}}'}
                  </code>{' '}
                  <code className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {'{{now}}'}
                  </code>
                  )
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Rule Name (e.g. Escalate High Priority Bugs)..."
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
                <select
                  value={ruleTrigger}
                  onChange={(e) => setRuleTrigger(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-medium"
                >
                  <option>WHEN Issue Status Changes</option>
                  <option>WHEN Issue Created</option>
                  <option>WHEN Sprint Started</option>
                  <option>WHEN Sprint Completed</option>
                  <option>WHEN Pull Request Merged</option>
                  <option>WHEN Build Failed</option>
                </select>
                <select
                  value={ruleCondition}
                  onChange={(e) => setRuleCondition(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-medium"
                >
                  <option>IF Priority = HIGH or HIGHEST</option>
                  <option>IF Type = BUG</option>
                  <option>IF Assignee is Unassigned</option>
                  <option>IF Story Points &gt; 5</option>
                </select>
                <select
                  value={ruleActionType}
                  onChange={(e) => setRuleActionType(e.target.value)}
                  className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-medium"
                >
                  <option value="ADD_SMART_COMMENT">
                    THEN Add Smart-Value Comment
                  </option>
                  <option value="ASSIGN_PROJECT_LEAD">
                    THEN Assign to Project Lead
                  </option>
                  <option value="TRANSITION_TO_QA">
                    THEN Transition Issue to QA Testing
                  </option>
                </select>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={ruleSmartTemplate}
                  onChange={(e) => setRuleSmartTemplate(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save Automation Rule
                </button>
              </div>
            </form>

            {/* Active Automation Rules List */}
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rule.enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {rule.name}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-blue-50 text-blue-800 font-mono font-semibold">
                        {rule.trigger}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-mono font-semibold">
                        {rule.condition}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="px-2 py-1 rounded bg-purple-50 text-purple-800 font-mono font-semibold">
                        {rule.actionType}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                      Smart Value Template: {rule.smartTemplate}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 mr-2">
                      {rule.runsCount} runs · Last: {rule.lastRunAt}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRunRuleNow(rule)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      Run Rule Now
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Automation Execution Audit Trail */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Automation Execution Log
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {executionLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-2 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">
                        {log.ruleName}:
                      </span>{' '}
                      <span className="text-slate-600">{log.detail}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {log.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ====================================================================
            TAB 2: WORKFLOW ENGINE (Statuses, Transitions, Conditions, Validators, Post-Functions)
           ==================================================================== */}
        {subTab === 'WORKFLOW_ENGINE' && (
          <div className="space-y-5">
            {/* Visual Workflow Status Pipeline */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Active Arij Workflow Pipeline ({project.key} Default Scheme)
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                {STATUS_ORDER.map((st, idx) => (
                  <React.Fragment key={st}>
                    <div className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-2">
                      <span>{STATUS_CONFIG[st].label}</span>
                      <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">
                        {st}
                      </span>
                    </div>
                    {idx < STATUS_ORDER.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Transition Conditions, Validators & Post-Functions */}
            <div className="space-y-3">
              {workflowRules.map((wf) => (
                <div
                  key={wf.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="px-2.5 py-1 rounded bg-slate-100 font-mono">
                      {STATUS_CONFIG[wf.fromStatus]?.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-mono">
                      {STATUS_CONFIG[wf.toStatus]?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-bold text-slate-700 mb-1">
                        1. Transition Condition
                      </div>
                      <p className="text-slate-600">{wf.condition}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-bold text-slate-700 mb-1">
                        2. Field &amp; Subtask Validator
                      </div>
                      <p className="text-slate-600">{wf.validator}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-bold text-slate-700 mb-1">
                        3. Automated Post-Function
                      </div>
                      <p className="text-slate-600">{wf.postFunction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: WEBHOOKS MANAGER (Section 30)
           ==================================================================== */}
        {subTab === 'WEBHOOKS' && (
          <div className="space-y-5">
            <form
              onSubmit={handleAddWebhook}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3"
            >
              <input
                type="text"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Webhook Name (e.g. Jenkins Production Pipeline)..."
                className="flex-1 min-w-[200px] px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="url"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="Payload URL (https://...)"
                className="flex-1 min-w-[260px] px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Register Webhook
              </button>
            </form>

            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <h4 className="text-sm font-bold text-slate-900">
                        {wh.name}
                      </h4>
                    </div>
                    <div className="font-mono text-xs text-blue-700">
                      {wh.url}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {wh.events.map((ev) => (
                        <span
                          key={ev}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded border border-emerald-200">
                    Last Delivery: {wh.lastDeliveryStatus}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
