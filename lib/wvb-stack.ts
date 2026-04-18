/**
 * WVB actively uses these repos. RepoCard will show "WVB uses" badge.
 * Manually maintained - add when adopting new tools.
 */
export const WVB_STACK_REPOS: string[] = [
  'anthropics/claude-code',
  'anthropics/skills',
  'popup-studio-ai/bkit-claude-code',
  'modelcontextprotocol/servers',
];

const lowered = new Set(WVB_STACK_REPOS.map((s) => s.toLowerCase()));

export function isWvbStack(fullName: string): boolean {
  return lowered.has(fullName.toLowerCase());
}
