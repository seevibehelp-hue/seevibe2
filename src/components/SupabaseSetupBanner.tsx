// @ts-nocheck
import React from 'react';
import { SUPABASE_STUB_PREFIX } from '../integrations/supabase/client';

/**
 * SupabaseSetupBanner
 *
 * Renders a prominent warning banner when the supabase client is in stub
 * mode (env vars missing on the deployment host). The stub client returns
 * errors with a stable prefix so the UI can detect and explain the issue
 * instead of showing a cryptic "Supabase not configured" string.
 *
 * Pass the error message returned from supabase.auth.* / supabase.from.* /
 * etc.; if it starts with the stub prefix the banner renders, otherwise
 * `null`.
 */
export function SupabaseSetupBanner({ error }: { error?: string | null }) {
  if (!error || !error.startsWith(SUPABASE_STUB_PREFIX)) return null;

  // Strip the prefix so the displayed text reads naturally.
  const display = error.replace(SUPABASE_STUB_PREFIX, "");

  return (
    <div
      role="alert"
      className="w-full mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left"
    >
      <div className="flex items-start gap-2.5">
        <svg
          className="w-4 h-4 mt-0.5 text-amber-400 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-300 mb-1">
            SeeVibe backend not connected
          </p>
          <p className="text-[11px] text-amber-200/80 leading-relaxed mb-2">
            {display}
          </p>
          <ol className="text-[11px] text-amber-200/80 leading-relaxed list-decimal pl-4 space-y-1">
            <li>
              Open <span className="font-mono">Vercel → Settings → Environment Variables</span>
            </li>
            <li>
              Add <span className="font-mono">VITE_SUPABASE_URL</span> and{" "}
              <span className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</span>{" "}
              (both scoped to <span className="font-semibold">Production</span>)
            </li>
            <li>
              Click <span className="font-semibold">Redeploy</span> so Vite
              re-bakes the bundle with the new values
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}