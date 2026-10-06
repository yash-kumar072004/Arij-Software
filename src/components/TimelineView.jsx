import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Zap,
} from 'lucide-react';
import { IssueStatus, IssueType } from '../types/jira.js';
import {
  formatShortDate,
  IssueTypeIcon,
  STATUS_CONFIG,
  UserAvatar,
} from './JiraPrimitives.jsx';

const TIMELINE_START = new Date('2026-09-15T00:00:00Z').getTime();
const TIMELINE_END = new Date('2026-11-10T00:00:00Z').getTime();
const TOTAL_SPAN_MS = TIMELINE_END - TIMELINE_START;

const TIMELINE_WEEKS = [
  { label: 'Sep 15', date: '2026-09-15' },
  { label: 'Sep 22', date: '2026-09-22' },
  { label: 'Sep 29', date: '2026-09-29' },
  { label: 'Oct 06 (Today)', date: '2026-10-06', isToday: true },
  { label: 'Oct 13', date: '2026-10-13' },
  { label: 'Oct 20', date: '2026-10-20' },
  { label: 'Oct 27', date: '2026-10-27' },
  { label: 'Nov 03', date: '2026-11-03' },
];

function computeBarGeometry(startDate, dueDate) {
  const startMs = startDate
    ? new Date(startDate).getTime()
    : new Date('2026-09-28').getTime();
  const endMs = dueDate
    ? new Date(dueDate).getTime()
    : startMs + 10 * 24 * 3600 * 1000;

  const clampedStart = Math.max(
    TIMELINE_START,
    Math.min(TIMELINE_END, startMs)
  );
  const clampedEnd = Math.max(
    clampedStart + 2 * 24 * 3600 * 1000,
    Math.min(TIMELINE_END, endMs)
  );

  const leftPct = ((clampedStart - TIMELINE_START) / TOTAL_SPAN_MS) * 100;
  const widthPct = Math.max(
    4,
    ((clampedEnd - clampedStart) / TOTAL_SPAN_MS) * 100
  );

  return { leftPct, widthPct };
}

