import { cn } from '@/lib/utils';

type Variant = 'teal' | 'gold' | 'muted' | 'new' | 'steady' | 'surge';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  /** Native tooltip — used to explain surge/steady numbers on hover. */
  title?: string;
}

const styles: Record<Variant, string> = {
  teal: 'bg-accent-teal-glow text-accent-teal border-accent-teal-dim',
  gold: 'bg-accent-gold/10 text-accent-gold border-accent-gold-dim',
  muted: 'bg-bg-panel text-fg-muted border-bg-border',
  new: 'bg-accent-gold text-bg-darkest border-accent-gold font-semibold',
  // Hall-of-fame marker: deliberately quiet. A steady seller is context, not
  // news — it should never out-shout a surge badge on the momentum pages.
  steady: 'bg-bg-elevated text-fg-muted border-fg-dim/30',
  // Acceleration marker: the loudest thing on a card, because it is the whole
  // point of the daily/weekly ranking.
  surge: 'bg-accent-teal text-bg-darkest border-accent-teal font-semibold',
};

export default function Badge({ variant = 'muted', children, className, title }: Props) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded-sm font-mono',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
