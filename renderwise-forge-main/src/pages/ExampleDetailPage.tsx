import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { GraphExplorer } from "@/components/GraphExplorer";
import type { ExampleConfig, ConfigData } from "@/lib/types";

export default function ExampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [example, setExample] = useState<ExampleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`)
      .then(r => r.json())
      .then((data: ConfigData) => {
        const found = data.examples.find(e => e.id === id);
        if (found) setExample(found);
        else setNotFound(true);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar variant="detail" title="Loading..." />
        <div className="text-center py-20 text-dgat-muted">Loading...</div>
      </>
    );
  }

  if (notFound || !example) {
    return (
      <>
        <Navbar variant="detail" title="Not Found" />
        <div className="text-center py-[60px] px-5">
          <h1 className="font-heading text-2xl font-bold text-dgat-text mb-3">Example Not Found</h1>
          <p className="text-dgat-muted mb-4">No example with ID "{id}"</p>
          <Link to="/examples" className="text-[#4F8EF7] no-underline">← Back to Examples</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar variant="detail" title={example.name} />

      <main className="max-w-[1400px] mx-auto px-10 py-8 pb-[60px]">
        {/* Repo Header */}
        <div className="bg-surface border border-dgat-border rounded-2xl p-7 mb-6">
          <div className="flex justify-between items-start gap-5 mb-4 max-md:flex-col">
            <h1 className="font-heading text-[28px] font-extrabold text-dgat-text leading-tight">{example.name}</h1>
            {(example.github || example.website || example.files) && (
              <div className="flex gap-2 flex-shrink-0 max-md:w-full">
                {example.github && (
                  <a href={example.github} className="flex items-center gap-1.5 py-2 px-3.5 bg-raised border border-dgat-border rounded-lg text-dgat-muted text-[13px] font-medium no-underline transition-all hover:text-dgat-text hover:border-dgat-border2 max-md:flex-1 max-md:justify-center" target="_blank" rel="noopener">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    GitHub
                  </a>
                )}
                {example.website && (
                  <a href={example.website} className="flex items-center gap-1.5 py-2 px-3.5 bg-raised border border-dgat-border rounded-lg text-dgat-muted text-[13px] font-medium no-underline transition-all hover:text-dgat-text hover:border-dgat-border2 max-md:flex-1 max-md:justify-center" target="_blank" rel="noopener">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
                    </svg>
                    Website
                  </a>
                )}
                {example.files && (
                  <div className="relative group">
                    <button className="flex items-center gap-1.5 py-2 px-3.5 bg-raised border border-dgat-border rounded-lg text-dgat-muted text-[13px] font-medium no-underline transition-all hover:text-dgat-text hover:border-dgat-border2 max-md:flex-1 max-md:justify-center">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 6l-3 3-3-3M8 9V2" />
                      </svg>
                      Download
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-0.5">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-surface border border-dgat-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
                      <a href={`${import.meta.env.BASE_URL}${example.files.basePath}/${example.files.tree}`} download className="flex items-center gap-2 py-2 px-3 text-[12px] text-dgat-muted hover:bg-raised hover:text-dgat-text no-underline">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 6l-3 3-3-3M8 9V2" /></svg>
                        file_tree.json
                      </a>
                      <a href={`${import.meta.env.BASE_URL}${example.files.basePath}/${example.files.depGraph}`} download className="flex items-center gap-2 py-2 px-3 text-[12px] text-dgat-muted hover:bg-raised hover:text-dgat-text no-underline">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 6l-3 3-3-3M8 9V2" /></svg>
                        dep_graph.json
                      </a>
                      <a href={`${import.meta.env.BASE_URL}${example.files.basePath}/${example.files.blueprint}`} download className="flex items-center gap-2 py-2 px-3 text-[12px] text-dgat-muted hover:bg-raised hover:text-dgat-text no-underline">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3M11 6l-3 3-3-3M8 9V2" /></svg>
                        blueprint.md
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[15px] text-dgat-muted leading-[1.7] max-w-[800px] mb-5">{example.description}</p>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-dgat-subtle uppercase tracking-wide">Nodes</span>
              <span className="font-mono text-sm font-medium text-dgat-text">{example.stats.nodes}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-dgat-subtle uppercase tracking-wide">Edges</span>
              <span className="font-mono text-sm font-medium text-dgat-text">{example.stats.edges}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-dgat-subtle uppercase tracking-wide">Languages</span>
              {example.langs.map(l => (
                <span key={l} className="inline-flex items-center gap-1 py-1 px-2.5 bg-dgat-tag border border-dgat-border rounded-md font-mono text-[12px] text-dgat-muted">{l}</span>
              ))}
            </div>
            {example.model && (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-dgat-subtle uppercase tracking-wide">Model</span>
                <span className="inline-flex items-center gap-1 py-1 px-2.5 bg-[rgba(79,142,247,0.1)] border border-[rgba(79,142,247,0.2)] rounded-md font-mono text-[12px] text-[#4F8EF7]">{example.model}</span>
              </div>
            )}
          </div>
        </div>

        {/* Graph Explorer */}
        <div className="bg-surface border border-dgat-border rounded-2xl overflow-hidden shadow-lg">
          <div className="flex items-center gap-2 px-4 py-3 bg-raised border-b border-dgat-border">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
            <span className="ml-2 text-[13px] text-dgat-muted font-medium">DGAT Explorer — {example.name}</span>
          </div>
          <GraphExplorer exampleId={example.id} files={example.files} />
        </div>
      </main>
    </>
  );
}
