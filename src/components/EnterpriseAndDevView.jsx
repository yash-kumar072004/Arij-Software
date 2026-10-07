import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  GitBranch,
  GitPullRequest,
  KeyRound,
  Lock,
  Play,
  Plus,
  Puzzle,
  Shield,
  Sliders,
  Terminal,
  Users,
} from 'lucide-react';
import { UserAvatar } from './ArijPrimitives.jsx';

export const EnterpriseAndDevView = ({
  project,
  issues,
  users,
  currentUser,
  onAddUser,
}) => {
  // 'DEV_CICD' | 'ORG_RBAC' | 'CUSTOM_FIELDS_TIME' | 'API_PLUGINS_AUDIT'
  const [subTab, setSubTab] = useState('DEV_CICD');

  // ==================== 1. DEVELOPER GIT, PRs, BUILDS & CI/CD DEPLOYMENTS (Sections 27 & 28) ====================
  const [deployments, setDeployments] = useState([
    {
      id: 'dep-1',
      issueKey: issues[0]?.key || 'KAW-101',
      branch: `feature/${(issues[0]?.key || 'kaw-101').toLowerCase()}-ebpf-telemetry`,
      prNumber: '#42',
      commitHash: 'a8f92d1',
      buildStatus: 'PASSED',
      environment: 'Production (ap-south-1)',
      deployedAt: '2026-10-06 09:15',
    },
    {
      id: 'dep-2',
      issueKey: issues[1]?.key || 'KAW-102',
      branch: `feat/${(issues[1]?.key || 'kaw-102').toLowerCase()}-zero-trust-rbac`,
      prNumber: '#48',
      commitHash: '7c4e11b',
      buildStatus: 'PASSED',
      environment: 'Staging (pre-prod)',
      deployedAt: '2026-10-06 10:02',
    },
  ]);

  const handleTriggerPipeline = () => {
    const sampleIssue = issues[0] || { key: `${project.key}-101` };
    setDeployments((prev) => [
      {
        id: `dep-${Date.now()}`,
        issueKey: sampleIssue.key,
        branch: `release/${sampleIssue.key.toLowerCase()}-hotfix`,
        prNumber: `#${50 + prev.length}`,
        commitHash: Math.random().toString(16).slice(2, 9),
        buildStatus: 'PASSED',
        environment: 'Production (Global Edge)',
        deployedAt: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  // ==================== 2. ORGANIZATION, AUTH, SSO/2FA & RBAC PERMISSIONS (Sections 1, 2, 21) ====================
  const [orgName, setOrgName] = useState('Kawach AI Enterprise Organization');
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(true);
  const [apiTokens, setApiTokens] = useState([
    {
      id: 'tok-1',
      name: 'GitHub Actions CI/CD Runner Token',
      prefix: 'arij_pat_9f82a...31c',
      created: '2026-10-01',
    },
  ]);
  const [newTokenName, setNewTokenName] = useState('');

  const handleCreateToken = (e) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    setApiTokens((prev) => [
      ...prev,
      {
        id: `tok-${Date.now()}`,
        name: newTokenName.trim(),
        prefix: `arij_pat_${Math.random().toString(36).slice(2, 10)}`,
        created: '2026-10-06',
      },
    ]);
    setNewTokenName('');
  };

  // ==================== 3. CUSTOM FIELDS & TIME TRACKING TIMESHEETS (Sections 5 & 18) ====================
  const [customFields, setCustomFields] = useState([
    {
      id: 'cf-1',
      name: 'Customer SLA Tier',
      fieldType: 'Dropdown (Enterprise / Mid-Market / Free)',
      required: true,
      scope: 'All Issue Types',
    },
    {
      id: 'cf-2',
      name: 'Security CVE Identifier',
      fieldType: 'Text Field (Regex Validated)',
      required: false,
      scope: 'Bug & Incident Only',
    },
    {
      id: 'cf-3',
      name: 'Target Deployment Window',
      fieldType: 'Date/Time Picker',
      required: false,
      scope: 'Release & Change',
    },
  ]);
  const [cfName, setCfName] = useState('');
  const [cfType, setCfType] = useState('Text Field');

  const handleAddCustomField = (e) => {
    e.preventDefault();
    if (!cfName.trim()) return;
    setCustomFields((prev) => [
      ...prev,
      {
        id: `cf-${Date.now()}`,
        name: cfName.trim(),
        fieldType: cfType,
        required: false,
        scope: project.name,
      },
    ]);
    setCfName('');
  };

  // ==================== 4. MARKETPLACE PLUGINS & AUDIT LOGS (Sections 29, 31, 32, 42) ====================
  const [plugins, setPlugins] = useState([
    {
      id: 'plg-1',
      name: 'GitHub & GitLab Smart Commits Connector',
      category: 'Developer Tools',
      installed: true,
    },
    {
      id: 'plg-2',
      name: 'Slack & Microsoft Teams Incident Alerting',
      category: 'Communication',
      installed: true,
    },
    {
      id: 'plg-3',
      name: 'Figma & Confluence Live Design Embeds',
      category: 'Documentation',
      installed: false,
    },
  ]);

  const handleExportWorkspaceJson = () => {
    const payload = JSON.stringify(
      {
        exportedFrom: 'Arij Enterprise Platform',
        project,
        issuesCount: issues.length,
        issues,
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.key.toLowerCase()}-arij-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWorkspaceCsv = () => {
    const headers = [
      'Key',
      'Type',
      'Status',
      'Priority',
      'Title',
      'StoryPoints',
      'DueDate',
    ];
    const rows = issues.map((i) => [
      i.key,
      i.type,
      i.status,
      i.priority,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.storyPoints || 0,
      i.dueDate || '',
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.key.toLowerCase()}-arij-issues.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Arij Developer &amp; Enterprise Platform (V4 &amp; V5)
            </span>
            <span>/</span>
            <span>{orgName}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Git &amp; CI/CD Pipelines, Organization &amp; Security, Custom Fields, Timesheets &amp; API
          </h1>
        </div>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('DEV_CICD')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'DEV_CICD'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Git, PRs &amp; CI/CD
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ORG_RBAC')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'ORG_RBAC'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Org, Auth, SSO &amp; RBAC
          </button>
          <button
            type="button"
            onClick={() => setSubTab('CUSTOM_FIELDS_TIME')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'CUSTOM_FIELDS_TIME'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Custom Fields &amp; Timesheets
          </button>
          <button
            type="button"
            onClick={() => setSubTab('API_PLUGINS_AUDIT')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'API_PLUGINS_AUDIT'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            REST API, Plugins &amp; Audit Log
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ====================================================================
            TAB 1: DEVELOPER GIT, BRANCHES, PRs & CI/CD DEPLOYMENTS (Sections 27 & 28)
           ==================================================================== */}
        {subTab === 'DEV_CICD' && (
          <div className="space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Connected Repositories &amp; Live CI/CD Deployment Pipelines
                </h3>
                <p className="text-xs text-slate-500">
                  Branches, commits, pull requests, and deployments linked automatically by Arij issue key ({project.key}-*).
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerPipeline}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Trigger CI/CD Build &amp; Deploy
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4">Linked Issue</th>
                    <th className="py-3 px-3">Git Branch</th>
                    <th className="py-3 px-3">Pull Request &amp; Commit</th>
                    <th className="py-3 px-3">CI Build</th>
                    <th className="py-3 px-3">Deployment Environment</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {deployments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {d.issueKey}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800">
                        {d.branch}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        PR {d.prNumber} ({d.commitHash})
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                          {d.buildStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {d.environment}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {d.deployedAt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: ORGANIZATION, AUTH, SSO/2FA, API TOKENS & RBAC (Sections 1, 2, 21)
           ==================================================================== */}
        {subTab === 'ORG_RBAC' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Organization &amp; Enterprise Authentication (SSO / SAML / 2FA)
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">
                      SAML 2.0 / Google Workspace / GitHub SSO
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Single Sign-On and SCIM directory sync active
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSsoEnabled(!ssoEnabled)}
                    className={`px-3 py-1 rounded font-bold text-[11px] ${
                      ssoEnabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ssoEnabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-900">
                      Mandatory Two-Factor Authentication (2FA)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Enforce TOTP / WebAuthn security keys across all members
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTwoFactorRequired(!twoFactorRequired)}
                    className={`px-3 py-1 rounded font-bold text-[11px] ${
                      twoFactorRequired
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {twoFactorRequired ? 'ENFORCED' : 'OPTIONAL'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                Personal Access Tokens &amp; RBAC Security Roles
              </h3>
              <form onSubmit={handleCreateToken} className="flex gap-2">
                <input
                  type="text"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="New API Token label (e.g. CLI Automation)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md"
                >
                  Generate Token
                </button>
              </form>
              <div className="space-y-2 text-xs">
                {apiTokens.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="font-mono text-[11px] text-blue-700">
                        {t.prefix}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {t.created}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: CUSTOM FIELDS BUILDER & TIME TRACKING TIMESHEETS (Sections 5 & 18)
           ==================================================================== */}
        {subTab === 'CUSTOM_FIELDS_TIME' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">
                Custom Fields Schema Builder (Section 5)
              </h3>
              <form onSubmit={handleAddCustomField} className="flex gap-2">
                <input
                  type="text"
                  value={cfName}
                  onChange={(e) => setCfName(e.target.value)}
                  placeholder="Field Name (e.g. Customer Account ID)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
                <select
                  value={cfType}
                  onChange={(e) => setCfType(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option>Text Field</option>
                  <option>Number / Decimal</option>
                  <option>Dropdown Select</option>
                  <option>Multi-Select</option>
                  <option>User Picker</option>
                  <option>Date / Time</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                >
                  Add Field
                </button>
              </form>
              <div className="divide-y divide-slate-100 text-xs">
                {customFields.map((cf) => (
                  <div
                    key={cf.id}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{cf.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {cf.fieldType} · Scope: {cf.scope}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px]">
                      {cf.required ? 'REQUIRED' : 'OPTIONAL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900">
                Team Time Tracking &amp; Billable Timesheets (Section 18)
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const uIssues = issues.filter((i) => i.assigneeId === u.id);
                  const spent = uIssues.reduce(
                    (s, i) => s + (i.timeSpentHours || 0),
                    0
                  );
                  const est = uIssues.reduce(
                    (s, i) => s + (i.originalEstimateHours || 0),
                    0
                  );
                  return (
                    <div
                      key={u.id}
                      className="py-2.5 flex items-center justify-between"
                    >
                      <UserAvatar user={u} size="sm" showName />
                      <div className="font-mono text-xs">
                        <strong className="text-blue-700">{spent}h logged</strong>{' '}
                        <span className="text-slate-400">/ {est}h estimated</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: REST API EXPLORER, PLUGIN MARKETPLACE, EXPORT & AUDIT LOGS
           ==================================================================== */}
        {subTab === 'API_PLUGINS_AUDIT' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Arij REST API Endpoints &amp; Full JSON Workspace Export
                </h3>
                <div className="flex flex-wrap gap-2 mt-2 font-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">
                    GET /api/projects
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">
                    GET /api/issues
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">
                    POST /api/issues
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">
                    GET /api/users
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-800">
                    GET /api/sprints
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportWorkspaceCsv}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Issues CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportWorkspaceJson}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Project JSON Backup
                </button>
              </div>
            </div>

            {/* Enterprise Audit Logs (Section 32) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Enterprise Security &amp; Governance Audit Log (Section 32)
              </h3>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg text-xs">
                {[
                  {
                    id: 'aud-1',
                    event: 'USER_LOGIN_SSO',
                    actor: currentUser?.name || 'Arjun Mehta',
                    detail: 'Authenticated via SAML 2.0 + 2FA TOTP verification',
                    time: '2026-10-06 09:02:14 UTC',
                  },
                  {
                    id: 'aud-2',
                    event: 'WORKFLOW_TRANSITION_UPDATED',
                    actor: currentUser?.name || 'Arjun Mehta',
                    detail: `Validated workflow post-functions and RBAC scheme for ${project.key}`,
                    time: '2026-10-06 09:18:40 UTC',
                  },
                  {
                    id: 'aud-3',
                    event: 'AUTOMATION_RULE_EXECUTED',
                    actor: 'Arij Automation Engine',
                    detail: 'Executed WHEN Status -> DONE Smart Value notification rule',
                    time: '2026-10-06 09:30:12 UTC',
                  },
                ].map((log) => (
                  <div
                    key={log.id}
                    className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-blue-700">
                        {log.event}
                      </span>
                      <span className="text-slate-800 font-medium">
                        {log.detail}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {log.actor} · {log.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plugin Marketplace */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Arij Plugin Marketplace (Section 42)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plugins.map((plg) => (
                  <div
                    key={plg.id}
                    className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {plg.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {plg.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPlugins((prev) =>
                          prev.map((p) =>
                            p.id === plg.id
                              ? { ...p, installed: !p.installed }
                              : p
                          )
                        )
                      }
                      className={`px-3 py-1.5 rounded text-xs font-semibold ${
                        plg.installed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {plg.installed ? 'Installed & Active' : 'Install Plugin'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
