import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./styles/global.css";
import { useUiThemeStore } from "./store/index.ts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const savedBg = useUiThemeStore.getState().appBg;
document.documentElement.style.setProperty("--app-bg", savedBg);
useUiThemeStore.subscribe((state) => {
  document.documentElement.style.setProperty("--app-bg", state.appBg);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
