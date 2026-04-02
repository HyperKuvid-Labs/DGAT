import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-dgat-border py-9">
      <div className="max-w-[1100px] mx-auto px-10 flex justify-between items-center flex-wrap gap-3.5">
        <div className="flex items-center gap-3">
          <span className="font-heading text-[15px] font-bold text-dgat-text">DGAT</span>
          <span className="text-dgat-border2">·</span>
          <span className="text-[13px] text-dgat-subtle">MIT License</span>
          <span className="text-dgat-border2">·</span>
          <span className="text-[13px] text-dgat-subtle">
            Annotations by{" "}
            <span className="inline-flex items-center bg-dgat-tag border border-dgat-border rounded-full px-2 font-mono text-[10.5px] text-dgat-muted">
              Qwen3.5-2B
            </span>
          </span>
        </div>
        <div className="flex gap-5">
          <a href="https://github.com/HyerKuvid-Labs/dgat" className="text-[13px] text-dgat-muted no-underline transition-colors duration-150 hover:text-dgat-text" target="_blank" rel="noopener">GitHub</a>
          <a href="https://github.com/HyperKuvid-Labs/alpha-stack" className="text-[13px] text-dgat-muted no-underline transition-colors duration-150 hover:text-dgat-text" target="_blank" rel="noopener">alpha-stack</a>
          <Link to="/examples" className="text-[13px] text-dgat-muted no-underline transition-colors duration-150 hover:text-dgat-text">Examples</Link>
          <a href="https://github.com/HyerKuvid-Labs/dgat/blob/main/LICENSE" className="text-[13px] text-dgat-muted no-underline transition-colors duration-150 hover:text-dgat-text" target="_blank" rel="noopener">License</a>
        </div>
      </div>
    </footer>
  );
}
