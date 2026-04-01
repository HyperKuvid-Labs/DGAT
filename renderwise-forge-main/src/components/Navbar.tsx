import { Link } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

const GitHubIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const LogoMark = () => (
  <div className="w-[26px] h-[26px] bg-dgat-text rounded-md flex items-center justify-center transition-colors duration-200">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="3" r="2" fill="hsl(var(--bg))" opacity="0.9" />
      <circle cx="11" cy="3" r="2" fill="hsl(var(--bg))" opacity="0.9" />
      <circle cx="7" cy="11" r="2" fill="hsl(var(--bg))" opacity="0.9" />
      <line x1="3" y1="5" x2="7" y2="9" stroke="hsl(var(--bg))" strokeWidth="1" opacity="0.5" />
      <line x1="11" y1="5" x2="7" y2="9" stroke="hsl(var(--bg))" strokeWidth="1" opacity="0.5" />
    </svg>
  </div>
);

interface NavbarProps {
  variant?: "home" | "examples" | "detail";
  title?: string;
}

export function Navbar({ variant = "home", title }: NavbarProps) {
  if (variant === "home") {
    return (
      <nav className="fixed top-0 left-0 right-0 z-[100] h-14 bg-dgat-nav backdrop-blur-[12px] border-b border-dgat-border">
        <div className="max-w-[1100px] mx-auto px-10 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <LogoMark />
            <span className="font-heading text-[17px] font-bold text-dgat-text tracking-tight">DGAT</span>
          </Link>
          <div className="flex items-center gap-1">
            <a href="#how-it-works" className="text-dgat-muted text-sm font-medium no-underline px-3 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">How it works</a>
            <a href="#features" className="text-dgat-muted text-sm font-medium no-underline px-3 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">Features</a>
            <a href="#get-started" className="text-dgat-muted text-sm font-medium no-underline px-3 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">Get started</a>
            <Link to="/examples" className="text-dgat-muted text-sm font-medium no-underline px-3 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">Examples</Link>
            <ThemeToggle />
            <a
              href="https://github.com/HyperKuvid-Labs/dgat"
              className="bg-dgat-text text-background text-[13px] font-semibold py-[7px] px-4 rounded-[7px] no-underline ml-1.5 transition-opacity duration-150 hover:opacity-80 inline-flex items-center gap-[7px]"
              target="_blank"
              rel="noopener"
            >
              <GitHubIcon />
              GitHub
            </a>
          </div>
        </div>
      </nav>
    );
  }

  if (variant === "examples") {
    return (
      <nav className="sticky top-0 z-[100] h-14 bg-dgat-nav backdrop-blur-[12px] border-b border-dgat-border">
        <div className="max-w-[1400px] mx-auto px-10 h-full flex items-center gap-3.5">
          <Link to="/" className="flex items-center gap-1.5 text-dgat-muted text-sm font-medium no-underline px-2.5 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 8H3M7 4L3 8l4 4" />
            </svg>
            Home
          </Link>
          <span className="text-dgat-border2 select-none">·</span>
          <span className="font-heading text-[15px] font-bold text-dgat-text">Examples</span>
          <a
            href="https://github.com/HyperKuvid-Labs/dgat"
            className="ml-auto flex items-center gap-1.5 bg-surface border border-dgat-border text-dgat-muted text-[13px] font-medium py-1 px-3 rounded-md no-underline transition-all duration-150 hover:text-dgat-text hover:border-dgat-border2"
            target="_blank"
            rel="noopener"
          >
            <GitHubIcon />
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </nav>
    );
  }

  // detail variant
  return (
    <nav className="sticky top-0 z-[100] h-14 bg-dgat-nav backdrop-blur-[12px] border-b border-dgat-border">
      <div className="max-w-[1400px] mx-auto px-10 h-full flex items-center gap-3.5">
        <Link to="/examples" className="flex items-center gap-1.5 text-dgat-muted text-sm font-medium no-underline px-2.5 py-1 rounded-md transition-all duration-150 hover:text-dgat-text hover:bg-raised">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M13 8H3M7 4L3 8l4 4" />
          </svg>
          Examples
        </Link>
        <span className="text-dgat-border2 select-none">·</span>
        <span className="font-heading text-[15px] font-bold text-dgat-text">{title || "Loading..."}</span>
      </div>
    </nav>
  );
}
