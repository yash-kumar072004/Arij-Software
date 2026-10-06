import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Bug,
  CheckCircle2,
  CheckSquare,
  ChevronUp,
  Circle,
  Clock,
  Equal,
  FlaskConical,
  GitBranch,
  Layers,
  Zap,
} from 'lucide-react';
import { IssuePriority, IssueStatus, IssueType, User } from '../types/jira';
import avatarLeadEngineer from '../assets/images/avatar_lead_engineer_1791265138403.jpg';
import avatarProductManager from '../assets/images/avatar_product_manager_1791265343431.jpg';
import avatarSystemsArchitect from '../assets/images/avatar_systems_architect_1791265357159.jpg';
import avatarQaLead from '../assets/images/avatar_qa_lead_1791265374721.jpg';

const BUILTIN_AVATARS: Record<string, string> = {
  'usr-1': avatarLeadEngineer,
  'usr-2': avatarProductManager,
  'usr-3': avatarSystemsArchitect,
  'usr-4': avatarQaLead,
};

export const STATUS_ORDER: IssueStatus[] = [
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.IN_REVIEW,
  IssueStatus.QA,
  IssueStatus.DONE,
];

export const STATUS_CONFIG: Record<
  IssueStatus,
  {
    label: string;
    shortLabel: string;
    textClass: string;
    dotClass: string;
    borderClass: string;
    category: 'todo' | 'in_progress' | 'done';
  }
> = {
  [IssueStatus.TODO]: {
    label: 'To Do',
    shortLabel: 'To Do',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    borderClass: 'border-slate-300',
    category: 'todo',
  },
  [IssueStatus.IN_PROGRESS]: {
    label: 'In Progress',
    shortLabel: 'In Progress',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-600',
    borderClass: 'border-blue-600',
    category: 'in_progress',
  },
  [IssueStatus.IN_REVIEW]: {
    label: 'In Review',
    shortLabel: 'In Review',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-600',
    borderClass: 'border-amber-600',
    category: 'in_progress',
  },
  [IssueStatus.QA]: {
    label: 'QA Testing',
    shortLabel: 'QA',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    borderClass: 'border-amber-500',
    category: 'in_progress',
  },
  [IssueStatus.DONE]: {
    label: 'Done',
    shortLabel: 'Done',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-600',
    borderClass: 'border-emerald-600',
    category: 'done',
  },
};

export const PRIORITY_CONFIG: Record<
  IssuePriority,
  {
    label: string;
    rank: number;
    textClass: string;
  }
> = {
  [IssuePriority.HIGHEST]: {
    label: 'Highest',
    rank: 5,
    textClass: 'text-red-600',
  },
  [IssuePriority.HIGH]: {
    label: 'High',
    rank: 4,
    textClass: 'text-red-600',
  },
  [IssuePriority.MEDIUM]: {
    label: 'Medium',
    rank: 3,
    textClass: 'text-amber-600',
  },
  [IssuePriority.LOW]: {
    label: 'Low',
    rank: 2,
    textClass: 'text-blue-600',
  },
  [IssuePriority.LOWEST]: {
    label: 'Lowest',
    rank: 1,
    textClass: 'text-slate-500',
  },
};

export const TYPE_CONFIG: Record<
  IssueType,
  {
    label: string;
    textClass: string;
  }
> = {
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

export function IssueTypeIcon({
  type,
  className = 'w-4 h-4',
}: {
  type: IssueType;
  className?: string;
}) {
  switch (type) {
    case IssueType.EPIC:
      return <Zap className={`${className} text-purple-600 shrink-0`} />;
    case IssueType.STORY:
      return <BookOpen className={`${className} text-emerald-600 shrink-0`} />;
    case IssueType.BUG:
      return <Bug className={`${className} text-red-600 shrink-0`} />;
    case IssueType.SUBTASK:
      return <GitBranch className={`${className} text-slate-500 shrink-0`} />;
    case IssueType.TASK:
    default:
      return <CheckSquare className={`${className} text-blue-600 shrink-0`} />;
  }
}

export function PriorityIcon({
  priority,
  className = 'w-3.5 h-3.5',
}: {
  priority: IssuePriority;
  className?: string;
}) {
  switch (priority) {
    case IssuePriority.HIGHEST:
      return <ChevronUp className={`${className} text-red-600 stroke-[2.75] shrink-0`} />;
    case IssuePriority.HIGH:
      return <ArrowUp className={`${className} text-red-600 shrink-0`} />;
    case IssuePriority.MEDIUM:
      return <Equal className={`${className} text-amber-600 shrink-0`} />;
    case IssuePriority.LOW:
      return <ArrowDown className={`${className} text-blue-600 shrink-0`} />;
    case IssuePriority.LOWEST:
    default:
      return <ArrowDown className={`${className} text-slate-400 shrink-0`} />;
  }
}

export function StatusIcon({
  status,
  className = 'w-3.5 h-3.5',
}: {
  status: IssueStatus;
  className?: string;
}) {
  switch (status) {
    case IssueStatus.DONE:
      return <CheckCircle2 className={`${className} text-emerald-600 shrink-0`} />;
    case IssueStatus.IN_PROGRESS:
      return <Clock className={`${className} text-blue-600 shrink-0`} />;
    case IssueStatus.IN_REVIEW:
      return <AlertCircle className={`${className} text-amber-600 shrink-0`} />;
    case IssueStatus.QA:
      return <FlaskConical className={`${className} text-amber-600 shrink-0`} />;
    case IssueStatus.TODO:
    default:
      return <Circle className={`${className} text-slate-400 shrink-0`} />;
  }
}

export function UserAvatar({
  user,
  size = 'sm',
  className = '',
}: {
  user?: User | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const sizeMap = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  if (!user) {
    return (
      <div
        className={`${sizeMap[size]} rounded-full bg-slate-100 border border-slate-300 text-slate-500 flex items-center justify-center font-medium shrink-0 ${className}`}
        title="Unassigned"
      >
        ?
      </div>
    );
  }

  const resolvedUrl = BUILTIN_AVATARS[user.id] || user.avatarUrl;

  if (imgFailed || !resolvedUrl) {
    return (
      <div
        className={`${sizeMap[size]} rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold tracking-tight shrink-0 ${className}`}
        title={`${user.name} (${user.role})`}
      >
        {user.initials}
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size]} rounded-full overflow-hidden bg-slate-200 border border-slate-200 shrink-0 ${className}`}
      title={`${user.name} (${user.role})`}
    >
      <img
        src={resolvedUrl}
        alt={user.name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function isOverdue(dueDate?: string, status?: IssueStatus): boolean {
  if (!dueDate || status === IssueStatus.DONE) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}
