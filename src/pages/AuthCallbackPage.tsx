import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single landing page for any redirect from a Supabase email link
 * (signup confirmation, password recovery, email change, magic link).
 * Centralising this means we only need ONE entry in the Supabase
 * Auth → URL Configuration → Redirect URLs allow-list:
 *   https://www.atomedu.kz/auth/callback
 *
 * The callback figures out where to send the user next based on the
 * `next` query param (set by the caller) plus the URL hash that the
 * Supabase SDK writes during PKCE / implicit flows. PASSWORD_RECOVERY
 * always wins over `next` — we don't want to drop a recovery session
 * onto /topics by mistake.
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Supabase populates the URL hash with type=recovery for password
    // resets and type=signup / type=magiclink for the others. We use
    // that to decide the destination, falling back to ?next=… and
    // finally /topics.
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const linkType =
      /[?#&]type=([a-z_]+)/i.exec(hash + search)?.[1]?.toLowerCase() ?? null;
    const next = params.get("next");

    let target = "/topics";
    if (linkType === "recovery") {
      target = "/auth/reset";
    } else if (next && next.startsWith("/")) {
      target = next;
    } else if (linkType === "signup" || linkType === "invite") {
      target = "/welcome";
    }

    // Wait briefly for the SDK to detect the session in the URL hash,
    // then bounce. detectSessionInUrl: true (default) handles the
    // actual session creation; we just route afterwards.
    const settle = async () => {
      // Surface common error params from the URL so the user isn't
      // stuck on a blank page when the link is bad.
      const err =
        new URLSearchParams(hash.replace(/^#/, "")).get("error_description") ||
        params.get("error_description") ||
        params.get("error");
      if (err) {
        if (!cancelled) setErrorMsg(err);
        return;
      }

      // Give the SDK one tick to ingest the hash. After that
      // getSession() resolves to the real session (or null) and we
      // route either way.
      await new Promise((r) => setTimeout(r, 50));
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        // No session attached — likely an expired or already-used link.
        navigate("/auth", { replace: true });
        return;
      }
      navigate(target, { replace: true });
    };
    void settle();

    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      {errorMsg ? (
        <div className="max-w-md text-center">
          <p className="label-mono text-[10px] text-destructive mb-2">AUTH ERROR</p>
          <p className="text-sm text-foreground/85 font-light mb-4">{errorMsg}</p>
          <button
            onClick={() => navigate("/auth", { replace: true })}
            className="label-mono text-[10px] text-primary hover:underline"
          >
            ← Кіру бетіне
          </button>
        </div>
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      )}
    </div>
  );
};

export default AuthCallbackPage;
