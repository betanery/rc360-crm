interface EmptyPageProps {
  title: string;
  description: string;
}

export function EmptyPage({ title, description }: EmptyPageProps) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-2xl border border-dashed border-border bg-card px-8 py-12 text-center">
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <span className="mt-6 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
          Em breve
        </span>
      </div>
    </div>
  );
}
