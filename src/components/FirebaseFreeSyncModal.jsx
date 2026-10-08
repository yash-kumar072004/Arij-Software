import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

export const FirebaseFreeSyncModal = ({
  onClose,
  onWorkspaceSynced,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copiedRules, setCopiedRules] = useState(false);

  const [projectId, setProjectId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [databaseURL, setDatabaseURL] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [appId, setAppId] = useState('');
  const [remoteHubUrl, setRemoteHubUrl] = useState('');
  const [rawSnippet, setRawSnippet] = useState('');

  const [quotaStats, setQuotaStats] = useState({
    readsToday: 0,
    writesToday: 0,
    maxDailyReads: 45000,
    maxDailyWrites: 18000,
    freeTierReadLimit: 50000,
    freeTierWriteLimit: 20000,
    lastSyncAt: null,
    lastSyncSource: 'Local + Cloud Hub',
    totalSharedIssues: 0,
  });

  useEffect(() => {
    let mounted = true;
    fetch('/api/firebase/status')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const cfg = data.config || {};
        setProjectId(cfg.projectId || '');
        setApiKey(cfg.apiKey || '');
        setDatabaseURL(cfg.databaseURL || '');
        setAuthDomain(cfg.authDomain || '');
        setAppId(cfg.appId || '');
        setRemoteHubUrl(cfg.remoteHubUrl || '');
        if (data.quotaStats) {
          setQuotaStats((prev) => ({ ...prev, ...data.quotaStats }));
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Automatically parse a pasted Firebase SDK snippet or JSON object
  const handleParseSnippet = (text) => {
    setRawSnippet(text);
    if (!text.trim()) return;

    const extractField = (key) => {
      const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    const parsedProjectId = extractField('projectId');
    const parsedApiKey = extractField('apiKey');
    const parsedDbUrl = extractField('databaseURL');
    const parsedAuthDomain = extractField('authDomain');
    const parsedAppId = extractField('appId');

    if (parsedProjectId) setProjectId(parsedProjectId);
    if (parsedApiKey) setApiKey(parsedApiKey);
    if (parsedDbUrl) setDatabaseURL(parsedDbUrl);
    if (parsedAuthDomain) setAuthDomain(parsedAuthDomain);
    if (parsedAppId) setAppId(parsedAppId);

    if (
      !parsedDbUrl &&
      /^https:\/\/[a-z0-9-]+(\.firebaseio\.com|\.firebasedatabase\.app)/i.test(
        text.trim()
      )
    ) {
      setDatabaseURL(text.trim().replace(/\/+$/, ''));
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/firebase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId.trim(),
          apiKey: apiKey.trim(),
          databaseURL: databaseURL.trim(),
          authDomain: authDomain.trim(),
          appId: appId.trim(),
          remoteHubUrl: remoteHubUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Firebase Free-Tier config');
      }
      if (data.quotaStats) {
        setQuotaStats((prev) => ({ ...prev, ...data.quotaStats }));
      }
      if (data.workspace && onWorkspaceSynced) {
        onWorkspaceSynced(
          data.workspace,
          `Firebase Free-Tier (Spark $0 Plan) saved to firebase-config.json & synced (${data.workspace.issues.length} total stories)!`
        );
      }
      setStatusMessage(
        'Saved to firebase-config.json! Anyone who takes/clones your Arij repo can now watch and add stories on the 100% Free Spark Plan.'
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not save Firebase configuration'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async (direction = 'both') => {
    setSyncing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/firebase/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      if (data.quotaStats) {
        setQuotaStats((prev) => ({ ...prev, ...data.quotaStats }));
      }
      if (data.workspace && onWorkspaceSynced) {
        onWorkspaceSynced(
          data.workspace,
          `Synced with Shared Free Database — ${data.workspace.issues.length} stories active across all views!`
        );
      }
      setStatusMessage(
        data.message ||
          `Synced successfully! ${data.workspace?.issues?.length || 0} stories available across all machines.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to sync with shared database'
      );
    } finally {
      setSyncing(false);
    }
  };

  const firestoreRulesSnippet = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /arij_shared_workspace/{docId} {
      allow get, list: if docId == 'main';
      allow create, update: if docId == 'main'
        && request.resource.data.workspaceJson is string
        && request.resource.data.workspaceJson.size() <= 900000;
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard?.writeText(firestoreRulesSnippet);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Shared Firebase Database (100% Free Spark Plan)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-slate-950 rounded">
                  $0 Free Tier Only · Never Paid Plan
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Let any friend who clones your Arij repo watch &amp; add stories in real time without needing your personal login or a paid plan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Why this solves friend access + zero paid plan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                Never Goes to Paid Plan
              </div>
              <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                Uses single-document coalescing (<strong>1 read / 1 write</strong> per sync) + strict quota guard so it stays well inside Firebase&rsquo;s <strong>Free Spark Plan (50k reads/day, 20k writes/day, $0/mo)</strong>.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                Friends Can Watch &amp; Add
              </div>
              <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                Saved to <code>firebase-config.json</code> in your repo (not hidden in <code>.env</code>). When your friend clones Arij on their machine, they can immediately watch &amp; add stories!
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                <Cloud className="w-4 h-4 text-purple-600 shrink-0" />
                Zero-Config Cloud Hub Fallback
              </div>
              <p className="text-[11px] text-purple-800 mt-1 leading-relaxed">
                Even without a Firebase key, local clones automatically sync with your live Arij Cloud Hub URL and <code>workspace-db.json</code> for $0.
              </p>
            </div>
          </div>

          {/* Live Spark Free Quota Guard Telemetry */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Spark Free-Tier Quota Guard (Active Protection)
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Reads Today:{' '}
                <strong className="font-mono text-slate-900">
                  {quotaStats.readsToday} / {quotaStats.freeTierReadLimit} Free
                </strong>{' '}
                · Writes Today:{' '}
                <strong className="font-mono text-slate-900">
                  {quotaStats.writesToday} / {quotaStats.freeTierWriteLimit} Free
                </strong>{' '}
                · Billing Required: <strong className="text-emerald-700">$0.00 (No Card)</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleManualSync('both')}
                className="px-3.5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing Stories...' : 'Sync Stories Now (Watch & Push)'}
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Configuration Form */}
          {!loading && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Quick Paste: Firebase Web Config Snippet or Realtime DB URL (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rawSnippet}
                  onChange={(e) => handleParseSnippet(e.target.value)}
                  placeholder={`Paste your const firebaseConfig = { apiKey: "...", projectId: "...", databaseURL: "https://..." } from Firebase Console (Spark Free Plan) and fields below will auto-fill!`}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-md p-2.5 text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Firebase Project ID (Firestore Free Tier)
                  </label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="e.g. my-arij-free-db"
                    className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Firebase Web API Key
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="e.g. AIzaSy..."
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Firebase Realtime Database URL (Spark Free Tier — 1 GB Free)
                  </label>
                  <input
                    type="text"
                    value={databaseURL}
                    onChange={(e) => setDatabaseURL(e.target.value)}
                    placeholder="e.g. https://my-arij-free-db-default-rtdb.firebaseio.com"
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shared Arij Cloud Hub URL (Auto-syncs friend&rsquo;s localhost without needing Firebase login)
                  </label>
                  <input
                    type="text"
                    value={remoteHubUrl}
                    onChange={(e) => setRemoteHubUrl(e.target.value)}
                    placeholder="https://ais-pre-7xgyqayxy5qqaqfqzqmoor-237735571835.asia-southeast1.run.app"
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Open Team Rules Helper */}
              <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Firebase Free Spark Rules (Allows Your Friend to Watch &amp; Add Stories)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRules}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedRules ? 'Copied Rules!' : 'Copy firestore.rules'}
                  </button>
                </div>
                <pre className="text-[11px] font-mono text-emerald-300 overflow-x-auto bg-slate-950 p-2.5 rounded border border-slate-800">
                  {firestoreRulesSnippet}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving
                    ? 'Saving to firebase-config.json...'
                    : 'Save to Repo (firebase-config.json) & Sync'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
