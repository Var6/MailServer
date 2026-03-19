import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore, type UserRole } from "./store/index.ts";
import LandingPage         from "./pages/LandingPage.tsx";
import LoginPage           from "./pages/Login.tsx";
import AdminLoginPage      from "./pages/AdminLogin.tsx";
import SuperAdminLoginPage from "./pages/SuperAdminLogin.tsx";
import InboxPage           from "./pages/Inbox.tsx";
import CalendarPage        from "./pages/Calendar.tsx";
import ContactsPage        from "./pages/Contacts.tsx";
import FilesPage           from "./pages/Files.tsx";
import TenantsPage         from "./pages/superadmin/Tenants.tsx";
import BillingPage         from "./pages/superadmin/Billing.tsx";
import AdminUsersPage      from "./pages/admin/Users.tsx";
import Layout              from "./components/Layout/Layout.tsx";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore(s => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: JSX.Element }) {
  const role = useAuthStore(s => s.role);
  if (!role || !roles.includes(role)) return <Navigate to="/inbox" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth pages */}
        <Route path="/login"            element={<LoginPage />} />
        <Route path="/admin/login"      element={<AdminLoginPage />} />
        <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />

        {/* Protected app routes — pathless layout route */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Regular user routes */}
          <Route path="inbox"    element={<InboxPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="files"    element={<FilesPage />} />

          {/* Admin routes */}
          <Route
            path="admin/users"
            element={
              <RequireRole roles={["admin", "superadmin"]}>
                <AdminUsersPage />
              </RequireRole>
            }
          />

          {/* Super-admin routes */}
          <Route
            path="superadmin/tenants"
            element={
              <RequireRole roles={["superadmin"]}>
                <TenantsPage />
              </RequireRole>
            }
          />
          <Route
            path="superadmin/billing"
            element={
              <RequireRole roles={["superadmin"]}>
                <BillingPage />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
