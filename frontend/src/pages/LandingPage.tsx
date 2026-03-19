import { Link } from "react-router-dom";
import {
  Mail,
  Calendar,
  Users,
  FileText,
  Shield,
  Server,
  Zap,
  Globe,
  ShieldCheck,
  Building2,
  User,
  Crown,
  ArrowRight,
} from "lucide-react";

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 text-white rounded-lg p-1.5">
            <Mail size={20} />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">MailServer</span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            User Portal
          </Link>
          <Link
            to="/admin/login"
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Admin Portal
          </Link>
          <Link
            to="/superadmin/login"
            className="px-4 py-2 text-sm font-medium text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors shadow-sm"
          >
            Super Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
const portalCards = [
  {
    role: "User",
    icon: User,
    description:
      "Send and receive email, manage your calendar, contacts, and files — all in one place.",
    href: "/login",
    gradient: "from-blue-500 to-blue-700",
    ring: "ring-blue-200",
    btnBg: "bg-blue-600 hover:bg-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    role: "Admin",
    icon: Building2,
    description:
      "Create and manage users within your company, reset passwords, and configure quotas.",
    href: "/admin/login",
    gradient: "from-indigo-500 to-indigo-700",
    ring: "ring-indigo-200",
    btnBg: "bg-indigo-600 hover:bg-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
  },
  {
    role: "Super Admin",
    icon: Crown,
    description:
      "Oversee all tenants, set usage limits, manage billing, and monitor system health.",
    href: "/superadmin/login",
    gradient: "from-purple-600 to-purple-900",
    ring: "ring-purple-200",
    btnBg: "bg-purple-700 hover:bg-purple-800",
    badge: "bg-purple-100 text-purple-800",
  },
];

