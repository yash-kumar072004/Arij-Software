import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FolderKanban,
  Plus,
  Square,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  IssueStatus,
  IssueType,
} from '../types/jira.js';
import {
  formatShortDate,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  UserAvatar,
} from './JiraPrimitives.jsx';

const PERSONAL_SECTIONS = [
  {
    id: 'STATUS:TODO',
    kind: 'STATUS',
    value: IssueStatus.TODO,
    label: 'To Do',
    badgeClass: 'bg-slate-800 text-white border-slate-800',
    accent: 'border-t-slate-500',
  },
  {
    id: 'TYPE:STORY',
    kind: 'TYPE',
    value: IssueType.STORY,
    label: 'Story',
    badgeClass: 'bg-emerald-600 text-white border-emerald-600',
    accent: 'border-t-emerald-600',
  },
  {
    id: 'STATUS:IN_PROGRESS',
    kind: 'STATUS',
    value: IssueStatus.IN_PROGRESS,
    label: 'In Progress',
    badgeClass: 'bg-blue-600 text-white border-blue-600',
    accent: 'border-t-blue-600',
  },
  {
    id: 'TYPE:TASK',
    kind: 'TYPE',
    value: IssueType.TASK,
    label: 'Task',
    badgeClass: 'bg-sky-600 text-white border-sky-600',
    accent: 'border-t-sky-600',
  },
  {
    id: 'TYPE:BUG',
    kind: 'TYPE',
    value: IssueType.BUG,
    label: 'Bug',
    badgeClass: 'bg-red-600 text-white border-red-600',
    accent: 'border-t-red-600',
  },
  {
    id: 'STATUS:DONE',
    kind: 'STATUS',
    value: IssueStatus.DONE,
    label: 'Done',
    badgeClass: 'bg-teal-600 text-white border-teal-600',
    accent: 'border-t-teal-600',
  },
];

