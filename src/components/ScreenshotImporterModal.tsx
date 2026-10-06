import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ClipboardPaste,
  FileImage,
  FolderPlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  Project,
  User,
} from '../types/jira';
import {
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
  TYPE_CONFIG,
} from './JiraPrimitives';

export interface ExtractedProfile {
  name: string;
  initials: string;
  email?: string;
  role: string;
  department?: string;
}

export interface ExtractedEpic {
  key?: string;
  title: string;
  description?: string;
}

export interface ExtractedIssue {
  key?: string;
  title: string;
  description?: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeName?: string;
  assigneeInitials?: string;
  epicTitle?: string;
  storyPoints?: number;
  dueDate?: string;
  labels?: string[];
  subtasks?: { title: string; completed: boolean }[];
}

export interface ExtractedJiraPayload {
  projectName?: string;
  projectKey?: string;
  sprintName?: string;
  sprintGoal?: string;
  profiles: ExtractedProfile[];
  epics: ExtractedEpic[];
  issues: ExtractedIssue[];
}

interface ScreenshotImporterModalProps {
  activeProject: Project;
  existingUsers: User[];
  onClose: () => void;
  onApplyImport: (
    payload: ExtractedJiraPayload,
    mode: 'MERGE_CURRENT' | 'CREATE_NEW_PROJECT'
  ) => void;
}

interface UploadedImageItem {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  base64Data: string;
}

function normalizeIssueType(raw?: string): IssueType {
  const upper = (raw || '').toUpperCase().trim();
  if (upper === 'EPIC') return IssueType.EPIC;
  if (upper === 'BUG') return IssueType.BUG;
  if (upper === 'TASK') return IssueType.TASK;
  if (upper === 'SUBTASK' || upper === 'SUB-TASK') return IssueType.SUBTASK;
  return IssueType.STORY;
}

function normalizeIssueStatus(raw?: string): IssueStatus {
  const upper = (raw || '').toUpperCase().trim();
  if (upper.includes('DONE') || upper.includes('CLOSED') || upper.includes('RESOLVED')) {
    return IssueStatus.DONE;
  }
  if (upper.includes('QA') || upper.includes('TEST')) {
    return IssueStatus.QA;
  }
  if (upper.includes('REVIEW') || upper.includes('PR')) {
    return IssueStatus.IN_REVIEW;
  }
  if (upper.includes('PROGRESS') || upper.includes('DOING') || upper.includes('ACTIVE')) {
    return IssueStatus.IN_PROGRESS;
  }
  return IssueStatus.TODO;
}

function normalizeIssuePriority(raw?: string): IssuePriority {
  const upper = (raw || '').toUpperCase().trim();
  if (upper === 'HIGHEST' || upper === 'CRITICAL' || upper === 'BLOCKER') {
    return IssuePriority.HIGHEST;
  }
  if (upper === 'HIGH' || upper === 'MAJOR') {
    return IssuePriority.HIGH;
  }
  if (upper === 'LOW' || upper === 'MINOR') {
    return IssuePriority.LOW;
  }
  if (upper === 'LOWEST' || upper === 'TRIVIAL') {
    return IssuePriority.LOWEST;
  }
  return IssuePriority.MEDIUM;
}

