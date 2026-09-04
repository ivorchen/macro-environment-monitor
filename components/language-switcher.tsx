"use client";

import { Languages } from "lucide-react";

import { SUPPORTED_LOCALES, useI18n, type Locale } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="relative flex h-9 items-center rounded-full border border-border bg-card pl-8 pr-2 text-[10px] font-semibold text-foreground">
      <Languages className="pointer-events-none absolute left-2.5 size-3.5" aria-hidden="true" />
      <span className="sr-only">{t("language.label")}</span>
      <select
        className="appearance-none bg-transparent pr-3 outline-none"
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>{t(`language.${option}`)}</option>
        ))}
      </select>
    </label>
  );
}
