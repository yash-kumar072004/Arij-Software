import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Plus,
  Server,
  ShieldAlert,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';

export const ServiceAndItsmView = ({
  project,
  issues,
  users,
  currentUserId,
  onSelectIssue,
  onQuickCreateIssue,
}) => {
  // 'SERVICE_QUEUES' | 'INCIDENTS' | 'FORMS_PORTAL' | 'ASSETS_CMDB'
  const [subTab, setSubTab] = useState('SERVICE_QUEUES');

  // ==================== 1. ITSM SERVICE QUEUES & SLA TRACKER (Section 23) ====================
  const [selectedQueue, setSelectedQueue] = useState('ALL_OPEN');

  const queueIssues = issues.filter((iss) => {
    if (iss.type === IssueType.EPIC) return false;
    if (selectedQueue === 'UNASSIGNED') return !iss.assigneeId;
    if (selectedQueue === 'HIGH_PRIORITY') {
      return (
        iss.priority === IssuePriority.HIGHEST ||
        iss.priority === IssuePriority.HIGH
      );
    }
    if (selectedQueue === 'BUGS_INCIDENTS') {
      return iss.type === IssueType.BUG || iss.type === IssueType.INCIDENT;
    }
    return iss.status !== IssueStatus.DONE;
  });

  // ==================== 2. MAJOR INCIDENT MANAGEMENT (Section 24) ====================
  const [incidents, setIncidents] = useState([
    {
      id: 'inc-1',
      key: `${project.key}-INC-01`,
      title: 'Elevated Latency in Zero-Trust Telemetry Ingestion Cluster (ap-south-1)',
      severity: 'SEV-1 (Critical)',
      status: 'MITIGATED — MONITORING',
      commander: users[0]?.name || 'Arjun Mehta',
      responseSla: '4m (Target <15m)',
      rootCause:
        'Kafka consumer rebalance storm triggered by oversized eBPF packet batch.',
    },
    {
      id: 'inc-2',
      key: `${project.key}-INC-02`,
      title: 'Intermittent SAML Assertion Timeout on Secondary Identity Provider',
      severity: 'SEV-2 (Major)',
      status: 'INVESTIGATING',
      commander: users[2]?.name || 'Rohan Verma',
      responseSla: '9m (Target <30m)',
      rootCause: 'Pending certificate chain rotation verification.',
    },
  ]);
  const [incTitle, setIncTitle] = useState('');
  const [incSeverity, setIncSeverity] = useState('SEV-1 (Critical)');

  const handleDeclareIncident = (e) => {
    e.preventDefault();
    if (!incTitle.trim()) return;
    setIncidents((prev) => [
      {
        id: `inc-${Date.now()}`,
        key: `${project.key}-INC-0${prev.length + 1}`,
        title: incTitle.trim(),
        severity: incSeverity,
        status: 'ACTIVE — INVESTIGATING',
        commander: users.find((u) => u.id === currentUserId)?.name || 'On-Call Lead',
        responseSla: '1m (SLA Active)',
        rootCause: 'Investigation in progress.',
      },
      ...prev,
    ]);
    onQuickCreateIssue({
      title: `[${incSeverity}] ${incTitle.trim()}`,
      type: IssueType.INCIDENT,
      priority: IssuePriority.HIGHEST,
      status: IssueStatus.IN_PROGRESS,
      sprintId: null,
      epicId: null,
      assigneeId: currentUserId,
    });
    setIncTitle('');
  };

  // ==================== 3. FORMS BUILDER & PORTAL (Section 22) ====================
  const [formType, setFormType] = useState('BUG_REPORT');
  const [formSummary, setFormSummary] = useState('');
  const [formEnvironment, setFormEnvironment] = useState('Production · Chrome 130 / Linux');
  const [formSteps, setFormSteps] = useState('');
  const [formSubmittedMsg, setFormSubmittedMsg] = useState(null);

  const handlePortalFormSubmit = (e) => {
    e.preventDefault();
    if (!formSummary.trim()) return;
    onQuickCreateIssue({
      title: `[Portal ${formType}] ${formSummary.trim()} (${formEnvironment})`,
      type: formType === 'BUG_REPORT' ? IssueType.BUG : IssueType.REQUEST,
      priority: IssuePriority.HIGH,
      status: IssueStatus.TODO,
      sprintId: null,
      epicId: null,
      assigneeId: currentUserId,
    });
    setFormSubmittedMsg(
      `Submitted "${formSummary.trim()}" directly into ${project.key} queue!`
    );
    setFormSummary('');
    setFormSteps('');
  };

  // ==================== 4. ASSETS & CMDB (Section 25) ====================
  const [cmdbAssets] = useState([
    {
      id: 'ast-1',
      name: 'prod-k8s-telemetry-cluster-01',
      category: 'Cloud Kubernetes Cluster',
      tier: 'Tier-0 Critical Infrastructure',
      dependsOn: 'aws-rds-postgres-primary',
      owner: 'DevSecOps Team',
      status: 'OPERATIONAL',
    },
    {
      id: 'ast-2',
      name: 'arij-api-gateway-service',
      category: 'Application Microservice',
      tier: 'Tier-1 Core Service',
      dependsOn: 'prod-k8s-telemetry-cluster-01',
      owner: 'Core Platform Team',
      status: 'OPERATIONAL',
    },
    {
      id: 'ast-3',
      name: 'aws-rds-postgres-primary',
      category: 'Database Instance',
      tier: 'Tier-0 Data Store',
      dependsOn: 'ap-south-1-vpc-core',
      owner: 'Database Reliability',
      status: 'OPERATIONAL',
    },
  ]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Arij Service Management &amp; ITSM (V5)
            </span>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Service Queues &amp; SLAs, Major Incidents, Intake Forms &amp; Assets CMDB
          </h1>
        </div>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('SERVICE_QUEUES')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'SERVICE_QUEUES'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            Queues &amp; SLAs
          </button>
          <button
            type="button"
            onClick={() => setSubTab('INCIDENTS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'INCIDENTS'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Incident Management
          </button>
          <button
            type="button"
            onClick={() => setSubTab('FORMS_PORTAL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'FORMS_PORTAL'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Request &amp; Bug Forms
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ASSETS_CMDB')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'ASSETS_CMDB'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Assets &amp; CMDB
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {subTab === 'SERVICE_QUEUES' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'ALL_OPEN', label: 'All Open Requests' },
                  { id: 'HIGH_PRIORITY', label: 'High Priority SLA Queue' },
                  { id: 'BUGS_INCIDENTS', label: 'Bugs & Incidents' },
                  { id: 'UNASSIGNED', label: 'Unassigned Queue' },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQueue(q.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${
                      selectedQueue === q.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                99.4% First-Response SLA Met
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {queueIssues.map((iss) => (
                <div
                  key={iss.id}
                  onClick={() => onSelectIssue(iss.id)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-blue-700">
                      {iss.key}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {iss.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3" />
                      SLA: 15m Response · 4h Resolution
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'INCIDENTS' && (
          <div className="space-y-5">
            <form
              onSubmit={handleDeclareIncident}
              className="bg-white border border-rose-300 rounded-xl p-4 flex flex-wrap gap-3"
            >
              <input
                type="text"
                value={incTitle}
                onChange={(e) => setIncTitle(e.target.value)}
                placeholder="Declare Major Incident (e.g. Production Auth Service 502 Spike)..."
                className="flex-1 min-w-[240px] px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <select
                value={incSeverity}
                onChange={(e) => setIncSeverity(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md font-bold text-rose-700"
              >
                <option>SEV-1 (Critical)</option>
                <option>SEV-2 (Major)</option>
                <option>SEV-3 (Minor)</option>
              </select>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-md hover:bg-rose-700"
              >
                Declare Incident &amp; Create Ticket
              </button>
            </form>

            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-2 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[11px] font-bold">
                        {inc.severity}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {inc.key}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {inc.title}
                      </h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <strong>Commander:</strong> {inc.commander} ·{' '}
                    <strong>Response SLA:</strong> {inc.responseSla} ·{' '}
                    <strong>Root Cause / Postmortem:</strong> {inc.rootCause}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === 'FORMS_PORTAL' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Arij Service Portal &amp; Structured Intake Form
            </h3>
            {formSubmittedMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {formSubmittedMsg}
              </div>
            )}
            <form onSubmit={handlePortalFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Form Template
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md"
                >
                  <option value="BUG_REPORT">Customer Bug Report Form</option>
                  <option value="IT_ACCESS">IT &amp; Cloud Access Request</option>
                  <option value="CHANGE_REQ">Production Change Request</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Summary *
                </label>
                <input
                  type="text"
                  required
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Enter request summary..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Browser / Environment / Asset
                </label>
                <input
                  type="text"
                  value={formEnvironment}
                  onChange={(e) => setFormEnvironment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Steps to Reproduce / Business Justification
                </label>
                <textarea
                  rows={3}
                  value={formSteps}
                  onChange={(e) => setFormSteps(e.target.value)}
                  placeholder="1. Navigate to... 2. Observe..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Submit Form to Arij Board
              </button>
            </form>
          </div>
        )}

        {subTab === 'ASSETS_CMDB' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="py-3 px-4">Configuration Item / Asset</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Criticality Tier</th>
                  <th className="py-3 px-3">Upstream Dependency</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-4 text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cmdbAssets.map((ast) => (
                  <tr key={ast.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {ast.name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{ast.category}</td>
                    <td className="py-3 px-3 font-semibold text-blue-700">
                      {ast.tier}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {ast.dependsOn}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{ast.owner}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                        {ast.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
