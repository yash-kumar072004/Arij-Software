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
import { IssuePriority, IssueStatus, IssueType } from '../types/arij.js';

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
  [IssueType.INITIATIVE]: {
    label: 'Initiative',
    textClass: 'text-fuchsia-700',
    bgBadge: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
  },
  [IssueType.EPIC]: {
    label: 'Epic',
    textClass: 'text-purple-700',
    bgBadge: 'bg-purple-50 text-purple-700 border border-purple-200',
  },
  [IssueType.STORY]: {
    label: 'Story',
    textClass: 'text-emerald-700',
    bgBadge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  [IssueType.FEATURE]: {
    label: 'Feature',
    textClass: 'text-teal-700',
    bgBadge: 'bg-teal-50 text-teal-700 border border-teal-200',
  },
  [IssueType.TASK]: {
    label: 'Task',
    textClass: 'text-blue-700',
    bgBadge: 'bg-blue-50 text-blue-700 border border-blue-200',
  },
  [IssueType.IMPROVEMENT]: {
    label: 'Improvement',
    textClass: 'text-cyan-700',
    bgBadge: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  },
  [IssueType.BUG]: {
    label: 'Bug',
    textClass: 'text-red-600',
    bgBadge: 'bg-red-50 text-red-700 border border-red-200',
  },
  [IssueType.INCIDENT]: {
    label: 'Incident',
    textClass: 'text-rose-700',
    bgBadge: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  [IssueType.PROBLEM]: {
    label: 'Problem',
    textClass: 'text-orange-700',
    bgBadge: 'bg-orange-50 text-orange-700 border border-orange-200',
  },
  [IssueType.CHANGE]: {
    label: 'Change',
    textClass: 'text-indigo-700',
    bgBadge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  [IssueType.REQUEST]: {
    label: 'Request',
    textClass: 'text-sky-700',
    bgBadge: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  [IssueType.SUBTASK]: {
    label: 'Sub-task',
    textClass: 'text-slate-600',
    bgBadge: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
};

export const ISSUE_TYPE_CONFIG = TYPE_CONFIG;

export const IssueTypeIcon = ({ type, className = 'w-4 h-4' }) => {
  switch (type) {
    case IssueType.INITIATIVE:
      return <Zap className={`${className} text-fuchsia-600 shrink-0`} />;
    case IssueType.EPIC:
      return <Zap className={`${className} text-purple-600 shrink-0`} />;
    case IssueType.STORY:
    case IssueType.FEATURE:
      return <Bookmark className={`${className} text-emerald-600 shrink-0`} />;
    case IssueType.TASK:
    case IssueType.IMPROVEMENT:
    case IssueType.REQUEST:
    case IssueType.CHANGE:
      return <CheckSquare className={`${className} text-blue-600 shrink-0`} />;
    case IssueType.BUG:
    case IssueType.INCIDENT:
    case IssueType.PROBLEM:
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

/**
 * Official Arij Brand Logo (3D Blue Ribbon 'A' with Rising Trend Arrow + 'arij' Wordmark)
 */
export const ArijLogo = ({
  variant = 'horizontal', // 'horizontal' | 'stacked' | 'mark'
  theme = 'dark', // 'dark' (for dark navbar) | 'light' (for white cards/sidebar)
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const wordmarkFill = theme === 'dark' ? '#FFFFFF' : '#00205B';

  if (variant === 'stacked') {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center bg-white rounded-xl p-2 shadow-xs border border-slate-200/80 select-none ${className}`}
      >
        <img
          src="/arij-logo.svg"
          alt="arij logo"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official Arij 'A' Ribbon + Rising Arrow Emblem */}
      <svg
        viewBox="170 110 660 540"
        className="w-8 h-8 shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id={`arijLeft-${uid}`}
            x1="55%"
            y1="12%"
            x2="22%"
            y2="62%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00B2FF" />
            <stop offset="45%" stopColor="#0068FF" />
            <stop offset="100%" stopColor="#003CE6" />
          </linearGradient>
          <linearGradient
            id={`arijRightUp-${uid}`}
            x1="54%"
            y1="16%"
            x2="66%"
            y2="38%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#011258" />
            <stop offset="45%" stopColor="#08209A" />
            <stop offset="100%" stopColor="#1E15C8" />
          </linearGradient>
          <linearGradient
            id={`arijRightLow-${uid}`}
            x1="62%"
            y1="44%"
            x2="78%"
            y2="62%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#061980" />
            <stop offset="40%" stopColor="#1D12C4" />
            <stop offset="100%" stopColor="#3E08E6" />
          </linearGradient>
          <linearGradient
            id={`arijArrow-${uid}`}
            x1="45%"
            y1="50%"
            x2="77%"
            y2="34%"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0038DF" />
            <stop offset="45%" stopColor="#0072FF" />
            <stop offset="100%" stopColor="#00BCFF" />
          </linearGradient>
        </defs>

        {/* Upper-Right Leg */}
        <path
          d="M 520 145 L 622 172 L 696 312 C 672 315, 650 324, 642 344 L 584 386 L 504 238 Z"
          fill={`url(#arijRightUp-${uid})`}
        />
        {/* Lower-Right Leg */}
        <path
          d="M 605 492 L 702 426 L 794 590 C 804 608, 792 624, 770 624 L 716 624 C 686 624, 666 606, 652 580 Z"
          fill={`url(#arijRightLow-${uid})`}
        />
        {/* Rising Zig-Zag Trend Arrow */}
        <path
          d="M 436 452 L 500 414 C 512 407, 524 409, 534 418 L 568 446 L 682 366 L 670 348 C 664 339, 670 330, 682 329 L 754 325 C 766 325, 772 334, 767 345 L 730 426 C 725 436, 714 438, 707 428 L 696 413 L 578 518 C 564 530, 548 530, 533 517 L 474 468 L 442 465 Z"
          fill={`url(#arijArrow-${uid})`}
        />
        {/* Left Main Ribbon Leg */}
        <path
          d="M 442 166 C 454 144, 474 134, 502 134 L 554 134 C 582 134, 606 148, 622 172 L 632 188 C 614 180, 598 186, 586 208 L 396 574 C 378 608, 348 624, 308 624 L 234 624 C 210 624, 198 606, 210 584 Z"
          fill={`url(#arijLeft-${uid})`}
        />
      </svg>

      {variant !== 'mark' && (
        <svg
          viewBox="235 620 530 355"
          className="h-6 w-auto shrink-0"
          aria-label="arij"
        >
          <g fill={wordmarkFill}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M 346 694 C 284 694, 244 738, 244 794 C 244 850, 284 894, 344 894 C 372 894, 394 882, 405 866 L 405 888 L 456 888 L 456 700 L 405 700 L 405 722 C 394 705, 372 694, 346 694 Z M 350 742 C 382 742, 404 764, 404 794 C 404 824, 382 846, 350 846 C 318 846, 296 824, 296 794 C 296 764, 318 742, 350 742 Z"
            />
            <path d="M 482 888 L 482 792 C 482 732, 518 696, 578 696 L 602 696 L 602 748 L 576 748 C 548 748, 534 763, 534 794 L 534 888 Z" />
            <rect x="622" y="700" width="52" height="188" />
            <circle cx="648" cy="656" r="28" />
            <path d="M 698 700 L 750 700 L 750 874 C 750 934, 716 966, 656 966 L 644 966 L 644 916 L 656 916 C 684 916, 698 902, 698 874 Z" />
            <circle cx="724" cy="656" r="28" />
          </g>
        </svg>
      )}
    </span>
  );
};
