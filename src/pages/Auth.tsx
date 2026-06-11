// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { SecurityPolicyModal } from '../components/SecurityPolicyModal';
import { SeeVibeLogo } from '../components/SeeVibeLogo';
import { SeeVibeProtectionGate } from '../components/SeeVibeProtectionGate';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    if (!isHumanVerified) {
      setError("Please align the fader frequency to 432Hz to verify you are a human first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oAuthError) {
        setError(oAuthError.message);
      }
    } catch (err: any) {
      setError(err?.message || "Google authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Invisible Honeypot field checked to block robotic crawlers
    if (honeypot) {
      console.warn("Spam honeypot filled out. Action blocked.");
      setError("Verification failed. Please refresh your session.");
      return;
    }

    // 2. Harmonic Equalizer Verification Gate check to stop automated scripts
    if (!isHumanVerified) {
      setError("Please drag the Vibe slider to 432 Hz to unlock secure system actions.");
      return;
    }

    setLoading(true);

    const { error: authError } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.origin
          }
        });

    if (authError) {
      setError(authError.message);
    } else {
      if (isLogin) navigate('/');
      else setError("Check your email for the confirmation link!");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
      <div className="w-full max-w-sm rounded-[24px] p-8 glass-card border border-border/60 bg-card/40 backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center mb-6 text-center">
          <SeeVibeLogo variant="full" size={76} className="text-center" />
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Honeypot Spam Bot Trap (Invisible to real humans, visible to bot crawlers) */}
          <div className="opacity-0 absolute -top-[5000px] -left-[5000px] h-0 w-0 overflow-hidden select-none" aria-hidden="true">
            <input
              type="text"
              name="see_vibe_hp_verification"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              placeholder="Leave this empty"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:border-pink-500 focus:outline-none transition-colors"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:border-pink-500 focus:outline-none transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 placeholder-gray-500 text-sm focus:border-pink-500 focus:outline-none transition-colors"
            required
          />

          {/* Reusable Security Protection widget (Thematic CAPTCHA) */}
          <SeeVibeProtectionGate 
            onVerify={(val) => setIsHumanVerified(val)} 
            className="my-3"
          />

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
          
          <button
            type="submit"
            disabled={loading || !isHumanVerified}
            className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold rounded-xl py-3 mt-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#222]"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0C0D11] px-2 text-zinc-500 font-mono text-[9px]">Or</span>
          </div>
        </div>

        <button
          type="button"
          id="btn-google-auth"
          onClick={handleGoogleSignIn}
          disabled={loading || !isHumanVerified}
          className="w-full flex items-center justify-center gap-2.5 py-3 border border-[#222] rounded-xl bg-[#141414] hover:bg-[#1C1C1C] text-white text-sm font-semibold transition-all hover:scale-[1.01] active:scale-95 duration-100 disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11c-2.074-1.926-4.9-3.11-8.274-3.11C5.378-.005.008 5.365.008 11.995s5.37 12 11.995 12c6.913 0 11.517-4.846 11.517-11.72 0-.788-.084-1.39-.188-1.99H12.24z"
            />
          </svg>
          <span className="text-xs font-semibold">Continue with Google</span>
        </button>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-center text-xs text-gray-400 mt-5 hover:text-white transition-colors cursor-pointer"
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>

        <div className="mt-6 border-t border-[#1F1F1F] pt-4.5 flex flex-col items-center">
          <p className="text-[9px] text-zinc-500 font-mono mb-2 uppercase tracking-widest">Need Support?</p>
          <a
            id="contact-seevibe-auth"
            href="mailto:seevibehelp@gmail.com"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#141414] hover:bg-[#1C1C1C] border border-white/5 rounded-xl text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse" />
            <span>seevibehelp@gmail.com</span>
          </a>
          
          <button
            type="button"
            id="btn-policy-auth"
            onClick={() => setIsPolicyOpen(true)}
            className="mt-3 text-[10px] text-fuchsia-400 hover:text-fuchsia-300 font-mono underline uppercase tracking-wider cursor-pointer"
          >
            Security & Privacy Policy Manual
          </button>
        </div>
      </div>

      <SecurityPolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
    </div>
  );
}