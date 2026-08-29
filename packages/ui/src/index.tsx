import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div";
  tone?: string;
};

export function ComicPanel({ as: Tag = "section", tone = "paper", className = "", ...props }: PanelProps) {
  return <Tag className={`comic-panel comic-panel--${tone} ${className}`} {...props} />;
}

export function CaptionBox({ children, tone = "yellow" }: { children: ReactNode; tone?: string }) {
  return <span className={`caption-box caption-box--${tone}`}>{children}</span>;
}

export function ActionButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`action-button ${className}`} {...props} />;
}

export function HoodMark({ color = "yellow", small = false }: { color?: string; small?: boolean }) {
  return (
    <span className={`hood-mark hood-mark--${color} ${small ? "hood-mark--small" : ""}`} aria-hidden="true">
      <span className="hood-mark__face" />
    </span>
  );
}

