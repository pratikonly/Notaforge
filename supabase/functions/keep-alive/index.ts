import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-keep-alive-secret",
};

const KEEP_ALIVE_SECRET = Deno.env.get("KEEP_ALIVE_SECRET");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL");

// Throttle: don't email more than once per 30 minutes
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

async function logPing(
  supabase: ReturnType<typeof createClient>,
  data: {
    status: "success" | "failure" | "unauthorized";
    notes_count?: number | null;
    response_time_ms?: number;
    error_message?: string | null;
    source?: string | null;
  },
) {
  try {
    await supabase.from("keep_alive_logs").insert(data);
  } catch (e) {
    console.error("Failed to log ping:", e);
  }
}

async function maybeSendAlert(
  supabase: ReturnType<typeof createClient>,
  errorMessage: string,
) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    console.warn("Alert skipped: RESEND_API_KEY or ALERT_EMAIL not set");
    return;
  }

  // Check last alert sent
  const { data: lastAlert } = await supabase
    .from("keep_alive_logs")
    .select("created_at")
    .eq("status", "failure")
    .not("error_message", "is", null)
    .order("created_at", { ascending: false })
    .limit(2);

  // If there's already a recent failure (other than this one), skip
  if (lastAlert && lastAlert.length >= 2) {
    const prevFailure = new Date(lastAlert[1].created_at as string).getTime();
    if (Date.now() - prevFailure < ALERT_COOLDOWN_MS) {
      console.log("Alert suppressed (cooldown)");
      return;
    }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NotaForge Alerts <onboarding@resend.dev>",
        to: [ALERT_EMAIL],
        subject: "🚨 NotaForge keep-alive FAILED",
        html: `
          <h2>Keep-alive endpoint failure</h2>
          <p>Your NotaForge database keep-alive ping just failed.</p>
          <p><strong>Error:</strong> ${errorMessage}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p>Check the admin keep-alive page for details.</p>
        `,
      }),
    });
    if (!res.ok) {
      console.error("Resend alert failed:", await res.text());
    }
  } catch (e) {
    console.error("Alert send error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const source =
    req.headers.get("user-agent")?.slice(0, 100) ?? "unknown";

  // Validate shared secret
  const providedSecret = req.headers.get("x-keep-alive-secret");
  if (!KEEP_ALIVE_SECRET || providedSecret !== KEEP_ALIVE_SECRET) {
    await logPing(supabase, {
      status: "unauthorized",
      response_time_ms: Date.now() - startTime,
      error_message: "Invalid or missing x-keep-alive-secret header",
      source,
    });
    return new Response(
      JSON.stringify({ status: "unauthorized", error: "Forbidden" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Count only ACTIVE notes (not deleted, not archived) — minimal DB work
    const { count, error } = await supabase
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .eq("is_archived", false);

    if (error) throw error;

    const responseTime = Date.now() - startTime;
    await logPing(supabase, {
      status: "success",
      notes_count: count ?? 0,
      response_time_ms: responseTime,
      source,
    });

    return new Response(
      JSON.stringify({
        status: "alive",
        timestamp: new Date().toISOString(),
        notes_count: count ?? 0,
        response_time_ms: responseTime,
        message: "Database is awake 🚀",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const responseTime = Date.now() - startTime;

    console.error("Keep-alive error:", errMsg);

    await logPing(supabase, {
      status: "failure",
      response_time_ms: responseTime,
      error_message: errMsg,
      source,
    });

    // Fire-and-forget alert
    await maybeSendAlert(supabase, errMsg);

    return new Response(
      JSON.stringify({
        status: "error",
        error: errMsg,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
