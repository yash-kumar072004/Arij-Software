import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  GitBranch,
  Plus,
  Settings,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { STATUS_CONFIG, STATUS_ORDER, UserAvatar } from './ArijPrimitives.jsx';

const DEFAULT_WORKFLOW_TRANSITIONS = {
  BACKLOG: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
  TODO: ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'QA', 'DONE'],
  IN_PROGRESS: ['BACKLOG', 'TODO', 'IN_REVIEW', 'QA', 'DONE'],
  IN_REVIEW: ['TODO', 'IN_PROGRESS', 'QA', 'DONE'],
  QA: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
  DONE: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'QA'],
};

export const ProjectSettingsView = ({
  project,
  users,
  onUpdateProject,
  onAddUser,
}) => {
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description);
  const [category, setCategory] = useState(project.category);
  const [template, setTemplate] = useState(project.template);
  const [leadId, setLeadId] = useState(project.leadId);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(
    project.defaultAssigneeId
  );
  const [wipLimits, setWipLimits] = useState(project.wipLimits || {});
  const [workflowTransitions, setWorkflowTransitions] = useState(
    project.workflowTransitions || DEFAULT_WORKFLOW_TRANSITIONS
  );
  const [savedBanner, setSavedBanner] = useState(false);

  // Add Member Form
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [newUserDept, setNewUserDept] = useState('Engineering');
  const [newUserRbac, setNewUserRbac] = useState('MEMBER');

  // Local RBAC Role state per member
  const [memberRbacMap, setMemberRbacMap] = useState(() => {
    const map = {};
    users.forEach((u, idx) => {
      map[u.id] = u.orgRole || (idx === 0 ? 'ADMIN' : 'MEMBER');
    });
    return map;
  });

  const handleToggleTransition = (fromStatus, toStatus) => {
    setWorkflowTransitions((prev) => {
      const currentAllowed = prev[fromStatus] || [];
      const nextAllowed = currentAllowed.includes(toStatus)
        ? currentAllowed.filter((st) => st !== toStatus)
        : [...currentAllowed, toStatus];
      return {
        ...prev,
        [fromStatus]: nextAllowed,
      };
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updates = {
      name: name.trim() || project.name,
      key: key.trim().toUpperCase() || project.key,
      description,
      category,
      template,
      leadId,
      defaultAssigneeId,
      wipLimits,
      workflowTransitions,
    };
    onUpdateProject(updates);
    try {
      await fetch(`/api/projects/${project.id}/workflow`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statuses: STATUS_ORDER,
          transitions: workflowTransitions,
        }),
      });
    } catch {
      // Local state already persisted
    }
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleCreateMember = (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    onAddUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole.trim() || 'Software Engineer',
      department: newUserDept.trim() || 'Engineering',
      orgRole: newUserRbac,
    });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('');
    setShowAddUser(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{project.name}</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">Project Settings</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            Project Configuration, Configurable Workflow Transitions, WIP Limits &amp; RBAC
          </h1>
        </div>
        {savedBanner && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
            <Check className="w-3.5 h-3.5" />
            Configuration &amp; Workflow Saved
          </div>
        )}
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                General Project Details &amp; Auto-Incrementing Key ({project.key}-{project.issueCounter + 1})
              </h2>
            </div>
            <span className="font-mono text-xs text-slate-500">
              Next Issue Key: <strong className="text-blue-700">{key}-{project.issueCounter + 1}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unique Project Key Prefix
              </label>
              <input
                type="text"
                maxLength={8}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Project Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="Software Engineering">Software Engineering</option>
                <option value="Infrastructure & SRE">Infrastructure &amp; SRE</option>
                <option value="Product Management">Product Management</option>
                <option value="Security Operations">Security Operations</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Board Methodology
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="Scrum">Scrum</option>
                <option value="Kanban">Kanban</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Lead
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Assignee
              </label>
              <select
                value={defaultAssigneeId}
                onChange={(e) => setDefaultAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Column WIP Limits */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Board Column Work-In-Progress (WIP) Limits (0 = Unlimited)
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STATUS_ORDER.map((st) => (
                <div
                  key={st}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-md"
                >
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {STATUS_CONFIG[st].label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={wipLimits[st] || 0}
                    onChange={(e) =>
                      setWipLimits({
                        ...wipLimits,
                        [st]: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded text-slate-900"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Configurable Workflow Transitions Matrix (Phase 2.1) */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Configurable Project Workflow &amp; Allowed Status Transitions
                </h3>
              </div>
              <button
                type="button"
                onClick={() =>
                  setWorkflowTransitions(DEFAULT_WORKFLOW_TRANSITIONS)
                }
                className="text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Allow All Transitions
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select which status transitions are allowed when dragging issues on the Kanban board or updating status.
            </p>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
              {STATUS_ORDER.map((fromSt) => {
                const allowedTargets = workflowTransitions[fromSt] || [];
                return (
                  <div
                    key={fromSt}
                    className="p-3 bg-white flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 w-44 shrink-0">
                      <span
                        className={`font-bold ${STATUS_CONFIG[fromSt].textClass}`}
                      >
                        {STATUS_CONFIG[fromSt].label}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {STATUS_ORDER.filter((toSt) => toSt !== fromSt).map(
                        (toSt) => {
                          const isAllowed = allowedTargets.includes(toSt);
                          return (
                            <button
                              key={toSt}
                              type="button"
                              onClick={() =>
                                handleToggleTransition(fromSt, toSt)
                              }
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                isAllowed
                                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                              }`}
                            >
                              {STATUS_CONFIG[toSt].label}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Project &amp; Workflow Settings
            </button>
          </div>
        </form>

        {/* Team Members & RBAC Access Control */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Project Team Members &amp; Roles ({users.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddUser(!showAddUser)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Team Member (Creates Own Workspace)
            </button>
          </div>

          {showAddUser && (
            <form
              onSubmit={handleCreateMember}
              className="p-4 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Siddharth Roy"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="siddharth@kawach.ai"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  placeholder="Security Engineer"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={newUserDept}
                  onChange={(e) => setNewUserDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Access Role
                </label>
                <select
                  value={newUserRbac}
                  onChange={(e) => setNewUserRbac(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-semibold"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Member
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-200">
            {users.map((u) => {
              const rbacRole = memberRbacMap[u.id] || 'MEMBER';
              return (
                <div
                  key={u.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={u} size="md" />
                    <div>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-600 hidden sm:inline">
                      {u.department}
                    </span>
                    <span className="font-semibold text-slate-800 w-40 text-right hidden md:inline">
                      {u.role}
                    </span>
                    <select
                      value={rbacRole}
                      onChange={(e) =>
                        setMemberRbacMap((prev) => ({
                          ...prev,
                          [u.id]: e.target.value,
                        }))
                      }
                      aria-label={`RBAC role for ${u.name}`}
                      className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded text-slate-800"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
