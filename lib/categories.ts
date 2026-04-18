import type { CategoryId } from './types';

export interface CategoryConfig {
  id: CategoryId;
  title: string;
  subtitle: string;
  top_n: number;
  priority: number; // 1 = primary (hero)
}

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'claude-code',
    title: 'Claude Code 생태계',
    subtitle: 'Plugins · Skills · Sub-agents · Hooks · Workflows',
    top_n: 30,
    priority: 1,
  },
  {
    id: 'mcp-servers',
    title: 'MCP 서버·도구',
    subtitle: 'Model Context Protocol servers & tools (CC-compatible)',
    top_n: 10,
    priority: 2,
  },
  {
    id: 'ai-agents',
    title: 'AI 에이전트 프레임워크',
    subtitle: 'LangGraph · CrewAI · AutoGen · multi-agent patterns',
    top_n: 10,
    priority: 3,
  },
  {
    id: 'llm-prompts',
    title: 'LLM 프롬프트·워크플로우',
    subtitle: 'Prompt engineering · agentic workflows · LLM-native dev',
    top_n: 10,
    priority: 4,
  },
];

export function getCategoryById(id: CategoryId): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
