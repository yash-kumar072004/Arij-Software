import React, { useState } from 'react';
import {
  CheckCircle2,
  FileCode2,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import { extractTextFromPdfArrayBuffer } from '../utils/pdfTextExtractor.js';
import {
  formatStructuredDescription,
  parseStructuredStoryFromExtractedText,
} from '../utils/storyTextParser.js';

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
  const activeProjObj =
    projects.find((p) => p.id === activeProjectId) || projects[0] || {
      id: 'prj-1',
      key: 'KP',
      name: 'Kawach Product',
    };

  const [projectId, setProjectId] = useState(activeProjObj.id);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFileSize, setUploadedFileSize] = useState('');
  const [extractedPageCount, setExtractedPageCount] = useState(0);
  const [rawExtractedPdfText, setRawExtractedPdfText] = useState('');
  const [statusBanner, setStatusBanner] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  // Header & Breadcrumb fields (populated dynamically from extracted text)
  const [issueKey, setIssueKey] = useState('');
  const [projectName, setProjectName] = useState(activeProjObj.name || '');
  const [projectKey, setProjectKey] = useState(activeProjObj.key || 'KP');
  const [parentKey, setParentKey] = useState('');
  const [parentTitle, setParentTitle] = useState('');
  const [parentStatus, setParentStatus] = useState('IN_PROGRESS');
  const [createdAtText, setCreatedAtText] = useState('');
  const [updatedAtText, setUpdatedAtText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  // Core Story Fields (populated dynamically from extracted PDF text)
  const [title, setTitle] = useState('');
  const [userStory, setUserStory] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [definitionOfDone, setDefinitionOfDone] = useState([]);
  const [rawDescriptionOverride, setRawDescriptionOverride] = useState('');
  // 'STRUCTURED' | 'RAW' | 'EXTRACTED_STREAM'
  const [activeContentTab, setActiveContentTab] = useState('STRUCTURED');

  // Right-Hand Details Fields
  const [type, setType] = useState(IssueType.STORY);
  const [status, setStatus] = useState(IssueStatus.TODO);
  const [priority, setPriority] = useState(IssuePriority.MEDIUM);
  const [assigneeName, setAssigneeName] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [componentName, setComponentName] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [storyPointsRaw, setStoryPointsRaw] = useState('');
  const [originalEstimateRaw, setOriginalEstimateRaw] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labelsRaw, setLabelsRaw] = useState('');
  const [reviewersRaw, setReviewersRaw] = useState('');
  const [approversRaw, setApproversRaw] = useState('');

  const [newTestCaseDraft, setNewTestCaseDraft] = useState('');
  const [newDodDraft, setNewDodDraft] = useState('');
  const [newScenarioTitle, setNewScenarioTitle] = useState('');
  const [newScenarioSteps, setNewScenarioSteps] = useState('');

  const projectSpecificSprints = sprints.filter(
    (s) => !s.projectId || s.projectId === projectId
  );

  const populateFromExtracted = (
    data,
    fileName,
    fileSizeStr,
    rawTextStream = '',
    pageCount = 1
  ) => {
    setUploadedFileName(fileName);
    setUploadedFileSize(fileSizeStr);
    setExtractedPageCount(pageCount);
    if (rawTextStream || data.rawExtractedText) {
      setRawExtractedPdfText(rawTextStream || data.rawExtractedText || '');
    }

    setIssueKey(data.issueKey || '');
    setProjectName(data.projectName || activeProjObj.name || '');
    setProjectKey(data.projectKey || activeProjObj.key || 'KP');
    setParentKey(data.parentKey || '');
    setParentTitle(data.parentTitle || '');
    setParentStatus(data.parentStatus || 'IN_PROGRESS');
    setCreatedAtText(data.createdAtText || '');
    setUpdatedAtText(data.updatedAtText || '');
    setSourceUrl(data.sourceUrl || '');

    setTitle(data.title || '');
    setUserStory(data.userStory || '');
    setScopeDescription(data.scopeDescription || '');

    const nextAc = Array.isArray(data.acceptanceCriteria)
      ? data.acceptanceCriteria
      : [];
    const nextTc = Array.isArray(data.testCases)
      ? data.testCases
      : Array.isArray(data.subtasks)
      ? data.subtasks.map((s) => s.title)
      : [];
    const nextDod = Array.isArray(data.definitionOfDone)
      ? data.definitionOfDone
      : [];

    setAcceptanceCriteria(nextAc);
    setTestCases(nextTc);
    setDefinitionOfDone(nextDod);

    const builtDesc = formatStructuredDescription({
      title: data.title || '',
      userStory: data.userStory || '',
      scopeDescription: data.scopeDescription || '',
      acceptanceCriteria: nextAc,
      testCases: nextTc,
      definitionOfDone: nextDod,
      rawFallbackText:
        rawTextStream || data.rawExtractedText || data.description || '',
    });
    setRawDescriptionOverride(builtDesc || data.description || '');

    if (data.type && IssueType[data.type]) {
      setType(IssueType[data.type]);
    } else {
      setType(IssueType.STORY);
    }

    if (data.status && IssueStatus[data.status]) {
      setStatus(IssueStatus[data.status]);
    } else {
      setStatus(IssueStatus.TODO);
    }

    if (data.priority && IssuePriority[data.priority]) {
      setPriority(IssuePriority[data.priority]);
    } else {
      setPriority(IssuePriority.MEDIUM);
    }

    setAssigneeName(data.assigneeName || '');
    setReporterName(data.reporterName || data.assigneeName || '');
    setComponentName(data.componentName || '');

    if (
      !data.sprintName ||
      /^none$/i.test(String(data.sprintName).trim())
    ) {
      setSprintId('');
    } else {
      const matchedSp = sprints.find((s) =>
        s.name.toLowerCase().includes(String(data.sprintName).toLowerCase())
      );
      setSprintId(matchedSp ? matchedSp.id : '');
    }

    if (
      data.storyPoints === null ||
      data.storyPoints === undefined ||
      data.storyPoints === 0 ||
      /^none$/i.test(String(data.storyPoints))
    ) {
      setStoryPointsRaw('');
    } else {
      setStoryPointsRaw(String(data.storyPoints));
    }

    if (
      data.originalEstimateHours === null ||
      data.originalEstimateHours === undefined ||
      data.originalEstimateHours === 0
    ) {
      setOriginalEstimateRaw('');
    } else {
      setOriginalEstimateRaw(String(data.originalEstimateHours));
    }

    setDueDate(data.dueDate || '');

    if (Array.isArray(data.labels) && data.labels.length > 0) {
      const validLabels = data.labels.filter(
        (l) => l && !/^none$/i.test(String(l).trim())
      );
      setLabelsRaw(validLabels.join(', '));
    } else {
      setLabelsRaw('');
    }

    if (Array.isArray(data.reviewers) && data.reviewers.length > 0) {
      const validRev = data.reviewers.filter(
        (r) => r && !/^none$/i.test(String(r).trim())
      );
      setReviewersRaw(validRev.join(', '));
    } else {
      setReviewersRaw('');
    }

    if (Array.isArray(data.approvers) && data.approvers.length > 0) {
      const validApp = data.approvers.filter(
        (a) => a && !/^none$/i.test(String(a).trim())
      );
      setApproversRaw(validApp.join(', '));
    } else {
      setApproversRaw('');
    }

    const charCount = (rawTextStream || data.rawExtractedText || '').length;
    setStatusBanner(
      `Dynamically extracted ${charCount.toLocaleString()} characters across ${pageCount} page(s) (${
        data.issueKey ? `${data.issueKey} · ` : ''
      }${nextAc.length} Scenarios · ${nextTc.length} Test Cases · ${
        nextDod.length
      } DoD items) from "${fileName}"`
    );
  };

  const processPdfFile = async (file) => {
    if (!file) return;
    setIsParsing(true);
    setStatusBanner(null);
    setErrorBanner(null);

    const activeProj =
      projects.find((p) => p.id === projectId) || activeProjObj;
    const sizeStr = `${Math.max(1, Math.round(file.size / 1024))} KB`;

    let clientPdfText = '';
    let clientLeftText = '';
    let clientRightSidebar = '';
    let clientMetadataTitle = '';
    let pageCount = 1;

    try {
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfResult = await extractTextFromPdfArrayBuffer(arrayBuffer);
        clientPdfText = pdfResult.fullText || '';
        clientLeftText = pdfResult.leftText || '';
        clientRightSidebar = pdfResult.rightSidebarText || '';
        clientMetadataTitle = pdfResult.metadataTitle || '';
        pageCount = pdfResult.pageCount || 1;
      } else {
        clientPdfText = await file.text();
        clientLeftText = clientPdfText;
      }
    } catch (pdfErr) {
      console.warn('Browser PDF.js extraction error, falling back to binary stream:', pdfErr);
    }

    // Parse client-extracted text immediately using pure dynamic parser
    const localParsed = parseStructuredStoryFromExtractedText({
      rawText: clientPdfText,
      leftText: clientLeftText,
      rightSidebarText: clientRightSidebar,
      metadataTitle: clientMetadataTitle,
      fileName: file.name,
      defaultProjectKey: activeProj?.key || 'KP',
    });

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
          extractedTextHint: clientPdfText,
          leftColumnText: clientLeftText,
          rightSidebarText: clientRightSidebar,
          metadataTitle: clientMetadataTitle,
          projectKey: activeProj?.key || 'KP',
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const serverData = await res.json();
      populateFromExtracted(
        serverData,
        file.name,
        sizeStr,
        clientPdfText || serverData.rawExtractedText || '',
        pageCount
      );
    } catch (err) {
      // Use real client-side parsed text from the uploaded file — NEVER hardcoded sample data
      if (clientPdfText && clientPdfText.trim().length > 0) {
        populateFromExtracted(
          localParsed,
          file.name,
          sizeStr,
          clientPdfText,
          pageCount
        );
      } else {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Could not extract readable text from the uploaded file.'
        );
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleReparseEditedRawStream = () => {
    if (!rawExtractedPdfText.trim()) return;
    const activeProj =
      projects.find((p) => p.id === projectId) || activeProjObj;
    const reparsed = parseStructuredStoryFromExtractedText({
      rawText: rawExtractedPdfText,
      leftText: rawExtractedPdfText,
      rightSidebarText: '',
      fileName: uploadedFileName || 'pasted-story-text.txt',
      defaultProjectKey: activeProj?.key || 'KP',
    });
    populateFromExtracted(
      reparsed,
      uploadedFileName || 'Edited Text Stream',
      uploadedFileSize || `${Math.max(1, Math.round(rawExtractedPdfText.length / 1024))} KB`,
      rawExtractedPdfText,
      extractedPageCount || 1
    );
    setActiveContentTab('STRUCTURED');
  };

  const handleAddTestCase = (e) => {
    e.preventDefault();
    if (!newTestCaseDraft.trim()) return;
    setTestCases((prev) => [...prev, newTestCaseDraft.trim()]);
    setNewTestCaseDraft('');
  };

  const handleAddDod = (e) => {
    e.preventDefault();
    if (!newDodDraft.trim()) return;
    setDefinitionOfDone((prev) => [...prev, newDodDraft.trim()]);
    setNewDodDraft('');
  };

  const handleAddScenario = (e) => {
    e.preventDefault();
    if (!newScenarioTitle.trim()) return;
    const steps = newScenarioSteps
      .split(/\r?\n/)
      .map((s) => s.replace(/^[•\-*]\s*/, '').trim())
      .filter(Boolean);
    setAcceptanceCriteria((prev) => [
      ...prev,
      {
        scenarioTitle: newScenarioTitle.trim(),
        steps:
          steps.length > 0
            ? steps
            : ['Given the user is on the page', 'Then verify expected state'],
      },
    ]);
    setNewScenarioTitle('');
    setNewScenarioSteps('');
  };

  const handleSubmitStory = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalDescription =
      activeContentTab === 'RAW' && rawDescriptionOverride.trim()
        ? rawDescriptionOverride.trim()
        : formatStructuredDescription({
            title,
            userStory,
            scopeDescription,
            acceptanceCriteria,
            testCases,
            definitionOfDone,
            rawFallbackText: rawExtractedPdfText,
          }) || rawDescriptionOverride.trim();

    const parsedLabels = labelsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^none$/i.test(s));

    const parsedReviewers = reviewersRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^none$/i.test(s));

    const parsedApprovers = approversRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^none$/i.test(s));

    const subtasksList = testCases.map((tc, idx) => ({
      id: `sub-pdf-${Date.now()}-${idx + 1}`,
      key: issueKey
        ? `${issueKey.trim().toUpperCase()}-${idx + 1}`
        : undefined,
      title: tc,
      completed: false,
    }));

    onCreateIssue({
      projectId,
      customIssueKey: issueKey.trim().toUpperCase() || undefined,
      preserveCustomKey: !!issueKey.trim(),
      projectName: projectName.trim() || activeProjObj.name,
      projectKey: projectKey.trim().toUpperCase() || activeProjObj.key,
      parentKey: parentKey.trim().toUpperCase() || '',
      parentTitle: parentTitle.trim() || '',
      parentStatus: parentStatus || 'IN_PROGRESS',
      title: title.trim(),
      description: finalDescription,
      userStory: userStory.trim(),
      scopeDescription: scopeDescription.trim(),
      acceptanceCriteria,
      testCases,
      definitionOfDone,
      type,
      status,
      priority,
      assigneeName: assigneeName.trim(),
      reporterName: reporterName.trim() || assigneeName.trim(),
      componentName: componentName.trim(),
      sprintId: sprintId || null,
      explicitNoSprint: !sprintId,
      storyPoints:
        storyPointsRaw.trim() === '' || /^none$/i.test(storyPointsRaw.trim())
          ? 0
          : Number(storyPointsRaw) || 0,
      originalEstimateHours:
        originalEstimateRaw.trim() === ''
          ? 0
          : Number(originalEstimateRaw) || 0,
      dueDate: dueDate || '',
      labels: parsedLabels,
      reviewers: parsedReviewers,
      approvers: parsedApprovers,
      createdAtText,
      updatedAtText,
      sourceUrl,
      subtasks: subtasksList,
      attachments: uploadedFileName
        ? [
            {
              id: `att-pdf-${Date.now()}`,
              name: uploadedFileName,
              size: uploadedFileSize || '120 KB',
              uploadedAt: new Date().toISOString().slice(0, 10),
            },
          ]
        : [],
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Real-Time PDF Text Extractor &amp; Story Importer (PDF.js + Dynamic Section Parser)
              </h2>
              <p className="text-[11px] text-slate-500">
                Upload any `.pdf`, `.txt`, or `.md` specification — extracts real text coordinates from every page without hardcoded templates.
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
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5"
        >
          {/* PDF Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void processPdfFile(f);
            }}
            className="p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 flex flex-col lg:flex-row items-center justify-between gap-4"
          >
            <div className="space-y-1 text-center lg:text-left">
              <div className="text-xs font-bold text-slate-900">
                Drop any Jira Story or PRD `.pdf` / `.txt` / `.md` file here, or click &ldquo;Upload &amp; Extract PDF&rdquo;
              </div>
              <div className="text-[11px] text-slate-600">
                Uses Mozilla `pdfjs-dist` to read actual PDF text tokens &amp; coordinates, separating left-column content (User Story, Scope, Scenarios, Test Cases, DoD) and right-sidebar metadata.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
              <label className="cursor-pointer px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1.5 shadow-2xs transition-colors">
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Extracting PDF Text...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload &amp; Extract PDF
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,application/pdf,.txt,.md"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void processPdfFile(f);
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setActiveContentTab('EXTRACTED_STREAM')}
                className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-md flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                Paste / Inspect Raw Text Stream
              </button>
            </div>
          </div>

          {errorBanner && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-800">
              {errorBanner}
            </div>
          )}

          {statusBanner && (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-900 flex flex-wrap items-center justify-between gap-2">
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

          {/* Dynamic Breadcrumb Bar */}
          {(projectName || parentKey || issueKey || createdAtText) && (
            <div className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">
                  {projectName || activeProjObj.name}
                </span>
                {parentKey && (
                  <>
                    <span className="text-slate-400">/</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-semibold text-[11px]">
                      <Layers className="w-3 h-3" />
                      {parentKey}
                      {parentTitle && (
                        <span className="font-sans font-normal text-purple-900">
                          {parentTitle}
                        </span>
                      )}
                      <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] uppercase">
                        {(parentStatus || 'IN_PROGRESS').replace(/_/g, ' ')}
                      </span>
                    </span>
                  </>
                )}
                <span className="text-slate-400">/</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                  {issueKey || `${projectKey || activeProjObj.key}-AUTO`}
                </span>
              </div>

              {(createdAtText || updatedAtText) && (
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                  {createdAtText && <span>Created: {createdAtText}</span>}
                  {updatedAtText && <span>Updated: {updatedAtText}</span>}
                </div>
              )}
            </div>
          )}

          {/* 2-Column Layout: Left Story Content (7 cols) + Right Details Box (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Story Title / Summary *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Upload a PDF or enter story title..."
                  className="w-full px-3.5 py-2 text-sm font-bold bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* View Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Extracted Document Sections
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveContentTab('STRUCTURED')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                      activeContentTab === 'STRUCTURED'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    1. Structured Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawDescriptionOverride(
                        formatStructuredDescription({
                          title,
                          userStory,
                          scopeDescription,
                          acceptanceCriteria,
                          testCases,
                          definitionOfDone,
                          rawFallbackText: rawExtractedPdfText,
                        })
                      );
                      setActiveContentTab('RAW');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                      activeContentTab === 'RAW'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    2. Formatted Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveContentTab('EXTRACTED_STREAM')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                      activeContentTab === 'EXTRACTED_STREAM'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    3. Raw PDF Text ({rawExtractedPdfText.length} chars)
                  </button>
                </div>
              </div>

              {activeContentTab === 'EXTRACTED_STREAM' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Exact Raw Text Extracted from PDF (or paste any Jira/PRD text below to parse):
                    </span>
                    <button
                      type="button"
                      onClick={handleReparseEditedRawStream}
                      className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Parse Text into Fields
                    </button>
                  </div>
                  <textarea
                    rows={18}
                    value={rawExtractedPdfText}
                    onChange={(e) => setRawExtractedPdfText(e.target.value)}
                    placeholder="Upload a PDF above to see its exact extracted text stream here, or paste any story text and click 'Parse Text into Fields'..."
                    className="w-full px-3 py-2.5 text-xs font-mono bg-slate-900 text-emerald-300 border border-slate-700 rounded-md focus:outline-none"
                  />
                </div>
              ) : activeContentTab === 'RAW' ? (
                <div>
                  <textarea
                    rows={18}
                    value={rawDescriptionOverride}
                    onChange={(e) => setRawDescriptionOverride(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 1. User Story */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      User Story (&ldquo;As a... I want... So that...&rdquo;)
                    </label>
                    <textarea
                      rows={3}
                      value={userStory}
                      onChange={(e) => setUserStory(e.target.value)}
                      placeholder="Extracted from PDF 'User Story' section..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                    />
                  </div>

                  {/* 2. Scope / Description */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Scope / Description
                    </label>
                    <textarea
                      rows={4}
                      value={scopeDescription}
                      onChange={(e) => setScopeDescription(e.target.value)}
                      placeholder="Extracted from PDF 'Scope / Description' section..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                    />
                  </div>

                  {/* 3. Acceptance Criteria (Scenarios 1..N) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Acceptance Criteria ({acceptanceCriteria.length} Scenarios)
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {acceptanceCriteria.map((sc, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-3 bg-white border border-slate-200 rounded-md space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={sc.scenarioTitle}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAcceptanceCriteria((prev) =>
                                  prev.map((item, i) =>
                                    i === sIdx
                                      ? { ...item, scenarioTitle: val }
                                      : item
                                  )
                                );
                              }}
                              className="flex-1 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded px-2 py-1"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAcceptanceCriteria((prev) =>
                                  prev.filter((_, i) => i !== sIdx)
                                )
                              }
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Remove Scenario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <textarea
                            rows={Math.max(2, (sc.steps || []).length)}
                            value={(sc.steps || []).join('\n')}
                            onChange={(e) => {
                              const nextSteps = e.target.value
                                .split(/\r?\n/)
                                .filter((line) => line.trim().length > 0);
                              setAcceptanceCriteria((prev) =>
                                prev.map((item, i) =>
                                  i === sIdx
                                    ? { ...item, steps: nextSteps }
                                    : item
                                )
                              );
                            }}
                            className="w-full text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-2 font-mono"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Add Scenario inline */}
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={newScenarioTitle}
                        onChange={(e) => setNewScenarioTitle(e.target.value)}
                        placeholder="Scenario title..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                      <input
                        type="text"
                        value={newScenarioSteps}
                        onChange={(e) => setNewScenarioSteps(e.target.value)}
                        placeholder="Given ... When ... Then ..."
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={handleAddScenario}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Scenario
                      </button>
                    </div>
                  </div>

                  {/* 4. Test Cases to Automate / Subtasks */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Test Cases / Subtasks ({testCases.length})
                      </span>
                    </div>

                    <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                      {testCases.map((tc, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-800">
                            <strong className="font-mono text-slate-500 mr-1.5">
                              {idx + 1}.
                            </strong>
                            {tc}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setTestCases((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTestCaseDraft}
                        onChange={(e) => setNewTestCaseDraft(e.target.value)}
                        placeholder="Add test case or subtask..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={handleAddTestCase}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Test Case
                      </button>
                    </div>
                  </div>

                  {/* 5. Definition of Done (DoD) */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <div className="text-xs font-bold text-slate-800">
                      Definition of Done (DoD) ({definitionOfDone.length})
                    </div>
                    <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-md">
                      {definitionOfDone.map((dod, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-700">• {dod}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDefinitionOfDone((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newDodDraft}
                        onChange={(e) => setNewDodDraft(e.target.value)}
                        placeholder="Add Definition of Done criterion..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={handleAddDod}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded hover:bg-slate-900 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add DoD
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Details Box */}
            <div className="lg:col-span-5 space-y-4">
              {/* Top Status Badge Selector */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Workflow Status
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md uppercase tracking-wide"
                >
                  <option value={IssueStatus.TODO}>TO DO</option>
                  <option value={IssueStatus.IN_PROGRESS}>IN PROGRESS</option>
                  <option value={IssueStatus.IN_REVIEW}>IN REVIEW</option>
                  <option value={IssueStatus.QA}>QA TESTING</option>
                  <option value={IssueStatus.DONE}>DONE</option>
                </select>
              </div>

              {/* Details Box */}
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                  <span>Details (Extracted from Document)</span>
                  <span className="font-mono text-[11px] text-blue-700">
                    {issueKey || 'Auto-Key'}
                  </span>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  {/* Target Project & Issue Key */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Project</span>
                    <div className="col-span-2">
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.key} — {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Issue Key</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={issueKey}
                        onChange={(e) => setIssueKey(e.target.value)}
                        placeholder="Auto-assigned if blank"
                        className="w-full px-2.5 py-1.5 font-mono font-bold bg-slate-50 border border-slate-200 rounded text-blue-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Issue Type</span>
                    <div className="col-span-2">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900"
                      >
                        <option value={IssueType.STORY}>Story</option>
                        <option value={IssueType.TASK}>Task</option>
                        <option value={IssueType.BUG}>Bug</option>
                        <option value={IssueType.EPIC}>Epic</option>
                        <option value={IssueType.FEATURE}>Feature</option>
                        <option value={IssueType.IMPROVEMENT}>Improvement</option>
                      </select>
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Assignee</span>
                    <div className="col-span-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <input
                        type="text"
                        list="arij-users-list"
                        value={assigneeName}
                        onChange={(e) => setAssigneeName(e.target.value)}
                        placeholder="Unassigned"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900"
                      />
                      <datalist id="arij-users-list">
                        {users.map((u) => (
                          <option key={u.id} value={u.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Reporter */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Reporter</span>
                    <div className="col-span-2">
                      <input
                        type="text"
                        list="arij-users-list"
                        value={reporterName}
                        onChange={(e) => setReporterName(e.target.value)}
                        placeholder="Reporter name"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Labels</span>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={labelsRaw}
                        onChange={(e) => setLabelsRaw(e.target.value)}
                        placeholder="None"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Reviewers */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Reviewers</span>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={reviewersRaw}
                        onChange={(e) => setReviewersRaw(e.target.value)}
                        placeholder="None"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Approvers */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Approvers</span>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={approversRaw}
                        onChange={(e) => setApproversRaw(e.target.value)}
                        placeholder="None"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Components */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Components</span>
                    <div className="col-span-2">
                      <input
                        type="text"
                        list="arij-components-list"
                        value={componentName}
                        onChange={(e) => setComponentName(e.target.value)}
                        placeholder="None"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-medium text-slate-900"
                      />
                      <datalist id="arij-components-list">
                        {components.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Priority</span>
                    <div className="col-span-2">
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900"
                      >
                        <option value={IssuePriority.HIGHEST}>Highest</option>
                        <option value={IssuePriority.HIGH}>High</option>
                        <option value={IssuePriority.MEDIUM}>Medium</option>
                        <option value={IssuePriority.LOW}>Low</option>
                        <option value={IssuePriority.LOWEST}>Lowest</option>
                      </select>
                    </div>
                  </div>

                  {/* Parent Epic */}
                  <div className="grid grid-cols-3 items-start gap-2">
                    <span className="text-slate-500 font-medium pt-1.5">
                      Parent
                    </span>
                    <div className="col-span-2 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={parentKey}
                          onChange={(e) => setParentKey(e.target.value)}
                          placeholder="Epic Key"
                          className="w-24 px-2 py-1 font-mono font-bold bg-purple-50 border border-purple-200 rounded text-purple-800 text-xs"
                        />
                        <input
                          type="text"
                          value={parentTitle}
                          onChange={(e) => setParentTitle(e.target.value)}
                          placeholder="Parent Epic Title"
                          className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-900 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sprint */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">Sprint</span>
                    <div className="col-span-2">
                      <select
                        value={sprintId}
                        onChange={(e) => setSprintId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800"
                      >
                        <option value="">None</option>
                        {projectSpecificSprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Story point estimate */}
                  <div className="grid grid-cols-3 items-center gap-2">
                    <span className="text-slate-500 font-medium">
                      Story point estimate
                    </span>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={storyPointsRaw}
                        onChange={(e) => setStoryPointsRaw(e.target.value)}
                        placeholder="None"
                        className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Development */}
                  <div className="grid grid-cols-3 items-center gap-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">
                      Development
                    </span>
                    <div className="col-span-2 flex flex-wrap items-center gap-2 text-blue-600 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="w-3.5 h-3.5" />
                        Create branch
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>Create commit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500">
              Creates Story{issueKey ? ` (${issueKey})` : ''}, links Parent Epic{' '}
              <strong className="text-slate-700">
                {parentKey || 'None'} {parentTitle}
              </strong>
              , assigns to{' '}
              <strong className="text-slate-700">
                {assigneeName || 'Unassigned'}
              </strong>
              , and syncs across all views.
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isParsing}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md shadow-xs transition-colors"
              >
                Create Story from PDF {issueKey ? `(${issueKey})` : ''}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
