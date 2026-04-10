import { useParams, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { MarkdownRenderer } from "@/components/markdownpanel";
import overviewContent from "@/docs/overview.md?raw";
import dependencyGraphContent from "@/docs/dependency-graph.md?raw";
import fileTreeContent from "@/docs/file-tree.md?raw";
import importExtractionContent from "@/docs/import-extraction.md?raw";
import incrementalUpdatesContent from "@/docs/incremental-updates.md?raw";
import pipPackageContent from "@/docs/pip-package.md?raw";

const DOC_CONTENT: Record<string, string> = {
  overview: overviewContent,
  "dependency-graph": dependencyGraphContent,
  "file-tree": fileTreeContent,
  "import-extraction": importExtractionContent,
  "incremental-updates": incrementalUpdatesContent,
  "pip-package": pipPackageContent,
};

const DOC_NAMES: Record<string, string> = {
  overview: "Overview",
  "dependency-graph": "Dependency Graph",
  "file-tree": "File Tree",
  "import-extraction": "Import Extraction",
  "incremental-updates": "Incremental Updates",
  "pip-package": "Pip Package",
};

export default function DocsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const content = id ? DOC_CONTENT[id] : null;
  const name = id ? DOC_NAMES[id] : null;

  if (!content || !name) {
    return (
      <div className="min-h-screen bg-dgat-bg">
        <Navbar variant="docs" />
        <div className="max-w-[1100px] mx-auto px-10 pt-24 pb-20">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold text-dgat-text mb-4">Document not found</h1>
            <Link to="/internals" className="text-dgat-muted hover:text-dgat-text underline">
              Back to internals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dgat-bg">
      <Navbar variant="docs" title={name} />
      <div className="max-w-[800px] mx-auto px-10 pt-24 pb-20">
        <div className="mb-6">
          <Link to="/internals" className="text-dgat-muted text-sm hover:text-dgat-text transition-colors inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 8H3M7 4L3 8l4 4" />
            </svg>
            Internals
          </Link>
        </div>
        <MarkdownRenderer content={content} className="px-0" />
      </div>
    </div>
  );
}
