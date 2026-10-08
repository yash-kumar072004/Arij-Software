import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Square,
  Trash2,
  UserPlus,
  Users,
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
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './ArijPrimitives.jsx';

export const MyWorkspaceView = ({
  currentUser,
  users,
  allIssues,
  personalTodos,
  onSwitchUser,
  onSelectIssue,
  onUpdateIssueStatus,
  onQuickCreatePersonalIssue,
  onAddUserAccount,
  onAddPersonalTodo,
  onTogglePersonalTodo,
  onDeletePersonalTodo,
}) => {
  // Selected users for Page-Wise / Center-Line Split View
  const [selectedUserIds, setSelectedUserIds] = useState(() => {
    const firstId = currentUser.id;
    const secondUser = users.find((u) => u.id !== firstId);
    return secondUser ? [firstId, secondUser.id] : [firstId];
  });
  const [showBelowUserMap, setShowBelowUserMap] = useState({});
  const [selectedType, setSelectedType] = useState('ALL');
  const prevIssuesCountRef = useRef(allIssues.length);

  useEffect(() => {
    if (currentUser?.id) {
      setSelectedUserIds((prev) => [
        currentUser.id,
        ...prev.filter((id) => id !== currentUser.id),
      ]);
      setShowBelowUserMap((m) => ({ ...m, [currentUser.id]: true }));
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (allIssues.length > prevIssuesCountRef.current) {
      const latest =
        allIssues.find((i) => i.isUserCreated) ||
        allIssues[0] ||
        allIssues[allIssues.length - 1];
      if (latest?.assigneeId) {
        setSelectedUserIds((prev) => [
          latest.assigneeId,
          ...prev.filter((id) => id !== latest.assigneeId),
        ]);
        setShowBelowUserMap((m) => ({ ...m, [latest.assigneeId]: true }));
      }
      if (selectedType !== 'ALL' && latest && latest.type !== selectedType) {
        setSelectedType('ALL');
      }
    }
    prevIssuesCountRef.current = allIssues.length;
  }, [allIssues, selectedType]);

  // Drag & Drop State across columns & users
  const [draggedIssueId, setDraggedIssueId] = useState(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState(null);

  // Quick inline create per user + status column
  const [quickCreateKey, setQuickCreateKey] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState(IssueType.STORY);

  // Personal private checklist item
  const [newTodoText, setNewTodoText] = useState('');

  // Create new user account inline form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Software Engineer');
  const [userDept, setUserDept] = useState('Engineering');

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== userId);
      }
      setShowBelowUserMap((m) => ({ ...m, [userId]: true }));
      return [...prev, userId];
    });
  };

  const handleSelectOnlyUser = (userId) => {
    setSelectedUserIds([userId]);
    onSwitchUser(userId);
  };

  const handleToggleShowBelowUser = (userId) => {
    setShowBelowUserMap((prev) => {
      const curr = prev[userId] !== false;
      return { ...prev, [userId]: !curr };
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
      onUpdateIssueStatus(issueId, status, targetUserId);
    }
    setDraggedIssueId(null);
    setDragOverColumnKey(null);
  };

  const handleCreateAccountSubmit = (e) => {
    e.preventDefault();
    if (!userName.trim()) return;
    onAddUserAccount({
      name: userName.trim(),
      email:
        userEmail.trim() ||
        `${userName.trim().toLowerCase().replace(/[^a-z0-9]/g, '.')}@kawach.ai`,
      role: userRole.trim() || 'Software Engineer',
      department: userDept.trim() || 'Engineering',
    });
    setUserName('');
    setUserEmail('');
    setShowCreateUser(false);
  };

  const handleAddTodoSubmit = (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    onAddPersonalTodo(newTodoText.trim());
    setNewTodoText('');
  };

  const activeSelectedUsers = useMemo(() => {
    const list = selectedUserIds
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean);
    return list.length > 0 ? list : [currentUser];
  }, [selectedUserIds, users, currentUser]);

  const nonEpicIssues = useMemo(() => {
    return allIssues.filter(
      (i) =>
        (i.type !== IssueType.EPIC || !String(i.id).startsWith('iss-epic-')) &&
        (selectedType === 'ALL' || i.type === selectedType)
    );
  }, [allIssues, selectedType]);

  const renderUserFiveColumnBoard = (userObj, isTopBoard = false) => {
    const userIssues = nonEpicIssues.filter(
      (i) =>
        i.assigneeId === userObj.id ||
        (isTopBoard && i.isUserCreated) ||
        (i.isUserCreated && i.reporterId === userObj.id)
    );
    const totalPts = userIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const donePts = userIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((s, i) => s + (i.storyPoints || 0), 0);

    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar user={userObj} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  {userObj.name}&rsquo;s Personal 5-Column Arij Board
                </h2>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600/30 border border-blue-400/30 text-blue-200 font-semibold">
                  {userObj.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {userObj.department} · {userIssues.length} tasks · {donePts}/
                {totalPts} pts Done
              </p>
            </div>
          </div>

          {activeSelectedUsers.length > 1 && (
            <button
              type="button"
              onClick={() => handleSelectOnlyUser(userObj.id)}
              className="px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md"
            >
              Show Only {userObj.name.split(' ')[0]}
            </button>
          )}
        </div>

        {/* Classic 5-Column Arij System (TO DO | IN PROGRESS | IN REVIEW | QA TESTING | DONE) */}
        <div className="p-4 overflow-x-auto bg-slate-50">
          <div className="grid grid-cols-5 gap-4 min-w-[1080px]">
            {STATUS_ORDER.map((status) => {
              const colConfig = STATUS_CONFIG[status];
              const colIssues = userIssues.filter((i) => i.status === status);
              const colPoints = colIssues.reduce(
                (s, i) => s + (i.storyPoints || 0),
                0
              );
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
                    isDragTarget
                      ? 'bg-blue-50/60 border-blue-400'
                      : 'bg-slate-100/80 border-slate-200'
                  } min-h-[320px] transition-colors`}
                >
                  <div className="p-3 border-b border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold tracking-wider uppercase text-slate-700">
                        {colConfig.shortLabel}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {colIssues.length}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {colPoints} pts
                    </span>
                  </div>

                  <div className="flex-1 p-2.5 flex flex-col gap-2.5 overflow-y-auto">
                    {colIssues.map((issue) => {
                      const overdue = isOverdue(issue.dueDate, issue.status);
                      const typeInfo =
                        ISSUE_TYPE_CONFIG[issue.type] ||
                        ISSUE_TYPE_CONFIG[IssueType.TASK];

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
                          className="group bg-white border border-slate-200 rounded-md p-3.5 shadow-2xs hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${typeInfo.bgBadge}`}
                              >
                                <IssueTypeIcon
                                  type={issue.type}
                                  className="w-3 h-3"
                                />
                                {typeInfo.label}
                              </span>
                              <span className="font-mono text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                                {issue.key}
                              </span>
                            </div>
                            {issue.dueDate && (
                              <span
                                className={`font-mono text-[11px] flex items-center gap-1 ${
                                  overdue
                                    ? 'text-red-600 font-semibold'
                                    : 'text-slate-400'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {formatShortDate(issue.dueDate)}
                              </span>
                            )}
                          </div>

                          <h4 className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-2">
                            {issue.title}
                          </h4>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <PriorityIcon
                                priority={issue.priority}
                                className="w-3.5 h-3.5"
                              />
                              {issue.storyPoints > 0 && (
                                <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
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
                            <UserAvatar user={userObj} size="xs" />
                          </div>
                        </div>
                      );
                    })}

                    {colIssues.length === 0 && (
                      <div className="flex-1 min-h-[90px] border border-dashed border-slate-300 rounded-md flex items-center justify-center text-xs text-slate-400">
                        Drop {userObj.initials}&rsquo;s {colConfig.shortLabel} issues
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 border-t border-slate-200/60">
                    {quickCreateKey === colKey ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!quickTitle.trim()) return;
                          onQuickCreatePersonalIssue({
                            title: quickTitle.trim(),
                            type: quickType,
                            status,
                            assigneeId: userObj.id,
                          });
                          setQuickTitle('');
                          setQuickCreateKey(null);
                        }}
                        className="bg-white p-2.5 rounded-md border border-blue-500 space-y-2"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={quickTitle}
                          onChange={(e) => setQuickTitle(e.target.value)}
                          placeholder={`New task for ${userObj.name.split(' ')[0]}...`}
                          className="w-full text-xs text-slate-900 focus:outline-none"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <select
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value)}
                            className="text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-1"
                          >
                            <option value={IssueType.STORY}>Story</option>
                            <option value={IssueType.TASK}>Task</option>
                            <option value={IssueType.BUG}>Bug</option>
                          </select>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuickCreateKey(null)}
                              className="px-2 py-1 text-[11px] text-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 text-white rounded"
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
                        className="w-full py-1.5 px-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded flex items-center gap-1.5"
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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={currentUser} size="md" />
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-700">
                User Workspace &amp; Center-Line Split Boards
              </span>
              <span>·</span>
              <span>{currentUser.email}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Every User&rsquo;s Own 5-Column Arij Board
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Arij Issue Type Filter */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedType('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                selectedType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setSelectedType(IssueType.STORY)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                selectedType === IssueType.STORY
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              <IssueTypeIcon type={IssueType.STORY} className="w-3 h-3" />
              Story
            </button>
            <button
              type="button"
              onClick={() => setSelectedType(IssueType.TASK)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                selectedType === IssueType.TASK
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              <IssueTypeIcon type={IssueType.TASK} className="w-3 h-3" />
              Task
            </button>
            <button
              type="button"
              onClick={() => setSelectedType(IssueType.BUG)}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                selectedType === IssueType.BUG
                  ? 'bg-white text-red-700 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              <IssueTypeIcon type={IssueType.BUG} className="w-3 h-3" />
              Bug
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateUser(!showCreateUser)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            New User Account
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {showCreateUser && (
          <form
            onSubmit={handleCreateAccountSubmit}
            className="p-5 bg-white border-2 border-blue-600 rounded-xl shadow-md space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900">
              Create New User Account (Automatically Creates Their Own 5-Column Board)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Full Name (e.g. Yash Kumar)"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="Email (e.g. yash@kawach.ai)"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <input
                type="text"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                placeholder="Role"
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
              <button
                type="submit"
                className="py-1.5 px-3 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create User
              </button>
            </div>
          </form>
        )}

        {/* USER SELECTOR BAR */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900">
                Select User(s) to View Their Board:
              </span>
              <span className="text-xs text-slate-500">
                Click <strong>1 user</strong> to show only their board, or click{' '}
                <strong>2+ users</strong> to show both with a{' '}
                <strong>Center Line &amp; Show/Hide Down button</strong>.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {users.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              const orderNum = selectedUserIds.indexOf(u.id) + 1;
              const count = nonEpicIssues.filter(
                (i) => i.assigneeId === u.id
              ).length;

              return (
                <div
                  key={u.id}
                  className={`inline-flex items-center rounded-md border text-xs overflow-hidden ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
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
                      {count}
                    </span>
                  </button>

                  {!(selectedUserIds.length === 1 && isSelected) && (
                    <button
                      type="button"
                      onClick={() => handleSelectOnlyUser(u.id)}
                      className={`px-2 py-1.5 text-[10px] font-bold border-l ${
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
          </div>
        </div>

        {/* USER BOARDS WITH CENTER LINE & SHOW DOWN BUTTON */}
        <div className="space-y-2">
          {activeSelectedUsers.map((userObj, idx) => {
            const isBelowCenterLine = idx > 0;
            const isShowingDown = showBelowUserMap[userObj.id] !== false;
            const count = nonEpicIssues.filter(
              (i) => i.assigneeId === userObj.id
            ).length;

            return (
              <React.Fragment key={userObj.id}>
                {isBelowCenterLine && (
                  <div className="relative py-6 flex items-center justify-center select-none">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-slate-300" />
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
                            Show Down ({userObj.name}&rsquo;s Board · {count} tasks)
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {(!isBelowCenterLine || isShowingDown) &&
                  renderUserFiveColumnBoard(userObj, idx === 0)}
              </React.Fragment>
            );
          })}
        </div>

        {/* Personal Quick Checklist for Active User */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            {currentUser.name}&rsquo;s Private Personal Checklist
          </h3>
          <form onSubmit={handleAddTodoSubmit} className="flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder={`Add a private checklist item for ${currentUser.name}...`}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Note
            </button>
          </form>
          <div className="space-y-1.5">
            {(personalTodos || []).map((todo) => (
              <div
                key={todo.id}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-200 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onTogglePersonalTodo(todo.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {todo.done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span
                    className={
                      todo.done
                        ? 'line-through text-slate-400'
                        : 'text-slate-800 font-medium'
                    }
                  >
                    {todo.text}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePersonalTodo(todo.id)}
                  className="text-slate-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
