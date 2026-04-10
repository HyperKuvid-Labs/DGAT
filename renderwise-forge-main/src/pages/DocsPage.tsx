import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import overviewContent from "@/docs/overview.md?raw";
import dependencyGraphContent from "@/docs/dependency-graph.md?raw";
import fileTreeContent from "@/docs/file-tree.md?raw";
import importExtractionContent from "@/docs/import-extraction.md?raw";
import incrementalUpdatesContent from "@/docs/incremental-updates.md?raw";
import pipPackageContent from "@/docs/pip-package.md?raw";

interface DocInfo {
  id: string;
  name: string;
  description: string;
}

function extractDescription(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      return trimmed.replace(/\*\*/g, "").slice(0, 180);
    }
  }
  return "";
}

const DOCS: DocInfo[] = [
  {
    id: "overview",
    name: "Overview",
    description: extractDescription(overviewContent),
  },
  {
    id: "file-tree",
    name: "File Tree",
    description: extractDescription(fileTreeContent),
  },
  {
    id: "dependency-graph",
    name: "Dependency Graph",
    description: extractDescription(dependencyGraphContent),
  },
  {
    id: "import-extraction",
    name: "Import Extraction",
    description: extractDescription(importExtractionContent),
  },
  {
    id: "incremental-updates",
    name: "Incremental Updates",
    description: extractDescription(incrementalUpdatesContent),
  }, {
    id: "pip-package",
    name: "Pip Package",
    description: extractDescription(pipPackageContent),
  }
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-dgat-bg">
      <Navbar variant="docs" />
      <div className="max-w-[1100px] mx-auto px-10 pt-24 pb-20">
        <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-dgat-text opacity-40 mb-2.5">Internals</div>
        <h1 className="font-heading text-[clamp(28px,3.5vw,40px)] font-extrabold text-dgat-text mb-3.5">DGAT Internals</h1>
        <p className="text-[15px] text-dgat-muted max-w-[520px] leading-[1.7] mb-10">How DGAT works under the hood — architecture, data structures, and core mechanisms.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCS.map((doc) => (
            <Link
              key={doc.id}
              to={`/internals/${doc.id}`}
              className="group block p-6 bg-surface border border-dgat-border rounded-[10px] transition-all duration-150 hover:border-dgat-border2 hover:bg-raised no-underline"
            >
              <div className="font-heading text-[16px] font-bold text-dgat-text mb-2 group-hover:text-dgat-text transition-colors">
                {doc.name}
              </div>
              <p className="text-[13px] text-dgat-muted leading-[1.6] line-clamp-3">
                {doc.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
