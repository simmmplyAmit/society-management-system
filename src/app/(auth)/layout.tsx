import { IntlProvider } from "@/components/i18n/intl-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <IntlProvider>{children}</IntlProvider>;
}
