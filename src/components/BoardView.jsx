import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Eye,
  EyeOff,
  Layers,
  MessageSquare,
  Plus,
  Rows2,
  Search,
  SlidersHorizontal,
  UserCheck,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/jira.js';
import {
  formatShortDate,
  isOverdue,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  TYPE_CONFIG,
  UserAvatar,
} from './JiraPrimitives.jsx';

const PAGE_WISE_SECTIONS = [
  {
    id: 'STATUS:TODO',
    kind: 'STATUS',
    value: IssueStatus.TODO,
    label: 'To Do',
    badgeClass: 'bg-slate-800 text-white border-slate-800',
    headerAccent: 'border-t-slate-500',
  },
  {
    id: 'TYPE:STORY',
    kind: 'TYPE',
    value: IssueType.STORY,
    label: 'Story',
    badgeClass: 'bg-emerald-600 text-white border-emerald-600',
    headerAccent: 'border-t-emerald-600',
  },
  {
    id: 'STATUS:IN_PROGRESS',
    kind: 'STATUS',
    value: IssueStatus.IN_PROGRESS,
    label: 'In Progress',
    badgeClass: 'bg-blue-600 text-white border-blue-600',
    headerAccent: 'border-t-blue-600',
  },
  {
    id: 'TYPE:TASK',
    kind: 'TYPE',
    value: IssueType.TASK,
    label: 'Task',
    badgeClass: 'bg-sky-600 text-white border-sky-600',
    headerAccent: 'border-t-sky-600',
  },
  {
    id: 'TYPE:BUG',
    kind: 'TYPE',
    value: IssueType.BUG,
    label: 'Bug',
    badgeClass: 'bg-red-600 text-white border-red-600',
    headerAccent: 'border-t-red-600',
  },
  {
    id: 'STATUS:IN_REVIEW',
    kind: 'STATUS',
    value: IssueStatus.IN_REVIEW,
    label: 'In Review',
    badgeClass: 'bg-indigo-600 text-white border-indigo-600',
    headerAccent: 'border-t-indigo-600',
  },
  {
    id: 'STATUS:QA',
    kind: 'STATUS',
    value: IssueStatus.QA,
    label: 'QA Testing',
    badgeClass: 'bg-amber-600 text-white border-amber-600',
    headerAccent: 'border-t-amber-500',
  },
  {
    id: 'STATUS:DONE',
    kind: 'STATUS',
    value: IssueStatus.DONE,
    label: 'Done',
    badgeClass: 'bg-teal-600 text-white border-teal-600',
    headerAccent: 'border-t-teal-600',
  },
];

