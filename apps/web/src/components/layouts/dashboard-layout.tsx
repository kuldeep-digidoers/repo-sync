import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  GitMerge,
  LayoutDashboard,
  GitFork,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
} from "lucide-react";
import { useAuth } from "../../contexts/auth-context";
import toast from "react-hot-toast";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  {
    to: "/dashboard/repositories",
    icon: GitFork,
    label: "Repositories",
  },
  {
    to: "/dashboard/sync",
    icon: GitMerge,
    label: "Manual Sync",
  },
  {
    to: "/dashboard/history",
    icon: History,
    label: "Push History",
  },
  {
    to: "/dashboard/settings",
    icon: Settings,
    label: "Settings",
  },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login", { replace: true });
    } catch {
      toast.error("Failed to log out");
    }
  };

  return (
    <div className="min-h-screen bg-page flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen w-64
          bg-card border-r border-border flex flex-col
          transform transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
              <GitMerge className="w-4 h-4 text-accent" />
            </div>
            <span className="font-semibold text-text-primary text-sm">
              RepoBridge
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/dashboard"}
                onClick={(e) => {
                  setSidebarOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${
                    isActive
                        ? "bg-accent-muted text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-card-hover"
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="px-3 py-3 border-t border-border flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-card-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center flex-shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || "Avatar"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-accent" />
                )}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {user?.email}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-text-muted transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* User dropdown */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-scale-in">
                {user?.githubLogin && (
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs text-text-muted">GitHub</p>
                    <p className="text-sm text-text-primary font-mono">
                      @{user.githubLogin}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-danger-muted transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/50 glass sticky top-0 z-30 flex items-center px-3 sm:px-4 lg:px-5 gap-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-text-muted hover:text-text-primary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          {/* Top-right area (placeholder for future notifications, etc.) */}
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-muted">System Online</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 py-6 px-3 sm:px-4 lg:py-8 lg:px-5 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
