import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  GitBranch,
  Building,
  FileText,
  Save,
  Trash2,
  Calendar,
  Loader2,
  ExternalLink,
  ShieldAlert,
  History,
  CheckCircle,
} from "lucide-react";
import { api, ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingScreen } from "../components/ui/loading-screen";
import toast from "react-hot-toast";

export function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for editable fields
  const [customerName, setCustomerName] = useState("");
  const [branch, setBranch] = useState("");
  const [description, setDescription] = useState("");
  const [autoMergeEnabled, setAutoMergeEnabled] = useState(false);

  // Query: Fetch repo details
  const { data: repo, isLoading, error } = useQuery({
    queryKey: ["repository", id],
    queryFn: () => api.getRepo(id as string),
    enabled: !!id,
  });

  const {
    data: branches = [],
    isLoading: branchesLoading,
    isError: branchesError,
  } = useQuery({
    queryKey: ["repo-branches", id],
    queryFn: () => api.getRepoBranches(id as string),
    enabled: !!id && !!repo?.id && repo.isActive,
  });

  // Hydrate local state when data loads
  useEffect(() => {
    if (repo) {
      setCustomerName(repo.customerName || "");
      setBranch(repo.branch || "");
      setDescription(repo.description || "");
      setAutoMergeEnabled(repo.autoMergeEnabled || false);
    }
  }, [repo]);

  // Mutation: Update repository details
  const updateMutation = useMutation({
    mutationFn: (data: { branch: string; description: string; customerName?: string; autoMergeEnabled?: boolean }) =>
      api.updateRepo(id as string, data),
    onSuccess: () => {
      toast.success("Repository configuration saved");
      queryClient.invalidateQueries({ queryKey: ["repository", id] });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : "Failed to update repository";
      toast.error(msg);
    },
  });

  // Mutation: Deactivate repository (soft delete)
  const deactivateMutation = useMutation({
    mutationFn: () => api.deleteRepo(id as string),
    onSuccess: () => {
      toast.success("Repository deactivated successfully");
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      navigate("/dashboard/repositories");
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : "Failed to deactivate repository";
      toast.error(msg);
    },
  });
  // Query: Fetch sync history scoped to this repository
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["repo-history", id],
    queryFn: () => {
      if (!repo) {
        throw new Error("Repository is not loaded yet");
      }
      return api.getPushEvents(
        repo.role === "MAIN"
          ? { repositoryId: repo.id }
          : { targetRepoId: repo.id }
      );
    },
    enabled: !!repo?.id,
  });
  const historyEvents = (historyData?.items || []) as any[];
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch.trim()) {
      toast.error("Branch name is required");
      return;
    }

    updateMutation.mutate({
      branch: branch.trim(),
      description: description.trim(),
      customerName: repo?.role === "CLIENT" ? customerName.trim() || undefined : undefined,
      autoMergeEnabled,
    });
  };

  const handleDeactivate = () => {
    if (confirm("Are you sure you want to deactivate this repository? It will stop sync actions, but historical sync events will be kept.")) {
      deactivateMutation.mutate();
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !repo) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-20">
        <ShieldAlert className="w-12 h-12 text-danger mx-auto" />
        <h2 className="text-lg font-semibold text-text-primary">Repository Not Found</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The requested repository configuration could not be loaded. It may have been deleted.
        </p>
        <Button onClick={() => navigate("/dashboard/repositories")} variant="secondary" className="flex items-center gap-1 mx-auto text-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Repositories
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Breadcrumb / Back Button */}
      <button
        onClick={() => navigate("/dashboard/repositories")}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Repositories
      </button>

      {/* Hero Header */}
      <div className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-2xs px-2 py-0.5 rounded font-medium uppercase border ${
                repo.role === "MAIN"
                  ? "bg-accent/10 text-accent border-accent/25"
                  : "bg-success/10 text-success border-success/25"
              }`}>
                {repo.role}
              </span>
              {!repo.isActive && (
                <span className="text-2xs px-2 py-0.5 rounded font-medium bg-danger/10 text-danger border border-danger/25 uppercase">
                  Inactive
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-text-primary">{repo.githubOwner}/{repo.githubName}</h1>
            <p className="text-xs text-text-muted flex items-center gap-3">
              <span className="flex items-center gap-1 font-mono">
                <GitBranch className="w-3.5 h-3.5" />
                {repo.branch}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Added {new Date(repo.createdAt).toLocaleDateString()}
              </span>
            </p>
          </div>
          <a
            href={`https://github.com/${repo.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-border hover:bg-card-hover text-text-secondary hover:text-text-primary transition-colors self-start sm:self-auto"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-base font-semibold text-text-primary border-b border-border pb-3 mb-5">
              Repository Settings
            </h2>
            
            <form onSubmit={handleSave} className="space-y-5">
              {repo.role === "CLIENT" && (
                <Input
                  id="customerName"
                  label="Customer / Organization Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Acme Corp, Beta LLC, etc."
                  required
                  className="bg-page border-border text-sm"
                />
              )}

              <div className="space-y-1.5">
                <label htmlFor="branch" className="text-xs font-semibold text-text-secondary block">
                  Tracked / Target Branch
                </label>
                <div className="relative">
                  <select
                    id="branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    required
                    disabled={branchesLoading || !repo.isActive}
                    className="w-full h-10 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-3 pr-9 text-sm text-text-primary font-mono focus:outline-none transition-colors disabled:opacity-60"
                  >
                    <option value="">
                      {branchesLoading ? "Loading branches..." : "Select branch"}
                    </option>
                    {branch && !branches.some((item) => item.name === branch) && (
                      <option value={branch}>{branch}</option>
                    )}
                    {branches.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {branchesLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-accent absolute right-3 top-3.5 pointer-events-none" />
                  )}
                </div>
                {branchesError && (
                  <p className="text-3xs text-danger leading-normal">
                    Could not load GitHub branches. Check the GitHub App installation and repository permissions.
                  </p>
                )}
              </div>
              <p className="text-3xs text-text-muted mt-1 leading-normal">
                {repo.role === "MAIN"
                  ? "The source branch to monitor for push webhooks."
                  : "The client branch where cherry-picked pull requests will be submitted."}
              </p>

              {repo.role === "CLIENT" && (
                <label className="flex items-start gap-3 p-3 bg-page/30 border border-border rounded-lg cursor-pointer hover:border-border-light transition-colors">
                  <input
                    type="checkbox"
                    checked={autoMergeEnabled}
                    onChange={(e) => setAutoMergeEnabled(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-text-primary">
                      Auto-merge clean syncs
                    </span>
                    <p className="text-3xs text-text-muted leading-relaxed">
                      When the dry run is fully clean, skip the manual PR click and merge immediately.
                    </p>
                  </div>
                </label>
              )}

              <div className="space-y-1.5">
                <label htmlFor="description" className="text-xs font-semibold text-text-secondary block">
                  Documentation & Notes
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes on integrations, unique customizations, or history..."
                  rows={6}
                  className="w-full rounded-lg bg-page border border-border hover:border-border-light focus:border-accent p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="pt-2 border-t border-border/50 flex justify-between items-center gap-4">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 text-xs shadow-glow"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
                
                {repo.isActive && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleDeactivate}
                    disabled={deactivateMutation.isPending}
                    className="flex items-center gap-1.5 border-danger/30 text-danger hover:bg-danger/10 hover:border-danger text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate Repository
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Info/Placeholder */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              Sync Summary
            </h3>
            <div className="text-xs space-y-3 leading-relaxed text-text-secondary">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-muted">Sync Status:</span>
                <span className="font-semibold text-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Configured
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-muted">Repository Type:</span>
                <span className="font-mono">{repo.role}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-muted">Linked App Scope:</span>
                <span className="font-mono">ID: {repo.installationId}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">GitHub Integration</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              This repository is authorized via the GitHub App installation ID. The App enforces read/write access to file contents and pull request management.
            </p>
          </div>
        </div>
      </div>

      {/* Sync History Table */}
      <section className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-base font-semibold text-text-primary border-b border-border pb-3 mb-4">
          Sync History Log
        </h2>
        {isHistoryLoading ? (
          <div className="space-y-3 py-6">
            <div className="h-6 bg-page border border-border rounded-lg animate-pulse" />
            <div className="h-12 bg-page border border-border rounded-lg animate-pulse" />
            <div className="h-12 bg-page border border-border rounded-lg animate-pulse" />
          </div>
        ) : historyEvents.length === 0 ? (
          <div className="border border-border/60 rounded-xl p-6 text-center text-xs text-text-muted bg-page/30">
            No sync runs recorded yet for this repository.
          </div>
        ) : (
          <div className="border border-border/60 rounded-xl overflow-hidden bg-page/30 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-card/50 text-text-muted border-b border-border font-bold uppercase select-none">
                  <th className="p-3">Sync Date</th>
                  <th className="p-3">Origin Commit</th>
                  <th className="p-3">Files / Sync Scope</th>
                  <th className="p-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {historyEvents.map((event) => {
                  const shortSha = event.commitSha.substring(0, 7);
                  const relevantJob = repo.role === "CLIENT"
                    ? event.syncJobs?.find((j: any) => j.targetRepoId === repo.id)
                    : null;

                  return (
                    <tr key={event.id} className="hover:bg-page/40 transition-colors">
                      <td className="p-3 font-medium text-text-secondary">
                        {new Date(event.pushedAt).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-3xs bg-card border border-border px-1.5 py-0.5 rounded text-text-secondary">
                            {shortSha}
                          </span>
                          <span className="truncate max-w-[200px]" title={event.message}>
                            {event.message}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {repo.role === "CLIENT" ? (
                          <span className="text-text-secondary">
                            {relevantJob?.files?.length || 0} selective files
                          </span>
                        ) : (
                          <span className="text-text-secondary">
                            Synced to {event.syncJobs?.length || 0} client targets
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {repo.role === "CLIENT" && relevantJob ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className={`inline-flex items-center text-3xs font-semibold px-2 py-0.5 rounded border uppercase ${
                              relevantJob.status === "APPLIED" ? "bg-success/15 border-success/30 text-success" :
                              relevantJob.status === "CONFLICT" ? "bg-warning/15 border-warning/30 text-warning" :
                              relevantJob.status === "FAILED" ? "bg-danger/15 border-danger/30 text-danger" :
                              "bg-page border-border text-text-muted"
                            }`}>
                              {relevantJob.status}
                            </span>
                            {relevantJob.prUrl && (
                              <a
                                href={relevantJob.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline inline-flex items-center gap-0.5 text-3xs"
                              >
                                <span>PR #{relevantJob.prNumber}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className={`inline-flex items-center text-3xs font-semibold px-2 py-0.5 rounded border uppercase ${
                            event.status === "COMPLETED" ? "bg-success/15 border-success/30 text-success" :
                            "bg-page border-border text-text-muted"
                          }`}>
                            {event.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
