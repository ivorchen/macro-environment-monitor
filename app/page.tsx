import { MacroDashboard } from "@/components/macro-dashboard";
import { I18nProvider } from "@/lib/i18n";

export default function Home() {
  return <I18nProvider><MacroDashboard /></I18nProvider>;
}