export const ScreenshotImporterModal: React.FC<ScreenshotImporterModalProps> = ({
  activeProject,
  existingUsers,
  onClose,
  onApplyImport,
}) => {
  const [images, setImages] = useState<UploadedImageItem[]>([]);
  const [importMode, setImportMode] = useState<'MERGE_CURRENT' | 'CREATE_NEW_PROJECT'>(
    'MERGE_CURRENT'
  );
  const [customInstructions, setCustomInstructions] = useState('');
  const [autoApplyAfterExtract, setAutoApplyAfterExtract] = useState(false);

  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedJiraPayload | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = useCallback((files: FileList | File[]) => {
    setErrorMsg(null);
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const base64Data = dataUrl.includes(',')
          ? dataUrl.split(',')[1]
          : dataUrl;
        setImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name || 'jira-screenshot.png',
            mimeType: file.type || 'image/png',
            dataUrl,
            base64Data,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Support Ctrl+V / Cmd+V clipboard paste of screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        processFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  const handleExtractScreenshots = async () => {
    if (images.length === 0) {
      setErrorMsg('Please upload or paste at least one Jira screenshot first.');
      return;
    }

    setIsExtracting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/jira/extract-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map((img) => ({
            mimeType: img.mimeType,
            data: img.base64Data,
          })),
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze screenshot.');
      }

      const normalizedPayload: ExtractedJiraPayload = {
        projectName: data.projectName || activeProject.name,
        projectKey: (data.projectKey || activeProject.key).toUpperCase().slice(0, 6),
        sprintName: data.sprintName || '',
        sprintGoal: data.sprintGoal || '',
        profiles: Array.isArray(data.profiles)
          ? data.profiles.map((p: ExtractedProfile) => ({
              name: p.name || 'Team Member',
              initials:
                (p.initials || p.name?.slice(0, 2) || 'TM')
                  .toUpperCase()
                  .slice(0, 2),
              email:
                p.email ||
                `${(p.name || 'member')
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '.')}@kawach.ai`,
              role: p.role || 'Software Engineer',
              department: p.department || 'Engineering',
            }))
          : [],
        epics: Array.isArray(data.epics) ? data.epics : [],
        issues: Array.isArray(data.issues)
          ? data.issues.map((iss: ExtractedIssue) => ({
              ...iss,
              type: normalizeIssueType(iss.type),
              status: normalizeIssueStatus(iss.status),
              priority: normalizeIssuePriority(iss.priority),
              storyPoints:
                typeof iss.storyPoints === 'number' ? iss.storyPoints : 0,
              labels: Array.isArray(iss.labels) ? iss.labels : [],
              subtasks: Array.isArray(iss.subtasks) ? iss.subtasks : [],
            }))
          : [],
      };

      if (autoApplyAfterExtract) {
        onApplyImport(normalizedPayload, importMode);
        onClose();
        return;
      }

      setExtractedData(normalizedPayload);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while reading the screenshot.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpdateExtractedProfile = (
    idx: number,
    updates: Partial<ExtractedProfile>
  ) => {
    if (!extractedData) return;
    const next = [...extractedData.profiles];
    next[idx] = { ...next[idx], ...updates };
    setExtractedData({ ...extractedData, profiles: next });
  };

  const handleUpdateExtractedIssue = (
    idx: number,
    updates: Partial<ExtractedIssue>
  ) => {
    if (!extractedData) return;
    const next = [...extractedData.issues];
    next[idx] = { ...next[idx], ...updates };
    setExtractedData({ ...extractedData, issues: next });
  };

  const handleRemoveExtractedIssue = (idx: number) => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      issues: extractedData.issues.filter((_, i) => i !== idx),
    });
  };

  const handleConfirmImport = () => {
    if (!extractedData) return;
    onApplyImport(extractedData, importMode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Import from Jira Screenshot — Auto-Create Profiles & Assign Tasks
              </h2>
              <p className="text-xs text-slate-300">
                Upload or paste screenshots of your existing Jira board, backlog, or issues to replicate team profiles, tasks, statuses, and assignments.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Step 1: Upload / Paste Screenshots */}
          {!extractedData && (
            <div className="space-y-5">
              {/* Destination Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setImportMode('MERGE_CURRENT')}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    importMode === 'MERGE_CURRENT'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-sm mb-1">
                    Import into Current Project ({activeProject.key} — {activeProject.name})
                  </div>
                  <p className="text-slate-600">
                    Creates all new team member profiles from the screenshot and adds the extracted tasks & assignments directly into {activeProject.name}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('CREATE_NEW_PROJECT')}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    importMode === 'CREATE_NEW_PROJECT'
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
                    <FolderPlus className="w-4 h-4 text-blue-600" />
                    Create New Project from Screenshot
                  </div>
                  <p className="text-slate-600">
                    Automatically creates a dedicated project using the key/name in your screenshot, adds the team profiles, and populates the board.
                  </p>
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    processFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/20 rounded-lg p-8 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      processFiles(e.target.files);
                    }
                  }}
                />
                <Upload className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                <div className="text-sm font-bold text-slate-900 mb-1">
                  Click to upload Jira screenshots, drag & drop files, or press Ctrl+V / Cmd+V to paste
                </div>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  Supports multiple screenshots at once: Kanban boards, Scrum backlogs, issue detail modals, or team member directories (PNG, JPG, WebP).
                </p>
              </div>

              {/* Uploaded Previews */}
              {images.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Uploaded Screenshots ({images.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setImages([])}
                      className="text-red-600 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="relative group border border-slate-200 rounded-md overflow-hidden bg-slate-100"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-28 object-cover"
                        />
                        <div className="px-2.5 py-1.5 bg-white border-t border-slate-200 flex items-center justify-between">
                          <span className="truncate text-[11px] text-slate-700 font-medium">
                            {img.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setImages((prev) => prev.filter((i) => i.id !== img.id))
                            }
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Custom Instructions & Auto-apply Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Optional Context / Instructions
                  </label>
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Map avatar 'YK' to Yash Kumar, or put all tasks into active sprint..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                  />
                </div>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApplyAfterExtract}
                    onChange={(e) => setAutoApplyAfterExtract(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="font-medium text-slate-800">
                    Auto-apply immediately without preview
                  </span>
                </label>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Interactive Preview & Verification of Extracted Profiles & Tasks */}
          {extractedData && (
            <div className="space-y-6">
              {/* Summary Banner */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-blue-950">
                    Extracted {extractedData.profiles.length} Team Profiles &{' '}
                    {extractedData.issues.length} Tasks from Screenshot
                  </div>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Review or adjust any profile name, role, or task assignment below, then click &ldquo;Create Profiles &amp; Assign Tasks&rdquo;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExtractedData(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-blue-300 text-blue-800 rounded hover:bg-blue-100"
                >
                  ← Upload Different Screenshot
                </button>
              </div>

              {/* Project & Sprint Metadata (if creating new project or updating sprint) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Target Project Name
                  </label>
                  <input
                    type="text"
                    value={extractedData.projectName || ''}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        projectName: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Project Key Prefix
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={extractedData.projectKey || ''}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        projectKey: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-2.5 py-1.5 font-mono uppercase bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Detected Sprint Name
                  </label>
                  <input
                    type="text"
                    value={extractedData.sprintName || ''}
                    onChange={(e) =>
                      setExtractedData({
                        ...extractedData,
                        sprintName: e.target.value,
                      })
                    }
                    placeholder="Active Sprint"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                  />
                </div>
              </div>

              {/* Extracted Team Profiles Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    Detected Team Profiles ({extractedData.profiles.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setExtractedData({
                        ...extractedData,
                        profiles: [
                          ...extractedData.profiles,
                          {
                            name: 'New Engineer',
                            initials: 'NE',
                            email: 'engineer@kawach.ai',
                            role: 'Software Engineer',
                            department: 'Engineering',
                          },
                        ],
                      })
                    }
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Profile
                  </button>
                </div>

                {extractedData.profiles.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-md text-slate-500">
                    No specific user avatars or names were detected on the screenshot cards. Tasks will remain unassigned or can be assigned below.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {extractedData.profiles.map((prof, idx) => {
                      const existingMatch = existingUsers.find(
                        (u) =>
                          u.name.toLowerCase() === prof.name.toLowerCase() ||
                          u.initials.toUpperCase() === prof.initials.toUpperCase()
                      );

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-white border border-slate-200 rounded-md flex items-center gap-3"
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                            {prof.initials}
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={prof.name}
                              onChange={(e) =>
                                handleUpdateExtractedProfile(idx, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Profile Name"
                              className="px-2 py-1 border border-slate-200 rounded font-semibold text-slate-900"
                            />
                            <input
                              type="text"
                              value={prof.role}
                              onChange={(e) =>
                                handleUpdateExtractedProfile(idx, {
                                  role: e.target.value,
                                })
                              }
                              placeholder="Role"
                              className="px-2 py-1 border border-slate-200 rounded text-slate-600"
                            />
                          </div>
                          <span
                            className={`text-[11px] font-semibold shrink-0 ${
                              existingMatch ? 'text-emerald-700' : 'text-blue-700'
                            }`}
                          >
                            {existingMatch ? 'Matched' : 'New Profile'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Extracted Tasks & Profile Assignments Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Extracted Tasks & Profile Assignments ({extractedData.issues.length})
                </h3>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3 w-24">Key</th>
                        <th className="py-2.5 px-3 w-28">Type</th>
                        <th className="py-2.5 px-3">Task Summary</th>
                        <th className="py-2.5 px-3 w-36">Status</th>
                        <th className="py-2.5 px-3 w-28">Priority</th>
                        <th className="py-2.5 px-3 w-44">Assigned Profile</th>
                        <th className="py-2.5 px-3 w-20 text-right">Pts</th>
                        <th className="py-2.5 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {extractedData.issues.map((iss, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono tabular-nums font-semibold text-blue-700">
                            {iss.key || `${extractedData.projectKey}-${101 + idx}`}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={iss.type}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  type: e.target.value as IssueType,
                                })
                              }
                              className="bg-white border border-slate-200 rounded px-1.5 py-1 font-medium"
                            >
                              {Object.values(IssueType).map((t) => (
                                <option key={t} value={t}>
                                  {TYPE_CONFIG[t].label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={iss.title}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  title: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 border border-transparent hover:border-slate-300 focus:border-blue-600 rounded font-medium text-slate-900 focus:outline-none"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={iss.status}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  status: e.target.value as IssueStatus,
                                })
                              }
                              className={`bg-white border border-slate-200 rounded px-2 py-1 font-semibold ${
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
                          <td className="py-2 px-3">
                            <select
                              value={iss.priority}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  priority: e.target.value as IssuePriority,
                                })
                              }
                              className="bg-white border border-slate-200 rounded px-1.5 py-1"
                            >
                              {Object.values(IssuePriority).map((p) => (
                                <option key={p} value={p}>
                                  {PRIORITY_CONFIG[p].label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={iss.assigneeName || iss.assigneeInitials || ''}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  assigneeName: e.target.value,
                                })
                              }
                              placeholder="Unassigned"
                              list="extracted-profiles-list"
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-medium"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={iss.storyPoints || 0}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  storyPoints: parseInt(e.target.value || '0', 10),
                                })
                              }
                              className="w-12 text-right font-mono tabular-nums px-1.5 py-1 border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveExtractedIssue(idx)}
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="extracted-profiles-list">
                    {extractedData.profiles.map((p, i) => (
                      <option key={i} value={p.name} />
                    ))}
                    {existingUsers.map((u) => (
                      <option key={u.id} value={u.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {extractedData
              ? `Ready to create ${extractedData.profiles.length} profiles and ${extractedData.issues.length} assigned tasks.`
              : 'Tip: You can paste any screenshot directly with Ctrl+V / Cmd+V.'}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>

            {!extractedData ? (
              <button
                type="button"
                disabled={isExtracting || images.length === 0}
                onClick={handleExtractScreenshots}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Screenshot & Extracting Profiles/Tasks...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    Extract Profiles & Tasks from Screenshot
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Create Profiles & Assign All Tasks ({extractedData.issues.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
