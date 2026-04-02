import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Copy, Check, ChevronDown, ChevronRight,
  Mail, Shield, Smartphone, Monitor, Globe, UserPlus,
  Server, Lock, Wifi, CheckCircle, ArrowRight, ExternalLink,
} from "lucide-react";
import { useAuthStore } from "../../store/index.ts";
import CreateUserModal from "./CreateUserModal.tsx";

// ── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
    >
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}

// ── Mono value row with copy ─────────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-[#5f6368] w-28 flex-shrink-0">{label}</span>
      <div className="flex items-center flex-1 min-w-0">
        <code className="text-xs font-mono text-[#202124] bg-gray-50 px-2 py-0.5 rounded truncate">
          {value}
        </code>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}

// ── Accordion for client instructions ────────────────────────────────────────
function Accordion({ title, icon: Icon, children }: { title: string; icon: typeof Monitor; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-indigo-500" />
          <span className="text-sm font-medium text-[#202124]">{title}</span>
        </div>
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Numbered step ─────────────────────────────────────────────────────────────
function Step({ n, text }: { n: number; text: React.ReactNode }) {
  return (
    <div className="flex gap-3 pt-3">
      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </div>
      <p className="text-sm text-[#202124] leading-relaxed">{text}</p>
    </div>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────────
type Tab = "overview" | "clients" | "dns";

// ── Main component ────────────────────────────────────────────────────────────
export default function GuidePage() {
  const { domain, role } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [showCreate, setShowCreate] = useState(false);

  const host = domain ?? "yourdomain.com";
  const webmailUrl = window.location.origin;

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "clients",  label: "Email Clients", icon: Monitor },
    { id: "dns",      label: "DNS Setup", icon: Globe },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#202124]">Setup Guide</h1>
            <p className="text-xs text-[#5f6368]">How to configure accounts for <span className="font-medium text-indigo-600">@{host}</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-[#5f6368] hover:text-[#202124] hover:bg-gray-100"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6 max-w-3xl">

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-4 p-4 bg-indigo-600 text-white rounded-2xl shadow hover:bg-indigo-700 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <UserPlus size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm">Create New User</p>
                <p className="text-xs text-indigo-200 mt-0.5">Add an @{host} email account</p>
              </div>
              <ArrowRight size={16} className="ml-auto opacity-70" />
            </button>

            <button
              onClick={() => navigate("/admin/users")}
              className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm text-[#202124]">Manage Users</p>
                <p className="text-xs text-[#5f6368] mt-0.5">View, edit and deactivate accounts</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-gray-400" />
            </button>
          </div>

          {/* Step-by-step onboarding */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#202124] mb-1 flex items-center gap-2">
              <CheckCircle size={15} className="text-emerald-500" /> Getting Started
            </h2>
            <p className="text-xs text-[#5f6368] mb-4">Follow these steps to onboard a new team member.</p>

            <Step n={1} text={<>Click <strong>Create New User</strong> above and fill in the email address (e.g. <code className="bg-gray-100 px-1 rounded text-xs">john@{host}</code>), display name, a temporary password, and mailbox quota.</>} />
            <Step n={2} text={<>Share the login credentials with the user along with the webmail URL: <strong>{webmailUrl}</strong>.</>} />
            <Step n={3} text={<>The user should log in at <strong>{webmailUrl}</strong> and change their password immediately from <em>Settings → Security</em>.</>} />
            <Step n={4} text={<>If the user wants to use a desktop or mobile client (Thunderbird, Outlook, Apple Mail, iPhone, Android) — open the <strong>Email Clients</strong> tab for step-by-step instructions.</>} />
          </div>

          {/* Server summary card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-[#202124] mb-4 flex items-center gap-2">
              <Server size={15} className="text-indigo-500" /> Mail Server Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">Incoming Mail (IMAP)</p>
                <Row label="Server"   value={`mail.${host}`} />
                <Row label="Port"     value="993" />
                <Row label="Security" value="SSL / TLS" />
                <Row label="Username" value={`username@${host}`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">Outgoing Mail (SMTP)</p>
                <Row label="Server"   value={`mail.${host}`} />
                <Row label="Port"     value="587" />
                <Row label="Security" value="STARTTLS" />
                <Row label="Username" value={`username@${host}`} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">Webmail</p>
              <Row label="URL" value={webmailUrl} />
            </div>
          </div>

          {/* Tip */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Shield size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Security tip</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Always give new users a temporary password and ask them to change it on first login. Set quotas appropriate to each user's role to avoid disk exhaustion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL CLIENTS TAB ──────────────────────────────────────────────── */}
      {tab === "clients" && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-2">
            <p className="text-xs text-[#5f6368]">
              Use these settings to configure any standard email client. Replace <code className="bg-gray-100 px-1 rounded">username@{host}</code> with the actual user's email address.
            </p>
          </div>

          {/* ── Thunderbird ── */}
          <Accordion title="Mozilla Thunderbird" icon={Monitor}>
            <Step n={1} text="Open Thunderbird → click the menu (≡) → Account Settings → Account Actions → Add Mail Account." />
            <Step n={2} text={<>Enter the user's full name, email (<code className="bg-gray-100 px-1 rounded text-xs">user@{host}</code>), and password. Click <strong>Continue</strong>.</>} />
            <Step n={3} text="Thunderbird will auto-detect settings. If not, click Configure manually and enter:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <p className="text-xs font-semibold text-[#5f6368] mb-1">Incoming (IMAP)</p>
              <Row label="Server"   value={`mail.${host}`} />
              <Row label="Port"     value="993" />
              <Row label="SSL"      value="SSL/TLS" />
              <p className="text-xs font-semibold text-[#5f6368] mt-3 mb-1">Outgoing (SMTP)</p>
              <Row label="Server"   value={`mail.${host}`} />
              <Row label="Port"     value="587" />
              <Row label="Security" value="STARTTLS" />
              <Row label="Auth"     value="Normal Password" />
            </div>
            <Step n={4} text='Click "Done" to save and Thunderbird will start syncing mail.' />
          </Accordion>

          {/* ── Outlook ── */}
          <Accordion title="Microsoft Outlook (Windows / Mac)" icon={Monitor}>
            <Step n={1} text="Open Outlook → File → Add Account → enter the email address → click Advanced options → check 'Let me set up my account manually' → click Connect." />
            <Step n={2} text="Select IMAP as the account type." />
            <Step n={3} text="Enter incoming mail settings:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Server"     value={`mail.${host}`} />
              <Row label="Port"       value="993" />
              <Row label="Encryption" value="SSL/TLS" />
            </div>
            <Step n={4} text="Enter outgoing mail settings:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Server"     value={`mail.${host}`} />
              <Row label="Port"       value="587" />
              <Row label="Encryption" value="STARTTLS" />
            </div>
            <Step n={5} text="Click Next, enter the password, then Connect." />
          </Accordion>

          {/* ── Apple Mail ── */}
          <Accordion title="Apple Mail (macOS)" icon={Monitor}>
            <Step n={1} text="Open Mail → Mail menu → Add Account → select Other Mail Account → click Continue." />
            <Step n={2} text={<>Enter name, email (<code className="bg-gray-100 px-1 rounded text-xs">user@{host}</code>), and password → click Sign In.</>} />
            <Step n={3} text="If auto-detection fails, enter incoming settings:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Account type" value="IMAP" />
              <Row label="Server"       value={`mail.${host}`} />
              <Row label="Port"         value="993" />
            </div>
            <Step n={4} text="Enter outgoing SMTP settings:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Server" value={`mail.${host}`} />
              <Row label="Port"   value="587" />
            </div>
            <Step n={5} text="Click Sign In. Apple Mail will start downloading your messages." />
          </Accordion>

          {/* ── iPhone / iPad ── */}
          <Accordion title="iPhone / iPad (iOS / iPadOS)" icon={Smartphone}>
            <Step n={1} text="Go to Settings → Mail → Accounts → Add Account → Other → Add Mail Account." />
            <Step n={2} text={<>Fill in Name, Email (<code className="bg-gray-100 px-1 rounded text-xs">user@{host}</code>), Password, and Description. Tap Next.</>} />
            <Step n={3} text="Select IMAP, then fill in:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <p className="text-xs font-semibold text-[#5f6368] mb-1">Incoming Mail Server</p>
              <Row label="Host"     value={`mail.${host}`} />
              <Row label="Username" value={`user@${host}`} />
              <p className="text-xs font-semibold text-[#5f6368] mt-3 mb-1">Outgoing Mail Server</p>
              <Row label="Host"     value={`mail.${host}`} />
              <Row label="Username" value={`user@${host}`} />
            </div>
            <Step n={4} text="Tap Next → Save. iOS will verify and save the account automatically." />
          </Accordion>

          {/* ── Android ── */}
          <Accordion title="Android (Gmail app / built-in Mail)" icon={Smartphone}>
            <Step n={1} text="Open the Gmail app → tap your profile picture → Add another account → Other." />
            <Step n={2} text={<>Enter the email address (<code className="bg-gray-100 px-1 rounded text-xs">user@{host}</code>) → tap Manual Setup → IMAP.</>} />
            <Step n={3} text="Enter the password when prompted, then fill in incoming server:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Server"   value={`mail.${host}`} />
              <Row label="Port"     value="993" />
              <Row label="Security" value="SSL/TLS" />
            </div>
            <Step n={4} text="Fill in outgoing SMTP server:" />
            <div className="ml-8 mt-3 bg-white border border-gray-200 rounded-xl p-3 space-y-0">
              <Row label="Server"   value={`mail.${host}`} />
              <Row label="Port"     value="587" />
              <Row label="Security" value="STARTTLS" />
            </div>
            <Step n={5} text="Tap Next twice. Gmail will verify and save the account." />
          </Accordion>

          {/* ── Webmail ── */}
          <Accordion title="Webmail (any browser)" icon={Wifi}>
            <Step n={1} text={<>Open your browser and go to: <code className="bg-gray-100 px-1 rounded text-xs">{webmailUrl}</code></>} />
            <Step n={2} text={<>Enter the full email address (e.g. <code className="bg-gray-100 px-1 rounded text-xs">user@{host}</code>) and password.</>} />
            <Step n={3} text="Click Login. No app installation required — works on any device." />
            <div className="ml-8 mt-2">
              <a
                href={webmailUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
              >
                <ExternalLink size={12} /> Open webmail
              </a>
            </div>
          </Accordion>
        </div>
      )}

      {/* ── DNS SETUP TAB ──────────────────────────────────────────────────── */}
      {tab === "dns" && (
        <div className="space-y-6 max-w-3xl">
          {(role === "superadmin" || role === "admin") && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#202124] mb-1 flex items-center gap-2">
                  <Globe size={15} className="text-indigo-500" /> Required DNS Records for @{host}
                </h2>
                <p className="text-xs text-[#5f6368] mb-4">
                  Add these records in your domain registrar or DNS provider (Cloudflare, Route 53, GoDaddy, etc.). Replace <code className="bg-gray-100 px-1 rounded">YOUR.SERVER.IP</code> with your server's public IP address.
                </p>

                {/* MX */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">MX Record — routes incoming email</p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-0">
                    <Row label="Type"     value="MX" />
                    <Row label="Name"     value={host} />
                    <Row label="Value"    value={`mail.${host}`} />
                    <Row label="Priority" value="10" />
                    <Row label="TTL"      value="3600" />
                  </div>
                </div>

                {/* A record */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">A Record — points mail subdomain to server</p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-0">
                    <Row label="Type"  value="A" />
                    <Row label="Name"  value={`mail.${host}`} />
                    <Row label="Value" value="YOUR.SERVER.IP" />
                    <Row label="TTL"   value="3600" />
                  </div>
                </div>

                {/* SPF */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">SPF Record — prevents email spoofing</p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-0">
                    <Row label="Type"  value="TXT" />
                    <Row label="Name"  value={host} />
                    <Row label="Value" value={`v=spf1 mx a:mail.${host} ~all`} />
                    <Row label="TTL"   value="3600" />
                  </div>
                </div>

                {/* DKIM */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">DKIM Record — cryptographic email signing</p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-800">
                      Run the following on your server to generate the DKIM key, then add the output as a TXT record:
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1 flex-1 break-all">
                        docker exec mailserver-postfix cat /etc/opendkim/keys/{host}/mail.txt
                      </code>
                      <CopyBtn text={`docker exec mailserver-postfix cat /etc/opendkim/keys/${host}/mail.txt`} />
                    </div>
                    <div className="mt-3 space-y-0">
                      <Row label="Type" value="TXT" />
                      <Row label="Name" value={`mail._domainkey.${host}`} />
                      <Row label="Value" value="(paste output from the command above)" />
                    </div>
                  </div>
                </div>

                {/* DMARC */}
                <div>
                  <p className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider mb-2">DMARC Record — policy for failed auth</p>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-0">
                    <Row label="Type"  value="TXT" />
                    <Row label="Name"  value={`_dmarc.${host}`} />
                    <Row label="Value" value={`v=DMARC1; p=quarantine; rua=mailto:admin@${host}`} />
                    <Row label="TTL"   value="3600" />
                  </div>
                </div>
              </div>

              {/* PTR tip */}
              <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Lock size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Reverse DNS (PTR) record</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Ask your hosting provider (VPS/cloud) to set a PTR record for your server's IP pointing to <strong>mail.{host}</strong>. This is required by many receiving mail servers to not mark your emails as spam.
                  </p>
                </div>
              </div>

              {/* Propagation note */}
              <div className="flex gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <Globe size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#5f6368]">
                  DNS changes can take up to <strong>48 hours</strong> to propagate worldwide, though usually under 1 hour with providers like Cloudflare. Use <a href="https://mxtoolbox.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">mxtoolbox.com</a> to verify your records.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create user modal */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