function Hero() {
  return (
    <section className="pt-32 pb-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Headline */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase bg-blue-100 text-blue-700 rounded-full mb-5">
            Open Source · Self-Hosted · Private
          </span>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Your own private workspace —<br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              email, calendar, files, office
            </span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            A self-hosted alternative to G&nbsp;Suite and Microsoft&nbsp;365,
            running on your own hardware. Full control. Zero vendor lock-in.
          </p>
        </div>

        {/* 3-column portal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portalCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.role}
                className={`relative bg-white rounded-2xl shadow-xl ring-1 ${card.ring} p-8 flex flex-col hover:shadow-2xl hover:-translate-y-1 transition-all duration-200`}
              >
                {/* Icon header */}
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} text-white mb-5 shadow-md`}
                >
                  <Icon size={22} />
                </div>

                {/* Badge */}
                <span
                  className={`self-start text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-3 ${card.badge}`}
                >
                  {card.role}
                </span>

                <p className="text-gray-500 text-sm leading-relaxed flex-1 mb-6">
                  {card.description}
                </p>

                <Link
                  to={card.href}
                  className={`inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors ${card.btnBg}`}
                >
                  Sign In <ArrowRight size={15} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Mail,
    title: "Webmail",
    description:
      "Gmail-style three-pane inbox with compose, folders, search, and rich-text editing powered by Dovecot + Postfix.",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Calendar,
    title: "Calendar",
    description:
      "Personal and shared team calendars via CalDAV — sync instantly with any CalDAV client.",
    color: "text-green-600 bg-green-50",
  },
  {
    icon: Users,
    title: "Contacts",
    description:
      "Manage contacts with CardDAV. Sync with your phone, Outlook, or Thunderbird seamlessly.",
    color: "text-teal-600 bg-teal-50",
  },
  {
    icon: FileText,
    title: "File Storage",
    description:
      "Upload, browse, and share files through a Nextcloud-compatible interface. Access from anywhere.",
    color: "text-orange-600 bg-orange-50",
  },
  {
    icon: Globe,
    title: "LibreOffice Online",
    description:
      "Edit .docx, .xlsx, and .pptx files directly in the browser via Collabora CODE — enable with VITE_COLLABORA_ENABLED=true.",
    color: "text-yellow-600 bg-yellow-50",
  },
  {
    icon: ShieldCheck,
    title: "Spam & Antivirus",
    description:
      "Rspamd blocks spam with machine learning. ClamAV scans every attachment. DKIM, SPF, and DMARC enforced.",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: Building2,
    title: "Multi-Tenant",
    description:
      "Super Admin creates companies. Each Admin manages their own users. Strict data isolation at every layer.",
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    icon: Zap,
    title: "High Availability",
    description:
      "Two Raspberry Pi 4s with Pacemaker/Corosync. Automatic failover in ~2 seconds — no single point of failure.",
    color: "text-purple-600 bg-purple-50",
  },
];

function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything your team needs
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            A complete productivity suite that stays on your hardware.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-white"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4 ${f.color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const roles = [
  {
    icon: Crown,
    label: "Super Admin",
    color: "from-purple-600 to-purple-900",
    badge: "bg-purple-100 text-purple-800",
    steps: [
      "Create and manage companies (tenants)",
      "Set storage, user, and API limits per company",
      "Monitor system health and usage metrics",
      "Manage billing and subscription plans",
    ],
  },
  {
    icon: Building2,
    label: "Company Admin",
    color: "from-indigo-500 to-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    steps: [
      "Create and deactivate user accounts",
      "Reset passwords and manage aliases",
      "Configure department mail groups",
      "View per-user storage and activity",
    ],
  },
  {
    icon: User,
    label: "User",
    color: "from-blue-500 to-blue-700",
    badge: "bg-blue-100 text-blue-700",
    steps: [
      "Send, receive, and organize email",
      "Manage personal calendar and shared calendars",
      "Store and share files with teammates",
      "Edit documents in the browser with LibreOffice",
    ],
  },
];

function HowItWorks() {
  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Three roles. One platform.
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Clear separation of responsibilities — from infrastructure to end users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.label}
                className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 hover:shadow-xl transition-shadow duration-200"
              >
                <div
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${r.color} text-white mb-4 shadow`}
                >
                  <Icon size={20} />
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${r.badge}`}>
                  {r.label}
                </span>
                <ul className="mt-5 space-y-3">
                  {r.steps.map((step) => (
                    <li key={step} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 block" />
                      </span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Connect From Anywhere ────────────────────────────────────────────────────
const clientSettings = [
  { client: "IMAP (incoming)", server: "mail.yourdomain.com", port: "993", security: "SSL/TLS" },
  { client: "SMTP (outgoing)", server: "mail.yourdomain.com", port: "587", security: "STARTTLS" },
  { client: "POP3 (incoming)", server: "mail.yourdomain.com", port: "995", security: "SSL/TLS" },
  { client: "CalDAV (calendar)", server: "mail.yourdomain.com/dav", port: "443", security: "HTTPS" },
  { client: "CardDAV (contacts)", server: "mail.yourdomain.com/dav", port: "443", security: "HTTPS" },
];

const clients = [
  { name: "Outlook" },
  { name: "Thunderbird" },
  { name: "Apple Mail" },
  { name: "Gmail App" },
  { name: "K-9 Mail" },
  { name: "Spark" },
];

function ConnectSection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-50 text-green-600 mb-4">
            <Globe size={24} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Connect from anywhere
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Standard protocols mean any email client works out of the box.
          </p>
        </div>

        {/* Client pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {clients.map((c) => (
            <span
              key={c.name}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm font-medium text-gray-700"
            >
              {c.name}
            </span>
          ))}
        </div>

        {/* Settings table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Protocol</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Server</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Port</th>
                <th className="text-left px-6 py-4 font-semibold text-gray-600">Security</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clientSettings.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{row.client}</td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{row.server}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-semibold text-xs">
                      {row.port}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                      <Shield size={12} /> {row.security}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 text-white mb-6">
          <Server size={28} />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Your data. Your servers. Your rules.
        </h2>
        <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto">
          No subscriptions, no surveillance, no lock-in. Everything runs on hardware you own.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-blue-700 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Sign In as User <ArrowRight size={16} />
          </Link>
          <Link
            to="/admin/login"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/10 border border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transition-all"
          >
            Admin Portal <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-900 py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-white">
          <div className="bg-blue-600 rounded-lg p-1">
            <Mail size={16} />
          </div>
          <span className="font-bold">MailServer</span>
        </div>

        <p className="text-gray-400 text-sm text-center">
          Self-hosted &middot; Private &middot; Secure
        </p>

        <div className="flex items-center gap-4 text-gray-500 text-sm">
          <Link to="/login" className="hover:text-white transition-colors">User Portal</Link>
          <Link to="/admin/login" className="hover:text-white transition-colors">Admin Portal</Link>
          <Link to="/superadmin/login" className="hover:text-white transition-colors">Super Admin</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <ConnectSection />
      <CTABanner />
      <Footer />
    </div>
  );
}
