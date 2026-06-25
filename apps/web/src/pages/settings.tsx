import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LoadingScreen } from "../components/ui/loading-screen";
import toast from "react-hot-toast";
import type { UpdateGithubSettingsRequest } from "@repo-sync/shared";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    oauthClientId: "",
    oauthClientSecret: "",
    oauthCallbackUrl: "",
    appId: "",
    appSlug: "",
    privateKey: "",
    webhookSecret: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["github-settings"],
    queryFn: () => api.getGithubSettings(),
  });

  const { data: setup } = useQuery({
    queryKey: ["github-setup"],
    queryFn: () => api.getGithubSetupStatus(),
  });

  useEffect(() => {
    if (settings) {
      setForm((prev) => ({
        ...prev,
        oauthClientId: settings.oauthClientId || "",
        oauthCallbackUrl: settings.oauthCallbackUrl || "",
        appId: settings.appId || "",
        appSlug: settings.appSlug || "",
      }));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateGithubSettingsRequest) => api.updateGithubSettings(data),
    onSuccess: () => {
      toast.success("GitHub setup saved");
      setForm((prev) => ({
        ...prev,
        oauthClientSecret: "",
        privateKey: "",
        webhookSecret: "",
      }));
      queryClient.invalidateQueries({ queryKey: ["github-settings"] });
      queryClient.invalidateQueries({ queryKey: ["github-setup"] });
      queryClient.invalidateQueries({ queryKey: ["github-account-repositories"] });
      queryClient.invalidateQueries({ queryKey: ["installable-repositories"] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiError ? err.message : "Failed to save GitHub setup";
      toast.error(msg);
    },
  });

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdateGithubSettingsRequest = {
      oauthClientId: form.oauthClientId.trim(),
      oauthCallbackUrl: form.oauthCallbackUrl.trim(),
      appId: form.appId.trim(),
      appSlug: form.appSlug.trim(),
    };

    if (form.oauthClientSecret.trim()) payload.oauthClientSecret = form.oauthClientSecret.trim();
    if (form.privateKey.trim()) payload.privateKey = form.privateKey.trim();
    if (form.webhookSecret.trim()) payload.webhookSecret = form.webhookSecret.trim();
    updateMutation.mutate(payload);
  };

  const oauthReady = !!settings?.oauthClientId && !!settings?.hasOauthClientSecret;
  const appReady = !!settings?.appId && !!settings?.hasPrivateKey;

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Connect GitHub and enable real repository sync.
        </p>
      </div>

      <section className="bg-card border border-border rounded-xl p-4 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Github className="w-4 h-4 text-accent" />
              GitHub Account
            </h2>
            <StatusLine
              ready={!!setup?.githubLinked}
              text={setup?.githubLinked ? `Connected as @${setup.githubLogin}` : "Not connected"}
            />
          </div>
          <a
            href={oauthReady ? api.getGitHubOAuthUrl() : undefined}
            onClick={(e) => {
              if (!oauthReady) {
                e.preventDefault();
                toast.error("Admin setup is required once before users can connect GitHub.");
                setShowAdvanced(true);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold transition-colors ${
              oauthReady
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-border text-text-muted cursor-not-allowed"
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            {setup?.githubLinked ? "Reconnect GitHub" : "Connect GitHub"}
          </a>
        </div>

        <div className="border-t border-border pt-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success" />
              Repository Access
            </h2>
            <StatusLine
              ready={!!setup?.appConfigured}
              text={setup?.appConfigured ? `${setup.installableCount} repos available through GitHub App` : "GitHub App is not installed/configured"}
            />
          </div>
          <a
            href={setup?.appInstallUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!setup?.appInstallUrl) {
                e.preventDefault();
                toast.error("Add the GitHub App slug in Admin setup first.");
                setShowAdvanced(true);
              }
            }}
            className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg text-xs font-semibold transition-colors ${
              setup?.appInstallUrl
                ? "bg-success text-white hover:bg-success/80"
                : "bg-border text-text-muted cursor-not-allowed"
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Install / Sync Repos
          </a>
        </div>
      </section>

      <section className="bg-card border border-border rounded-xl p-4 space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-accent" />
              Admin Setup
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              One-time product setup. Normal users only use Connect GitHub and repository selection.
            </p>
          </div>
          <span className="text-xs text-accent">{showAdvanced ? "Hide" : "Open"}</span>
        </button>

        {showAdvanced && (
          <form onSubmit={handleSubmit} className="space-y-5 border-t border-border pt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="OAuth Client ID"
                value={form.oauthClientId}
                onChange={handleChange("oauthClientId")}
                placeholder="Iv1..."
                className="bg-page border-border font-mono text-xs"
              />
              <Input
                label="OAuth Client Secret"
                type="password"
                value={form.oauthClientSecret}
                onChange={handleChange("oauthClientSecret")}
                placeholder={settings?.hasOauthClientSecret ? "Leave blank to keep saved secret" : "Paste client secret"}
                className="bg-page border-border font-mono text-xs"
              />
              <Input
                label="OAuth Callback URL"
                value={form.oauthCallbackUrl}
                onChange={handleChange("oauthCallbackUrl")}
                placeholder="http://localhost:3001/auth/github/callback"
                className="bg-page border-border font-mono text-xs md:col-span-2"
              />
              <Input
                label="GitHub App ID"
                value={form.appId}
                onChange={handleChange("appId")}
                placeholder="123456"
                className="bg-page border-border font-mono text-xs"
              />
              <Input
                label="GitHub App Slug"
                value={form.appSlug}
                onChange={handleChange("appSlug")}
                placeholder="repo-sync"
                className="bg-page border-border font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-secondary">
                GitHub App Private Key
              </label>
              <textarea
                value={form.privateKey}
                onChange={handleChange("privateKey")}
                placeholder={settings?.hasPrivateKey ? "Leave blank to keep saved private key" : "Paste full PEM private key, or base64:<encoded-key>"}
                rows={6}
                className="w-full rounded-lg bg-page border border-border hover:border-border-light focus:border-accent p-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none transition-colors resize-y font-mono"
              />
            </div>

            <Input
              label="Webhook Secret"
              type="password"
              value={form.webhookSecret}
              onChange={handleChange("webhookSecret")}
              placeholder={settings?.hasWebhookSecret ? "Leave blank to keep saved webhook secret" : "Paste webhook secret"}
              className="bg-page border-border font-mono text-xs"
            />

            <div className="flex justify-end">
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
                    Save Admin Setup
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function StatusLine({ ready, text }: { ready: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border font-medium leading-none ${
      ready
        ? "bg-success/10 border-success/25 text-success"
        : "bg-warning/10 border-warning/25 text-warning"
    }`}>
      <CheckCircle2 className="w-3 h-3" />
      {text}
    </span>
  );
}
