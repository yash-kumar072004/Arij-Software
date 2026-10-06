import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Code2,
  Download,
  Filter,
  LayoutList,
  PanelRight,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  ProjectComponent,
  SavedFilter,
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
  StatusIcon,
  TYPE_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface IssuesNavigatorViewProps {
  project: Project;
  issues: Issue[];
  sprints: Sprint[];
  components: ProjectComponent[];
  users: User[];
  currentUserId: string;
  savedFilters: SavedFilter[];
  onSelectIssue: (issueId: string) => void;
  onUpdateIssue: (issueId: string, updates: Partial<Issue>) => void;
  onSaveFilter: (name: string, jql: string) => void;
}

export const IssuesNavigatorView: React.FC<IssuesNavigatorViewProps> = ({
  project,
  issues,
  sprints,
  components,
  users,
  currentUserId,
  savedFilters,
  onSelectIssue,
  onUpdateIssue,
  onSaveFilter,
}) => {
  const [queryMode, setQueryMode] = useState<'BASIC' | 'JQL'>('BASIC');
  const [viewLayout, setViewLayout] = useState<'TABLE' | 'SPLIT'>('TABLE');
  const [activeFilterId, setActiveFilterId] = useState<string>('flt-all');
  const [jqlString, setJqlString] = useState<string>('ORDER BY priority DESC');

  // Basic filter states
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [componentFilter, setComponentFilter] = useState<string>('ALL');

  // Split view selected issue
  const [splitIssueId, setSplitIssueId] = useState<string | null>(
    issues[0]?.id || null
  );

  // Save filter inline form
  const [savingFilter, setSavingFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const componentMap = useMemo(() => {
    const map: Record<string, ProjectComponent> = {};
    components.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [components]);

  const applySavedFilter = (filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    setJqlString(filter.jql);
    // Sync basic filters for common system presets
    setSearchText('');
    setComponentFilter('ALL');
    if (filter.id === 'flt-all') {
      setTypeFilter('ALL');
      setStatusFilter('ALL');
      setPriorityFilter('ALL');
      setAssigneeFilter('ALL');
    } else if (filter.id === 'flt-my-open') {
      setTypeFilter('ALL');
      setStatusFilter('NOT_DONE');
      setPriorityFilter('ALL');
      setAssigneeFilter(currentUserId);
    } else if (filter.id === 'flt-bugs') {
      setTypeFilter(IssueType.BUG);
      setStatusFilter('NOT_DONE');
      setPriorityFilter('ALL');
      setAssigneeFilter('ALL');
    } else if (filter.id === 'flt-high') {
      setTypeFilter('ALL');
      setStatusFilter('NOT_DONE');
      setPriorityFilter('HIGH_AND_HIGHEST');
      setAssigneeFilter('ALL');
    } else if (filter.id === 'flt-done') {
      setTypeFilter('ALL');
      setStatusFilter(IssueStatus.DONE);
      setPriorityFilter('ALL');
      setAssigneeFilter('ALL');
    } else {
      setQueryMode('JQL');
    }
  };

  // JQL and Basic evaluation engine
  const filteredIssues = useMemo(() => {
    let list = [...issues];

    if (queryMode === 'JQL') {
      const upper = jqlString.toUpperCase();
      if (upper.includes('ASSIGNEE = CURRENTUSER()')) {
        list = list.filter((i) => i.assigneeId === currentUserId);
      }
      if (upper.includes('STATUS != DONE')) {
        list = list.filter((i) => i.status !== IssueStatus.DONE);
      } else if (upper.includes('STATUS = DONE')) {
        list = list.filter((i) => i.status === IssueStatus.DONE);
      } else if (upper.includes('STATUS = IN_PROGRESS')) {
        list = list.filter((i) => i.status === IssueStatus.IN_PROGRESS);
      } else if (upper.includes('STATUS = TODO')) {
        list = list.filter((i) => i.status === IssueStatus.TODO);
      }

      if (upper.includes('TYPE = BUG')) {
        list = list.filter((i) => i.type === IssueType.BUG);
      } else if (upper.includes('TYPE = STORY')) {
        list = list.filter((i) => i.type === IssueType.STORY);
      } else if (upper.includes('TYPE = TASK')) {
        list = list.filter((i) => i.type === IssueType.TASK);
      } else if (upper.includes('TYPE = EPIC')) {
        list = list.filter((i) => i.type === IssueType.EPIC);
      }

      if (upper.includes('PRIORITY IN (HIGHEST, HIGH)')) {
        list = list.filter(
          (i) =>
            i.priority === IssuePriority.HIGHEST || i.priority === IssuePriority.HIGH
        );
      } else if (upper.includes('PRIORITY = HIGHEST')) {
        list = list.filter((i) => i.priority === IssuePriority.HIGHEST);
      } else if (upper.includes('PRIORITY = HIGH')) {
        list = list.filter((i) => i.priority === IssuePriority.HIGH);
      }

      // Text search inside JQL e.g. text ~ "keyword"
      const textMatch = jqlString.match(/text\s*~\s*"([^"]+)"/i);
      if (textMatch && textMatch[1]) {
        const kw = textMatch[1].toLowerCase();
        list = list.filter(
          (i) =>
            i.title.toLowerCase().includes(kw) ||
            i.description.toLowerCase().includes(kw) ||
            i.key.toLowerCase().includes(kw)
        );
      }

      if (upper.includes('ORDER BY PRIORITY DESC')) {
        list.sort(
          (a, b) =>
            PRIORITY_CONFIG[b.priority].rank - PRIORITY_CONFIG[a.priority].rank
        );
      } else if (upper.includes('ORDER BY UPDATED DESC')) {
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }
      return list;
    }

    // BASIC mode
    return list
      .filter((i) => {
        if (searchText.trim()) {
          const q = searchText.toLowerCase();
          if (
            !i.key.toLowerCase().includes(q) &&
            !i.title.toLowerCase().includes(q) &&
            !i.labels.some((l) => l.toLowerCase().includes(q))
          ) {
            return false;
          }
        }
        if (typeFilter !== 'ALL' && i.type !== typeFilter) return false;
        if (statusFilter !== 'ALL') {
          if (statusFilter === 'NOT_DONE' && i.status === IssueStatus.DONE) return false;
          if (statusFilter !== 'NOT_DONE' && i.status !== statusFilter) return false;
        }
        if (priorityFilter !== 'ALL') {
          if (
            priorityFilter === 'HIGH_AND_HIGHEST' &&
            i.priority !== IssuePriority.HIGHEST &&
            i.priority !== IssuePriority.HIGH
          ) {
            return false;
          }
          if (priorityFilter !== 'HIGH_AND_HIGHEST' && i.priority !== priorityFilter) {
            return false;
          }
        }
        if (assigneeFilter !== 'ALL') {
          if (assigneeFilter === 'UNASSIGNED' && i.assigneeId !== null) return false;
          if (assigneeFilter !== 'UNASSIGNED' && i.assigneeId !== assigneeFilter)
            return false;
        }
        if (componentFilter !== 'ALL' && i.componentId !== componentFilter) return false;
        return true;
      })
      .sort(
        (a, b) =>
          PRIORITY_CONFIG[b.priority].rank - PRIORITY_CONFIG[a.priority].rank
      );
  }, [
    issues,
    queryMode,
    jqlString,
    currentUserId,
    searchText,
    typeFilter,
    statusFilter,
    priorityFilter,
    assigneeFilter,
    componentFilter,
  ]);

  const handleExportCsv = () => {
    const headers = [
      'Key',
      'Type',
      'Title',
      'Status',
      'Priority',
      'Assignee',
      'StoryPoints',
      'DueDate',
      'UpdatedAt',
    ];
    const rows = filteredIssues.map((i) => [
      i.key,
      i.type,
      `"${i.title.replace(/"/g, '""')}"`,
      i.status,
      i.priority,
      i.assigneeId ? userMap[i.assigneeId]?.name || '' : 'Unassigned',
      i.storyPoints,
      i.dueDate || '',
      i.updatedAt,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${project.key}-issues-export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    onSaveFilter(newFilterName.trim(), jqlString);
    setNewFilterName('');
    setSavingFilter(false);
  };

  const activeSplitIssue =
    filteredIssues.find((i) => i.id === splitIssueId) || filteredIssues[0] || null;

  return (
    <div className="flex flex-col h-full">
      {/* Top Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">Issue Navigator & JQL Search</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Issues & Filters
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Switch Basic / JQL */}
            <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
              <button
                type="button"
                onClick={() => setQueryMode('BASIC')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  queryMode === 'BASIC'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Basic Filters
              </button>
              <button
                type="button"
                onClick={() => setQueryMode('JQL')}
                className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                  queryMode === 'JQL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                JQL
              </button>
            </div>

            {/* Switch Table / Split View */}
            <div className="flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-md">
              <button
                type="button"
                onClick={() => setViewLayout('TABLE')}
                className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                  viewLayout === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="List Table View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('SPLIT')}
                className={`px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                  viewLayout === 'SPLIT'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Detail Split View"
              >
                <PanelRight className="w-3.5 h-3.5" />
                Split
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Saved Filters Preset Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pb-3 mb-3 border-b border-slate-100">
          <span className="text-xs text-slate-500 mr-1 flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5" />
            Saved Filters:
          </span>
          {savedFilters.map((flt) => (
            <button
              key={flt.id}
              type="button"
              onClick={() => applySavedFilter(flt)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeFilterId === flt.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {flt.name}
            </button>
          ))}

          {savingFilter ? (
            <form onSubmit={handleSaveCustomFilter} className="flex items-center gap-1.5 ml-2">
              <input
                type="text"
                autoFocus
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="Filter name..."
                className="px-2 py-1 text-xs border border-blue-600 rounded focus:outline-none"
              />
              <button
                type="submit"
                className="px-2 py-1 text-xs font-semibold bg-blue-600 text-white rounded"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setSavingFilter(false)}
                className="text-xs text-slate-500 px-1"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSavingFilter(true)}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors whitespace-nowrap"
            >
              + Save Current Filter
            </button>
          )}
        </div>

        {/* Filter Controls or JQL Bar */}
        {queryMode === 'JQL' ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded border border-blue-200">
              JQL
            </span>
            <input
              type="text"
              value={jqlString}
              onChange={(e) => setJqlString(e.target.value)}
              placeholder='e.g. type = BUG AND status != DONE ORDER BY priority DESC'
              className="flex-1 font-mono text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
              {filteredIssues.length} matching issues
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Contains text..."
                  className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 w-48"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by Issue Type"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Type: All</option>
                <option value={IssueType.EPIC}>Epic</option>
                <option value={IssueType.STORY}>Story</option>
                <option value={IssueType.TASK}>Task</option>
                <option value={IssueType.BUG}>Bug</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Status: All</option>
                <option value="NOT_DONE">Status: Unresolved</option>
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                aria-label="Filter by Priority"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Priority: All</option>
                <option value="HIGH_AND_HIGHEST">Highest & High</option>
                <option value={IssuePriority.HIGHEST}>Highest</option>
                <option value={IssuePriority.HIGH}>High</option>
                <option value={IssuePriority.MEDIUM}>Medium</option>
                <option value={IssuePriority.LOW}>Low</option>
                <option value={IssuePriority.LOWEST}>Lowest</option>
              </select>

              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                aria-label="Filter by Assignee"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Assignee: All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value="UNASSIGNED">Unassigned</option>
              </select>

              <select
                value={componentFilter}
                onChange={(e) => setComponentFilter(e.target.value)}
                aria-label="Filter by Component"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Component: All</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Showing {filteredIssues.length} of {issues.length} issues
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">
        {viewLayout === 'TABLE' ? (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4 w-24">Type</th>
                  <th className="py-2.5 px-4 w-28">Key</th>
                  <th className="py-2.5 px-4">Summary</th>
                  <th className="py-2.5 px-4 w-40">Assignee</th>
                  <th className="py-2.5 px-4 w-28">Priority</th>
                  <th className="py-2.5 px-4 w-36">Status</th>
                  <th className="py-2.5 px-4 w-24 text-right">Points</th>
                  <th className="py-2.5 px-4 w-28 text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No issues match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((iss) => {
                    const assignee = iss.assigneeId ? userMap[iss.assigneeId] : null;
                    const overdue = isOverdue(iss.dueDate, iss.status);
                    return (
                      <tr
                        key={iss.id}
                        onClick={() => onSelectIssue(iss.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <IssueTypeIcon type={iss.type} />
                            <span className="text-slate-600">{TYPE_CONFIG[iss.type].label}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-blue-700">
                          {iss.key}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {iss.title}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={assignee} size="xs" />
                            <span className="text-slate-700 truncate max-w-[120px]">
                              {assignee ? assignee.name : 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <PriorityIcon priority={iss.priority} />
                            <span className={PRIORITY_CONFIG[iss.priority].textClass}>
                              {PRIORITY_CONFIG[iss.priority].label}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={iss.status}
                            onChange={(e) =>
                              onUpdateIssue(iss.id, {
                                status: e.target.value as IssueStatus,
                              })
                            }
                            aria-label="Change status"
                            className={`text-xs font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-1 ${
                              STATUS_CONFIG[iss.status].textClass
                            }`}
                          >
                            {STATUS_ORDER.map((st) => (
                              <option key={st} value={st}>
                                {STATUS_CONFIG[st].label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {iss.storyPoints > 0 ? `${iss.storyPoints} pts` : '—'}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                            overdue ? 'text-red-600 font-semibold' : 'text-slate-500'
                          }`}
                        >
                          {formatShortDate(iss.dueDate)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Detail Split View */
          <div className="grid grid-cols-12 gap-4 h-[calc(100vh-260px)] min-h-[500px]">
            <div className="col-span-5 bg-white border border-slate-200 rounded-lg overflow-y-auto divide-y divide-slate-200">
              {filteredIssues.map((iss) => {
                const isSelected = activeSplitIssue?.id === iss.id;
                const assignee = iss.assigneeId ? userMap[iss.assigneeId] : null;
                return (
                  <div
                    key={iss.id}
                    onClick={() => setSplitIssueId(iss.id)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/70 border-l-4 border-l-blue-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <IssueTypeIcon type={iss.type} className="w-3.5 h-3.5" />
                        <span className="font-mono tabular-nums text-xs font-semibold text-blue-700">
                          {iss.key}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          STATUS_CONFIG[iss.status].textClass
                        }`}
                      >
                        {STATUS_CONFIG[iss.status].label}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 mb-2">
                      {iss.title}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <PriorityIcon priority={iss.priority} />
                        <span>{PRIORITY_CONFIG[iss.priority].label}</span>
                      </div>
                      <UserAvatar user={assignee} size="xs" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="col-span-7 bg-white border border-slate-200 rounded-lg p-6 overflow-y-auto">
              {activeSplitIssue ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2">
                      <IssueTypeIcon type={activeSplitIssue.type} />
                      <span className="font-mono tabular-nums text-sm font-semibold text-blue-700">
                        {activeSplitIssue.key}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500">
                        Updated {formatShortDate(activeSplitIssue.updatedAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectIssue(activeSplitIssue.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Open Full Inspector
                    </button>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">
                    {activeSplitIssue.title}
                  </h2>

                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {activeSplitIssue.description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Status</span>
                      <span
                        className={`font-semibold ${
                          STATUS_CONFIG[activeSplitIssue.status].textClass
                        }`}
                      >
                        {STATUS_CONFIG[activeSplitIssue.status].label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Priority</span>
                      <span
                        className={`font-semibold ${
                          PRIORITY_CONFIG[activeSplitIssue.priority].textClass
                        }`}
                      >
                        {PRIORITY_CONFIG[activeSplitIssue.priority].label}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Story Points</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {activeSplitIssue.storyPoints} pts
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Component</span>
                      <span className="font-medium text-slate-900">
                        {activeSplitIssue.componentId
                          ? componentMap[activeSplitIssue.componentId]?.name || '—'
                          : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">
                  Select an issue on the left to inspect its details.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