export const MyWorkspaceView = ({
  currentUser,
  users,
  projects,
  allIssues,
  personalTodos,
  onSwitchUser,
  onSelectProject,
  onSelectIssue,
  onUpdateIssueStatus,
  onQuickCreatePersonalIssue,
  onAddUserAccount,
  onAddPersonalTodo,
  onTogglePersonalTodo,
  onDeletePersonalTodo,
}) => {
  // Page-wise & Center-line split state for the user's own issues
  const [selectedSectionIds, setSelectedSectionIds] = useState([
    'STATUS:TODO',
    'TYPE:STORY',
  ]);
  const [showBelowMap, setShowBelowMap] = useState({});

  // Quick add issue in user's personal workspace
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState(IssueType.STORY);
  const [newTaskStatus, setNewTaskStatus] = useState(IssueStatus.TODO);

  // Personal private checklist item
  const [newTodoText, setNewTodoText] = useState('');

  // Create new user account inline form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('Software Engineer');
  const [userDept, setUserDept] = useState('Engineering');

  // Issues belonging to or assigned to this specific user
  const myIssues = useMemo(() => {
    return allIssues.filter(
      (i) =>
        i.type !== IssueType.EPIC &&
        (i.assigneeId === currentUser.id ||
          projects.some(
            (p) => p.id === i.projectId && p.ownerUserId === currentUser.id
          ))
    );
  }, [allIssues, currentUser.id, projects]);

  const myPersonalProjects = useMemo(() => {
    return projects.filter(
      (p) => p.ownerUserId === currentUser.id || p.leadId === currentUser.id
    );
  }, [projects, currentUser.id]);

  const handleToggleSection = (secId) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(secId)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== secId);
      }
      setShowBelowMap((m) => ({ ...m, [secId]: true }));
      return [...prev, secId];
    });
  };

  const handleSelectOnly = (secId) => {
    setSelectedSectionIds([secId]);
  };

  const handleToggleShowBelow = (secId) => {
    setShowBelowMap((prev) => {
      const curr = prev[secId] !== false;
      return { ...prev, [secId]: !curr };
    });
  };

  const getSectionIssues = (sec) => {
    if (sec.kind === 'STATUS') {
      return myIssues.filter((i) => i.status === sec.value);
    }
    return myIssues.filter((i) => i.type === sec.value);
  };

  const handleCreateTaskSubmit = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onQuickCreatePersonalIssue({
      title: newTaskTitle.trim(),
      type: newTaskType,
      status: newTaskStatus,
    });
    setNewTaskTitle('');
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

  const activeSections = useMemo(() => {
    return selectedSectionIds
      .map((id) => PERSONAL_SECTIONS.find((s) => s.id === id))
      .filter(Boolean);
  }, [selectedSectionIds]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Personal Workspace Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar user={currentUser} size="md" />
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-700">
                Personal User Space
              </span>
              <span>·</span>
              <span>{currentUser.email}</span>
              <span>·</span>
              <span>{currentUser.department}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              {currentUser.name}&rsquo;s Own Workspace & Assigned Board
            </h1>
          </div>
        </div>

        {/* User Account Switcher & New User Account Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200">
            {users.map((u) => {
              const isCurrent = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSwitchUser(u.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <span>{u.initials}</span>
                  <span className="hidden sm:inline">{u.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowCreateUser(!showCreateUser)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            New User Account
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Create New User Account Drawer (Each user automatically gets their own workspace!) */}
        {showCreateUser && (
          <form
            onSubmit={handleCreateAccountSubmit}
            className="p-5 bg-white border-2 border-blue-600 rounded-xl shadow-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Create Your Own User Account & Dedicated Workspace
                </h3>
                <p className="text-xs text-slate-500">
                  Creating a user automatically provisions their own private project, active sprint, and personal task board.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Your Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Yash Kumar"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="yash@kawach.ai"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create & Switch to User
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Top Row: User's Own Projects + Quick Add Personal Task + Personal Private Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: My Personal Projects & Quick Issue Creator */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  {currentUser.name}&rsquo;s Dedicated Projects ({myPersonalProjects.length})
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {myIssues.length} personal & assigned tasks
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myPersonalProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-blue-600 bg-slate-50/60 hover:bg-blue-50/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {proj.key}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {proj.isPersonal ? 'Personal Space' : 'Lead Project'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {proj.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                    {proj.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Task to User's Personal Workspace */}
            <form
              onSubmit={handleCreateTaskSubmit}
              className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2"
            >
              <select
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md"
              >
                <option value={IssueType.STORY}>Story</option>
                <option value={IssueType.TASK}>Task</option>
                <option value={IssueType.BUG}>Bug</option>
              </select>
              <select
                value={newTaskStatus}
                onChange={(e) => setNewTaskStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md"
              >
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={`Add a new task directly to ${currentUser.name}'s personal board...`}
                className="flex-1 min-w-[200px] px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add My Task
              </button>
            </form>
          </div>

          {/* Right 5 cols: Personal Private Notes / Quick Checklist (Isolated per user) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {currentUser.name}&rsquo;s Private Scratchpad
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400">
                  Only visible to {currentUser.initials}
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {personalTodos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No personal reminders yet for {currentUser.name}.
                  </p>
                ) : (
                  personalTodos.map((item) => (
                    <div
                      key={item.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onTogglePersonalTodo(item.id)}
                        className="flex items-center gap-2 text-left flex-1"
                      >
                        {item.done ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className={
                            item.done
                              ? 'line-through text-slate-400'
                              : 'text-slate-800 font-medium'
                          }
                        >
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePersonalTodo(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleAddTodoSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder={`Add private note for ${currentUser.name}...`}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800"
              >
                Add
              </button>
            </form>
          </div>
        </div>

        {/* PAGE-WISE & CENTER-LINE SPLIT SELECTOR FOR USER'S OWN TASKS */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {currentUser.name}&rsquo;s Page-Wise Task View (Click 1 for Single Page, Click 2+ for Center-Line Split)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedSectionIds(['STATUS:TODO'])}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
              >
                Only To Do
              </button>
              <button
                type="button"
                onClick={() => setSelectedSectionIds(['TYPE:STORY'])}
                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
              >
                Only Story
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSectionIds(['STATUS:TODO', 'TYPE:STORY']);
                  setShowBelowMap({ 'TYPE:STORY': true });
                }}
                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded text-blue-700"
              >
                To Do + Story (Center Line Split)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERSONAL_SECTIONS.map((sec) => {
              const isSelected = selectedSectionIds.includes(sec.id);
              const count = getSectionIssues(sec).length;
              const orderNum = selectedSectionIds.indexOf(sec.id) + 1;

              return (
                <div
                  key={sec.id}
                  className={`inline-flex items-center rounded-md border text-xs overflow-hidden ${
                    isSelected
                      ? `${sec.badgeClass}`
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
                        {orderNum}
                      </span>
                    )}
                    <span>{sec.label}</span>
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
                  {!(selectedSectionIds.length === 1 && isSelected) && (
                    <button
                      type="button"
                      onClick={() => handleSelectOnly(sec.id)}
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

        {/* RENDER SELECTED SECTIONS WITH CENTER LINE & SHOW/HIDE DOWN BUTTON */}
        <div className="space-y-2">
          {activeSections.map((sec, idx) => {
            const list = getSectionIssues(sec);
            const isBelowCenterLine = idx > 0;
            const isShowingDown = showBelowMap[sec.id] !== false;

            return (
              <React.Fragment key={sec.id}>
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
                        onClick={() => handleToggleShowBelow(sec.id)}
                        className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          isShowingDown
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-800 text-white hover:bg-slate-900'
                        }`}
                      >
                        {isShowingDown ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Hide Below ({sec.label})
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Show Down ({sec.label} · {list.length})
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {(!isBelowCenterLine || isShowingDown) && (
                  <div
                    className={`bg-white rounded-xl border border-slate-200 border-t-4 ${sec.accent} shadow-xs overflow-hidden`}
                  >
                    <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${sec.badgeClass}`}
                        >
                          {sec.label}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {currentUser.name}&rsquo;s {sec.label} Items ({list.length})
                        </span>
                      </div>
                      {activeSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleSelectOnly(sec.id)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Show Only {sec.label}
                        </button>
                      )}
                    </div>

                    <div className="p-5">
                      {list.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          No {sec.label} items assigned to {currentUser.name}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {list.map((iss) => (
                            <div
                              key={iss.id}
                              onClick={() => onSelectIssue(iss.id)}
                              className="p-3.5 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between gap-2.5"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <IssueTypeIcon type={iss.type} />
                                    <span className="font-mono text-xs font-bold text-blue-700">
                                      {iss.key}
                                    </span>
                                  </div>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={iss.status}
                                      onChange={(e) =>
                                        onUpdateIssueStatus(iss.id, e.target.value)
                                      }
                                      className={`text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-0.5 ${
                                        STATUS_CONFIG[iss.status]?.textClass
                                      }`}
                                    >
                                      {STATUS_ORDER.map((st) => (
                                        <option key={st} value={st}>
                                          {STATUS_CONFIG[st].label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {iss.title}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <PriorityIcon priority={iss.priority} />
                                  {PRIORITY_CONFIG[iss.priority]?.label}
                                </span>
                                <span className="font-mono">
                                  {iss.storyPoints} pts · Due {formatShortDate(iss.dueDate)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
