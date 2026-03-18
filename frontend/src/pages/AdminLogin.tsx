import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/index.ts";
import { login } from "../api/authApi.ts";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const nav = useNavigate();
  const { accessToken, setAuth } = useAuthStore();
  const role = useAuthStore(s => s.role);

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<"email" | "password">("email");

  useEffect(() => {
    if (!accessToken || role !== "admin") return;
    nav("/admin/users", { replace: true });
  }, [accessToken, role, nav]);

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
      if (user.role === "superadmin") {
        setError("Super Admins have their own portal. Please use the Super Admin Portal.");
        setLoading(false);
        return;
      }
      if (user.role === "user") {
        setError("This portal is for Company Admins only. Users, please use the User Portal.");
        setLoading(false);
        return;
      }
      setAuth(accessToken, { email: user.email, role: user.role, domain: user.domain, displayName: user.displayName });
      sessionStorage.setItem("mp", password);
    } catch {
      setError("Incorrect email or password. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <ShieldCheck size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[#202124]">Admin Sign in</h1>
        <p className="text-sm text-[#5f6368] mt-1">MailServer · Admin Portal</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        {step === "email" ? (
          <form onSubmit={handleEmailNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-1.5">Admin email</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                required
                autoFocus
                className={`w-full border rounded-lg px-3.5 py-3 text-sm text-[#202124]
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition-all ${error ? "border-red-400" : "border-gray-300"}`}
                placeholder="admin@yourdomain.com"
              />
              {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-colors">
                Next
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5 w-fit">
              <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-semibold uppercase">
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
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                           transition-all ${error ? "border-red-400" : "border-gray-300"}`}
                placeholder="Enter your password"
              />
              {error && (
                <div className="flex items-center gap-1.5 mt-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-red-500 flex-shrink-0">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p className="text-xs text-red-500">{error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setStep("email"); setError(""); }}
                className="text-sm text-indigo-600 hover:underline font-medium">
                Back
              </button>
              <button type="submit" disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium rounded-lg px-6 py-2.5 text-sm flex items-center gap-2 transition-colors">
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

        <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
          <p className="text-xs text-[#5f6368]">
            Super Admin?{" "}
            <Link to="/superadmin/login" className="text-purple-600 hover:underline font-medium">
              Super Admin Portal →
            </Link>
          </p>
          <p className="text-xs text-[#5f6368]">
            Regular user?{" "}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              User Portal →
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-[#5f6368]">Admin & Super Admin Portal · MailServer</p>
        <div className="flex gap-4 justify-center mt-2 text-xs text-[#5f6368]">
          <a href="#" className="hover:underline">Help</a>
          <a href="#" className="hover:underline">Privacy</a>
        </div>
      </div>
    </div>
  );
}
