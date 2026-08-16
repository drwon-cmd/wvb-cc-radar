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
          GitHub Search API per category, keeps the top-N by stars <em>plus up to 5 reserved
          slots for repos created in the last 120 days</em> (so young projects can enter a pool
          whose queries otherwise floor at 500–50,000 stars), calculates 24h/7d star deltas vs the
          prior snapshots, and commits the result to the repository as{' '}
          <code className="text-accent-teal bg-bg-panel px-1 rounded">data/YYYY-MM-DD.json</code>.
          Railway auto-rebuilds the Next.js site on each push.
        </p>

        <h2 className="text-xl font-semibold pt-4 text-accent-teal">세 가지 화면</h2>
        <p>
          같은 데이터를 세 가지 질문으로 나눠 봅니다. 예전에는 일간·주간이 모두{' '}
          <em>절대 스타 증가량</em>으로 정렬돼서, 덩치가 큰 레포가 평소 속도로만 성장해도
          작은 레포의 폭발적 성장을 눌렀습니다. 그래서 두 화면의 상위권이 거의 같았고 몇 달째
          바뀌지 않았습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-fg-muted">
          <li>
            <a href="/" className="text-accent-teal hover:underline font-semibold">일간</a>{' '}
            — 오늘 급상승. 각 레포의 <em>자체 28일 평균 대비</em> 24시간 가속도로 정렬.
          </li>
          <li>
            <a href="/weekly" className="text-accent-teal hover:underline font-semibold">주간</a>{' '}
            — 이번 주 신규 인기. 같은 방식을 7일 누적에 적용.
          </li>
          <li>
            <a href="/steady" className="text-accent-gold hover:underline font-semibold">스테디셀러</a>{' '}
            — 최근 60일 중 40일 이상 카테고리 상위 5위를 지킨 레포. 일간·주간에서는 제외됩니다.
          </li>
          <li>
            <a href="/top" className="text-accent-gold hover:underline font-semibold">All-time</a>{' '}
            — 누적 스타 순 (변경 없음).
          </li>
        </ul>
        <p className="text-fg-dim text-sm">
          가속도 = (24시간 증가 + 25) ÷ (자체 28일 일평균 + 25). 1.0이면 평소 속도, 그 이상이면
          가속 중입니다. 분모·분자에 더한 상수 25는 스타가 0→4로 늘어난 레포가 무한대 배율을
          받는 것을 막습니다.
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
          <li><span className="inline-block bg-accent-teal text-bg-darkest font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-sm">▲ N.Nx</span> — 자체 28일 평균 대비 가속도 (1.15배 이상일 때만 표시)</li>
          <li><span className="inline-block bg-accent-teal-glow text-accent-teal border border-accent-teal-dim font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-sm">RISER</span> — 최근 21일 안에 추적 대상에 새로 진입</li>
          <li><span className="inline-block bg-bg-elevated text-fg-muted border border-fg-dim/30 font-mono text-xs uppercase tracking-wider px-2 py-0.5 rounded-sm">STEADY Nd</span> — 60일 중 상위 5위를 지킨 일수</li>
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
