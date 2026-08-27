"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY } from "./theme-script";

type ThemeChoice = "light" | "dark" | "system";

const CHANGE_EVENT = "rehlaty:theme-change";

function readStored(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Some browsers deny storage access in private mode.
    // "System" stays a correct answer, so nothing breaks.
  }
  return "system";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** The server cannot know the browser's preference, so it always starts at "system". */
function getServerSnapshot(): ThemeChoice {
  return "system";
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // The choice will not survive to the next visit, but this session works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const choice = useSyncExternalStore(subscribe, readStored, getServerSnapshot);

  const options: ReadonlyArray<{ value: ThemeChoice; label: string; Icon: typeof Sun }> = [
    { value: "light", label: t("light"), Icon: Sun },
    { value: "dark", label: t("dark"), Icon: Moon },
    { value: "system", label: t("system"), Icon: Monitor },
  ];

  return (
    <div
      role="group"
      aria-label={t("toggle")}
      className="flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          title={label}
          aria-label={label}
          aria-pressed={choice === value}
          className={cn(
            "flex size-7 items-center justify-center rounded transition-colors",
            choice === value ? "bg-surface-3 text-fg" : "text-fg-faint hover:text-fg",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
