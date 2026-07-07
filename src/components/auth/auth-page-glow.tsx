export function AuthPageGlow() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/3 h-125 w-125 -translate-x-1/2 rounded-full bg-(--primary) blur-3xl"
        style={{ opacity: "var(--blob-opacity-1, 0.08)" }}
      />
    </div>
  );
}
