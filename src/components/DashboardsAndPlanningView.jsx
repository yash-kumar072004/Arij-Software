import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  LayoutDashboard,
  Lightbulb,
  Plus,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import {
  formatShortDate,
  isOverdue,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './ArijPrimitives.jsx';

export const DashboardsAndPlanningView = ({
  project,
  activeSprint,
  issues,
  epics,
  users,
  currentUserId,
  onSelectIssue,
  onQuickCreateIssue,
}) => {
  // Sub-navigation across PLAN & TRACK pillars:
  // 'DASHBOARDS' | 'OKR_GOALS' | 'DISCOVERY_RICE' | 'CALENDAR'
  const [subTab, setSubTab] = useState('DASHBOARDS');

  // ==================== 1. CUSTOM DASHBOARDS & GADGETS (Section 15) ====================
  const [dashboards, setDashboards] = useState([
    {
      id: 'dsh-exec',
      name: 'Engineering Command Dashboard',
      isDefault: true,
      isFavorite: true,
      gadgets: [
        'ASSIGNED_TO_ME',
        'SPRINT_HEALTH',
        'CREATED_VS_RESOLVED',
        'PRIORITY_MATRIX',
        'ACTIVITY_STREAM',
        'WATCHED_ISSUES',
      ],
    },
    {
      id: 'dsh-rel',
      name: 'Release & Quality Telemetry',
      isDefault: false,
      isFavorite: false,
      gadgets: ['SPRINT_HEALTH', 'PRIORITY_MATRIX', 'CREATED_VS_RESOLVED'],
    },
  ]);
  const [activeDashboardId, setActiveDashboardId] = useState('dsh-exec');
  const [newDashName, setNewDashName] = useState('');
  const [showNewDashForm, setShowNewDashForm] = useState(false);

  const activeDashboard = useMemo(
    () => dashboards.find((d) => d.id === activeDashboardId) || dashboards[0],
    [dashboards, activeDashboardId]
  );

  const toggleGadget = (gadgetKey) => {
    setDashboards((prev) =>
      prev.map((d) => {
        if (d.id !== activeDashboard.id) return d;
        const exists = d.gadgets.includes(gadgetKey);
        return {
          ...d,
          gadgets: exists
            ? d.gadgets.filter((g) => g !== gadgetKey)
            : [...d.gadgets, gadgetKey],
        };
      })
    );
  };

  const handleCreateDashboard = (e) => {
    e.preventDefault();
    if (!newDashName.trim()) return;
    const newDash = {
      id: `dsh-${Date.now()}`,
      name: newDashName.trim(),
      isDefault: false,
      isFavorite: true,
      gadgets: [
        'ASSIGNED_TO_ME',
        'SPRINT_HEALTH',
        'CREATED_VS_RESOLVED',
        'PRIORITY_MATRIX',
      ],
    };
    setDashboards((prev) => [...prev, newDash]);
    setActiveDashboardId(newDash.id);
    setNewDashName('');
    setShowNewDashForm(false);
  };

  // ==================== 2. GOALS & OKRs (Section 37) ====================
  const [okrGoals, setOkrGoals] = useState([
    {
      id: 'okr-1',
      title: 'Deliver Sub-15ms Zero-Trust Telemetry & Threat Detection at Scale',
      quarter: 'Q4 2026',
      level: 'Company Objective',
      ownerId: users[0]?.id || currentUserId,
      progress: 78,
      linkedEpicKey: epics[0]?.key || 'KAW-101',
      keyResults: [
        {
          id: 'kr-1',
          text: 'Achieve 50,000 events/sec eBPF collector throughput with <2% CPU overhead',
          progress: 85,
        },
        {
          id: 'kr-2',
          text: 'Reduce false-positive anomaly alerts by 40% across production clusters',
          progress: 72,
        },
      ],
    },
    {
      id: 'okr-2',
      title: 'Accelerate Enterprise Self-Service Onboarding & SOC2 Compliance',
      quarter: 'Q4 2026',
      level: 'Product & Engineering Goal',
      ownerId: users[1]?.id || currentUserId,
      progress: 64,
      linkedEpicKey: epics[1]?.key || 'KAW-102',
      keyResults: [
        {
          id: 'kr-3',
          text: 'Ship automated SAML 2.0 / SCIM provisioning and immutable audit logs',
          progress: 70,
        },
        {
          id: 'kr-4',
          text: 'Maintain 99.95% SLA compliance on P1 security incident responses',
          progress: 58,
        },
      ],
    },
  ]);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newKrText, setNewKrText] = useState('');

  const handleAddOkr = (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    setOkrGoals((prev) => [
      ...prev,
      {
        id: `okr-${Date.now()}`,
        title: newGoalTitle.trim(),
        quarter: 'Q4 2026',
        level: 'Team Objective',
        ownerId: currentUserId,
        progress: 25,
        linkedEpicKey: epics[0]?.key || `${project.key}-101`,
        keyResults: [
          {
            id: `kr-${Date.now()}`,
            text:
              newKrText.trim() ||
              'Deliver milestone stories with 100% test coverage',
            progress: 25,
          },
        ],
      },
    ]);
    setNewGoalTitle('');
    setNewKrText('');
  };

  // ==================== 3. PRODUCT DISCOVERY & RICE MATRIX (Section 26) ====================
  const [ideas, setIdeas] = useState([
    {
      id: 'idea-1',
      title: 'Natural-Language AQL Query Builder & AI Sprint Risk Predictor',
      category: 'AI & Search',
      reach: 900,
      impact: 3,
      confidence: 90,
      effort: 3,
      votes: 24,
      status: 'VALIDATED',
    },
    {
      id: 'idea-2',
      title: 'Automated GitHub PR & CI/CD Deployment Rollback Trigger from Arij Issue',
      category: 'Developer Platform',
      reach: 650,
      impact: 3,
      confidence: 85,
      effort: 4,
      votes: 19,
      status: 'IN_DISCOVERY',
    },
    {
      id: 'idea-3',
      title: 'Live CMDB Hardware & Cloud Asset Dependency Impact Graph',
      category: 'Enterprise ITSM',
      reach: 450,
      impact: 2,
      confidence: 80,
      effort: 3,
      votes: 14,
      status: 'READY_FOR_DELIVERY',
    },
  ]);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaReach, setIdeaReach] = useState(500);
  const [ideaImpact, setIdeaImpact] = useState(2);
  const [ideaConfidence, setIdeaConfidence] = useState(80);
  const [ideaEffort, setIdeaEffort] = useState(2);

  const computeRice = (item) =>
    Math.round(
      (item.reach * item.impact * (item.confidence / 100)) /
        Math.max(1, item.effort)
    );

  const handleCreateIdea = (e) => {
    e.preventDefault();
    if (!ideaTitle.trim()) return;
    setIdeas((prev) => [
      {
        id: `idea-${Date.now()}`,
        title: ideaTitle.trim(),
        category: 'Feature Request',
        reach: Number(ideaReach) || 500,
        impact: Number(ideaImpact) || 2,
        confidence: Number(ideaConfidence) || 80,
        effort: Number(ideaEffort) || 2,
        votes: 1,
        status: 'IN_DISCOVERY',
      },
      ...prev,
    ]);
    setIdeaTitle('');
  };

  const handlePromoteIdeaToStory = (idea) => {
    onQuickCreateIssue({
      title: `[Discovery] ${idea.title}`,
      type: IssueType.STORY,
      priority: IssuePriority.HIGH,
      status: IssueStatus.TODO,
      sprintId: activeSprint ? activeSprint.id : null,
      epicId: epics[0]?.id || null,
      assigneeId: currentUserId,
    });
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === idea.id ? { ...i, status: 'PROMOTED_TO_SPRINT' } : i
      )
    );
  };

  // ==================== METRICS FOR GADGETS ====================
  const nonEpicIssues = useMemo(
    () =>
      issues.filter(
        (i) => i.type !== IssueType.EPIC || !String(i.id).startsWith('iss-epic-')
      ),
    [issues]
  );

  const myOpenIssues = useMemo(
    () =>
      nonEpicIssues.filter(
        (i) => i.assigneeId === currentUserId && i.status !== IssueStatus.DONE
      ),
    [nonEpicIssues, currentUserId]
  );

  const watchedIssues = useMemo(
    () =>
      nonEpicIssues.filter((i) =>
        (i.watcherIds || []).includes(currentUserId)
      ),
    [nonEpicIssues, currentUserId]
  );

  const doneCount = nonEpicIssues.filter(
    (i) => i.status === IssueStatus.DONE
  ).length;
  const completionPct =
    nonEpicIssues.length > 0
      ? Math.round((doneCount / nonEpicIssues.length) * 100)
      : 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Top Header & Pillar Sub-Navigation */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Arij Plan &amp; Track Hub
            </span>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Dashboards, OKR Goals, Product Discovery &amp; Calendar
          </h1>
        </div>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('DASHBOARDS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              subTab === 'DASHBOARDS'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Custom Dashboards
          </button>
          <button
            type="button"
            onClick={() => setSubTab('OKR_GOALS')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              subTab === 'OKR_GOALS'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Goals &amp; OKRs
          </button>
          <button
            type="button"
            onClick={() => setSubTab('DISCOVERY_RICE')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              subTab === 'DISCOVERY_RICE'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Product Discovery (RICE)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('CALENDAR')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              subTab === 'CALENDAR'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Release &amp; Due Calendar
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ====================================================================
            TAB 1: CUSTOM DASHBOARDS & GADGETS (Section 15)
           ==================================================================== */}
        {subTab === 'DASHBOARDS' && (
          <div className="space-y-5">
            {/* Dashboard Switcher & Gadget Toggles */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {dashboards.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDashboardId(d.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 ${
                      activeDashboard.id === d.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        d.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                      }`}
                    />
                    {d.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowNewDashForm(!showNewDashForm)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Dashboard
                </button>
              </div>

              {/* Gadget Toggle Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold text-slate-500 mr-1">
                  Active Gadgets:
                </span>
                {[
                  { id: 'ASSIGNED_TO_ME', label: 'Assigned to Me' },
                  { id: 'SPRINT_HEALTH', label: 'Sprint Health' },
                  { id: 'CREATED_VS_RESOLVED', label: 'Created vs Resolved' },
                  { id: 'PRIORITY_MATRIX', label: '2D Priority Matrix' },
                  { id: 'WATCHED_ISSUES', label: 'Watched Issues' },
                ].map((g) => {
                  const active = activeDashboard.gadgets.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGadget(g.id)}
                      className={`px-2 py-1 rounded border font-medium ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {showNewDashForm && (
              <form
                onSubmit={handleCreateDashboard}
                className="bg-white border border-blue-400 rounded-xl p-4 flex items-center gap-3"
              >
                <input
                  type="text"
                  autoFocus
                  value={newDashName}
                  onChange={(e) => setNewDashName(e.target.value)}
                  placeholder="Dashboard Name (e.g. Q4 Executive Sprint Overview)..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                >
                  Save Dashboard
                </button>
              </form>
            )}

            {/* Gadgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Gadget 1: Assigned to Me */}
              {activeDashboard.gadgets.includes('ASSIGNED_TO_ME') && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Gadget: Assigned to Me ({myOpenIssues.length} Open)
                    </h3>
                    <span className="text-[11px] font-mono text-blue-600">
                      Real-Time Queue
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {myOpenIssues.map((iss) => (
                      <div
                        key={iss.id}
                        onClick={() => onSelectIssue(iss.id)}
                        className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <IssueTypeIcon type={iss.type} className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs font-semibold text-blue-700">
                            {iss.key}
                          </span>
                          <span className="text-xs text-slate-800 truncate">
                            {iss.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <PriorityIcon
                            priority={iss.priority}
                            className="w-3.5 h-3.5"
                          />
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {STATUS_CONFIG[iss.status]?.shortLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gadget 2: Sprint Health & Velocity Gauge */}
              {activeDashboard.gadgets.includes('SPRINT_HEALTH') && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Gadget: Sprint Health &amp; Scope Telemetry
                    </h3>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {activeSprint ? activeSprint.name : 'Continuous Flow'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xl font-bold text-slate-900 font-mono">
                        {completionPct}%
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Work Completed
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xl font-bold text-blue-700 font-mono">
                        {
                          nonEpicIssues.filter(
                            (i) => i.status === IssueStatus.IN_PROGRESS
                          ).length
                        }
                      </div>
                      <div className="text-[11px] text-slate-500">
                        In Progress Now
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-xl font-bold text-red-600 font-mono">
                        {
                          nonEpicIssues.filter((i) =>
                            isOverdue(i.dueDate, i.status)
                          ).length
                        }
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Overdue Items
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span>Overall Resolution Progress</span>
                      <span className="font-mono">
                        {doneCount} / {nonEpicIssues.length} issues
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-600 h-full"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gadget 3: 2D Priority vs Status Statistics Matrix */}
              {activeDashboard.gadgets.includes('PRIORITY_MATRIX') && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Gadget: Two-Dimensional Statistics (Priority × Status)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-2">Priority</th>
                          {STATUS_ORDER.map((st) => (
                            <th key={st} className="py-2 px-2 text-center">
                              {STATUS_CONFIG[st].shortLabel}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          IssuePriority.HIGHEST,
                          IssuePriority.HIGH,
                          IssuePriority.MEDIUM,
                          IssuePriority.LOW,
                        ].map((prio) => (
                          <tr key={prio}>
                            <td className="py-2 pr-2 font-semibold flex items-center gap-1.5">
                              <PriorityIcon
                                priority={prio}
                                className="w-3.5 h-3.5"
                              />
                              {PRIORITY_CONFIG[prio].label}
                            </td>
                            {STATUS_ORDER.map((st) => {
                              const c = nonEpicIssues.filter(
                                (i) => i.priority === prio && i.status === st
                              ).length;
                              return (
                                <td
                                  key={st}
                                  className="py-2 px-2 text-center font-mono"
                                >
                                  <span
                                    className={`px-2 py-0.5 rounded ${
                                      c > 0
                                        ? 'bg-blue-50 text-blue-700 font-bold'
                                        : 'text-slate-300'
                                    }`}
                                  >
                                    {c}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Gadget 4: Created vs Resolved & Watched Issues */}
              {activeDashboard.gadgets.includes('WATCHED_ISSUES') && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Gadget: Watched &amp; Recently Updated Issues (
                      {watchedIssues.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {watchedIssues.slice(0, 6).map((iss) => (
                      <div
                        key={iss.id}
                        onClick={() => onSelectIssue(iss.id)}
                        className="py-2 flex items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <IssueTypeIcon type={iss.type} className="w-3.5 h-3.5" />
                          <span className="font-mono text-xs font-semibold text-slate-600">
                            {iss.key}
                          </span>
                          <span className="text-xs text-slate-800 truncate">
                            {iss.title}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {iss.storyPoints || 0} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: GOALS & OKRs HIERARCHY (Section 37)
           ==================================================================== */}
        {subTab === 'OKR_GOALS' && (
          <div className="space-y-5">
            <form
              onSubmit={handleAddOkr}
              className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              <input
                type="text"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="New Objective (e.g. Reduce P99 API Latency under 40ms)..."
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={newKrText}
                onChange={(e) => setNewKrText(e.target.value)}
                placeholder="Primary Key Result target..."
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Objective &amp; Key Result
              </button>
            </form>

            <div className="space-y-4">
              {okrGoals.map((goal) => {
                const owner = users.find((u) => u.id === goal.ownerId);
                return (
                  <div
                    key={goal.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
                            {goal.level}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {goal.quarter}
                          </span>
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            Linked Epic: {goal.linkedEpicKey}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {goal.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-3">
                        <UserAvatar user={owner} size="sm" showName />
                        <div className="text-right">
                          <span className="font-mono text-sm font-bold text-emerald-700">
                            {goal.progress}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Measurable Key Results
                      </div>
                      {goal.keyResults.map((kr) => (
                        <div
                          key={kr.id}
                          className="flex items-center justify-between gap-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                        >
                          <span className="font-medium text-slate-800">
                            {kr.text}
                          </span>
                          <span className="font-mono font-bold text-blue-700 shrink-0">
                            {kr.progress}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: PRODUCT DISCOVERY & RICE PRIORITIZATION (Section 26)
           ==================================================================== */}
        {subTab === 'DISCOVERY_RICE' && (
          <div className="space-y-5">
            <form
              onSubmit={handleCreateIdea}
              className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Product Idea / Opportunity
                </label>
                <input
                  type="text"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="Describe customer problem or feature idea..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Reach (Users)
                </label>
                <input
                  type="number"
                  value={ideaReach}
                  onChange={(e) => setIdeaReach(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Impact (1-3)
                </label>
                <input
                  type="number"
                  min="1"
                  max="3"
                  value={ideaImpact}
                  onChange={(e) => setIdeaImpact(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Effort (Weeks)
                </label>
                <input
                  type="number"
                  min="1"
                  value={ideaEffort}
                  onChange={(e) => setIdeaEffort(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 h-[32px]"
              >
                Add Idea
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4">Product Discovery Idea</th>
                    <th className="py-3 px-3 text-center">Reach</th>
                    <th className="py-3 px-3 text-center">Impact</th>
                    <th className="py-3 px-3 text-center">Confidence</th>
                    <th className="py-3 px-3 text-center">Effort</th>
                    <th className="py-3 px-3 text-center">RICE Score</th>
                    <th className="py-3 px-3 text-center">Votes</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ideas.map((idea) => {
                    const score = computeRice(idea);
                    return (
                      <tr key={idea.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div>{idea.title}</div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {idea.category} · {idea.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {idea.reach}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {idea.impact}x
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {idea.confidence}%
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {idea.effort}w
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-mono font-bold">
                            {score}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setIdeas((prev) =>
                                prev.map((it) =>
                                  it.id === idea.id
                                    ? { ...it, votes: it.votes + 1 }
                                    : it
                                )
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 font-mono"
                          >
                            <ThumbsUp className="w-3 h-3 text-blue-600" />
                            {idea.votes}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {idea.status === 'PROMOTED_TO_SPRINT' ? (
                            <span className="text-emerald-700 font-semibold text-[11px]">
                              Promoted to Sprint
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePromoteIdeaToStory(idea)}
                              className="px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-semibold"
                            >
                              Promote to Story
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: RELEASE & DUE DATE CALENDAR (Section 38)
           ==================================================================== */}
        {subTab === 'CALENDAR' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  October 2026 — Project Due Dates &amp; Sprint Milestones
                </h3>
                <p className="text-xs text-slate-500">
                  Click any scheduled issue on the calendar to inspect or reschedule.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div
                  key={d}
                  className="py-1.5 text-center font-bold uppercase text-slate-500 bg-slate-100 rounded"
                >
                  {d}
                </div>
              ))}
              {Array.from({ length: 31 }, (_, idx) => {
                const dayNum = idx + 1;
                const dateStr = `2026-10-${String(dayNum).padStart(2, '0')}`;
                const dayIssues = nonEpicIssues.filter(
                  (i) => i.dueDate === dateStr
                );
                return (
                  <div
                    key={dateStr}
                    className="min-h-[96px] p-2 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col gap-1"
                  >
                    <div className="font-mono text-[11px] font-bold text-slate-600">
                      Oct {dayNum}
                    </div>
                    <div className="space-y-1">
                      {dayIssues.map((iss) => (
                        <button
                          key={iss.id}
                          type="button"
                          onClick={() => onSelectIssue(iss.id)}
                          className="w-full text-left px-1.5 py-1 rounded bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[10px] font-medium text-blue-900 truncate flex items-center gap-1"
                        >
                          <IssueTypeIcon type={iss.type} className="w-2.5 h-2.5" />
                          <span className="font-mono font-bold">{iss.key}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
