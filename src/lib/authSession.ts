import { supabase } from "@/integrations/supabase/client";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait briefly for Supabase to hydrate the current session after OAuth redirect.
 * This avoids false "not logged in" redirects during the post-login handoff.
 */
export async function waitForAuthenticatedSession(
  maxAttempts = 6,
  delayMs = 200
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      return session;
    }

    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}
