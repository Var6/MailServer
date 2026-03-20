'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Zap,
  Database,
  Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useMailStore } from '@/lib/store'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setTokens } = useMailStore()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.login(data.email, data.password)
      setTokens(res.access_token, res.refresh_token)
      setUser(res.user)
      router.push('/mail')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12"
        style={{ minWidth: 440 }}
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 animated-gradient" />
        {/* Grid overlay */}
        <div className="absolute inset-0 grid-overlay" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo + brand */}
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Enterprise Mail</span>
          </div>

          {/* Hero text */}
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-5xl font-extrabold text-white leading-tight mb-4">
              Your Business.<br />Your Mail.
            </h1>
            <p className="text-white/75 text-lg leading-relaxed mb-12 max-w-md">
              Secure, private, and blazing-fast email for your organization.
              Full control over your data, on your infrastructure.
            </p>

            {/* Features */}
            <div className="flex flex-col gap-5 mb-12">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">End-to-End Encrypted</p>
                  <p className="text-white/60 text-sm">Your data never leaves your server</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Lightning Fast</p>
                  <p className="text-white/60 text-sm">Real-time delivery with WebSocket push</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">MongoDB Powered</p>
                  <p className="text-white/60 text-sm">Auto-failover ready for dual-Pi setup</p>
                </div>
              </div>
            </div>

            {/* Floating notification cards */}
            <div className="flex flex-col gap-3 max-w-xs">
              <div className="card-float bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">New message</p>
                  <p className="text-white/60 text-xs truncate">from the Engineering Team</p>
                </div>
                <span className="text-white/50 text-xs flex-shrink-0">now</span>
              </div>
              <div className="card-float-1 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">Server online</p>
                  <p className="text-white/60 text-xs truncate">All systems operational</p>
                </div>
                <span className="text-white/50 text-xs flex-shrink-0">1m</span>
              </div>
              <div className="card-float-2 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-3 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">99.9% uptime</p>
                  <p className="text-white/60 text-xs truncate">Excellent reliability</p>
                </div>
                <span className="text-white/50 text-xs flex-shrink-0">5m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Logo mark */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[#2d3748] text-center mb-1">
            Welcome back
          </h2>
          <p className="text-[#718096] text-sm text-center mb-8">
            Sign in to your mail account
          </p>

          {/* Error alert */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                  })}
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] transition-colors"
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#2d3748] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm text-white transition-all mt-2 disabled:opacity-70 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-[#718096] text-xs text-center mt-6">
            Contact your administrator to create an account.
          </p>
          <p className="text-[#a0aec0] text-xs text-center mt-4">
            &copy; {new Date().getFullYear()} Enterprise Mail. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
