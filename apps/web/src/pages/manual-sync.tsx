import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCode,
  GitCommit,
  GitMerge,
  Loader2,
  Server,
} from "lucide-react";
import { api, ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import toast from "react-hot-toast";

export function ManualSyncPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mainRepoId, setMainRepoId] = useState("");
  const [mainBranch, setMainBranch] = useState("");
  const [targetRepoIds, setTargetRepoIds] = useState<string[]>([]);
  const [commitShas, setCommitShas] = useState<string[]>([]);
  const [filePaths, setFilePaths] = useState<string[]>([]);

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepos(),
  });

  const mainRepos = repos.filter((repo) => repo.role === "MAIN" && repo.isActive);
  const childRepos = repos.filter(
    (repo) => repo.role === "CLIENT" && repo.isActive && repo.id !== mainRepoId
  );
  const selectedMainRepo = mainRepos.find((repo) => repo.id === mainRepoId);

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ["repo-branches", mainRepoId],
    queryFn: () => api.getRepoBranches(mainRepoId),
    enabled: !!mainRepoId,
  });

  useEffect(() => {
    if (selectedMainRepo && !mainBranch) {
      setMainBranch(selectedMainRepo.branch);
    }
  }, [selectedMainRepo, mainBranch]);

  const { data: commits = [], isLoading: commitsLoading } = useQuery({
    queryKey: ["repo-commits", mainRepoId, mainBranch],
    queryFn: () => api.getRepoCommits(mainRepoId, mainBranch),
    enabled: step >= 2 && !!mainRepoId && !!mainBranch,
  });

  const { data: commitDetail, isLoading: filesLoading } = useQuery({
    queryKey: ["commit-files", mainRepoId, commitShas],
    queryFn: async () => {
      const details = await Promise.all(commitShas.map((sha) => api.getCommitFiles(mainRepoId, sha)));
      const filesByPath = new Map<string, {
        filename: string;
        status: string;
        patch?: string;
        additions: number;
        deletions: number;
      }>();

      for (const detail of details) {
        for (const file of detail.files) {
          const existing = filesByPath.get(file.filename);
          filesByPath.set(file.filename, {
            filename: file.filename,
            status: file.status,
            patch: file.patch || existing?.patch,
            additions: (existing?.additions || 0) + file.additions,
            deletions: (existing?.deletions || 0) + file.deletions,
          });
        }
      }

      return { files: Array.from(filesByPath.values()).sort((a, b) => a.filename.localeCompare(b.filename)) };
    },
    enabled: step >= 3 && !!mainRepoId && commitShas.length > 0,
  });

  const selectedCommits = useMemo(
    () => commits.filter((commit) => commitShas.includes(commit.sha)),
    [commits, commitShas]
  );
  const selectedCommitIndexes = commitShas
    .map((sha) => commits.findIndex((commit) => commit.sha === sha))
    .filter((index) => index >= 0);
  const areSelectedCommitsContiguous =
    selectedCommitIndexes.length <= 1 ||
    Math.max(...selectedCommitIndexes) - Math.min(...selectedCommitIndexes) + 1 === selectedCommitIndexes.length;

  const manualSyncMutation = useMutation({
    mutationFn: () =>
      api.createManualSync({
        mainRepoId,
        targetRepoIds,
        commitShas,
        filePaths,
      }),
    onSuccess: (data) => {
      toast.success("Review page prepared. Dry-run check is running.");
      queryClient.removeQueries({ queryKey: ["sync-jobs", data.pushEvent.id] });
      queryClient.invalidateQueries({ queryKey: ["push-event", data.pushEvent.id] });
      queryClient.invalidateQueries({ queryKey: ["push-events-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["push-events-history"] });
      navigate(`/dashboard/push-events/${data.pushEvent.id}`);
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : "Failed to start merge";
      toast.error(msg);
    },
  });

  const canContinueFromRepos = !!mainRepoId && !!mainBranch && targetRepoIds.length > 0;
  const canContinueFromCommit = commitShas.length > 0 && areSelectedCommitsContiguous;
  const canProceedToReview = filePaths.length > 0 && !manualSyncMutation.isPending;
  const childRepoIds = childRepos.map((repo) => repo.id);
  const areAllChildReposSelected =
    childRepoIds.length > 0 && childRepoIds.every((repoId) => targetRepoIds.includes(repoId));

  const toggleTargetRepo = (repoId: string) => {
    setTargetRepoIds((current) =>
      current.includes(repoId)
        ? current.filter((id) => id !== repoId)
        : [...current, repoId]
    );
  };

  const toggleAllChildRepos = () => {
    setTargetRepoIds(areAllChildReposSelected ? [] : childRepoIds);
  };

  const toggleCommit = (sha: string) => {
    setCommitShas((current) =>
      current.includes(sha)
        ? current.filter((item) => item !== sha)
        : [...current, sha]
    );
    setFilePaths([]);
  };

  const toggleFile = (filePath: string) => {
    setFilePaths((current) =>
      current.includes(filePath)
        ? current.filter((path) => path !== filePath)
        : [...current, filePath]
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Manual Sync</h1>
          <p className="text-sm text-text-secondary mt-1">
            Pick a main repo commit, select files, and sync them into selected child repositories.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate("/dashboard/repositories")}
          className="text-xs flex items-center gap-1.5"
        >
          <Server className="w-3.5 h-3.5" />
          Manage Repos
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["Repos", 1],
          ["Commit", 2],
          ["Files", 3],
        ].map(([label, value]) => (
          <div
            key={label}
            className={`h-2 rounded-full ${step >= Number(value) ? "bg-accent" : "bg-border"}`}
            title={String(label)}
          />
        ))}
      </div>

      {step === 1 && (
        <section className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-accent" />
                Main Repository
              </h2>
              {reposLoading ? (
                <LoadingText text="Loading repositories..." />
              ) : (
                <select
                  value={mainRepoId}
                  onChange={(e) => {
                    setMainRepoId(e.target.value);
                    setMainBranch("");
                    setCommitShas([]);
                    setFilePaths([]);
                    setTargetRepoIds((ids) => ids.filter((id) => id !== e.target.value));
                  }}
                  className="w-full h-10 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-3 text-sm text-text-primary focus:outline-none transition-colors"
                >
                  <option value="">Select main repo</option>
                  {mainRepos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={mainBranch}
                onChange={(e) => {
                  setMainBranch(e.target.value);
                  setCommitShas([]);
                  setFilePaths([]);
                }}
                disabled={!mainRepoId || branchesLoading}
                className="w-full h-10 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-3 text-sm text-text-primary focus:outline-none transition-colors disabled:opacity-60"
              >
                <option value="">
                  {branchesLoading ? "Loading branches..." : "Select required branch"}
                </option>
                {branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Server className="w-4 h-4 text-success" />
                  Child Repositories
                </h2>
                {childRepos.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={toggleAllChildRepos}
                    className="h-8 text-3xs px-2.5"
                  >
                    {areAllChildReposSelected ? "Clear all" : "Select all"}
                  </Button>
                )}
              </div>
              <div className="border border-border rounded-lg bg-page/50 max-h-64 overflow-y-auto p-2 space-y-2">
                {childRepos.length > 0 ? (
                  childRepos.map((repo) => (
                    <label
                      key={repo.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        targetRepoIds.includes(repo.id)
                          ? "bg-success/10 border-success/30 text-text-primary"
                          : "bg-card border-border hover:bg-card-hover text-text-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={targetRepoIds.includes(repo.id)}
                        onChange={() => toggleTargetRepo(repo.id)}
                        className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer"
                      />
                      <span className="text-xs font-medium">{repo.fullName}</span>
                      <span className="ml-auto text-3xs text-text-muted font-mono">{repo.branch}</span>
                    </label>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-text-muted">
                    Link child repositories first. The selected main repo will never appear here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!canContinueFromRepos}
              onClick={() => setStep(2)}
              className="text-xs flex items-center gap-1.5"
            >
              Continue to Commits
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-accent" />
              Select Commits
            </h2>
            <Button variant="secondary" onClick={() => setStep(1)} className="text-xs flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </div>

          {commitsLoading ? (
            <LoadingText text="Loading commits from GitHub..." />
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {commits.map((commit) => (
                <label
                  key={commit.sha}
                  className={`w-full p-4 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                    commitShas.includes(commit.sha)
                      ? "border-accent bg-accent/10"
                      : "border-border bg-page/50 hover:bg-card-hover"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={commitShas.includes(commit.sha)}
                    onChange={() => toggleCommit(commit.sha)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-3xs px-2 py-0.5 rounded bg-card border border-border text-text-secondary">
                        {commit.sha.substring(0, 7)}
                      </span>
                      <span className="text-xs font-semibold text-text-primary line-clamp-1">
                        {commit.message.split("\n")[0]}
                      </span>
                    </div>
                    <p className="text-3xs text-text-muted mt-1">
                      {commit.authorName} - {new Date(commit.date).toLocaleString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              {commitShas.length} commit{commitShas.length === 1 ? "" : "s"} selected.
              {!areSelectedCommitsContiguous && " Select every commit between the oldest and newest selected commit."}
            </p>
            <Button
              disabled={!canContinueFromCommit}
              onClick={() => setStep(3)}
              className="text-xs flex items-center gap-1.5"
            >
              Continue to Files
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileCode className="w-4 h-4 text-accent" />
                Select Files
              </h2>
              {selectedCommits.length > 0 && (
                <p className="text-3xs text-text-muted mt-1">
                  {selectedCommits.length} commit{selectedCommits.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
            <Button variant="secondary" onClick={() => setStep(2)} className="text-xs flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          </div>

          {filesLoading ? (
            <LoadingText text="Loading changed files..." />
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {commitDetail?.files.map((file) => (
                <label
                  key={file.filename}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    filePaths.includes(file.filename)
                      ? "bg-accent/10 border-accent/30 text-text-primary"
                      : "bg-page/50 border-border hover:bg-card-hover text-text-secondary"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filePaths.includes(file.filename)}
                    onChange={() => toggleFile(file.filename)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer"
                  />
                  <span className="font-mono text-xs truncate">{file.filename}</span>
                  <span className="ml-auto text-3xs font-semibold">
                    <span className="text-success">+{file.additions}</span>{" "}
                    <span className="text-danger">-{file.deletions}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-text-secondary">
              Proceed opens a review page with the selected diffs and starts the dry-run conflict check.
            </p>
            <Button
              disabled={!canProceedToReview}
              onClick={() => manualSyncMutation.mutate()}
              className="text-xs flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white"
            >
              {manualSyncMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  Proceed to Review
                </>
              )}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function LoadingText({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-text-muted py-6">
      <Loader2 className="w-4 h-4 text-accent animate-spin" />
      {text}
    </div>
  );
}
