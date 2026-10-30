import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IntelliApproveLogo } from '../components/Logo';
import { Button } from '../components/ui/Button';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('aicte123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword('aicte123');
    setError(null);
    setLoading(true);

    try {
      await login(selectedEmail, 'aicte123');
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-2 font-sans bg-white">
      {/* ============================================================== */}
      {/* LEFT COLUMN: DARK HERO BRANDING WITH SUBTLE ANIMATED GRID */}
      {/* ============================================================== */}
      <div className="bg-[#111111] login-grid-bg p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-white select-none relative overflow-hidden">
        {/* Top: Logo with animated ring and check pop */}
        <div className="relative z-10">
          <IntelliApproveLogo size="md" showSubtitle={false} lightText={true} animated={true} />
        </div>

        {/* Center: Hero Headline & Subtitle */}
        <div className="my-12 sm:my-auto relative z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.08]">
            Every approval, <br />
            <span className="text-[#E0202A]">on time.</span>
          </h1>
          <p className="text-sm sm:text-base text-[#A1A1AA] mt-4 font-normal tracking-normal">
            Automate. Monitor. Comply.
          </p>
        </div>

        {/* Bottom: Regulatory Safeguard Statement */}
        <div>
          <p className="text-xs text-[#A1A1AA] max-w-sm font-normal leading-relaxed">
            Automation supports officials. Decisions stay with the competent authority.
          </p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT COLUMN: SIGN IN FORM */}
      {/* ============================================================== */}
      <div className="bg-white flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
              Sign in
            </h2>
            <p className="text-sm text-[#595959] mt-1 font-normal">
              Use your work email.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-white border border-[#E0202A] rounded-[8px] text-xs text-[#B5121A] font-medium animate-field-shake">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1.5">
                Email
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B] transition-colors"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B] transition-colors"
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" variant="brand" className="w-full mt-2" loading={loading}>Sign in</Button>
          </form>

          {/* Demo Quick Login Links */}
          <div className="mt-8 pt-6 border-t border-[#E6E6E6]/60 text-xs text-[#595959] leading-relaxed">
            <span>Demo: quick login as </span>
            <Button type="button" variant="quiet" size="sm" onClick={() => handleQuickLogin("principal@ditm.ac.in")}>Institution</Button>
            <span>, </span>
            <Button type="button" variant="quiet" size="sm" onClick={() => handleQuickLogin("ro.w@aicte.gov.in")}>Regional Officer</Button>
            <span>, </span>
            <Button type="button" variant="quiet" size="sm" onClick={() => handleQuickLogin("member.secretary@aicte.gov.in")}>Bureau Officer</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
