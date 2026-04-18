export const dynamic = 'force-static';

export default function AboutPage() {
  return (
    <div className="py-10 max-w-3xl">
      <span className="font-mono text-xs text-accent-teal uppercase tracking-widest">About</span>
      <h1 className="text-4xl font-bold mt-2 mb-6">wvb-cc-radar</h1>

      <div className="prose prose-invert max-w-none text-fg-primary space-y-5 text-sm md:text-base leading-relaxed">
        <p>
          <span className="text-accent-teal font-semibold">wvb-cc-radar</span> is a daily digest of
          trending GitHub repositories for the Claude Code ecosystem. It is curated by{' '}
          <a href="https://www.wiltvb.com" target="_blank" rel="noopener noreferrer" className="text-accent-gold hover:underline">
            Wilt Venture Builder
          </a>{' '}
          to surface tools, plugins, sub-agents, and workflows that materially improve AI-native
          development.
        </p>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">How it works</h2>
        <p>
          A GitHub Actions cron runs daily at 00:00 UTC (09:00 KST). A Python script queries the
          GitHub Search API for four categories, ranks by stars, calculates 24h star delta vs the
          prior snapshot, and commits the result to the repository as{' '}
          <code className="text-accent-teal bg-bg-panel px-1 rounded">data/YYYY-MM-DD.json</code>.
          Railway auto-rebuilds the Next.js site on each push.
        </p>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">Categories (priority)</h2>
        <ol className="list-decimal list-inside space-y-1 text-fg-muted">
          <li>
            <span className="text-fg-primary font-semibold">Claude Code 생태계</span> — plugins, skills, sub-agents, hooks, workflows (Top 30)
          </li>
          <li>MCP 서버·도구 (Top 10)</li>
          <li>AI 에이전트 프레임워크 (Top 10)</li>
          <li>LLM 프롬프트·워크플로우 (Top 10)</li>
        </ol>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">Stack</h2>
        <ul className="list-disc list-inside space-y-1 text-fg-muted">
          <li>Next.js 14 App Router · TypeScript · Tailwind</li>
          <li>Python stdlib fetcher (no pip deps)</li>
          <li>GitHub Actions cron (free) + Railway Hobby (~$3-5/mo)</li>
          <li>Data committed to Git for free history and rollback</li>
        </ul>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">Signals</h2>
        <ul className="list-disc list-inside space-y-1 text-fg-muted">
          <li><span className="inline-block bg-accent-gold text-bg-darkest font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-sm">NEW</span> — created within 7 days</li>
          <li><span className="inline-block bg-accent-gold/10 text-accent-gold border border-accent-gold-dim font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-sm">WVB uses</span> — actively used by WVB team</li>
          <li><span className="text-accent-teal font-mono text-xs">+NNN/24h</span> — star delta vs previous snapshot</li>
        </ul>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">Contact</h2>
        <p>
          <a href="https://www.wiltvb.com" target="_blank" rel="noopener noreferrer" className="text-accent-gold hover:underline">wiltvb.com</a>{' '}
          · Internal tool, public viewing welcomed.
        </p>
      </div>
    </div>
  );
}
