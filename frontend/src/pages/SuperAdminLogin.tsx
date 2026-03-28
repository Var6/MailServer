import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../store/index.ts";
import { login } from "../api/authApi.ts";

export default function SuperAdminLoginPage() {
  const nav = useNavigate();
  const { accessToken, setAuth } = useAuthStore();
  const role = useAuthStore(s => s.role);

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState<"email" | "password">("email");

  useEffect(() => {
    if (!accessToken || role !== "superadmin") return;
    nav("/superadmin/tenants", { replace: true });
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
      if (user.role !== "superadmin") {
        setError(
          user.role === "admin"
            ? "This portal is for Super Admins only. Admins, use the Admin Portal."
            : "This portal is for Super Admins only. Users, use the User Portal."
        );
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
         style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)" }}>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl"
             style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="text-sm text-purple-200 mt-1">MailServer · System Control</p>
      </div>

      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
        {step === "email" ? (
          <form onSubmit={handleEmailNext} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-purple-100 mb-1.5">
                Super Admin email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                required
                autoFocus
                className={`w-full bg-white/20 border rounded-lg px-3.5 py-3 text-sm text-white
                           placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-300
                           focus:border-transparent transition-all ${error ? "border-red-400" : "border-white/30"}`}
                placeholder="superadmin@yourdomain.com"
              />
              {error && <p className="text-xs text-red-300 mt-1.5">{error}</p>}
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit"
                className="bg-purple-500 hover:bg-purple-400 text-white font-medium rounded-lg px-6 py-2.5 text-sm transition-colors shadow-lg">
                Next
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 w-fit">
              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase">
                {email[0]}
              </div>
              <span className="text-sm text-white">{email}</span>
              <button type="button"
                onClick={() => { setStep("email"); setError(""); setPassword(""); }}
                className="text-purple-300 hover:text-white text-xs ml-1">
                ▾
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-100 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  required
                  autoFocus
                  className={`w-full bg-white/20 border rounded-lg px-3.5 py-3 pr-10 text-sm text-white
                             placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-300
                             focus:border-transparent transition-all ${error ? "border-red-400" : "border-white/30"}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && (
                <div className="flex items-start gap-1.5 mt-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-red-300 flex-shrink-0 mt-0.5">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  <p className="text-xs text-red-300">{error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => { setStep("email"); setError(""); }}
                className="text-sm text-purple-200 hover:text-white transition-colors font-medium">
                Back
              </button>
              <button type="submit" disabled={loading}
                className="bg-purple-500 hover:bg-purple-400 disabled:opacity-60 text-white font-medium rounded-lg px-6 py-2.5 text-sm flex items-center gap-2 transition-colors shadow-lg">
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

        <div className="mt-6 pt-5 border-t border-white/20 space-y-2 text-center">
          <p className="text-xs text-purple-200">
            Company Admin?{" "}
            <Link to="/admin/login" className="text-white hover:underline font-medium">
              Admin Portal →
            </Link>
          </p>
          <p className="text-xs text-purple-200">
            Regular User?{" "}
            <Link to="/login" className="text-white hover:underline font-medium">
              User Portal →
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-purple-300">
        Super Admin Portal · MailServer
      </p>
    </div>
  );
}
