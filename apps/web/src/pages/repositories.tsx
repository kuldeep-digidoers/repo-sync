import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building,
  CheckCircle,
  Edit2,
  ExternalLink,
  Github,
  GitBranch,
  GitFork,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import { api, ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useAuth } from "../contexts/auth-context";
import type { GithubAccountRepo, RepoRole, RegisterRepoRequest } from "@repo-sync/shared";
import toast from "react-hot-toast";

export function RepositoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<RepoRole>("CLIENT");
  const [selectedRepoIndexes, setSelectedRepoIndexes] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("master");
  const [repoSearch, setRepoSearch] = useState("");

  const { data: repos = [], isLoading: reposLoading, refetch: refetchRepos } = useQuery({
    queryKey: ["repositories"],
    queryFn: () => api.getRepos(),
  });

  const { data: githubSetup, isLoading: setupLoading, refetch: refetchGithubSetup } = useQuery({
    queryKey: ["github-setup"],
    queryFn: () => api.getGithubSetupStatus(),
  });

  const {
    data: accountRepos = [],
    isLoading: accountReposLoading,
    error: accountReposError,
    refetch: refetchAccountRepos,
  } = useQuery({
    queryKey: ["github-account-repositories"],
    queryFn: () => api.getGithubAccountRepos(),
    enabled: isOpen && !!githubSetup?.githubLinked && !!githubSetup?.appConfigured,
  });

  const {
    data: installableRepos = [],
    isLoading: installableLoading,
    refetch: refetchInstallableRepos,
  } = useQuery({
    queryKey: ["installable-repositories"],
    queryFn: () => api.getInstallableRepos(),
    enabled: isOpen && (!githubSetup?.githubLinked || !githubSetup?.appConfigured),
  });

  const registeredNames = new Set(repos.map((repo) => repo.fullName.toLowerCase()));
  const pickerRepos: GithubAccountRepo[] =
    accountRepos.length > 0
      ? accountRepos
      : installableRepos.map((repo) => ({
          ...repo,
          defaultBranch: "master",
          private: false,
          appInstalled: true,
        }));
  const normalizedRepoSearch = repoSearch.trim().toLowerCase();
  const filteredPickerRepos = pickerRepos
    .map((repo, idx) => ({ repo, idx }))
    .filter(({ repo }) => {
      if (!normalizedRepoSearch) return true;
      return (
        repo.fullName.toLowerCase().includes(normalizedRepoSearch) ||
        repo.githubOwner.toLowerCase().includes(normalizedRepoSearch) ||
        repo.githubName.toLowerCase().includes(normalizedRepoSearch) ||
        repo.defaultBranch.toLowerCase().includes(normalizedRepoSearch)
      );
    });

  const registerMutation = useMutation({
    mutationFn: async (requests: RegisterRepoRequest[]) => {
      const results = [];
      for (const request of requests) {
        results.push(await api.registerRepo(request));
      }
      return results;
    },
    onSuccess: (created) => {
      toast.success(
        created.length === 1
          ? "Repository linked successfully"
          : `${created.length} child repositories linked successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["installable-repositories"] });
      queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] });
      closeModal();
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : "Failed to link repositories";
      toast.error(msg);
    },
  });

  const closeModal = () => {
    setIsOpen(false);
    setStep(1);
    setRole("CLIENT");
    setSelectedRepoIndexes([]);
    setCustomerName("");
    setDescription("");
    setBranch("master");
    setRepoSearch("");
  };

  const openModal = (nextRole: RepoRole) => {
    setRole(nextRole);
    setSelectedRepoIndexes([]);
    setCustomerName("");
    setDescription("");
    setBranch("master");
    setRepoSearch("");
    setStep(1);
    setIsOpen(true);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isOpen && step === 3) {
        handleSubmit(e as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, selectedRepoIndexes, role, branch, description, customerName]);

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (selectedRepoIndexes.length === 0) {
        toast.error(role === "MAIN" ? "Please select a main repository" : "Please select at least one child repository");
        return;
      }
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const toggleRepoSelection = (idx: number) => {
    const repo = pickerRepos[idx];
    if (!repo) return;

    if (role === "MAIN") {
      setSelectedRepoIndexes([idx]);
      setBranch(repo.defaultBranch || "master");
      return;
    }

    setSelectedRepoIndexes((current) => {
      const exists = current.includes(idx);
      const next = exists ? current.filter((value) => value !== idx) : [...current, idx];
      if (!exists && current.length === 0) {
        setBranch(repo.defaultBranch || "master");
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRepoIndexes.length === 0) {
      toast.error("No repositories selected");
      return;
    }

    if (role === "MAIN" && selectedRepoIndexes.length !== 1) {
      toast.error("Select exactly one main repository");
      return;
    }

    const selectedRepos = selectedRepoIndexes
      .map((idx) => pickerRepos[idx])
      .filter(Boolean);

    const requests = selectedRepos.map((repo) => ({
      githubOwner: repo.githubOwner,
      githubName: repo.githubName,
      role,
      branch: branch.trim(),
      description: description.trim() || undefined,
      customerName:
        role === "CLIENT" && selectedRepos.length === 1
          ? customerName.trim() || repo.githubName
          : role === "CLIENT"
            ? repo.githubName
            : undefined,
    }));

    registerMutation.mutate(requests);
  };

  const mainRepo = repos.find((repo) => repo.role === "MAIN" && repo.isActive);
  const clientRepos = repos.filter((repo) => repo.role === "CLIENT" && repo.isActive);
  const selectedRepos = selectedRepoIndexes.map((idx) => pickerRepos[idx]).filter(Boolean);
  const branchSourceRepo = selectedRepos[0];
  const {
    data: selectedRepoBranches = [],
    isLoading: selectedRepoBranchesLoading,
    error: selectedRepoBranchesError,
    refetch: refetchSelectedRepoBranches,
  } = useQuery({
    queryKey: ["github-account-repo-branches", branchSourceRepo?.fullName],
    queryFn: () =>
      api.getGithubAccountRepoBranches(
        branchSourceRepo!.githubOwner,
        branchSourceRepo!.githubName
      ),
    enabled: step === 3 && !!branchSourceRepo,
  });
  const isRepoLoading = installableLoading || accountReposLoading;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Repositories</h1>
          <p className="text-sm text-text-secondary mt-1">
            Dynamically link your main source repo and child/client repositories from GitHub.
          </p>
        </div>
        <Button
          onClick={() => openModal("CLIENT")}
          className="flex items-center gap-2 self-start sm:self-auto shadow-glow hover:shadow-glow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Repositories
        </Button>
      </div>

      <section className="bg-card border border-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">GitHub Setup</h2>
            {setupLoading && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium leading-none ${githubSetup?.githubLinked ? "bg-success/10 border-success/20 text-success" : "bg-warning/10 border-warning/20 text-warning"}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {githubSetup?.githubLinked ? `GitHub: ${githubSetup.githubLogin}` : "GitHub not linked"}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium leading-none ${githubSetup?.appConfigured ? "bg-success/10 border-success/20 text-success" : "bg-danger/10 border-danger/20 text-danger"}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {githubSetup?.appConfigured ? `App ready: ${githubSetup.installableCount} repos` : "App not configured"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!user?.githubLogin && (
            <a
              href={api.getGitHubOAuthUrl()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card-hover border border-border text-xs text-text-primary hover:border-border-light transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              Connect GitHub
            </a>
          )}
          {githubSetup?.appInstallUrl && (
            <a
              href={githubSetup.appInstallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Install / Configure App
            </a>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              refetchGithubSetup();
              refetchRepos();
              refetchAccountRepos();
              refetchInstallableRepos();
            }}
            className="h-9 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </section>

      {reposLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-sm text-text-secondary">Loading repositories...</p>
        </div>
      ) : (
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <span className="w-1.5 h-4 bg-accent rounded-full" />
              <h2 className="text-lg font-semibold text-text-primary">Main Source Repository</h2>
            </div>

            {mainRepo ? (
              <RepositoryCard
                repo={mainRepo}
                accent="accent"
                onConfigure={() => navigate(`/dashboard/repositories/${mainRepo.id}`)}
              />
            ) : (
              <button
                onClick={() => openModal("MAIN")}
                className="w-full border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-card/30 group transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-card border border-border group-hover:bg-accent-muted group-hover:border-accent/40 flex items-center justify-center transition-all mb-4">
                  <GitFork className="w-6 h-6 text-text-muted group-hover:text-accent" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">No Main Repository Configured</h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">
                  Select one GitHub repository as the upstream source for push detection.
                </p>
                <span className="text-xs text-accent mt-3 font-medium flex items-center gap-1 group-hover:underline">
                  Set main repository <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-success rounded-full" />
                <h2 className="text-lg font-semibold text-text-primary">Child Repositories</h2>
              </div>
              <span className="text-xs text-text-muted bg-card px-2.5 py-1 rounded-full border border-border font-medium">
                {clientRepos.length} Total
              </span>
            </div>

            {clientRepos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {clientRepos.map((repo) => (
                  <RepositoryCard
                    key={repo.id}
                    repo={repo}
                    accent="success"
                    onConfigure={() => navigate(`/dashboard/repositories/${repo.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-4">
                  <Building className="w-6 h-6 text-text-muted" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">No Child Repositories Linked</h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">
                  Select one or many child repositories to receive synced changes.
                </p>
                <Button
                  onClick={() => openModal("CLIENT")}
                  variant="secondary"
                  className="mt-4 flex items-center gap-1 text-xs"
                >
                  <Plus className="w-4 h-4" /> Link child repos
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-glow-lg flex flex-col animate-scale-in">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {role === "MAIN" ? "Set Main Repository" : "Link Child Repositories"}
                </h2>
                <p className="text-2xs text-text-secondary mt-0.5">
                  Step {step} of 3 - {step === 1 ? "Choose Type" : step === 2 ? "Select Repositories" : "Configure"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <RoleCard
                    selected={role === "MAIN"}
                    icon={<GitFork className="w-4 h-4 text-accent" />}
                    title="Main Source"
                    body="One upstream repository that RepoBridge watches for push events."
                    onClick={() => {
                      setRole("MAIN");
                      setSelectedRepoIndexes([]);
                    }}
                  />
                  <RoleCard
                    selected={role === "CLIENT"}
                    icon={<Building className="w-4 h-4 text-success" />}
                    title="Child Repositories"
                    body="One or many target repositories that receive selected synced changes."
                    onClick={() => {
                      setRole("CLIENT");
                      setSelectedRepoIndexes([]);
                    }}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-text-secondary">
                        {role === "MAIN" ? "Choose one main repository" : "Choose one or many child repositories"}
                      </h3>
                      <p className="text-3xs text-text-muted mt-1">
                        Only GitHub App-installed repos can be linked.
                      </p>
                    </div>
                    {role === "CLIENT" && pickerRepos.length > 0 && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const selectableIndexes = filteredPickerRepos
                            .filter(({ repo }) => repo.appInstalled && repo.installationId && !registeredNames.has(repo.fullName.toLowerCase()))
                            .map(({ idx }) => idx);
                          setSelectedRepoIndexes(selectableIndexes);
                        }}
                        className="h-8 px-2.5 text-3xs"
                      >
                        Select all available
                      </Button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Search repositories by name, owner, or branch"
                      className="w-full h-10 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
                    />
                  </div>

                  {accountReposError && (
                    <div className="p-3 rounded-lg border border-warning/30 bg-warning/10 text-warning text-3xs leading-relaxed">
                      GitHub account repositories could not be loaded. Reconnect GitHub from the setup panel if OAuth scopes changed.
                    </div>
                  )}

                  {isRepoLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="w-6 h-6 text-accent animate-spin" />
                      <p className="text-xs text-text-muted">Reading repositories from GitHub...</p>
                    </div>
                  ) : filteredPickerRepos.length > 0 ? (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 border border-border p-2 rounded-lg bg-page/50">
                      {filteredPickerRepos.map(({ repo, idx }) => {
                        const alreadyLinked = registeredNames.has(repo.fullName.toLowerCase());
                        const selectable = repo.appInstalled && !!repo.installationId && !alreadyLinked;
                        const selected = selectedRepoIndexes.includes(idx);
                        return (
                          <button
                            type="button"
                            key={repo.fullName}
                            onClick={() => selectable && toggleRepoSelection(idx)}
                            className={`w-full p-3 rounded-lg border text-xs font-medium transition-colors flex items-center justify-between gap-3 text-left ${
                              selected
                                ? "border-accent bg-accent/5 text-text-primary"
                                : selectable
                                  ? "border-border/60 hover:border-border hover:bg-card-hover text-text-secondary"
                                  : "border-border/40 bg-page/30 text-text-muted cursor-not-allowed opacity-70"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type={role === "MAIN" ? "radio" : "checkbox"}
                                checked={selected}
                                readOnly
                                className="w-4 h-4 rounded border-border text-accent focus:ring-accent bg-page cursor-pointer"
                              />
                              <div className="min-w-0">
                                <span className="block truncate">{repo.fullName}</span>
                                <span className="text-3xs text-text-muted">
                                  {repo.private ? "Private" : "Public"} - default: {repo.defaultBranch}
                                </span>
                              </div>
                            </div>
                            <span className={`text-3xs px-1.5 py-0.5 rounded border whitespace-nowrap ${
                              alreadyLinked
                                ? "bg-border/50 border-border text-text-muted"
                                : selectable
                                  ? "bg-success/10 border-success/25 text-success"
                                  : "bg-warning/10 border-warning/25 text-warning"
                            }`}>
                              {alreadyLinked ? "Linked" : selectable ? "Ready" : "Install App"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border border-border/80 rounded-xl p-4 text-center space-y-2 bg-page/40">
                      <AlertCircle className="w-8 h-8 text-warning mx-auto" />
                      <h3 className="text-xs font-semibold text-text-primary">
                        {pickerRepos.length > 0 ? "No Matching Repositories" : "No Repositories Found"}
                      </h3>
                      <p className="text-3xs text-text-muted leading-relaxed max-w-xs mx-auto">
                        {pickerRepos.length > 0
                          ? "Try a different repository name, owner, or branch."
                          : "Configure GitHub in Settings, connect your GitHub account, and install the GitHub App on the repos you want to sync."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3 rounded-lg bg-page/50 border border-border text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{selectedRepos.length}</span>{" "}
                    {role === "MAIN" ? "main repository selected" : "child repositories selected"}
                  </div>

                  {role === "CLIENT" && selectedRepos.length === 1 && (
                    <Input
                      id="customerName"
                      label="Child / Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={selectedRepos[0]?.githubName || "Client name"}
                      className="bg-page border-border text-sm"
                    />
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="branch" className="text-xs font-semibold text-text-secondary">
                      {role === "MAIN" ? "Tracked Branch" : "Target Branch For Selected Repos"}
                    </label>
                    <select
                      id="branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      required
                      disabled={selectedRepoBranchesLoading}
                      className="w-full h-10 rounded-lg bg-page border border-border hover:border-border-light focus:border-accent px-3 text-sm text-text-primary focus:outline-none transition-colors disabled:opacity-60 font-mono"
                    >
                      <option value="">
                        {selectedRepoBranchesLoading ? "Loading branches..." : "Select required branch"}
                      </option>
                      {selectedRepoBranches.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {selectedRepoBranchesError && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-3xs text-warning">
                        <span>Could not load branches for this repository.</span>
                        <button
                          type="button"
                          onClick={() => refetchSelectedRepoBranches()}
                          className="font-semibold text-accent hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {!selectedRepoBranchesLoading && !selectedRepoBranchesError && selectedRepoBranches.length === 0 && (
                      <p className="text-3xs text-warning">
                        No branches were returned by GitHub for this repository.
                      </p>
                    )}
                    {role === "CLIENT" && selectedRepos.length > 1 && (
                      <p className="text-3xs text-text-muted">
                        This branch will be used for each selected child repo. Select repos with matching target branches together.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="description" className="text-xs font-semibold text-text-secondary">
                      Notes
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional notes for these repositories."
                      rows={4}
                      className="w-full rounded-lg bg-page border border-border hover:border-border-light focus:border-accent p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border bg-page/40 flex items-center justify-between flex-shrink-0">
              <div>
                {step > 1 && (
                  <Button
                    variant="secondary"
                    onClick={handlePrevStep}
                    className="flex items-center gap-1 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={closeModal} className="text-xs">
                  Cancel
                </Button>
                {step < 3 ? (
                  <Button
                    onClick={handleNextStep}
                    disabled={step === 2 && selectedRepoIndexes.length === 0}
                    className="flex items-center gap-1 text-xs"
                  >
                    Continue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={registerMutation.isPending}
                    className="flex items-center gap-1.5 text-xs shadow-glow"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Link {role === "MAIN" ? "Main Repo" : "Child Repos"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCard({
  selected,
  icon,
  title,
  body,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border rounded-xl p-3 cursor-pointer text-left transition-all flex flex-col gap-2 ${
        selected ? "border-accent bg-accent/5" : "border-border hover:border-border-light hover:bg-card-hover"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-card-hover flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
      <p className="text-3xs text-text-muted leading-relaxed">{body}</p>
    </button>
  );
}

function RepositoryCard({
  repo,
  accent,
  onConfigure,
}: {
  repo: {
    id: string;
    githubOwner: string;
    githubName: string;
    fullName: string;
    branch: string;
    description: string | null;
    customerName: string | null;
  };
  accent: "accent" | "success";
  onConfigure: () => void;
}) {
  const accentClass = accent === "accent" ? "hover:border-accent/40" : "hover:border-success/40";
  const iconClass = accent === "accent" ? "bg-accent-muted text-accent" : "bg-success/10 text-success";

  return (
    <div className={`bg-card border border-border rounded-xl p-4 ${accentClass} transition-colors flex flex-col justify-between gap-4 group relative`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconClass}`}>
              {accent === "accent" ? <GitFork className="w-4 h-4" /> : <Building className="w-4 h-4" />}
            </div>
            <div className="space-y-1 min-w-0">
              {repo.customerName && (
                <span className="inline-flex items-center gap-1.5 text-2xs px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 font-medium uppercase tracking-wider">
                  {repo.customerName}
                </span>
              )}
              <h3 className="font-semibold text-text-primary text-sm truncate">
                {repo.githubOwner}/{repo.githubName}
              </h3>
              <div className="flex items-center gap-1.5 text-text-muted text-xs">
                <GitBranch className="w-3.5 h-3.5" />
                <span>{repo.branch}</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-2xs px-2.5 py-1 rounded-full bg-accent-muted text-accent font-medium">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        </div>

        {repo.description ? (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
            {repo.description}
          </p>
        ) : (
          <p className="text-xs text-text-muted italic">No notes added yet.</p>
        )}
      </div>

      <div className="flex items-center justify-end border-t border-border/50 pt-3.5 text-xs gap-2">
        <Button
          variant="secondary"
          onClick={onConfigure}
          className="h-8 px-3 text-2xs flex items-center gap-1.5"
        >
          <Edit2 className="w-3 h-3" />
          Configure
        </Button>
        <a
          href={`https://github.com/${repo.fullName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg border border-border hover:bg-card-hover text-text-secondary hover:text-text-primary transition-colors"
          title="View on GitHub"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
