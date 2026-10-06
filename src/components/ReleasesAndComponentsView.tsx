import React, { useMemo, useState } from 'react';
import {
  Box,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Tag,
} from 'lucide-react';
import {
  Issue,
  IssueStatus,
  Project,
  ProjectComponent,
  ReleaseVersion,
  User,
} from '../types/jira';
import {
  formatShortDate,
  IssueTypeIcon,
  STATUS_CONFIG,
  UserAvatar,
} from './JiraPrimitives';

interface ReleasesAndComponentsViewProps {
  project: Project;
  releases: ReleaseVersion[];
  components: ProjectComponent[];
  issues: Issue[];
  users: User[];
  onSelectIssue: (issueId: string) => void;
  onCreateRelease: (payload: {
    name: string;
    description: string;
    releaseDate: string;
  }) => void;
  onToggleReleaseStatus: (releaseId: string) => void;
  onCreateComponent: (payload: {
    name: string;
    description: string;
    leadId: string;
  }) => void;
}

export const ReleasesAndComponentsView: React.FC<ReleasesAndComponentsViewProps> = ({
  project,
  releases,
  components,
  issues,
  users,
  onSelectIssue,
  onCreateRelease,
  onToggleReleaseStatus,
  onCreateComponent,
}) => {
  const [subTab, setSubTab] = useState<'RELEASES' | 'COMPONENTS'>('RELEASES');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRELEASED' | 'RELEASED'>('ALL');
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(
    releases[0]?.id || null
  );

  // Create release form
  const [showCreateRelease, setShowCreateRelease] = useState(false);
  const [relName, setRelName] = useState('');
  const [relDate, setRelDate] = useState('2026-11-15');
  const [relDesc, setRelDesc] = useState('');

  // Create component form
  const [showCreateComp, setShowCreateComp] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compLeadId, setCompLeadId] = useState(users[0]?.id || '');

  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      return true;
    });
  }, [releases, statusFilter]);

  const handleReleaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!relName.trim()) return;
    onCreateRelease({
      name: relName.trim(),
      description: relDesc.trim(),
      releaseDate: relDate,
    });
    setRelName('');
    setRelDesc('');
    setShowCreateRelease(false);
  };

  const handleCompSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;
    onCreateComponent({
      name: compName.trim(),
      description: compDesc.trim(),
      leadId: compLeadId,
    });
    setCompName('');
    setCompDesc('');
    setShowCreateComp(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Projects</span>
              <span>/</span>
              <span>{project.name}</span>
              <span>/</span>
              <span className="font-mono tabular-nums text-slate-700">
                Releases & Architectural Components
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {subTab === 'RELEASES' ? 'Releases & Versions' : 'Project Components'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Sub-tab Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('RELEASES')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                  subTab === 'RELEASES'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Releases ({releases.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('COMPONENTS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors ${
                  subTab === 'COMPONENTS'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                Components ({components.length})
              </button>
            </div>

            {subTab === 'RELEASES' ? (
              <button
                type="button"
                onClick={() => setShowCreateRelease((v) => !v)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Version
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateComp((v) => !v)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Component
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
        {subTab === 'RELEASES' ? (
          <>
            {showCreateRelease && (
              <form
                onSubmit={handleReleaseSubmit}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 max-w-2xl"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Create New Release Version
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Version Name
                    </label>
                    <input
                      type="text"
                      required
                      value={relName}
                      onChange={(e) => setRelName(e.target.value)}
                      placeholder="e.g. v2.6.0 — Edge Enclave Sync"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Release Date
                    </label>
                    <input
                      type="date"
                      value={relDate}
                      onChange={(e) => setRelDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Release Notes / Scope Description
                  </label>
                  <input
                    type="text"
                    value={relDesc}
                    onChange={(e) => setRelDesc(e.target.value)}
                    placeholder="Summary of deliverables included in this version..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateRelease(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Save Version
                  </button>
                </div>
              </form>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2">
              {(['ALL', 'UNRELEASED', 'RELEASED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    statusFilter === st
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All Versions'
                    : st === 'UNRELEASED'
                    ? 'Unreleased'
                    : 'Released'}
                </button>
              ))}
            </div>

            {/* Releases List */}
            <div className="space-y-4">
              {filteredReleases.map((rel) => {
                const relIssues = issues.filter((i) => i.fixVersionId === rel.id);
                const doneCount = relIssues.filter(
                  (i) => i.status === IssueStatus.DONE
                ).length;
                const pct =
                  relIssues.length > 0
                    ? Math.round((doneCount / relIssues.length) * 100)
                    : rel.status === 'RELEASED'
                    ? 100
                    : 0;
                const isExpanded = expandedReleaseId === rel.id;

                return (
                  <div
                    key={rel.id}
                    className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2.5">
                          <Tag className="w-4 h-4 text-blue-600" />
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReleaseId(isExpanded ? null : rel.id)
                            }
                            className="text-base font-bold text-slate-900 hover:text-blue-600 text-left"
                          >
                            {rel.name}
                          </button>
                          <span
                            className={`text-xs font-semibold ${
                              rel.status === 'RELEASED'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            · {rel.status === 'RELEASED' ? 'Released' : 'Unreleased'}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            · Target {formatShortDate(rel.releaseDate)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{rel.description}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-44">
                          <div className="flex justify-between text-xs font-mono tabular-nums text-slate-600 mb-1">
                            <span>
                              {doneCount}/{relIssues.length} issues done
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleReleaseStatus(rel.id)}
                          className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700 whitespace-nowrap"
                        >
                          {rel.status === 'RELEASED'
                            ? 'Reopen Version'
                            : 'Mark as Released'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && relIssues.length > 0 && (
                      <div className="border-t border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                        {relIssues.map((iss) => (
                          <div
                            key={iss.id}
                            onClick={() => onSelectIssue(iss.id)}
                            className="px-5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-100 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <IssueTypeIcon type={iss.type} className="w-3.5 h-3.5" />
                              <span className="font-mono tabular-nums font-semibold text-blue-700">
                                {iss.key}
                              </span>
                              <span className="font-medium text-slate-900 truncate">
                                {iss.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span
                                className={`font-semibold ${
                                  STATUS_CONFIG[iss.status].textClass
                                }`}
                              >
                                {STATUS_CONFIG[iss.status].label}
                              </span>
                              <span className="font-mono tabular-nums text-slate-500">
                                {iss.storyPoints} pts
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Components View */
          <div className="space-y-4">
            {showCreateComp && (
              <form
                onSubmit={handleCompSubmit}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 max-w-2xl"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Create Architectural Component
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Component Name
                    </label>
                    <input
                      type="text"
                      required
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g. Cryptographic Key Vault"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Component Lead
                    </label>
                    <select
                      value={compLeadId}
                      onChange={(e) => setCompLeadId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={compDesc}
                    onChange={(e) => setCompDesc(e.target.value)}
                    placeholder="Responsibilities and service boundaries..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateComp(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Component
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold">
                    <th className="py-3 px-6">Component</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Component Lead</th>
                    <th className="py-3 px-6 text-right">Linked Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {components.map((comp) => {
                    const lead = userMap[comp.leadId];
                    const count = issues.filter((i) => i.componentId === comp.id).length;
                    return (
                      <tr key={comp.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-6 font-semibold text-slate-900">
                          {comp.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {comp.description}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <UserAvatar user={lead} size="xs" />
                            <span className="text-slate-800">{lead?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-blue-700">
                          {count} issues
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
