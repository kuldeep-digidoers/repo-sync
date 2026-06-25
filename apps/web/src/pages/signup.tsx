import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, GitMerge, Github } from "lucide-react";
import { useAuth } from "../contexts/auth-context";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ApiError, api } from "../lib/api-client";
import toast from "react-hot-toast";

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email) newErrors.email = "Email is required";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await signup(formData.name, formData.email, formData.password);
      toast.success("Account created successfully!");
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
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-56 h-56 bg-success/5 rounded-full blur-2xl" />

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
            Start syncing
            <br />
            <span className="text-gradient">in minutes.</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-md leading-relaxed">
            Create your account, connect your GitHub repos, and let RepoBridge
            handle the complexity of multi-repo synchronization.
          </p>

          <div className="flex flex-col gap-3 mt-8">
            {[
              "Create your account",
              "Connect your GitHub repos",
              "Configure sync rules",
              "Watch changes flow",
            ].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 text-sm text-text-secondary"
              >
                <span className="w-6 h-6 rounded-full bg-accent-muted text-accent text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Signup Form */}
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
              Create your account
            </h2>
            <p className="text-text-secondary text-sm">
              Get started with multi-repo sync
            </p>
          </div>

          <a
            href={api.getGitHubOAuthUrl()}
            className="w-full h-10 rounded-lg bg-card border border-border text-text-primary text-sm font-medium
              flex items-center justify-center gap-2 hover:bg-card-hover hover:border-border-light
              transition-all duration-200 mb-6"
          >
            <Github className="w-4 h-4" />
            Sign up with GitHub
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
              label="Name"
              name="name"
              type="text"
              placeholder="Your name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              icon={<User className="w-4 h-4" />}
              autoComplete="name"
              autoFocus
            />
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
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Min. 8 characters"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              icon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
            />
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full mt-2"
              size="md"
            >
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-accent hover:text-accent-hover font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
