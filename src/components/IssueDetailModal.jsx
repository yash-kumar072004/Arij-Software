import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Clock,
  Copy,
  History,
  Link2,
  MessageSquare,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueType,
} from '../types/jira.js';
import {
  formatShortDate,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  TYPE_CONFIG,
  UserAvatar,
} from './JiraPrimitives.jsx';

export const IssueDetailModal = ({
  issue,
  allIssues,
  epics,
  sprints,
  releases,
  components,
  users,
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

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  const [showAddLink, setShowAddLink] = useState(false);
  const [linkType, setLinkType] = useState('BLOCKS');
  const [linkTargetId, setLinkTargetId] = useState('');

  const [newLabel, setNewLabel] = useState('');
  const [showAddLabel, setShowAddLabel] = useState(false);

  const [activeActivityTab, setActiveActivityTab] = useState('COMMENTS');
  const [commentBody, setCommentBody] = useState('');

  const [logHours, setLogHours] = useState('');
  const [logComment, setLogComment] = useState('');

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const issueMap = useMemo(() => {
    const map = {};
    allIssues.forEach((i) => {
      map[i.id] = i;
    });
    return map;
  }, [allIssues]);

  const handleTitleSave = () => {
    if (titleDraft.trim() && titleDraft.trim() !== issue.title) {
      onUpdateIssue(issue.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const handleDescSave = () => {
    if (descDraft !== issue.description) {
      onUpdateIssue(issue.id, { description: descDraft });
    }
    setEditingDesc(false);
  };

  const handleToggleSubtask = (subId) => {
    const updated = issue.subtasks.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    onUpdateIssue(issue.id, { subtasks: updated });
  };

  const handleAddSubtaskSubmit = (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const nextIdx = issue.subtasks.length + 1;
    const newSub = {
      id: `sub-${Date.now()}`,
      key: `${issue.key}-${nextIdx}`,
      title: newSubtaskTitle.trim(),
      completed: false,
      assigneeId: issue.assigneeId || undefined,
    };
    onUpdateIssue(issue.id, { subtasks: [...issue.subtasks, newSub] });
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
  };

  const handleDeleteSubtask = (subId) => {
    onUpdateIssue(issue.id, {
      subtasks: issue.subtasks.filter((s) => s.id !== subId),
    });
  };

  const handleAddLinkSubmit = (e) => {
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

  const handleRemoveLink = (linkId) => {
    onUpdateIssue(issue.id, {
      links: issue.links.filter((l) => l.id !== linkId),
    });
  };

  const handleAddLabelSubmit = (e) => {
    e.preventDefault();
    const clean = newLabel.trim().toLowerCase().replace(/\s+/g, '-');
    if (clean && !issue.labels.includes(clean)) {
      onUpdateIssue(issue.id, { labels: [...issue.labels, clean] });
    }
    setNewLabel('');
    setShowAddLabel(false);
  };

  const handleRemoveLabel = (lbl) => {
    onUpdateIssue(issue.id, {
      labels: issue.labels.filter((l) => l !== lbl),
    });
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    onAddComment(issue.id, commentBody.trim());
    setCommentBody('');
  };

  const handleWorkLogSubmit = (e) => {
    e.preventDefault();
    const hrs = Number(logHours);
    if (!hrs || hrs <= 0) return;
    onLogWork(issue.id, hrs, logComment.trim() || 'Logged engineering time.');
    setLogHours('');
    setLogComment('');
  };

  const completedSubtasks = issue.subtasks.filter((s) => s.completed).length;
  const subtaskPct =
    issue.subtasks.length > 0
      ? Math.round((completedSubtasks / issue.subtasks.length) * 100)
      : 0;

  const totalEstimate =
    issue.timeSpentHours + issue.remainingEstimateHours ||
    issue.originalEstimateHours ||
    1;
  const timePct = Math.min(
    100,
    Math.round((issue.timeSpentHours / totalEstimate) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header Bar */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <select
              value={issue.type}
              onChange={(e) =>
                onUpdateIssue(issue.id, { type: e.target.value })
              }
              aria-label="Issue Type"
              className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
            >
              <option value={IssueType.EPIC}>Epic</option>
              <option value={IssueType.STORY}>Story</option>
              <option value={IssueType.TASK}>Task</option>
              <option value={IssueType.BUG}>Bug</option>
            </select>
            <IssueTypeIcon type={issue.type} className="w-4 h-4" />
            <span className="font-mono tabular-nums text-sm font-bold text-blue-700">
              {issue.key}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onCloneIssue(issue)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/70 rounded flex items-center gap-1.5 transition-colors"
              title="Clone this issue"
            >
              <Copy className="w-3.5 h-3.5" />
              Clone
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteIssue(issue.id);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded flex items-center gap-1.5 transition-colors"
              title="Delete this issue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md"
              aria-label="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2-Column Body: Left Main Content (7 cols) + Right Metadata Panel (5 cols) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEFT PANE: Summary, Description, Subtasks, Linked Issues, Activity */}
          <div className="lg:col-span-7 p-6 space-y-6">
            {/* Editable Title */}
            <div>
              {editingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="w-full text-lg font-bold text-slate-900 bg-white border border-blue-600 rounded px-3 py-1.5 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTitleSave}
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
                  className="text-xl font-bold text-slate-900 hover:bg-slate-100 rounded px-2 py-1 -mx-2 cursor-pointer transition-colors"
                  title="Click to edit title"
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Editable Description */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Description
              </div>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    className="w-full text-sm text-slate-800 bg-white border border-blue-600 rounded-md p-3 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDescSave}
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
                  className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md p-3.5 cursor-pointer min-h-[76px]"
                  title="Click to edit description"
                >
                  {issue.description || 'Click to add technical description...'}
                </div>
              )}
            </div>

            {/* Subtasks Checklist */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Subtasks ({completedSubtasks}/{issue.subtasks.length})
                  </span>
                  {issue.subtasks.length > 0 && (
                    <span className="font-mono text-xs font-semibold text-emerald-700">
                      {subtaskPct}%
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSubtask(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Subtask
                </button>
              </div>

              {issue.subtasks.length > 0 && (
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${subtaskPct}%` }}
                  />
                </div>
              )}

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-md overflow-hidden">
                {issue.subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="px-3 py-2 bg-white hover:bg-slate-50 flex items-center justify-between gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(sub.id)}
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      {sub.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-mono text-slate-400 shrink-0">
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
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {showAddSubtask && (
                <form
                  onSubmit={handleAddSubtaskSubmit}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="New subtask summary..."
                    className="flex-1 text-xs bg-white border border-blue-500 rounded px-3 py-1.5 focus:outline-none"
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

            {/* Linked Issues */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Linked Issues ({issue.links.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddLink(!showAddLink)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Link Issue
                </button>
              </div>

              {showAddLink && (
                <form
                  onSubmit={handleAddLinkSubmit}
                  className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md"
                >
                  <select
                    value={linkType}
                    onChange={(e) => setLinkType(e.target.value)}
                    aria-label="Link relationship"
                    className="text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                  >
                    <option value="BLOCKS">blocks</option>
                    <option value="IS_BLOCKED_BY">is blocked by</option>
                    <option value="RELATES_TO">relates to</option>
                    <option value="DUPLICATES">duplicates</option>
                  </select>
                  <select
                    value={linkTargetId}
                    onChange={(e) => setLinkTargetId(e.target.value)}
                    aria-label="Target issue"
                    className="flex-1 text-xs bg-white border border-slate-300 rounded px-2 py-1.5"
                  >
                    <option value="">Select issue...</option>
                    {allIssues
                      .filter((i) => i.id !== issue.id)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.key} — {i.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded"
                  >
                    Link
                  </button>
                </form>
              )}

              {issue.links.length > 0 && (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {issue.links.map((lnk) => {
                    const target = issueMap[lnk.targetIssueId];
                    if (!target) return null;
                    return (
                      <div
                        key={lnk.id}
                        className="px-3 py-2 bg-white flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-slate-500 font-medium">
                            {lnk.type.replace(/_/g, ' ').toLowerCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectIssue(target.id)}
                            className="font-mono font-semibold text-blue-700 hover:underline"
                          >
                            {target.key}
                          </button>
                          <span className="text-slate-800 truncate">
                            {target.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(lnk.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Activity Stream: Comments, Work Log, Audit History */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveActivityTab('COMMENTS')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                    activeActivityTab === 'COMMENTS'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments ({issue.comments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActivityTab('WORKLOG')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                    activeActivityTab === 'WORKLOG'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Work Log ({issue.workLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActivityTab('HISTORY')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                    activeActivityTab === 'HISTORY'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Audit Trail ({issue.history.length})
                </button>
              </div>

              {activeActivityTab === 'COMMENTS' && (
                <div className="space-y-4">
                  <form onSubmit={handleCommentSubmit} className="space-y-2">
                    <textarea
                      rows={2}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Add an engineering update or @mention..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-md p-2.5 focus:outline-none focus:border-blue-600"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Post Comment
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {issue.comments.map((c) => {
                      const author = userMap[c.authorId];
                      return (
                        <div
                          key={c.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <UserAvatar user={author} size="xs" showName />
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatShortDate(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 pl-7">
                            {c.body}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeActivityTab === 'WORKLOG' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleWorkLogSubmit}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md"
                  >
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      required
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                      placeholder="Hours (e.g. 4)"
                      className="text-xs font-mono bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={logComment}
                      onChange={(e) => setLogComment(e.target.value)}
                      placeholder="Work description..."
                      className="sm:col-span-2 text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Log Time
                    </button>
                  </form>

                  <div className="space-y-2">
                    {issue.workLogs.map((wl) => {
                      const author = userMap[wl.authorId];
                      return (
                        <div
                          key={wl.id}
                          className="p-2.5 bg-white border border-slate-200 rounded-md flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar user={author} size="xs" showName />
                            <span className="text-slate-600">— {wl.comment}</span>
                          </div>
                          <span className="font-mono font-bold text-blue-700">
                            +{wl.hoursSpent}h
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeActivityTab === 'HISTORY' && (
                <div className="space-y-2">
                  {issue.history.length === 0 ? (
                    <div className="text-xs text-slate-400 py-4">
                      No field transitions recorded yet.
                    </div>
                  ) : (
                    issue.history.map((h) => {
                      const actor = userMap[h.actorId];
                      return (
                        <div
                          key={h.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar user={actor} size="xs" showName />
                            <span className="text-slate-600">
                              changed <strong>{h.field}</strong> from{' '}
                              <code className="font-mono text-slate-500">
                                {h.oldValue}
                              </code>{' '}
                              to{' '}
                              <code className="font-mono font-semibold text-blue-700">
                                {h.newValue}
                              </code>
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
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

          {/* RIGHT PANE: Status, Assignee, Priority, Sprint, Epic, Time Tracking */}
          <div className="lg:col-span-5 p-6 bg-slate-50/60 space-y-5 text-xs">
            {/* Workflow Status Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Workflow Status
              </label>
              <select
                value={issue.status}
                onChange={(e) =>
                  onUpdateIssue(issue.id, {
                    status: e.target.value,
                  })
                }
                aria-label="Workflow status"
                className={`w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-md shadow-2xs focus:outline-none focus:border-blue-600 ${
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

            {/* Metadata Fields Table */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                Details & People
              </div>

              {/* Assignee */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Assignee</span>
                <div className="col-span-2">
                  <select
                    value={issue.assigneeId || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        assigneeId: e.target.value || null,
                      })
                    }
                    aria-label="Assignee"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 font-medium"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.initials})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reporter */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Reporter</span>
                <div className="col-span-2">
                  <UserAvatar
                    user={userMap[issue.reporterId]}
                    size="xs"
                    showName
                  />
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
                        priority: e.target.value,
                      })
                    }
                    aria-label="Priority"
                    className={`w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-semibold ${
                      PRIORITY_CONFIG[issue.priority].textClass
                    }`}
                  >
                    <option value={IssuePriority.HIGHEST}>Highest</option>
                    <option value={IssuePriority.HIGH}>High</option>
                    <option value={IssuePriority.MEDIUM}>Medium</option>
                    <option value={IssuePriority.LOW}>Low</option>
                    <option value={IssuePriority.LOWEST}>Lowest</option>
                  </select>
                </div>
              </div>

              {/* Sprint */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Sprint</span>
                <div className="col-span-2">
                  <select
                    value={issue.sprintId || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        sprintId: e.target.value || null,
                      })
                    }
                    aria-label="Sprint"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900"
                  >
                    <option value="">Backlog</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parent Epic */}
              {issue.type !== IssueType.EPIC && (
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-slate-500 font-medium">Parent Epic</span>
                  <div className="col-span-2">
                    <select
                      value={issue.epicId || ''}
                      onChange={(e) =>
                        onUpdateIssue(issue.id, {
                          epicId: e.target.value || null,
                        })
                      }
                      aria-label="Parent Epic"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-purple-700 font-medium"
                    >
                      <option value="">None</option>
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
                    value={issue.storyPoints}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        storyPoints: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    aria-label="Story points"
                    className="w-24 px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded text-slate-900"
                  />
                </div>
              </div>

              {/* Component */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Component</span>
                <div className="col-span-2">
                  <select
                    value={issue.componentId || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        componentId: e.target.value || null,
                      })
                    }
                    aria-label="Component"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900"
                  >
                    <option value="">None</option>
                    {components.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fix Version */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Fix Version</span>
                <div className="col-span-2">
                  <select
                    value={issue.fixVersionId || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        fixVersionId: e.target.value || null,
                      })
                    }
                    aria-label="Fix Version"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900"
                  >
                    <option value="">None</option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due Date */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Due Date</span>
                <div className="col-span-2">
                  <input
                    type="date"
                    value={issue.dueDate || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { dueDate: e.target.value })
                    }
                    aria-label="Due Date"
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded text-slate-900"
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Labels</span>
                  <button
                    type="button"
                    onClick={() => setShowAddLabel(!showAddLabel)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700"
                    >
                      {lbl}
                      <button
                        type="button"
                        onClick={() => handleRemoveLabel(lbl)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {showAddLabel && (
                  <form
                    onSubmit={handleAddLabelSubmit}
                    className="flex items-center gap-1.5 pt-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="label-name"
                      className="flex-1 px-2 py-1 text-xs bg-white border border-blue-500 rounded"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Time Tracking Bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Time Tracking</span>
                <span className="font-mono text-slate-500">
                  {issue.timeSpentHours}h logged / {issue.remainingEstimateHours}h
                  rem
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${timePct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Original Estimate: {issue.originalEstimateHours}h</span>
                <span>{timePct}%</span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-[11px] text-slate-400 space-y-0.5 px-1 font-mono">
              <div>Created: {formatShortDate(issue.createdAt)}</div>
              <div>Updated: {formatShortDate(issue.updatedAt)}</div>
              <div>Issue Type: {TYPE_CONFIG[issue.type].label}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
