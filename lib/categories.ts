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
    id: 'vibe-coding',
    title: 'Vibe Coding 도구',
    subtitle: 'Cursor·Bolt·Lovable·v0 계열 대안, AI IDE, 비개발자 코딩',
    top_n: 10,
    priority: 2,
  },
  {
    id: 'enterprise-ax',
    title: 'Enterprise AX · FDE',
    subtitle: 'Forward Deployed Engineer 모델, 기업 AI 전환 프레임워크',
    top_n: 10,
    priority: 3,
  },
  {
    id: 'rag-kb',
    title: 'RAG · 지식 베이스',
    subtitle: 'LLM knowledge base, retrieval-augmented generation, wiki 자동화',
    top_n: 10,
    priority: 4,
  },
  {
    id: 'agent-orchestration',
    title: 'Agent Orchestration · Router',
    subtitle: 'Multi-agent coordinator, handoff patterns, agent routing',
    top_n: 10,
    priority: 5,
  },
  {
    id: 'mcp-servers',
    title: 'MCP 서버·도구',
    subtitle: 'Model Context Protocol servers & tools (CC-compatible)',
    top_n: 10,
    priority: 6,
  },
  {
    id: 'ai-agents',
    title: 'AI 에이전트 프레임워크',
    subtitle: 'LangGraph · CrewAI · AutoGen · multi-agent framework',
    top_n: 10,
    priority: 7,
  },
  {
    id: 'llm-prompts',
    title: 'LLM 프롬프트·워크플로우',
    subtitle: 'Prompt engineering · agentic workflows · LLM-native dev',
    top_n: 10,
    priority: 8,
  },
];

export function getCategoryById(id: CategoryId): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
