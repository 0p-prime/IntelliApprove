import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  Building2,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, demoUsers } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('aicte123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickLoginOpen, setQuickLoginOpen] = useState(false);

  // Controlled by environment flag; defaults to true for SIH evaluation/judges
  const isDemoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide a valid institutional or officer email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword('aicte123');
    setError(null);
    setLoading(true);
    setQuickLoginOpen(false);

    try {
      await login(selectedEmail, 'aicte123');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Curated demo personas covering all 6 roles
  const keyDemoRoles = [
    {
      role: 'ADMIN',
      label: 'System Admin',
      email: 'admin@aicte.gov.in',
      desc: 'National headquarters system oversight',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300'
    },
    {
      role: 'BUREAU_OFFICER',
      label: 'Bureau Officer (HQ)',
      email: 'member.secretary@aicte.gov.in',
      desc: 'Approving authority with digital signature',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
    },
    {
      role: 'REGIONAL_HEAD',
      label: 'Regional Head (NW)',
      email: 'head.nw@aicte.gov.in',
      desc: 'North-Western region oversight (Chandigarh)',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300'
    },
    {
      role: 'REGIONAL_OFFICER',
      label: 'Regional Officer (Western)',
      email: 'ro.w@aicte.gov.in',
      desc: 'Document scrutiny and SLA tracking (Mumbai)',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
    },
    {
      role: 'EVC_MEMBER',
      label: 'EVC Member (Inspection)',
      email: 'evc.expert1@aicte.gov.in',
      desc: 'Field verification committee inspector',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300'
    },
    {
      role: 'INSTITUTION',
      label: 'Institution Admin (DITM)',
      email: 'principal@ditm.ac.in',
      desc: 'Delhi Institute of Technology & Management',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans">
      {/* National Tricolor Top Stripe */}
      <div className="tricolor-bar" />

      {/* Official AICTE Government Top Banner */}
      <header className="gov-header-gradient text-white border-b border-blue-900/60 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center shadow-inner shrink-0">
              <span className="font-serif font-black text-amber-300 text-xl tracking-tighter">AICTE</span>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
                Ministry of Education • Government of India
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                All India Council for Technical Education (AICTE)
              </h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 font-medium">
              Smart India Hackathon 2026 (PS 26262)
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo & Tagline */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0B2240] text-amber-400 shadow-lg border border-amber-500/30 mb-1">
              <Building2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B2240] tracking-tight">
              IntelliApprove
            </h2>
            <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold tracking-wide">
              Automate. Monitor. Comply.
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              AICTE Integrated Approval Workflow Automation & Institutional Compliance Governance Platform
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Portal Authentication</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in with your government or institutional credentials
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. member.secretary@aicte.gov.in"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2240] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Password
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">Demo: aicte123</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-10 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0B2240] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B2240] hover:bg-[#12335C] active:bg-[#071830] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Sign In to IntelliApprove</span>
                  </>
                )}
              </button>
            </form>

            {/* Demo-credentials helper (for judges only) */}
            {isDemoLoginEnabled && (
              <div className="pt-3 border-t border-slate-100">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQuickLoginOpen(!quickLoginOpen)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Quick login as... (Judges / Demo helper)</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-amber-700 transition-transform ${quickLoginOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {quickLoginOpen && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 animate-in fade-in duration-100">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Select Demo Persona (Auto-authenticates)
                      </div>
                      {keyDemoRoles.map((roleItem) => (
                        <button
                          key={roleItem.email}
                          type="button"
                          onClick={() => handleQuickLogin(roleItem.email)}
                          className="w-full text-left p-2 rounded-lg bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleItem.badgeClass}`}>
                                {roleItem.label}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-1 font-mono">{roleItem.email}</div>
                            <div className="text-[10px] text-slate-400">{roleItem.desc}</div>
                          </div>
                          <UserCheck className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="text-center text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center justify-center gap-4 text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Role Scoped Access
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                SHA-256 Audit Chain
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Human Gate Enforced
              </span>
            </div>
            <div>AICTE Approval Process Handbook (APH) 2026-27 Compliant</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          All India Council for Technical Education (AICTE) • Ministry of Education, Govt. of India • SIH 2026
        </div>
      </footer>
    </div>
  );
};

