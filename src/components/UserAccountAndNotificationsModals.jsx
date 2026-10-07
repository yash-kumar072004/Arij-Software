import React, { useState } from 'react';
import {
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  KeyRound,
  Keyboard,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Moon,
  Plus,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { UserAvatar } from './ArijPrimitives.jsx';

// ============================================================================
// 1. USER ACCOUNT, AUTHENTICATION, PREFERENCES & ORGANIZATION MODAL (Sections 1 & 2)
// ============================================================================
export const UserAccountCenterModal = ({
  currentUser,
  users,
  projects,
  organizations,
  activeOrgId,
  darkMode,
  onToggleDarkMode,
  onSwitchUser,
  onUpdateUserProfile,
  onAddUserAccount,
  onSwitchOrg,
  onCreateOrg,
  onClose,
}) => {
  // 'AUTH_SWITCH' | 'PROFILE_REGIONAL' | 'PREFERENCES' | 'SECURITY_2FA' | 'ORGANIZATION'
  const [activeTab, setActiveTab] = useState('AUTH_SWITCH');

  // Auth / Login / Sign Up state
  const [authMode, setAuthMode] = useState('LOGIN'); // 'LOGIN' | 'SIGNUP' | 'RESET_PASSWORD'
  const [loginEmail, setLoginEmail] = useState(currentUser.email || '');
  const [loginPassword, setLoginPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [authBanner, setAuthBanner] = useState(null);

  // Sign up state
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupRole, setSignupRole] = useState('Senior Software Engineer');
  const [signupDept, setSignupDept] = useState('Core Engineering');

  // Profile & Regional settings state
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [username, setUsername] = useState(
    currentUser.username ||
      currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '.')
  );
  const [email, setEmail] = useState(currentUser.email);
  const [role, setRole] = useState(currentUser.role);
  const [department, setDepartment] = useState(
    currentUser.department || 'Engineering'
  );
  const [timezone, setTimezone] = useState(
    currentUser.timezone || 'Asia/Kolkata (GMT+5:30)'
  );
  const [language, setLanguage] = useState(
    currentUser.language || 'English (US)'
  );
  const [dateFormat, setDateFormat] = useState(
    currentUser.dateFormat || 'YYYY-MM-DD'
  );
  const [timeFormat, setTimeFormat] = useState(
    currentUser.timeFormat || '24-hour'
  );

  // Preferences state
  const [defaultDashboard, setDefaultDashboard] = useState(
    'Engineering Command Dashboard'
  );
  const [defaultProjectId, setDefaultProjectId] = useState(
    projects[0]?.id || ''
  );
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Security, 2FA, Sessions, Tokens
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [ssoProvider, setSsoProvider] = useState('Google Workspace + SAML 2.0');
  const [tokens, setTokens] = useState([
    {
      id: 'pat-1',
      name: 'Arij CLI & GitHub Actions Runner',
      tokenPreview: 'arij_pat_89f4e2...c019',
      createdAt: '2026-10-01',
      lastUsed: '2 mins ago',
    },
    {
      id: 'pat-2',
      name: 'REST API Integration Token',
      tokenPreview: 'arij_pat_31a9b8...77d2',
      createdAt: '2026-09-20',
      lastUsed: '1 hour ago',
    },
  ]);
  const [newTokenLabel, setNewTokenLabel] = useState('');
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1',
      device: 'Chrome 130 on Linux Desktop (Current Session)',
      ip: '103.81.214.19 · Bengaluru, IN',
      status: 'ACTIVE NOW',
      current: true,
    },
    {
      id: 'sess-2',
      device: 'Arij Mobile PWA on iOS 18',
      ip: '103.81.214.22 · Bengaluru, IN',
      status: 'Active 14m ago',
      current: false,
    },
  ]);

  // Organization state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const matched = users.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );
    if (matched) {
      onSwitchUser(matched.id);
      setAuthBanner(`Signed in as ${matched.name} (${matched.role}).`);
    } else {
      setAuthBanner(
        `Session verified for ${currentUser.name}. Remember me: ${
          rememberMe ? 'Enabled' : 'Session only'
        }.`
      );
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim()) return;
    onAddUserAccount({
      name: signupName.trim(),
      username:
        signupUsername.trim() ||
        signupName.trim().toLowerCase().replace(/\s+/g, '.'),
      email: signupEmail.trim(),
      role: signupRole.trim(),
      department: signupDept.trim(),
    });
    setAuthBanner(
      `Account created and switched to ${signupName.trim()} with isolated personal workspace!`
    );
    setSignupName('');
    setSignupUsername('');
    setSignupEmail('');
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    onUpdateUserProfile(currentUser.id, {
      name: displayName.trim() || currentUser.name,
      username,
      email,
      role,
      department,
      timezone,
      language,
      dateFormat,
      timeFormat,
    });
    setAuthBanner('User profile and regional preferences saved.');
  };

  const handleGenerateToken = (e) => {
    e.preventDefault();
    if (!newTokenLabel.trim()) return;
    const rand = Math.random().toString(36).slice(2, 10);
    setTokens((prev) => [
      {
        id: `pat-${Date.now()}`,
        name: newTokenLabel.trim(),
        tokenPreview: `arij_pat_${rand}...99a1`,
        createdAt: '2026-10-06',
        lastUsed: 'Just now',
      },
      ...prev,
    ]);
    setNewTokenLabel('');
  };

  const handleCreateOrgSubmit = (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    onCreateOrg({
      name: newOrgName.trim(),
      domain:
        newOrgDomain.trim() ||
        `${newOrgName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    });
    setNewOrgName('');
    setNewOrgDomain('');
    setAuthBanner(`Created and switched to organization "${newOrgName.trim()}".`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserAvatar user={currentUser} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {currentUser.name}
                </h2>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Verified Account
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {currentUser.email} · {currentUser.role}
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

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-white border-b border-slate-200 flex flex-wrap gap-1.5">
          {[
            { id: 'AUTH_SWITCH', label: '1. Sign Up / Login / Switch User', icon: LogIn },
            { id: 'PROFILE_REGIONAL', label: '2. Profile & Regional', icon: Globe },
            { id: 'PREFERENCES', label: '3. Preferences & Theme', icon: Sun },
            { id: 'SECURITY_2FA', label: '4. 2FA, SSO, Tokens & Sessions', icon: Shield },
            { id: 'ORGANIZATION', label: '5. Organization & Workspace', icon: Building2 },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setAuthBanner(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {authBanner && (
          <div className="mx-6 mt-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {authBanner}
            </span>
            <button
              type="button"
              onClick={() => setAuthBanner(null)}
              className="text-emerald-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'AUTH_SWITCH' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Instant Account Switcher */}
              <div className="lg:col-span-5 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Workspace Accounts ({users.length})
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {users.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onSwitchUser(u.id);
                          setLoginEmail(u.email);
                          setAuthBanner(`Switched active session to ${u.name}.`);
                        }}
                        className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                          isCurrent
                            ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar user={u} size="sm" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {u.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {u.email} · {u.role}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-mono font-bold text-blue-700 shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Sign Up / Login / Reset Password / OAuth */}
              <div className="lg:col-span-7 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMode('LOGIN')}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        authMode === 'LOGIN'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('SIGNUP')}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        authMode === 'SIGNUP'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      Sign Up New Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('RESET_PASSWORD')}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        authMode === 'RESET_PASSWORD'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      Forgot / Change Password
                    </button>
                  </div>
                </div>

                {authMode === 'LOGIN' && (
                  <form onSubmit={handleLoginSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 text-slate-600">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        Remember me for 30 days
                      </label>
                      <button
                        type="button"
                        onClick={() => setAuthMode('RESET_PASSWORD')}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Sign In to Arij Workspace
                    </button>

                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-400 text-center uppercase">
                        Enterprise OAuth &amp; Single Sign-On (SSO)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setAuthBanner(
                              'Authenticated via Google Workspace OAuth 2.0.'
                            )
                          }
                          className="py-1.5 px-2 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100"
                        >
                          Google Login
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAuthBanner('Authenticated via GitHub OAuth.')
                          }
                          className="py-1.5 px-2 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100"
                        >
                          GitHub Login
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAuthBanner(
                              'Authenticated via Enterprise SAML 2.0 / SCIM.'
                            )
                          }
                          className="py-1.5 px-2 text-xs font-semibold bg-white border border-slate-300 rounded hover:bg-slate-100"
                        >
                          SAML SSO
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {authMode === 'SIGNUP' && (
                  <form onSubmit={handleSignupSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Display Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="e.g. Neha Kapoor"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={signupUsername}
                          onChange={(e) => setSignupUsername(e.target.value)}
                          placeholder="neha.kapoor"
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="neha.kapoor@kawach.ai"
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Role
                        </label>
                        <input
                          type="text"
                          value={signupRole}
                          onChange={(e) => setSignupRole(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          value={signupDept}
                          onChange={(e) => setSignupDept(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create Account &amp; Personal Workspace
                    </button>
                  </form>
                )}

                {authMode === 'RESET_PASSWORD' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Reset or change password for <strong>{currentUser.email}</strong>.
                    </p>
                    <input
                      type="password"
                      placeholder="Current password (optional for reset)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <input
                      type="password"
                      placeholder="New strong password (min 12 chars)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAuthBanner(
                          `Password updated and verification email sent to ${currentUser.email}.`
                        )
                      }
                      className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md"
                    >
                      Update Password &amp; Send Verification
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'PROFILE_REGIONAL' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title / Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department / Team
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option>Asia/Kolkata (GMT+5:30)</option>
                    <option>UTC (Coordinated Universal Time)</option>
                    <option>America/New_York (EST)</option>
                    <option>Europe/London (GMT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option>English (US)</option>
                    <option>Hindi (हिन्दी)</option>
                    <option>Deutsch</option>
                    <option>日本語</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option>YYYY-MM-DD</option>
                    <option>MMM DD, YYYY</option>
                    <option>DD/MM/YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time Format
                  </label>
                  <select
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option>24-hour</option>
                    <option>12-hour (AM/PM)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Profile &amp; Regional Settings
                </button>
              </div>
            </form>
          )}

          {activeTab === 'PREFERENCES' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    Appearance &amp; Theme Mode
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleDarkMode(false)}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center gap-2 ${
                        !darkMode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Light Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleDarkMode(true)}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold border flex items-center justify-center gap-2 ${
                        darkMode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark Mode
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-slate-900">
                    Default Startup Workspace
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={defaultDashboard}
                      onChange={(e) => setDefaultDashboard(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    >
                      <option>Engineering Command Dashboard</option>
                      <option>My Personal Space</option>
                      <option>Active Sprint Board</option>
                    </select>
                    <select
                      value={defaultProjectId}
                      onChange={(e) => setDefaultProjectId(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.key} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 text-xs">
                  <div className="font-bold text-slate-900">
                    Notification &amp; Email Preferences
                  </div>
                  <label className="flex items-center justify-between">
                    <span>Email alerts for @mentions &amp; assignments</span>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Slack &amp; Webhook real-time push</span>
                    <input
                      type="checkbox"
                      checked={slackNotifications}
                      onChange={(e) => setSlackNotifications(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 text-xs">
                  <div className="font-bold text-slate-900">
                    Accessibility &amp; Shortcuts
                  </div>
                  <label className="flex items-center justify-between">
                    <span>Prefer Reduced Motion animations</span>
                    <input
                      type="checkbox"
                      checked={reducedMotion}
                      onChange={(e) => setReducedMotion(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>High-Contrast WCAG AA status borders</span>
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SECURITY_2FA' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      Two-Factor Authentication (2FA TOTP)
                    </span>
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    />
                  </div>
                  <p className="text-slate-500">
                    Protects account with authenticator app verification and hardware security keys.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    Enterprise SSO / SAML / SCIM Provisioning
                  </div>
                  <div className="text-slate-600 font-mono">{ssoProvider}</div>
                </div>
              </div>

              {/* Personal Access Tokens */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    Personal Access Tokens &amp; API Keys
                  </span>
                </div>
                <form onSubmit={handleGenerateToken} className="flex gap-2">
                  <input
                    type="text"
                    value={newTokenLabel}
                    onChange={(e) => setNewTokenLabel(e.target.value)}
                    placeholder="Token label (e.g. Arij CLI / GitHub Webhook)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                  >
                    + Generate PAT
                  </button>
                </form>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {tokens.map((tk) => (
                    <div
                      key={tk.id}
                      className="px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">
                          {tk.name}
                        </span>
                        <span className="ml-2 font-mono text-slate-500">
                          {tk.tokenPreview}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTokens((prev) => prev.filter((x) => x.id !== tk.id))
                        }
                        className="text-red-600 hover:underline text-[11px]"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Sessions & Login History */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-900">
                  Active Sessions &amp; Security Login History
                </div>
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="px-3 py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {s.device}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {s.ip} · {s.status}
                        </div>
                      </div>
                      {!s.current && (
                        <button
                          type="button"
                          onClick={() =>
                            setSessions((prev) =>
                              prev.filter((x) => x.id !== s.id)
                            )
                          }
                          className="text-red-600 hover:underline text-[11px] font-semibold"
                        >
                          Terminate Session
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ORGANIZATION' && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-900">
                  Arij Top-Level Organization Hierarchy (`Arij → Organization → Projects`)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        onSwitchOrg(org.id);
                        setAuthBanner(`Switched to organization: ${org.name}`);
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-all ${
                        org.id === activeOrgId
                          ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600'
                          : 'bg-white border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">
                        {org.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        {org.domain} · {org.plan}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleCreateOrgSubmit}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="text-xs font-bold text-slate-900">
                  Create New Organization / Workspace Container
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization Name (e.g. ABC Company)"
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md"
                  />
                  <input
                    type="text"
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                    placeholder="Domain (e.g. abccompany.com)"
                    className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    + Create Organization
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. IN-APP NOTIFICATIONS CENTER MODAL (Section 20)
// ============================================================================
export const NotificationsDrawerModal = ({
  notifications,
  onMarkAllRead,
  onSelectIssue,
  onClose,
}) => {
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'MENTIONS'

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'MENTIONS') return n.category === 'MENTION';
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white border-l border-slate-200 shadow-2xl w-full max-w-md h-full flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Arij Notifications Center
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-200 flex items-center gap-1.5 bg-white">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'UNREAD', label: 'Unread' },
            { id: 'MENTIONS', label: '@Mentions' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No notifications in this filter.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.issueId) {
                    onSelectIssue(item.issueId);
                    onClose();
                  }
                }}
                className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                  !item.read ? 'bg-blue-50/40' : 'bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono font-semibold text-blue-700">
                    {item.typeLabel}
                  </span>
                  <span className="font-mono">{item.time}</span>
                </div>
                <div className="text-xs font-semibold text-slate-900 mt-1">
                  {item.title}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">{item.body}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. KEYBOARD SHORTCUTS MODAL (Sections 1 & 34)
// ============================================================================
export const KeyboardShortcutsModal = ({ onClose }) => {
  const shortcuts = [
    { key: 'c', desc: 'Open Create Issue modal from anywhere' },
    { key: '/', desc: 'Focus Global Quick Search & AQL Jump' },
    { key: 'b', desc: 'Switch to Active Sprint Board' },
    { key: 'm', desc: 'Switch to My Personal Space (User Center-Line Board)' },
    { key: 'd', desc: 'Switch to Dashboards, OKRs & RICE Discovery' },
    { key: 'i', desc: 'Switch to Issues & AQL Search Navigator' },
    { key: 'a', desc: 'Open Arij AI Project Assistant' },
    { key: '?', desc: 'Toggle Keyboard Shortcuts reference' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Arij Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 divide-y divide-slate-200">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="py-2.5 flex items-center justify-between text-xs"
            >
              <span className="text-slate-700 font-medium">{s.desc}</span>
              <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-900">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
