export type CategoryId =
  | 'claude-code'
  | 'vibe-coding'
  | 'enterprise-ax'
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
  forks_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  updated_at: string;
  opengraph_url: string;
  is_new_this_week?: boolean;
  wvb_uses?: boolean;
  /** Set by fetch.py when owner appears in data/korean-owners.json. */
  korean_owner?: boolean;
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
  };
}
