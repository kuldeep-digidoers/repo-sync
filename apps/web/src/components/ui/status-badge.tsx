import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  GitPullRequest,
  Filter,
} from "lucide-react";

type BadgeVariant =
  | "NEW"
  | "TRIAGED"
  | "COMPLETED"
  | "PENDING"
  | "DRY_RUN_RUNNING"
  | "APPLYING"
  | "CLEAN"
  | "APPLIED"
  | "CONFLICT"
  | "MERGED"
  | "FAILED";

const variantConfig: Record<
  BadgeVariant,
  { bg: string; icon: React.ReactNode; label?: string }
> = {
  NEW: {
    bg: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    icon: <Clock className="w-3 h-3" />,
  },
  TRIAGED: {
    bg: "border-amber-500/20 bg-amber-500/10 text-amber-400",
    icon: <Filter className="w-3 h-3" />,
  },
  COMPLETED: {
    bg: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  PENDING: {
    bg: "border-text-muted/20 bg-text-muted/10 text-text-muted",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  DRY_RUN_RUNNING: {
    bg: "border-accent/30 bg-accent/10 text-accent",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: "ANALYZING",
  },
  APPLYING: {
    bg: "border-accent/30 bg-accent/10 text-accent",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  CLEAN: {
    bg: "border-success/30 bg-success/15 text-success",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  APPLIED: {
    bg: "border-success/30 bg-success/15 text-success",
    icon: <GitPullRequest className="w-3 h-3" />,
  },
  CONFLICT: {
    bg: "border-warning/30 bg-warning/15 text-warning",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  MERGED: {
    bg: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  FAILED: {
    bg: "border-danger/30 bg-danger/15 text-danger",
    icon: <XCircle className="w-3 h-3" />,
  },
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  size = "sm",
  showIcon = true,
  className = "",
}: StatusBadgeProps) {
  const config = variantConfig[status as BadgeVariant];

  if (!config) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-md border border-border bg-page/50 text-text-secondary uppercase leading-none ${size === "sm" ? "text-[11px]" : "text-2xs"
          } ${className}`}
      >
        {status}
      </span>
    );
  }

  const label = config.label || status;

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold px-2 py-1 rounded-md border uppercase leading-none ${config.bg} ${size === "sm" ? "text-[11px]" : "text-2xs"
        } ${className}`}
    >
      {showIcon && config.icon}
      {label}
    </span>
  );
}