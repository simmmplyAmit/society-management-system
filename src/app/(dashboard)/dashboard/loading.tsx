// Shown instantly while a dashboard page loads: shimmering blocks in the shape of the page.
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-28 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  );
}
