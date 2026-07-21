'use client';

import { useRouter } from 'next/navigation';

interface Props {
  dates: string[];
  from: string;
  to: string;
}

/** Two date <select>s that navigate via ?from=&to= query params. */
export default function CompareForm({ dates, from, to }: Props) {
  const router = useRouter();

  function navigate(nextFrom: string, nextTo: string) {
    router.push(`/compare?from=${nextFrom}&to=${nextTo}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-4 bg-bg-panel border border-bg-border rounded-md p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label
          htmlFor="compare-from"
          className="block font-mono text-[11px] text-fg-dim uppercase tracking-widest mb-1"
        >
          기준일 (from)
        </label>
        <select
          id="compare-from"
          value={from}
          onChange={(e) => navigate(e.target.value, to)}
          className="bg-bg-darker border border-bg-border rounded-sm px-2 py-1.5 text-sm text-fg-primary font-mono focus:border-accent-teal-dim outline-none"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <span className="text-fg-dim font-mono text-sm pb-2">→</span>

      <div>
        <label
          htmlFor="compare-to"
          className="block font-mono text-[11px] text-fg-dim uppercase tracking-widest mb-1"
        >
          비교일 (to)
        </label>
        <select
          id="compare-to"
          value={to}
          onChange={(e) => navigate(from, e.target.value)}
          className="bg-bg-darker border border-bg-border rounded-sm px-2 py-1.5 text-sm text-fg-primary font-mono focus:border-accent-teal-dim outline-none"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
