import { useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CodeBlock, CodeComment } from "@/components/CodeBlock";

const GitHubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 8h10M9 4l4 4-4 4" />
  </svg>
);

const TABS = {
  overview: { label: "Overview", url: "localhost:3000 — Overview", img: "ui-overview.png" },
  blueprint: { label: "Blueprint", url: "localhost:3000 — Blueprint", img: "ui-blueprint-panel.png" },
  nodeInspect: { label: "Node inspect", url: "localhost:3000 — Graph", img: "ui-node-inspection.png" },
  cli: { label: "CLI scan", url: "Terminal — dgat scan", img: "dgat-scan-cli.png" },
  depGraphBuild: { label: "Dep graph build", url: "localhost:3000 — Graph", img: "dgat-dep-graph-build.png" },
  vllm: { label: "vLLM", url: "Terminal — vLLM server", img: "vllm-server-running.png" },
};

function HeroGraph() {
  return (
    <div className="bg-surface border border-dgat-border rounded-xl overflow-hidden fade-in d2">
      <div className="px-3.5 py-2.5 border-b border-dgat-border flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        <span className="font-mono text-[11px] text-dgat-subtle ml-1">dgat — dependency graph</span>
      </div>
      <svg className="block w-full h-auto" viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">
        <rect className="fill-raised" width="480" height="320" />
        <defs>
          <pattern id="grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle className="fill-dgat-border" cx="0" cy="0" r="0.8" opacity="0.5" />
            <circle className="fill-dgat-border" cx="24" cy="0" r="0.8" opacity="0.5" />
            <circle className="fill-dgat-border" cx="0" cy="24" r="0.8" opacity="0.5" />
            <circle className="fill-dgat-border" cx="24" cy="24" r="0.8" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="480" height="320" fill="url(#grid)" />
        <g>
          {[
            [195,160,72,88],[195,160,68,160],[195,160,72,232],[195,160,148,272],
            [195,160,310,100],[310,100,388,58],[310,100,392,118],[310,100,384,180],
            [388,58,448,88],[392,118,448,88],[392,118,448,152],[384,180,448,152],
            [384,180,448,220],[310,200,448,220],[310,100,310,200],[388,248,448,280],
            [384,180,388,248],
          ].map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-dgat-border2" strokeWidth="1" fill="none" opacity="0.7" />
          ))}
        </g>
        {[
          { cx:195,cy:160,r:10,cls:"fill-dgat-text",label:"dgat.cpp",main:true },
          { cx:72,cy:88,r:6,cls:"fill-dgat-muted",label:"httplib.h" },
          { cx:68,cy:160,r:6,cls:"fill-dgat-muted",label:"json.hpp" },
          { cx:72,cy:232,r:5,cls:"fill-dgat-muted",label:"xxhash.h" },
          { cx:148,cy:272,r:4.5,cls:"fill-dgat-subtle",label:"inja.hpp" },
          { cx:310,cy:100,r:8,cls:"fill-dgat-text",label:"page.tsx",main:true },
          { cx:388,cy:58,r:5.5,cls:"fill-dgat-muted",label:"GraphView" },
          { cx:392,cy:118,r:5.5,cls:"fill-dgat-muted",label:"FileTree" },
          { cx:384,cy:180,r:5.5,cls:"fill-dgat-muted",label:"MarkdownPanel" },
          { cx:310,cy:200,r:5.5,cls:"fill-dgat-muted",label:"layout.tsx" },
          { cx:388,cy:248,r:5,cls:"fill-dgat-muted",label:"GraphNodePanel" },
          { cx:448,cy:88,r:4.5,cls:"fill-dgat-subtle",label:"types.ts" },
          { cx:448,cy:152,r:4.5,cls:"fill-dgat-subtle",label:"utils.ts" },
          { cx:448,cy:220,r:4.5,cls:"fill-dgat-subtle",label:"theme.json" },
          { cx:448,cy:280,r:4,cls:"fill-dgat-subtle",label:"fileIcons.ts" },
        ].map((n, i) => (
          <g key={i}>
            <circle cx={n.cx} cy={n.cy} r={n.r} className={n.cls} style={{ animation: `node-breathe 3s ease-in-out ${i * 0.3}s infinite` }} />
            <text x={n.cx} y={n.cy + n.r + 12} textAnchor="middle" className={`font-mono text-[8px] fill-dgat-muted ${n.main ? "text-[9px] fill-dgat-text font-medium" : ""}`}>{n.label}</text>
          </g>
        ))}
        <text x="14" y="308" className="font-mono text-[9px] fill-dgat-subtle">27 nodes · 44 edges · Qwen3.5-2B</text>
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<keyof typeof TABS>("overview");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText("git clone https://github.com/HyperKuvid-Labs/dgat");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="[&_p]:text-[1.06em] [&_a]:text-[1.06em] [&_button]:text-[1.06em] [&_code]:text-[1.06em] [&_span]:text-[1.04em]">
      <Navbar variant="home" />

      {/* Hero */}
      <section className="pt-[120px] pb-20 border-b border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10 grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-raised border border-dgat-border2 rounded-full py-1 pl-2 pr-3 text-[12px] font-semibold text-dgat-muted tracking-wide mb-5 fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-dgat-text" />
              Open source · MIT License
            </div>
            <h1 className="font-heading text-[clamp(38px,4.5vw,60px)] font-extrabold text-dgat-text mb-[18px] fade-in d1">
              Map your code's<br />hidden architecture.
            </h1>
            <p className="text-base text-dgat-muted leading-[1.7] max-w-[440px] mb-8 fade-in d2">
              Point DGAT at any codebase. It walks the file tree, fingerprints every file, runs them through a local LLM, and serves a fully-annotated dependency graph — no config, no annotations, no manual work.
            </p>
            <div className="flex gap-2.5 flex-wrap mb-7 fade-in d3">
              <a
                href="https://github.com/HyperKuvid-Labs/dgat"
                className="bg-dgat-text text-background font-semibold text-sm py-2.5 px-5 rounded-[7px] no-underline border-none cursor-pointer inline-flex items-center gap-[7px] transition-opacity hover:opacity-80"
                target="_blank"
                rel="noopener"
              >
                <GitHubIcon />
                View on GitHub
              </a>
              <Link
                to="/examples"
                className="bg-transparent text-dgat-text font-medium text-sm py-2.5 px-5 rounded-[7px] no-underline border border-dgat-border2 cursor-pointer inline-flex items-center gap-[7px] transition-all hover:bg-raised hover:border-dgat-subtle"
              >
                See live examples
                <ArrowIcon />
              </Link>
            </div>
            <div className="inline-flex items-center bg-surface border border-dgat-border rounded-[7px] overflow-hidden fade-in d4">
              <span className="py-2 px-3 bg-raised border-r border-dgat-border font-mono text-[12px] text-dgat-subtle">$</span>
              <code className="py-2 px-3.5 text-[12px] text-dgat-text whitespace-nowrap">git clone https://github.com/HyperKuvid-Labs/dgat</code>
              <button
                onClick={handleCopy}
                className="py-2 px-2.5 bg-transparent border-none border-l border-dgat-border text-dgat-subtle cursor-pointer transition-all hover:text-dgat-text hover:bg-raised"
              >
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8l3 3 5-5" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="4" y="4" width="9" height="9" rx="1.5" />
                    <path d="M3 12H2.5A1.5 1.5 0 011 10.5v-7A1.5 1.5 0 012.5 2h7A1.5 1.5 0 0111 3.5V4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            <HeroGraph />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-[88px]">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-text opacity-40 mb-2.5">How it works</div>
          <h2 className="font-heading text-[clamp(26px,3vw,40px)] font-extrabold text-dgat-text mb-3.5">From source to graph in one command</h2>
          <p className="text-[15px] text-dgat-muted max-w-[750px] leading-[1.7] mb-[52px]">DGAT handles everything — parsing, fingerprinting, LLM description, and graph construction — in a single pass. Refer <a href="/internals" className="text-dgat-text underline underline-offset-2 hover:opacity-80 transition-opacity">internals</a> for more info on design and architecture decisions</p>
          <div className="grid grid-cols-1 md:grid-cols-3 border border-dgat-border rounded-[10px] overflow-hidden">
            {[
              {
                num: "— 01",
                icon: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14l3 3-3 3M3 17h7" />,
                title: "Scan & Fingerprint",
                desc: <>Walks the directory tree, fingerprints every file with XXH3-128, and respects <code>.gitignore</code> and <code>.dgatignore</code> patterns.</>,
                tag: "tree-sitter + regex",
              },
              {
                num: "— 02",
                icon: <><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" /><path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8L5 17z" opacity="0.5" /></>,
                title: "Describe with LLM",
                desc: "Sends each file and each import relationship to a local vLLM instance. Every node and edge gets a plain-English description. No cloud, no API keys.",
                tag: "vLLM · OpenAI-compat",
              },
              {
                num: "— 03",
                icon: <><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><line x1="7.5" y1="11" x2="16.5" y2="6.5" /><line x1="7.5" y1="13" x2="16.5" y2="17.5" /></>,
                title: "Visualize & Explore",
                desc: "Serves the graph through a three-panel UI: file explorer, interactive WebGL graph with Sigma.js, and an inspector showing dependencies and descriptions.",
                tag: "Next.js · Sigma.js",
              },
            ].map((step, i) => (
              <div key={i} className={`p-8 ${i < 2 ? "border-r border-dgat-border max-md:border-r-0 max-md:border-b" : ""}`}>
                <div className="font-mono text-[11px] text-dgat-subtle mb-6 tracking-wide">{step.num}</div>
                <div className="w-9 h-9 rounded-lg bg-raised border border-dgat-border flex items-center justify-center text-dgat-muted mb-4">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{step.icon}</svg>
                </div>
                <h3 className="font-heading text-base font-bold text-dgat-text mb-2">{step.title}</h3>
                <p className="text-[13.5px] text-dgat-muted leading-[1.6]">{step.desc}</p>
                <span className="inline-block mt-3.5 font-mono text-[10.5px] py-0.5 px-2 rounded bg-dgat-tag border border-dgat-border text-dgat-muted">{step.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-[88px] border-t border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-text opacity-40 mb-2.5">Features</div>
          <h2 className="font-heading text-[clamp(26px,3vw,40px)] font-extrabold text-dgat-text mb-3.5">Everything you need to understand a codebase</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border border-dgat-border rounded-[10px] overflow-hidden">
            {[
              {
                icon: <><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" /><path d="M9 12l2 2 4-4" /></>,
                title: "Multi-language extraction",
                desc: "Tree-sitter grammars for precision, regex fallback for everything else.",
                pills: ["C++", "TypeScript", "Python", "Go", "Rust", "Java", "C#", "CUDA"],
              },
              {
                icon: <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="12" cy="19" r="2" /><line x1="7" y1="5" x2="17" y2="5" /><line x1="6" y1="6.5" x2="11" y2="17.5" /><line x1="18" y1="6.5" x2="13" y2="17.5" /></>,
                title: "LLM-annotated graph",
                desc: "Every file and every dependency edge gets a natural-language description generated locally by Qwen3.5-2B.",
              },
              {
                icon: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>,
                title: "Project blueprint",
                desc: <>Synthesises a <code>dgat_blueprint.md</code> — a bottom-up architectural overview built from all file descriptions.</>,
              },
              {
                icon: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
                title: "Incremental updates",
                desc: <><code>dgat update</code> re-describes only files whose XXH3 fingerprint changed. Large codebases stay fast.</>,
              },
              {
                icon: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
                title: "Static export",
                desc: "Embed the entire graph into a single self-contained HTML file. Share with anyone — no server, no build step.",
              },
              {
                icon: <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></>,
                title: "Live UI",
                desc: "Auto-refreshes every 30 seconds. File explorer, blueprint / graph tabs, and a click-through inspector.",
              },
            ].map((feat, i) => (
              <div key={i} className="p-7 border-r border-b border-dgat-border transition-colors hover:bg-raised last:border-r-0 [&:nth-child(3n)]:border-r-0 [&:nth-child(n+4)]:border-b-0 max-sm:border-r-0">
                <div className="w-9 h-9 rounded-lg bg-raised border border-dgat-border flex items-center justify-center text-dgat-muted mb-3.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">{feat.icon}</svg>
                </div>
                <h3 className="font-heading text-[15px] font-bold text-dgat-text mb-[7px]">{feat.title}</h3>
                <p className="text-[13.5px] text-dgat-muted leading-[1.6]">{feat.desc}</p>
                {feat.pills && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {feat.pills.map(p => (
                      <span key={p} className="font-mono text-[10px] py-0.5 px-1.5 rounded bg-dgat-tag border border-dgat-border text-dgat-muted">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section id="get-started" className="py-[88px] border-t border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-text opacity-40 mb-2.5">Get started</div>
          <h2 className="font-heading text-[clamp(26px,3vw,40px)] font-extrabold text-dgat-text mb-3.5">Not on npm. Not on Homebrew. Clone it.</h2>
          <p className="text-[15px] text-dgat-muted max-w-[480px] leading-[1.7] mb-[52px]">DGAT isn't a package yet — it's a project you build and run yourself. Three steps to get going.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="flex flex-col">
                {[
                  { num: "01", title: "Clone & build", code: <>git clone https://github.com/HyperKuvid-Labs/dgat<br/>cd dgat<br/>cmake -B build && cmake --build build -j$(nproc)<br/><CodeComment># or: bash install.sh</CodeComment></> },
                  { num: "02", title: "Start vLLM", code: <><CodeComment># any OpenAI-compatible endpoint works</CodeComment><br/>vllm serve Qwen/Qwen3.5-2B --port 8000</> },
                  { num: "03", title: "Run on your project", code: <>./build/dgat /path/to/your/project<br/><CodeComment># copy the output files:</CodeComment><br/>cp file_tree.json dep_graph.json dgat_blueprint.md renderwise-forge-main/public/examples/your-project/<br/><CodeComment># then run the frontend:</CodeComment><br/>cd renderwise-forge-main && bun dev<br/><CodeComment># → http://localhost:3000/examples/your-project</CodeComment><br/><span className="text-dgat-text font-semibold">🙂 or submit a PR — we'll merge it for you!</span></> },
                ].map((step, i) => (
                  <div key={i} className={`grid grid-cols-[28px_1fr] gap-4 py-5 ${i < 2 ? "border-b border-dgat-border" : ""} ${i === 0 ? "pt-0" : ""}`}>
                    <div className="font-mono text-[11px] text-dgat-subtle pt-1 tracking-wide">{step.num}</div>
                    <div>
                      <h4 className="text-sm font-semibold text-dgat-text mb-2.5">{step.title}</h4>
                      <CodeBlock>{step.code}</CodeBlock>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="p-7 bg-surface border border-dgat-border rounded-[10px]">
                <div className="font-heading text-lg font-bold text-dgat-text mb-1.5">Requirements</div>
                <div className="text-[13px] text-dgat-muted mb-5 leading-[1.6]">You'll need these installed before building. The frontend is optional — the backend serves a static HTML export too.</div>
                <div className="flex flex-col gap-2">
                  {[
                    "C++17 compiler — GCC 11+ or Clang 14+",
                    "CMake 3.16+",
                    <>vLLM (or any <code className="text-[12px] text-dgat-text">OpenAI-compat</code> endpoint) on localhost</>,
                    "Node.js 18+ or Bun (frontend only)",
                  ].map((req, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-[13.5px] text-dgat-muted">
                      <span className="w-[5px] h-[5px] rounded-full bg-dgat-subtle flex-shrink-0" />
                      {req}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-raised border border-dgat-border rounded-lg">
                <div className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-dgat-text mb-1.5">Coming soon</div>
                <p className="text-[13px] text-dgat-muted leading-[1.6]">Support for OpenAI, Anthropic, Ollama, and any OpenAI-compatible endpoint — configurable via a single flag.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo */}
      <section className="py-[88px] border-t border-dgat-border bg-surface">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-text opacity-40 mb-2.5">Demo</div>
          <h2 className="font-heading text-[clamp(26px,3vw,40px)] font-extrabold text-dgat-text mb-3.5">See it in action</h2>
          <p className="text-[15px] text-dgat-muted max-w-[750px] leading-[1.7] mb-5">Screenshots from DGAT scanning <a href="https://github.com/NousResearch/hermes-agent" className="text-dgat-text underline underline-offset-2 hover:opacity-80 transition-opacity" target="_blank" rel="noopener noreferrer"><b>NousResearch/hermes-agent</b></a>. Check out the examples page — latest is <a href="/examples/thunder-kittens" className="text-dgat-text underline underline-offset-2 hover:opacity-80 transition-opacity"><b>HazyResearch/ThunderKitten</b></a></p>
          <div className="flex border border-dgat-border rounded-lg overflow-hidden w-fit mb-5 flex-wrap">
            {(Object.keys(TABS) as Array<keyof typeof TABS>).map(key => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`py-[7px] px-4 text-[13px] font-medium border-r border-dgat-border last:border-r-0 cursor-pointer transition-all ${activeTab === key ? "bg-raised text-dgat-text" : "bg-surface text-dgat-muted hover:bg-raised hover:text-dgat-text"}`}
              >
                {TABS[key].label}
              </button>
            ))}
          </div>
          <div className="border border-dgat-border rounded-[10px] overflow-hidden bg-background">
            <img
              src={`/${TABS[activeTab].img}`}
              alt={`DGAT ${TABS[activeTab].label} screenshot`}
              className="w-full h-auto rounded-[10px]"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Examples Callout */}
      <section className="py-[88px] border-t border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="bg-dgat-invert-bg text-dgat-invert-text rounded-xl p-[52px] grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <div className="inline-block border border-white/20 rounded-full py-1 px-3 font-mono text-[11px] text-dgat-invert-text opacity-50 mb-3.5">live demo — dgat on dgat</div>
              <div className="font-heading text-[28px] font-extrabold leading-[1.15] text-dgat-invert-text mb-2.5 tracking-tight">Explore a real analysis</div>
              <p className="text-[15px] text-dgat-invert-text opacity-55 leading-[1.65] max-w-[480px]">Browse the full dependency graph of DGAT's own source tree — 27 nodes, 44 edges, every file and import described by Qwen3.5-2B. Generated entirely locally.</p>
              <div className="flex items-center gap-1.5 mt-3">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dgat-invert-text opacity-35 flex-shrink-0">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5M8 10.5v.5" />
                </svg>
                <span className="font-mono text-[9.5px] text-dgat-invert-text opacity-35 leading-tight">AI-generated descriptions · may contain inaccuracies</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 flex-shrink-0">
              <Link to="/examples/dgat-self" className="bg-dgat-invert-text text-dgat-invert-bg font-semibold text-sm py-2.5 px-5 rounded-[7px] no-underline whitespace-nowrap inline-flex items-center gap-[7px] transition-opacity hover:opacity-80">
                Open live example
                <ArrowIcon />
              </Link>
              <Link to="/examples" className="bg-transparent text-dgat-invert-text font-medium text-sm py-2.5 px-5 rounded-[7px] no-underline whitespace-nowrap border border-white/20 inline-flex items-center gap-[7px] transition-all opacity-65 hover:opacity-100">
                Browse all examples
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Alpha-stack */}
      <section className="py-[88px] border-t border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10">
          <div className="border border-dgat-border rounded-xl p-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
              <div className="font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-dgat-subtle mb-3">Part of a larger initiative</div>
              <div className="font-heading text-[22px] font-bold text-dgat-text mb-2.5 tracking-tight">Building a harness for long-form coding agents</div>
              <p className="text-sm text-dgat-muted leading-[1.7] max-w-[500px]">
                DGAT is one piece of <strong>alpha-stack</strong> — a project building infrastructure for AI agents tackling large, long-form programming tasks. The goal: give agents a structured map of any codebase so they can reason about architecture, dependencies, and change impact at scale — not just individual files.
              </p>
            </div>
            <a
              href="https://github.com/HyperKuvid-Labs/alpha-stack"
              className="inline-flex items-center gap-2 bg-raised border border-dgat-border2 text-dgat-text text-[13px] font-semibold py-2.5 px-4 rounded-[7px] no-underline whitespace-nowrap transition-all hover:bg-dgat-tag hover:border-dgat-subtle flex-shrink-0"
              target="_blank"
              rel="noopener"
            >
              <GitHubIcon />
              HyperKuvid-Labs/alpha-stack
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
