import { useEffect, useState } from "react";
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
import { Activity, CheckCircle2, XCircle, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
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

export default function AdminKeepAlive() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [logs, setLogs] = useState<PingLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("keep_alive_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) setLogs(data as PingLog[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/");
      return;
    }
    if (isAdmin) fetchLogs();
  }, [isAdmin, authLoading, navigate]);

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const lastSuccess = logs.find((l) => l.status === "success");
  const successCount24h = logs.filter(
    (l) =>
      l.status === "success" &&
      Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;
  const failureCount24h = logs.filter(
    (l) =>
      l.status === "failure" &&
      Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;
  const unauthorizedCount24h = logs.filter(
    (l) =>
      l.status === "unauthorized" &&
      Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Keep-Alive Monitor</h1>
              <p className="text-sm text-muted-foreground">
                Database ping history (last 7 days, max 100 entries shown)
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Last Success</p>
                <p className="text-sm font-semibold">
                  {lastSuccess
                    ? formatDistanceToNow(new Date(lastSuccess.created_at), { addSuffix: true })
                    : "Never"}
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
                <p className="text-xs text-muted-foreground">Successes (24h)</p>
                <p className="text-2xl font-bold">{successCount24h}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card/50 backdrop-blur border-border/50">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Failures (24h)</p>
                <p className="text-2xl font-bold">{failureCount24h}</p>
                {unauthorizedCount24h > 0 && (
                  <p className="text-xs text-yellow-500 flex items-center gap-1 mt-1">
                    <ShieldAlert className="h-3 w-3" />
                    {unauthorizedCount24h} unauthorized
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Logs table */}
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
                    {loading ? "Loading…" : "No pings logged yet. Set up your monitor to start."}
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

        {/* Setup hint */}
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
            <p>If your monitor supports custom headers, you can instead send <code className="text-primary">x-keep-alive-secret: &lt;your secret&gt;</code> with no query param.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
