import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b border-bg-border">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-accent-teal rec-dot shadow-teal-glow" />
          <span className="font-mono text-sm tracking-widest text-fg-muted group-hover:text-accent-teal">
            WVB//CC-RADAR
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm font-mono">
          <Link
            href="/"
            className="text-fg-muted hover:text-accent-teal uppercase tracking-wider text-xs"
          >
            Daily
          </Link>
          <Link
            href="/weekly"
            className="text-fg-muted hover:text-accent-gold uppercase tracking-wider text-xs"
          >
            Weekly
          </Link>
          <Link
            href="/top"
            className="text-fg-muted hover:text-accent-gold uppercase tracking-wider text-xs"
          >
            All-time
          </Link>
          <Link
            href="/archive"
            className="text-fg-muted hover:text-accent-teal uppercase tracking-wider text-xs"
          >
            Archive
          </Link>
          <Link
            href="/about"
            className="text-fg-muted hover:text-accent-teal uppercase tracking-wider text-xs"
          >
            About
          </Link>
          <a
            href="/api/rss"
            className="text-fg-muted hover:text-accent-teal uppercase tracking-wider text-xs"
          >
            RSS
          </a>
          <a
            href="https://www.wiltvb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-teal hover:text-accent-gold uppercase tracking-wider text-xs"
          >
            WVB ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
