import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  GitPullRequest,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Loader2,
  FileCode,
  User,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { api } from "../lib/api-client";
import { Button } from "../components/ui/button";

export function DashboardPage() {
  const navigate = useNavigate();

  // Query: get all active repositories to calculate stats
  const { data: repos = [] } = useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepos(),
  });

  // Query: get recent push events (poll every 5s)
  const { data: pushEventsData, isLoading } = useQuery({
    queryKey: ["push-events-dashboard"],
    queryFn: () => api.getPushEvents(undefined, 1, 20),
    refetchInterval: 5000, // automatic background polling
  });

  const pushEvents = pushEventsData?.items || [];
  const totalPushesCount = pushEventsData?.total || 0;

  // Calculate local stats
  const newPushesCount = pushEvents.filter((p) => p.status === "NEW").length;
  const triagedPushesCount = pushEvents.filter((p) => p.status === "TRIAGED").length;
  const completedPushesCount = pushEvents.filter((p) => p.status === "COMPLETED").length;

  const conflictEvents = pushEvents.filter((p) => p.syncJobs?.some((j: any) => j.status === "CONFLICT"));
  const conflictCount = conflictEvents.length;
  const firstConflictEventId = conflictEvents[0]?.id;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const appliedThisWeek = pushEvents
    .flatMap((p) => p.syncJobs || [])
    .filter((j: any) => j.status === "APPLIED" && new Date(j.createdAt) >= oneWeekAgo).length;

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent uppercase">
            New
          </span>
        );
      case "TRIAGED":
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning uppercase">
            Triaged
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success uppercase">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Dashboard</h1>
        <p className="text-text-secondary text-sm">
          Overview of your repository synchronization activity.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        <StatCard
          icon={<GitMerge className="w-5 h-5" />}
          label="Connected Repos"
          value={String(repos.length)}
          color="accent"
          onClick={() => navigate("/dashboard/repositories")}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Pending Conflicts"
          value={String(conflictCount)}
          color={conflictCount > 0 ? "danger" : "success"}
          onClick={firstConflictEventId ? () => navigate(`/dashboard/push-events/${firstConflictEventId}`) : undefined}
        />
        <StatCard
          icon={<GitPullRequest className="w-5 h-5" />}
          label="Syncs This Week"
          value={String(appliedThisWeek)}
          color="success"
          onClick={() => navigate("/dashboard/history")}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Awaiting Triage"
          value={String(newPushesCount)}
          color="warning"
          onClick={() => {
            const el = document.getElementById("webhook-stream-header");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </div>

      {/* Push Events Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <GitPullRequest className="w-4.5 h-4.5 text-accent" />
              Push Webhook Stream
            </h2>
            <span className="text-3xs text-text-muted bg-card border border-border px-2 py-0.5 rounded-full">
              Polling Live
            </span>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2.5">
              <Loader2 className="w-7 h-7 text-accent animate-spin" />
              <p className="text-xs text-text-secondary">Retrieving webhook stream...</p>
            </div>
          ) : pushEvents.length > 0 ? (
            <div className="space-y-4">
              {pushEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/push-events/${event.id}`)}
                  className="bg-card border border-border hover:border-border-light rounded-xl p-5 hover:bg-card-hover cursor-pointer transition-all duration-200 group flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(event.status)}
                        <span className="text-3xs font-mono bg-border px-2 py-0.5 rounded text-text-muted">
                          {event.commitSha.substring(0, 7)}
                        </span>
                      </div>
                      <span className="text-3xs text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(event.pushedAt)}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-text-primary group-hover:text-accent transition-colors leading-relaxed line-clamp-1">
                      {event.message}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-3xs text-text-secondary">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-text-muted" />
                        {event.authorName}
                      </span>
                      <span className="font-mono text-text-muted">
                        {event.repository?.githubOwner}/{event.repository?.githubName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-page border border-border/80">
                        <FileCode className="w-3 h-3 text-text-muted" />
                        File changes pending
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-accent-muted flex items-center justify-center mb-5 animate-float">
                <GitPullRequest className="w-7 h-7 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">No Push Events Tracked</h3>
              <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
                Connect your upstream main source repository. When commits are pushed to the tracked branch, they will appear here automatically.
              </p>
              <Button
                variant="secondary"
                onClick={() => navigate("/dashboard/repositories")}
                className="text-xs flex items-center gap-1"
              >
                Configure Repositories <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar Info Panel */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-success" />
              Integration Health
            </h3>
            <div className="text-xs space-y-3 leading-relaxed text-text-secondary">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-muted">Webhook URL:</span>
                <span className="font-mono text-3xs font-semibold text-text-primary bg-page border border-border px-1.5 py-0.5 rounded">
                  /webhooks/github
                </span>
              </div>
              <p className="text-3xs text-text-muted leading-relaxed">
                Configure your GitHub App to send <strong>Push</strong> event webhooks to this endpoint. Incoming pushes are verified via HMAC-SHA256 signature checking.
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Getting Started Guide</h3>
            <ol className="text-xs space-y-3 text-text-secondary list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Navigate to <span className="underline cursor-pointer text-accent" onClick={() => navigate("/dashboard/repositories")}>Repositories</span>.
              </li>
              <li>Link your upstream main repository.</li>
              <li>Link one or more downstream client repos.</li>
              <li>Push a commit to the main repo's target branch to sync!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "accent" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const colorMap = {
    accent: "bg-accent-muted text-accent",
    success: "bg-success-muted text-success",
    warning: "bg-warning-muted text-warning",
    danger: "bg-danger-muted text-danger",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-card border border-border rounded-xl p-4 hover:border-border-light transition-all group ${
        onClick ? "cursor-pointer hover:shadow-lg hover:shadow-accent/5 active:scale-[0.98]" : ""
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-lg ${colorMap[color]} flex items-center justify-center group-hover:scale-105 transition-transform`}
        >
          {icon}
        </div>
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
