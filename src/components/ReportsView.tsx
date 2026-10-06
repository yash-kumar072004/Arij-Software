import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  TrendingDown,
  Users,
} from 'lucide-react';
import {
  Issue,
  IssueStatus,
  IssueType,
  Project,
  Sprint,
  SprintStatus,
  User,
} from '../types/jira';
import {
  formatShortDate,
  IssueTypeIcon,
  STATUS_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface ReportsViewProps {
  project: Project;
  sprints: Sprint[];
  issues: Issue[];
  epics: Issue[];
  users: User[];
  onSelectIssue: (issueId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  project,
  sprints,
  issues,
  epics,
  users,
  onSelectIssue,
}) => {
  const [activeReport, setActiveReport] = useState<'BURNDOWN' | 'VELOCITY' | 'WORKLOAD'>(
    'BURNDOWN'
  );

  const activeSprint = useMemo(
    () => sprints.find((s) => s.status === SprintStatus.ACTIVE) || sprints[0] || null,
    [sprints]
  );

  const sprintIssues = useMemo(() => {
    if (!activeSprint) return [];
    return issues.filter(
      (i) => i.sprintId === activeSprint.id && i.type !== IssueType.EPIC
    );
  }, [issues, activeSprint]);

  const burndownStats = useMemo(() => {
    const totalPoints = sprintIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const completedPoints = sprintIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const remainingPoints = Math.max(0, totalPoints - completedPoints);
    const totalHoursLogged = sprintIssues.reduce(
      (acc, i) => acc + (i.timeSpentHours || 0),
      0
    );
    const totalHoursRemaining = sprintIssues.reduce(
      (acc, i) => acc + (i.remainingEstimateHours || 0),
      0
    );

    // 10-day sprint progression curve
    const days = [
      'Day 1',
      'Day 2',
      'Day 3',
      'Day 4',
      'Day 5',
      'Day 6',
      'Day 7',
      'Day 8',
      'Day 9',
      'Day 10',
    ];
    const startPts = totalPoints || 40;
    const idealPoints = days.map((_, idx) =>
      Math.round(startPts * (1 - idx / (days.length - 1)))
    );
    const actualPoints = [
      startPts,
      Math.max(remainingPoints, Math.round(startPts * 0.92)),
      Math.max(remainingPoints, Math.round(startPts * 0.85)),
      Math.max(remainingPoints, Math.round(startPts * 0.76)),
      remainingPoints,
    ];

    return {
      totalPoints,
      completedPoints,
      remainingPoints,
      totalHoursLogged,
      totalHoursRemaining,
      days,
      idealPoints,
      actualPoints,
      startPts,
    };
  }, [sprintIssues]);

  const velocitySprints = useMemo(() => {
    return sprints
      .filter(
        (s) => s.status === SprintStatus.COMPLETED || s.status === SprintStatus.ACTIVE
      )
      .map((sp) => {
        const spIssues = issues.filter(
          (i) => i.sprintId === sp.id && i.type !== IssueType.EPIC
        );
        const liveCommitted = spIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
        const liveCompleted = spIssues
          .filter((i) => i.status === IssueStatus.DONE)
          .reduce((sum, i) => sum + (i.storyPoints || 0), 0);

        return {
          id: sp.id,
          name: sp.name.split('—')[0].trim(),
          fullName: sp.name,
          status: sp.status,
          committed:
            sp.status === SprintStatus.COMPLETED && sp.committedPoints
              ? sp.committedPoints
              : liveCommitted,
          completed:
            sp.status === SprintStatus.COMPLETED && sp.completedPoints
              ? sp.completedPoints
              : liveCompleted,
        };
      });
  }, [sprints, issues]);

  const avgVelocity = useMemo(() => {
    const completedOnly = velocitySprints.filter(
      (s) => s.status === SprintStatus.COMPLETED
    );
    if (completedOnly.length === 0) return 35;
    const sum = completedOnly.reduce((acc, s) => acc + s.completed, 0);
    return Math.round(sum / completedOnly.length);
  }, [velocitySprints]);

  const workloadByEngineer = useMemo(() => {
    const nonEpic = issues.filter((i) => i.type !== IssueType.EPIC);
    return users.map((user) => {
      const assigned = nonEpic.filter((i) => i.assigneeId === user.id);
      const done = assigned.filter((i) => i.status === IssueStatus.DONE);
      const totalPts = assigned.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
      const donePts = done.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
      const hoursSpent = assigned.reduce((acc, i) => acc + (i.timeSpentHours || 0), 0);
      const hoursRemaining = assigned.reduce(
        (acc, i) => acc + (i.remainingEstimateHours || 0),
        0
      );
      return {
        user,
        issueCount: assigned.length,
        doneCount: done.length,
        totalPts,
        donePts,
        hoursSpent,
        hoursRemaining,
      };
    });
  }, [issues, users]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">Agile Reports & Telemetry</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {project.key} Agile Reports
            </h1>
          </div>

          {/* Interactive Report Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveReport('BURNDOWN')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeReport === 'BURNDOWN'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Sprint Burndown
            </button>
            <button
              type="button"
              onClick={() => setActiveReport('VELOCITY')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeReport === 'VELOCITY'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Velocity Chart
            </button>
            <button
              type="button"
              onClick={() => setActiveReport('WORKLOAD')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeReport === 'WORKLOAD'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Team Workload & Epics
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
        {/* Top Summary Stat Strip (Single-Elevation, Dividers) */}
        <div className="bg-white border border-slate-200 rounded-lg grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Active Sprint Commitment</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {burndownStats.totalPoints} pts
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Across {sprintIssues.length} active sprint issues
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Completed Story Points</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
              {burndownStats.completedPoints} pts
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {burndownStats.remainingPoints} pts remaining in sprint
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Historical Team Velocity</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-blue-700">
              {avgVelocity} pts / sprint
            </div>
            <div className="text-xs text-slate-500 mt-1">
              2-week sprint rolling average
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500 mb-1">Sprint Time Tracking</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {burndownStats.totalHoursLogged}h logged
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {burndownStats.totalHoursRemaining}h estimated remaining
            </div>
          </div>
        </div>

        {activeReport === 'BURNDOWN' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {activeSprint ? activeSprint.name : 'Active Sprint Burndown'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracks remaining story points against the ideal linear burndown trajectory.
                </p>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-slate-400 inline-block" />
                  <span className="text-slate-600">Ideal Burndown Guideline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-red-600 inline-block" />
                  <span className="text-slate-900 font-medium">Actual Remaining Points</span>
                </div>
              </div>
            </div>

            {/* SVG Burndown Chart */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox="0 0 800 260"
                className="w-full h-64 overflow-visible"
                role="img"
                aria-label="Sprint Burndown Chart"
              >
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 20 + ratio * 200;
                  const val = Math.round(burndownStats.startPts * (1 - ratio));
                  return (
                    <g key={idx}>
                      <line
                        x1={50}
                        y1={y}
                        x2={760}
                        y2={y}
                        stroke="#E2E8F0"
                        strokeDasharray={ratio === 1 ? undefined : '4 4'}
                      />
                      <text
                        x={40}
                        y={y + 4}
                        textAnchor="end"
                        className="text-[11px] fill-slate-400 font-mono"
                      >
                        {val}p
                      </text>
                    </g>
                  );
                })}

                {/* Ideal Line */}
                <line
                  x1={50}
                  y1={20}
                  x2={760}
                  y2={220}
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />

                {/* Actual Remaining Polyline */}
                <polyline
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth={2.5}
                  points={burndownStats.actualPoints
                    .map((pts, idx) => {
                      const x =
                        50 +
                        (idx / (burndownStats.days.length - 1)) * 710;
                      const y =
                        220 -
                        (pts / Math.max(1, burndownStats.startPts)) * 200;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Data Points on Actual Line */}
                {burndownStats.actualPoints.map((pts, idx) => {
                  const x =
                    50 + (idx / (burndownStats.days.length - 1)) * 710;
                  const y =
                    220 - (pts / Math.max(1, burndownStats.startPts)) * 200;
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r={4.5} fill="#DC2626" />
                      <text
                        x={x}
                        y={y - 10}
                        textAnchor="middle"
                        className="text-[11px] fill-red-700 font-mono font-semibold"
                      >
                        {pts}p
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Day Labels */}
                {burndownStats.days.map((day, idx) => {
                  const x =
                    50 + (idx / (burndownStats.days.length - 1)) * 710;
                  return (
                    <text
                      key={day}
                      x={x}
                      y={245}
                      textAnchor="middle"
                      className="text-[11px] fill-slate-500 font-mono"
                    >
                      {day}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Sprint Scope Breakdown Table */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-700 mb-3">
                Sprint Scope & Issue Status Breakdown
              </h3>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">Key</th>
                    <th className="py-2 px-3">Issue Summary</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Story Points</th>
                    <th className="py-2 px-3 text-right">Time Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sprintIssues.map((iss) => (
                    <tr
                      key={iss.id}
                      onClick={() => onSelectIssue(iss.id)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="py-2 px-3 font-mono tabular-nums font-semibold text-blue-700">
                        {iss.key}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {iss.title}
                      </td>
                      <td className="py-2 px-3">
                        <IssueTypeIcon type={iss.type} />
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-semibold ${
                            STATUS_CONFIG[iss.status].textClass
                          }`}
                        >
                          {STATUS_CONFIG[iss.status].label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                        {iss.storyPoints} pts
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                        {iss.timeSpentHours}h / {iss.originalEstimateHours}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'VELOCITY' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sprint Velocity Chart
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Compares committed story points against completed story points across sprints.
                </p>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-slate-300 rounded-xs inline-block" />
                  <span className="text-slate-600">Committed Story Points</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-600 rounded-xs inline-block" />
                  <span className="text-slate-900 font-medium">Completed Story Points</span>
                </div>
              </div>
            </div>

            {/* Bar Chart Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {velocitySprints.map((sp) => {
                const maxPts = Math.max(50, sp.committed, sp.completed);
                const committedPct = Math.round((sp.committed / maxPts) * 100);
                const completedPct = Math.round((sp.completed / maxPts) * 100);
                const completionRate =
                  sp.committed > 0
                    ? Math.round((sp.completed / sp.committed) * 100)
                    : 0;

                return (
                  <div
                    key={sp.id}
                    className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-900">{sp.name}</span>
                        <span className="font-mono tabular-nums">
                          {sp.status === SprintStatus.ACTIVE ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mb-4">
                        {sp.fullName}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Committed</span>
                          <span className="font-mono tabular-nums font-semibold text-slate-800">
                            {sp.committed} pts
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-slate-400"
                            style={{ width: `${committedPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-emerald-700 font-medium">Completed</span>
                          <span className="font-mono tabular-nums font-semibold text-emerald-700">
                            {sp.completed} pts ({completionRate}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-emerald-600"
                            style={{ width: `${completedPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeReport === 'WORKLOAD' && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                Engineering Workload & Capacity Distribution
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Story point allocation, completion progress, and logged engineering hours per team member.
              </p>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                  <th className="py-3 px-6">Team Member</th>
                  <th className="py-3 px-4">Role & Department</th>
                  <th className="py-3 px-4 text-right">Assigned Issues</th>
                  <th className="py-3 px-4 text-right">Story Points (Done / Total)</th>
                  <th className="py-3 px-4 text-right">Time Logged</th>
                  <th className="py-3 px-6 text-right">Remaining Estimate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workloadByEngineer.map((row) => (
                  <tr key={row.user.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={row.user} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {row.user.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {row.user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.user.role} · {row.user.department}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-800">
                      {row.doneCount} / {row.issueCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-blue-700">
                      {row.donePts} / {row.totalPts} pts
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.hoursSpent}h
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums text-slate-600">
                      {row.hoursRemaining}h
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
