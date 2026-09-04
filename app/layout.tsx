import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

const productionUrl = new URL(
  process.env.APP_URL ?? "https://salute-pang-bottom.ngrok-free.dev/",
);

export const metadata: Metadata = {
  metadataBase: productionUrl,
  title: "Macro Environment Monitor",
  description: "A disciplined weekly macro scorecard for U.S. equity investors.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Macro Environment Monitor",
    description: "A disciplined weekly macro scorecard for U.S. equity investors.",
    type: "website",
    url: "/",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem("macro-monitor-theme-v1");var theme=saved==="light"||saved==="dark"?saved:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(e){document.documentElement.dataset.theme="dark";document.documentElement.style.colorScheme="dark";}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
