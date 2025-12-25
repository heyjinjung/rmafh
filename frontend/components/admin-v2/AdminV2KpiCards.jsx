const cards = [
  { label: 'Jobs Today', value: '84', delta: '+12%' },
  { label: 'Imports', value: '18', delta: '+3' },
  { label: 'Failed', value: '2', delta: '-5' },
];

export default function AdminV2KpiCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-[var(--v2-border)] bg-[var(--v2-surface-2)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--v2-muted)]">{card.label}</p>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-ibm text-2xl font-semibold text-[var(--v2-text)]">{card.value}</span>
            <span className="text-xs text-[var(--v2-accent)]">{card.delta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
