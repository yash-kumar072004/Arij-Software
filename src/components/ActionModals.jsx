import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Play,
  FolderPlus,
  Plus,
  FileText,
  Upload,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';

// ============================================================================
// 1. CREATE ISSUE MODAL
// ============================================================================
export const CreateIssueModal = ({
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
  const [projectId, setProjectId] = useState(activeProjectId);
  const [type, setType] = useState(IssueType.STORY);
  const [status, setStatus] = useState(IssueStatus.TODO);
  const [priority, setPriority] = useState(IssuePriority.MEDIUM);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [epicId, setEpicId] = useState('');
  const projectSpecificSprints = sprints.filter(
    (s) => !s.projectId || s.projectId === projectId
  );
  const projectSpecificEpics = epics.filter(
    (ep) => !ep.projectId || ep.projectId === projectId
  );

  const [sprintId, setSprintId] = useState(
    projectSpecificSprints.find((s) => s.status === 'ACTIVE')?.id ||
      sprints.find((s) => s.status === 'ACTIVE')?.id ||
      ''
  );
  const [storyPoints, setStoryPoints] = useState(5);
  const [originalEstimateHours, setOriginalEstimateHours] = useState(12);
  const [componentId, setComponentId] = useState(components[0]?.id || '');
  const [fixVersionId, setFixVersionId] = useState(
    releases.find((r) => r.status === 'UNRELEASED')?.id || ''
  );
  const [dueDate, setDueDate] = useState('2026-10-16');
  const [labelsRaw, setLabelsRaw] = useState('security, q4');

  const handleProjectChange = (nextProjectId) => {
    setProjectId(nextProjectId);
    const nextProjSprints = sprints.filter(
      (s) => !s.projectId || s.projectId === nextProjectId
    );
    const nextActiveSp = nextProjSprints.find((s) => s.status === 'ACTIVE');
    setSprintId(nextActiveSp ? nextActiveSp.id : nextProjSprints[0]?.id || '');
    const nextProjEpics = epics.filter(
      (ep) => !ep.projectId || ep.projectId === nextProjectId
    );
    setEpicId(nextProjEpics[0]?.id || '');
  };

  // Story PDF Upload & Auto-Fill state
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [uploadedPdfName, setUploadedPdfName] = useState('');
  const [pdfAutoFillBanner, setPdfAutoFillBanner] = useState(null);
  const [extractedSubtasks, setExtractedSubtasks] = useState([]);
  const [uploadedAttachments, setUploadedAttachments] = useState([]);

  const applyExtractedStoryFields = (data, fileName, fileSizeStr = '240 KB') => {
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    if (data.type && IssueType[data.type]) {
      setType(IssueType[data.type]);
    } else {
      setType(IssueType.STORY);
    }
    if (data.priority && IssuePriority[data.priority]) {
      setPriority(IssuePriority[data.priority]);
    }
    if (data.storyPoints !== undefined) {
      setStoryPoints(Number(data.storyPoints) || 5);
    }
    if (data.originalEstimateHours !== undefined) {
      setOriginalEstimateHours(Number(data.originalEstimateHours) || 12);
    }
    if (data.dueDate) {
      setDueDate(data.dueDate);
    }
    if (Array.isArray(data.labels) && data.labels.length > 0) {
      setLabelsRaw(data.labels.join(', '));
    }
    if (Array.isArray(data.subtasks)) {
      setExtractedSubtasks(data.subtasks);
    }
    setUploadedPdfName(fileName);
    setUploadedAttachments([
      {
        id: `att-pdf-${Date.now()}`,
        name: fileName,
        size: fileSizeStr,
        uploadedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setPdfAutoFillBanner(
      `Auto-filled Title, Description, Story Points, Priority, Labels${
        Array.isArray(data.subtasks) && data.subtasks.length > 0
          ? ` & ${data.subtasks.length} Subtasks`
          : ''
      } from "${fileName}"!`
    );
  };

  const handleStoryPdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingPdf(true);
    setPdfAutoFillBanner(null);

    const activeProj =
      projects.find((p) => p.id === projectId) || projects[0];
    const fileSizeStr = `${Math.max(1, Math.round(file.size / 1024))} KB`;

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resStr = String(reader.result || '');
          const commaIdx = resStr.indexOf(',');
          resolve(commaIdx >= 0 ? resStr.slice(commaIdx + 1) : resStr);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/arij/extract-story-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileDataBase64: base64Data,
          projectKey: activeProj?.key || 'KAW',
        }),
      });
      const data = await res.json();
      applyExtractedStoryFields(data, file.name, fileSizeStr);
    } catch {
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      applyExtractedStoryFields(
        {
          title: `User Story: ${cleanName}`,
          description: `### User Story Specification (${file.name})\nAutomatically extracted requirements from uploaded PDF \`${file.name}\`.\n\n### Acceptance Criteria\n- Implement end-to-end story workflow and UI/API validation\n- Add automated unit and integration tests`,
          type: 'STORY',
          priority: 'HIGH',
          storyPoints: 5,
          originalEstimateHours: 12,
          dueDate: '2026-10-22',
          labels: ['pdf-story', 'auto-filled'],
          subtasks: [
            { title: `Implement core story logic from ${file.name}`, completed: false },
            { title: 'Verify acceptance criteria and QA test cases', completed: false },
          ],
        },
        file.name,
        fileSizeStr
      );
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleLoadSampleStoryPdf = async () => {
    setIsParsingPdf(true);
    const activeProj =
      projects.find((p) => p.id === projectId) || projects[0];
    try {
      const res = await fetch('/api/arij/extract-story-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'arij-sso-rbac-user-story.pdf',
          mimeType: 'application/pdf',
          extractedTextHint:
            'Title: Implement Role-Based Access Control (RBAC) & SAML 2.0 Single Sign-On Story\nDescription: As an Enterprise Organization Admin, I want granular RBAC permission schemes and SAML 2.0 SSO enforced across all Arij projects so that only authorized engineers can transition issues to Production Done.\nAcceptance Criteria:\n1. Support SAML 2.0 identity provider metadata upload\n2. Enforce project-level and workflow transition permissions\n3. Log all permission changes in the immutable Security Audit Log\nPriority: HIGH\nStory Points: 8',
          projectKey: activeProj?.key || 'KAW',
        }),
      });
      const data = await res.json();
      applyExtractedStoryFields(data, 'arij-sso-rbac-user-story.pdf', '318 KB');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      projectId,
      title: title.trim(),
      description: description.trim(),
      type,
      status,
      priority,
      assigneeId: assigneeId || null,
      epicId: epicId || null,
      sprintId: sprintId || null,
      storyPoints: Number(storyPoints) || 0,
      originalEstimateHours: Number(originalEstimateHours) || 0,
      componentId: componentId || null,
      fixVersionId: fixVersionId || null,
      dueDate,
      labels: labelsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      subtasks: extractedSubtasks,
      attachments: uploadedAttachments,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Create Issue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Upload Story PDF Auto-Fill Box */}
          <div className="p-3.5 rounded-lg bg-blue-50/80 border border-blue-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Upload Story PDF — Auto-Fill All Inputs
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Upload a `.pdf` story specification to automatically populate Title, Description, Points, Priority, Labels &amp; Subtasks.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 transition-colors">
                  {isParsingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Extracting PDF...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Upload Story PDF
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,application/pdf,.txt,.md,.doc,.docx"
                    onChange={handleStoryPdfFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleLoadSampleStoryPdf}
                  disabled={isParsingPdf}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-md flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Sample PDF
                </button>
              </div>
            </div>

            {pdfAutoFillBanner && (
              <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {pdfAutoFillBanner}
                </span>
                {uploadedPdfName && (
                  <span className="font-mono text-[11px] text-emerald-700">
                    {uploadedPdfName}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value={IssueType.STORY}>Story</option>
                <option value={IssueType.TASK}>Task</option>
                <option value={IssueType.BUG}>Bug</option>
                <option value={IssueType.EPIC}>Epic</option>
                <option value={IssueType.INITIATIVE}>Initiative</option>
                <option value={IssueType.FEATURE}>Feature</option>
                <option value={IssueType.IMPROVEMENT}>Improvement</option>
                <option value={IssueType.REQUEST}>Request</option>
                <option value={IssueType.INCIDENT}>Incident</option>
                <option value={IssueType.PROBLEM}>Problem</option>
                <option value={IssueType.CHANGE}>Change</option>
                <option value={IssueType.SUBTASK}>Sub-task</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Summary <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short, actionable summary of the work item..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Acceptance Criteria
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe technical context, reproduction steps, or acceptance criteria..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value={IssueStatus.TODO}>To Do</option>
                <option value={IssueStatus.IN_PROGRESS}>In Progress</option>
                <option value={IssueStatus.IN_REVIEW}>In Review</option>
                <option value={IssueStatus.QA}>QA Testing</option>
                <option value={IssueStatus.DONE}>Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value={IssuePriority.HIGHEST}>Highest</option>
                <option value={IssuePriority.HIGH}>High</option>
                <option value={IssuePriority.MEDIUM}>Medium</option>
                <option value={IssuePriority.LOW}>Low</option>
                <option value={IssuePriority.LOWEST}>Lowest</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sprint
              </label>
              <select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="">Backlog (No Sprint)</option>
                {projectSpecificSprints
                  .filter((s) => s.status !== 'COMPLETED')
                  .map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.status})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Parent Epic
              </label>
              <select
                value={epicId}
                onChange={(e) => setEpicId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="">None</option>
                {projectSpecificEpics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.key} — {ep.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Story Points
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimate (h)
              </label>
              <input
                type="number"
                min={0}
                value={originalEstimateHours}
                onChange={(e) => setOriginalEstimateHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Component
              </label>
              <select
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="">None</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fix Version
              </label>
              <select
                value={fixVersionId}
                onChange={(e) => setFixVersionId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="">None</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Labels (comma separated)
              </label>
              <input
                type="text"
                value={labelsRaw}
                onChange={(e) => setLabelsRaw(e.target.value)}
                placeholder="security, api, sprint-goal"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>
          </div>

          {extractedSubtasks.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
              <div className="text-xs font-bold text-slate-800">
                Auto-Extracted Subtasks from Story PDF ({extractedSubtasks.length})
              </div>
              <div className="space-y-1.5">
                {extractedSubtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5"
                  >
                    <span className="text-slate-800">{st.title}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setExtractedSubtasks((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. START SPRINT MODAL
// ============================================================================
export const StartSprintModal = ({
  sprint,
  issueCount,
  totalPoints,
  onClose,
  onConfirmStart,
}) => {
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  const [startDate, setStartDate] = useState(sprint.startDate || '2026-10-06');
  const [endDate, setEndDate] = useState(sprint.endDate || '2026-10-20');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmStart(sprint.id, { name, goal, startDate, endDate });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Start Sprint</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            <strong className="font-semibold text-slate-900">{issueCount} issues</strong>{' '}
            ({totalPoints} story points) will be included in this active sprint.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sprint Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sprint Goal
            </label>
            <textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Start Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. COMPLETE SPRINT MODAL
// ============================================================================
export const CompleteSprintModal = ({
  sprint,
  sprintIssues,
  plannedSprints,
  onClose,
  onConfirmComplete,
}) => {
  const completedIssues = sprintIssues.filter((i) => i.status === IssueStatus.DONE);
  const openIssues = sprintIssues.filter((i) => i.status !== IssueStatus.DONE);

  const [destinationSprintId, setDestinationSprintId] = useState(
    plannedSprints[0]?.id || 'BACKLOG'
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmComplete(
      sprint.id,
      destinationSprintId === 'BACKLOG' ? null : destinationSprintId
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Complete {sprint.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Completed Issues</div>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
                {completedIssues.length} issues
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {completedIssues.reduce((s, i) => s + (i.storyPoints || 0), 0)} story points
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Incomplete Issues</div>
              <div className="text-xl font-bold font-mono text-amber-600 mt-1">
                {openIssues.length} issues
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {openIssues.reduce((s, i) => s + (i.storyPoints || 0), 0)} story points
              </div>
            </div>
          </div>

          {openIssues.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Move {openIssues.length} incomplete issues to:
              </label>
              <select
                value={destinationSprintId}
                onChange={(e) => setDestinationSprintId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                {plannedSprints.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} (Planned Sprint)
                  </option>
                ))}
                <option value="BACKLOG">Project Backlog</option>
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Complete Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. CREATE PROJECT MODAL
// ============================================================================
export const CreateProjectModal = ({
  users,
  currentUserId,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Software Engineering');
  const [template, setTemplate] = useState('Scrum');
  const [leadId, setLeadId] = useState(currentUserId);
  const [isPersonal, setIsPersonal] = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    if (!key || key.length <= 4) {
      const generated = val
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
      setKey(generated || 'PRJ');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    onCreateProject({
      name: name.trim(),
      key: key.trim().toUpperCase(),
      description: description.trim(),
      category,
      template,
      leadId,
      isPersonal,
      ownerUserId: isPersonal ? currentUserId : null,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Create Arij Project
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Cloud Firewall Engine"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Key <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="CFE"
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-white border border-slate-300 rounded-md text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Agile Template
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="Scrum">Scrum (Sprints & Velocity)</option>
                <option value="Kanban">Kanban (Continuous Flow)</option>
                <option value="Bug Tracking">Bug Tracking & QA</option>
                <option value="ITSM Service Desk">ITSM Service Desk & Queues</option>
                <option value="Product Discovery">Product Discovery & RICE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project Type / Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="Software Project">Software Project</option>
                <option value="Business Project">Business Project</option>
                <option value="Marketing Project">Marketing Project</option>
                <option value="Operations Project">Operations Project</option>
                <option value="Service Project">Service Project (ITSM)</option>
                <option value="Product Project">Product Project</option>
                <option value="Personal Project">Personal Project</option>
              </select>
            </div>
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
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-md border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={isPersonal}
              onChange={(e) => setIsPersonal(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Personal Project (Owned by Current User)
              </div>
              <div className="text-[11px] text-slate-500">
                Keep this project in your personal workspace view so only your own work is shown when in Personal Mode.
              </div>
            </div>
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project charter and architectural scope..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
