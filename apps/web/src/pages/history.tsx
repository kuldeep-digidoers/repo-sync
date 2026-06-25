import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { Button } from "../components/ui/button";
import {
  Search,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCommit,
  GitPullRequest,
  Database,
  Filter,
  XCircle,
  AlertCircle,
  CheckCircle2,
  GitFork,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { PushStatus } from "@repo-sync/shared";

interface SyncJobFile {
  id: string;
  filePath: string;
  mergeResult: string;
}

interface SyncJob {
  id: string;
  status: string;
  prUrl?: string;
  prNumber?: number;
  branchName?: string;
  createdAt: string;
  targetRepo: {
    id: string;
    fullName: string;
    githubName: string;
    customerName?: string;
  };
  files: SyncJobFile[];
}

interface PushEvent {
  id: string;
  commitSha: string;
  message: string;
  authorName: string;
  pushedAt: string;
  status: PushStatus;
  repository: {
    id: string;
    fullName: string;
    githubName: string;
  };
  syncJobs: SyncJob[];
}

export function HistoryPage() {
  // Filter States
  const [statusFilter, setStatusFilter] = useState<PushStatus | "">("");
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [targetRepoFilter, setTargetRepoFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  // Query: Get all repositories to populate filter dropdowns
  const { data: repositories = [] } = useQuery({
    queryKey: ["repositories-all"],
    queryFn: () => api.getRepos(),
  });

  const mainRepos = repositories.filter((r) => r.role === "MAIN");
  const clientRepos = repositories.filter((r) => r.role === "CLIENT");

  // Query: Get paginated push events with filters
  const { data, isLoading } = useQuery({
    queryKey: [
      "push-events-history",
      statusFilter,
      repoFilter,
      targetRepoFilter,
      startDate,
      endDate,
      page,
    ],
    queryFn: () =>
      api.getPushEvents(
        {
          status: statusFilter || undefined,
          repositoryId: repoFilter || undefined,
          targetRepoId: targetRepoFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        page,
        10
      ),
  });

  const pushEvents = (data?.items || []) as PushEvent[];
  const totalPages = data?.totalPages || 1;
  const totalItems = data?.total || 0;

  const toggleExpand = (eventId: string) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const clearFilters = () => {
    setStatusFilter("");
    setRepoFilter("");
    setTargetRepoFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getPushStatusBadge = (status: PushStatus) => {
    switch (status) {
      case "NEW":
        return (
          <span className="inline-flex items-center gap-1 text-3xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Clock className="w-3 h-3" />
            NEW
          </span>
        );
      case "TRIAGED":
        return (
          <span className="inline-flex items-center gap-1 text-3xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Filter className="w-3 h-3" />
            TRIAGED
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-3xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      default:
        return null;
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return "border-text-muted/20 bg-text-muted/5 text-text-muted";
      case "DRY_RUN_RUNNING":
      case "APPLYING":
        return "border-accent/35 bg-accent/10 text-accent animate-pulse";
      case "CLEAN":
      case "APPLIED":
        return "border-success/35 bg-success/10 text-success";
      case "CONFLICT":
        return "border-warning/35 bg-warning/10 text-warning";
      case "FAILED":
        return "border-danger/35 bg-danger/10 text-danger";
      default:
        return "border-border bg-page/50 text-text-secondary";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Push & Sync History</h1>
        <p className="text-xs text-text-muted mt-1 leading-normal">
          Full audit trail of all upstream commit pushes, client target exclusions, dry-run reports, and PR merges.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary border-b border-border/40 pb-2">
          <Filter className="w-4 h-4 text-accent" />
          Filter Logs
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Main Repo Filter */}
          <div className="space-y-1">
            <label className="text-3xs font-bold text-text-secondary uppercase">Source Repo</label>
            <select
              value={repoFilter}
              onChange={(e) => {
                setRepoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-2 text-xs text-text-primary focus:outline-none transition-colors"
            >
              <option value="">All Upstreams</option>
              {mainRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Client Repo Filter */}
          <div className="space-y-1">
            <label className="text-3xs font-bold text-text-secondary uppercase">Target Repo</label>
            <select
              value={targetRepoFilter}
              onChange={(e) => {
                setTargetRepoFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-2 text-xs text-text-primary focus:outline-none transition-colors"
            >
              <option value="">All Target Clients</option>
              {clientRepos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.customerName ? `${r.customerName} (${r.githubName})` : r.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-3xs font-bold text-text-secondary uppercase">Push Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as PushStatus);
                setPage(1);
              }}
              className="w-full h-9 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-2 text-xs text-text-primary focus:outline-none transition-colors"
            >
              <option value="">All Statuses</option>
              <option value="NEW">NEW</option>
              <option value="TRIAGED">TRIAGED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div className="space-y-1">
            <label className="text-3xs font-bold text-text-secondary uppercase">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-2 text-xs text-text-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Date Range End */}
          <div className="space-y-1">
            <label className="text-3xs font-bold text-text-secondary uppercase">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-2 text-xs text-text-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {(repoFilter || targetRepoFilter || statusFilter || startDate || endDate) && (
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-3xs h-7 px-2.5 text-danger hover:bg-danger/10 hover:text-danger"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" /> Clear active filters
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, idx) => (
            <div
              key={idx}
              className="h-24 bg-card border border-border rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : pushEvents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-border/20 flex items-center justify-center mx-auto">
            <Database className="w-6 h-6 text-text-muted" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-text-primary">No Sync Logs Found</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              No commit push events matched your selected filters. Try clearing filters or setting a wider date range.
            </p>
          </div>
          {(repoFilter || targetRepoFilter || statusFilter || startDate || endDate) && (
            <Button onClick={clearFilters} className="text-xs">
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* List/Table view */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-page/30 text-3xs font-bold text-text-secondary uppercase select-none">
                    <th className="py-3.5 px-4 w-10"></th>
                    <th className="py-3.5 px-3">Pushed At</th>
                    <th className="py-3.5 px-3">Upstream Source</th>
                    <th className="py-3.5 px-3">Commit & Author</th>
                    <th className="py-3.5 px-3 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Targets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pushEvents.map((event) => {
                    const isExpanded = !!expandedEvents[event.id];
                    const shortSha = event.commitSha.substring(0, 7);

                    return (
                      <>
                        {/* Main Push Event Row */}
                        <tr
                          key={event.id}
                          onClick={() => toggleExpand(event.id)}
                          className="hover:bg-page/40 transition-colors cursor-pointer group text-xs text-text-primary"
                        >
                          <td className="py-4 px-4 text-center">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                            )}
                          </td>
                          <td className="py-4 px-3 font-medium whitespace-nowrap text-text-secondary">
                            {formatDate(event.pushedAt)}
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-1.5">
                              <GitFork className="w-3.5 h-3.5 text-accent-muted" />
                              <span className="font-semibold text-text-primary">
                                {event.repository?.githubName}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3 max-w-xs md:max-w-md truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-3xs bg-page border border-border px-1.5 py-0.5 rounded text-text-secondary">
                                {shortSha}
                              </span>
                              <span className="font-medium text-text-primary truncate">
                                {event.message}
                              </span>
                            </div>
                            <span className="text-3xs text-text-muted mt-0.5 block">
                              by {event.authorName}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-center">
                            {getPushStatusBadge(event.status)}
                          </td>
                          <td className="py-4 px-4 text-right font-medium text-text-secondary">
                            {event.syncJobs?.length || 0} client repos
                          </td>
                        </tr>

                        {/* Expandable Child Sync Jobs Row */}
                        {isExpanded && (
                          <tr className="bg-page/20 border-b border-border/40">
                            <td colSpan={6} className="py-4 px-6">
                              <div className="space-y-3.5 animate-slide-down">
                                <div className="text-3xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
                                  <GitPullRequest className="w-3.5 h-3.5 text-accent" />
                                  Sync Job Execution Details
                                </div>

                                {event.syncJobs && event.syncJobs.length > 0 ? (
                                  <div className="grid grid-cols-1 gap-2.5">
                                    {event.syncJobs.map((job) => (
                                      <div
                                        key={job.id}
                                        className="bg-card border border-border/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-semibold text-text-primary">
                                                {job.targetRepo?.customerName || job.targetRepo?.githubName}
                                              </span>
                                              <span className="font-mono text-3xs text-text-muted">
                                                ({job.targetRepo?.fullName})
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-3xs text-text-muted">
                                              <Clock className="w-3 h-3" />
                                              <span>Job Created: {formatDate(job.createdAt)}</span>
                                              <span>•</span>
                                              <span>{job.files?.length || 0} selective files</span>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {/* Status Badge */}
                                          <span
                                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border uppercase leading-none ${getJobStatusBadge(
                                              job.status
                                            )}`}
                                          >
                                            {job.status}
                                          </span>

                                          {/* PR Action Details */}
                                          {job.prUrl && (
                                            <a
                                              href={job.prUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[11px] bg-page hover:bg-card-hover border border-border px-2 py-1 rounded-md text-accent hover:text-accent-light transition-colors font-medium leading-none"
                                            >
                                              <span>PR#{job.prNumber}</span>
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="p-3 bg-page/50 border border-border border-dashed rounded-lg text-center text-xs text-text-muted">
                                    No sync jobs targeted for this push event yet. Click the row in Dashboard to configure client targeting.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-3xs text-text-muted">
                Showing page {page} of {totalPages} ({totalItems} total events)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 px-3 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
