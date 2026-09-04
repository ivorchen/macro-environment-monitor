"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const THEME_STORAGE_KEY = "macro-monitor-theme-v1";
export type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeSwitcher() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const timer = window.setTimeout(() => setTheme(activeTheme), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const toggle = () => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="theme-switcher rounded-full border-border bg-card text-foreground shadow-none hover:bg-accent"
      onClick={toggle}
      aria-label={t(nextTheme === "light" ? "theme.switchLight" : "theme.switchDark")}
      title={t(nextTheme === "light" ? "theme.switchLight" : "theme.switchDark")}
    >
      {theme === "dark" ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </Button>
  );
}