export const TimelineView = ({
  project,
  issues,
  epics,
  users,
  onSelectIssue,
  onQuickCreateIssue,
}) => {
  const [expandedEpics, setExpandedEpics] = useState(() => {
    const init = {};
    epics.forEach((e) => {
      init[e.id] = true;
    });
    return init;
  });

  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [showNewEpicInput, setShowNewEpicInput] = useState(false);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const todayLeftPct = useMemo(() => {
    const todayMs = new Date('2026-10-06T00:00:00Z').getTime();
    return ((todayMs - TIMELINE_START) / TOTAL_SPAN_MS) * 100;
  }, []);

  const handleCreateEpic = (e) => {
    e.preventDefault();
    if (!newEpicTitle.trim()) return;
    onQuickCreateIssue({
      title: newEpicTitle.trim(),
      type: IssueType.EPIC,
      status: IssueStatus.IN_PROGRESS,
      sprintId: null,
      epicId: null,
    });
    setNewEpicTitle('');
    setShowNewEpicInput(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{project.name}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">
              Timeline & Epic Roadmap
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            {project.key} Strategic Roadmap & Schedule
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowNewEpicInput(true)}
          className="px-3.5 py-2 text-xs font-semibold bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Roadmap Epic
        </button>
      </div>

      {/* Gantt Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs min-w-[1080px] overflow-hidden">
          {/* Timeline Column Header */}
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
            <div className="col-span-5 px-4 py-3 border-r border-slate-200 flex items-center justify-between">
              <span>Epic / Child Work Item</span>
              <span className="text-[11px] font-normal text-slate-500">
                Status & Progress
              </span>
            </div>
            <div className="col-span-7 grid grid-cols-8 relative">
              {TIMELINE_WEEKS.map((wk) => (
                <div
                  key={wk.date}
                  className={`px-2 py-3 text-center border-r border-slate-200 last:border-r-0 font-mono text-[11px] ${
                    wk.isToday
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {wk.label}
                </div>
              ))}
            </div>
          </div>

          {/* Epics & Child Issues Rows */}
          <div className="divide-y divide-slate-200 relative">
            {epics.map((epic) => {
              const childIssues = issues.filter((i) => i.epicId === epic.id);
              const doneCount = childIssues.filter(
                (i) => i.status === IssueStatus.DONE
              ).length;
              const pct =
                childIssues.length > 0
                  ? Math.round((doneCount / childIssues.length) * 100)
                  : 0;
              const isExpanded = Boolean(expandedEpics[epic.id]);
              const { leftPct, widthPct } = computeBarGeometry(
                epic.startDate,
                epic.dueDate
              );

              return (
                <React.Fragment key={epic.id}>
                  {/* Epic Parent Row */}
                  <div className="grid grid-cols-12 bg-slate-50/70 hover:bg-slate-100/70 transition-colors">
                    <div className="col-span-5 px-4 py-3 border-r border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEpics((prev) => ({
                              ...prev,
                              [epic.id]: !prev[epic.id],
                            }))
                          }
                          className="p-0.5 text-slate-500 hover:text-slate-900"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <Zap className="w-4 h-4 text-purple-600 shrink-0" />
                        <button
                          type="button"
                          onClick={() => onSelectIssue(epic.id)}
                          className="text-left min-w-0"
                        >
                          <span className="font-mono text-xs font-semibold text-purple-700 mr-2">
                            {epic.key}
                          </span>
                          <span className="text-sm font-bold text-slate-900 hover:text-blue-600 truncate">
                            {epic.title}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-600">
                          {pct}% ({doneCount}/{childIssues.length})
                        </span>
                      </div>
                    </div>

                    {/* Gantt Bar Track */}
                    <div className="col-span-7 relative flex items-center py-3 px-1">
                      {/* Today Vertical Marker */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-500/50 z-10 pointer-events-none"
                        style={{ left: `${todayLeftPct}%` }}
                      />

                      <div
                        onClick={() => onSelectIssue(epic.id)}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        className="relative h-6 rounded-md bg-purple-600 hover:bg-purple-700 text-white px-2.5 flex items-center justify-between text-[11px] font-semibold shadow-xs cursor-pointer transition-colors overflow-hidden"
                      >
                        <span className="truncate">{epic.title}</span>
                        <span className="font-mono text-[10px] opacity-90 shrink-0 ml-2">
                          {formatShortDate(epic.startDate)} –{' '}
                          {formatShortDate(epic.dueDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Child Issues under Epic */}
                  {isExpanded &&
                    childIssues.map((child) => {
                      const geom = computeBarGeometry(
                        child.startDate,
                        child.dueDate
                      );
                      const assignee = child.assigneeId
                        ? userMap[child.assigneeId]
                        : null;
                      const barColor =
                        child.status === IssueStatus.DONE
                          ? 'bg-emerald-600'
                          : child.status === IssueStatus.IN_PROGRESS ||
                            child.status === IssueStatus.IN_REVIEW ||
                            child.status === IssueStatus.QA
                          ? 'bg-blue-600'
                          : 'bg-slate-400';

                      return (
                        <div
                          key={child.id}
                          onClick={() => onSelectIssue(child.id)}
                          className="grid grid-cols-12 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="col-span-5 pl-10 pr-4 py-2.5 border-r border-slate-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <IssueTypeIcon
                                type={child.type}
                                className="w-3.5 h-3.5"
                              />
                              <span className="font-mono text-xs text-slate-500 shrink-0">
                                {child.key}
                              </span>
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {child.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-[11px] font-semibold ${STATUS_CONFIG[child.status].textClass}`}
                              >
                                {STATUS_CONFIG[child.status].label}
                              </span>
                              <UserAvatar user={assignee} size="xs" />
                            </div>
                          </div>

                          <div className="col-span-7 relative flex items-center py-2 px-1">
                            <div
                              className="absolute top-0 bottom-0 w-px bg-blue-500/40 pointer-events-none"
                              style={{ left: `${todayLeftPct}%` }}
                            />
                            <div
                              style={{
                                left: `${geom.leftPct}%`,
                                width: `${geom.widthPct}%`,
                              }}
                              className={`relative h-4 rounded ${barColor} text-white px-2 flex items-center text-[10px] font-mono truncate shadow-2xs`}
                            >
                              {child.key} ({child.storyPoints}p)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>

          {/* Quick Add Epic Row */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            {showNewEpicInput ? (
              <form
                onSubmit={handleCreateEpic}
                className="flex items-center gap-2 max-w-md"
              >
                <input
                  type="text"
                  autoFocus
                  value={newEpicTitle}
                  onChange={(e) => setNewEpicTitle(e.target.value)}
                  placeholder="Enter new Epic title..."
                  className="flex-1 text-xs bg-white border border-purple-500 rounded px-3 py-1.5 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Create Epic
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewEpicInput(false)}
                  className="px-2 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewEpicInput(true)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Epic on Timeline
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
