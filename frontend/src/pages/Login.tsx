import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/index.ts";
import { login } from "../api/authApi.ts";

export default function LoginPage() {
  const nav = useNavigate();
  const { accessToken, setAuth } = useAuthStore();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<"email" | "password">("email");

  useEffect(() => {
    if (accessToken) nav("/inbox");
  }, [accessToken, nav]);

  const handleEmailNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) { setError("Enter a valid email address"); return; }
    setError("");
    setStep("password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { accessToken, user } = await login(email, password);
      setAuth(accessToken, user.email);
      sessionStorage.setItem("mp", password);
      nav("/inbox");
    } catch {
      setError("Wrong password. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-[#202124]">Sign in</h1>
        <p className="text-sm text-[#5f6368] mt-1">to continue to MailServer</p>
      </div>

      <div className="w-full max-w-sm">
        {step === "email" ? (
          <form onSubmit={handleEmailNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                required
                autoFocus
                className={`w-full border rounded-lg px-3.5 py-3 text-sm text-[#202124]
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all ${error ? "border-red-400" : "border-gray-300"}`}
                placeholder="you@yourdomain.com"
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>

            <div className="text-xs text-[#5f6368] leading-relaxed">
              Not your computer? Use a Private window to sign in.{" "}
              <a href="#" className="text-blue-600 hover:underline">Learn more</a>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary px-6 py-2.5">
                Next
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email chip */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 w-fit">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold uppercase">
                {email[0]}
              </div>
              <span className="text-sm text-[#202124]">{email}</span>
              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); setPassword(""); }}
                className="text-gray-400 hover:text-gray-600 text-xs ml-1"
              >
                ▾
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#202124] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                required
                autoFocus
                className={`w-full border rounded-lg px-3.5 py-3 text-sm text-[#202124]
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-all ${error ? "border-red-400" : "border-gray-300"}`}
                placeholder="Enter your password"
              />
              {error && (
                <div className="flex items-center gap-1.5 mt-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p className="text-xs text-red-500">{error}</p>
                </div>
              )}
            </div>

            <a href="#" className="text-sm text-blue-600 hover:underline block">Forgot password?</a>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => { setStep("email"); setError(""); }}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-6 py-2.5 flex items-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center">
        <p className="text-xs text-[#5f6368]">
          Self-hosted • Private • Secure
        </p>
        <div className="flex gap-4 justify-center mt-2 text-xs text-[#5f6368]">
          <a href="#" className="hover:underline">Help</a>
          <a href="#" className="hover:underline">Privacy</a>
          <a href="#" className="hover:underline">Terms</a>
        </div>
      </div>
    </div>
  );
}
