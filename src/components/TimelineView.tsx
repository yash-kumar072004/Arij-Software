import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Zap,
} from 'lucide-react';
import {
  Issue,
  IssueStatus,
  IssueType,
  Project,
  User,
} from '../types/jira';
import {
  formatShortDate,
  IssueTypeIcon,
  STATUS_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface TimelineViewProps {
  project: Project;
  issues: Issue[];
  epics: Issue[];
  users: User[];
  onSelectIssue: (issueId: string) => void;
  onQuickCreateIssue: (payload: {
    title: string;
    type: IssueType;
    status: IssueStatus;
    sprintId: string | null;
    epicId: string | null;
  }) => void;
}

const TIMELINE_START = new Date('2026-09-21T00:00:00Z');
const TIMELINE_END = new Date('2026-11-22T00:00:00Z');
const TOTAL_DAYS = Math.round(
  (TIMELINE_END.getTime() - TIMELINE_START.getTime()) / (1000 * 60 * 60 * 24)
);

const WEEKS = [
  { label: 'Sep 21', date: '2026-09-21' },
  { label: 'Sep 28', date: '2026-09-28' },
  { label: 'Oct 05', date: '2026-10-05' },
  { label: 'Oct 12', date: '2026-10-12' },
  { label: 'Oct 19', date: '2026-10-19' },
  { label: 'Oct 26', date: '2026-10-26' },
  { label: 'Nov 02', date: '2026-11-02' },
  { label: 'Nov 09', date: '2026-11-09' },
  { label: 'Nov 16', date: '2026-11-16' },
];

export const TimelineView: React.FC<TimelineViewProps> = ({
  project,
  issues,
  epics,
  users,
  onSelectIssue,
  onQuickCreateIssue,
}) => {
  const [expandedEpics, setExpandedEpics] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    epics.forEach((e) => {
      initial[e.id] = true;
    });
    return initial;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [newEpicTitle, setNewEpicTitle] = useState('');
  const [creatingEpic, setCreatingEpic] = useState(false);

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const computeBarGeometry = (startDateStr: string, dueDateStr: string) => {
    const s = startDateStr ? new Date(`${startDateStr}T00:00:00Z`) : new Date('2026-10-05T00:00:00Z');
    const e = dueDateStr ? new Date(`${dueDateStr}T00:00:00Z`) : new Date(s.getTime() + 7 * 86400000);
    const startOffsetDays = Math.max(
      0,
      Math.min(TOTAL_DAYS - 2, (s.getTime() - TIMELINE_START.getTime()) / 86400000)
    );
    const durationDays = Math.max(
      3,
      Math.min(TOTAL_DAYS - startOffsetDays, (e.getTime() - s.getTime()) / 86400000)
    );
    const leftPct = (startOffsetDays / TOTAL_DAYS) * 100;
    const widthPct = (durationDays / TOTAL_DAYS) * 100;
    return { leftPct, widthPct };
  };

  // Today marker (2026-10-05)
  const todayPct = useMemo(() => {
    const today = new Date('2026-10-05T12:00:00Z');
    const days = (today.getTime() - TIMELINE_START.getTime()) / 86400000;
    return Math.max(0, Math.min(100, (days / TOTAL_DAYS) * 100));
  }, []);

  const filteredEpics = useMemo(() => {
    return epics.filter((ep) => {
      if (statusFilter !== 'ALL' && ep.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const children = issues.filter((i) => i.epicId === ep.id);
        const childMatches = children.some(
          (c) => c.title.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
        );
        return (
          ep.title.toLowerCase().includes(q) ||
          ep.key.toLowerCase().includes(q) ||
          childMatches
        );
      }
      return true;
    });
  }, [epics, issues, searchQuery, statusFilter]);

  const handleCreateEpic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpicTitle.trim()) return;
    onQuickCreateIssue({
      title: newEpicTitle.trim(),
      type: IssueType.EPIC,
      status: IssueStatus.TODO,
      sprintId: null,
      epicId: null,
    });
    setNewEpicTitle('');
    setCreatingEpic(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">Timeline & Epic Roadmap</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {project.key} Roadmap Timeline
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter epics & child issues..."
                className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter timeline by status"
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value={IssueStatus.TODO}>To Do</option>
              <option value={IssueStatus.IN_PROGRESS}>In Progress</option>
              <option value={IssueStatus.DONE}>Done</option>
            </select>

            <button
              type="button"
              onClick={() => setCreatingEpic(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Epic
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Grid Container */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden min-w-[1100px]">
          {/* Timeline Table Header */}
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50">
            <div className="col-span-5 px-4 py-3 border-r border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Epic / Child Work Breakdown</span>
              <span>Status · Progress</span>
            </div>
            <div className="col-span-7 grid grid-cols-9 relative">
              {WEEKS.map((wk) => (
                <div
                  key={wk.date}
                  className="px-2 py-3 text-[11px] font-mono tabular-nums text-slate-500 border-r border-slate-200/60 last:border-r-0 text-center"
                >
                  {wk.label}
                </div>
              ))}
            </div>
          </div>

          {/* Epics & Child Rows */}
          <div className="divide-y divide-slate-200 relative">
            {filteredEpics.map((epic) => {
              const childIssues = issues.filter((i) => i.epicId === epic.id);
              const doneCount = childIssues.filter(
                (i) => i.status === IssueStatus.DONE
              ).length;
              const pct =
                childIssues.length > 0
                  ? Math.round((doneCount / childIssues.length) * 100)
                  : epic.status === IssueStatus.DONE
                  ? 100
                  : 0;
              const isExpanded = !!expandedEpics[epic.id];
              const epicGeom = computeBarGeometry(epic.startDate, epic.dueDate);
              const assignee = epic.assigneeId ? userMap[epic.assigneeId] : null;

              return (
                <React.Fragment key={epic.id}>
                  {/* Epic Parent Row */}
                  <div className="grid grid-cols-12 hover:bg-slate-50/80 transition-colors">
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
                          className="text-slate-400 hover:text-slate-700 shrink-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <Zap className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="font-mono tabular-nums text-xs font-semibold text-purple-700 shrink-0">
                          {epic.key}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectIssue(epic.id)}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600 truncate text-left"
                        >
                          {epic.title}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono tabular-nums text-xs text-slate-500">
                          {doneCount}/{childIssues.length} ({pct}%)
                        </span>
                        <UserAvatar user={assignee} size="xs" />
                      </div>
                    </div>

                    {/* Right Timeline Bar Area */}
                    <div className="col-span-7 relative py-3 px-1 flex items-center bg-slate-50/20">
                      {/* Today Vertical Line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-500/40 pointer-events-none z-10"
                        style={{ left: `${todayPct}%` }}
                      />
                      <div
                        onClick={() => onSelectIssue(epic.id)}
                        style={{
                          left: `${epicGeom.leftPct}%`,
                          width: `${epicGeom.widthPct}%`,
                        }}
                        className="relative h-6 rounded bg-purple-100 border border-purple-400 cursor-pointer overflow-hidden flex items-center px-2 hover:border-purple-600 transition-colors"
                        title={`${epic.key}: ${formatShortDate(epic.startDate)} – ${formatShortDate(epic.dueDate)} (${pct}% complete)`}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-purple-600/25"
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative z-10 text-[11px] font-mono tabular-nums font-medium text-purple-900 truncate">
                          {formatShortDate(epic.startDate)} – {formatShortDate(epic.dueDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Child Issues */}
                  {isExpanded &&
                    childIssues.map((child) => {
                      const childGeom = computeBarGeometry(child.startDate, child.dueDate);
                      const childAssignee = child.assigneeId
                        ? userMap[child.assigneeId]
                        : null;
                      const barColor =
                        child.status === IssueStatus.DONE
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-900'
                          : child.status === IssueStatus.IN_PROGRESS ||
                            child.status === IssueStatus.IN_REVIEW ||
                            child.status === IssueStatus.QA
                          ? 'bg-blue-100 border-blue-500 text-blue-900'
                          : 'bg-slate-100 border-slate-400 text-slate-800';

                      return (
                        <div
                          key={child.id}
                          className="grid grid-cols-12 bg-slate-50/40 hover:bg-slate-100/60 transition-colors"
                        >
                          <div className="col-span-5 pl-11 pr-4 py-2.5 border-r border-slate-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <IssueTypeIcon type={child.type} className="w-3.5 h-3.5" />
                              <span className="font-mono tabular-nums text-xs text-slate-500 shrink-0">
                                {child.key}
                              </span>
                              <button
                                type="button"
                                onClick={() => onSelectIssue(child.id)}
                                className="text-xs font-medium text-slate-800 hover:text-blue-600 truncate text-left"
                              >
                                {child.title}
                              </button>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <span
                                className={`text-[11px] font-semibold ${
                                  STATUS_CONFIG[child.status].textClass
                                }`}
                              >
                                {STATUS_CONFIG[child.status].shortLabel}
                              </span>
                              <UserAvatar user={childAssignee} size="xs" />
                            </div>
                          </div>

                          <div className="col-span-7 relative py-2 px-1 flex items-center">
                            <div
                              className="absolute top-0 bottom-0 w-px bg-blue-500/40 pointer-events-none"
                              style={{ left: `${todayPct}%` }}
                            />
                            <div
                              onClick={() => onSelectIssue(child.id)}
                              style={{
                                left: `${childGeom.leftPct}%`,
                                width: `${childGeom.widthPct}%`,
                              }}
                              className={`relative h-5 rounded border cursor-pointer flex items-center px-2 text-[10px] font-mono tabular-nums truncate ${barColor}`}
                              title={`${child.key}: ${formatShortDate(child.startDate)} – ${formatShortDate(child.dueDate)}`}
                            >
                              {child.key} · {formatShortDate(child.dueDate)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </div>

          {/* Inline Create Epic Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200">
            {creatingEpic ? (
              <form onSubmit={handleCreateEpic} className="flex items-center gap-2 max-w-xl">
                <Zap className="w-4 h-4 text-purple-600 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={newEpicTitle}
                  onChange={(e) => setNewEpicTitle(e.target.value)}
                  placeholder="New Epic title..."
                  className="flex-1 text-xs px-3 py-1.5 bg-white border border-purple-500 rounded focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Create Epic
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingEpic(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-500"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingEpic(true)}
                className="text-xs font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1.5 px-2 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Epic on Roadmap
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
