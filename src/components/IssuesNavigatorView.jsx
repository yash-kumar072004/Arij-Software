import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bookmark,
  CheckSquare,
  Code2,
  Download,
  Edit3,
  LayoutList,
  PanelRight,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
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
} from './ArijPrimitives.jsx';

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

  // Basic filter states (Assignee, Status, Priority, Label, Type, Due Date, Component, Sort)
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [labelFilter, setLabelFilter] = useState('ALL');
  const [dueDateFilter, setDueDateFilter] = useState('ALL');
  const [componentFilter, setComponentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('PRIORITY_DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const allLabels = useMemo(() => {
    const set = new Set();
    issues.forEach((i) => {
      (i.labels || []).forEach((lbl) => set.add(lbl));
    });
    return Array.from(set).sort();
  }, [issues]);

  // Split view selected issue
  const [splitIssueId, setSplitIssueId] = useState(issues[0]?.id || null);

  // Bulk Operations State
  const [selectedIssueIds, setSelectedIssueIds] = useState(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);

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

    if (labelFilter !== 'ALL') {
      list = list.filter((i) =>
        (i.labels || []).some(
          (l) => l.toLowerCase() === labelFilter.toLowerCase()
        )
      );
    }

    if (dueDateFilter === 'OVERDUE') {
      list = list.filter((i) => isOverdue(i.dueDate, i.status));
    } else if (dueDateFilter === 'HAS_DUE_DATE') {
      list = list.filter((i) => Boolean(i.dueDate));
    } else if (dueDateFilter === 'NO_DUE_DATE') {
      list = list.filter((i) => !i.dueDate);
    } else if (dueDateFilter !== 'ALL') {
      list = list.filter((i) => String(i.dueDate || '') <= dueDateFilter);
    }

    list.sort((a, b) => {
      if (sortBy === 'PRIORITY_ASC') {
        return (
          (PRIORITY_CONFIG[a.priority]?.weight || 0) -
          (PRIORITY_CONFIG[b.priority]?.weight || 0)
        );
      }
      if (sortBy === 'KEY_ASC') {
        return String(a.key).localeCompare(String(b.key), undefined, {
          numeric: true,
        });
      }
      if (sortBy === 'KEY_DESC') {
        return String(b.key).localeCompare(String(a.key), undefined, {
          numeric: true,
        });
      }
      if (sortBy === 'TITLE_ASC') {
        return String(a.title).localeCompare(String(b.title));
      }
      if (sortBy === 'POINTS_DESC') {
        return (b.storyPoints || 0) - (a.storyPoints || 0);
      }
      if (sortBy === 'DUE_DATE_ASC') {
        return String(a.dueDate || '9999-12-31').localeCompare(
          String(b.dueDate || '9999-12-31')
        );
      }
      if (sortBy === 'UPDATED_DESC') {
        return (
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
        );
      }
      return (
        (PRIORITY_CONFIG[b.priority]?.weight || 0) -
        (PRIORITY_CONFIG[a.priority]?.weight || 0)
      );
    });
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
    labelFilter,
    dueDateFilter,
    componentFilter,
    sortBy,
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
    const synthesizedQuery =
      queryMode === 'JQL'
        ? jqlString
        : [
            `project = ${project.key}`,
            statusFilter !== 'ALL' ? `status = "${statusFilter}"` : null,
            priorityFilter !== 'ALL' ? `priority = "${priorityFilter}"` : null,
            typeFilter !== 'ALL' ? `type = "${typeFilter}"` : null,
            assigneeFilter === 'ME' ? 'assignee = currentUser()' : null,
          ]
            .filter(Boolean)
            .join(' AND ');
    onSaveFilter(newFilterName.trim(), synthesizedQuery);
    fetch('/api/saved-filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newFilterName.trim(),
        projectId: project.id,
        query: synthesizedQuery,
      }),
    }).catch(() => {});
    setNewFilterName('');
    setSavingFilter(false);
  };

  const toggleSelectAllCurrentPage = () => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      const allSelected = paginatedIssues.every((i) => next.has(i.id));
      if (allSelected) {
        paginatedIssues.forEach((i) => next.delete(i.id));
      } else {
        paginatedIssues.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const toggleSelectIssue = (id) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusChange = async (newStatus) => {
    if (selectedIssueIds.size === 0) return;
    setIsBulkOperating(true);
    const ids = Array.from(selectedIssueIds);
    try {
      await fetch('/api/issues/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ids, updates: { status: newStatus } }),
      });
      ids.forEach((id) => onUpdateIssue(id, { status: newStatus }));
      setSelectedIssueIds(new Set());
    } catch (err) {
      console.error('Bulk status update failed:', err);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkPriorityChange = async (newPriority) => {
    if (selectedIssueIds.size === 0) return;
    setIsBulkOperating(true);
    const ids = Array.from(selectedIssueIds);
    try {
      await fetch('/api/issues/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ids, updates: { priority: newPriority } }),
      });
      ids.forEach((id) => onUpdateIssue(id, { priority: newPriority }));
      setSelectedIssueIds(new Set());
    } catch (err) {
      console.error('Bulk priority update failed:', err);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkAssigneeChange = async (newAssigneeId) => {
    if (selectedIssueIds.size === 0) return;
    setIsBulkOperating(true);
    const ids = Array.from(selectedIssueIds);
    try {
      await fetch('/api/issues/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ids, updates: { assigneeId: newAssigneeId || null } }),
      });
      ids.forEach((id) => onUpdateIssue(id, { assigneeId: newAssigneeId || null }));
      setSelectedIssueIds(new Set());
    } catch (err) {
      console.error('Bulk assignee update failed:', err);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDeleteIssues = async () => {
    if (selectedIssueIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIssueIds.size} selected issues?`)) return;
    setIsBulkOperating(true);
    const ids = Array.from(selectedIssueIds);
    try {
      await fetch('/api/issues/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ids }),
      });
      ids.forEach((id) => onUpdateIssue(id, { isDeleted: true }));
      setSelectedIssueIds(new Set());
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsBulkOperating(false);
    }
  };

  const activeSplitIssue = useMemo(() => {
    if (!splitIssueId) return filteredIssues[0] || null;
    return (
      filteredIssues.find((i) => i.id === splitIssueId) ||
      filteredIssues[0] ||
      null
    );
  }, [filteredIssues, splitIssueId]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedIssues = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, safePage, pageSize]);

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
                Issue Navigator &amp; Advanced AQL Search
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
                Switch to AQL
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

        {/* Query Bar: Either Basic Selectors OR AQL Input */}
        {queryMode === 'JQL' ? (
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1.5 bg-slate-900 text-emerald-400 font-mono text-xs font-bold rounded-l-md">
              AQL
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
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                aria-label="Filter by Label"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Label: All</option>
                {allLabels.map((lbl) => (
                  <option key={lbl} value={lbl}>
                    {lbl}
                  </option>
                ))}
              </select>

              <select
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value)}
                aria-label="Filter by Due Date"
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-700"
              >
                <option value="ALL">Due Date: All</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="HAS_DUE_DATE">Has Due Date</option>
                <option value="NO_DUE_DATE">No Due Date</option>
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

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort issues by"
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-md text-slate-800"
              >
                <option value="PRIORITY_DESC">Sort: Priority (High → Low)</option>
                <option value="PRIORITY_ASC">Sort: Priority (Low → High)</option>
                <option value="KEY_ASC">Sort: Key (A → Z)</option>
                <option value="KEY_DESC">Sort: Key (Z → A)</option>
                <option value="TITLE_ASC">Sort: Summary (A → Z)</option>
                <option value="POINTS_DESC">Sort: Story Points (High → Low)</option>
                <option value="DUE_DATE_ASC">Sort: Due Date (Soonest)</option>
                <option value="UPDATED_DESC">Sort: Recently Updated</option>
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
            {/* Bulk Action Bar (Jira Bulk Edit / Move / Transition / Delete) */}
            {selectedIssueIds.size > 0 && (
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-semibold text-blue-900">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span>{selectedIssueIds.size} issues selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Bulk Status Change */}
                  <div className="flex items-center gap-1 bg-white border border-blue-200 rounded px-2 py-1">
                    <span className="text-slate-500 font-medium text-[11px]">Set Status:</span>
                    <select
                      disabled={isBulkOperating}
                      onChange={(e) => {
                        if (e.target.value) handleBulkStatusChange(e.target.value);
                      }}
                      defaultValue=""
                      className="text-xs font-semibold bg-transparent border-none focus:outline-none text-slate-800"
                    >
                      <option value="" disabled>Choose...</option>
                      {STATUS_ORDER.map((st) => (
                        <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bulk Priority Change */}
                  <div className="flex items-center gap-1 bg-white border border-blue-200 rounded px-2 py-1">
                    <span className="text-slate-500 font-medium text-[11px]">Set Priority:</span>
                    <select
                      disabled={isBulkOperating}
                      onChange={(e) => {
                        if (e.target.value) handleBulkPriorityChange(e.target.value);
                      }}
                      defaultValue=""
                      className="text-xs font-semibold bg-transparent border-none focus:outline-none text-slate-800"
                    >
                      <option value="" disabled>Choose...</option>
                      <option value={IssuePriority.HIGHEST}>Highest</option>
                      <option value={IssuePriority.HIGH}>High</option>
                      <option value={IssuePriority.MEDIUM}>Medium</option>
                      <option value={IssuePriority.LOW}>Low</option>
                      <option value={IssuePriority.LOWEST}>Lowest</option>
                    </select>
                  </div>

                  {/* Bulk Assignee Change */}
                  <div className="flex items-center gap-1 bg-white border border-blue-200 rounded px-2 py-1">
                    <span className="text-slate-500 font-medium text-[11px]">Assign To:</span>
                    <select
                      disabled={isBulkOperating}
                      onChange={(e) => {
                        if (e.target.value !== undefined) handleBulkAssigneeChange(e.target.value);
                      }}
                      defaultValue=""
                      className="text-xs font-semibold bg-transparent border-none focus:outline-none text-slate-800"
                    >
                      <option value="" disabled>Choose...</option>
                      <option value="">Unassign</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bulk Delete */}
                  <button
                    type="button"
                    disabled={isBulkOperating}
                    onClick={handleBulkDeleteIssues}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedIssueIds(new Set())}
                    className="text-xs text-slate-500 hover:text-slate-800 px-1"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 select-none">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all issues on page"
                      checked={
                        paginatedIssues.length > 0 &&
                        paginatedIssues.every((i) => selectedIssueIds.has(i.id))
                      }
                      onChange={toggleSelectAllCurrentPage}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-4 w-24">Type</th>
                  <th
                    onClick={() =>
                      setSortBy((s) =>
                        s === 'KEY_ASC' ? 'KEY_DESC' : 'KEY_ASC'
                      )
                    }
                    className="py-2.5 px-4 w-28 cursor-pointer hover:text-blue-600"
                  >
                    Key ↕
                  </th>
                  <th
                    onClick={() => setSortBy('TITLE_ASC')}
                    className="py-2.5 px-4 cursor-pointer hover:text-blue-600"
                  >
                    Summary ↕
                  </th>
                  <th className="py-2.5 px-4 w-40">Assignee</th>
                  <th
                    onClick={() =>
                      setSortBy((s) =>
                        s === 'PRIORITY_DESC' ? 'PRIORITY_ASC' : 'PRIORITY_DESC'
                      )
                    }
                    className="py-2.5 px-4 w-28 cursor-pointer hover:text-blue-600"
                  >
                    Priority ↕
                  </th>
                  <th className="py-2.5 px-4 w-36">Status</th>
                  <th
                    onClick={() => setSortBy('POINTS_DESC')}
                    className="py-2.5 px-4 w-24 text-right cursor-pointer hover:text-blue-600"
                  >
                    Points ↕
                  </th>
                  <th
                    onClick={() => setSortBy('DUE_DATE_ASC')}
                    className="py-2.5 px-4 w-28 text-right cursor-pointer hover:text-blue-600"
                  >
                    Due Date ↕
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {paginatedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No issues match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedIssues.map((iss) => {
                    const assignee = iss.assigneeId ? userMap[iss.assigneeId] : null;
                    const overdue = isOverdue(iss.dueDate, iss.status);
                    const isSelected = selectedIssueIds.has(iss.id);
                    return (
                      <tr
                        key={iss.id}
                        onClick={() => onSelectIssue(iss.id)}
                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td
                          className="py-2.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectIssue(iss.id)}
                            aria-label={`Select issue ${iss.key}`}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
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
                          <div className="flex items-center gap-1.5">
                            {iss.isFlagged && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0"
                                title="Flagged / Impediment"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                FLAGGED
                              </span>
                            )}
                            <span className="truncate">{iss.title}</span>
                          </div>
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

            {/* Interactive Pagination Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  Page {safePage} of {totalPages} ({filteredIssues.length} total matching issues)
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  aria-label="Rows per page"
                  className="px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs text-slate-700"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
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
