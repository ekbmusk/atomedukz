/**
 * CORS headers shared by all Edge Functions in this project. Vite dev runs
 * on :8080/:8081 and we don't want to fight CORS during local testing, so
 * the wildcard origin is fine here — every function still requires a valid
 * Supabase JWT to access user data.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
