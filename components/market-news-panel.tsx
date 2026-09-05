"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Newspaper } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketNewsFeed } from "@/lib/data/market-news";
import { useI18n } from "@/lib/i18n";

export function MarketNewsPanel() {
  const { intlLocale, locale, t } = useI18n();
  const [feed, setFeed] = useState<MarketNewsFeed | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/market-news", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<{ feed: MarketNewsFeed }>;
      })
      .then((payload) => setFeed(payload.feed))
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  const date = (value: string) => new Intl.DateTimeFormat(intlLocale, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
  }).format(new Date(value));

  return (
    <section className="mt-4" aria-labelledby="market-news-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("marketNews.eyebrow").toUpperCase()}</p>
          <h3 id="market-news-heading" className="font-display text-3xl tracking-[-0.03em] sm:text-4xl">{t("marketNews.title")}</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#6f7d78]">{t("marketNews.description")}</p>
        </div>
        {feed && <Badge variant="outline" className="rounded-full border-[#d4d9d3] bg-[#fbfaf6] text-[9px] text-[#66746e]">{t("marketNews.updated", { value: date(feed.generatedAt) })}</Badge>}
      </div>

      {!feed ? (
        <Card className="border-[#d9ddd7] bg-[#fbfaf6] shadow-none"><CardContent className="flex items-center gap-3 py-6 text-xs text-[#66746e]"><Newspaper className="size-4" />{unavailable ? t("marketNews.unavailable") : t("marketNews.loading")}</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {feed.items.map((item) => {
            const content = locale === "en" ? item : item.translations[locale];
            return <Card key={item.id} className="group flex flex-col border-[#d9ddd7] bg-[#fbfaf6] shadow-none transition hover:-translate-y-0.5 hover:border-[#a9bcb2] hover:shadow-[0_16px_40px_rgba(23,35,31,.07)]">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center justify-between gap-2"><Badge variant="outline" className="border-[#bfd0df] bg-[#e9f0f6] text-[#315b78]">{content.category}</Badge><span className="text-[9px] text-[#7a8781]">{date(item.publishedAt)}</span></div>
                <CardTitle className="font-sans text-sm leading-5">{content.headline}</CardTitle>
                <p className="text-[10px] font-semibold text-[#175f47]">{item.source}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-xs leading-5 text-[#5f6e67]">{content.summary}</p>
                <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#175f47] hover:underline">{t("marketNews.open")} <ArrowUpRight className="size-3" /></a>
              </CardContent>
            </Card>;
          })}
        </div>
      )}
    </section>
  );
}
