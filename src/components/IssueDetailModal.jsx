import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  Copy,
  Download,
  Eye,
  GitBranch,
  History,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import {
  formatShortDate,
  IssueTypeIcon,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  STATUS_ORDER,
  TYPE_CONFIG,
  UserAvatar,
} from './ArijPrimitives.jsx';
import { parseStructuredStoryFromExtractedText } from '../utils/storyTextParser.js';

const renderInlineMarkdown = (line) => {
  const parts = String(line || '').split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-blue-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const renderMarkdownDescription = (text) => {
  if (!text || !String(text).trim()) {
    return (
      <p className="text-xs text-slate-400 italic">
        No description provided. Click &ldquo;Edit Description&rdquo; to add Markdown notes or specifications.
      </p>
    );
  }
  const lines = String(text).split('\n');
  return (
    <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1.5" />;
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-slate-900 pt-1">
              {renderInlineMarkdown(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-slate-900 pt-1.5">
              {renderInlineMarkdown(line.slice(3))}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={idx} className="text-base font-bold text-slate-900 pt-2">
              {renderInlineMarkdown(line.slice(2))}
            </h2>
          );
        }
        if (/^[-*•]\s+/.test(line)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-slate-400 select-none">•</span>
              <span>{renderInlineMarkdown(line.replace(/^[-*•]\s+/, ''))}</span>
            </div>
          );
        }
        if (/^\d+[.)]\s+/.test(line)) {
          const numMatch = line.match(/^(\d+[.)])\s+(.*)$/);
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="font-mono text-slate-500 font-semibold select-none">
                {numMatch ? numMatch[1] : '1.'}
              </span>
              <span>{renderInlineMarkdown(numMatch ? numMatch[2] : line)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineMarkdown(rawLine)}</p>;
      })}
    </div>
  );
};

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

  // Attachments state (Phase 3.3: file upload, 10MB size limit, MIME validation)
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [showWatchersMenu, setShowWatchersMenu] = useState(false);

  const ALLOWED_ATTACHMENT_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
  ];
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

  // Emoji reactions per comment
  const [commentReactions, setCommentReactions] = useState({});

  const isWatching = (issue.watcherIds || []).includes(
    users[0]?.id || 'usr-1'
  );

  const handleToggleWatch = (targetUserId) => {
    const uid =
      typeof targetUserId === 'string' ? targetUserId : users[0]?.id || 'usr-1';
    const current = issue.watcherIds || [];
    const next = current.includes(uid)
      ? current.filter((id) => id !== uid)
      : [...current, uid];
    onUpdateIssue(issue.id, { watcherIds: next });
    fetch(`/api/issues/${encodeURIComponent(issue.id)}/watchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid }),
    }).catch(() => {});
  };

  const handleFileUploadChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentError('');

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError(
        `File "${file.name}" exceeds the 10 MB size limit (${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
      e.target.value = '';
      return;
    }

    const inferredMime =
      file.type ||
      (file.name.endsWith('.pdf')
        ? 'application/pdf'
        : file.name.endsWith('.png')
        ? 'image/png'
        : file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')
        ? 'image/jpeg'
        : file.name.endsWith('.json')
        ? 'application/json'
        : file.name.endsWith('.csv')
        ? 'text/csv'
        : file.name.endsWith('.zip')
        ? 'application/zip'
        : 'text/plain');

    if (!ALLOWED_ATTACHMENT_TYPES.includes(inferredMime)) {
      setAttachmentError(
        `Unsupported MIME type "${inferredMime}". Allowed: PDF, PNG, JPEG, WEBP, TXT, CSV, JSON, ZIP.`
      );
      e.target.value = '';
      return;
    }

    const sizeLabel =
      file.size >= 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

    const newAtt = {
      id: `att-${Date.now()}`,
      name: file.name,
      mimeType: inferredMime,
      sizeBytes: file.size,
      size: sizeLabel,
      uploadedAt: new Date().toISOString().slice(0, 10),
    };

    const current = issue.attachments || [];
    onUpdateIssue(issue.id, {
      attachments: [...current, newAtt],
    });

    fetch(`/api/issues/${encodeURIComponent(issue.id)}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: inferredMime,
        sizeBytes: Math.max(1, file.size),
      }),
    }).catch(() => {});

    e.target.value = '';
    setShowAddAttachment(false);
  };

  const handleAddAttachmentSubmit = (e) => {
    e.preventDefault();
    setAttachmentError('');
    const cleanName = newAttachmentName.trim();
    if (!cleanName) return;

    const ext = cleanName.split('.').pop()?.toLowerCase() || '';
    const mimeMap = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      txt: 'text/plain',
      log: 'text/plain',
      md: 'text/plain',
      csv: 'text/csv',
      json: 'application/json',
      zip: 'application/zip',
    };
    const mimeType = mimeMap[ext];
    if (!mimeType) {
      setAttachmentError(
        'Invalid file extension. Allowed extensions: .pdf, .png, .jpg, .webp, .txt, .csv, .json, .zip (max 10 MB).'
      );
      return;
    }

    const current = issue.attachments || [];
    onUpdateIssue(issue.id, {
      attachments: [
        ...current,
        {
          id: `att-${Date.now()}`,
          name: cleanName,
          mimeType,
          sizeBytes: 430080,
          size: '420 KB',
          uploadedAt: new Date().toISOString().slice(0, 10),
        },
      ],
    });
    setNewAttachmentName('');
    setShowAddAttachment(false);
  };

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
    const targetIssue = allIssues.find(
      (i) => i.id === linkTargetId || i.key === linkTargetId
    );
    const newLink = {
      id: `lnk-${Date.now()}`,
      type: linkType,
      targetIssueId: targetIssue ? targetIssue.id : linkTargetId,
      targetIssueKey: targetIssue ? targetIssue.key : linkTargetId,
    };
    onUpdateIssue(issue.id, { links: [...issue.links, newLink] });
    if (targetIssue) {
      fetch(`/api/issues/${encodeURIComponent(issue.id)}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkType:
            linkType === 'BLOCKS' ||
            linkType === 'IS_BLOCKED_BY' ||
            linkType === 'RELATES_TO' ||
            linkType === 'DUPLICATES'
              ? linkType
              : 'RELATES_TO',
          targetIssueKey: targetIssue.key,
        }),
      }).catch(() => {});
    }
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

  // Dynamically parse structured sections only if present on the issue or in its description (zero hardcoded templates)
  const parsedFromDescription = useMemo(() => {
    if (
      issue.description &&
      /(?:User\s+Story|Scope\s*\/?\s*Description|Acceptance\s+Criteria|Scenario\s+\d+\s*:|Test\s+Cases|Definition\s+of\s+Done)/i.test(
        issue.description
      )
    ) {
      return parseStructuredStoryFromExtractedText(
        issue.description,
        issue.title || ''
      );
    }
    return null;
  }, [issue.description, issue.title]);

  const structuredUserStory =
    issue.userStory && String(issue.userStory).trim()
      ? String(issue.userStory).trim()
      : parsedFromDescription?.userStory || '';

  const structuredScopeDescription =
    issue.scopeDescription && String(issue.scopeDescription).trim()
      ? String(issue.scopeDescription).trim()
      : parsedFromDescription?.scopeDescription || '';

  const structuredAcceptanceCriteria =
    Array.isArray(issue.acceptanceCriteria) &&
    issue.acceptanceCriteria.length > 0
      ? issue.acceptanceCriteria
      : parsedFromDescription?.acceptanceCriteria || [];

  const structuredTestCases =
    Array.isArray(issue.testCases) && issue.testCases.length > 0
      ? issue.testCases
      : parsedFromDescription?.testCases || [];

  const structuredDefinitionOfDone =
    Array.isArray(issue.definitionOfDone) && issue.definitionOfDone.length > 0
      ? issue.definitionOfDone
      : parsedFromDescription?.definitionOfDone || [];

  const hasStructuredStoryFields = Boolean(
    structuredUserStory ||
      structuredScopeDescription ||
      structuredAcceptanceCriteria.length > 0 ||
      structuredTestCases.length > 0 ||
      structuredDefinitionOfDone.length > 0
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
        <div className="px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">
              {issue.projectName || 'Kawach Product'}
            </span>
            {(issue.parentKey || issue.epicId) && (
              <>
                <span className="text-slate-400">/</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-semibold text-[11px]">
                  {issue.parentKey ||
                    epics.find((ep) => ep.id === issue.epicId)?.key ||
                    'KP-5831'}
                  <span className="font-sans font-medium text-purple-900">
                    {issue.parentTitle ||
                      epics.find((ep) => ep.id === issue.epicId)?.title ||
                      'Automation Test Cases'}
                  </span>
                  <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] uppercase">
                    {(issue.parentStatus || 'IN PROGRESS').replace(/_/g, ' ')}
                  </span>
                </span>
              </>
            )}
            <span className="text-slate-400">/</span>
            <select
              value={issue.type}
              onChange={(e) =>
                onUpdateIssue(issue.id, { type: e.target.value })
              }
              aria-label="Issue Type"
              className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-700"
            >
              <option value={IssueType.INITIATIVE}>Initiative</option>
              <option value={IssueType.EPIC}>Epic</option>
              <option value={IssueType.STORY}>Story</option>
              <option value={IssueType.FEATURE}>Feature</option>
              <option value={IssueType.TASK}>Task</option>
              <option value={IssueType.IMPROVEMENT}>Improvement</option>
              <option value={IssueType.BUG}>Bug</option>
              <option value={IssueType.INCIDENT}>Incident</option>
              <option value={IssueType.PROBLEM}>Problem</option>
              <option value={IssueType.CHANGE}>Change</option>
              <option value={IssueType.REQUEST}>Request</option>
              <option value={IssueType.SUBTASK}>Sub-task</option>
            </select>
            <IssueTypeIcon type={issue.type} className="w-4 h-4" />
            <span className="font-mono tabular-nums text-sm font-bold text-blue-700">
              {issue.key}
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <div className="inline-flex items-center rounded border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleToggleWatch()}
                  className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isWatching
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Watch / Unwatch issue"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isWatching ? 'Watching' : 'Watch'} (
                  {(issue.watcherIds || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowWatchersMenu((v) => !v)}
                  className="px-1.5 py-1.5 text-[10px] text-slate-500 hover:bg-slate-100 border-l border-slate-200"
                  title="Manage Issue Watchers"
                >
                  ▾
                </button>
              </div>

              {showWatchersMenu && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-lg shadow-xl z-30 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                    <span>Issue Watchers ({(issue.watcherIds || []).length})</span>
                    <button
                      type="button"
                      onClick={() => setShowWatchersMenu(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {users.map((u) => {
                      const watching = (issue.watcherIds || []).includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleWatch(u.id)}
                          className="w-full px-2 py-1.5 rounded hover:bg-slate-50 flex items-center justify-between text-left"
                        >
                          <UserAvatar user={u} size="xs" showName />
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              watching
                                ? 'bg-blue-100 text-blue-700 font-bold'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {watching ? 'Watching' : '+ Watch'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const lines = [
                  `# [${issue.key}] ${issue.title}`,
                  ``,
                  `## Story Title`,
                  `${issue.storyTitle || issue.title}`,
                  ``,
                  `## User Story`,
                  `${structuredUserStory || issue.description || ''}`,
                  ``,
                  `## Scope / Description`,
                  `${structuredScopeDescription || issue.description || ''}`,
                  ``,
                  `## Acceptance Criteria`,
                  ...(structuredAcceptanceCriteria.length > 0
                    ? structuredAcceptanceCriteria.flatMap((sc) => [
                        `### ${sc.scenarioTitle}`,
                        ...(sc.steps || []).map((st) => `- ${st}`),
                        ``,
                      ])
                    : ['- Verified per story specification']),
                  `## Test Cases to Automate`,
                  ...(structuredTestCases.length > 0
                    ? structuredTestCases.map((tc, idx) => `${idx + 1}. ${tc}`)
                    : ['1. Verify primary functional flow']),
                  ``,
                  `## Definition of Done (DoD)`,
                  ...(structuredDefinitionOfDone.length > 0
                    ? structuredDefinitionOfDone.map((d) => `- [x] ${d}`)
                    : ['- [x] Code reviewed and merged']),
                  ``,
                  `## Subtasks (${(issue.subtasks || []).filter((s) => s.completed).length}/${(issue.subtasks || []).length})`,
                  ...(issue.subtasks || []).map(
                    (s, idx) =>
                      `- [${s.completed ? 'x' : ' '}] ${s.key || `${issue.key}-${idx + 1}`}: ${s.title}`
                  ),
                ];
                const blob = new Blob([lines.join('\n')], {
                  type: 'text/markdown;charset=utf-8;',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${issue.key}-Story-Spec.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded flex items-center gap-1.5 transition-colors"
              title="Export structured Jira / Kawach Story Specification (.md)"
            >
              <Download className="w-3.5 h-3.5" />
              Export Spec
            </button>
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

            {/* Editable Description + Structured Jira Story Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description
                </div>
                {!editingDesc && (
                  <button
                    type="button"
                    onClick={() => {
                      setDescDraft(issue.description);
                      setEditingDesc(true);
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Edit Description
                  </button>
                )}
              </div>

              {editingDesc ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-t-md text-[11px] font-mono text-slate-700">
                    <span className="text-slate-400 font-sans mr-1">Markdown:</span>
                    <button
                      type="button"
                      onClick={() => setDescDraft((d) => `${d}\n## Section Heading\n`)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    >
                      ## Heading
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescDraft((d) => `${d} **bold** `)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50 font-bold"
                    >
                      **Bold**
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescDraft((d) => `${d} \`code\` `)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    >
                      `Code`
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescDraft((d) => `${d}\n- Bullet item`)}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-50"
                    >
                      • List
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    className="w-full text-sm font-mono text-slate-800 bg-white border border-blue-600 rounded-b-md p-3 focus:outline-none"
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
                <div className="space-y-4 bg-white border border-slate-200 rounded-lg p-4 text-slate-800">
                  {hasStructuredStoryFields ? (
                    <>
                      {/* Story Title */}
                      <div>
                        <div className="text-xs font-bold text-slate-900 mb-1">
                          Story Title
                        </div>
                        <div className="text-xs text-slate-700">{issue.title}</div>
                      </div>

                      {/* User Story */}
                      {structuredUserStory && (
                        <div>
                          <div className="text-xs font-bold text-slate-900 mb-1">
                            User Story
                          </div>
                          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded p-3">
                            {structuredUserStory}
                          </div>
                        </div>
                      )}

                      {/* Scope / Description */}
                      {structuredScopeDescription && (
                        <div>
                          <div className="text-xs font-bold text-slate-900 mb-1">
                            Scope / Description
                          </div>
                          <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {structuredScopeDescription}
                          </div>
                        </div>
                      )}

                      {/* Acceptance Criteria Scenarios */}
                      {Array.isArray(structuredAcceptanceCriteria) &&
                        structuredAcceptanceCriteria.length > 0 && (
                          <div className="space-y-2.5">
                            <div className="text-sm font-bold text-slate-900">
                              Acceptance Criteria
                            </div>
                            {structuredAcceptanceCriteria.map((sc, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5"
                              >
                                <div className="text-xs font-bold text-slate-900">
                                  {sc.scenarioTitle}
                                </div>
                                <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                                  {(sc.steps || []).map((step, stIdx) => {
                                    const bddMatch = String(step).match(
                                      /^(Given|When|Then|And|But)\b(.*)$/i
                                    );
                                    return (
                                      <li key={stIdx}>
                                        {bddMatch ? (
                                          <>
                                            <strong className="text-slate-900">
                                              {bddMatch[1]}
                                            </strong>
                                            {bddMatch[2]}
                                          </>
                                        ) : (
                                          step
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}

                      {/* Test Cases to Automate */}
                      {Array.isArray(structuredTestCases) &&
                        structuredTestCases.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-sm font-bold text-slate-900">
                              Test Cases to Automate
                            </div>
                            <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-700">
                              {structuredTestCases.map((tc, tcIdx) => (
                                <li key={tcIdx}>{tc}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                      {/* Definition of Done (DoD) */}
                      {Array.isArray(structuredDefinitionOfDone) &&
                        structuredDefinitionOfDone.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-sm font-bold text-slate-900">
                              Definition of Done (DoD)
                            </div>
                            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                              {structuredDefinitionOfDone.map((dod, dIdx) => (
                                <li key={dIdx}>{dod}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </>
                  ) : (
                    renderMarkdownDescription(issue.description)
                  )}
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
                    <option value="IS_DUPLICATED_BY">is duplicated by</option>
                    <option value="DEPENDS_ON">depends on</option>
                    <option value="IS_DEPENDED_ON_BY">is depended on by</option>
                    <option value="CAUSES">causes</option>
                    <option value="CAUSED_BY">caused by</option>
                    <option value="PARENT_OF">parent of</option>
                    <option value="CHILD_OF">child of</option>
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
                    const target =
                      issueMap[lnk.targetIssueId] ||
                      allIssues.find(
                        (i) =>
                          i.key &&
                          lnk.targetIssueKey &&
                          i.key.toUpperCase() ===
                            String(lnk.targetIssueKey).toUpperCase()
                      );
                    if (!target) return null;
                    const isBlockingWarning =
                      (lnk.type === 'IS_BLOCKED_BY' ||
                        lnk.type === 'DEPENDS_ON') &&
                      target.status !== IssueStatus.DONE;
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
                          {isBlockingWarning && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 shrink-0">
                              <AlertTriangle className="w-3 h-3" />
                              Blocker Unresolved
                            </span>
                          )}
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

            {/* Attachments & Files (Phase 3.3: File upload, 10MB size limit, MIME validation) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Attachments &amp; Files ({(issue.attachments || []).length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAttachmentError('');
                    setShowAddAttachment(!showAddAttachment);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Attach File / Spec
                </button>
              </div>

              {showAddAttachment && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-slate-300 hover:border-blue-500 text-xs font-semibold text-slate-700 shadow-2xs">
                      <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                      <span>Upload File from Device (Max 10 MB)</span>
                      <input
                        type="file"
                        onChange={handleFileUploadChange}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.json,.zip"
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Allowed: PDF, PNG, JPG, WEBP, TXT, CSV, JSON, ZIP
                    </span>
                  </div>

                  <form
                    onSubmit={handleAddAttachmentSubmit}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newAttachmentName}
                      onChange={(e) => setNewAttachmentName(e.target.value)}
                      placeholder="Or enter file name (e.g. architecture-diagram.png or log-trace.json)"
                      className="flex-1 text-xs bg-white border border-blue-500 rounded px-3 py-1.5"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded"
                    >
                      Attach
                    </button>
                  </form>

                  {attachmentError && (
                    <div className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
                      {attachmentError}
                    </div>
                  )}
                </div>
              )}

              {(issue.attachments || []).length > 0 && (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  {(issue.attachments || []).map((att) => (
                    <div
                      key={att.id}
                      className="px-3 py-2 bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">
                          {att.name}
                        </span>
                        {att.mimeType && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-[10px]">
                            {att.mimeType}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {att.size} · {att.uploadedAt}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateIssue(issue.id, {
                            attachments: (issue.attachments || []).filter(
                              (x) => x.id !== att.id
                            ),
                          })
                        }
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
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
                <button
                  type="button"
                  onClick={() => setActiveActivityTab('DEV_CICD')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                    activeActivityTab === 'DEV_CICD'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  Dev &amp; CI/CD
                </button>
              </div>

              {activeActivityTab === 'COMMENTS' && (
                <div className="space-y-4">
                  <form onSubmit={handleCommentSubmit} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span>Quick @mention:</span>
                      {users.slice(0, 4).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() =>
                            setCommentBody((prev) =>
                              `${prev} @${u.name.split(' ')[0]} `.trimStart()
                            )
                          }
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 font-mono"
                        >
                          @{u.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
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
                      const rx = commentReactions[c.id] || {};
                      return (
                        <div
                          key={c.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <UserAvatar user={author} size="xs" showName />
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatShortDate(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 pl-7 leading-relaxed">
                            {String(c.body || '')
                              .split(/(@[a-zA-Z0-9._-]+)/g)
                              .map((part, pIdx) =>
                                part.startsWith('@') ? (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded bg-blue-100 text-blue-800 font-mono font-semibold text-[11px]"
                                  >
                                    {part}
                                  </span>
                                ) : (
                                  part
                                )
                              )}
                          </p>
                          <div className="pl-7 flex items-center gap-1.5 pt-1">
                            {['👍', '🚀', '❤️', '👀'].map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                  setCommentReactions((prev) => ({
                                    ...prev,
                                    [c.id]: {
                                      ...(prev[c.id] || {}),
                                      [emoji]: ((prev[c.id] || {})[emoji] || 0) + 1,
                                    },
                                  }))
                                }
                                className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded hover:bg-slate-100"
                              >
                                {emoji} {rx[emoji] ? rx[emoji] : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeActivityTab === 'DEV_CICD' && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Git Branch, Pull Request &amp; Deployment Telemetry
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                      CI Build Passed
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-2">
                    git checkout -b feature/{issue.key.toLowerCase()}-impl
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Pull Request #{issue.order + 30} · Merged to main</span>
                    <span className="font-mono text-blue-700">
                      Environment: Production (ap-south-1)
                    </span>
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

              {/* Reporter (Inline Editable) */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Reporter</span>
                <div className="col-span-2">
                  <select
                    value={issue.reporterId || ''}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        reporterId: e.target.value || users[0]?.id,
                      })
                    }
                    aria-label="Reporter"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900 font-medium"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.initials})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reviewers & Approvers (Matches Jira PDF Details Panel) */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Reviewers</span>
                <div className="col-span-2 text-slate-700">
                  {Array.isArray(issue.reviewers) &&
                  issue.reviewers.length > 0 ? (
                    issue.reviewers.join(', ')
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Approvers</span>
                <div className="col-span-2 text-slate-700">
                  {Array.isArray(issue.approvers) &&
                  issue.approvers.length > 0 ? (
                    issue.approvers.join(', ')
                  ) : (
                    <span className="text-slate-400">None</span>
                  )}
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
                    <option value="">None</option>
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
                  <span className="text-slate-500 font-medium">Parent</span>
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
                <span className="text-slate-500 font-medium">
                  Story point estimate
                </span>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={issue.storyPoints || ''}
                    placeholder="None"
                    onChange={(e) =>
                      onUpdateIssue(issue.id, {
                        storyPoints: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    aria-label="Story points"
                    className="w-24 px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Component */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Components</span>
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

              {/* Development */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Development</span>
                <div className="col-span-2 flex flex-wrap items-center gap-2 text-blue-600 font-medium">
                  <button
                    type="button"
                    onClick={() => setActiveActivityTab('DEV_CICD')}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    Create branch
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={() => setActiveActivityTab('DEV_CICD')}
                    className="hover:underline"
                  >
                    Create commit
                  </button>
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

              {/* Start Date & Due Date */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Start Date</span>
                <div className="col-span-2">
                  <input
                    type="date"
                    value={issue.startDate || '2026-10-05'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { startDate: e.target.value })
                    }
                    aria-label="Start Date"
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded text-slate-900"
                  />
                </div>
              </div>

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

              {/* Environment & Custom SLA Field (Section 5) */}
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">Environment</span>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={issue.environment || 'Production · K8s Cluster'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { environment: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-slate-500 font-medium">SLA Tier</span>
                <div className="col-span-2">
                  <select
                    value={issue.slaTier || 'Enterprise P1 (<15m)'}
                    onChange={(e) =>
                      onUpdateIssue(issue.id, { slaTier: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-900"
                  >
                    <option>Enterprise P1 (&lt;15m)</option>
                    <option>Standard P2 (&lt;4h)</option>
                    <option>Internal Engineering</option>
                  </select>
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
                  {issue.labels.length === 0 ? (
                    <span className="text-xs text-slate-400">None</span>
                  ) : (
                    issue.labels.map((lbl) => (
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
                    ))
                  )}
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
            <div className="text-[11px] text-slate-500 space-y-0.5 px-1 font-mono">
              <div>
                Created: {issue.createdAtText || formatShortDate(issue.createdAt)}
              </div>
              <div>
                Updated: {issue.updatedAtText || formatShortDate(issue.updatedAt)}
              </div>
              <div>Issue Type: {TYPE_CONFIG[issue.type].label}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
