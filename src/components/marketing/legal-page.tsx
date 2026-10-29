import { SITE } from "@/lib/site";

/** Shared frame for the policy pages: title, effective date and readable prose styles. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {SITE.policiesUpdated}</p>
      {intro && <div className="mt-6 text-muted-foreground">{intro}</div>}
      <div className="mt-8 space-y-8 text-[15px] leading-7 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
