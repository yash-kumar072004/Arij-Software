import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingDown,
  Users,
  Zap,
  Clock,
} from 'lucide-react';
import { IssueStatus, IssueType, SprintStatus } from '../types/arij.js';
import { STATUS_CONFIG, STATUS_ORDER, UserAvatar } from './ArijPrimitives.jsx';

export const ReportsView = ({
  project,
  sprints,
  issues,
  epics,
  users,
  onSelectIssue,
}) => {
  const [reportTab, setReportTab] = useState('BURNDOWN');

  const activeSprint = useMemo(
    () => sprints.find((s) => s.status === SprintStatus.ACTIVE) || sprints[0],
    [sprints]
  );

  const nonEpicIssues = useMemo(
    () =>
      issues.filter(
        (i) => i.type !== IssueType.EPIC || !String(i.id).startsWith('iss-epic-')
      ),
    [issues]
  );

  const sprintIssues = useMemo(() => {
    return nonEpicIssues;
  }, [nonEpicIssues]);

  const kpis = useMemo(() => {
    const totalPoints = sprintIssues.reduce(
      (s, i) => s + (i.storyPoints || 0),
      0
    );
    const completedPoints = sprintIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((s, i) => s + (i.storyPoints || 0), 0);
    const remainingPoints = totalPoints - completedPoints;
    const totalLoggedHours = nonEpicIssues.reduce(
      (s, i) => s + (i.timeSpentHours || 0),
      0
    );
    const completionRate =
      totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    return {
      totalPoints,
      completedPoints,
      remainingPoints,
      totalLoggedHours,
      completionRate,
    };
  }, [sprintIssues, nonEpicIssues]);

  const burndownSeries = useMemo(() => {
    const total = Math.max(kpis.totalPoints, 25);
    const rem = kpis.remainingPoints;
    return [
      { day: 'Day 1', ideal: total, actual: total },
      { day: 'Day 3', ideal: Math.round(total * 0.85), actual: Math.round(total * 0.9) },
      { day: 'Day 5', ideal: Math.round(total * 0.7), actual: Math.round(total * 0.76) },
      { day: 'Day 7', ideal: Math.round(total * 0.55), actual: Math.round(total * 0.6) },
      { day: 'Day 9 (Today)', ideal: Math.round(total * 0.4), actual: rem },
      { day: 'Day 11', ideal: Math.round(total * 0.2), actual: null },
      { day: 'Day 14', ideal: 0, actual: null },
    ];
  }, [kpis.totalPoints, kpis.remainingPoints]);

  const velocityBars = useMemo(() => {
    return [
      { name: 'Sprint 18', committed: 24, completed: 22 },
      { name: 'Sprint 19', committed: 28, completed: 25 },
      { name: 'Sprint 20', committed: 26, completed: 26 },
      {
        name: activeSprint ? activeSprint.name.split('—')[0].trim() : 'Sprint 21',
        committed: kpis.totalPoints,
        completed: kpis.completedPoints,
      },
    ];
  }, [activeSprint, kpis.totalPoints, kpis.completedPoints]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{project.name}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">
              Agile Reports & Telemetry
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            {project.key} Engineering Velocity, Burndown & Workload Analytics
          </h1>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-md border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setReportTab('BURNDOWN')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-colors ${
              reportTab === 'BURNDOWN'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-blue-600" />
            Sprint Burndown
          </button>
          <button
            type="button"
            onClick={() => setReportTab('VELOCITY')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-colors ${
              reportTab === 'VELOCITY'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
            Velocity Chart
          </button>
          <button
            type="button"
            onClick={() => setReportTab('WORKLOAD')}
            className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-colors ${
              reportTab === 'WORKLOAD'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            Team Workload & Epics
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500">
              Active Sprint Commitment
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {kpis.totalPoints} pts
              </span>
              <span className="text-xs font-mono text-slate-500">
                {sprintIssues.length} issues
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500">
              Completed Story Points
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600">
                {kpis.completedPoints} pts
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                {kpis.completionRate}% complete
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500">
              Remaining Sprint Scope
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-blue-600">
                {kpis.remainingPoints} pts
              </span>
              <span className="text-xs text-slate-500">Target: Oct 12</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500">
              Total Engineering Hours Logged
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {kpis.totalLoggedHours}h
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Time tracking active
              </span>
            </div>
          </div>
        </div>

        {reportTab === 'BURNDOWN' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Sprint Burndown Chart ({activeSprint?.name || 'Active Sprint'})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Remaining story points vs ideal linear burndown guideline
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className="w-3 h-0.5 bg-slate-400 inline-block" /> Ideal Guideline
                  </span>
                  <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                    <span className="w-3 h-1 bg-red-600 inline-block rounded" /> Actual Remaining
                  </span>
                </div>
              </div>

              <div className="h-64 w-full pt-4">
                <svg
                  viewBox="0 0 700 220"
                  className="w-full h-full overflow-visible"
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                    const y = 20 + t * 160;
                    const val = Math.round(
                      Math.max(kpis.totalPoints, 25) * (1 - t)
                    );
                    return (
                      <g key={idx}>
                        <line
                          x1={45}
                          y1={y}
                          x2={660}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={10}
                          y={y + 4}
                          className="text-[10px] fill-slate-400 font-mono"
                        >
                          {val}p
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={60}
                    y1={20}
                    x2={640}
                    y2={180}
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />

                  {(() => {
                    const maxVal = Math.max(kpis.totalPoints, 25);
                    const pts = burndownSeries
                      .map((d, i) => {
                        if (d.actual === null) return null;
                        const x = 60 + i * 96;
                        const y = 180 - (d.actual / maxVal) * 160;
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <polyline
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth={3}
                        points={pts}
                      />
                    );
                  })()}

                  {burndownSeries.map((d, i) => {
                    const maxVal = Math.max(kpis.totalPoints, 25);
                    const x = 60 + i * 96;
                    const y =
                      d.actual !== null
                        ? 180 - (d.actual / maxVal) * 160
                        : null;
                    return (
                      <g key={d.day}>
                        <text
                          x={x}
                          y={205}
                          textAnchor="middle"
                          className="text-[10px] fill-slate-500 font-mono"
                        >
                          {d.day}
                        </text>
                        {y !== null && (
                          <circle
                            cx={x}
                            cy={y}
                            r={4.5}
                            className="fill-red-600 stroke-white stroke-2"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 mb-1">
                  Cumulative Status Breakdown
                </h2>
                <p className="text-xs text-slate-500 mb-5">
                  Distribution of issues across workflow columns
                </p>

                <div className="space-y-4">
                  {STATUS_ORDER.map((st) => {
                    const count = nonEpicIssues.filter(
                      (i) => i.status === st
                    ).length;
                    const pct =
                      nonEpicIssues.length > 0
                        ? Math.round((count / nonEpicIssues.length) * 100)
                        : 0;
                    return (
                      <div key={st} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-semibold ${STATUS_CONFIG[st].textClass}`}
                          >
                            {STATUS_CONFIG[st].label}
                          </span>
                          <span className="font-mono tabular-nums text-slate-600">
                            {count} issues ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Total Tracked Project Issues</span>
                <span className="font-mono font-bold text-slate-900">
                  {nonEpicIssues.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'VELOCITY' && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Team Sprint Velocity Report
                </h2>
                <p className="text-xs text-slate-500">
                  Committed vs Completed story points across recent iterations
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 bg-slate-300 inline-block rounded-xs" />{' '}
                  Committed Points
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="w-3 h-3 bg-emerald-600 inline-block rounded-xs" />{' '}
                  Completed Points
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-8 items-end h-64 pt-8 px-8 border-b border-slate-200">
              {velocityBars.map((bar) => {
                const maxPts = 36;
                const commH = Math.min(
                  100,
                  Math.round((bar.committed / maxPts) * 100)
                );
                const compH = Math.min(
                  100,
                  Math.round((bar.completed / maxPts) * 100)
                );

                return (
                  <div
                    key={bar.name}
                    className="flex flex-col items-center h-full justify-end gap-2"
                  >
                    <div className="flex items-end gap-3 w-full justify-center h-48">
                      <div className="flex flex-col items-center justify-end h-full w-12">
                        <span className="font-mono text-[11px] text-slate-500 mb-1">
                          {bar.committed}p
                        </span>
                        <div
                          className="w-full bg-slate-300 rounded-t"
                          style={{ height: `${commH}%` }}
                        />
                      </div>
                      <div className="flex flex-col items-center justify-end h-full w-12">
                        <span className="font-mono text-[11px] font-bold text-emerald-700 mb-1">
                          {bar.completed}p
                        </span>
                        <div
                          className="w-full bg-emerald-600 rounded-t"
                          style={{ height: `${compH}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 pb-2">
                      {bar.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reportTab === 'WORKLOAD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Engineer Capacity & Workload Distribution
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Story points and logged hours per team member
              </p>

              <div className="divide-y divide-slate-200">
                {users.map((u) => {
                  const assigned = nonEpicIssues.filter(
                    (i) => i.assigneeId === u.id
                  );
                  const openCount = assigned.filter(
                    (i) => i.status !== IssueStatus.DONE
                  ).length;
                  const pts = assigned.reduce(
                    (s, i) => s + (i.storyPoints || 0),
                    0
                  );
                  const logged = assigned.reduce(
                    (s, i) => s + (i.timeSpentHours || 0),
                    0
                  );

                  return (
                    <div
                      key={u.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={u} size="md" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {u.role}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-5 text-xs font-mono tabular-nums shrink-0">
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">
                            {openCount} open
                          </div>
                          <div className="text-[11px] text-slate-400">
                            of {assigned.length} total
                          </div>
                        </div>
                        <div className="text-right w-16">
                          <div className="font-bold text-blue-700">{pts} pts</div>
                          <div className="text-[11px] text-slate-400">
                            {logged}h logged
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Epic Roadmap Progress
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Story point completion across active project Epics
              </p>

              <div className="space-y-4">
                {epics.map((ep) => {
                  const children = nonEpicIssues.filter(
                    (i) => i.epicId === ep.id
                  );
                  const totalPts = children.reduce(
                    (s, i) => s + (i.storyPoints || 0),
                    0
                  );
                  const donePts = children
                    .filter((i) => i.status === IssueStatus.DONE)
                    .reduce((s, i) => s + (i.storyPoints || 0), 0);
                  const pct =
                    totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;

                  return (
                    <div
                      key={ep.id}
                      onClick={() => onSelectIssue(ep.id)}
                      className="p-3.5 rounded-md border border-slate-200 hover:border-purple-400 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span className="font-mono text-xs font-semibold text-purple-700">
                            {ep.key}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {ep.title}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-700 shrink-0">
                          {pct}% ({donePts}/{totalPts} pts)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
