// @ts-nocheck
import React from 'react';
import { X, Shield, Lock, Users, Music, Wallet, UserCircle, MessageSquare, AlertTriangle, Key } from 'lucide-react';

interface SecurityPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SecurityPolicyModal({ isOpen, onClose }: SecurityPolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-250">
      <div className="bg-[#0C0D0F] border border-[#222] rounded-[24px] w-full max-w-lg h-[85vh] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col relative">
        
        {/* Contact Banner On Top of the Pop up */}
        <div className="bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 border-b border-[#222] px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
          <div>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-fuchsia-400 block mb-0.5">Official Support Portal</span>
            <span className="text-xs text-zinc-300 font-medium">Have questions or security concerns? Contact our team.</span>
          </div>
          <a
            id="mailto-banner-seevibe"
            href="mailto:seevibehelp@gmail.com"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border border-fuchsia-500/25 rounded-lg text-[11px] font-mono text-fuchsia-300 transition-colors uppercase tracking-wider font-bold w-fit cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse" />
            <span>seevibehelp@gmail.com</span>
          </a>
        </div>

        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#18181A] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Platform Manual & Security Policy</h2>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Roles, Operations & Privacy Standards</p>
            </div>
          </div>
          <button
            id="btn-close-policy-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#141414] hover:bg-[#1C1C1C] text-zinc-400 hover:text-white border border-[#222] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Contents Workspace */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
          
          {/* Section 1: Security & Privacy Standards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 text-fuchsia-400">
              <Lock size={14} />
              1. Security & Data Protection Policies
            </h3>
            <div className="bg-[#111113] border border-[#1E1E22] rounded-xl p-4 space-y-2.5 text-xs text-zinc-400 leading-relaxed">
              <p>
                <strong className="text-zinc-200">Credential Isolation:</strong> Authentication is handled strictly through Supabase Auth using enterprise-grade JWT headers and cryptographic isolation. Platform security guarantees that accounts of any user are invisible to other participants. Password edits invoke instant server-verified checks in complete quarantine.
              </p>
              <p>
                <strong className="text-zinc-200">Cloud Storage Protection:</strong> Custom media configurations, profile pictures, and workspace audio streams are stored securely using Supabase bucket configurations. Unauthorized reads are prevented at the row-level database engine.
              </p>
              <p>
                <strong className="text-zinc-200">Audio Metadata Vaulting:</strong> Track information, balance metrics, and private audio stems compiled in the DAW are mapped with verified user IDs. They remain completely unreadable by third parties or unverified actors.
              </p>
            </div>
          </div>

          {/* Section 2: Platform Roles & System Access */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 text-pink-400">
              <Users size={14} />
              2. Platform Account Roles & System Privileges
            </h3>
            <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
              <p className="text-zinc-300">
                To keep our music workspace harmonious and secure, SeeVibe supports three distinct authorization tiers:
              </p>
              <div className="grid grid-cols-1 gap-2.5 mt-2">
                <div className="p-3.5 bg-[#111113] border border-[#1E1E22]/80 rounded-xl">
                  <span className="inline-block px-1.5 py-0.5 bg-fuchsia-500/10 text-fuchsia-300 text-[9px] font-mono border border-fuchsia-500/20 rounded mb-1 uppercase tracking-wider font-bold">Creators / Musicians</span>
                  <p className="text-zinc-400 mt-1">
                    The principal users of the platform. Authorized to operate the offline-first Beat Engine, record track configurations, modify spatial FX, edit details (full name, username, biography), update high-contrast profiles, and request token transfers via the Wallet interface.
                  </p>
                </div>
                
                <div className="p-3.5 bg-[#111113] border border-[#1E1E22]/80 rounded-xl">
                  <span className="inline-block px-1.5 py-0.5 bg-cyan-500/10 text-cyan-300 text-[9px] font-mono border border-cyan-500/20 rounded mb-1 uppercase tracking-wider font-bold">Collaborators</span>
                  <p className="text-zinc-400 mt-1">
                    Creative allies authorized to enter project studio spaces, join real-time multi-user discussion logs, and evaluate audio structures for prompt feedback. They play a vital role in polishing multi-track clip fusions.
                  </p>
                </div>

                <div className="p-3.5 bg-[#111113] border border-[#1E1E22]/80 rounded-xl">
                  <span className="inline-block px-1.5 py-0.5 bg-yellow-500/10 text-yellow-300 text-[9px] font-mono border border-yellow-500/20 rounded mb-1 uppercase tracking-wider font-bold">Platform Administrators</span>
                  <p className="text-zinc-400 mt-1">
                    Specialized accounts flagged with vetted roles who supervise structural parameters, oversee platform stability, check integrity registers, manage server moderation limits, and support our users.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Operating Guidelines - How to Operate Each Page */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 text-violet-400">
              <AlertTriangle size={14} />
              3. Feature Guides & Operating Instructions
            </h3>

            {/* Sub-block: Beat Studio Engine */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
                <Music size={13} className="text-fuchsia-400" />
                <span>The WebAudio Beat Studio Workspace</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-5">
                Build tracks utilizing standard timeline arrangements. Configure dynamic multi-channel effects including <strong className="text-zinc-300">Reverb, Feedback Delay, Chorus, Pitch Shift, and Stereo Compression</strong> on a per-channel basis. 
                When exporting, the engine delegates the rendering pipeline to a background <strong className="text-zinc-300">WebWorker Thread</strong>, preventing UI stuttering. If a mixdown is running for too long, click the <strong className="text-rose-400">Cancel Export</strong> button to abort synthesis immediately.
              </p>
            </div>

            {/* Sub-block: Wallet Page */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
                <Wallet size={13} className="text-emerald-400" />
                <span>Operating the Wallet & Balance Hub</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-5">
                The Wallet workspace tracks your streaming earnings, play counters, and active token reserves. Request balance cash-outs or buy tokens directly within the high-contrast slate-styled wallet panels. If you encounter any sync delays, trigger the database reload option or reach support instantly.
              </p>
            </div>

            {/* Sub-block: Profile Details & Password Operations */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
                <UserCircle size={13} className="text-cyan-400" />
                <span>Operating Profile Details & Photos</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-5">
                Access your profile from the main bottom navigation. Click <strong className="text-zinc-300">Edit Profile</strong> to modify your public display alias, full name, or custom bio text. Click the profile circle avatar to upload a professional, high-contrast display photo. To update your password, use the <strong className="text-zinc-300">Change Password</strong> option and specify a secure character check.
              </p>
            </div>

            {/* Sub-block: Real-time Collab */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold text-xs">
                <MessageSquare size={13} className="text-blue-400" />
                <span>Real-time Chat Rooms</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed pl-5">
                Join our multi-user collaboration channel to brainstorm beat directions. Real-time message exchanges are secured and updated dynamically using socket triggers, ensuring instant synchronization.
              </p>
            </div>
          </div>

          {/* Terms Agreement & Disclaimer Footer */}
          <div className="border-t border-[#1C1C1F] pt-4 text-[10px] text-zinc-500 font-mono text-center space-y-1 bg-[#090A0C] p-3 rounded-xl">
            <p>Vetted and Documented by SeeVibe Inc. Core Division</p>
            <p>All rights reserved. Encryption and Operations comply with modern digital standards.</p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#090A0C] border-t border-[#18181A] text-right shrink-0">
          <button
            id="btn-close-policy-bottom"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>

      </div>
    </div>
  );
}