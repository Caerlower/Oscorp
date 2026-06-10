import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/utils";

type MarkdownContentProps = {
  children: string;
  className?: string;
  /** Compact styling for chat bubbles and agent cards */
  variant?: "document" | "compact";
};

export function MarkdownContent({ children, className, variant = "document" }: MarkdownContentProps) {
  const proseClass = variant === "compact" ? "agent-markdown" : "document-markdown";

  return (
    <div className={cn(proseClass, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
