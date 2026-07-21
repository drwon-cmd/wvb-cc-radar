/**
 * Central site constants. SITE_URL falls back to the production Railway URL
 * (previously hardcoded inline in app/api/rss/route.ts) when
 * NEXT_PUBLIC_SITE_URL is not set.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://wvb-cc-radar.up.railway.app';

export const SITE_NAME = 'wvb-cc-radar';

export const SITE_DESCRIPTION =
  'Daily digest of trending GitHub repositories for Claude Code ecosystem upgrade. Plugins, skills, sub-agents, MCP servers, and agentic workflows. Curated by WVB.';