export const BoardView = ({
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
  // Layout mode: 'PAGE_WISE' (default as requested by user) or 'COLUMNS'
  const [boardDisplayMode, setBoardDisplayMode] = useState('PAGE_WISE');

  // Selected sections in Page-Wise mode.
  // If 1 is selected -> shows ONLY that 1 page-wise.
  // If 2+ are selected -> shows both with a horizontal center divider line & button to show/hide below!
  const [selectedSectionIds, setSelectedSectionIds] = useState([
    'STATUS:TODO',
    'TYPE:STORY',
  ]);

  // Controls whether each section below a center line is shown ("showing down") or hidden ("or not")
  const [showBelowMap, setShowBelowMap] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(null);
  const [selectedEpicId, setSelectedEpicId] = useState(null);
  const [onlyMyIssues, setOnlyMyIssues] = useState(false);
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);

  // Drag & Drop State
  const [draggedIssueId, setDraggedIssueId] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  // Quick Inline Create per Section/Column
  const [quickCreateTarget, setQuickCreateTarget] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState(IssueType.STORY);
  const [quickStatus, setQuickStatus] = useState(IssueStatus.TODO);

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

  const boardBaseIssues = useMemo(() => {
    const nonEpics = issues.filter(
      (i) => i.type !== IssueType.EPIC && i.type !== IssueType.SUBTASK
    );
    if (project.template === 'Kanban') {
      return nonEpics;
    }
    if (!activeSprint) return nonEpics;
    return nonEpics.filter((i) => i.sprintId === activeSprint.id);
  }, [issues, project.template, activeSprint]);

  const filteredIssues = useMemo(() => {
    return boardBaseIssues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = issue.key.toLowerCase().includes(q);
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchLabel = issue.labels.some((l) => l.toLowerCase().includes(q));
        if (!matchKey && !matchTitle && !matchLabel) return false;
      }
      if (onlyMyIssues && issue.assigneeId !== currentUserId) return false;
      if (selectedAssigneeId && issue.assigneeId !== selectedAssigneeId) {
        return false;
      }
      if (selectedEpicId && issue.epicId !== selectedEpicId) return false;
      if (
        highPriorityOnly &&
        issue.priority !== IssuePriority.HIGHEST &&
        issue.priority !== IssuePriority.HIGH
      ) {
        return false;
      }
      return true;
    });
  }, [
    boardBaseIssues,
    searchQuery,
    onlyMyIssues,
    currentUserId,
    selectedAssigneeId,
    selectedEpicId,
    highPriorityOnly,
  ]);

  const sprintMetrics = useMemo(() => {
    const totalPts = boardBaseIssues.reduce(
      (sum, i) => sum + (i.storyPoints || 0),
      0
    );
    const donePts = boardBaseIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    const pct = totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0;
    return {
      totalCount: boardBaseIssues.length,
      doneCount: boardBaseIssues.filter((i) => i.status === IssueStatus.DONE).length,
      totalPts,
      donePts,
      pct,
    };
  }, [boardBaseIssues]);

  // Toggle a section in Page-Wise selector:
  // Clicking toggles it in/out of the active array (keeping at least 1 selected).
  const handleToggleSection = (sectionId) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(sectionId)) {
        if (prev.length === 1) return prev; // Keep at least 1 active
        return prev.filter((id) => id !== sectionId);
      }
      // Ensure newly added section below the center line defaults to visible ("showing down = true")
      setShowBelowMap((m) => ({ ...m, [sectionId]: true }));
      return [...prev, sectionId];
    });
  };

  // Focus ONLY a single section full-page
  const handleSelectOnlySection = (sectionId) => {
    setSelectedSectionIds([sectionId]);
  };

  // Toggle whether the section below the center line is shown or hidden
  const handleToggleShowBelow = (sectionId) => {
    setShowBelowMap((prev) => {
      const current = prev[sectionId] !== false;
      return { ...prev, [sectionId]: !current };
    });
  };

  const getIssuesForSection = (section) => {
    if (section.kind === 'STATUS') {
      return filteredIssues.filter((i) => i.status === section.value);
    }
    return filteredIssues.filter((i) => i.type === section.value);
  };

  const handleDragStart = (e, issueId) => {
    setDraggedIssueId(issueId);
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnStatus = (e, status) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (issueId) {
      onUpdateIssueStatus(issueId, status);
    }
    setDraggedIssueId(null);
    setDragOverTarget(null);
  };

  const handleQuickCreateSubmit = (e, section) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const resolvedType =
      section && section.kind === 'TYPE' ? section.value : quickType;
    const resolvedStatus =
      section && section.kind === 'STATUS' ? section.value : quickStatus;

    onQuickCreateIssue({
      title: quickTitle.trim(),
      type: resolvedType,
      status: resolvedStatus,
      sprintId: activeSprint ? activeSprint.id : null,
      epicId: selectedEpicId,
    });
    setQuickTitle('');
    setQuickCreateTarget(null);
  };

  const renderIssueCard = (issue, showStatusSelector = false) => {
    const assignee = issue.assigneeId ? userMap[issue.assigneeId] : null;
    const parentEpic = issue.epicId ? epicMap[issue.epicId] : null;
    const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
    const totalSubtasks = issue.subtasks.length;
    const overdue = isOverdue(issue.dueDate, issue.status);

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => handleDragStart(e, issue.id)}
        onDragEnd={() => {
          setDraggedIssueId(null);
          setDragOverTarget(null);
        }}
        onClick={() => onSelectIssue(issue.id)}
        className={`group bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
          draggedIssueId === issue.id ? 'opacity-40 scale-[0.98]' : ''
        }`}
      >
        <div className="space-y-2">
          {/* Top Row: Issue Type + Key + Status Badge/Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <IssueTypeIcon type={issue.type} className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums text-xs font-semibold text-blue-700 group-hover:underline">
                {issue.key}
              </span>
              <span className="text-[11px] text-slate-400">
                · {TYPE_CONFIG[issue.type]?.label}
              </span>
            </div>

            {showStatusSelector ? (
              <div onClick={(e) => e.stopPropagation()}>
                <select
                  value={issue.status}
                  onChange={(e) => onUpdateIssueStatus(issue.id, e.target.value)}
                  className={`text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:border-blue-600 ${
                    STATUS_CONFIG[issue.status]?.textClass || 'text-slate-700'
                  }`}
                >
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_CONFIG[st].label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              issue.dueDate && (
                <span
                  className={`font-mono tabular-nums text-[11px] flex items-center gap-1 ${
                    overdue ? 'text-red-600 font-semibold' : 'text-slate-400'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {formatShortDate(issue.dueDate)}
                </span>
              )
            )}
          </div>

          {/* Issue Summary Title */}
          <h4 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
            {issue.title}
          </h4>

          {/* Epic / Subtask Context */}
          {(parentEpic || totalSubtasks > 0) && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              {parentEpic ? (
                <span className="font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded truncate max-w-[200px]">
                  {parentEpic.title}
                </span>
              ) : (
                <span />
              )}
              {totalSubtasks > 0 && (
                <span className="font-mono tabular-nums text-slate-500 shrink-0">
                  {completedSubtasks}/{totalSubtasks} subtasks
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer: Priority + Story Points + Assignee */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1 text-xs"
              title={`Priority: ${PRIORITY_CONFIG[issue.priority]?.label}`}
            >
              <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
              <span className={`text-[11px] font-medium ${PRIORITY_CONFIG[issue.priority]?.textClass}`}>
                {PRIORITY_CONFIG[issue.priority]?.label}
              </span>
            </span>

            {issue.storyPoints > 0 && (
              <span
                className="font-mono tabular-nums text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
                title="Story Points"
              >
                {issue.storyPoints} pts
              </span>
            )}

            {issue.comments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <MessageSquare className="w-3 h-3" />
                {issue.comments.length}
              </span>
            )}
          </div>

          <UserAvatar user={assignee} size="xs" showName />
        </div>
      </div>
    );
  };

  const activeSections = useMemo(() => {
    return selectedSectionIds
      .map((id) => PAGE_WISE_SECTIONS.find((s) => s.id === id))
      .filter(Boolean);
  }, [selectedSectionIds]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Board Header & Sprint Telemetry */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono font-semibold text-slate-700">
                {project.key}
              </span>
              {project.isPersonal && (
                <>
                  <span>·</span>
                  <span className="text-blue-700 font-semibold">
                    My Personal Workspace
                  </span>
                </>
              )}
              {activeSprint && project.template === 'Scrum' && (
                <>
                  <span>/</span>
                  <span className="text-blue-700 font-medium">
                    {activeSprint.name}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              {project.template === 'Kanban'
                ? `${project.key} Continuous Flow Board`
                : activeSprint
                ? activeSprint.name
                : `${project.name} Board`}
            </h1>
          </div>

          {/* Right Sprint Actions & Layout Mode Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setBoardDisplayMode('PAGE_WISE')}
                className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                  boardDisplayMode === 'PAGE_WISE'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Rows2 className="w-3.5 h-3.5" />
                Page-Wise & Center Split
              </button>
              <button
                type="button"
                onClick={() => setBoardDisplayMode('COLUMNS')}
                className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 transition-colors ${
                  boardDisplayMode === 'COLUMNS'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                All Columns
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenScreenshotImporter}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Import Board Screenshot
            </button>

            {project.template === 'Scrum' && activeSprint && (
              <button
                type="button"
                onClick={onOpenCompleteSprintModal}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Complete Sprint
              </button>
            )}
          </div>
        </div>

        {/* PAGE-WISE SELECTOR BAR (Click 1 to show only that page-wise; Click 2+ to split with Center Line & Show-Down button) */}
        {boardDisplayMode === 'PAGE_WISE' && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Page-Wise View Selector:
                </span>
                <span className="text-xs text-slate-500">
                  Click <strong>1 item</strong> (e.g. only <em>To Do</em> or only{' '}
                  <em>Story</em>) for single full-page view, or click{' '}
                  <strong>2+ items</strong> to stack them with a{' '}
                  <strong>Center Line & Show/Hide Below button</strong>.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSectionIds(['STATUS:TODO'])}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                >
                  Only To Do
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSectionIds(['TYPE:STORY'])}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                >
                  Only Story
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSectionIds(['STATUS:TODO', 'TYPE:STORY']);
                    setShowBelowMap({ 'TYPE:STORY': true });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 text-blue-700"
                >
                  To Do + Story (Split)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PAGE_WISE_SECTIONS.map((sec) => {
                const isSelected = selectedSectionIds.includes(sec.id);
                const count = getIssuesForSection(sec).length;
                const selectionOrder = selectedSectionIds.indexOf(sec.id) + 1;

                return (
                  <div
                    key={sec.id}
                    className={`inline-flex items-center rounded-md border text-xs transition-all overflow-hidden ${
                      isSelected
                        ? `${sec.badgeClass} shadow-xs`
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSection(sec.id)}
                      className="px-3 py-1.5 font-semibold flex items-center gap-1.5"
                    >
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-white/25 text-white font-mono text-[10px] flex items-center justify-center">
                          {selectionOrder}
                        </span>
                      )}
                      <span>{sec.label}</span>
                      <span
                        className={`font-mono text-[11px] px-1.5 py-0.2 rounded ${
                          isSelected
                            ? 'bg-black/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>

                    {/* Quick button to show ONLY this section page-wise */}
                    {!(selectedSectionIds.length === 1 && isSelected) && (
                      <button
                        type="button"
                        onClick={() => handleSelectOnlySection(sec.id)}
                        title={`Show ONLY ${sec.label} full page`}
                        className={`px-2 py-1.5 text-[10px] font-bold border-l transition-colors ${
                          isSelected
                            ? 'border-white/20 hover:bg-black/20 text-white/90'
                            : 'border-slate-200 hover:bg-slate-200 text-slate-500'
                        }`}
                      >
                        Only
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Quick Filters Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by key, summary, label..."
                className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 px-1">
              {users.map((u) => {
                const isSelected = selectedAssigneeId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setSelectedAssigneeId(isSelected ? null : u.id)
                    }
                    className={`rounded transition-transform ${
                      isSelected
                        ? 'ring-2 ring-blue-600 ring-offset-1 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    title={`Filter by ${u.name}`}
                  >
                    <UserAvatar user={u} size="sm" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setOnlyMyIssues(!onlyMyIssues)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
                onlyMyIssues
                  ? 'bg-blue-50 border-blue-600 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Only My Issues
            </button>

            <button
              type="button"
              onClick={() => setHighPriorityOnly(!highPriorityOnly)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                highPriorityOnly
                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              High / Highest
            </button>

            <select
              value={selectedEpicId || ''}
              onChange={(e) => setSelectedEpicId(e.target.value || null)}
              aria-label="Filter by Epic"
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="">All Epics</option>
              {epics.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.key}: {ep.title}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-slate-500">
            {sprintMetrics.donePts}/{sprintMetrics.totalPts} pts Done ({sprintMetrics.pct}%)
          </div>
        </div>
      </div>

      {/* MAIN BOARD BODY */}
      <div className="flex-1 overflow-y-auto p-6">
        {boardDisplayMode === 'PAGE_WISE' ? (
          /* ==================================================================
             PAGE-WISE & CENTER-LINE SPLIT VIEW
             - 1 selected -> Full-page single view
             - 2+ selected -> Top section + Center Divider Line with "Show Down / Hide" button + Bottom section
             ================================================================== */
          <div className="max-w-7xl mx-auto space-y-2">
            {activeSections.map((section, idx) => {
              const sectionIssues = getIssuesForSection(section);
              const sectionPoints = sectionIssues.reduce(
                (s, i) => s + (i.storyPoints || 0),
                0
              );
              // First section is always visible; subsequent sections are below a Center Line and controlled by showBelowMap
              const isBelowCenterLine = idx > 0;
              const isShowingDown = showBelowMap[section.id] !== false;

              return (
                <React.Fragment key={section.id}>
                  {/* HORIZONTAL CENTER LINE DIVIDER WITH SHOW/HIDE DOWN BUTTON */}
                  {isBelowCenterLine && (
                    <div className="relative py-6 flex items-center justify-center select-none">
                      {/* Full-width horizontal center line */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-slate-300" />

                      {/* Interactive Button on the Center Line to show/hide the section below */}
                      <div className="relative z-10 flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border-2 border-slate-400 shadow-sm">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Center Line
                        </span>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleToggleShowBelow(section.id)}
                          className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                            isShowingDown
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-slate-800 text-white hover:bg-slate-900'
                          }`}
                        >
                          {isShowingDown ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              Hide Below ({section.label})
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              Show Down ({section.label} · {sectionIssues.length})
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SECTION PAGE-WISE CONTAINER */}
                  {(!isBelowCenterLine || isShowingDown) && (
                    <section
                      onDragOver={(e) => {
                        if (section.kind === 'STATUS') {
                          e.preventDefault();
                          setDragOverTarget(section.id);
                        }
                      }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        if (section.kind === 'STATUS') {
                          handleDropOnStatus(e, section.value);
                        }
                      }}
                      className={`bg-white rounded-xl border border-slate-200 border-t-4 ${
                        section.headerAccent
                      } shadow-xs overflow-hidden transition-all ${
                        dragOverTarget === section.id
                          ? 'ring-2 ring-blue-500 bg-blue-50/30'
                          : ''
                      }`}
                    >
                      {/* Section Page Header */}
                      <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${section.badgeClass}`}
                          >
                            {section.label}
                          </span>
                          <div>
                            <h2 className="text-sm font-bold text-slate-900">
                              {section.kind === 'STATUS'
                                ? `${section.label} Status Page`
                                : `${section.label} Issues Page`}
                            </h2>
                            <p className="text-xs text-slate-500">
                              Showing {sectionIssues.length} items · {sectionPoints}{' '}
                              story points
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {activeSections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleSelectOnlySection(section.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
                            >
                              Show Only {section.label} Full Page
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setQuickCreateTarget(
                                quickCreateTarget === section.id
                                  ? null
                                  : section.id
                              );
                              setQuickTitle('');
                            }}
                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to {section.label}
                          </button>
                        </div>
                      </div>

                      {/* Quick Create Inline Drawer */}
                      {quickCreateTarget === section.id && (
                        <form
                          onSubmit={(e) => handleQuickCreateSubmit(e, section)}
                          className="p-4 bg-blue-50/60 border-b border-blue-200 flex flex-wrap items-center gap-3"
                        >
                          {section.kind !== 'TYPE' && (
                            <select
                              value={quickType}
                              onChange={(e) => setQuickType(e.target.value)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md"
                            >
                              <option value={IssueType.STORY}>Story</option>
                              <option value={IssueType.TASK}>Task</option>
                              <option value={IssueType.BUG}>Bug</option>
                            </select>
                          )}
                          {section.kind !== 'STATUS' && (
                            <select
                              value={quickStatus}
                              onChange={(e) => setQuickStatus(e.target.value)}
                              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md"
                            >
                              {STATUS_ORDER.map((st) => (
                                <option key={st} value={st}>
                                  {STATUS_CONFIG[st].label}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            autoFocus
                            value={quickTitle}
                            onChange={(e) => setQuickTitle(e.target.value)}
                            placeholder={`Enter new ${section.label} summary...`}
                            className="flex-1 min-w-[240px] px-3 py-1.5 text-xs bg-white border border-blue-500 rounded-md focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickCreateTarget(null)}
                            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                          >
                            Cancel
                          </button>
                        </form>
                      )}

                      {/* Section Cards Grid */}
                      <div className="p-6">
                        {sectionIssues.length === 0 ? (
                          <div className="py-12 border-2 border-dashed border-slate-200 rounded-lg text-center">
                            <p className="text-sm font-semibold text-slate-600">
                              No issues in {section.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Click &ldquo;Add to {section.label}&rdquo; above to create an item here.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sectionIssues.map((issue) =>
                              renderIssueCard(issue, true)
                            )}
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          /* ==================================================================
             CLASSIC 5-COLUMN KANBAN VIEW
             ================================================================== */
          <div className="grid grid-cols-5 gap-4 min-w-[1120px] h-full">
            {STATUS_ORDER.map((status) => {
              const colConfig = STATUS_CONFIG[status];
              const colIssues = filteredIssues.filter(
                (i) => i.status === status
              );
              const colPoints = colIssues.reduce(
                (s, i) => s + (i.storyPoints || 0),
                0
              );
              const wipLimit = project.wipLimits[status] || 0;
              const wipExceeded = wipLimit > 0 && colIssues.length > wipLimit;
              const isDragTarget = dragOverTarget === status;

              return (
                <div
                  key={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTarget(status);
                  }}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => handleDropOnStatus(e, status)}
                  className={`flex flex-col rounded-lg border border-t-4 ${
                    colConfig.accentBorder
                  } ${
                    wipExceeded
                      ? 'bg-red-50/50 border-red-300'
                      : isDragTarget
                      ? 'bg-blue-50/60 border-blue-400'
                      : 'bg-slate-100/80 border-slate-200'
                  } transition-colors min-h-[460px]`}
                >
                  <div className="p-3 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-700 truncate">
                        {colConfig.shortLabel}
                      </span>
                      <span className="font-mono tabular-nums text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {colIssues.length}
                        {wipLimit > 0 ? `/${wipLimit}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {wipExceeded && (
                        <span
                          className="text-red-600 flex items-center gap-1 text-[11px] font-semibold"
                          title={`WIP Limit of ${wipLimit} exceeded!`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          WIP
                        </span>
                      )}
                      <span className="font-mono tabular-nums text-[11px] text-slate-500">
                        {colPoints} pts
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-y-auto">
                    {colIssues.map((issue) => renderIssueCard(issue, false))}

                    {colIssues.length === 0 && !isDragTarget && (
                      <div className="flex-1 min-h-[120px] border border-dashed border-slate-300 rounded-md flex items-center justify-center text-xs text-slate-400">
                        Drop issues here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
