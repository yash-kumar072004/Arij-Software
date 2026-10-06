import React from 'react';
import {
  Zap,
  Bookmark,
  CheckSquare,
  Bug,
  GitBranch,
  ChevronsUp,
  ChevronUp,
  Equal,
  ChevronDown,
  ChevronsDown,
  Circle,
  Clock,
  Eye,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { IssuePriority, IssueStatus, IssueType } from '../types/jira.js';

export const STATUS_CONFIG = {
  [IssueStatus.TODO]: {
    label: 'To Do',
    shortLabel: 'TO DO',
    textClass: 'text-slate-600',
    accentBorder: 'border-t-slate-400',
  },
  [IssueStatus.IN_PROGRESS]: {
    label: 'In Progress',
    shortLabel: 'IN PROGRESS',
    textClass: 'text-blue-700',
    accentBorder: 'border-t-blue-600',
  },
  [IssueStatus.IN_REVIEW]: {
    label: 'In Review',
    shortLabel: 'IN REVIEW',
    textClass: 'text-indigo-700',
    accentBorder: 'border-t-indigo-600',
  },
  [IssueStatus.QA]: {
    label: 'QA Testing',
    shortLabel: 'QA TESTING',
    textClass: 'text-amber-700',
    accentBorder: 'border-t-amber-500',
  },
  [IssueStatus.DONE]: {
    label: 'Done',
    shortLabel: 'DONE',
    textClass: 'text-emerald-700',
    accentBorder: 'border-t-emerald-600',
  },
};

export const STATUS_ORDER = [
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.IN_REVIEW,
  IssueStatus.QA,
  IssueStatus.DONE,
];

export const PRIORITY_CONFIG = {
  [IssuePriority.HIGHEST]: {
    label: 'Highest',
    textClass: 'text-red-600',
    weight: 5,
  },
  [IssuePriority.HIGH]: {
    label: 'High',
    textClass: 'text-orange-600',
    weight: 4,
  },
  [IssuePriority.MEDIUM]: {
    label: 'Medium',
    textClass: 'text-amber-600',
    weight: 3,
  },
  [IssuePriority.LOW]: {
    label: 'Low',
    textClass: 'text-blue-600',
    weight: 2,
  },
  [IssuePriority.LOWEST]: {
    label: 'Lowest',
    textClass: 'text-slate-500',
    weight: 1,
  },
};

export const TYPE_CONFIG = {
  [IssueType.EPIC]: {
    label: 'Epic',
    textClass: 'text-purple-700',
  },
  [IssueType.STORY]: {
    label: 'Story',
    textClass: 'text-emerald-700',
  },
  [IssueType.TASK]: {
    label: 'Task',
    textClass: 'text-blue-700',
  },
  [IssueType.BUG]: {
    label: 'Bug',
    textClass: 'text-red-600',
  },
  [IssueType.SUBTASK]: {
    label: 'Sub-task',
    textClass: 'text-slate-600',
  },
};

export const IssueTypeIcon = ({ type, className = 'w-4 h-4' }) => {
  switch (type) {
    case IssueType.EPIC:
      return <Zap className={`${className} text-purple-600 shrink-0`} />;
    case IssueType.STORY:
      return <Bookmark className={`${className} text-emerald-600 shrink-0`} />;
    case IssueType.TASK:
      return <CheckSquare className={`${className} text-blue-600 shrink-0`} />;
    case IssueType.BUG:
      return <Bug className={`${className} text-red-600 shrink-0`} />;
    case IssueType.SUBTASK:
      return <GitBranch className={`${className} text-slate-500 shrink-0`} />;
    default:
      return <CheckSquare className={`${className} text-blue-600 shrink-0`} />;
  }
};

export const PriorityIcon = ({ priority, className = 'w-4 h-4' }) => {
  switch (priority) {
    case IssuePriority.HIGHEST:
      return <ChevronsUp className={`${className} text-red-600 shrink-0`} />;
    case IssuePriority.HIGH:
      return <ChevronUp className={`${className} text-orange-600 shrink-0`} />;
    case IssuePriority.MEDIUM:
      return <Equal className={`${className} text-amber-500 shrink-0`} />;
    case IssuePriority.LOW:
      return <ChevronDown className={`${className} text-blue-600 shrink-0`} />;
    case IssuePriority.LOWEST:
      return <ChevronsDown className={`${className} text-slate-400 shrink-0`} />;
    default:
      return <Equal className={`${className} text-amber-500 shrink-0`} />;
  }
};

export const StatusIcon = ({ status, className = 'w-3.5 h-3.5' }) => {
  switch (status) {
    case IssueStatus.TODO:
      return <Circle className={`${className} text-slate-400 shrink-0`} />;
    case IssueStatus.IN_PROGRESS:
      return <Clock className={`${className} text-blue-600 shrink-0`} />;
    case IssueStatus.IN_REVIEW:
      return <Eye className={`${className} text-indigo-600 shrink-0`} />;
    case IssueStatus.QA:
      return <ShieldCheck className={`${className} text-amber-600 shrink-0`} />;
    case IssueStatus.DONE:
      return <CheckCircle2 className={`${className} text-emerald-600 shrink-0`} />;
    default:
      return <Circle className={`${className} text-slate-400 shrink-0`} />;
  }
};

const AVATAR_TONES = [
  'bg-blue-700 text-white',
  'bg-slate-800 text-white',
  'bg-emerald-700 text-white',
  'bg-indigo-700 text-white',
  'bg-amber-700 text-white',
];

export const UserAvatar = ({ user, size = 'sm', showName = false }) => {
  const sizeClasses =
    size === 'xs'
      ? 'w-5 h-5 text-[10px]'
      : size === 'sm'
      ? 'w-6 h-6 text-[11px]'
      : 'w-8 h-8 text-xs';

  if (!user) {
    return (
      <span className="inline-flex items-center gap-1.5" title="Unassigned">
        <span
          className={`${sizeClasses} rounded bg-slate-200 text-slate-500 font-semibold flex items-center justify-center shrink-0`}
        >
          ?
        </span>
        {showName && <span className="text-xs text-slate-500">Unassigned</span>}
      </span>
    );
  }

  const charSum = (user.id || '')
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tone = AVATAR_TONES[charSum % AVATAR_TONES.length];

  return (
    <span className="inline-flex items-center gap-2" title={`${user.name} (${user.role})`}>
      <span
        className={`${sizeClasses} rounded ${tone} font-semibold flex items-center justify-center shrink-0 tracking-tight`}
      >
        {user.initials}
      </span>
      {showName && (
        <span className="text-xs font-medium text-slate-800 truncate">
          {user.name}
        </span>
      )}
    </span>
  );
};

export function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === IssueStatus.DONE) return false;
  const today = new Date('2026-10-06T00:00:00Z').getTime();
  const due = new Date(dueDate).getTime();
  return due < today;
}
