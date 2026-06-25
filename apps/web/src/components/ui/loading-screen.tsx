import { GitMerge } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-page flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center animate-float">
            <GitMerge className="w-6 h-6 text-accent" />
          </div>
          <div className="absolute inset-0 rounded-xl bg-accent/20 blur-xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-text-primary">
            RepoBridge
          </span>
          <span className="text-xs text-text-muted">Loading…</span>
        </div>
      </div>
    </div>
  );
}
