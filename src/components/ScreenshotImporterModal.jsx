import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  FileImage,
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
} from '../types/arij.js';
import {
  IssueTypeIcon,
  PRIORITY_CONFIG,
  PriorityIcon,
  STATUS_CONFIG,
  STATUS_ORDER,
} from './ArijPrimitives.jsx';

export const ScreenshotImporterModal = ({
  activeProject,
  existingUsers,
  onClose,
  onApplyImport,
}) => {
  const [images, setImages] = useState([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [importMode, setImportMode] = useState('MERGE_CURRENT');

  const fileInputRef = useRef(null);

  const readFiles = (fileList) => {
    setError(null);
    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setImages((prev) => [
          ...prev,
          {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name || 'arij-screenshot.png',
            mimeType: file.type || 'image/png',
            base64Data: base64,
            previewUrl: result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      readFiles(files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      readFiles(e.dataTransfer.files);
    }
  };

  const handleAnalyzeScreenshots = async () => {
    if (images.length === 0) {
      setError('Please upload or paste at least one board screenshot.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/arij/extract-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map((img) => ({
            mimeType: img.mimeType,
            data: img.base64Data,
          })),
          customInstructions,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Failed to analyze screenshot (${response.status})`
        );
      }

      const raw = await response.json();

      // Normalize enums & fields safely
      const normalizedProfiles = (raw.profiles || []).map((p) => {
        const name = (p.name || 'Team Member').trim();
        const initials = (
          p.initials ||
          name
            .split(/\s+/)
            .map((w) => w[0])
            .join('')
            .slice(0, 2) ||
          'TM'
        ).toUpperCase();
        return {
          name,
          initials,
          email:
            p.email ||
            `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@kawach.ai`,
          role: p.role || 'Software Engineer',
          department: p.department || 'Engineering',
        };
      });

      const validTypes = Object.values(IssueType);
      const validStatuses = Object.values(IssueStatus);
      const validPriorities = Object.values(IssuePriority);

      const normalizedIssues = (raw.issues || []).map((iss, idx) => {
        const rawType = String(iss.type || 'TASK').toUpperCase();
        const rawStatus = String(iss.status || 'TODO').toUpperCase();
        const rawPrio = String(iss.priority || 'MEDIUM').toUpperCase();

        return {
          key: iss.key || `${raw.projectKey || activeProject.key}-${200 + idx}`,
          title: iss.title || 'Untitled Imported Task',
          description:
            iss.description || 'Imported from board screenshot analysis.',
          type: validTypes.includes(rawType) ? rawType : IssueType.TASK,
          status: validStatuses.includes(rawStatus)
            ? rawStatus
            : IssueStatus.TODO,
          priority: validPriorities.includes(rawPrio)
            ? rawPrio
            : IssuePriority.MEDIUM,
          assigneeName: iss.assigneeName || '',
          assigneeInitials: (iss.assigneeInitials || '').toUpperCase(),
          epicTitle: iss.epicTitle || '',
          storyPoints: Number(iss.storyPoints) || 3,
          dueDate: iss.dueDate || '2026-10-18',
          labels: Array.isArray(iss.labels) ? iss.labels : ['screenshot-import'],
          subtasks: Array.isArray(iss.subtasks) ? iss.subtasks : [],
        };
      });

      setExtracted({
        projectName: raw.projectName || `${activeProject.name} (Imported)`,
        projectKey: (raw.projectKey || activeProject.key).toUpperCase().slice(0, 6),
        sprintName: raw.sprintName || `${activeProject.key} Imported Sprint`,
        sprintGoal:
          raw.sprintGoal ||
          'Complete all tasks and stories extracted from screenshot.',
        profiles: normalizedProfiles,
        epics: Array.isArray(raw.epics) ? raw.epics : [],
        issues: normalizedIssues,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not extract data from screenshot.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateExtractedProfile = (index, updates) => {
    if (!extracted) return;
    const next = [...extracted.profiles];
    next[index] = { ...next[index], ...updates };
    setExtracted({ ...extracted, profiles: next });
  };

  const handleRemoveExtractedProfile = (index) => {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      profiles: extracted.profiles.filter((_, i) => i !== index),
    });
  };

  const handleAddBlankProfile = () => {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      profiles: [
        ...extracted.profiles,
        {
          name: 'New Team Member',
          initials: 'NM',
          email: 'member@kawach.ai',
          role: 'Software Engineer',
          department: 'Engineering',
        },
      ],
    });
  };

  const handleUpdateExtractedIssue = (index, updates) => {
    if (!extracted) return;
    const next = [...extracted.issues];
    next[index] = { ...next[index], ...updates };
    setExtracted({ ...extracted, issues: next });
  };

  const handleRemoveExtractedIssue = (index) => {
    if (!extracted) return;
    setExtracted({
      ...extracted,
      issues: extracted.issues.filter((_, i) => i !== index),
    });
  };

  const handleConfirmApply = () => {
    if (!extracted) return;
    onApplyImport(extracted, importMode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      onPaste={handlePaste}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Arij Screenshot-to-Workspace Replicator
              </h2>
              <p className="text-xs text-slate-300">
                Upload or paste screenshots of any board, backlog, or issue list — we automatically create the exact profiles, tasks, statuses, and assignments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Upload / Dropzone */}
          {!extracted && (
            <div className="space-y-5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-300 hover:border-blue-600 bg-blue-50/40 hover:bg-blue-50/80 rounded-lg p-8 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && readFiles(e.target.files)}
                />
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Click to upload board screenshots, drag & drop images, or press{' '}
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded">
                    Ctrl+V
                  </kbd>{' '}
                  to paste
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
                  Supports multiple screenshots at once (Kanban Board columns, Active Sprint, Backlog rows, or Team Roster). Every visible user avatar/name and task card will be extracted and linked.
                </p>
              </div>

              {/* Uploaded Image Previews */}
              {images.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Uploaded Screenshots ({images.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add More Screenshots
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className="group relative border border-slate-200 rounded-md overflow-hidden bg-slate-100 aspect-video flex flex-col justify-between"
                      >
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setImages((prev) =>
                              prev.filter((x) => x.id !== img.id)
                            )
                          }
                          className="absolute top-1.5 right-1.5 p-1 bg-slate-900/80 text-white rounded hover:bg-red-600 transition-colors"
                          title="Remove screenshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[10px] px-2 py-1 truncate">
                          {img.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Custom Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Extraction Hints (e.g., map initials &ldquo;YK&rdquo; to &ldquo;Yash Kumar&rdquo;)
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Example: Initials YK = Yash Kumar, AK = Arjun Mehta, assign all unassigned bugs to QA..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* How It Works */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <FileImage className="w-4 h-4 text-blue-600" />
                    1. Upload Board / Backlog Image
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Drop one or more screenshots from your existing workspace.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    2. Auto-Create User Profiles
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Detects every assignee name & avatar monogram, creating or matching their user profile.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-1">
                    <ClipboardPaste className="w-4 h-4 text-purple-600" />
                    3. Assign Exact Same Tasks
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Recreates all issues, keys, priorities, story points, and assigns each task to the exact user.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Review & Edit Extracted Profiles + Tasks before Importing */}
          {extracted && (
            <div className="space-y-6">
              {/* Summary Banner & Import Target Mode */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      Extracted {extracted.profiles.length} User Profiles &{' '}
                      {extracted.issues.length} Tasks from Screenshot(s)
                    </div>
                    <div className="text-xs text-slate-600">
                      Review or tweak any profile name, role, or task assignment below before importing into your workspace.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-md border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('MERGE_CURRENT')}
                    className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                      importMode === 'MERGE_CURRENT'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Import into {activeProject.key}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('CREATE_NEW_PROJECT')}
                    className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                      importMode === 'CREATE_NEW_PROJECT'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Create New Project ({extracted.projectKey})
                  </button>
                </div>
              </div>

              {importMode === 'CREATE_NEW_PROJECT' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      New Project Name
                    </label>
                    <input
                      type="text"
                      value={extracted.projectName || ''}
                      onChange={(e) =>
                        setExtracted({
                          ...extracted,
                          projectName: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Project Key
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={extracted.projectKey || ''}
                      onChange={(e) =>
                        setExtracted({
                          ...extracted,
                          projectKey: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Active Sprint Name
                    </label>
                    <input
                      type="text"
                      value={extracted.sprintName || ''}
                      onChange={(e) =>
                        setExtracted({
                          ...extracted,
                          sprintName: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Section A: Extracted User Profiles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Detected User Profiles ({extracted.profiles.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBlankProfile}
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Profile
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extracted.profiles.map((prof, idx) => {
                    const matchedExisting = existingUsers.find(
                      (u) =>
                        u.name.toLowerCase() === prof.name.toLowerCase() ||
                        u.initials.toUpperCase() === prof.initials.toUpperCase()
                    );
                    const assignedCount = extracted.issues.filter(
                      (i) =>
                        (i.assigneeName &&
                          i.assigneeName.toLowerCase() ===
                            prof.name.toLowerCase()) ||
                        (i.assigneeInitials &&
                          i.assigneeInitials.toUpperCase() ===
                            prof.initials.toUpperCase())
                    ).length;

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-200 rounded-md flex items-center gap-3"
                      >
                        <div className="w-9 h-9 rounded bg-blue-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {prof.initials}
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              Profile Name
                            </label>
                            <input
                              type="text"
                              value={prof.name}
                              onChange={(e) =>
                                handleUpdateExtractedProfile(idx, {
                                  name: e.target.value,
                                })
                              }
                              className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400">
                              Role & Initials
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                maxLength={3}
                                value={prof.initials}
                                onChange={(e) =>
                                  handleUpdateExtractedProfile(idx, {
                                    initials: e.target.value.toUpperCase(),
                                  })
                                }
                                className="w-11 text-xs font-mono uppercase text-center bg-slate-50 border border-slate-200 rounded py-1"
                              />
                              <input
                                type="text"
                                value={prof.role}
                                onChange={(e) =>
                                  handleUpdateExtractedProfile(idx, {
                                    role: e.target.value,
                                  })
                                }
                                className="flex-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-blue-700">
                            {assignedCount} tasks
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {matchedExisting ? 'Matches existing' : 'New profile'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveExtractedProfile(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section B: Extracted Tasks & Exact Profile Assignments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Extracted Tasks & Profile Assignments ({extracted.issues.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setExtracted(null)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                  >
                    ← Back to Screenshots
                  </button>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5 px-3 w-28">Type</th>
                        <th className="py-2.5 px-3 w-24">Key</th>
                        <th className="py-2.5 px-3">Task Summary</th>
                        <th className="py-2.5 px-3 w-44">Assigned Profile</th>
                        <th className="py-2.5 px-3 w-36">Board Status</th>
                        <th className="py-2.5 px-3 w-32">Priority</th>
                        <th className="py-2.5 px-3 w-16 text-center">Pts</th>
                        <th className="py-2.5 px-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {extracted.issues.map((iss, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <IssueTypeIcon type={iss.type} />
                              <select
                                value={iss.type}
                                onChange={(e) =>
                                  handleUpdateExtractedIssue(idx, {
                                    type: e.target.value,
                                  })
                                }
                                className="text-xs bg-transparent font-medium text-slate-700 focus:outline-none"
                              >
                                <option value={IssueType.STORY}>Story</option>
                                <option value={IssueType.TASK}>Task</option>
                                <option value={IssueType.BUG}>Bug</option>
                                <option value={IssueType.EPIC}>Epic</option>
                              </select>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={iss.key || ''}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  key: e.target.value.toUpperCase(),
                                })
                              }
                              className="w-20 font-mono text-xs font-semibold text-blue-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                            />
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
                              className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={iss.assigneeName || ''}
                              onChange={(e) => {
                                const selectedProf = extracted.profiles.find(
                                  (p) => p.name === e.target.value
                                );
                                handleUpdateExtractedIssue(idx, {
                                  assigneeName: e.target.value,
                                  assigneeInitials:
                                    selectedProf?.initials ||
                                    iss.assigneeInitials,
                                });
                              }}
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-800 font-medium"
                            >
                              <option value="">Unassigned</option>
                              {extracted.profiles.map((p, pIdx) => (
                                <option key={pIdx} value={p.name}>
                                  {p.name} ({p.initials})
                                </option>
                              ))}
                              {existingUsers
                                .filter(
                                  (u) =>
                                    !extracted.profiles.some(
                                      (p) =>
                                        p.name.toLowerCase() ===
                                        u.name.toLowerCase()
                                    )
                                )
                                .map((u) => (
                                  <option key={u.id} value={u.name}>
                                    {u.name} ({u.initials})
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={iss.status}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  status: e.target.value,
                                })
                              }
                              className={`w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded px-2 py-1 ${
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
                            <div className="flex items-center gap-1">
                              <PriorityIcon priority={iss.priority} />
                              <select
                                value={iss.priority}
                                onChange={(e) =>
                                  handleUpdateExtractedIssue(idx, {
                                    priority: e.target.value,
                                  })
                                }
                                className={`text-xs font-medium bg-transparent focus:outline-none ${
                                  PRIORITY_CONFIG[iss.priority].textClass
                                }`}
                              >
                                <option value={IssuePriority.HIGHEST}>
                                  Highest
                                </option>
                                <option value={IssuePriority.HIGH}>High</option>
                                <option value={IssuePriority.MEDIUM}>
                                  Medium
                                </option>
                                <option value={IssuePriority.LOW}>Low</option>
                                <option value={IssuePriority.LOWEST}>
                                  Lowest
                                </option>
                              </select>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={iss.storyPoints || 0}
                              onChange={(e) =>
                                handleUpdateExtractedIssue(idx, {
                                  storyPoints: Number(e.target.value) || 0,
                                })
                              }
                              className="w-12 text-center font-mono text-xs bg-slate-50 border border-slate-200 rounded py-1"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveExtractedIssue(idx)}
                              className="text-slate-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>

          {!extracted ? (
            <button
              type="button"
              disabled={images.length === 0 || isAnalyzing}
              onClick={handleAnalyzeScreenshots}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting Profiles & Tasks from Screenshot...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Screenshot & Extract Profiles + Tasks
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmApply}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Create {extracted.profiles.length} Profiles & Assign{' '}
              {extracted.issues.length} Tasks Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
