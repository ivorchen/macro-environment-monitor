"use client";

import { ArrowUpRight, MessageCircleMore } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X_FEED_CAPTURED_AT, X_WHATS_NEW, type XFeedTopic } from "@/lib/data/x-whats-new";
import { useI18n } from "@/lib/i18n";

function topicClasses(topic: XFeedTopic) {
  if (topic === "AI") return "border-[#c8d6a7] bg-[#e7efd2] text-[#4d6335]";
  if (topic === "US stocks") return "border-[#bfd0df] bg-[#e9f0f6] text-[#315b78]";
  return "border-[#d8c7a1] bg-[#f4ead2] text-[#765923]";
}

function topicLabel(topic: XFeedTopic, t: ReturnType<typeof useI18n>["t"]) {
  if (topic === "AI") return t("xFeed.ai");
  if (topic === "US stocks") return t("xFeed.stocks");
  return t("xFeed.combined");
}

export function XWhatsNewPanel() {
  const { intlLocale, t } = useI18n();
  const capturedAt = new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(X_FEED_CAPTURED_AT));

  return (
    <section className="mt-4" aria-labelledby="x-whats-new-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 text-[9px] font-extrabold tracking-[0.2em] text-[#6f7d78]">{t("xFeed.eyebrow").toUpperCase()}</p>
          <h3 id="x-whats-new-heading" className="font-display text-3xl tracking-[-0.03em] sm:text-4xl">{t("xFeed.title")}</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#6f7d78]">{t("xFeed.description")}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-[#d4d9d3] bg-[#fbfaf6] text-[9px] text-[#66746e]">
          {t("xFeed.captured", { value: capturedAt })}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {X_WHATS_NEW.map((item) => (
          <Card key={item.id} className="group border-[#d9ddd7] bg-[#fbfaf6] shadow-none transition hover:-translate-y-0.5 hover:border-[#a9bcb2] hover:shadow-[0_16px_40px_rgba(23,35,31,.07)]">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={topicClasses(item.topic)}>{topicLabel(item.topic, t)}</Badge>
                <span className="text-[9px] text-[#7a8781]">
                  {new Intl.DateTimeFormat(intlLocale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(item.postedAt))}
                </span>
              </div>
              <CardTitle className="font-sans text-sm leading-5">
                {item.author} <span className="font-normal text-[#7a8781]">{item.handle}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-between gap-4">
              <p className="text-xs leading-5 text-[#5f6e67]">{item.summary}</p>
              <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-[#175f47] hover:underline">
                {t("xFeed.open")} <ArrowUpRight className="size-3" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-3 flex items-start gap-2 text-[9px] leading-4 text-[#7b8781]">
        <MessageCircleMore className="mt-0.5 size-3 shrink-0" />
        {t("xFeed.disclaimer")}
      </p>
    </section>
  );
}
