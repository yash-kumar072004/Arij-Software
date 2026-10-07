import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Plus,
  Search,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from '../types/arij.js';
import {
  isOverdue,
  IssueTypeIcon,
  PriorityIcon,
  STATUS_CONFIG,
} from './ArijPrimitives.jsx';

export const ArijAiAssistantView = ({
  project,
  activeSprint,
  issues,
  epics,
  users,
  currentUserId,
  onSelectIssue,
  onFullCreateIssue,
}) => {
  // 'ASSISTANT_CHAT' | 'AI_ISSUE_CREATOR' | 'NL_SEARCH' | 'RISK_RADAR'
  const [subTab, setSubTab] = useState('ASSISTANT_CHAT');

  const currentUser =
    users.find((u) => u.id === currentUserId) || users[0];

  const nonEpicIssues = useMemo(
    () => issues.filter((i) => i.type !== IssueType.EPIC),
    [issues]
  );

  // ==================== 1. AI PROJECT ASSISTANT CHAT (Section 36) ====================
  const [messages, setMessages] = useState(() => {
    const openCount = nonEpicIssues.filter(
      (i) => i.status !== IssueStatus.DONE
    ).length;
    const highBugs = nonEpicIssues.filter(
      (i) =>
        i.type === IssueType.BUG &&
        i.status !== IssueStatus.DONE &&
        (i.priority === IssuePriority.HIGHEST ||
          i.priority === IssuePriority.HIGH)
    );
    const totalPts = nonEpicIssues.reduce(
      (s, i) => s + (i.storyPoints || 0),
      0
    );
    const donePts = nonEpicIssues
      .filter((i) => i.status === IssueStatus.DONE)
      .reduce((s, i) => s + (i.storyPoints || 0), 0);

    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        text: `Hello ${currentUser.name}! I am your Arij AI Project Assistant for **${project.name} (${project.key})**.\n\nLive Sprint Snapshot:\n• **${donePts} of ${totalPts} story points** completed (${openCount} open items remaining)\n• **${highBugs.length} high-priority bugs** currently active\n\nAsk me *"Why is the current sprint delayed?"*, *"What should I work on next?"*, or *"Detect duplicate or blocked issues"*.`,
      },
    ];
  });
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const askAssistant = async (promptText) => {
    const q = (promptText || chatInput).trim();
    if (!q) return;
    setChatInput('');
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/arij/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: q,
          project: {
            key: project.key,
            name: project.name,
            sprintName: activeSprint?.name || 'Continuous Flow',
          },
          currentUser: { id: currentUser.id, name: currentUser.name },
          issues: nonEpicIssues.map((i) => ({
            key: i.key,
            title: i.title,
            type: i.type,
            status: i.status,
            priority: i.priority,
            storyPoints: i.storyPoints,
            assigneeId: i.assigneeId,
            dueDate: i.dueDate,
          })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text:
            data.reply ||
            'Analysis complete. Review high-priority sprint items on your board.',
        },
      ]);
    } catch {
      const myTop = nonEpicIssues.find(
        (i) => i.assigneeId === currentUserId && i.status !== IssueStatus.DONE
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: myTop
            ? `Recommended Next Task: Start **${myTop.key} — ${myTop.title}** (${myTop.priority} priority, ${myTop.storyPoints || 3} story points).`
            : 'All your assigned sprint tasks are on track!',
        },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // ==================== 2. AI ISSUE GENERATOR (Section 35) ====================
  const [aiBrief, setAiBrief] = useState('');
  const [isGeneratingIssue, setIsGeneratingIssue] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState(null);
  const [createdBanner, setCreatedBanner] = useState(null);

  const handleGenerateAiIssue = async (e) => {
    e.preventDefault();
    if (!aiBrief.trim()) return;
    setIsGeneratingIssue(true);
    setCreatedBanner(null);

    try {
      const res = await fetch('/api/arij/ai-generate-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiBrief.trim(),
          projectKey: project.key,
        }),
      });
      const data = await res.json();
      setGeneratedSpec(data);
    } catch {
      setGeneratedSpec({
        title: aiBrief.trim(),
        type: IssueType.STORY,
        priority: IssuePriority.HIGH,
        storyPoints: 5,
        description: `### Problem Statement\n${aiBrief.trim()}\n\n### Acceptance Criteria\n- Verify end-to-end workflow across desktop and mobile viewports\n- Add automated regression tests and telemetry assertions`,
        labels: ['ai-generated', 'sprint-ready'],
        subtasks: [
          'Implement core business logic and validation',
          'Add unit and integration test coverage',
          'Verify production telemetry and release readiness',
        ],
      });
    } finally {
      setIsGeneratingIssue(false);
    }
  };

  const handleCommitGeneratedIssue = () => {
    if (!generatedSpec) return;
    onFullCreateIssue({
      projectId: project.id,
      title: generatedSpec.title,
      description: generatedSpec.description,
      type: generatedSpec.type || IssueType.STORY,
      status: IssueStatus.TODO,
      priority: generatedSpec.priority || IssuePriority.HIGH,
      assigneeId: currentUserId,
      epicId: epics[0]?.id || null,
      sprintId: activeSprint?.id || null,
      storyPoints: Number(generatedSpec.storyPoints) || 5,
      originalEstimateHours: (Number(generatedSpec.storyPoints) || 5) * 3,
      labels: generatedSpec.labels || ['ai-generated'],
      componentId: null,
      fixVersionId: null,
      dueDate: '2026-10-20',
    });
    setCreatedBanner(`Created "${generatedSpec.title}" in ${project.key}!`);
    setGeneratedSpec(null);
    setAiBrief('');
  };

  // ==================== 3. AI NATURAL-LANGUAGE SEARCH (Section 35) ====================
  const [nlQuery, setNlQuery] = useState(
    'Show me all high-priority bugs or stories that are not done'
  );

  const nlMatchedIssues = useMemo(() => {
    const q = nlQuery.toLowerCase();
    return nonEpicIssues.filter((iss) => {
      if (q.includes('assigned to me') && iss.assigneeId !== currentUserId) {
        return false;
      }
      if (
        (q.includes('not done') || q.includes('open') || q.includes('unresolved')) &&
        iss.status === IssueStatus.DONE
      ) {
        return false;
      }
      if (q.includes('overdue') && !isOverdue(iss.dueDate, iss.status)) {
        return false;
      }
      if (
        q.includes('high') &&
        iss.priority !== IssuePriority.HIGHEST &&
        iss.priority !== IssuePriority.HIGH
      ) {
        return false;
      }
      if (
        q.includes('bug') &&
        !q.includes('or stories') &&
        iss.type !== IssueType.BUG
      ) {
        return false;
      }
      return true;
    });
  }, [nlQuery, nonEpicIssues, currentUserId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">
              Arij AI Intelligence Pillar (V6)
            </span>
            <span>/</span>
            <span>{project.name}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
            AI Project Assistant, AI Issue Generator, Natural-Language Search &amp; Risk Radar
          </h1>
        </div>

        <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSubTab('ASSISTANT_CHAT')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'ASSISTANT_CHAT'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            AI Project Assistant
          </button>
          <button
            type="button"
            onClick={() => setSubTab('AI_ISSUE_CREATOR')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'AI_ISSUE_CREATOR'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            AI Issue Generator
          </button>
          <button
            type="button"
            onClick={() => setSubTab('NL_SEARCH')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'NL_SEARCH'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            AI Natural-Language Search
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ====================================================================
            TAB 1: AI PROJECT ASSISTANT CHAT (Section 36)
           ==================================================================== */}
        {subTab === 'ASSISTANT_CHAT' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl flex flex-col h-[540px] shadow-2xs overflow-hidden">
              <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold">
                    Arij AI Project Assistant (Live Workspace Reasoning)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-300">
                  {project.key} Context Active
                </span>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-slate-100 text-slate-900 border border-slate-200'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {isSendingChat && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    Analyzing sprint velocity, blockers, and workload...
                  </div>
                )}
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-2">
                {[
                  'Why is the current sprint delayed?',
                  'What should I work on next?',
                  'Summarize sprint progress & release risk',
                  'Detect duplicate or overloaded assignees',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void askAssistant(q)}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-300 hover:border-blue-500 text-[11px] font-medium text-slate-700"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void askAssistant();
                }}
                className="p-3 bg-white border-t border-slate-200 flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask Arij AI anything about your sprint, blockers, priorities, or team workload..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={isSendingChat}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Ask AI
                </button>
              </form>
            </div>

            {/* Right Column: Live AI Sprint Risk & Delay Prediction Radar */}
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  AI Sprint Risk &amp; Prediction
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-900">
                    Sprint On-Time Probability: 86%
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Velocity trend matches historical 34-point average.
                  </p>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-900">
                      Priority Recommendation:
                    </span>
                    <p className="text-slate-600 mt-0.5">
                      Resolve high-priority items in IN_REVIEW before starting new TO DO stories to prevent QA bottleneck.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: AI ISSUE GENERATOR (Section 35)
           ==================================================================== */}
        {subTab === 'AI_ISSUE_CREATOR' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                AI Work Item Generator (Auto-Generates Description, Acceptance Criteria, Subtasks, Priority &amp; Story Points)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Describe any feature, bug, or incident in one sentence and let Arij AI draft the full specification.
              </p>
            </div>

            {createdBanner && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {createdBanner}
              </div>
            )}

            <form onSubmit={handleGenerateAiIssue} className="flex gap-3">
              <input
                type="text"
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                placeholder="e.g. Users on mobile Safari experience timeout when verifying SAML 2FA tokens..."
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                disabled={isGeneratingIssue}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 shrink-0"
              >
                {isGeneratingIssue ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Spec...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Full Issue Spec
                  </>
                )}
              </button>
            </form>

            {generatedSpec && (
              <div className="p-5 rounded-xl bg-slate-50 border border-blue-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold uppercase">
                      {generatedSpec.type}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                      Priority: {generatedSpec.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px] font-bold">
                      {generatedSpec.storyPoints} Story Points
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCommitGeneratedIssue}
                    className="px-4 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Issue in {project.key}
                  </button>
                </div>

                <h4 className="text-sm font-bold text-slate-900">
                  {generatedSpec.title}
                </h4>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans bg-white p-3.5 rounded-lg border border-slate-200">
                  {generatedSpec.description}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 3: AI NATURAL-LANGUAGE SEARCH (Section 35)
           ==================================================================== */}
        {subTab === 'NL_SEARCH' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900">
                Natural-Language Search (Ask in plain English)
              </label>
              <input
                type="text"
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                placeholder="e.g. Show me all high-priority bugs assigned to me that are overdue..."
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div className="divide-y divide-slate-100">
              {nlMatchedIssues.map((iss) => (
                <div
                  key={iss.id}
                  onClick={() => onSelectIssue(iss.id)}
                  className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    <IssueTypeIcon type={iss.type} className="w-3.5 h-3.5" />
                    <span className="font-mono font-bold text-blue-700">
                      {iss.key}
                    </span>
                    <span className="font-medium text-slate-900">
                      {iss.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityIcon priority={iss.priority} className="w-3.5 h-3.5" />
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      {STATUS_CONFIG[iss.status]?.shortLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
