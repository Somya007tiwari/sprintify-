'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { Layers, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch<{ user: any; token: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      signup(res.token, res.user);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
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
            <div className="absolute w-64 h-64 rounded-full bg-[#E3F4E8] -top-2 -left-4 animate-pulse" />
            <div className="absolute w-56 h-56 rounded-full bg-[#E8F1F8] -bottom-4 -right-2" />
            <div className="absolute w-48 h-48 rounded-full bg-[#FFF1D6] top-8 right-6" />

            {/* Kanban Card Mockups */}
            <div className="relative z-10 space-y-3 w-full">
              <div className="bg-surface p-4 rounded-xl border border-app-border shadow-soft text-left transform rotate-2 hover:rotate-0 transition-transform">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold bg-[#D9F0DF] text-[#2E7D4F] px-2 py-0.5 rounded-md">DONE</span>
                  <div className="w-5 h-5 rounded-full bg-[#D8F0E1] flex items-center justify-center text-[10px] font-bold">AR</div>
                </div>
                <div className="h-3 bg-app-border/60 rounded w-3/4 mb-1.5" />
                <div className="h-2 bg-app-border/40 rounded w-1/2" />
              </div>

              <div className="bg-surface p-4 rounded-xl border border-app-border shadow-soft text-left transform -rotate-3 hover:rotate-0 transition-transform">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold bg-[#FBDAD8] text-[#B4413C] px-2 py-0.5 rounded-md">HIGH</span>
                  <div className="w-5 h-5 rounded-full bg-[#FBE0CC] flex items-center justify-center text-[10px] font-bold font-bold">RS</div>
                </div>
                <div className="h-3 bg-app-border/60 rounded w-4/5 mb-1.5" />
                <div className="h-2 bg-app-border/40 rounded w-2/3" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-app-text tracking-tight">
              Start managing projects with clarity
            </h2>
            <p className="text-sm text-app-text-muted max-w-sm mx-auto">
              Join your workspace to organize tasks, track sprint progress, and assign activities.
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
            <h1 className="text-2xl font-bold text-app-text tracking-tight">Create your account</h1>
            <p className="text-sm text-app-text-muted mt-1">Get started with collaborative Kanban boards</p>
          </div>

          {error && (
            <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3.5 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-app-text mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

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
              <label className="block text-xs font-semibold text-app-text mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
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
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-app-border">
            <p className="text-xs text-app-text-muted">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
