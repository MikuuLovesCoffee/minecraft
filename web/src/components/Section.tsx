export function Section({ title, children, id, className = '' }: { title?: string; children: React.ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 pt-16 ${className}`}>
      {title && (
        <h2 className="mb-6 flex items-center gap-3 font-pixel text-2xl sm:text-3xl">
          <span className="inline-block h-3 w-3 bg-diamond" aria-hidden />
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`pixel-frame rounded-md bg-panel p-5 ${className}`}>{children}</div>;
}
