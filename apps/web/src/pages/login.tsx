import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, GitMerge, Github } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ApiError, api } from "../lib/api-client";
import toast from "react-hot-toast";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("github") === "not_configured") {
      toast.error("GitHub login needs one-time admin setup first.");
      navigate("/login", { replace: true });
    }
  }, [location.search, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success("Welcome back!");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = (messages as string[])[0];
          }
          setErrors(fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-page flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-page to-page" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/8 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xl font-semibold text-text-primary">
              RepoBridge
            </span>
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4 leading-tight">
            Synchronize repos
            <br />
            <span className="text-gradient">with confidence.</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-md leading-relaxed">
            Watch your main repository, pick changes, check for conflicts, and
            apply clean merges across all your client repos — automatically.
          </p>

          <div className="flex flex-wrap gap-2 mt-8">
            {[
              "Conflict Detection",
              "Auto-Merge",
              "File Selection",
              "PR Automation",
            ].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border text-text-secondary"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xl font-semibold text-text-primary">
              RepoBridge
            </span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Welcome back
            </h2>
            <p className="text-text-secondary text-sm">
              Sign in to your account to continue
            </p>
          </div>

          <a
            href={api.getGitHubOAuthUrl()}
            className="w-full h-10 rounded-lg bg-card border border-border text-text-primary text-sm font-medium
              flex items-center justify-center gap-2 hover:bg-card-hover hover:border-border-light
              transition-all duration-200 mb-6"
          >
            <Github className="w-4 h-4" />
            Sign in with GitHub
          </a>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-page text-text-muted">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              icon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              icon={<Lock className="w-4 h-4" />}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2"
              size="md"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
