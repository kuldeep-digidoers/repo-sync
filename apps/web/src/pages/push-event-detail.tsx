import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  GitCommit,
  User,
  Calendar,
  FileCode,
  Plus,
  Minus,
  CheckCircle2,
  ExternalLink,
  Copy,
  ChevronRight,
  Folder,
  Loader2,
  AlertCircle,
  GitMerge,
  Server,
  Settings,
  HelpCircle,
  Play,
  RotateCcw,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api-client";
import { Button } from "../components/ui/button";
import toast from "react-hot-toast";
import type { SyncJob, Repository } from "@repo-sync/shared";

interface FileChange {
  id: string;
  filePath: string;
  changeType: string;
  patch: string | null;
  additions: number;
  deletions: number;
}

interface CommitFileGroup {
  sha: string;
  message: string;
  authorName: string;
  date: string;
  files: Array<{
    filePath: string;
    changeType: string;
    additions: number;
    deletions: number;
  }>;
}

export function PushEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"diff" | "sync">("diff");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [openCommitShas, setOpenCommitShas] = useState<string[]>([]);

  // Sync targeting states
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  // Map of repoId -> filePaths[]
  const [fileSelection, setFileSelection] = useState<Record<string, string[]>>({});

  // Query: Fetch Push Event detail
  const { data: event, isLoading, error } = useQuery({
    queryKey: ["push-event", id],
    queryFn: () => api.getPushEvent(id as string),
    enabled: !!id,
  });

  // Query: Fetch active client repositories
  const { data: repositories = [] } = useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepos(),
  });

  const clientRepos = repositories.filter(
    (r) => r.role === "CLIENT" && r.isActive
  );

  // Query: Fetch existing sync jobs for this push event
  const { data: syncJobs = [], refetch: refetchSyncJobs } = useQuery({
    queryKey: ["sync-jobs", id],
    queryFn: () => api.getSyncJobs(id as string),
    enabled: !!id,
  });

  // Poll sync jobs if any job is currently in progress (PENDING, DRY_RUN_RUNNING, or APPLYING)
  const isAnyJobRunning = syncJobs.some(
    (job) => job.status === "PENDING" || job.status === "DRY_RUN_RUNNING" || job.status === "APPLYING"
  );

  useEffect(() => {
    let intervalId: any;
    if (isAnyJobRunning) {
      intervalId = setInterval(() => {
        refetchSyncJobs();
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAnyJobRunning, refetchSyncJobs]);

  // Mutation: Triage Push Event (Mark as TRIAGED)
  const triageMutation = useMutation({
    mutationFn: () => api.triagePushEvent(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push-event", id] });
    },
  });

  // Automatically trigger triage when detail page is opened
  useEffect(() => {
    if (event && event.status === "NEW") {
      triageMutation.mutate();
    }
  }, [event]);

  // Set default selected file when files load
  useEffect(() => {
    if (!event?.files || event.files.length === 0) {
      setSelectedFileId(null);
      setOpenCommitShas([]);
      return;
    }

    const commitGroups = (((event as any).commitFileGroups || []) as CommitFileGroup[])
      .filter((group) => group.files.length > 0);
    const firstGroupedFilePath = commitGroups[0]?.files[0]?.filePath;
    const firstGroupedFile = firstGroupedFilePath
      ? event.files.find((file) => file.filePath === firstGroupedFilePath)
      : null;
    const currentFileStillExists = event.files.some((file) => file.id === selectedFileId);

    if (commitGroups.length > 0 && openCommitShas.length === 0) {
      setOpenCommitShas([commitGroups[0].sha]);
    }

    if (!selectedFileId || !currentFileStillExists) {
      setSelectedFileId(firstGroupedFile?.id || event.files[0].id);
    }
  }, [event, selectedFileId, openCommitShas.length]);

  // Initialize file selections when repositories and files are loaded
  useEffect(() => {
    if (event?.files && clientRepos.length > 0) {
      const initialSelection: Record<string, string[]> = {};
      const filePaths = event.files.map((f) => f.filePath);
      
      clientRepos.forEach((repo) => {
        initialSelection[repo.id] = [...filePaths];
      });
      setFileSelection(initialSelection);
    }
  }, [event, repositories]);

  // Mutation: Create Sync Jobs (Dry Run)
  const createSyncJobsMutation = useMutation({
    mutationFn: (data: { targetRepoIds: string[]; filesByRepo: Record<string, string[]> }) =>
      api.createSyncJobs(id as string, data),
    onSuccess: () => {
      toast.success("Dry-run analysis enqueued!");
      refetchSyncJobs();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to start dry-run analysis");
    },
  });

  // Mutation: Retry single dry-run
  const retryDryRunMutation = useMutation({
    mutationFn: (jobId: string) => api.retrySyncJobDryRun(jobId),
    onSuccess: () => {
      toast.success("Retrying dry-run check...");
      refetchSyncJobs();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to retry dry-run");
    },
  });

  // Mutation: merge clean sync jobs
  const applySyncJobsMutation = useMutation({
    mutationFn: async () => {
      const latest = await refetchSyncJobs();
      const latestCleanJobIds = (latest.data || [])
        .filter((job) => job.status === "CLEAN")
        .map((job) => job.id);

      if (latestCleanJobIds.length === 0) {
        throw new Error("No clean sync jobs are ready to merge. Please wait for dry-run or retry it.");
      }

      return api.applySyncJobs(id as string, latestCleanJobIds, { autoMerge: true });
    },
    onSuccess: () => {
      toast.success("Merge request sent!");
      refetchSyncJobs();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to merge sync jobs");
    },
  });

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    toast.success("Commit SHA copied!");
  };

  const handleRepoToggle = (repoId: string) => {
    if (selectedRepoIds.includes(repoId)) {
      setSelectedRepoIds(selectedRepoIds.filter((x) => x !== repoId));
    } else {
      setSelectedRepoIds([...selectedRepoIds, repoId]);
    }
  };

  const handleFileToggle = (repoId: string, filePath: string) => {
    const currentSelected = fileSelection[repoId] || [];
    if (currentSelected.includes(filePath)) {
      setFileSelection({
        ...fileSelection,
        [repoId]: currentSelected.filter((x) => x !== filePath),
      });
    } else {
      setFileSelection({
        ...fileSelection,
        [repoId]: [...currentSelected, filePath],
      });
    }
  };

  const handleToggleAllFilesForRepo = (repoId: string, allFiles: string[]) => {
    const currentSelected = fileSelection[repoId] || [];
    if (currentSelected.length === allFiles.length) {
      // Clear all
      setFileSelection({
        ...fileSelection,
        [repoId]: [],
      });
    } else {
      // Select all
      setFileSelection({
        ...fileSelection,
        [repoId]: [...allFiles],
      });
    }
  };

  const handleRunDryRun = () => {
    if (selectedRepoIds.length === 0) {
      toast.error("Please select at least one client repository.");
      return;
    }

    const payload: Record<string, string[]> = {};
    let hasSelectedFiles = false;

    selectedRepoIds.forEach((repoId) => {
      const files = fileSelection[repoId] || [];
      if (files.length > 0) {
        payload[repoId] = files;
        hasSelectedFiles = true;
      }
    });

    if (!hasSelectedFiles) {
      toast.error("Please select at least one file to sync for the targeted repositories.");
      return;
    }

    createSyncJobsMutation.mutate({
      targetRepoIds: selectedRepoIds,
      filesByRepo: payload,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && activeTab === "sync") {
        e.preventDefault();
        if (selectedRepoIds.length > 0 && !createSyncJobsMutation.isPending && !isAnyJobRunning) {
          handleRunDryRun();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, selectedRepoIds, createSyncJobsMutation.isPending, isAnyJobRunning, fileSelection]);

  const handleExcludeAndRetry = (job: SyncJob, conflictedFilePath: string) => {
    // 1. Remove the file from state targeting for this repo
    const currentSelected = fileSelection[job.targetRepoId] || [];
    const updatedSelected = currentSelected.filter((x) => x !== conflictedFilePath);
    if (updatedSelected.length === 0) {
      toast.error("Cannot retry this repo after excluding its last selected file.");
      return;
    }
    
    setFileSelection({
      ...fileSelection,
      [job.targetRepoId]: updatedSelected,
    });

    // 2. We delete the previous sync job and trigger a new dry run in a single flow, 
    // but a simpler/safer backend approach: we can just call createSyncJobs again with updated selection!
    toast.loading("Excluding file and re-running dry-run...", { duration: 2000 });
    
    // We run creation mutation directly with updated select
    createSyncJobsMutation.mutate({
      targetRepoIds: [job.targetRepoId],
      filesByRepo: {
        [job.targetRepoId]: updatedSelected,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-sm text-text-secondary">Retrieving commit diff details...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-20">
        <AlertCircle className="w-12 h-12 text-danger mx-auto" />
        <h2 className="text-lg font-semibold text-text-primary">Push Event Not Found</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          The requested commit push event record could not be loaded. It may have been deleted.
        </p>
        <Button onClick={() => navigate("/dashboard")} variant="secondary" className="flex items-center gap-1 mx-auto text-xs">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const files = (event.files || []) as FileChange[];
  const allFilePaths = files.map((f) => f.filePath);
  const commitFileGroups = (((event as any).commitFileGroups || []) as CommitFileGroup[])
    .filter((group) => group.files.length > 0);
  const fileByPath = new Map(files.map((file) => [file.filePath, file]));
  
  const cleanJobs = syncJobs.filter(
    (job) => job.status === "CLEAN"
  );
  const cleanJobIds = cleanJobs.map((job) => job.id);
  const failedJobs = syncJobs.filter((job) => job.status === "FAILED");
  const conflictJobs = syncJobs.filter((job) => job.status === "CONFLICT");
  const appliedJobs = syncJobs.filter((job) => job.status === "APPLIED");
  const pendingReviewJobs = syncJobs.filter((job) => job.status === "PENDING" || job.status === "DRY_RUN_RUNNING");

  // Group files by top-level folder for Diff Viewer
  const groupedFiles: Record<string, FileChange[]> = {};
  files.forEach((file) => {
    const parts = file.filePath.split("/");
    const folder = parts.length > 1 ? parts[0] : "/";
    if (!groupedFiles[folder]) {
      groupedFiles[folder] = [];
    }
    groupedFiles[folder].push(file);
  });

  const selectedFile = files.find((f) => f.id === selectedFileId);

  const toggleCommitGroup = (sha: string) => {
    setOpenCommitShas((current) =>
      current.includes(sha)
        ? current.filter((item) => item !== sha)
        : [...current, sha]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Loader2 className="w-4 h-4 text-text-muted animate-spin" />;
      case "DRY_RUN_RUNNING":
      case "APPLYING":
        return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
      case "CLEAN":
      case "APPLIED":
        return <CheckCircle2 className="w-4.5 h-4.5 text-success" />;
      case "CONFLICT":
        return <AlertTriangle className="w-4.5 h-4.5 text-warning" />;
      case "FAILED":
        return <XCircle className="w-4.5 h-4.5 text-danger" />;
      default:
        return null;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "PENDING":
      case "DRY_RUN_RUNNING":
      case "APPLYING":
        return "bg-accent/10 border-accent/20 text-accent";
      case "CLEAN":
      case "APPLIED":
        return "bg-success/15 border-success/30 text-success";
      case "CONFLICT":
        return "bg-warning/15 border-warning/30 text-warning";
      case "FAILED":
        return "bg-danger/15 border-danger/30 text-danger";
      default:
        return "bg-border text-text-secondary";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </button>

      {/* Header Panel */}
      <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent/15 border border-accent/25 text-accent uppercase tracking-wider">
                Push Webhook Commit
              </span>
              <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-border text-text-muted">
                {event.repository?.githubOwner}/{event.repository?.githubName}
              </span>
            </div>
            <h1 className="text-lg font-bold text-text-primary leading-snug">{event.message}</h1>
            
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-3xs text-text-secondary pt-0.5">
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="w-3.5 h-3.5 text-text-muted" />
                <span className="font-semibold text-text-primary">{event.commitSha.substring(0, 7)}</span>
                <button
                  onClick={() => handleCopySha(event.commitSha)}
                  className="p-0.5 rounded hover:bg-card-hover text-text-muted hover:text-text-primary transition-colors"
                  title="Copy full SHA"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-text-muted" />
                {event.authorName}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                {new Date(event.pushedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <a
            href={`https://github.com/${event.repository?.fullName}/commit/${event.commitSha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-3xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-card-hover text-text-secondary hover:text-text-primary transition-colors self-start"
          >
            <span>GitHub Commit</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("diff")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "diff"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <FileCode className="w-4 h-4" />
          Inspect Diff ({files.length} files)
        </button>
        <button
          onClick={() => setActiveTab("sync")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === "sync"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <GitMerge className="w-4 h-4" />
          Sync Targeting & Dry-Run
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "diff" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Files List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Modified Files List
            </h2>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {commitFileGroups.length > 0 ? (
                commitFileGroups.map((group, index) => {
                  const isOpen = openCommitShas.includes(group.sha);
                  return (
                    <div key={group.sha} className="border border-border rounded-lg bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCommitGroup(group.sha)}
                        className="w-full flex items-start gap-2 p-3 text-left hover:bg-card-hover transition-colors"
                      >
                        <ChevronRight className={`w-4 h-4 text-accent mt-0.5 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-3xs px-2 py-0.5 rounded bg-page border border-border text-text-primary">
                              {group.sha.substring(0, 7)}
                            </span>
                            {index === 0 && (
                              <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
                                Head
                              </span>
                            )}
                          </div>
                          <p className="text-3xs text-text-secondary mt-1 truncate" title={group.message}>
                            {group.message.split("\n")[0]}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {group.files.length} file{group.files.length === 1 ? "" : "s"} affected
                          </p>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="space-y-1 p-2 border-t border-border bg-page/30">
                          {group.files.map((groupFile) => {
                            const file = fileByPath.get(groupFile.filePath);
                            if (!file) return null;
                            const isSelected = file.id === selectedFileId;
                            return (
                              <button
                                key={`${group.sha}-${groupFile.filePath}`}
                                onClick={() => setSelectedFileId(file.id)}
                                className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 transition-all duration-150 ${
                                  isSelected
                                    ? "bg-accent/10 border-accent/40 text-text-primary font-medium"
                                    : "bg-card border-border hover:border-border-light text-text-secondary hover:bg-card-hover"
                                }`}
                              >
                                <span className="truncate block flex-1 font-mono text-3xs" title={groupFile.filePath}>
                                  {groupFile.filePath}
                                </span>
                                <span className="font-mono text-3xs font-semibold flex-shrink-0">
                                  {groupFile.additions > 0 && <span className="text-success">+{groupFile.additions} </span>}
                                  {groupFile.deletions > 0 && <span className="text-danger">-{groupFile.deletions}</span>}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                Object.keys(groupedFiles).map((folder) => (
                  <div key={folder} className="space-y-1">
                    <div className="flex items-center gap-1 text-3xs font-bold text-text-muted uppercase tracking-wider py-1 px-1">
                      <Folder className="w-3 h-3 text-accent" />
                      <span>{folder === "/" ? "Root Files" : folder}</span>
                    </div>
                    <div className="space-y-1 pl-1">
                      {groupedFiles[folder].map((file) => {
                        const isSelected = file.id === selectedFileId;
                        return (
                          <button
                            key={file.id}
                            onClick={() => setSelectedFileId(file.id)}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 transition-all duration-150 ${
                              isSelected
                                ? "bg-accent/10 border-accent/40 text-text-primary font-medium"
                                : "bg-card border-border hover:border-border-light text-text-secondary hover:bg-card-hover"
                            }`}
                          >
                            <span className="truncate block flex-1" title={file.filePath}>
                              {file.filePath.split("/").slice(1).join("/") || file.filePath}
                            </span>
                            <span className="font-mono text-3xs font-semibold flex-shrink-0">
                              {file.additions > 0 && <span className="text-success">+{file.additions} </span>}
                              {file.deletions > 0 && <span className="text-danger">-{file.deletions}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Code Diff Viewer */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">Diff Viewer</h2>
              {selectedFile && (
                <span className="text-3xs font-mono text-text-muted bg-card px-2 py-0.5 border border-border rounded capitalize">
                  {selectedFile.changeType}
                </span>
              )}
            </div>

            {selectedFile ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-page/50 border-b border-border flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-text-primary truncate" title={selectedFile.filePath}>
                    {selectedFile.filePath}
                  </span>
                  <div className="flex items-center gap-1.5 text-2xs font-mono">
                    <span className="text-success bg-success/15 border border-success/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> {selectedFile.additions}
                    </span>
                    <span className="text-danger bg-danger/15 border border-danger/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Minus className="w-3 h-3" /> {selectedFile.deletions}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-page overflow-x-auto">
                  {selectedFile.patch ? (
                    <pre className="font-mono text-2xs leading-relaxed select-text space-y-0.5">
                      {selectedFile.patch.split("\n").map((line, idx) => {
                        let lineClass = "text-text-secondary";
                        if (line.startsWith("+")) {
                          lineClass = "bg-success/10 text-success font-medium border-l-2 border-success pl-1 -mx-4 px-4";
                        } else if (line.startsWith("-")) {
                          lineClass = "bg-danger/10 text-danger font-medium border-l-2 border-danger pl-1 -mx-4 px-4";
                        } else if (line.startsWith("@@")) {
                          lineClass = "text-accent/60 bg-accent/5 font-semibold -mx-4 px-4 py-0.5";
                        }
                        return (
                          <div key={idx} className={`${lineClass} whitespace-pre`}>
                            {line}
                          </div>
                        );
                      })}
                    </pre>
                  ) : (
                    <div className="py-20 text-center text-text-muted italic text-xs">
                      No patch content available.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-text-muted italic text-xs">
                Select a file to inspect.
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-success" />
                  Merge Selected Changes
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {pendingReviewJobs.length > 0
                    ? "Dry-run is checking the selected files against the selected child repos."
                    : cleanJobIds.length > 0
                      ? `${cleanJobIds.length} clean repo job${cleanJobIds.length === 1 ? "" : "s"} ready to merge.`
                      : appliedJobs.length > 0
                        ? "Selected changes have already been applied."
                        : conflictJobs.length > 0
                          ? "Conflicts were found. Open Sync Targeting & Dry-Run to review them."
                          : failedJobs.length > 0
                            ? "Merge check failed. Open Sync Targeting & Dry-Run to see the error."
                            : "No dry-run result is ready yet."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isAnyJobRunning && (
                  <span className="text-3xs bg-accent/15 border border-accent/20 px-2.5 py-1 rounded-full text-accent flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking...
                  </span>
                )}
                {(conflictJobs.length > 0 || failedJobs.length > 0) && (
                  <Button
                    variant="secondary"
                    onClick={() => setActiveTab("sync")}
                    className="text-xs"
                  >
                    Review Results
                  </Button>
                )}
                <Button
                  onClick={() => applySyncJobsMutation.mutate()}
                  disabled={cleanJobIds.length === 0 || applySyncJobsMutation.isPending || isAnyJobRunning}
                  className="text-xs flex items-center gap-1.5 bg-success hover:bg-success/80 text-white"
                >
                  {applySyncJobsMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Merge Clean Repos ({cleanJobIds.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sync" && (
        <div className="space-y-8">
          {/* Top section: Configuration options */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Repo Selector */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Server className="w-4 h-4 text-accent" />
                Target Client Repositories
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Select the target client repositories you wish to deploy code synchronization to.
              </p>

              {clientRepos.length > 0 ? (
                <div className="space-y-2 pt-2">
                  {clientRepos.map((repo) => {
                    const isChecked = selectedRepoIds.includes(repo.id);
                    return (
                      <label
                        key={repo.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-accent/10 border-accent/30 text-text-primary"
                            : "bg-page/50 border-border hover:border-border-light text-text-secondary"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleRepoToggle(repo.id)}
                          className="w-4.5 h-4.5 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold truncate">
                            {repo.customerName || repo.githubName}
                          </span>
                          <span className="text-3xs text-text-muted font-mono truncate">
                            {repo.fullName} ({repo.branch})
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-page/50 border border-dashed border-border rounded-lg text-center text-text-muted text-xs">
                  No active client repositories. Go to Repositories list to add client targets.
                </div>
              )}
            </div>

            {/* Column 2 & 3: File Sync targeting matrix */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Settings className="w-4 h-4 text-accent" />
                  Granular File Synchronization Matrix
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Specify exactly which files should sync to which destination client repositories.
                </p>

                {selectedRepoIds.length > 0 ? (
                  <div className="border border-border rounded-lg overflow-hidden bg-page mt-3 max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-card border-b border-border text-3xs text-text-muted uppercase font-bold tracking-wider">
                          <th className="p-3">File Path</th>
                          {selectedRepoIds.map((repoId) => {
                            const repo = clientRepos.find((r) => r.id === repoId);
                            return (
                              <th key={repoId} className="p-3 text-center min-w-[100px] truncate max-w-[120px]">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-text-primary text-2xs truncate block w-full text-center">
                                    {repo?.customerName || repo?.githubName}
                                  </span>
                                  <button
                                    onClick={() => handleToggleAllFilesForRepo(repoId, allFilePaths)}
                                    className="text-[10px] text-accent hover:underline font-medium normal-case"
                                  >
                                    Toggle All
                                  </button>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {files.map((file) => (
                          <tr key={file.id} className="hover:bg-card-hover/20">
                            <td className="p-3 font-mono text-3xs text-text-secondary truncate max-w-[200px]" title={file.filePath}>
                              {file.filePath}
                            </td>
                            {selectedRepoIds.map((repoId) => {
                              const repoSelectedFiles = fileSelection[repoId] || [];
                              const isChecked = repoSelectedFiles.includes(file.filePath);
                              return (
                                <td key={repoId} className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleFileToggle(repoId, file.filePath)}
                                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-10 bg-page/50 border border-dashed border-border rounded-lg text-center text-text-muted text-xs leading-relaxed">
                    No target repositories selected. <br />
                    Check client targets on the left to activate file mapping.
                  </div>
                )}
              </div>

              {selectedRepoIds.length > 0 && (
                <div className="pt-4 border-t border-border flex justify-end">
                  <Button
                    onClick={handleRunDryRun}
                    disabled={createSyncJobsMutation.isPending || isAnyJobRunning}
                    className="text-xs flex items-center gap-1.5"
                  >
                    {createSyncJobsMutation.isPending || isAnyJobRunning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Running Analysis...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Run Dry-Run Conflict Check
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Sync Jobs Results Stream */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2 gap-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <GitMerge className="w-4.5 h-4.5 text-accent" />
                Dry-Run Analysis Reports
              </h3>
              <div className="flex items-center gap-3">
                {isAnyJobRunning && (
                  <span className="text-3xs bg-accent/15 border border-accent/20 px-2.5 py-0.5 rounded-full text-accent flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running check...
                  </span>
                )}
                {cleanJobIds.length > 0 && (
                  <Button
                    onClick={() => applySyncJobsMutation.mutate()}
                    disabled={applySyncJobsMutation.isPending || isAnyJobRunning}
                    className="text-xs flex items-center gap-1 bg-success hover:bg-success/80 text-white shadow-glow h-8"
                  >
                    {applySyncJobsMutation.isPending ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Merge Clean Repos ({cleanJobIds.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {syncJobs.length > 0 ? (
              <div className="space-y-4">
                {syncJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-card border border-border rounded-xl p-5 space-y-4"
                  >
                    {/* Job Header Info */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-text-primary">
                          {job.targetRepo?.customerName || job.targetRepo?.githubName}
                        </span>
                        <span className="font-mono text-3xs text-text-muted">
                          {job.targetRepo?.fullName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-full border ${getStatusClass(job.status)}`}>
                          {getStatusIcon(job.status)}
                          <span className="uppercase">{job.status}</span>
                        </span>

                        {job.status === "APPLIED" ? (
                          <div className="flex items-center gap-2">
                            {job.targetRepo?.autoMergeEnabled ? (
                              <span className="text-3xs bg-success/15 border border-success/20 px-2 py-0.5 rounded text-success font-semibold flex items-center gap-1">
                                Merged ✅
                              </span>
                            ) : (
                              <span className="text-3xs bg-accent/15 border border-accent/20 px-2 py-0.5 rounded text-accent font-semibold flex items-center gap-1">
                                PR Opened 🚀
                              </span>
                            )}
                            {job.prUrl && (
                              <a
                                href={job.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-3xs px-2.5 py-1 rounded border border-border hover:bg-card-hover text-text-secondary hover:text-text-primary transition-colors font-medium"
                              >
                                <span>View PR #{job.prNumber}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => retryDryRunMutation.mutate(job.id)}
                            disabled={retryDryRunMutation.isPending || isAnyJobRunning}
                            className="h-7 px-2.5 text-3xs flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Re-Check
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Job Files summary */}
                    {job.errorMessage ? (
                      <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold">Dry-run failure:</p>
                          <p className="font-mono text-3xs leading-relaxed">{job.errorMessage}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* List of files status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {job.files?.map((file) => {
                            const isConflict = file.mergeResult === "CONFLICT";
                            return (
                              <div
                                key={file.id}
                                className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2.5 ${
                                  isConflict
                                    ? "bg-warning/5 border-warning/30 text-warning"
                                    : file.mergeResult === "CLEAN"
                                    ? "bg-success/5 border-success/20 text-success"
                                    : file.mergeResult === "MERGED"
                                    ? "bg-accent/5 border-accent/20 text-accent"
                                    : "bg-page/50 border-border text-text-secondary"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 min-w-0">
                                  <span className="truncate block font-mono text-3xs" title={file.filePath}>
                                    {file.filePath}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase whitespace-nowrap">
                                    {file.mergeResult}
                                  </span>
                                </div>

                                {isConflict && (
                                  <button
                                    onClick={() => handleExcludeAndRetry(job, file.filePath)}
                                    className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-0.5 mt-1 self-start"
                                  >
                                    Exclude file & retry
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Conflict Diff Box */}
                        {job.files?.map((file) => {
                          if (file.mergeResult === "CONFLICT" && file.conflictDiff) {
                            return (
                              <div
                                key={file.id}
                                className="border border-warning/30 rounded-lg overflow-hidden"
                              >
                                <div className="px-3.5 py-2 bg-warning/10 border-b border-warning/20 text-warning text-xs font-semibold flex items-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4" />
                                  <span>Conflict hunk in {file.filePath}</span>
                                </div>
                                <div className="p-3 bg-page overflow-x-auto">
                                  <pre className="font-mono text-3xs text-warning/90 leading-relaxed select-text">
                                    {file.conflictDiff}
                                  </pre>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center text-text-secondary">
                <div className="w-12 h-12 bg-border rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <HelpCircle className="w-6 h-6 text-text-muted" />
                </div>
                <h4 className="text-xs font-semibold text-text-primary mb-1">No analysis reports generated yet</h4>
                <p className="text-3xs text-text-muted max-w-sm mx-auto leading-relaxed">
                  Select target client repositories above and run the conflict analysis dry-run check.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
