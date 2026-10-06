import React, { useState } from 'react';
import { Check, Plus, Settings, ShieldAlert, Users } from 'lucide-react';
import { STATUS_CONFIG, STATUS_ORDER, UserAvatar } from './JiraPrimitives.jsx';

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
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(project.defaultAssigneeId);
  const [wipLimits, setWipLimits] = useState(project.wipLimits);
  const [savedBanner, setSavedBanner] = useState(false);

  // Add Member Form
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('');
  const [newUserDept, setNewUserDept] = useState('Engineering');

  const handleSaveSettings = (e) => {
    e.preventDefault();
    onUpdateProject({
      name: name.trim() || project.name,
      key: key.trim().toUpperCase() || project.key,
      description,
      category,
      template,
      leadId,
      defaultAssigneeId,
      wipLimits,
    });
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
            Project Configuration, WIP Limits & Team Access
          </h1>
        </div>
        {savedBanner && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
            <Check className="w-3.5 h-3.5" />
            Configuration Saved
          </div>
        )}
      </div>

      <div className="p-6 max-w-5xl space-y-6">
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-6"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Settings className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">
              General Project Details
            </h2>
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
                Project Key Prefix
              </label>
              <input
                type="text"
                maxLength={6}
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
                <option value="Infrastructure & SRE">Infrastructure & SRE</option>
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

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Project Settings
            </button>
          </div>
        </form>

        {/* Team Members & Access Control */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Project Team Members ({users.length})
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
              className="p-4 bg-slate-50 border border-slate-200 rounded-md grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
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
                  Role
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
            {users.map((u) => (
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
                <div className="flex items-center gap-6">
                  <span className="text-slate-600">{u.department}</span>
                  <span className="font-semibold text-slate-800 w-44 text-right">
                    {u.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
