import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  FolderGit2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  Sprint,
  SwimlaneMode,
  User,
} from '../types/jira';
import {
  formatShortDate,
  isOverdue,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  StatusIcon,
  TYPE_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface BoardViewProps {
  project: Project;
  activeSprint: Sprint | null;
  issues: Issue[];
  epics: Issue[];
  users: User[];
  currentUserId: string;
  onSelectIssue: (issueId: string) => void;
  onUpdateIssueStatus: (issueId: string, newStatus: IssueStatus) => void;
  onQuickCreateIssue: (payload: {
    title: string;
    type: IssueType;
    status: IssueStatus;
    sprintId: string | null;
    epicId: string | null;
  }) => void;
  onOpenCompleteSprintModal: () => void;
  onOpenScreenshotImporter: () => void;
  onNavigateToBacklog: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  project,
  activeSprint,
  issues,
  epics,
  users,
  currentUserId,
  onSelectIssue,
  onUpdateIssueStatus,
  onQuickCreateIssue,
  onOpenCompleteSprintModal,
  onOpenScreenshotImporter,
  onNavigateToBacklog,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [swimlaneMode, setSwimlaneMode] = useState<SwimlaneMode>(SwimlaneMode.NONE);
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<IssueStatus | null>(null);

  // Inline create state per status column
  const [inlineCreateStatus, setInlineCreateStatus] = useState<IssueStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType, setInlineType] = useState<IssueType>(IssueType.STORY);

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const epicMap = useMemo(() => {
    const map: Record<string, Issue> = {};
    epics.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [epics]);

  // Board issues: if Scrum template with an active sprint, show active sprint non-epic issues.
  // If Kanban template, show all non-epic project issues.
  const boardBaseIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (iss.type === IssueType.EPIC) return false;
      if (project.template === 'Kanban') return true;
      if (!activeSprint) return false;
      return iss.sprintId === activeSprint.id;
    });
  }, [issues, project.template, activeSprint]);

  const filteredIssues = useMemo(() => {
    return boardBaseIssues.filter((iss) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = iss.key.toLowerCase().includes(q);
        const matchesTitle = iss.title.toLowerCase().includes(q);
        const matchesLabels = iss.labels.some((l) => l.toLowerCase().includes(q));
        if (!matchesKey && !matchesTitle && !matchesLabels) return false;
      }
      if (onlyMyIssues && iss.assigneeId !== currentUserId) {
        return false;
      }
      if (selectedAssigneeIds.length > 0) {
        if (!iss.assigneeId || !selectedAssigneeIds.includes(iss.assigneeId)) {
          return false;
        }
      }
      if (selectedEpicId !== 'ALL') {
        if (selectedEpicId === 'NONE' && iss.epicId !== null) return false;
        if (selectedEpicId !== 'NONE' && iss.epicId !== selectedEpicId) return false;
      }
      if (selectedType !== 'ALL' && iss.type !== selectedType) {
        return false;
      }
      if (selectedPriority !== 'ALL' && iss.priority !== selectedPriority) {
        return false;
      }
      return true;
    });
  }, [
    boardBaseIssues,
    searchQuery,
    onlyMyIssues,
    currentUserId,
    selectedAssigneeIds,
    selectedEpicId,
    selectedType,
    selectedPriority,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    onlyMyIssues ||
    selectedAssigneeIds.length > 0 ||
    selectedEpicId !== 'ALL' ||
    selectedType !== 'ALL' ||
    selectedPriority !== 'ALL';

  const clearAllFilters = () => {
    setSearchQuery('');
    setOnlyMyIssues(false);
    setSelectedAssigneeIds([]);
    setSelectedEpicId('ALL');
    setSelectedType('ALL');
    setSelectedPriority('ALL');
  };

  const toggleAssigneeFilter = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleInlineSubmit = (e: React.FormEvent, status: IssueStatus) => {
    e.preventDefault();
    if (!inlineTitle.trim()) return;
    onQuickCreateIssue({
      title: inlineTitle.trim(),
      type: inlineType,
      status,
      sprintId: activeSprint ? activeSprint.id : null,
      epicId: selectedEpicId !== 'ALL' && selectedEpicId !== 'NONE' ? selectedEpicId : null,
    });
    setInlineTitle('');
    setInlineCreateStatus(null);
  };

  // Swimlane groups calculation
  const swimlanes = useMemo(() => {
    if (swimlaneMode === SwimlaneMode.NONE) {
      return [{ id: 'all', title: 'All Issues', subtitle: '', issues: filteredIssues }];
    }
    if (swimlaneMode === SwimlaneMode.EPIC) {
      const groups: { id: string; title: string; subtitle: string; issues: Issue[] }[] = [];
      epics.forEach((epic) => {
        const epicIssues = filteredIssues.filter((i) => i.epicId === epic.id);
        if (epicIssues.length > 0) {
          groups.push({
            id: epic.id,
            title: `${epic.key} · ${epic.title}`,
            subtitle: `${epicIssues.length} issues`,
            issues: epicIssues,
          });
        }
      });
      const unlinked = filteredIssues.filter((i) => !i.epicId);
      if (unlinked.length > 0) {
        groups.push({
          id: 'no-epic',
          title: 'Issues without an Epic',
          subtitle: `${unlinked.length} issues`,
          issues: unlinked,
        });
      }
      return groups;
    }
    if (swimlaneMode === SwimlaneMode.ASSIGNEE) {
      const groups: { id: string; title: string; subtitle: string; issues: Issue[] }[] = [];
      users.forEach((user) => {
        const userIssues = filteredIssues.filter((i) => i.assigneeId === user.id);
        if (userIssues.length > 0) {
          groups.push({
            id: user.id,
            title: user.name,
            subtitle: `${user.role} · ${userIssues.length} issues`,
            issues: userIssues,
          });
        }
      });
      const unassigned = filteredIssues.filter((i) => !i.assigneeId);
      if (unassigned.length > 0) {
        groups.push({
          id: 'unassigned',
          title: 'Unassigned',
          subtitle: `${unassigned.length} issues`,
          issues: unassigned,
        });
      }
      return groups;
    }
    if (swimlaneMode === SwimlaneMode.PRIORITY) {
      const priorities = [
        IssuePriority.HIGHEST,
        IssuePriority.HIGH,
        IssuePriority.MEDIUM,
        IssuePriority.LOW,
        IssuePriority.LOWEST,
      ];
      return priorities
        .map((p) => {
          const pIssues = filteredIssues.filter((i) => i.priority === p);
          return {
            id: p,
            title: `${PRIORITY_CONFIG[p].label} Priority`,
            subtitle: `${pIssues.length} issues`,
            issues: pIssues,
          };
        })
        .filter((g) => g.issues.length > 0);
    }
    return [{ id: 'all', title: 'All Issues', subtitle: '', issues: filteredIssues }];
  }, [swimlaneMode, filteredIssues, epics, users]);

  const sprintMetrics = useMemo(() => {
    const totalPoints = boardBaseIssues.reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const donePoints = boardBaseIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((acc, i) => acc + (i.storyPoints || 0), 0);
    const doneCount = boardBaseIssues.filter((i) => i.status === IssueStatus.DONE).length;
    return {
      totalPoints,
      donePoints,
      totalCount: boardBaseIssues.length,
      doneCount,
    };
  }, [boardBaseIssues]);

  const renderIssueCard = (issue: Issue) => {
    const assignee = issue.assigneeId ? userMap[issue.assigneeId] : null;
    const epic = issue.epicId ? epicMap[issue.epicId] : null;
    const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
    const overdue = isOverdue(issue.dueDate, issue.status);

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => {
          setDraggedIssueId(issue.id);
          e.dataTransfer.setData('text/plain', issue.id);
        }}
        onDragEnd={() => {
          setDraggedIssueId(null);
          setDragOverColumn(null);
        }}
        onClick={() => onSelectIssue(issue.id)}
        className={`group bg-white border border-slate-200 rounded-md p-3.5 cursor-pointer hover:border-blue-500 transition-colors select-none ${
          draggedIssueId === issue.id ? 'opacity-50' : ''
        }`}
      >
        {/* Optional quiet 1-line text kicker for parent Epic */}
        {epic && (
          <div className="text-[11px] font-medium text-purple-700 truncate mb-1">
            {epic.key} · {epic.title}
          </div>
        )}

        {/* Primary Issue Title */}
        <h4 className="text-sm font-medium text-slate-900 leading-snug group-hover:text-blue-700 transition-colors mb-2">
          {issue.title}
        </h4>

        {/* Unboxed inline metadata for labels and due dates (Zero-Pill compliance) */}
        {(issue.labels.length > 0 || issue.dueDate) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-3">
            {issue.labels.length > 0 && (
              <span className="truncate max-w-[180px]">{issue.labels.join(' · ')}</span>
            )}
            {issue.labels.length > 0 && issue.dueDate && <span aria-hidden="true">·</span>}
            {issue.dueDate && (
              <span
                className={`font-mono tabular-nums ${
                  overdue ? 'text-red-600 font-medium' : 'text-slate-500'
                }`}
              >
                {overdue ? `Overdue ${formatShortDate(issue.dueDate)}` : `Due ${formatShortDate(issue.dueDate)}`}
              </span>
            )}
          </div>
        )}

        {/* Bottom Metadata Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2 min-w-0">
            <IssueTypeIcon type={issue.type} className="w-3.5 h-3.5" />
            <span
              className={`font-mono tabular-nums font-medium ${
                issue.status === IssueStatus.DONE ? 'line-through text-slate-400' : 'text-slate-600'
              }`}
            >
              {issue.key}
            </span>
            {issue.subtasks.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span
                  className="font-mono tabular-nums text-[11px] text-slate-500"
                  title="Subtasks completed"
                >
                  {completedSubtasks}/{issue.subtasks.length}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="flex items-center gap-1"
              title={`Priority: ${PRIORITY_CONFIG[issue.priority].label}`}
            >
              <PriorityIcon priority={issue.priority} />
              <span className="text-[11px] text-slate-500 hidden xl:inline">
                {PRIORITY_CONFIG[issue.priority].label}
              </span>
            </div>

            {issue.storyPoints > 0 && (
              <span
                className="font-mono tabular-nums text-xs font-semibold text-slate-700"
                title="Story Points"
              >
                {issue.storyPoints}p
              </span>
            )}

            <UserAvatar user={assignee} size="xs" />
          </div>
        </div>
      </div>
    );
  };

  if (project.template === 'Scrum' && !activeSprint) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <div className="bg-white border border-slate-200 rounded-lg p-10">
          <FolderGit2 className="w-10 h-10 text-blue-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            No Active Sprint in {project.name}
          </h2>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            Start a planned sprint from the Backlog view to track stories, tasks, and bugs on the active board.
          </p>
          <button
            onClick={onNavigateToBacklog}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Go to Backlog & Start Sprint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board Header & Active Sprint Context */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">{project.key} Board</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {activeSprint ? activeSprint.name : `${project.name} Kanban Board`}
              </h1>
              {activeSprint && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                  <span>
                    {formatShortDate(activeSprint.startDate)} – {formatShortDate(activeSprint.endDate)}
                  </span>
                  <span>·</span>
                  <span>
                    {sprintMetrics.donePoints}/{sprintMetrics.totalPoints} pts completed
                  </span>
                  <span>·</span>
                  <span>
                    {sprintMetrics.doneCount}/{sprintMetrics.totalCount} issues done
                  </span>
                </div>
              )}
            </div>
            {activeSprint?.goal && (
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-semibold text-slate-700">Sprint Goal:</span> {activeSprint.goal}
              </p>
            )}
          </div>

          {/* Right Sprint Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenScreenshotImporter}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Import Board Screenshot
            </button>
            {activeSprint && (
              <button
                onClick={onOpenCompleteSprintModal}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                Complete Sprint
              </button>
            )}
          </div>
        </div>

        {/* Interactive Board Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by key, title, label..."
                className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white w-52 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Interactive Assignee Avatars Filter */}
            <div className="flex items-center -space-x-1 px-1">
              {users.map((user) => {
                const isSelected = selectedAssigneeIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleAssigneeFilter(user.id)}
                    className={`rounded-full transition-transform focus:outline-none ${
                      isSelected
                        ? 'ring-2 ring-blue-600 ring-offset-1 z-10 scale-105'
                        : 'opacity-85 hover:opacity-100 hover:z-10'
                    }`}
                    title={`Filter by ${user.name}`}
                  >
                    <UserAvatar user={user} size="sm" />
                  </button>
                );
              })}
            </div>

            {/* Only My Issues Button */}
            <button
              type="button"
              onClick={() => setOnlyMyIssues((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                onlyMyIssues
                  ? 'bg-blue-50 border-blue-600 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Only My Issues
            </button>

            {/* Epic Filter Select */}
            <select
              value={selectedEpicId}
              onChange={(e) => setSelectedEpicId(e.target.value)}
              aria-label="Filter by Epic"
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Epics</option>
              {epics.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.key}: {ep.title.slice(0, 28)}
                </option>
              ))}
              <option value="NONE">No Epic</option>
            </select>

            {/* Issue Type Filter Select */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter by Issue Type"
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Types</option>
              <option value={IssueType.STORY}>Story</option>
              <option value={IssueType.TASK}>Task</option>
              <option value={IssueType.BUG}>Bug</option>
              <option value={IssueType.SUBTASK}>Sub-task</option>
            </select>

            {/* Priority Filter Select */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              aria-label="Filter by Priority"
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Priorities</option>
              <option value={IssuePriority.HIGHEST}>Highest</option>
              <option value={IssuePriority.HIGH}>High</option>
              <option value={IssuePriority.MEDIUM}>Medium</option>
              <option value={IssuePriority.LOW}>Low</option>
              <option value={IssuePriority.LOWEST}>Lowest</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Right side: Group By / Swimlanes */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Group by:</span>
            <select
              value={swimlaneMode}
              onChange={(e) => setSwimlaneMode(e.target.value as SwimlaneMode)}
              aria-label="Group board by swimlane"
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-blue-600"
            >
              <option value={SwimlaneMode.NONE}>None (Columns)</option>
              <option value={SwimlaneMode.EPIC}>Epic</option>
              <option value={SwimlaneMode.ASSIGNEE}>Assignee</option>
              <option value={SwimlaneMode.PRIORITY}>Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Board Columns Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-6 bg-slate-50">
        {swimlaneMode === SwimlaneMode.NONE ? (
          <div className="grid grid-cols-5 gap-4 min-w-[1160px] h-full items-start">
            {STATUS_ORDER.map((status) => {
              const colIssues = filteredIssues
                .filter((i) => i.status === status)
                .sort((a, b) => a.order - b.order);
              const colPoints = colIssues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
              const wipLimit = project.wipLimits[status] || 0;
              const isOverWip = wipLimit > 0 && colIssues.length > wipLimit;

              return (
                <div
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverColumn !== status) setDragOverColumn(status);
                  }}
                  onDragLeave={() => {
                    if (dragOverColumn === status) setDragOverColumn(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
                    if (issueId) {
                      onUpdateIssueStatus(issueId, status);
                    }
                    setDraggedIssueId(null);
                    setDragOverColumn(null);
                  }}
                  className={`flex flex-col rounded-lg border transition-colors ${
                    dragOverColumn === status
                      ? 'bg-blue-50/60 border-blue-400'
                      : isOverWip
                      ? 'bg-red-50/40 border-red-300'
                      : 'bg-slate-100/80 border-slate-200'
                  }`}
                >
                  {/* Column Header */}
                  <div className="px-3.5 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon status={status} />
                      <h3 className="text-xs font-semibold text-slate-800 truncate">
                        {STATUS_CONFIG[status].label}
                      </h3>
                      <span className="font-mono tabular-nums text-xs text-slate-500">
                        {colIssues.length}
                        {wipLimit > 0 ? `/${wipLimit}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOverWip && (
                        <span
                          className="text-[11px] font-medium text-red-600 flex items-center gap-1"
                          title={`Exceeds WIP limit of ${wipLimit}`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Max {wipLimit}
                        </span>
                      )}
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {colPoints} pts
                      </span>
                    </div>
                  </div>

                  {/* Column Cards List */}
                  <div className="p-2.5 space-y-2.5 min-h-[220px]">
                    {colIssues.length === 0 ? (
                      <div className="h-28 border border-dashed border-slate-300 rounded-md flex items-center justify-center text-xs text-slate-400">
                        Drop issues here
                      </div>
                    ) : (
                      colIssues.map((issue) => renderIssueCard(issue))
                    )}

                    {/* Quick Inline Issue Creator */}
                    {inlineCreateStatus === status ? (
                      <form
                        onSubmit={(e) => handleInlineSubmit(e, status)}
                        className="bg-white border border-blue-600 rounded-md p-2.5 space-y-2"
                      >
                        <textarea
                          rows={2}
                          autoFocus
                          value={inlineTitle}
                          onChange={(e) => setInlineTitle(e.target.value)}
                          placeholder="What needs to be done?"
                          className="w-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              handleInlineSubmit(e, status);
                            } else if (e.key === 'Escape') {
                              setInlineCreateStatus(null);
                            }
                          }}
                        />
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <select
                            value={inlineType}
                            onChange={(e) => setInlineType(e.target.value as IssueType)}
                            aria-label="Issue type"
                            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                          >
                            <option value={IssueType.STORY}>Story</option>
                            <option value={IssueType.TASK}>Task</option>
                            <option value={IssueType.BUG}>Bug</option>
                          </select>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInlineCreateStatus(null)}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Create
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineCreateStatus(status);
                          setInlineTitle('');
                        }}
                        className="w-full py-2 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create issue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Swimlane Grouped View */
          <div className="space-y-6 min-w-[1160px]">
            {/* Sticky Column Headers for Swimlanes */}
            <div className="grid grid-cols-5 gap-4 bg-white border border-slate-200 rounded-md px-3 py-2.5">
              {STATUS_ORDER.map((status) => {
                const count = filteredIssues.filter((i) => i.status === status).length;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <StatusIcon status={status} />
                    <span className="text-xs font-semibold text-slate-800">
                      {STATUS_CONFIG[status].label}
                    </span>
                    <span className="font-mono tabular-nums text-xs text-slate-500">({count})</span>
                  </div>
                );
              })}
            </div>

            {swimlanes.map((lane) => {
              const isCollapsed = !!collapsedSwimlanes[lane.id];
              return (
                <div key={lane.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedSwimlanes((prev) => ({ ...prev, [lane.id]: !prev[lane.id] }))
                    }
                    className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">{lane.title}</span>
                      <span className="text-xs text-slate-500 font-mono tabular-nums">
                        · {lane.subtitle}
                      </span>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="grid grid-cols-5 gap-4 p-4 bg-slate-50/50">
                      {STATUS_ORDER.map((status) => {
                        const cellIssues = lane.issues.filter((i) => i.status === status);
                        return (
                          <div
                            key={status}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
                              if (issueId) onUpdateIssueStatus(issueId, status);
                              setDraggedIssueId(null);
                            }}
                            className="space-y-2.5 min-h-[120px] bg-slate-100/70 border border-slate-200/80 rounded-md p-2.5"
                          >
                            {cellIssues.map((iss) => renderIssueCard(iss))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
