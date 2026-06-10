import { useMemo } from "react";
import { cn } from "@/utils/utils";

const SECTION_LABELS =
  "Key Message|Supporting Points|Call to Action|Visuals|Overview|Example Post|This Week's LinkedIn Angle";

/** Flatten CMO chat output into conversational paragraphs and simple lists. */
function normalizeCmoResponse(text: string): string {
  const sectionBreak = new RegExp(`\\s+(?=(?:${SECTION_LABELS}):)`, "gi");

  return text
    .replace(/\r\n/g, "\n")
    .replace(/::+/g, "\n\n")
    .replace(sectionBreak, "\n\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+\*\*([^*]+)\*\*:?\s*/gm, "- $1: ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[ \t]+-\s+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type ChatBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function parseChatBlocks(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  const paragraphs = text.split(/\n\n+/);

  for (const chunk of paragraphs) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const listItems = lines
      .filter((line) => /^[-•]\s+/.test(line))
      .map((line) => line.replace(/^[-•]\s+/, "").trim());

    if (listItems.length === lines.length) {
      blocks.push({ kind: "list", items: listItems.slice(0, 4) });
      continue;
    }

    const flat = lines
      .map((line) => line.replace(/^[-•]\s+/, "").trim())
      .join(" ")
      .trim();

    if (flat) blocks.push({ kind: "paragraph", text: flat });
  }

  return blocks.slice(0, 6);
}

export function CmoChatContent({
  content,
  className,
  accentDots = false,
}: {
  content: string;
  className?: string;
  accentDots?: boolean;
}) {
  const blocks = useMemo(() => parseChatBlocks(normalizeCmoResponse(content)), [content]);

  if (blocks.length === 0) {
    return (
      <p className={cn("break-words text-sm leading-relaxed [overflow-wrap:anywhere]", className)}>
        {content}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "cmo-chat-content min-w-0 space-y-3 break-words text-sm leading-relaxed [overflow-wrap:anywhere]",
        className,
      )}
    >
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="space-y-1.5">
            {block.items.map((item) => (
              <li key={item} className="flex min-w-0 gap-2">
                <span
                  className={cn(
                    "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                    accentDots ? "bg-primary" : "bg-muted-foreground/70",
                  )}
                />
                <span className="min-w-0 font-medium text-foreground/90 [overflow-wrap:anywhere]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="min-w-0 text-foreground [overflow-wrap:anywhere]">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
