// @ts-nocheck
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SeeVibeLogo } from '../SeeVibeLogo';
import { SeeVibeProtectionGate } from '../SeeVibeProtectionGate';
import { SupabaseSetupBanner } from '../SupabaseSetupBanner';

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [msg, setMsg] = useState('');
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  if (!isOpen) return null;

  const handleGoogle = async () => {
    if (!isHumanVerified) {
      setError("Please align the fader frequency to 432Hz to verify you are a human first.");
      return;
    }
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');

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

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg('Check your email for the confirmation link.');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMsg('Password reset email sent.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] rounded-2xl w-full max-w-sm border border-[#2A2A2A] overflow-hidden flex flex-col items-center p-6 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-center mb-4">
          <SeeVibeLogo variant="icon" size={48} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {mode === 'login' ? 'Sign in to SeeVibe' : mode === 'signup' ? 'Create an Account' : 'Reset Password'}
        </h2>
        <p className="text-gray-400 text-sm text-center mb-4">Save your projects and access them anywhere.</p>

        <SupabaseSetupBanner error={error} />

        {error && <p className="text-red-500 text-xs mb-3 text-center">{error}</p>}
        {msg && <p className="text-[#00FF9C] text-xs mb-3 text-center">{msg}</p>}
        
        <form onSubmit={handleEmailAction} className="w-full flex flex-col gap-3 mb-4">
          
          {/* Honeypot Spam Bot Trap */}
          <div className="opacity-0 absolute -top-[5000px] -left-[5000px] h-0 w-0 overflow-hidden select-none" aria-hidden="true">
            <input
              type="text"
              name="see_vibe_daw_hp"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              placeholder="Leave this empty"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-[#222] text-white px-4 py-3 rounded-xl border border-[#333] outline-none focus:border-[#00FF9C] text-sm"
            required
          />
          {mode !== 'forgot' && (
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#222] text-white px-4 py-3 rounded-xl border border-[#333] outline-none focus:border-[#00FF9C] text-sm"
              required
            />
          )}

          {/* Protection Gate Integration */}
          <SeeVibeProtectionGate 
            onVerify={(val) => setIsHumanVerified(val)} 
            className="my-1 text-zinc-300" 
          />

          <button 
            type="submit"
            disabled={!isHumanVerified}
            className="w-full bg-[#00FF9C] text-black font-bold py-3 px-4 rounded-xl hover:bg-[#00cc7d] transition-colors mt-1 text-sm disabled:opacity-50"
          >
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
          </button>
        </form>

        <div className="w-full flex flex-col items-center gap-2 text-xs text-gray-400 mb-4 text-center">
          {mode === 'login' ? (
            <>
              <button type="button" onClick={() => setMode('forgot')} className="hover:text-white transition">Forgot password?</button>
              <button type="button" onClick={() => setMode('signup')} className="hover:text-white transition">Don't have an account? Sign up</button>
            </>
          ) : (
            <button type="button" onClick={() => setMode('login')} className="hover:text-white transition">Back to Sign In</button>
          )}
        </div>

        <div className="w-full flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-[#333]"></div>
          <span className="text-xs text-gray-500 uppercase font-mono">Or</span>
          <div className="flex-1 h-px bg-[#333]"></div>
        </div>

        <button 
          onClick={handleGoogle}
          disabled={!isHumanVerified}
          className="w-full bg-white text-black font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
        >
          Continue with Google
        </button>
        
        <button 
          onClick={onClose}
          className="mt-4 text-gray-500 text-sm hover:text-white transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}