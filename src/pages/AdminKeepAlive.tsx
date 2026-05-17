import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, CheckCircle2, XCircle, ShieldAlert, ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PingLog {
  id: string;
  status: "success" | "failure" | "unauthorized";
  notes_count: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  source: string | null;
  created_at: string;
}

const KEEP_LIMIT = 10;

export default function AdminKeepAlive() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);

  // ─── Prune old rows: keep only the 10 most recent, delete the rest ───
  const pruneOldLogs = useCallback(async () => {
    setIsDeleting(true);
    try {
      // Get IDs of the 10 most recent rows
      const { data: recent, error: fetchErr } = await supabase
        .from("keep_alive_logs")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(KEEP_LIMIT);

      if (fetchErr || !recent) {
        console.error("Prune fetch error:", fetchErr);
        setIsDeleting(false);
        return;
      }

      const keepIds = recent.map((r) => r.id);

      if (keepIds.length === 0) {
        setIsDeleting(false);
        return;
      }

      // Delete everything NOT in the keep list
      const { error: deleteErr, count } = await supabase
        .from("keep_alive_logs")
        .delete({ count: "exact" })
        .not("id", "in", `(${keepIds.join(",")})`);

      if (deleteErr) {
        console.error("Prune delete error:", deleteErr);
      } else {
        setDeleteCount(count ?? 0);
        // Auto-clear the delete count message after 4s
        setTimeout(() => setDeleteCount(null), 4000);
      }
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // ─── Fetch only the 10 most recent logs ───
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("keep_alive_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(KEEP_LIMIT);

    if (!error && data) setLogs(data as PingLog[]);
    setLoading(false);
  }, []);

  // ─── Prune then fetch on load ───
  const pruneAndFetch = useCallback(async () => {
    await pruneOldLogs();
    await fetchLogs();
  }, [pruneOldLogs, fetchLogs]);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      return;
    }
    if (isAdmin) pruneAndFetch();
  }, [isAdmin, authLoading, navigate, pruneAndFetch]);

  if (authLoading || !isAdmin) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 20% 10%, rgba(120,50,180,0.25) 0%, transparent 50%)," +
            "radial-gradient(ellipse 60% 60% at 80% 20%, rgba(40,80,200,0.2) 0%, transparent 45%)," +
            "hsl(0 0% 2%)",
        }}
      >
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const lastSuccess = logs.find((l) => l.status === "success");
  const successCount = logs.filter((l) => l.status === "success").length;
  const failureCount = logs.filter((l) => l.status === "failure").length;
  const unauthorizedCount = logs.filter((l) => l.status === "unauthorized").length;

  return (
    <div
      className="min-h-screen text-foreground p-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 80% at 20% 10%, rgba(120,50,180,0.25) 0%, transparent 50%)," +
          "radial-gradient(ellipse 60% 60% at 80% 20%, rgba(40,80,200,0.2) 0%, transparent 45%)," +
          "radial-gradient(ellipse 70% 70% at 85% 80%, rgba(100,40,160,0.18) 0%, transparent 50%)," +
          "radial-gradient(ellipse 50% 50% at 10% 90%, rgba(50,100,220,0.15) 0%, transparent 45%)," +
          "hsl(0 0% 2%)",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Keep-Alive Monitor</h1>
              <p className="text-sm text-muted-foreground">
                Showing last {KEEP_LIMIT} pings · older rows auto-deleted on load
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual prune button */}
            <Button
              variant="outline"
              size="sm"
              onClick={pruneAndFetch}
              disabled={loading || isDeleting}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Pruning…" : "Prune & Refresh"}
            </Button>

            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Deleted rows banner */}
        {deleteCount !== null && (
          <div className="px-4 py-2 rounded-lg text-sm font-medium text-green-400 border border-green-500/30 bg-green-500/10">
            🗑️ Pruned {deleteCount} old log{deleteCount !== 1 ? "s" : ""} from the database.
          </div>
        )}

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Last Success</p>
                <p className="text-sm font-semibold">
                  {lastSuccess
                    ? formatDistanceToNow(new Date(lastSuccess.created_at), { addSuffix: true })
                    : "None in last 10"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Active Notes</p>
                <p className="text-2xl font-bold">{lastSuccess?.notes_count ?? "—"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Successes (last {KEEP_LIMIT})</p>
                <p className="text-2xl font-bold">{successCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Failures (last {KEEP_LIMIT})</p>
                <p className="text-2xl font-bold">{failureCount}</p>
                {unauthorizedCount > 0 && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                    <ShieldAlert className="h-3 w-3" />
                    {unauthorizedCount} unauthorized
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Logs table ── */}
        <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="hidden md:table-cell min-w-[220px]">Monitor / Source</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {loading ? "Loading…" : "No pings logged yet."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const src = log.source ?? "—";
                  let monitor = "Unknown";
                  if (/UptimeRobot/i.test(src)) monitor = "UptimeRobot";
                  else if (/cron-job\.org|cronjob/i.test(src)) monitor = "Cron-job.org";
                  else if (/Pingdom/i.test(src)) monitor = "Pingdom";
                  else if (/curl/i.test(src)) monitor = "curl (manual)";
                  else if (/Mozilla|Chrome|Safari|Firefox/i.test(src)) monitor = "Browser";
                  else if (src === "—") monitor = "—";
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.status === "success"
                              ? "default"
                              : log.status === "unauthorized"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.notes_count ?? "—"}</TableCell>
                      <TableCell>
                        {log.response_time_ms != null ? `${log.response_time_ms}ms` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">{monitor}</span>
                          <span className="text-muted-foreground text-[10px] break-all" title={src}>
                            {src}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-red-400 max-w-[300px] truncate">
                        {log.error_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Setup hint ── */}
        <Card className="p-4 bg-card/30 backdrop-blur border-border/50 text-sm text-muted-foreground space-y-3">
          <div>
            <p className="font-semibold text-foreground mb-2">Monitor setup — query param (works on free tiers)</p>
            <p>Use this URL on UptimeRobot, Cron-job.org, or any monitor (replace <code>YOUR_SECRET</code>):</p>
            <code className="block mt-2 p-2 bg-background/50 rounded text-xs break-all">
              https://ffhfmdfvqmfktkohdnlm.supabase.co/functions/v1/keep-alive?secret=YOUR_SECRET
            </code>
            <p className="mt-2 text-xs">Method: HEAD or GET. Interval: 5 min recommended. No custom headers required.</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-2">Optional — header method (paid tiers only)</p>
            <p>
              If your monitor supports custom headers, you can instead send{" "}
              <code className="text-primary">x-keep-alive-secret: &lt;your secret&gt;</code> with no query param.
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}
