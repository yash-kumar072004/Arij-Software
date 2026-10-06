import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  Loader2,
  Lock,
  Globe,
  X,
} from 'lucide-react';

interface GitHubPushModalProps {
  onClose: () => void;
}

export const GitHubPushModal: React.FC<GitHubPushModalProps> = ({ onClose }) => {
  const [token, setToken] = useState('');
  const [repoName, setRepoName] = useState('jira-react-platform');
  const [description, setDescription] = useState(
    'Full-featured Agile Jira Project Management & Screenshot Importer built in React & TypeScript'
  );
  const [isPrivate, setIsPrivate] = useState(false);

  const [isPushing, setIsPushing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pushedRepoUrl, setPushedRepoUrl] = useState<string | null>(null);

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setErrorMsg('Please enter your GitHub Personal Access Token.');
      return;
    }

    setIsPushing(true);
    setErrorMsg(null);
    setPushedRepoUrl(null);

    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          repoName: repoName.trim() || 'jira-react-platform',
          description: description.trim(),
          isPrivate,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to push to GitHub.');
      }

      setPushedRepoUrl(data.repoUrl);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error pushing repository to GitHub.'
      );
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-lg w-full max-w-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Push Project to Your GitHub
              </h2>
              <p className="text-xs text-slate-300">
                Automatically creates the repository on your GitHub account and pushes the main branch.
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

        <form onSubmit={handlePush} className="p-6 space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                GitHub Personal Access Token (PAT) <span className="text-red-600">*</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Jira+React+Platform"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                Generate Token on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Requires a Classic Token with the <span className="font-mono font-semibold">repo</span> scope checked.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Repository Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="jira-react-platform"
              className="w-full px-3 py-2 font-mono border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Repository Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={`p-3 rounded-md border flex items-center gap-2 text-left transition-colors ${
                !isPrivate
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              <Globe className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <div>Public Repository</div>
                <div className="text-[10px] font-normal text-slate-500">
                  Visible to everyone
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={`p-3 rounded-md border flex items-center gap-2 text-left transition-colors ${
                isPrivate
                  ? 'border-blue-600 bg-blue-50/50 text-blue-950 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <div>Private Repository</div>
                <div className="text-[10px] font-normal text-slate-500">
                  Only accessible to you
                </div>
              </div>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {pushedRepoUrl && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Successfully pushed to your GitHub!</span>
              </div>
              <a
                href={pushedRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono font-semibold text-blue-700 hover:underline"
              >
                {pushedRepoUrl}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-600"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isPushing}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating Repo & Pushing...
                </>
              ) : (
                <>
                  <FolderGit2 className="w-3.5 h-3.5" />
                  Create Repo & Push to GitHub
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
