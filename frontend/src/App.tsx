import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/index.ts";
import LoginPage    from "./pages/Login.tsx";
import InboxPage    from "./pages/Inbox.tsx";
import CalendarPage from "./pages/Calendar.tsx";
import ContactsPage from "./pages/Contacts.tsx";
import FilesPage    from "./pages/Files.tsx";
import Layout       from "./components/Layout/Layout.tsx";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore(s => s.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="inbox"    element={<InboxPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="files"    element={<FilesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
