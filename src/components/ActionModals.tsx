import React, { useState } from 'react';
import { CheckCircle2, FolderPlus, Play, Plus, X } from 'lucide-react';
import {
  Issue,
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  ProjectComponent,
  ReleaseVersion,
  Sprint,
  SprintStatus,
  User,
} from '../types/jira';
import { PRIORITY_CONFIG, STATUS_CONFIG, STATUS_ORDER, TYPE_CONFIG } from './JiraPrimitives';

interface CreateIssueModalProps {
  projects: Project[];
  activeProjectId: string;
  epics: Issue[];
  sprints: Sprint[];
  releases: ReleaseVersion[];
  components: ProjectComponent[];
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onCreate: (payload: {
    projectId: string;
    title: string;
    description: string;
    type: IssueType;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId: string | null;
    epicId: string | null;
    sprintId: string | null;
    storyPoints: number;
    originalEstimateHours: number;
    componentId: string | null;
    fixVersionId: string | null;
    dueDate: string;
    labels: string[];
  }) => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  projects,
  activeProjectId,
  epics,
  sprints,
  releases,
  components,
  users,
  currentUserId,
  onClose,
  onCreate,
}) => {
  const activeSprint = sprints.find((s) => s.status === SprintStatus.ACTIVE);
  const [projectId, setProjectId] = useState(activeProjectId);
  const [type, setType] = useState<IssueType>(IssueType.STORY);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<IssueStatus>(IssueStatus.TODO);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [assigneeId, setAssigneeId] = useState<string>(currentUserId);
  const [epicId, setEpicId] = useState<string>('NONE');
  const [sprintId, setSprintId] = useState<string>(
    activeSprint ? activeSprint.id : 'BACKLOG'
  );
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [estimateHours, setEstimateHours] = useState<number>(8);
  const [componentId, setComponentId] = useState<string>('NONE');
  const [fixVersionId, setFixVersionId] = useState<string>('NONE');
  const [dueDate, setDueDate] = useState<string>('2026-10-18');
  const [labelsInput, setLabelsInput] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const labels = labelsInput
      .split(',')
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
      .filter(Boolean);

    onCreate({
      projectId,
      title: title.trim(),
      description: description.trim(),
      type,
      status,
      priority,
      assigneeId: assigneeId === 'UNASSIGNED' ? null : assigneeId,
      epicId: epicId === 'NONE' ? null : epicId,
      sprintId: sprintId === 'BACKLOG' ? null : sprintId,
      storyPoints: type === IssueType.EPIC ? 0 : storyPoints,
      originalEstimateHours: estimateHours,
      componentId: componentId === 'NONE' ? null : componentId,
      fixVersionId: fixVersionId === 'NONE' ? null : fixVersionId,
      dueDate,
      labels,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Create Issue</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Issue Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IssueType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-semibold"
              >
                {Object.values(IssueType).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_CONFIG[t].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Summary <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Concise summary of the story, task, or bug..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description & Acceptance Criteria
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical context, reproduction steps, or acceptance criteria..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IssueStatus)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                {STATUS_ORDER.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                {Object.values(IssuePriority).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_CONFIG[p].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
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

          {type !== IssueType.EPIC && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sprint</label>
                <select
                  value={sprintId}
                  onChange={(e) => setSprintId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
                >
                  <option value="BACKLOG">Backlog</option>
                  {sprints
                    .filter((s) => s.status !== SprintStatus.COMPLETED)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Epic Link</label>
                <select
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
                >
                  <option value="NONE">No Epic</option>
                  {epics.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.key} — {ep.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Story Points
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={storyPoints}
                onChange={(e) => setStoryPoints(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Original Estimate (Hours)
              </label>
              <input
                type="number"
                min={0}
                value={estimateHours}
                onChange={(e) => setEstimateHours(parseInt(e.target.value || '0', 10))}
                className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Component</label>
              <select
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="NONE">None</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fix Version</label>
              <select
                value={fixVersionId}
                onChange={(e) => setFixVersionId(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="NONE">None</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Labels (comma-separated)
              </label>
              <input
                type="text"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                placeholder="security, abac, api"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StartSprintModalProps {
  sprint: Sprint;
  issueCount: number;
  totalPoints: number;
  onClose: () => void;
  onConfirmStart: (sprintId: string, updates: {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
  }) => void;
}

export const StartSprintModal: React.FC<StartSprintModalProps> = ({
  sprint,
  issueCount,
  totalPoints,
  onClose,
  onConfirmStart,
}) => {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  const [startDate, setStartDate] = useState(sprint.startDate || '2026-10-05');
  const [endDate, setEndDate] = useState(sprint.endDate || '2026-10-19');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmStart(sprint.id, {
      name: name.trim() || sprint.name,
      goal: goal.trim(),
      startDate,
      endDate,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Start Sprint</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-900 font-medium">
            <span className="font-mono tabular-nums font-bold">{issueCount}</span> issues (
            <span className="font-mono tabular-nums font-bold">{totalPoints} pts</span>) will be included in this active sprint.
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sprint Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sprint Goal</label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What objective will the engineering team achieve during this sprint?"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Start Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CompleteSprintModalProps {
  sprint: Sprint;
  sprintIssues: Issue[];
  plannedSprints: Sprint[];
  onClose: () => void;
  onConfirmComplete: (sprintId: string, destinationSprintId: string | null) => void;
}

export const CompleteSprintModal: React.FC<CompleteSprintModalProps> = ({
  sprint,
  sprintIssues,
  plannedSprints,
  onClose,
  onConfirmComplete,
}) => {
  const completedIssues = sprintIssues.filter((i) => i.status === IssueStatus.DONE);
  const incompleteIssues = sprintIssues.filter((i) => i.status !== IssueStatus.DONE);
  const completedPts = completedIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const incompletePts = incompleteIssues.reduce((s, i) => s + (i.storyPoints || 0), 0);

  const [destination, setDestination] = useState<string>(
    plannedSprints[0]?.id || 'BACKLOG'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmComplete(
      sprint.id,
      destination === 'BACKLOG' ? null : destination
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Complete {sprint.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md">
              <div className="text-emerald-800 font-semibold mb-1">
                Completed Issues
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-900">
                {completedIssues.length} issues ({completedPts} pts)
              </div>
            </div>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-md">
              <div className="text-amber-800 font-semibold mb-1">
                Open / Incomplete Issues
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-900">
                {incompleteIssues.length} issues ({incompletePts} pts)
              </div>
            </div>
          </div>

          {incompleteIssues.length > 0 && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Move {incompleteIssues.length} open issues to:
              </label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-medium text-slate-800"
              >
                {plannedSprints.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name} (Planned Sprint)
                  </option>
                ))}
                <option value="BACKLOG">Project Backlog</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Complete Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CreateProjectModalProps {
  users: User[];
  currentUserId: string;
  onClose: () => void;
  onCreateProject: (payload: {
    name: string;
    key: string;
    description: string;
    category: Project['category'];
    template: Project['template'];
    leadId: string;
  }) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  users,
  currentUserId,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Project['category']>('Software Engineering');
  const [template, setTemplate] = useState<Project['template']>('Scrum');
  const [leadId, setLeadId] = useState(currentUserId);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!key || key.length <= 4) {
      const generated = val
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
      setKey(generated || val.slice(0, 3).toUpperCase());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    onCreateProject({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim(),
      category,
      template,
      leadId,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Create New Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Project Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Cloud Data Pipeline"
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Key <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="CDP"
                className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project mission and engineering scope..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Agile Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as Project['template'])}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="Scrum">Scrum (Sprints & Backlog)</option>
                <option value="Kanban">Kanban (Continuous Flow)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Project['category'])}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="Software Engineering">Software Engineering</option>
                <option value="Platform Infrastructure">Platform Infrastructure</option>
                <option value="Security & Compliance">Security & Compliance</option>
                <option value="Product Design">Product Design</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Project Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
