import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Layers,
  MessageSquare,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import {
  formatShortDate,
  isOverdue,
  ISSUE_TYPE_CONFIG,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './ArijPrimitives.jsx';

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
  onOpenStoryPdfImporter,
  onNavigateToBacklog,
}) => {
  // User Page-Wise & Center-Line Split State:
  // - If 1 user is selected -> shows ONLY that user's 5-column Arij board (page-wise)
  // - If 2+ users are selected -> shows User 1's 5-column Arij board above,
  //   a Center Line in the middle with a "Show Down / Hide Below" button,
  //   and User 2's 5-column Arij board below the Center Line!
  const [selectedUserIds, setSelectedUserIds] = useState(() => {
    const allIds = users.map((u) => u.id);
    if (currentUserId && !allIds.includes(currentUserId)) {
      allIds.unshift(currentUserId);
    }
    return allIds.length > 0 ? allIds : [currentUserId];
  });

  // Controls whether each user section below a center line is expanded ("showing down") or collapsed ("or not")
  const [showBelowUserMap, setShowBelowUserMap] = useState({});

  // Standard Arij Board Filters (Search, Issue Type: Story/Task/Bug, Epic, Priority)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEpicId, setSelectedEpicId] = useState(null);
  const [selectedType, setSelectedType] = useState('ALL');
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);

  const prevIssuesCountRef = useRef(issues.length);

  // Automatically ensure currentUserId and any newly created issue's assignee (e.g. when a friend creates a story) are visible at the top of the board
  useEffect(() => {
    if (currentUserId) {
      setSelectedUserIds((prev) => [
        currentUserId,
        ...prev.filter((id) => id !== currentUserId),
      ]);
      setShowBelowUserMap((m) => ({ ...m, [currentUserId]: true }));
    }
  }, [currentUserId]);

  useEffect(() => {
    if (issues.length > prevIssuesCountRef.current) {
      const latestIssue =
        issues.find((i) => i.isUserCreated) || issues[0] || issues[issues.length - 1];
      if (latestIssue) {
        const targetId = latestIssue.assigneeId || 'UNASSIGNED';
        setSelectedUserIds((prev) => [
          targetId,
          ...prev.filter((id) => id !== targetId),
        ]);
        setShowBelowUserMap((m) => ({ ...m, [targetId]: true }));
        if (selectedType !== 'ALL' && latestIssue.type !== selectedType) {
          setSelectedType('ALL');
        }
        if (selectedEpicId && latestIssue.epicId !== selectedEpicId) {
          setSelectedEpicId(null);
        }
        if (searchQuery) {
          setSearchQuery('');
        }
        if (highPriorityOnly) {
          setHighPriorityOnly(false);
        }
      }
    }
    prevIssuesCountRef.current = issues.length;
  }, [issues, selectedType, selectedEpicId, searchQuery, highPriorityOnly]);

  // Drag & Drop State (tracks issueId and target user + status column)
  const [draggedIssueId, setDraggedIssueId] = useState(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState(null);

  // Quick Inline Create per (userId + status column)
  const [quickCreateKey, setQuickCreateKey] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState(IssueType.STORY);
  const [quickPriority, setQuickPriority] = useState(IssuePriority.MEDIUM);

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

  // Base issues for the board — show all project work items (including planned sprints and user-created epics) so newly created issues are always visible
  const boardBaseIssues = useMemo(() => {
    return issues.filter(
      (i) => i.type !== IssueType.EPIC || !String(i.id).startsWith('iss-epic-')
    );
  }, [issues]);

  // Filtered board issues (before splitting by user)
  const filteredIssues = useMemo(() => {
    return boardBaseIssues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchKey = issue.key.toLowerCase().includes(q);
        const matchTitle = issue.title.toLowerCase().includes(q);
        const matchLabel = issue.labels.some((l) => l.toLowerCase().includes(q));
        if (!matchKey && !matchTitle && !matchLabel) return false;
      }
      if (selectedEpicId && issue.epicId !== selectedEpicId) return false;
      if (selectedType !== 'ALL' && issue.type !== selectedType) return false;
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
    selectedEpicId,
    selectedType,
    highPriorityOnly,
  ]);

  // Count by Arij Issue Type for Type Filter pills
  const typeCounts = useMemo(() => {
    return {
      ALL: boardBaseIssues.length,
      [IssueType.STORY]: boardBaseIssues.filter((i) => i.type === IssueType.STORY).length,
      [IssueType.TASK]: boardBaseIssues.filter((i) => i.type === IssueType.TASK).length,
      [IssueType.BUG]: boardBaseIssues.filter((i) => i.type === IssueType.BUG).length,
    };
  }, [boardBaseIssues]);

  // Sprint progress metrics
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

  // Click user avatar/chip to toggle in/out of selection:
  // - 1 user selected -> Page-wise view for ONLY that user
  // - 2+ users selected -> Multi-user view with Center Line & Show Down button between users
  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        if (prev.length === 1) return prev; // Keep at least 1 user active
        return prev.filter((id) => id !== userId);
      }
      setShowBelowUserMap((m) => ({ ...m, [userId]: true }));
      return [...prev, userId];
    });
  };

  // Show ONLY this single user's board full-page
  const handleSelectOnlyUser = (userId) => {
    setSelectedUserIds([userId]);
  };

  // Toggle whether the user board below the Center Line is shown ("showing down") or hidden ("or not")
  const handleToggleShowBelowUser = (userId) => {
    setShowBelowUserMap((prev) => {
      const current = prev[userId] !== false;
      return { ...prev, [userId]: !current };
    });
  };

  const handleDragStart = (e, issueId) => {
    setDraggedIssueId(issueId);
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnKey !== colKey) {
      setDragOverColumnKey(colKey);
    }
  };

  const handleDrop = (e, status, targetUserId) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (issueId) {
      const resolvedAssignee = targetUserId === 'UNASSIGNED' ? null : targetUserId;
      onUpdateIssueStatus(issueId, status, resolvedAssignee);
    }
    setDraggedIssueId(null);
    setDragOverColumnKey(null);
  };

  const handleQuickCreateSubmit = (e, status, assigneeId) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickCreateIssue({
      title: quickTitle.trim(),
      type: quickType,
      priority: quickPriority,
      status,
      sprintId: activeSprint ? activeSprint.id : null,
      epicId: selectedEpicId,
      assigneeId: assigneeId === 'UNASSIGNED' ? null : assigneeId,
    });
    setQuickTitle('');
    setQuickCreateKey(null);
  };

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(selectedEpicId) ||
    selectedType !== 'ALL' ||
    highPriorityOnly;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedEpicId(null);
    setSelectedType('ALL');
    setHighPriorityOnly(false);
  };

  // Render an authentic Arij Issue Card inside the 5-column Kanban board
  const renderIssueCard = (issue) => {
    const assignee = issue.assigneeId ? userMap[issue.assigneeId] : null;
    const parentEpic = issue.epicId ? epicMap[issue.epicId] : null;
    const completedSubtasks = (issue.subtasks || []).filter((s) => s.completed).length;
    const totalSubtasks = (issue.subtasks || []).length;
    const overdue = isOverdue(issue.dueDate, issue.status);
    const typeInfo = ISSUE_TYPE_CONFIG[issue.type] || ISSUE_TYPE_CONFIG[IssueType.TASK];

    return (
      <div
        key={issue.id}
        draggable
        onDragStart={(e) => handleDragStart(e, issue.id)}
        onDragEnd={() => {
          setDraggedIssueId(null);
          setDragOverColumnKey(null);
        }}
        onClick={() => onSelectIssue(issue.id)}
        className={`group bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer select-none flex flex-col gap-2.5 ${
          draggedIssueId === issue.id ? 'opacity-40 scale-[0.98]' : ''
        }`}
      >
        {/* Row 1: Arij Issue Type Badge + Monospace Issue Key + Due Date */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${typeInfo.bgBadge}`}
            >
              <IssueTypeIcon type={issue.type} className="w-3 h-3" />
              {typeInfo.label}
            </span>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-500 group-hover:text-blue-600 transition-colors">
              {issue.key}
            </span>
          </div>
          {issue.dueDate && (
            <span
              className={`font-mono tabular-nums text-[11px] flex items-center gap-1 ${
                overdue ? 'text-red-600 font-semibold' : 'text-slate-400'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {formatShortDate(issue.dueDate)}
            </span>
          )}
        </div>

        {/* Row 2: Issue Summary Title */}
        <h4 className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-2">
          {issue.title}
        </h4>

        {/* Row 3: Arij Epic Lozenge, Labels & Subtask Progress */}
        {(parentEpic || totalSubtasks > 0 || (issue.labels && issue.labels.length > 0)) && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] pt-0.5">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              {parentEpic && (
                <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold truncate max-w-[165px]">
                  {parentEpic.title}
                </span>
              )}
              {issue.labels &&
                issue.labels.slice(0, 2).map((lbl) => (
                  <span
                    key={lbl}
                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]"
                  >
                    {lbl}
                  </span>
                ))}
            </div>
            {totalSubtasks > 0 && (
              <span className="font-mono tabular-nums text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                {completedSubtasks}/{totalSubtasks} subtasks
              </span>
            )}
          </div>
        )}

        {/* Row 4: Arij Card Footer (Priority Icon + Story Points + Comments + Quick Status + Assignee Avatar) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1"
              title={`Priority: ${PRIORITY_CONFIG[issue.priority]?.label || issue.priority}`}
            >
              <PriorityIcon priority={issue.priority} className="w-3.5 h-3.5" />
            </span>

            {issue.storyPoints > 0 && (
              <span
                className="font-mono tabular-nums text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
                title="Story Points"
              >
                {issue.storyPoints}p
              </span>
            )}

            {issue.comments.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                <MessageSquare className="w-3 h-3" />
                {issue.comments.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <select
              value={issue.status}
              onChange={(e) =>
                onUpdateIssueStatus(issue.id, e.target.value, issue.assigneeId)
              }
              aria-label={`Change status for ${issue.key}`}
              className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-1.5 py-0.5 border border-slate-200 focus:outline-none cursor-pointer"
            >
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st}>
                  {STATUS_CONFIG[st].shortLabel}
                </option>
              ))}
            </select>
            <UserAvatar user={assignee} size="xs" />
          </div>
        </div>
      </div>
    );
  };

  // Include Unassigned pseudo-user if selected
  const unassignedUserObj = useMemo(
    () => ({
      id: 'UNASSIGNED',
      name: 'Unassigned Issues',
      initials: 'UA',
      role: 'Backlog / Unassigned Queue',
      department: 'Shared Team Queue',
    }),
    []
  );

  // Resolve the list of selected User objects
  const activeSelectedUsers = useMemo(() => {
    const resolved = selectedUserIds
      .map((id) => {
        if (id === 'UNASSIGNED') return unassignedUserObj;
        return users.find((u) => u.id === id);
      })
      .filter(Boolean);
    return resolved.length > 0 ? resolved : users.slice(0, 1);
  }, [selectedUserIds, users, unassignedUserObj]);

  // Render the classic Arij 5-Column Kanban Board (TO DO, IN PROGRESS, IN REVIEW, QA TESTING, DONE) for a specific User
  const renderUserFiveColumnBoard = (userObj, isTopBoard = false) => {
    const userIssues = filteredIssues.filter((i) => {
      if (userObj.id === 'UNASSIGNED') {
        return !i.assigneeId;
      }
      if (i.assigneeId === userObj.id) {
        return true;
      }
      // Always surface newly created stories on the top board so stories created by you or a friend are immediately visible
      if (isTopBoard && i.isUserCreated) {
        return true;
      }
      return false;
    });
    const userTotalPts = userIssues.reduce(
      (s, i) => s + (i.storyPoints || 0),
      0
    );
    const userDonePts = userIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((s, i) => s + (i.storyPoints || 0), 0);

    const storyCount = userIssues.filter((i) => i.type === IssueType.STORY).length;
    const taskCount = userIssues.filter((i) => i.type === IssueType.TASK).length;
    const bugCount = userIssues.filter((i) => i.type === IssueType.BUG).length;

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* User Swimlane / Board Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={userObj.id === 'UNASSIGNED' ? null : userObj}
              size="md"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {userObj.name}&rsquo;s Arij Board
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600/30 border border-blue-400/30 text-blue-200 font-semibold">
                  {userObj.role}
                </span>
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                  {storyCount} Stories · {taskCount} Tasks · {bugCount} Bugs
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {userObj.department} · {userIssues.length} issues · {userDonePts}/
                {userTotalPts} story points completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSelectedUsers.length > 1 && (
              <button
                type="button"
                onClick={() => handleSelectOnlyUser(userObj.id)}
                className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors"
              >
                Show Only {userObj.name.split(' ')[0]}
              </button>
            )}
          </div>
        </div>

        {/* Classic 5-Column Arij Kanban Grid (TO DO | IN PROGRESS | IN REVIEW | QA TESTING | DONE) */}
        <div className="p-4 overflow-x-auto bg-slate-50">
          <div className="grid grid-cols-5 gap-4 min-w-[1080px]">
            {STATUS_ORDER.map((status) => {
              const colConfig = STATUS_CONFIG[status];
              const colIssues = userIssues.filter((i) => i.status === status);
              const colPoints = colIssues.reduce(
                (s, i) => s + (i.storyPoints || 0),
                0
              );
              const wipLimit = project.wipLimits[status] || 0;
              const wipExceeded = wipLimit > 0 && colIssues.length > wipLimit;
              const colKey = `${userObj.id}:${status}`;
              const isDragTarget = dragOverColumnKey === colKey;

              return (
                <div
                  key={colKey}
                  onDragOver={(e) => handleDragOver(e, colKey)}
                  onDragLeave={() => setDragOverColumnKey(null)}
                  onDrop={(e) => handleDrop(e, status, userObj.id)}
                  className={`flex flex-col rounded-lg border border-t-4 ${
                    colConfig.accentBorder
                  } ${
                    wipExceeded
                      ? 'bg-red-50/50 border-red-300'
                      : isDragTarget
                      ? 'bg-blue-50/60 border-blue-400'
                      : 'bg-slate-100/80 border-slate-200'
                  } transition-colors min-h-[340px]`}
                >
                  {/* Column Header */}
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

                  {/* Cards List */}
                  <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-y-auto">
                    {colIssues.map((issue) => renderIssueCard(issue))}

                    {colIssues.length === 0 && !isDragTarget && (
                      <div className="flex-1 min-h-[100px] border border-dashed border-slate-300 rounded-md flex items-center justify-center text-xs text-slate-400 text-center px-2">
                        Drop {userObj.initials}&rsquo;s {colConfig.label} issues here
                      </div>
                    )}
                  </div>

                  {/* Quick Inline Create Footer (Automatically assigns to this user + status!) */}
                  <div className="p-2.5 border-t border-slate-200/60">
                    {quickCreateKey === colKey ? (
                      <form
                        onSubmit={(e) =>
                          handleQuickCreateSubmit(e, status, userObj.id)
                        }
                        className="bg-white p-2.5 rounded-md border border-blue-500 shadow-xs space-y-2"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={quickTitle}
                          onChange={(e) => setQuickTitle(e.target.value)}
                          placeholder={`What needs to be done in ${colConfig.shortLabel}?`}
                          className="w-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                        <div className="flex items-center justify-between gap-1 pt-1">
                          <div className="flex items-center gap-1">
                            <select
                              value={quickType}
                              onChange={(e) => setQuickType(e.target.value)}
                              aria-label="Issue Type"
                              className="text-[11px] font-medium bg-slate-100 border border-slate-200 rounded px-1.5 py-1 text-slate-700"
                            >
                              <option value={IssueType.STORY}>Story</option>
                              <option value={IssueType.TASK}>Task</option>
                              <option value={IssueType.BUG}>Bug</option>
                            </select>
                            <select
                              value={quickPriority}
                              onChange={(e) => setQuickPriority(e.target.value)}
                              aria-label="Issue Priority"
                              className="text-[11px] font-medium bg-slate-100 border border-slate-200 rounded px-1.5 py-1 text-slate-700"
                            >
                              <option value={IssuePriority.HIGHEST}>Highest</option>
                              <option value={IssuePriority.HIGH}>High</option>
                              <option value={IssuePriority.MEDIUM}>Medium</option>
                              <option value={IssuePriority.LOW}>Low</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuickCreateKey(null)}
                              className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
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
                          setQuickCreateKey(colKey);
                          setQuickTitle('');
                        }}
                        className="w-full py-1.5 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded flex items-center gap-1.5 transition-colors"
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
        </div>
      </div>
    );
  };

  const unassignedCount = filteredIssues.filter((i) => !i.assigneeId).length;

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
                : 'No Active Sprint'}
            </h1>
            {activeSprint?.goal && project.template === 'Scrum' && (
              <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
                <strong className="font-semibold text-slate-700">Sprint Goal:</strong>{' '}
                {activeSprint.goal}
              </p>
            )}
          </div>

          {/* Right Sprint Actions & Progress */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-200">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-800 font-mono tabular-nums">
                  {sprintMetrics.donePts} / {sprintMetrics.totalPts} pts Done (
                  {sprintMetrics.pct}%)
                </div>
                <div className="text-[11px] text-slate-500">
                  {sprintMetrics.doneCount} of {sprintMetrics.totalCount} issues completed
                </div>
              </div>
              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${sprintMetrics.pct}%` }}
                />
              </div>
            </div>

            {onOpenStoryPdfImporter && (
              <button
                type="button"
                onClick={onOpenStoryPdfImporter}
                className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                Upload Story PDF
              </button>
            )}

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

        {/* ====================================================================
            ARIJ ASSIGNEE / USER SELECTOR BAR (PAGE-WISE & CENTER-LINE SPLIT)
            - Click 1 User ("Only") -> shows ONLY that user's 5-column Arij board
            - Click 2+ Users -> shows both users' 5-column Arij boards separated by a
              Center Line in the middle with a Show Down / Hide Below button!
           ==================================================================== */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">
                Arij User Swimlanes (Page-Wise &amp; Center-Line Split):
              </span>
              <span className="text-xs text-slate-500">
                Click <strong>1 user</strong> to view only their 5-column board, or click{' '}
                <strong>2+ users</strong> to split with a{' '}
                <strong>Center Line &amp; Show Down button</strong>.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectOnlyUser(currentUserId)}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
              >
                Only My Board
              </button>
              {users.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const u1 = users[0].id;
                    const u2 = users[1].id;
                    setSelectedUserIds([u1, u2]);
                    setShowBelowUserMap({ [u2]: true });
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 border border-blue-300 rounded hover:bg-blue-100 text-blue-700"
                >
                  2 Users (Center Line Split)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const allIds = users.map((u) => u.id);
                  setSelectedUserIds(allIds);
                  const allVisible = {};
                  allIds.forEach((id) => {
                    allVisible[id] = true;
                  });
                  setShowBelowUserMap(allVisible);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
              >
                All Users
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {users.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              const orderNum = selectedUserIds.indexOf(u.id) + 1;
              const userTaskCount = filteredIssues.filter(
                (i) => i.assigneeId === u.id
              ).length;

              return (
                <div
                  key={u.id}
                  className={`inline-flex items-center rounded-md border text-xs transition-all overflow-hidden ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleUser(u.id)}
                    className="px-3 py-1.5 font-semibold flex items-center gap-2"
                  >
                    {isSelected ? (
                      <span className="w-4 h-4 rounded-full bg-white/25 text-white font-mono text-[10px] flex items-center justify-center">
                        {orderNum}
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded bg-slate-200 text-slate-700 font-mono text-[10px] flex items-center justify-center">
                        {u.initials}
                      </span>
                    )}
                    <span>{u.name}</span>
                    <span
                      className={`font-mono text-[11px] px-1.5 rounded ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {userTaskCount}
                    </span>
                  </button>

                  {!(selectedUserIds.length === 1 && isSelected) && (
                    <button
                      type="button"
                      onClick={() => handleSelectOnlyUser(u.id)}
                      title={`Show ONLY ${u.name}'s board`}
                      className={`px-2 py-1.5 text-[10px] font-bold border-l transition-colors ${
                        isSelected
                          ? 'border-white/20 hover:bg-black/20 text-white'
                          : 'border-slate-200 hover:bg-slate-200 text-slate-500'
                      }`}
                    >
                      Only
                    </button>
                  )}
                </div>
              );
            })}

            {/* Unassigned Queue Chip */}
            {unassignedCount > 0 && (
              <div
                className={`inline-flex items-center rounded-md border text-xs transition-all overflow-hidden ${
                  selectedUserIds.includes('UNASSIGNED')
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleUser('UNASSIGNED')}
                  className="px-3 py-1.5 font-semibold flex items-center gap-2"
                >
                  <span>Unassigned</span>
                  <span className="font-mono text-[11px] px-1.5 rounded bg-slate-200 text-slate-700">
                    {unassignedCount}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ====================================================================
            ARIJ ISSUE TYPES & FILTER TOOLBAR (All Types, Story, Task, Bug, Epic, Search)
           ==================================================================== */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Arij key, title, label..."
                className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white w-52"
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

            {/* Arij Issue Type Filter Buttons (All, Story, Task, Bug) */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedType('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedType === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Types ({typeCounts.ALL})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType(IssueType.STORY)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedType === IssueType.STORY
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <IssueTypeIcon type={IssueType.STORY} className="w-3.5 h-3.5" />
                Story ({typeCounts[IssueType.STORY]})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType(IssueType.TASK)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedType === IssueType.TASK
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <IssueTypeIcon type={IssueType.TASK} className="w-3.5 h-3.5" />
                Task ({typeCounts[IssueType.TASK]})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType(IssueType.BUG)}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  selectedType === IssueType.BUG
                    ? 'bg-white text-red-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <IssueTypeIcon type={IssueType.BUG} className="w-3.5 h-3.5" />
                Bug ({typeCounts[IssueType.BUG]})
              </button>
            </div>

            {/* Epic Filter Dropdown */}
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

            {/* Quick Toggle: High Priority */}
            <button
              type="button"
              onClick={() => setHighPriorityOnly(!highPriorityOnly)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                highPriorityOnly
                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              High / Highest Priority
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500">
            Showing <strong>{activeSelectedUsers.length}</strong> user board
            {activeSelectedUsers.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Main Board Canvas */}
      {!activeSprint && project.template === 'Scrum' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No Active Sprint Running
          </h3>
          <p className="text-xs text-slate-600 max-w-md mt-1 mb-4">
            Head to the Backlog to plan your sprint scope and start the next iteration.
          </p>
          <button
            type="button"
            onClick={onNavigateToBacklog}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Backlog
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {activeSelectedUsers.map((userObj, idx) => {
            const isBelowCenterLine = idx > 0;
            const isShowingDown = showBelowUserMap[userObj.id] !== false;
            const userIssueCount = filteredIssues.filter((i) =>
              userObj.id === 'UNASSIGNED'
                ? !i.assigneeId
                : i.assigneeId === userObj.id
            ).length;

            return (
              <React.Fragment key={userObj.id}>
                {/* HORIZONTAL CENTER LINE BETWEEN USER BOARDS WITH SHOW DOWN / HIDE BELOW BUTTON */}
                {isBelowCenterLine && (
                  <div className="relative py-6 flex items-center justify-center select-none">
                    {/* Horizontal Center Line across the middle */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-slate-300" />

                    {/* Center Line Button to Show Down or Hide Below User's Board */}
                    <div className="relative z-10 flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border-2 border-slate-400 shadow-sm">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Center Line
                      </span>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleToggleShowBelowUser(userObj.id)}
                        className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isShowingDown
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-800 text-white hover:bg-slate-900'
                        }`}
                      >
                        {isShowingDown ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide Below ({userObj.name}&rsquo;s Board)
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Show Down ({userObj.name}&rsquo;s Board · {userIssueCount} tasks)
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* User's 5-Column Arij Kanban Board */}
                {(!isBelowCenterLine || isShowingDown) &&
                  renderUserFiveColumnBoard(userObj, idx === 0)}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
