interface CodeBlockProps {
  children: React.ReactNode;
}

export function CodeBlock({ children }: CodeBlockProps) {
  return (
    <div className="bg-dgat-code-bg border border-dgat-code-border rounded-[7px] px-4 py-3.5 font-mono text-[12.5px] text-dgat-text leading-[1.7] overflow-x-auto">
      {children}
    </div>
  );
}

export function CodeComment({ children }: { children: React.ReactNode }) {
  return <span className="text-dgat-subtle">{children}</span>;
}
