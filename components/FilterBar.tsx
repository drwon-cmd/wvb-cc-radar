'use client';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  language: string;
  onLanguageChange: (v: string) => void;
  languages: string[];
  wvbOnly: boolean;
  onWvbOnlyChange: (v: boolean) => void;
}

/**
 * Presentational filter controls for FilterableDigest: text search, language
 * dropdown, and a "WVB uses" toggle. Owns no state itself — the parent client
 * component holds it so the filtering logic stays in one place.
 */
export default function FilterBar({
  search,
  onSearchChange,
  language,
  onLanguageChange,
  languages,
  wvbOnly,
  onWvbOnlyChange,
}: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 bg-bg-panel border border-bg-border rounded-md p-3">
      <div className="flex-1 min-w-[180px]">
        <label htmlFor="repo-search" className="sr-only">
          레포 검색
        </label>
        <input
          id="repo-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름·설명으로 검색..."
          className="w-full bg-bg-darker border border-bg-border rounded-sm px-3 py-1.5 text-sm text-fg-primary placeholder:text-fg-dim font-mono focus:border-accent-teal-dim outline-none"
        />
      </div>

      <div>
        <label htmlFor="repo-language" className="sr-only">
          언어 필터
        </label>
        <select
          id="repo-language"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-bg-darker border border-bg-border rounded-sm px-2 py-1.5 text-xs text-fg-muted font-mono focus:border-accent-teal-dim outline-none"
        >
          <option value="">모든 언어</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs font-mono text-fg-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wvbOnly}
          onChange={(e) => onWvbOnlyChange(e.target.checked)}
          className="accent-accent-gold w-3.5 h-3.5"
        />
        WVB uses만
      </label>
    </div>
  );
}
