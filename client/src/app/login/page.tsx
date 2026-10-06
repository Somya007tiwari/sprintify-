'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { Layers, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch<{ user: any; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Failed to log in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-app-bg">
      {/* Left side illustration panel */}
      <div className="hidden lg:flex flex-1 bg-surface-soft border-r border-app-border p-12 flex-col justify-between relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-soft">
            <Layers className="w-6 h-6" />
          </div>
          <span className="font-bold text-2xl text-app-text tracking-tight font-heading">
            Sprintify
          </span>
        </div>

        {/* Custom CSS/SVG Pastel Illustration */}
        <div className="my-auto max-w-md mx-auto text-center space-y-8">
          <div className="relative w-72 h-72 mx-auto flex items-center justify-center">
            {/* Background Pastel Circles */}
            <div className="absolute w-64 h-64 rounded-full bg-[#E8F1F8] -top-2 -left-4 animate-pulse" />
            <div className="absolute w-56 h-56 rounded-full bg-[#FFF1D6] -bottom-4 -right-2" />
            <div className="absolute w-48 h-48 rounded-full bg-[#E3F4E8] top-8 right-6" />

            {/* Kanban Card Mockups */}
            <div className="relative z-10 space-y-3 w-full">
              <div className="bg-surface p-4 rounded-xl border border-app-border shadow-soft text-left transform -rotate-2 hover:rotate-0 transition-transform">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold bg-[#FBDAD8] text-[#B4413C] px-2 py-0.5 rounded-md">HIGH</span>
                  <div className="w-5 h-5 rounded-full bg-[#D6E8F7] flex items-center justify-center text-[10px] font-bold">RS</div>
                </div>
                <div className="h-3 bg-app-border/60 rounded w-3/4 mb-1.5" />
                <div className="h-2 bg-app-border/40 rounded w-1/2" />
              </div>

              <div className="bg-surface p-4 rounded-xl border border-app-border shadow-soft text-left transform rotate-3 hover:rotate-0 transition-transform">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold bg-[#FDE9C4] text-[#A8680F] px-2 py-0.5 rounded-md">MEDIUM</span>
                  <div className="w-5 h-5 rounded-full bg-[#FDE7B8] flex items-center justify-center text-[10px] font-bold">SC</div>
                </div>
                <div className="h-3 bg-app-border/60 rounded w-4/5 mb-1.5" />
                <div className="h-2 bg-app-border/40 rounded w-2/3" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-app-text tracking-tight">
              Collaborate effortlessly with your team
            </h2>
            <p className="text-sm text-app-text-muted max-w-sm mx-auto">
              Drag-and-drop Kanban workflow designed with calm pastel aesthetics for smooth sprint management.
            </p>
          </div>
        </div>

        <p className="text-xs text-app-text-muted text-center">
          © 2026 Sprintify. Light & paper notebook theme.
        </p>
      </div>

      {/* Right side form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8 bg-surface p-8 sm:p-10 rounded-xl border border-app-border shadow-soft">
          <div>
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-soft">
                <Layers className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-app-text tracking-tight font-heading">
                Sprintify
              </span>
            </div>
            <h1 className="text-2xl font-bold text-app-text tracking-tight">Welcome back</h1>
            <p className="text-sm text-app-text-muted mt-1">Sign in to your Sprintify account to continue</p>
          </div>

          {error && (
            <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3.5 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-app-text mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-app-text">Password</label>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-app-border">
            <p className="text-xs text-app-text-muted">
              Don't have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          <div className="mt-4 p-3 bg-surface-soft rounded-lg text-xs text-app-text-muted space-y-1">
            <p className="font-semibold text-app-text">Demo Credentials:</p>
            <p>rahul@example.com / password123</p>
            <p>sarah@example.com / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
