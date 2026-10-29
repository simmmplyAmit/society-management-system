// A template (unlike a layout) is re-created on every navigation, so each page eases in.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
