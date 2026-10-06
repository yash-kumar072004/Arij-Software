import React, { useState } from 'react';
import { Check, Plus, Settings, Shield, Users } from 'lucide-react';
import { IssueStatus, Project, User } from '../types/jira';
import { STATUS_CONFIG, STATUS_ORDER, UserAvatar } from './JiraPrimitives';

interface ProjectSettingsViewProps {
  project: Project;
  users: User[];
  onUpdateProject: (updates: Partial<Project>) => void;
  onAddUser: (payload: { name: string; email: string; role: string; department: string }) => void;
}

export const ProjectSettingsView: React.FC<ProjectSettingsViewProps> = ({
  project,
  users,
  onUpdateProject,
  onAddUser,
}) => {
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description);
  const [category, setCategory] = useState<Project['category']>(project.category);
  const [template, setTemplate] = useState<Project['template']>(project.template);
  const [leadId, setLeadId] = useState(project.leadId);
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string>(
    project.defaultAssigneeId || 'UNASSIGNED'
  );
  const [wipLimits, setWipLimits] = useState<Record<IssueStatus, number>>({
    ...project.wipLimits,
  });
  const [savedNotice, setSavedNotice] = useState(false);

  // Add member state
  const [addingMember, setAddingMember] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('Senior Software Engineer');
  const [memberDept, setMemberDept] = useState('Core Platform');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProject({
      name: name.trim() || project.name,
      key: key.trim().toUpperCase() || project.key,
      description: description.trim(),
      category,
      template,
      leadId,
      defaultAssigneeId: defaultAssigneeId === 'UNASSIGNED' ? null : defaultAssigneeId,
      wipLimits,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) return;
    onAddUser({
      name: memberName.trim(),
      email: memberEmail.trim(),
      role: memberRole.trim(),
      department: memberDept.trim(),
    });
    setMemberName('');
    setMemberEmail('');
    setAddingMember(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <span>Projects</span>
          <span>/</span>
          <span>{project.name}</span>
          <span>/</span>
          <span className="font-mono tabular-nums text-slate-700">Project & Board Settings</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Project Configuration & Access
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="max-w-4xl space-y-6">
          {/* General Project Details & Board WIP Form */}
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  General Project Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure project identifiers, workflow template, and default assignment rules.
                </p>
              </div>
              {savedNotice && (
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Settings saved
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Key (Prefix for Issue Keys)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Project['category'])}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Platform Infrastructure">Platform Infrastructure</option>
                  <option value="Security & Compliance">Security & Compliance</option>
                  <option value="Product Design">Product Design</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Board Template
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as Project['template'])}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Scrum">Scrum (Sprints & Backlog)</option>
                  <option value="Kanban">Kanban (Continuous Flow)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Lead
                </label>
                <select
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
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
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="UNASSIGNED">Unassigned</option>
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
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Board Column Work-In-Progress (WIP) Limits
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Set maximum concurrent issues per workflow state (0 = unlimited). Columns exceeding their limit are highlighted on the board.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {STATUS_ORDER.map((status) => (
                  <div
                    key={status}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-md"
                  >
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {STATUS_CONFIG[status].label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={wipLimits[status] || 0}
                      onChange={(e) =>
                        setWipLimits((prev) => ({
                          ...prev,
                          [status]: Math.max(0, parseInt(e.target.value || '0', 10)),
                        }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Project Settings
              </button>
            </div>
          </form>

          {/* Workspace Team Members */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Project Team & Access Roles
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage engineers, product managers, and QA leads who can be assigned issues.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddingMember((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Team Member
              </button>
            </div>

            {addingMember && (
              <form
                onSubmit={handleAddMemberSubmit}
                className="p-4 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="e.g. Rohan Verma"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="rohan@kawach.ai"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingMember(false)}
                    className="px-2 py-1.5 text-xs text-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={u} size="sm" />
                    <div>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-slate-500">{u.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-slate-800">{u.role}</div>
                    <div className="text-slate-500">{u.department}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
