import React, { useMemo, useState } from 'react';
import { Box, CheckCircle2, Clock, Package, Plus } from 'lucide-react';
import { IssueStatus, IssueType } from '../types/arij.js';
import {
  formatShortDate,
  IssueTypeIcon,
  STATUS_CONFIG,
  UserAvatar,
} from './ArijPrimitives.jsx';

export const ReleasesAndComponentsView = ({
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
  const [subTab, setSubTab] = useState('RELEASES');
  const [selectedReleaseId, setSelectedReleaseId] = useState(
    releases[0]?.id || null
  );

  // Release form
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [relName, setRelName] = useState('');
  const [relDesc, setRelDesc] = useState('');
  const [relDate, setRelDate] = useState('2026-11-15');

  // Component form
  const [showNewComp, setShowNewComp] = useState(false);
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compLead, setCompLead] = useState(users[0]?.id || '');

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const handleAddRelease = (e) => {
    e.preventDefault();
    if (!relName.trim()) return;
    onCreateRelease({
      name: relName.trim(),
      description: relDesc.trim(),
      releaseDate: relDate,
    });
    setRelName('');
    setRelDesc('');
    setShowNewRelease(false);
  };

  const handleAddComponent = (e) => {
    e.preventDefault();
    if (!compName.trim()) return;
    onCreateComponent({
      name: compName.trim(),
      description: compDesc.trim(),
      leadId: compLead,
    });
    setCompName('');
    setCompDesc('');
    setShowNewComp(false);
  };

  const activeRelease = useMemo(
    () => releases.find((r) => r.id === selectedReleaseId) || releases[0] || null,
    [releases, selectedReleaseId]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{project.name}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">
              Releases & Architecture Components
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Release Fix Versions & System Components
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setSubTab('RELEASES')}
              className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 ${
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
              onClick={() => setShowNewRelease(!showNewRelease)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Version
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewComp(!showNewComp)}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Component
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {subTab === 'RELEASES' ? (
          <>
            {showNewRelease && (
              <form
                onSubmit={handleAddRelease}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 max-w-2xl"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Create Fix Version / Release
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Version Name
                    </label>
                    <input
                      type="text"
                      required
                      value={relName}
                      onChange={(e) => setRelName(e.target.value)}
                      placeholder="v2.6.0 — Zero-Trust Gateway"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
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
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Release Notes / Scope
                  </label>
                  <input
                    type="text"
                    value={relDesc}
                    onChange={(e) => setRelDesc(e.target.value)}
                    placeholder="Key capabilities and fixes included in this version..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewRelease(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                  >
                    Save Version
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Releases List */}
              <div className="lg:col-span-5 space-y-3">
                {releases.map((rel) => {
                  const relIssues = issues.filter(
                    (i) => i.fixVersionId === rel.id && i.type !== IssueType.EPIC
                  );
                  const doneCount = relIssues.filter(
                    (i) => i.status === IssueStatus.DONE
                  ).length;
                  const pct =
                    relIssues.length > 0
                      ? Math.round((doneCount / relIssues.length) * 100)
                      : 0;
                  const isSelected = activeRelease?.id === rel.id;

                  return (
                    <div
                      key={rel.id}
                      onClick={() => setSelectedReleaseId(rel.id)}
                      className={`p-4 bg-white border rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 ring-1 ring-blue-600/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-bold text-slate-900">
                          {rel.name}
                        </span>
                        <span
                          className={`text-[11px] font-semibold flex items-center gap-1 ${
                            rel.status === 'RELEASED'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {rel.status === 'RELEASED' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          {rel.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mb-3">
                        {rel.description}
                      </p>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Target: {formatShortDate(rel.releaseDate)}</span>
                        <span className="font-mono tabular-nums">
                          {doneCount}/{relIssues.length} issues done ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Release Detail & Issues */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
                {activeRelease ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {activeRelease.name}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Release Date: {formatShortDate(activeRelease.releaseDate)} ·{' '}
                          {activeRelease.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleReleaseStatus(activeRelease.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                          activeRelease.status === 'RELEASED'
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {activeRelease.status === 'RELEASED'
                          ? 'Mark Unreleased'
                          : 'Release Version Now'}
                      </button>
                    </div>

                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Issues Assigned to {activeRelease.name}
                    </h3>

                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-md">
                      {issues
                        .filter((i) => i.fixVersionId === activeRelease.id)
                        .map((iss) => (
                          <div
                            key={iss.id}
                            onClick={() => onSelectIssue(iss.id)}
                            className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <IssueTypeIcon type={iss.type} />
                              <span className="font-mono font-semibold text-blue-700 shrink-0">
                                {iss.key}
                              </span>
                              <span className="text-slate-900 font-medium truncate">
                                {iss.title}
                              </span>
                            </div>
                            <span
                              className={`font-semibold shrink-0 ml-3 ${
                                STATUS_CONFIG[iss.status].textClass
                              }`}
                            >
                              {STATUS_CONFIG[iss.status].label}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-12">
                    Select a release version to inspect its issues.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* COMPONENTS SUBTAB */
          <div className="space-y-4">
            {showNewComp && (
              <form
                onSubmit={handleAddComponent}
                className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 max-w-2xl"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Create Architecture Component
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Component Name
                    </label>
                    <input
                      type="text"
                      required
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g. Zero-Trust Policy Engine"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Component Lead
                    </label>
                    <select
                      value={compLead}
                      onChange={(e) => setCompLead(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
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
                    placeholder="Subsystem responsibilities..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewComp(false)}
                    className="px-3 py-1.5 text-xs text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                  >
                    Create Component
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Component Lead</th>
                    <th className="py-3 px-4 text-right">Linked Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {components.map((comp) => {
                    const lead = userMap[comp.leadId];
                    const count = issues.filter(
                      (i) => i.componentId === comp.id
                    ).length;
                    return (
                      <tr key={comp.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {comp.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {comp.description}
                        </td>
                        <td className="py-3.5 px-4">
                          <UserAvatar user={lead} size="xs" showName />
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-blue-700">
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
