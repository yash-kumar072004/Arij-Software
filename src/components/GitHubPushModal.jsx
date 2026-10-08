import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  FolderGit2,
  KeyRound,
  Loader2,
  Lock,
  Unlock,
  UploadCloud,
  X,
} from 'lucide-react';

export const GitHubPushModal = ({
  onClose,
  onMergeRemoteWorkspace,
  currentWorkspace,
}) => {
  // 'PUSH' | 'PULL_FRIEND'
  const [mode, setMode] = useState('PUSH');

  // Push state
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState('arij-javascript-platform');
  const [description, setDescription] = useState(
    'Arij — Full-featured Agile Project Management & Story PDF / Screenshot Importer built in React & JavaScript'
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Pull / Sync Friend's Stories state
  const [friendRepoInput, setFriendRepoInput] = useState('');
  const [friendBranch, setFriendBranch] = useState('main');
  const [friendToken, setFriendToken] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullError, setPullError] = useState(null);
  const [pullSuccess, setPullSuccess] = useState(null);
  const [jsonPasteText, setJsonPasteText] = useState('');

  const handleSubmitPush = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter your GitHub Personal Access Token.');
      return;
    }

    setIsPushing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          repoName: repoName.trim() || 'arij-javascript-platform',
          description: description.trim(),
          isPrivate,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to push repository to GitHub.');
      }

      setResult({
        repoUrl: data.repoUrl,
        owner: data.owner,
        repoName: data.repoName,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unexpected error pushing to GitHub.'
      );
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromFriendRepo = async (e) => {
    e.preventDefault();
    if (!friendRepoInput.trim()) {
      setPullError(
        'Please enter your friend’s GitHub repository (e.g. friend-username/arij-javascript-platform).'
      );
      return;
    }

    setIsPulling(true);
    setPullError(null);
    setPullSuccess(null);

    try {
      const res = await fetch('/api/github/pull-stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoInput: friendRepoInput.trim(),
          branch: friendBranch.trim() || 'main',
          token: friendToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || 'Could not pull stories from that GitHub repository.'
        );
      }

      if (data.workspace && onMergeRemoteWorkspace) {
        onMergeRemoteWorkspace(
          data.workspace,
          `Synced ${data.addedCount} new story/issue(s) from ${data.owner}/${data.repo}!`
        );
      }
      setPullSuccess(
        `Successfully pulled & merged stories from ${data.owner}/${data.repo} (${data.totalIssues} total issues now in workspace)!`
      );
    } catch (err) {
      setPullError(
        err instanceof Error
          ? err.message
          : 'Failed to pull stories from GitHub repo.'
      );
    } finally {
      setIsPulling(false);
    }
  };

  const handleImportJsonPaste = () => {
    setPullError(null);
    setPullSuccess(null);
    if (!jsonPasteText.trim()) {
      setPullError('Paste your friend’s workspace-db.json or Story JSON first.');
      return;
    }
    try {
      const parsed = JSON.parse(jsonPasteText.trim());
      const ws = parsed.workspace || parsed;
      if (ws && Array.isArray(ws.issues) && onMergeRemoteWorkspace) {
        onMergeRemoteWorkspace(
          ws,
          `Merged ${ws.issues.length} stories/issues from friend's JSON snapshot!`
        );
        setPullSuccess(
          `Merged ${ws.issues.length} stories/issues into your active board!`
        );
        setJsonPasteText('');
      } else {
        setPullError('JSON must contain a valid workspace or issues array.');
      }
    } catch {
      setPullError('Invalid JSON format. Please paste valid JSON.');
    }
  };

  const handleCopyMyStoriesJson = () => {
    if (!currentWorkspace) return;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        workspace: currentWorkspace,
      },
      null,
      2
    );
    navigator.clipboard?.writeText(payload);
    setPullSuccess(
      'Copied your complete Workspace & Stories JSON to clipboard! Share it or commit workspace-db.json.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold">
                GitHub Repo &amp; Collaborator Story Sync
              </h2>
              <p className="text-[11px] text-slate-400">
                Push your codebase + stories (`workspace-db.json`) or pull stories created by your friend
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

        {/* Mode Switcher Tabs */}
        <div className="px-6 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('PUSH')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-md border-b-2 transition-colors flex items-center gap-1.5 ${
              mode === 'PUSH'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Push Code &amp; Stories to GitHub
          </button>
          <button
            type="button"
            onClick={() => setMode('PULL_FRIEND')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-md border-b-2 transition-colors flex items-center gap-1.5 ${
              mode === 'PULL_FRIEND'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            Pull / Sync Friend&rsquo;s Repo Stories
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'PUSH' ? (
            <form onSubmit={handleSubmitPush} className="space-y-4">
              {result ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Successfully Uploaded Code + All Stories to GitHub!</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    All project files and <code className="font-mono">workspace-db.json</code> (containing all created stories, users, and sprints) have been committed and pushed to{' '}
                    <strong className="font-mono">
                      {result.owner}/{result.repoName}
                    </strong>{' '}
                    on the <code className="font-mono">main</code> branch.
                  </p>
                  <a
                    href={result.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-md hover:bg-emerald-800 transition-colors"
                  >
                    Open GitHub Repository
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-blue-900">
                      Includes Live Stories Database (`workspace-db.json`):
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Every story you or your friend create is saved in <code className="font-mono">workspace-db.json</code> and tracked in Git so anyone cloning or pulling the repo gets all stories automatically.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GitHub Personal Access Token <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Repository Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="arij-javascript-platform"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Visibility
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`p-2.5 rounded-md border text-left flex items-center gap-2.5 text-xs ${
                          !isPrivate
                            ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Unlock className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <div>Public</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            Visible to anyone
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrivate(true)}
                        className={`p-2.5 rounded-md border text-left flex items-center gap-2.5 text-xs ${
                          isPrivate
                            ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                        <div>
                          <div>Private</div>
                          <div className="text-[10px] font-normal text-slate-500">
                            Only you can see
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </>
              )}

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  {result ? 'Close' : 'Cancel'}
                </button>
                {!result && (
                  <button
                    type="submit"
                    disabled={isPushing}
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPushing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Pushing Code &amp; Stories...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        Push Project &amp; Stories to GitHub
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <form onSubmit={handlePullFromFriendRepo} className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-slate-700">
                  <div className="font-bold text-blue-900 mb-0.5">
                    Pull Stories Created by Your Friend in Their Cloned Repo
                  </div>
                  <p className="text-[11px] text-slate-600">
                    If your friend took your repo, created stories on their system, and pushed to GitHub, enter their repo below to merge all their stories directly into your board.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Friend&rsquo;s GitHub Repo (`owner/repo` or URL)
                    </label>
                    <input
                      type="text"
                      value={friendRepoInput}
                      onChange={(e) => setFriendRepoInput(e.target.value)}
                      placeholder="friend-username/arij-javascript-platform"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={friendBranch}
                      onChange={(e) => setFriendBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GitHub Token (Optional — only needed for private repos)
                  </label>
                  <input
                    type="password"
                    value={friendToken}
                    onChange={(e) => setFriendToken(e.target.value)}
                    placeholder="Optional ghp_ token if friend's repo is private"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPulling}
                  className="w-full py-2 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2"
                >
                  {isPulling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Pulling &amp; Merging Stories from GitHub...
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="w-4 h-4" />
                      Pull &amp; Merge Stories from Friend&rsquo;s GitHub Repo
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Or Paste / Share Story Workspace JSON Directly
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyMyStoriesJson}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Copy My Workspace JSON
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={jsonPasteText}
                  onChange={(e) => setJsonPasteText(e.target.value)}
                  placeholder="Paste your friend's exported workspace-db.json content here to merge their created stories..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleImportJsonPaste}
                  className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-md"
                >
                  Merge Pasted Stories JSON
                </button>
              </div>

              {pullError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pullError}</span>
                </div>
              )}

              {pullSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pullSuccess}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
