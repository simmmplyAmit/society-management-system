import { IntlProvider } from "@/components/i18n/intl-provider";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return <IntlProvider>{children}</IntlProvider>;
}
