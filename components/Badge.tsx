import { cn } from '@/lib/utils';

type Variant = 'teal' | 'gold' | 'muted' | 'new';

interface Props {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const styles: Record<Variant, string> = {
  teal: 'bg-accent-teal-glow text-accent-teal border-accent-teal-dim',
  gold: 'bg-accent-gold/10 text-accent-gold border-accent-gold-dim',
  muted: 'bg-bg-panel text-fg-muted border-bg-border',
  new: 'bg-accent-gold text-bg-darkest border-accent-gold font-semibold',
};

export default function Badge({ variant = 'muted', children, className }: Props) {
  return (
    <span
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
