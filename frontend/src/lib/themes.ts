import { useUiThemeStore } from "../store/index.ts";

export const BG_THEMES = [
  { bg: "#eef2ff",                                  label: "Light Purple",       text: "#1f2937" },
  { bg: "#f5f7fb",                                  label: "Light Gray",         text: "#1f2937" },
  { bg: "#e9f5ff",                                  label: "Light Blue",         text: "#1f2937" },
  { bg: "#f4efe6",                                  label: "Light Tan",          text: "#1f2937" },
  { bg: "linear-gradient(120deg,#e0f2fe,#f5f3ff)",  label: "Purple-Blue",        text: "#1f2937" },
  { bg: "linear-gradient(120deg,#fef3c7,#fde68a)",  label: "Golden",             text: "#1f2937" },
  { bg: "linear-gradient(120deg,#dcfce7,#ccfbf1)",  label: "Green-Teal",         text: "#1f2937" },
  { bg: "linear-gradient(120deg,#fee2e2,#fecdd3)",  label: "Pink-Rose",          text: "#1f2937" },
  { bg: "#1f2937",                                  label: "Dark Gray",          text: "#f3f4f6" },
  { bg: "#0f172a",                                  label: "Dark Blue",          text: "#f1f5f9" },
  { bg: "#1e1b4b",                                  label: "Dark Purple",        text: "#f3e8ff" },
  { bg: "#0c0a1e",                                  label: "Very Dark",          text: "#e9d5ff" },
  { bg: "linear-gradient(120deg,#0f172a,#1e1b4b)",  label: "Dark Purple-Blue",   text: "#f0f9ff" },
  { bg: "linear-gradient(120deg,#1f2937,#111827)",  label: "Dark Gray Gradient", text: "#f9fafb" },
  { bg: "linear-gradient(120deg,#1e293b,#0f172a)",  label: "Slate-Blue",         text: "#f1f5f9" },
  { bg: "linear-gradient(120deg,#2d1b69,#0c0a1e)",  label: "Deep Purple",        text: "#fce7f3" },
];

export const DARK_TEXT_COLORS = [
  "#f3f4f6", "#f1f5f9", "#f3e8ff", "#e9d5ff", "#f0f9ff", "#f9fafb", "#fce7f3",
];

export function useTheme() {
  const appBg = useUiThemeStore((s) => s.appBg);
  const found = BG_THEMES.find((t) => t.bg === appBg);
  const textColor = found?.text ?? "#1f2937";
  const isDark = DARK_TEXT_COLORS.includes(textColor);
  return { appBg, textColor, isDark };
}

export function useIsDark() {
  return useTheme().isDark;
}
