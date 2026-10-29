/** Page heading with a small emoji that pops in. The emoji is decoration, hidden from screen readers. */
export function PageTitle({ emoji, children }: { emoji?: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-2xl font-semibold">
      {emoji && (
        <span className="emoji-pop text-[0.9em]" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span>{children}</span>
    </h2>
  );
}
