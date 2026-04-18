import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'wvb-cc-radar — Claude Code Ecosystem Daily Digest',
  description:
    'Daily digest of trending GitHub repositories for Claude Code ecosystem upgrade. Plugins, skills, sub-agents, MCP servers, and agentic workflows. Curated by WVB.',
  authors: [{ name: 'Wilt Venture Builder', url: 'https://www.wiltvb.com' }],
  keywords: [
    'Claude Code',
    'AI agents',
    'MCP',
    'Model Context Protocol',
    'bkit',
    'vibe coding',
    'WVB',
  ],
  openGraph: {
    title: 'wvb-cc-radar',
    description: 'Daily Claude Code ecosystem radar by WVB',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'wvb-cc-radar',
    description: 'Daily Claude Code ecosystem radar by WVB',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="relative min-h-screen">
          <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" />
          <div className="relative z-10">
            <Header />
            <main className="max-w-6xl mx-auto px-4 md:px-6 pb-24">{children}</main>
            <footer className="max-w-6xl mx-auto px-4 md:px-6 py-10 border-t border-bg-border mt-16 text-fg-dim text-sm">
              <div className="flex flex-col md:flex-row justify-between gap-3">
                <div>
                  <span className="text-fg-muted">wvb-cc-radar</span>{' '}
                  <span className="text-accent-teal">·</span> curated by{' '}
                  <a
                    href="https://www.wiltvb.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-teal hover:text-accent-gold"
                  >
                    Wilt Venture Builder
                  </a>
                </div>
                <div className="flex gap-4">
                  <a href="/archive" className="hover:text-accent-teal">
                    archive
                  </a>
                  <a href="/api/rss" className="hover:text-accent-teal">
                    rss
                  </a>
                  <a href="/about" className="hover:text-accent-teal">
                    about
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
