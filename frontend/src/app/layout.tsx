import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import theme from "../../theme.json";

const inter = Inter({ subsets: ["latin"] });

// Build CSS variable string from theme.json so all components can reference --var-name
const themeVars = Object.fromEntries(
  Object.entries(theme as Record<string, string>).map(([k, v]) => [`--${k}`, v])
) as React.CSSProperties;

export const metadata: Metadata = {
  title: "DGAT - Dependency Graph as a Tool",
  description: "Interactive dependency graph visualization and file tree explorer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={themeVars}>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
