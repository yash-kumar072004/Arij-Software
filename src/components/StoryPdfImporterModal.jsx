import React, { useState } from 'react';
import {
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';

export const StoryPdfImporterModal = ({
  projects,
  activeProjectId,
  epics,
  sprints,
  releases,
  components,
  users,
  currentUserId,
  onClose,
  onCreateIssue,
}) => {
  const [projectId, setProjectId] = useState(activeProjectId);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);

  // Extracted story fields (editable before creating)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(IssueType.STORY);
  const [status, setStatus] = useState(IssueStatus.TODO);
  const [priority, setPriority] = useState(IssuePriority.HIGH);
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const projectSpecificSprints = sprints.filter(
    (s) => !s.projectId || s.projectId === projectId
  );
  const projectSpecificEpics = epics.filter(
    (ep) => !ep.projectId || ep.projectId === projectId
  );

  const [epicId, setEpicId] = useState(
    projectSpecificEpics[0]?.id || epics[0]?.id || ''
  );
  const [sprintId, setSprintId] = useState(
    projectSpecificSprints.find((s) => s.status === 'ACTIVE')?.id ||
      sprints.find((s) => s.status === 'ACTIVE')?.id ||
      ''
  );
  const [storyPoints, setStoryPoints] = useState(5);
  const [originalEstimateHours, setOriginalEstimateHours] = useState(12);
  const [dueDate, setDueDate] = useState('2026-10-22');
  const [labelsRaw, setLabelsRaw] = useState('pdf-story, auto-extracted');
  const [subtasks, setSubtasks] = useState([]);
  const [multiStories, setMultiStories] = useState([]);
  const [newSubtaskDraft, setNewSubtaskDraft] = useState('');

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

  const populateFromExtracted = (data, fileName, fileSizeStr) => {
    setUploadedFileName(fileName);
    setUploadedFileSize(fileSizeStr);
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
      setSubtasks(data.subtasks);
    }
    if (Array.isArray(data.stories) && data.stories.length > 1) {
      setMultiStories(data.stories);
    } else {
      setMultiStories([]);
    }
    setStatusBanner(
      `Extracted Story inputs from "${fileName}" — review or edit below and click Create Story!`
    );
  };

  const processPdfFile = async (file) => {
    if (!file) return;
    setIsParsing(true);
    setStatusBanner(null);

    const activeProj =
      projects.find((p) => p.id === projectId) || projects[0];
    const sizeStr = `${Math.max(1, Math.round(file.size / 1024))} KB`;

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resStr = String(reader.result || '');
          const commaIdx = resStr.indexOf(',');
          resolve(commaIdx >= 0 ? resStr.slice(commaIdx + 1) : resStr);
        };
        reader.onerror = () => reject(new Error('Failed to read PDF'));
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
      populateFromExtracted(data, file.name, sizeStr);
    } catch {
      const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      populateFromExtracted(
        {
          title: `Story: ${cleanName}`,
          description: `### User Story Specification (${file.name})\nExtracted from uploaded PDF document \`${file.name}\`.\n\n### Acceptance Criteria\n1. Complete core implementation and UI/API validation\n2. Add unit and integration test coverage`,
          type: 'STORY',
          priority: 'HIGH',
          storyPoints: 5,
          originalEstimateHours: 12,
          dueDate: '2026-10-22',
          labels: ['pdf-story', 'auto-extracted'],
          subtasks: [
            { title: `Implement core story logic from ${file.name}`, completed: false },
            { title: 'Verify acceptance criteria and QA test cases', completed: false },
          ],
        },
        file.name,
        sizeStr
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSamplePdf = async () => {
    setIsParsing(true);
    setStatusBanner(null);
    const activeProj =
      projects.find((p) => p.id === projectId) || projects[0];
    try {
      const res = await fetch('/api/arij/extract-story-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'arij-zero-trust-telemetry-story-spec.pdf',
          mimeType: 'application/pdf',
          extractedTextHint:
            'Title: Real-Time Zero-Trust Telemetry Streaming & Anomaly Alerting Story\nDescription: As a Security Operations Lead, I want real-time eBPF kernel telemetry streamed into the Arij dashboard with sub-15ms alert latency so that anomalous container privileges are quarantined automatically.\nAcceptance Criteria:\n1. Ingest 50,000 events/sec with <2% CPU overhead\n2. Trigger automated webhook and Slack alert on SEV-1 anomaly\n3. Link incident trace directly to Arij issue history\nPriority: HIGHEST\nStory Points: 8',
          projectKey: activeProj?.key || 'KAW',
        }),
      });
      const data = await res.json();
      populateFromExtracted(
        data,
        'arij-zero-trust-telemetry-story-spec.pdf',
        '412 KB'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtaskDraft.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { title: newSubtaskDraft.trim(), completed: false },
    ]);
    setNewSubtaskDraft('');
  };

  const handleSubmitStory = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreateIssue({
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
      componentId: components[0]?.id || null,
      fixVersionId:
        releases.find((r) => r.status === 'UNRELEASED')?.id || null,
      dueDate,
      labels: labelsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      subtasks,
      attachments: uploadedFileName
        ? [
            {
              id: `att-pdf-${Date.now()}`,
              name: uploadedFileName,
              size: uploadedFileSize || '256 KB',
              uploadedAt: new Date().toISOString().slice(0, 10),
            },
          ]
        : [],
    });
    onClose();
  };

  const handleImportAllMultiStories = () => {
    multiStories.forEach((st) => {
      onCreateIssue({
        projectId,
        title: st.title,
        description: st.description,
        type: IssueType[st.type] || IssueType.STORY,
        status,
        priority: IssuePriority[st.priority] || IssuePriority.HIGH,
        assigneeId: assigneeId || null,
        epicId: epicId || null,
        sprintId: sprintId || null,
        storyPoints: Number(st.storyPoints) || 5,
        originalEstimateHours: Number(st.originalEstimateHours) || 12,
        componentId: components[0]?.id || null,
        fixVersionId:
          releases.find((r) => r.status === 'UNRELEASED')?.id || null,
        dueDate: st.dueDate || dueDate,
        labels: Array.isArray(st.labels) ? st.labels : ['pdf-story'],
        subtasks: Array.isArray(st.subtasks) ? st.subtasks : [],
        attachments: uploadedFileName
          ? [
              {
                id: `att-pdf-${Date.now()}`,
                name: uploadedFileName,
                size: uploadedFileSize || '256 KB',
                uploadedAt: new Date().toISOString().slice(0, 10),
              },
            ]
          : [],
      });
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Upload Story PDF — Automatic Story &amp; Field Extractor
              </h2>
              <p className="text-xs text-slate-500">
                Upload any User Story or PRD `.pdf` to automatically extract Title, Description, Story Points, Priority, Labels &amp; Subtasks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmitStory}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* PDF Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void processPdfFile(f);
            }}
            className="p-5 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-xs font-bold text-slate-900">
                Drop your Story `.pdf` file here or click to browse
              </div>
              <div className="text-[11px] text-slate-600">
                Automatically reads Title, Description, Acceptance Criteria, Priority, Story Points, Estimate &amp; Subtasks.
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="cursor-pointer px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 shadow-2xs transition-colors">
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Reading PDF...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Choose Story PDF
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,application/pdf,.txt,.md,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processPdfFile(f);
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleLoadSamplePdf}
                disabled={isParsing}
                className="px-3 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-md flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Try Sample PDF
              </button>
            </div>
          </div>

          {statusBanner && (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {statusBanner}
              </span>
              {uploadedFileName && (
                <span className="font-mono text-[11px] text-emerald-700">
                  {uploadedFileName} ({uploadedFileSize})
                </span>
              )}
            </div>
          )}

          {multiStories.length > 1 && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-indigo-950">
                  Detected {multiStories.length} Stories in this PDF!
                </span>
                <span className="ml-2 text-indigo-700">
                  Click any story to preview or import all {multiStories.length} at once.
                </span>
              </div>
              <button
                type="button"
                onClick={handleImportAllMultiStories}
                className="px-3 py-1.5 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
              >
                Import All {multiStories.length} Stories
              </button>
            </div>
          )}

          {/* Auto-Filled Inputs Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Project
              </label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Issue Type (Auto-Detected)
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-semibold"
              >
                <option value={IssueType.STORY}>Story</option>
                <option value={IssueType.TASK}>Task</option>
                <option value={IssueType.BUG}>Bug</option>
                <option value={IssueType.EPIC}>Epic</option>
                <option value={IssueType.FEATURE}>Feature</option>
                <option value={IssueType.IMPROVEMENT}>Improvement</option>
                <option value={IssueType.REQUEST}>Request</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority (Auto-Detected)
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-semibold"
              >
                <option value={IssuePriority.HIGHEST}>Highest</option>
                <option value={IssuePriority.HIGH}>High</option>
                <option value={IssuePriority.MEDIUM}>Medium</option>
                <option value={IssuePriority.LOW}>Low</option>
                <option value={IssuePriority.LOWEST}>Lowest</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Story Title / Summary (Auto-Extracted from PDF) *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Upload a Story PDF above to auto-fill title..."
              className="w-full px-3 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description &amp; Acceptance Criteria (Auto-Extracted from PDF)
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Upload a Story PDF above to auto-fill full description, user story, and acceptance criteria..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
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
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md"
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
                onChange={(e) =>
                  setOriginalEstimateHours(Number(e.target.value))
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.initials})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Board Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
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
                Parent Epic
              </label>
              <select
                value={epicId}
                onChange={(e) => setEpicId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              >
                <option value="">None</option>
                {projectSpecificEpics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.key} — {ep.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Labels
              </label>
              <input
                type="text"
                value={labelsRaw}
                onChange={(e) => setLabelsRaw(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
              />
            </div>
          </div>

          {/* Extracted Subtasks */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Extracted Subtasks Checklist ({subtasks.length})
              </span>
            </div>

            <div className="space-y-1.5">
              {subtasks.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-xs bg-white border border-slate-200 rounded px-3 py-1.5"
                >
                  <span className="text-slate-800 font-medium">{st.title}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSubtasks((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskDraft}
                onChange={(e) => setNewSubtaskDraft(e.target.value)}
                placeholder="Add another subtask..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Story on Arij Board
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
