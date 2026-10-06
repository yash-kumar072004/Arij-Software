import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Code2,
  Download,
  LayoutList,
  PanelRight,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/jira.js';
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
} from './JiraPrimitives.jsx';

export const IssuesNavigatorView = ({
  project,
  issues,
  components,
  users,
  currentUserId,
  savedFilters,
  onSelectIssue,
  onUpdateIssue,
  onSaveFilter,
}) => {
  const [queryMode, setQueryMode] = useState('BASIC');
  const [viewLayout, setViewLayout] = useState('TABLE');
  const [activeFilterId, setActiveFilterId] = useState('flt-all');
  const [jqlString, setJqlString] = useState('ORDER BY priority DESC');

  // Basic filter states
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [componentFilter, setComponentFilter] = useState('ALL');

  // Split view selected issue
  const [splitIssueId, setSplitIssueId] = useState(issues[0]?.id || null);

  // Save filter inline form
  const [savingFilter, setSavingFilter] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const componentMap = useMemo(() => {
    const map = {};
    components.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [components]);

  const applySavedFilter = (filter) => {
    setActiveFilterId(filter.id);
    setJqlString(filter.jql);
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
            i.priority === IssuePriority.HIGHEST ||
            i.priority === IssuePriority.HIGH
        );
      } else if (upper.includes('PRIORITY = HIGHEST')) {
        list = list.filter((i) => i.priority === IssuePriority.HIGHEST);
      }

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
            PRIORITY_CONFIG[b.priority].weight -
            PRIORITY_CONFIG[a.priority].weight
        );
      } else if (upper.includes('ORDER BY UPDATED DESC')) {
        list.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
      return list;
    }

    // BASIC FILTER MODE
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(
        (i) =>
          i.key.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.labels.some((l) => l.toLowerCase().includes(q))
      );
    }

    if (typeFilter !== 'ALL') {
      list = list.filter((i) => i.type === typeFilter);
    }

    if (statusFilter === 'NOT_DONE') {
      list = list.filter((i) => i.status !== IssueStatus.DONE);
    } else if (statusFilter !== 'ALL') {
      list = list.filter((i) => i.status === statusFilter);
    }

    if (priorityFilter === 'HIGH_AND_HIGHEST') {
      list = list.filter(
        (i) =>
          i.priority === IssuePriority.HIGHEST ||
          i.priority === IssuePriority.HIGH
      );
    } else if (priorityFilter !== 'ALL') {
      list = list.filter((i) => i.priority === priorityFilter);
    }

    if (assigneeFilter === 'UNASSIGNED') {
      list = list.filter((i) => !i.assigneeId);
    } else if (assigneeFilter !== 'ALL') {
      list = list.filter((i) => i.assigneeId === assigneeFilter);
    }

    if (componentFilter !== 'ALL') {
      list = list.filter((i) => i.componentId === componentFilter);
    }

    list.sort(
      (a, b) =>
        PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight
    );
    return list;
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
      'Summary',
      'Status',
      'Priority',
      'Assignee',
      'Story Points',
      'Due Date',
    ];
    const rows = filteredIssues.map((i) => [
      i.key,
      i.type,
      `"${i.title.replace(/"/g, '""')}"`,
      i.status,
      i.priority,
      i.assigneeId ? userMap[i.assigneeId]?.name || '' : 'Unassigned',
      String(i.storyPoints || 0),
      i.dueDate || '',
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

  const handleSaveCurrentFilter = (e) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    onSaveFilter(newFilterName.trim(), jqlString);
    setNewFilterName('');
    setSavingFilter(false);
  };

  const activeSplitIssue = useMemo(() => {
    if (!splitIssueId) return filteredIssues[0] || null;
    return (
      filteredIssues.find((i) => i.id === splitIssueId) ||
      filteredIssues[0] ||
      null
    );
  }, [filteredIssues, splitIssueId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-semibold text-slate-700">
                Issue Navigator & Advanced JQL Search
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
              Search & Filter Issues
            </h1>
          </div>

          {/* Right Controls: Saved Filters, Mode Switch, Layout Toggle, Export CSV */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSavingFilter(!savingFilter)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              Save Filter
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout('TABLE')}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                  viewLayout === 'TABLE'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('SPLIT')}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 ${
                  viewLayout === 'SPLIT'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
                Detail View
              </button>
            </div>
          </div>
        </div>

        {/* Saved Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Saved Filters:
            </span>
            {savedFilters.map((flt) => (
              <button
                key={flt.id}
                type="button"
                onClick={() => applySavedFilter(flt)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                  activeFilterId === flt.id
                    ? 'bg-blue-50 border-blue-600 text-blue-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {flt.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setQueryMode(queryMode === 'BASIC' ? 'JQL' : 'BASIC')
            }
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {queryMode === 'BASIC' ? (
              <>
                <Code2 className="w-3.5 h-3.5" />
                Switch to JQL
              </>
            ) : (
              <>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Switch to Basic Filters
              </>
            )}
          </button>
        </div>

        {/* Save Filter Inline Drawer */}
        {savingFilter && (
          <form
            onSubmit={handleSaveCurrentFilter}
            className="flex items-center gap-2 p-2.5 bg-blue-50/60 border border-blue-200 rounded-md"
          >
            <input
              type="text"
              autoFocus
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Name this filter (e.g. Sprint 21 Blockers)..."
              className="flex-1 text-xs bg-white border border-slate-300 rounded px-3 py-1.5 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSavingFilter(false)}
              className="p-1.5 text-slate-500"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Query Bar: Either Basic Selectors OR JQL Input */}
        {queryMode === 'JQL' ? (
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1.5 bg-slate-900 text-emerald-400 font-mono text-xs font-bold rounded-l-md">
              JQL
            </div>
            <input
              type="text"
              value={jqlString}
              onChange={(e) => setJqlString(e.target.value)}
              placeholder='assignee = currentUser() AND status != DONE AND priority IN (HIGHEST, HIGH) ORDER BY priority DESC'
              className="flex-1 font-mono text-xs bg-slate-900 text-slate-100 px-3 py-1.5 rounded-r-md focus:outline-none"
            />
            <span className="text-xs text-slate-500 font-mono">
              {filteredIssues.length} matches
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
                                status: e.target.value,
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
