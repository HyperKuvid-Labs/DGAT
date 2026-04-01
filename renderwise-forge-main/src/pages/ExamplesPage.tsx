import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SvgGraphPlaceholder } from "@/components/SvgGraphPlaceholder";
import type { ExampleConfig, ConfigData } from "@/lib/types";

export default function ExamplesPage() {
  const [examples, setExamples] = useState<ExampleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/config.json")
      .then(r => r.json())
      .then((data: ConfigData) => { setExamples(data.examples); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar variant="examples" />

      {/* Page Header */}
      <div className="py-[52px] pb-10 border-b border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-subtle mb-2.5">Examples</div>
          <h1 className="font-heading text-[clamp(26px,3.5vw,40px)] font-extrabold text-dgat-text mb-3">Real codebases, fully mapped</h1>
          <p className="text-[15px] text-dgat-muted max-w-[520px] leading-[1.7]">Each entry below is a codebase run through DGAT. Browse its dependency graph, architectural blueprint, and file descriptions — all generated locally.</p>
        </div>
      </div>

      {/* Cards */}
      <main className="max-w-[1100px] mx-auto px-10 py-11 pb-20">
        {loading ? (
          <div className="text-center py-20 text-dgat-muted">Loading examples...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {examples.map((repo, idx) => (
              <Link
                key={repo.id}
                to={`/examples/${repo.id}`}
                className="bg-surface border border-dgat-border rounded-[10px] overflow-hidden flex flex-col no-underline text-inherit transition-all hover:border-dgat-border2 hover:shadow-lg hover:-translate-y-0.5 group"
              >
                {/* Image slot */}
                <div className="h-[172px] overflow-hidden relative bg-raised border-b border-dgat-border flex-shrink-0">
                  {repo.image ? (
                    <img src={repo.image} alt={`${repo.name} preview`} className="w-full h-full object-cover object-top" />
                  ) : (
                    <SvgGraphPlaceholder seed={idx + 1} width={300} height={172} />
                  )}
                </div>

                {/* Body */}
                <div className="p-[18px] flex-1 flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2.5">
                    <div>
                      <div className="font-heading text-base font-bold text-dgat-text leading-tight">{repo.name}</div>
                      {repo.model && <div className="font-mono text-[10.5px] text-dgat-subtle">✦ {repo.model}</div>}
                    </div>
                    <div className="flex gap-1 flex-wrap flex-shrink-0">
                      {repo.langs.map(l => (
                        <span key={l} className="font-mono text-[10px] py-0.5 px-1.5 rounded bg-dgat-tag border border-dgat-border text-dgat-muted">{l}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[13.5px] text-dgat-muted leading-[1.55] flex-1">{repo.description}</p>
                  <div className="flex gap-3.5 pt-2.5 border-t border-dgat-border">
                    <div className="text-[12px] text-dgat-subtle flex items-baseline gap-1">
                      <span className="font-mono text-[13px] text-dgat-text font-medium">{repo.stats.nodes}</span> nodes
                    </div>
                    <div className="text-[12px] text-dgat-subtle flex items-baseline gap-1">
                      <span className="font-mono text-[13px] text-dgat-text font-medium">{repo.stats.edges}</span> edges
                    </div>
                    {repo.langs.length > 0 && (
                      <div className="text-[12px] text-dgat-subtle flex items-baseline gap-1">
                        <span className="font-mono text-[13px] text-dgat-text font-medium">{repo.langs[0]}</span>
                        {repo.langs[1] && <> · <span className="font-mono text-[13px] text-dgat-text font-medium">{repo.langs[1]}</span></>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-[18px] pb-[18px]">
                  <div className="flex items-center justify-between bg-raised border border-dgat-border rounded-md py-2.5 px-3.5 transition-all group-hover:bg-dgat-tag group-hover:border-dgat-border2">
                    <span className="text-[13px] font-semibold text-dgat-text">Open in DGAT explorer</span>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-dgat-muted">
                      <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}

            {/* Add more card */}
            <div className="border-2 border-dashed border-dgat-border rounded-[10px] flex flex-col items-center justify-center gap-3.5 p-10 text-dgat-subtle min-h-[280px] transition-all hover:border-dgat-border2 hover:text-dgat-muted">
              <div className="w-10 h-10 rounded-lg bg-raised border border-dgat-border flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-[13px] text-center leading-[1.6]">
                Run <code className="text-[11.5px] text-dgat-text bg-dgat-tag px-1 py-0.5 rounded">dgat /your/repo</code> and add the exported page here.<br />
                Then add an entry to the <code className="text-[11.5px] text-dgat-text bg-dgat-tag px-1 py-0.5 rounded">config.json</code>.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
