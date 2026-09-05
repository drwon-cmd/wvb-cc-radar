export type CategoryId =
  | 'claude-code'
  | 'vibe-coding'
  | 'vibecoded-products'
  | 'applications'
  | 'rag-kb'
  | 'agent-orchestration'
  | 'mcp-servers'
  | 'ai-agents'
  | 'llm-prompts'
  | 'korean-opensource';

export interface Repo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  description_ko?: string;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  stars_delta_24h?: number;
  /** Stars gained across the weekly baseline window (≤7 days).
   *  Actual window length is exposed in `delta_window_days`. */
  stars_delta_7d?: number;
  forks_delta_7d?: number;
  delta_window_days?: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  updated_at: string;
  opengraph_url: string;
  is_new_this_week?: boolean;
  /**
   * Steady/surge signals precomputed by scripts/fetch.py — the single source
   * of truth shared with the email digest. Optional because the 121 historical
   * digests predate them; lib/steady.ts falls back to computing its own when
   * they are absent.
   */
  steady_days?: number;
  is_steady?: boolean;
  is_riser?: boolean;
  surge_24h?: number;
  surge_7d?: number;
  baseline_daily_rate?: number;
  wvb_uses?: boolean;
  /** Set by fetch.py when owner appears in data/korean-owners.json. */
  korean_owner?: boolean;
  /**
   * Why this repo is on the page despite ranking below its category's stars
   * cut. Absent for the great majority, which got in on cumulative stars.
   * 'surge' means fetch.py spent one of its SURGE_SLOTS on it because it was
   * the fastest mover among the passed-over — see pick_surges() there.
   */
  entry_reason?: 'surge';
  /** Stars gained since the previous run, as measured at the moment the surge
   *  slot was awarded. Distinct from stars_delta_24h, which is recomputed for
   *  every repo afterwards; this one records what actually won the slot. */
  surge_entry_delta?: number;
}

export interface CategoryResult {
  category: CategoryId;
  title: string;
  subtitle: string;
  fetched_at: string;
  query: string;
  total_count: number;
  items: Repo[];
}

export interface DailyDigest {
  date: string;
  generated_at: string;
  categories: CategoryResult[];
  meta: {
    total_repos: number;
    total_new: number;
    fetch_duration_ms: number;
    rate_limit_remaining: number | null;
    /** Size of the "this week" window in days (0 on first-ever run). */
    weekly_window_days?: number;
    /** How many repos got a SURGE_SLOTS seat on 24h movement rather than on
     *  cumulative stars. 0 is expected on the first run after this shipped,
     *  because pool_stars did not exist yet to compare against. */
    total_surges?: number;
    /** {full_name: stars} for every repo fetch.py CONSIDERED, not just those
     *  it published — the baseline the next run needs to spot a below-cut repo
     *  that is climbing. Absent in snapshots written before 2026-09-05.
     *  Bookkeeping for the fetcher; the site does not read it. */
    pool_stars?: Record<string, number>;
  };
}
