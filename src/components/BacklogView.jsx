import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Play,
  Plus,
  Search,
  Trash2,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import {
  IssueStatus,
  IssueType,
  SprintStatus,
} from '../types/arij.js';
import {
  formatShortDate,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './ArijPrimitives.jsx';

export const BacklogView = ({
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
  const [selectedEpicId, setSelectedEpicId] = useState(null);
  const [showEpicPanel, setShowEpicPanel] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Quick create state per sprint or backlog ("BACKLOG" or sprint.id)
  const [creatingInContainer, setCreatingInContainer] = useState(null);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueType, setNewIssueType] = useState(IssueType.STORY);

  // Quick create Epic state
  const [creatingEpic, setCreatingEpic] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState('');

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const epicMap = useMemo(() => {
    const map = {};
    epics.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [epics]);

  const nonEpicIssues = useMemo(() => {
    return issues.filter(
      (i) => i.type !== IssueType.EPIC && i.type !== IssueType.SUBTASK
    );
  }, [issues]);

  const filteredIssues = useMemo(() => {
    return nonEpicIssues.filter((i) => {
      if (selectedEpicId && i.epicId !== selectedEpicId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !i.key.toLowerCase().includes(q) &&
          !i.title.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [nonEpicIssues, selectedEpicId, searchQuery]);

  const activeAndPlannedSprints = useMemo(() => {
    return sprints.filter((s) => s.status !== SprintStatus.COMPLETED);
  }, [sprints]);

  const backlogIssues = useMemo(() => {
    return filteredIssues.filter((i) => !i.sprintId);
  }, [filteredIssues]);

  const hasActiveSprint = useMemo(
    () => sprints.some((s) => s.status === SprintStatus.ACTIVE),
    [sprints]
  );

  const handleDragStart = (e, issueId) => {
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropToSprint = (e, targetSprintId) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain');
    if (issueId) {
      onUpdateIssue(issueId, { sprintId: targetSprintId });
    }
  };

  const handleCreateSubmit = (e, sprintId) => {
    e.preventDefault();
    if (!newIssueTitle.trim()) return;
    onQuickCreateIssue({
      title: newIssueTitle.trim(),
      type: newIssueType,
      status: IssueStatus.TODO,
      sprintId,
      epicId: selectedEpicId,
    });
    setNewIssueTitle('');
    setCreatingInContainer(null);
  };

  const handleCreateEpicSubmit = (e) => {
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

  const renderIssueRow = (issue) => {
    const assignee = issue.assigneeId ? userMap[issue.assigneeId] : null;
    const epic = issue.epicId ? epicMap[issue.epicId] : null;

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => handleDragStart(e, issue.id)}
        onClick={() => onSelectIssue(issue.id)}
        className="group px-4 py-2.5 bg-white hover:bg-slate-50 border-b border-slate-200 last:border-b-0 flex items-center justify-between gap-4 cursor-pointer transition-colors"
      >
        {/* Left: Type + Key + Title + Epic */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <IssueTypeIcon type={issue.type} className="w-4 h-4" />
          <span className="font-mono tabular-nums text-xs font-semibold text-slate-500 group-hover:text-blue-600 shrink-0 w-20">
            {issue.key}
          </span>
          <span className="text-sm font-medium text-slate-900 truncate">
            {issue.title}
          </span>
          {epic && (
            <span className="hidden md:inline-block text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded shrink-0 truncate max-w-[180px]">
              {epic.title}
            </span>
          )}
        </div>

        {/* Right: Status Selector + Story Points Input + Priority + Assignee */}
        <div
          className="flex items-center gap-3 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Move Sprint Dropdown */}
          <select
            value={issue.sprintId || ''}
            onChange={(e) =>
              onUpdateIssue(issue.id, {
                sprintId: e.target.value || null,
              })
            }
            aria-label="Move to sprint"
            className="hidden lg:block text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600"
          >
            <option value="">Backlog</option>
            {activeAndPlannedSprints.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name.split('—')[0].trim()}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={issue.status}
            onChange={(e) =>
              onUpdateIssue(issue.id, {
                status: e.target.value,
              })
            }
            aria-label="Status"
            className={`text-xs font-semibold bg-slate-100 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-600 ${STATUS_CONFIG[issue.status].textClass}`}
          >
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {STATUS_CONFIG[st].label}
              </option>
            ))}
          </select>

          {/* Story Points */}
          <input
            type="number"
            min={0}
            max={100}
            value={issue.storyPoints || 0}
            onChange={(e) =>
              onUpdateIssue(issue.id, {
                storyPoints: Math.max(0, Number(e.target.value) || 0),
              })
            }
            aria-label="Story points"
            title="Story Points Estimate"
            className="w-12 text-center font-mono tabular-nums text-xs font-semibold bg-slate-100 border border-slate-200 rounded py-1 text-slate-800 focus:outline-none focus:border-blue-600"
          />

          {/* Priority Icon */}
          <span title={`Priority: ${PRIORITY_CONFIG[issue.priority].label}`}>
            <PriorityIcon priority={issue.priority} className="w-4 h-4" />
          </span>

          {/* Assignee */}
          <UserAvatar user={assignee} size="sm" />
        </div>
      </div>
    );
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
              Backlog & Sprint Planning
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            {project.key} Backlog & Sprint Capacity
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search backlog issues..."
              className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-none focus:border-blue-600 w-56"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowEpicPanel(!showEpicPanel)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 transition-colors ${
              showEpicPanel
                ? 'bg-purple-50 border-purple-600 text-purple-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Epics Panel
          </button>

          <button
            type="button"
            onClick={onCreateSprint}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Sprint
          </button>
        </div>
      </div>

      {/* Main Split Body: Left Epic Panel + Right Sprint & Backlog Lists */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {showEpicPanel && (
          <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Epics ({epics.length})
                </h2>
              </div>
              {selectedEpicId && (
                <button
                  type="button"
                  onClick={() => setSelectedEpicId(null)}
                  className="text-[11px] font-medium text-blue-600 hover:underline"
                >
                  Show all
                </button>
              )}
            </div>

            <div className="p-3 space-y-2 flex-1 overflow-y-auto">
              {epics.map((epic) => {
                const epicIssues = nonEpicIssues.filter(
                  (i) => i.epicId === epic.id
                );
                const doneCount = epicIssues.filter(
                  (i) => i.status === IssueStatus.DONE
                ).length;
                const pct =
                  epicIssues.length > 0
                    ? Math.round((doneCount / epicIssues.length) * 100)
                    : 0;
                const isSelected = selectedEpicId === epic.id;

                return (
                  <div
                    key={epic.id}
                    onClick={() =>
                      setSelectedEpicId(isSelected ? null : epic.id)
                    }
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-50/70 border-purple-500 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono tabular-nums text-[11px] font-semibold text-purple-700">
                        {epic.key}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {doneCount}/{epicIssues.length} done
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 line-clamp-2 mb-2">
                      {epic.title}
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {creatingEpic ? (
                <form
                  onSubmit={handleCreateEpicSubmit}
                  className="p-2.5 bg-slate-50 border border-purple-500 rounded-md space-y-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newEpicTitle}
                    onChange={(e) => setNewEpicTitle(e.target.value)}
                    placeholder="New Epic name..."
                    className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreatingEpic(false)}
                      className="text-[11px] text-slate-500 px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-[11px] font-semibold bg-purple-600 text-white px-2.5 py-1 rounded"
                    >
                      Create Epic
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingEpic(true)}
                  className="w-full py-2 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-md border border-dashed border-purple-300 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Epic
                </button>
              )}
            </div>
          </aside>
        )}

        {/* Right Sprints & Backlog Containers */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeAndPlannedSprints.map((sprint) => {
            const spIssues = filteredIssues.filter(
              (i) => i.sprintId === sprint.id
            );
            const isCollapsed = Boolean(collapsedSections[sprint.id]);
            const todoPts = spIssues
              .filter((i) => i.status === IssueStatus.TODO)
              .reduce((s, i) => s + (i.storyPoints || 0), 0);
            const inProgPts = spIssues
              .filter(
                (i) =>
                  i.status !== IssueStatus.TODO && i.status !== IssueStatus.DONE
              )
              .reduce((s, i) => s + (i.storyPoints || 0), 0);
            const donePts = spIssues
              .filter((i) => i.status === IssueStatus.DONE)
              .reduce((s, i) => s + (i.storyPoints || 0), 0);

            return (
              <div
                key={sprint.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropToSprint(e, sprint.id)}
                className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden"
              >
                {/* Sprint Header */}
                <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedSections((p) => ({
                          ...p,
                          [sprint.id]: !p[sprint.id],
                        }))
                      }
                      className="text-slate-600 hover:text-slate-900"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {sprint.name}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            sprint.status === SprintStatus.ACTIVE
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {sprint.status}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          {formatShortDate(sprint.startDate)} –{' '}
                          {formatShortDate(sprint.endDate)} ({spIssues.length}{' '}
                          issues)
                        </span>
                      </div>
                      {sprint.goal && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {sprint.goal}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Sprint Capacity & Action Buttons */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                      <span
                        className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold"
                        title="To Do Story Points"
                      >
                        {todoPts}p
                      </span>
                      <span
                        className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold"
                        title="In Progress Story Points"
                      >
                        {inProgPts}p
                      </span>
                      <span
                        className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold"
                        title="Completed Story Points"
                      >
                        {donePts}p
                      </span>
                    </div>

                    {sprint.status === SprintStatus.ACTIVE ? (
                      <button
                        type="button"
                        onClick={onOpenCompleteSprintModal}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-800 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Complete Sprint
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={hasActiveSprint || spIssues.length === 0}
                          onClick={() => onStartSprintModal(sprint)}
                          title={
                            hasActiveSprint
                              ? 'Complete the current active sprint before starting a new one'
                              : 'Start this sprint'
                          }
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <Play className="w-3 h-3" />
                          Start Sprint
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSprint(sprint.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                          title="Delete planned sprint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sprint Issues List */}
                {!isCollapsed && (
                  <div>
                    {spIssues.length > 0 ? (
                      spIssues.map((issue) => renderIssueRow(issue))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400 border-b border-slate-100">
                        Plan your sprint by dragging issues here or creating a new issue below.
                      </div>
                    )}

                    {/* Inline Create inside Sprint */}
                    <div className="px-4 py-2.5 bg-slate-50/70">
                      {creatingInContainer === sprint.id ? (
                        <form
                          onSubmit={(e) => handleCreateSubmit(e, sprint.id)}
                          className="flex items-center gap-2"
                        >
                          <select
                            value={newIssueType}
                            onChange={(e) => setNewIssueType(e.target.value)}
                            aria-label="Issue Type"
                            className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                          >
                            <option value={IssueType.STORY}>Story</option>
                            <option value={IssueType.TASK}>Task</option>
                            <option value={IssueType.BUG}>Bug</option>
                          </select>
                          <input
                            type="text"
                            autoFocus
                            value={newIssueTitle}
                            onChange={(e) => setNewIssueTitle(e.target.value)}
                            placeholder="What needs to be done in this sprint?"
                            className="flex-1 text-xs bg-white border border-blue-500 rounded px-3 py-1.5 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreatingInContainer(null)}
                            className="px-2 py-1.5 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingInContainer(sprint.id);
                            setNewIssueTitle('');
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create issue in {sprint.name.split('—')[0]}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Project Backlog Section */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropToSprint(e, null)}
            className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden"
          >
            <div className="px-4 py-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-bold text-slate-900">
                  Backlog ({backlogIssues.length} issues)
                </span>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-600">
                {backlogIssues.reduce((s, i) => s + (i.storyPoints || 0), 0)}{' '}
                total story points
              </span>
            </div>

            <div>
              {backlogIssues.length > 0 ? (
                backlogIssues.map((issue) => renderIssueRow(issue))
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  Your backlog is empty. All issues are assigned to sprints.
                </div>
              )}

              <div className="px-4 py-2.5 bg-slate-50/70">
                {creatingInContainer === 'BACKLOG' ? (
                  <form
                    onSubmit={(e) => handleCreateSubmit(e, null)}
                    className="flex items-center gap-2"
                  >
                    <select
                      value={newIssueType}
                      onChange={(e) => setNewIssueType(e.target.value)}
                      aria-label="Issue Type"
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value={IssueType.STORY}>Story</option>
                      <option value={IssueType.TASK}>Task</option>
                      <option value={IssueType.BUG}>Bug</option>
                    </select>
                    <input
                      type="text"
                      autoFocus
                      value={newIssueTitle}
                      onChange={(e) => setNewIssueTitle(e.target.value)}
                      placeholder="Add new item to backlog..."
                      className="flex-1 text-xs bg-white border border-blue-500 rounded px-3 py-1.5 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatingInContainer(null)}
                      className="px-2 py-1.5 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingInContainer('BACKLOG');
                      setNewIssueTitle('');
                    }}
                    className="text-xs font-medium text-slate-600 hover:text-blue-600 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create backlog issue
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
