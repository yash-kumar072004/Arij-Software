import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Play,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  Zap,
  X,
} from 'lucide-react';
import {
  Issue,
  IssuePriority,
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
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './JiraPrimitives';

interface BacklogViewProps {
  project: Project;
  sprints: Sprint[];
  issues: Issue[];
  epics: Issue[];
  users: User[];
  onSelectIssue: (issueId: string) => void;
  onUpdateIssue: (issueId: string, updates: Partial<Issue>) => void;
  onQuickCreateIssue: (payload: {
    title: string;
    type: IssueType;
    status: IssueStatus;
    sprintId: string | null;
    epicId: string | null;
  }) => void;
  onCreateSprint: () => void;
  onStartSprintModal: (sprint: Sprint) => void;
  onOpenCompleteSprintModal: () => void;
  onDeleteSprint: (sprintId: string) => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  project,
  sprints,
  issues,
  epics,
  users,
  onSelectIssue,
  onUpdateIssue,
  onQuickCreateIssue,
  onCreateSprint,
  onStartSprintModal,
  onOpenCompleteSprintModal,
  onDeleteSprint,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEpicFilter, setSelectedEpicFilter] = useState<string>('ALL');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('ALL');
  const [showEpicsPanel, setShowEpicsPanel] = useState(true);
  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({});
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);

  // Inline issue creation per container (sprintId or 'BACKLOG')
  const [inlineTarget, setInlineTarget] = useState<string | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType, setInlineType] = useState<IssueType>(IssueType.STORY);

  // Inline Epic creation in Epic Panel
  const [creatingEpic, setCreatingEpic] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState('');

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

  const activeAndPlannedSprints = useMemo(() => {
    return sprints.filter(
      (s) => s.status === SprintStatus.ACTIVE || s.status === SprintStatus.PLANNED
    );
  }, [sprints]);

  const nonEpicIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (iss.type === IssueType.EPIC) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !iss.key.toLowerCase().includes(q) &&
          !iss.title.toLowerCase().includes(q) &&
          !iss.labels.some((l) => l.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (selectedEpicFilter !== 'ALL') {
        if (selectedEpicFilter === 'NONE' && iss.epicId !== null) return false;
        if (selectedEpicFilter !== 'NONE' && iss.epicId !== selectedEpicFilter) return false;
      }
      if (selectedAssigneeId !== 'ALL') {
        if (iss.assigneeId !== selectedAssigneeId) return false;
      }
      return true;
    });
  }, [issues, searchQuery, selectedEpicFilter, selectedAssigneeId]);

  const handleInlineCreateIssue = (e: React.FormEvent, sprintId: string | null) => {
    e.preventDefault();
    if (!inlineTitle.trim()) return;
    onQuickCreateIssue({
      title: inlineTitle.trim(),
      type: inlineType,
      status: IssueStatus.TODO,
      sprintId,
      epicId:
        selectedEpicFilter !== 'ALL' && selectedEpicFilter !== 'NONE'
          ? selectedEpicFilter
          : null,
    });
    setInlineTitle('');
    setInlineTarget(null);
  };

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

  const computePointsSummary = (containerIssues: Issue[]) => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    containerIssues.forEach((i) => {
      const pts = i.storyPoints || 0;
      if (i.status === IssueStatus.TODO) todo += pts;
      else if (i.status === IssueStatus.DONE) done += pts;
      else inProgress += pts;
    });
    return { todo, inProgress, done, total: todo + inProgress + done };
  };

  const renderIssueRow = (issue: Issue) => {
    const assignee = issue.assigneeId ? userMap[issue.assigneeId] : null;
    const epic = issue.epicId ? epicMap[issue.epicId] : null;

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => {
          setDraggedIssueId(issue.id);
          e.dataTransfer.setData('text/plain', issue.id);
        }}
        onDragEnd={() => setDraggedIssueId(null)}
        onClick={() => onSelectIssue(issue.id)}
        className="group flex items-center justify-between gap-4 px-4 py-2.5 bg-white hover:bg-slate-50 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors"
      >
        {/* Left: Type + Key + Title + Epic Reference */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <IssueTypeIcon type={issue.type} className="w-4 h-4" />
          <span
            className={`font-mono tabular-nums text-xs font-medium shrink-0 ${
              issue.status === IssueStatus.DONE ? 'line-through text-slate-400' : 'text-slate-600'
            }`}
          >
            {issue.key}
          </span>
          <span className="text-sm font-medium text-slate-900 truncate group-hover:text-blue-700 transition-colors">
            {issue.title}
          </span>
          {epic && (
            <span className="text-xs text-purple-700 font-medium truncate hidden lg:inline shrink-0">
              · {epic.title}
            </span>
          )}
        </div>

        {/* Right: Sprint mover, Status, Story Points, Priority, Assignee */}
        <div
          className="flex items-center gap-3 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Move between Sprints / Backlog */}
          <select
            value={issue.sprintId || 'BACKLOG'}
            onChange={(e) =>
              onUpdateIssue(issue.id, {
                sprintId: e.target.value === 'BACKLOG' ? null : e.target.value,
              })
            }
            aria-label="Move issue to sprint or backlog"
            className="text-xs text-slate-600 bg-transparent hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded px-1.5 py-1 max-w-[140px] truncate"
          >
            <option value="BACKLOG">Backlog</option>
            {activeAndPlannedSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Selector */}
          <select
            value={issue.status}
            onChange={(e) =>
              onUpdateIssue(issue.id, { status: e.target.value as IssueStatus })
            }
            aria-label="Issue status"
            className={`text-xs font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-1 ${
              STATUS_CONFIG[issue.status].textClass
            }`}
          >
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st].label}
              </option>
            ))}
          </select>

          {/* Story Points Input */}
          <div className="flex items-center gap-1" title="Story Points">
            <input
              type="number"
              min={0}
              max={100}
              value={issue.storyPoints || 0}
              onChange={(e) =>
                onUpdateIssue(issue.id, {
                  storyPoints: Math.max(0, parseInt(e.target.value || '0', 10)),
                })
              }
              aria-label="Story points"
              className="w-11 text-right font-mono tabular-nums text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-600"
            />
            <span className="text-[11px] text-slate-400 font-mono">pts</span>
          </div>

          {/* Priority Icon */}
          <div
            className="w-5 flex items-center justify-center"
            title={`Priority: ${PRIORITY_CONFIG[issue.priority].label}`}
          >
            <PriorityIcon priority={issue.priority} />
          </div>

          {/* Assignee Avatar */}
          <UserAvatar user={assignee} size="xs" />
        </div>
      </div>
    );
  };

  const backlogIssues = nonEpicIssues
    .filter((i) => !i.sprintId)
    .sort((a, b) => a.order - b.order);
  const backlogSummary = computePointsSummary(backlogIssues);

  return (
    <div className="flex flex-col h-full">
      {/* Header & Filter Bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">Backlog & Sprint Planning</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {project.key} Backlog
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowEpicsPanel((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                showEpicsPanel
                  ? 'bg-purple-50 border-purple-600 text-purple-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Epics Panel
            </button>

            <button
              type="button"
              onClick={onCreateSprint}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              + Create Sprint
            </button>
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search backlog & sprints..."
              className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white w-60"
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

          {/* Assignee Filter */}
          <select
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            aria-label="Filter backlog by Assignee"
            className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
          >
            <option value="ALL">All Assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {selectedEpicFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedEpicFilter('ALL')}
              className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md flex items-center gap-1.5"
            >
              <span>
                Filtered by Epic:{' '}
                {selectedEpicFilter === 'NONE'
                  ? 'No Epic'
                  : epicMap[selectedEpicFilter]?.key || 'Epic'}
              </span>
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Split Body: Optional Left Epics Panel + Right Sprint/Backlog Containers */}
      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {showEpicsPanel && (
          <aside className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <h2 className="text-xs font-semibold text-slate-900">Epics</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEpicsPanel(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-1.5 flex-1">
              <button
                type="button"
                onClick={() => setSelectedEpicFilter('ALL')}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  selectedEpicFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                All Issues
              </button>

              {epics.map((epic) => {
                const childIssues = issues.filter((i) => i.epicId === epic.id);
                const doneChildren = childIssues.filter(
                  (i) => i.status === IssueStatus.DONE
                ).length;
                const pct =
                  childIssues.length > 0
                    ? Math.round((doneChildren / childIssues.length) * 100)
                    : 0;
                const isSelected = selectedEpicFilter === epic.id;

                return (
                  <div
                    key={epic.id}
                    className={`rounded-md border p-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                    onClick={() =>
                      setSelectedEpicFilter(isSelected ? 'ALL' : epic.id)
                    }
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono tabular-nums text-[11px] font-semibold text-purple-700">
                        {epic.key}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIssue(epic.id);
                        }}
                        className="text-[11px] text-slate-500 hover:text-blue-600"
                      >
                        Details
                      </button>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 leading-snug mb-2">
                      {epic.title}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full bg-purple-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>
                        {doneChildren}/{childIssues.length} done
                      </span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setSelectedEpicFilter(selectedEpicFilter === 'NONE' ? 'ALL' : 'NONE')
                }
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  selectedEpicFilter === 'NONE'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Issues without an Epic
              </button>
            </div>

            {/* Create Epic Footer */}
            <div className="p-3 border-t border-slate-200">
              {creatingEpic ? (
                <form onSubmit={handleCreateEpic} className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={newEpicTitle}
                    onChange={(e) => setNewEpicTitle(e.target.value)}
                    placeholder="Epic name..."
                    className="w-full px-2.5 py-1.5 text-xs border border-purple-500 rounded-md focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatingEpic(false)}
                      className="px-2 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-xs font-semibold bg-purple-600 text-white rounded"
                    >
                      Create Epic
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingEpic(true)}
                  className="w-full py-1.5 px-3 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Epic
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Right Sprints & Backlog List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active & Planned Sprint Containers */}
          {activeAndPlannedSprints.map((sprint) => {
            const sprintIssues = nonEpicIssues
              .filter((i) => i.sprintId === sprint.id)
              .sort((a, b) => a.order - b.order);
            const pts = computePointsSummary(sprintIssues);
            const isCollapsed = !!collapsedContainers[sprint.id];
            const isActive = sprint.status === SprintStatus.ACTIVE;

            return (
              <div
                key={sprint.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
                  if (issueId) {
                    onUpdateIssue(issueId, { sprintId: sprint.id });
                  }
                  setDraggedIssueId(null);
                }}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
              >
                {/* Sprint Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedContainers((prev) => ({
                          ...prev,
                          [sprint.id]: !prev[sprint.id],
                        }))
                      }
                      className="text-slate-500 hover:text-slate-800"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {sprint.name}
                        </h3>
                        <span
                          className={`text-xs font-semibold ${
                            isActive ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          · {isActive ? 'Active Sprint' : 'Planned Sprint'}
                        </span>
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
                          · {formatShortDate(sprint.startDate)} – {formatShortDate(sprint.endDate)}
                        </span>
                        <span className="text-xs text-slate-500 font-mono tabular-nums">
                          · {sprintIssues.length} issues
                        </span>
                      </div>
                      {sprint.goal && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-2xl">
                          Goal: {sprint.goal}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sprint Points Summary & Actions */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-2 text-xs font-mono tabular-nums text-slate-600">
                      <span title="To Do Story Points">To Do: {pts.todo}p</span>
                      <span>·</span>
                      <span className="text-blue-700" title="In Progress Story Points">
                        Active: {pts.inProgress}p
                      </span>
                      <span>·</span>
                      <span className="text-emerald-700" title="Completed Story Points">
                        Done: {pts.done}p
                      </span>
                    </div>

                    {isActive ? (
                      <button
                        type="button"
                        onClick={onOpenCompleteSprintModal}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        Complete Sprint
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onStartSprintModal(sprint)}
                          disabled={sprintIssues.length === 0}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Play className="w-3 h-3" />
                          Start Sprint
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSprint(sprint.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                          title="Delete planned sprint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sprint Issues List */}
                {!isCollapsed && (
                  <div>
                    {sprintIssues.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border-b border-slate-100">
                        Plan your sprint by dragging issues here from the Backlog below or creating a new issue.
                      </div>
                    ) : (
                      sprintIssues.map((iss) => renderIssueRow(iss))
                    )}

                    {/* Inline Create in Sprint */}
                    <div className="px-4 py-2 bg-slate-50/60">
                      {inlineTarget === sprint.id ? (
                        <form
                          onSubmit={(e) => handleInlineCreateIssue(e, sprint.id)}
                          className="flex items-center gap-2"
                        >
                          <select
                            value={inlineType}
                            onChange={(e) => setInlineType(e.target.value as IssueType)}
                            aria-label="Issue type"
                            className="text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1.5"
                          >
                            <option value={IssueType.STORY}>Story</option>
                            <option value={IssueType.TASK}>Task</option>
                            <option value={IssueType.BUG}>Bug</option>
                          </select>
                          <input
                            type="text"
                            autoFocus
                            value={inlineTitle}
                            onChange={(e) => setInlineTitle(e.target.value)}
                            placeholder="What needs to be done in this sprint?"
                            className="flex-1 text-xs px-3 py-1.5 bg-white border border-blue-600 rounded focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineTarget(null)}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setInlineTarget(sprint.id);
                            setInlineTitle('');
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create issue in {sprint.name}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Backlog Container */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
              if (issueId) {
                onUpdateIssue(issueId, { sprintId: null });
              }
              setDraggedIssueId(null);
            }}
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedContainers((prev) => ({
                      ...prev,
                      BACKLOG: !prev.BACKLOG,
                    }))
                  }
                  className="text-slate-500 hover:text-slate-800"
                >
                  {collapsedContainers.BACKLOG ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <h3 className="text-sm font-semibold text-slate-900">Backlog</h3>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  · {backlogIssues.length} issues · {backlogSummary.total} pts
                </span>
              </div>

              <button
                type="button"
                onClick={onCreateSprint}
                className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
              >
                Create Sprint
              </button>
            </div>

            {!collapsedContainers.BACKLOG && (
              <div>
                {backlogIssues.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 border-b border-slate-100">
                    Your backlog is empty. Create new stories, tasks, or bugs below.
                  </div>
                ) : (
                  backlogIssues.map((iss) => renderIssueRow(iss))
                )}

                <div className="px-4 py-2 bg-slate-50/60">
                  {inlineTarget === 'BACKLOG' ? (
                    <form
                      onSubmit={(e) => handleInlineCreateIssue(e, null)}
                      className="flex items-center gap-2"
                    >
                      <select
                        value={inlineType}
                        onChange={(e) => setInlineType(e.target.value as IssueType)}
                        aria-label="Issue type"
                        className="text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1.5"
                      >
                        <option value={IssueType.STORY}>Story</option>
                        <option value={IssueType.TASK}>Task</option>
                        <option value={IssueType.BUG}>Bug</option>
                      </select>
                      <input
                        type="text"
                        autoFocus
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        placeholder="Add an issue to the backlog..."
                        className="flex-1 text-xs px-3 py-1.5 bg-white border border-blue-600 rounded focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setInlineTarget(null)}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineTarget('BACKLOG');
                        setInlineTitle('');
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create issue in Backlog
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
