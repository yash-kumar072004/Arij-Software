import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  Clock,
  Copy,
  Eye,
  GitBranch,
  History,
  Link2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  LinkType,
  ProjectComponent,
  ReleaseVersion,
  Sprint,
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
  TYPE_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface IssueDetailModalProps {
  issue: Issue;
  allIssues: Issue[];
  epics: Issue[];
  sprints: Sprint[];
  releases: ReleaseVersion[];
  components: ProjectComponent[];
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onSelectIssue: (issueId: string) => void;
  onUpdateIssue: (issueId: string, updates: Partial<Issue>) => void;
  onDeleteIssue: (issueId: string) => void;
  onCloneIssue: (issue: Issue) => void;
  onAddComment: (issueId: string, body: string) => void;
  onLogWork: (issueId: string, hours: number, comment: string) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  allIssues,
  epics,
  sprints,
  releases,
  components,
  users,
  currentUserId,
  onClose,
  onSelectIssue,
  onUpdateIssue,
  onDeleteIssue,
  onCloneIssue,
  onAddComment,
  onLogWork,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(issue.title);

  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(issue.description);

  // Subtask form
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Linked issue form
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkType, setLinkType] = useState<LinkType>(LinkType.BLOCKS);
  const [linkTargetId, setLinkTargetId] = useState<string>('');

  // Log work form
  const [showLogWork, setShowLogWork] = useState(false);
  const [workHours, setWorkHours] = useState('2');
  const [workComment, setWorkComment] = useState('');

  // Labels form
  const [newLabel, setNewLabel] = useState('');

  // Activity tab
  const [activityTab, setActivityTab] = useState<'COMMENTS' | 'WORKLOG' | 'HISTORY'>(
    'COMMENTS'
  );
  const [commentBody, setCommentBody] = useState('');

  // Copy & Delete states
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const issueMap = useMemo(() => {
    const map: Record<string, Issue> = {};
    allIssues.forEach((i) => {
      map[i.id] = i;
    });
    return map;
  }, [allIssues]);

  const isWatching = issue.watcherIds.includes(currentUserId);

  const toggleWatch = () => {
    const updated = isWatching
      ? issue.watcherIds.filter((id) => id !== currentUserId)
      : [...issue.watcherIds, currentUserId];
    onUpdateIssue(issue.id, { watcherIds: updated });
  };

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== issue.title) {
      onUpdateIssue(issue.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (descDraft !== issue.description) {
      onUpdateIssue(issue.id, { description: descDraft });
    }
    setEditingDesc(false);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const nextIdx = issue.subtasks.length + 1;
    const newSub = {
      id: `sub-${Date.now()}`,
      key: `${issue.key}-${nextIdx}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      assigneeId: currentUserId,
    };
    onUpdateIssue(issue.id, { subtasks: [...issue.subtasks, newSub] });
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
  };

  const toggleSubtask = (subId: string) => {
    const updated = issue.subtasks.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    onUpdateIssue(issue.id, { subtasks: updated });
  };

  const deleteSubtask = (subId: string) => {
    onUpdateIssue(issue.id, {
      subtasks: issue.subtasks.filter((s) => s.id !== subId),
    });
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTargetId) return;
    const newLink = {
      id: `lnk-${Date.now()}`,
      type: linkType,
      targetIssueId: linkTargetId,
    };
    onUpdateIssue(issue.id, { links: [...issue.links, newLink] });
    setLinkTargetId('');
    setShowAddLink(false);
  };

  const removeLink = (linkId: string) => {
    onUpdateIssue(issue.id, {
      links: issue.links.filter((l) => l.id !== linkId),
    });
  };

  const handleLogWorkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(workHours);
    if (Number.isNaN(hrs) || hrs <= 0) return;
    onLogWork(issue.id, hrs, workComment.trim() || 'Logged engineering work');
    setWorkHours('2');
    setWorkComment('');
    setShowLogWork(false);
  };

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newLabel.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleaned || issue.labels.includes(cleaned)) {
      setNewLabel('');
      return;
    }
    onUpdateIssue(issue.id, { labels: [...issue.labels, cleaned] });
    setNewLabel('');
  };

  const removeLabel = (lbl: string) => {
    onUpdateIssue(issue.id, {
      labels: issue.labels.filter((l) => l !== lbl),
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    onAddComment(issue.id, commentBody.trim());
    setCommentBody('');
  };

  const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
  const subtaskPct =
    issue.subtasks.length > 0
      ? Math.round((completedSubtasks / issue.subtasks.length) * 100)
      : 0;

  const totalTimeDenom = Math.max(
    1,
    issue.originalEstimateHours || issue.timeSpentHours + issue.remainingEstimateHours
  );
  const timeSpentPct = Math.min(
    100,
    Math.round((issue.timeSpentHours / totalTimeDenom) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <IssueTypeIcon type={issue.type} className="w-4 h-4" />
            <select
              value={issue.type}
              onChange={(e) =>
                onUpdateIssue(issue.id, { type: e.target.value as IssueType })
              }
              aria-label="Issue type"
              className="text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded px-2 py-1"
            >
              {Object.values(IssueType).map((t) => (
                <option key={t} value={t}>
                  {TYPE_CONFIG[t].label}
                </option>
              ))}
            </select>
            <span className="text-slate-300">/</span>
            <span className="font-mono tabular-nums text-sm font-bold text-blue-700">
              {issue.key}
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleWatch}
              className={`px-2.5 py-1.5 text-xs font-medium rounded border flex items-center gap-1.5 transition-colors ${
                isWatching
                  ? 'bg-blue-50 border-blue-600 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">
                {isWatching ? 'Watching' : 'Watch'} ({issue.watcherIds.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(`${issue.key}: ${issue.title}`);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 1800);
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 flex items-center gap-1"
              title="Copy issue key and title"
            >
              {copiedKey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Key
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onCloneIssue(issue);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
            >
              Clone
            </button>

            {confirmDelete ? (
              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded px-2 py-1">
                <span className="text-xs text-red-700 font-medium">Delete?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteIssue(issue.id);
                    onClose();
                  }}
                  className="px-2 py-0.5 text-xs font-semibold bg-red-600 text-white rounded"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-0.5 text-xs text-slate-600"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete issue"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors ml-1"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Two-Column Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column (7 cols): Title, Description, Subtasks, Links, Activity */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto">
            {/* Issue Title */}
            <div>
              {editingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    className="w-full text-lg font-bold text-slate-900 px-3 py-1.5 border border-blue-600 rounded focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTitleDraft(issue.title);
                        setEditingTitle(false);
                      }}
                      className="px-3 py-1 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <h1
                  onClick={() => {
                    setTitleDraft(issue.title);
                    setEditingTitle(true);
                  }}
                  className="text-xl font-bold text-slate-900 hover:bg-slate-50 p-1.5 -m-1.5 rounded cursor-text transition-colors"
                  title="Click to edit summary"
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Quick Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddSubtask(true)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center gap-1.5 transition-colors"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Add Subtask
              </button>
              <button
                type="button"
                onClick={() => setShowAddLink(true)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Link Issue
              </button>
              <button
                type="button"
                onClick={() => setShowLogWork((v) => !v)}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Log Work
              </button>
            </div>

            {/* Log Work Inline Form */}
            {showLogWork && (
              <form
                onSubmit={handleLogWorkSubmit}
                className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Log Time Spent on {issue.key}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Hours Spent
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={workHours}
                      onChange={(e) => setWorkHours(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Work Description
                    </label>
                    <input
                      type="text"
                      value={workComment}
                      onChange={(e) => setWorkComment(e.target.value)}
                      placeholder="What was completed?"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLogWork(false)}
                    className="px-2.5 py-1 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded"
                  >
                    Save Work Log
                  </button>
                </div>
              </form>
            )}

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 mb-2">Description</h3>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    className="w-full text-sm text-slate-800 p-3 border border-blue-600 rounded-md focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDesc}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Save Description
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescDraft(issue.description);
                        setEditingDesc(false);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setDescDraft(issue.description);
                    setEditingDesc(true);
                  }}
                  className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap p-3 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/80 rounded-md cursor-text min-h-[72px]"
                >
                  {issue.description || 'Click to add a technical description or acceptance criteria...'}
                </div>
              )}
            </div>

            {/* Child Issues / Subtasks Section */}
            {(issue.subtasks.length > 0 || showAddSubtask) && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700">
                    Subtasks ({completedSubtasks}/{issue.subtasks.length})
                  </h3>
                  <span className="font-mono tabular-nums text-xs text-slate-500">
                    {subtaskPct}% Done
                  </span>
                </div>

                {issue.subtasks.length > 0 && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${subtaskPct}%` }}
                    />
                  </div>
                )}

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                  {issue.subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={sub.completed}
                          onChange={() => toggleSubtask(sub.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span className="font-mono tabular-nums text-slate-500 shrink-0">
                          {sub.key}
                        </span>
                        <span
                          className={`truncate ${
                            sub.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-800 font-medium'
                          }`}
                        >
                          {sub.title}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => deleteSubtask(sub.id)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {showAddSubtask && (
                  <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Subtask summary..."
                      className="flex-1 px-3 py-1.5 text-xs border border-blue-600 rounded focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSubtask(false)}
                      className="px-2 py-1.5 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Linked Issues Section */}
            {(issue.links.length > 0 || showAddLink) && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-700">Linked Issues</h3>

                {issue.links.length > 0 && (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
                    {issue.links.map((lnk) => {
                      const target = issueMap[lnk.targetIssueId];
                      if (!target) return null;
                      return (
                        <div
                          key={lnk.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-500 italic shrink-0">
                              {lnk.type}
                            </span>
                            <IssueTypeIcon type={target.type} className="w-3.5 h-3.5" />
                            <button
                              type="button"
                              onClick={() => onSelectIssue(target.id)}
                              className="font-mono tabular-nums font-semibold text-blue-700 hover:underline shrink-0"
                            >
                              {target.key}
                            </button>
                            <span className="text-slate-800 truncate">{target.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[11px] font-semibold ${
                                STATUS_CONFIG[target.status].textClass
                              }`}
                            >
                              {STATUS_CONFIG[target.status].shortLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLink(lnk.id)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showAddLink && (
                  <form
                    onSubmit={handleAddLink}
                    className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md"
                  >
                    <select
                      value={linkType}
                      onChange={(e) => setLinkType(e.target.value as LinkType)}
                      className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value={LinkType.BLOCKS}>blocks</option>
                      <option value={LinkType.IS_BLOCKED_BY}>is blocked by</option>
                      <option value={LinkType.RELATES_TO}>relates to</option>
                      <option value={LinkType.DUPLICATES}>duplicates</option>
                    </select>
                    <select
                      value={linkTargetId}
                      onChange={(e) => setLinkTargetId(e.target.value)}
                      required
                      className="flex-1 text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                    >
                      <option value="">Select issue...</option>
                      {allIssues
                        .filter((i) => i.id !== issue.id)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.key} — {i.title.slice(0, 48)}
                          </option>
                        ))}
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddLink(false)}
                      className="px-2 py-1.5 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Activity Section: Comments, Work Log, Audit History */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700">Activity</h3>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                  <button
                    type="button"
                    onClick={() => setActivityTab('COMMENTS')}
                    className={`px-2.5 py-1 text-xs font-medium rounded ${
                      activityTab === 'COMMENTS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Comments ({issue.comments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityTab('WORKLOG')}
                    className={`px-2.5 py-1 text-xs font-medium rounded ${
                      activityTab === 'WORKLOG'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Work Log ({issue.workLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityTab('HISTORY')}
                    className={`px-2.5 py-1 text-xs font-medium rounded ${
                      activityTab === 'HISTORY'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    History ({issue.history.length})
                  </button>
                </div>
              </div>

              {activityTab === 'COMMENTS' && (
                <div className="space-y-4">
                  <form onSubmit={handleCommentSubmit} className="space-y-2">
                    <textarea
                      rows={2}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Add a comment or engineering update..."
                      className="w-full text-xs p-3 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={!commentBody.trim()}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Post Comment
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {issue.comments.map((cmt) => {
                      const author = userMap[cmt.authorId];
                      return (
                        <div
                          key={cmt.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <UserAvatar user={author} size="xs" />
                              <span className="font-semibold text-slate-900">
                                {author?.name || 'Engineer'}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums text-[11px] text-slate-400">
                              {formatShortDate(cmt.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed pl-7">
                            {cmt.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activityTab === 'WORKLOG' && (
                <div className="space-y-2">
                  {issue.workLogs.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">
                      No work logged yet. Click "Log Work" above to record hours.
                    </div>
                  ) : (
                    issue.workLogs.map((wl) => {
                      const author = userMap[wl.authorId];
                      return (
                        <div
                          key={wl.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <UserAvatar user={author} size="xs" />
                            <div>
                              <span className="font-semibold text-slate-900">
                                {author?.name}
                              </span>{' '}
                              logged{' '}
                              <span className="font-mono tabular-nums font-bold text-blue-700">
                                {wl.hoursSpent}h
                              </span>
                              <p className="text-slate-600 mt-0.5">{wl.comment}</p>
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400">
                            {formatShortDate(wl.loggedAt)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activityTab === 'HISTORY' && (
                <div className="space-y-2">
                  {issue.history.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4 text-center">
                      No audit transitions recorded yet.
                    </div>
                  ) : (
                    issue.history.map((h) => {
                      const actor = userMap[h.actorId];
                      return (
                        <div
                          key={h.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">
                              {actor?.name || 'User'}
                            </span>{' '}
                            updated <span className="font-mono font-semibold">{h.field}</span>:{' '}
                            <span className="text-slate-500 line-through">{h.oldValue}</span>{' '}
                            → <span className="font-semibold text-slate-900">{h.newValue}</span>
                          </div>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400">
                            {formatShortDate(h.timestamp)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Status & Metadata Details Panel */}
          <div className="lg:col-span-5 p-6 bg-slate-50/50 space-y-5 overflow-y-auto text-xs">
            {/* Status Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                Workflow Status
              </label>
              <select
                value={issue.status}
                onChange={(e) =>
                  onUpdateIssue(issue.id, { status: e.target.value as IssueStatus })
                }
                className={`w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-600 ${
                  STATUS_CONFIG[issue.status].textClass
                }`}
              >
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Details Grid */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                Details & Assignment
              </div>

              {/* Assignee */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Assignee</span>
                <div className="col-span-2 space-y-1">
                  <select
                    value={issue.assigneeId || 'UNASSIGNED'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        assigneeId:
                          e.target.value === 'UNASSIGNED' ? null : e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 font-medium"
                  >
                    <option value="UNASSIGNED">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {issue.assigneeId !== currentUserId && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateIssue(issue.id, { assigneeId: currentUserId })
                      }
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Assign to me
                    </button>
                  )}
                </div>
              </div>

              {/* Reporter */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Reporter</span>
                <div className="col-span-2">
                  <select
                    value={issue.reporterId}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { reporterId: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Priority</span>
                <div className="col-span-2">
                  <select
                    value={issue.priority}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        priority: e.target.value as IssuePriority,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 font-medium"
                  >
                    {Object.values(IssuePriority).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_CONFIG[p].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sprint */}
              {issue.type !== IssueType.EPIC && (
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-slate-500 font-medium">Sprint</span>
                  <div className="col-span-2">
                    <select
                      value={issue.sprintId || 'BACKLOG'}
                      onChange={(e) =>
                        onUpdateIssue(issue.id, {
                          sprintId:
                            e.target.value === 'BACKLOG' ? null : e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                    >
                      <option value="BACKLOG">Backlog</option>
                      {sprints.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Parent Epic */}
              {issue.type !== IssueType.EPIC && (
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-slate-500 font-medium">Epic Link</span>
                  <div className="col-span-2">
                    <select
                      value={issue.epicId || 'NONE'}
                      onChange={(e) =>
                        onUpdateIssue(issue.id, {
                          epicId: e.target.value === 'NONE' ? null : e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                    >
                      <option value="NONE">No Epic</option>
                      {epics.map((ep) => (
                        <option key={ep.id} value={ep.id}>
                          {ep.key} — {ep.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Story Points */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Story Points</span>
                <div className="col-span-2">
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
                    className="w-24 px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded text-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Time Tracking */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Time Tracking</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {issue.timeSpentHours}h logged · {issue.remainingEstimateHours}h left
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${timeSpentPct}%` }}
                  />
                </div>
              </div>

              {/* Fix Version */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Fix Version</span>
                <div className="col-span-2">
                  <select
                    value={issue.fixVersionId || 'NONE'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        fixVersionId:
                          e.target.value === 'NONE' ? null : e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                  >
                    <option value="NONE">None</option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Component */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Component</span>
                <div className="col-span-2">
                  <select
                    value={issue.componentId || 'NONE'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        componentId:
                          e.target.value === 'NONE' ? null : e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                  >
                    <option value="NONE">None</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start Date & Due Date */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={issue.startDate || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { startDate: e.target.value })
                    }
                    className="w-full px-2 py-1 font-mono text-xs bg-slate-50 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={issue.dueDate || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { dueDate: e.target.value })
                    }
                    className={`w-full px-2 py-1 font-mono text-xs bg-slate-50 border rounded ${
                      isOverdue(issue.dueDate, issue.status)
                        ? 'border-red-400 text-red-600 font-semibold'
                        : 'border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-slate-500 font-medium block">Labels</span>
                {issue.labels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                    {issue.labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700"
                      >
                        {lbl}
                        <button
                          type="button"
                          onClick={() => removeLabel(lbl)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddLabel} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add label + Enter..."
                    className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded text-slate-700"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>

            {/* Timestamps Footer */}
            <div className="text-[11px] font-mono tabular-nums text-slate-400 space-y-1 px-1">
              <div>Created: {formatShortDate(issue.createdAt)}</div>
              <div>Updated: {formatShortDate(issue.updatedAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
