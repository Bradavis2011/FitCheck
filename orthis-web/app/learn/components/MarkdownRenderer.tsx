/**
 * Simple markdown renderer for learn content.
 * Handles ## headings, **bold**, bullet lists, and paragraphs.
 * No external dependency — keeps bundle lean.
 */

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="font-display italic mt-12 mb-4"
          style={{ fontSize: "clamp(1.35rem, 2.5vw, 1.75rem)", color: "#1A1A1A", lineHeight: 1.25 }}
        >
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={i}
          className="font-medium mt-8 mb-3"
          style={{ fontSize: "1.1rem", color: "#1A1A1A" }}
        >
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Divider
    if (line.trim() === "---") {
      elements.push(
        <div
          key={i}
          style={{ width: "60px", height: "1px", backgroundColor: "#E85D4C", margin: "32px 0" }}
        />
      );
      i++;
      continue;
    }

    // Bullet list — collect consecutive bullets
    if (line.trimStart().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="mb-6 flex flex-col gap-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-4">
              <span style={{ color: "#E85D4C", flexShrink: 0, marginTop: "0.2rem" }}>—</span>
              <span className="text-base leading-relaxed" style={{ color: "#2D2D2D" }}>
                {renderInline(item)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p
        key={i}
        className="text-base leading-relaxed mb-6"
        style={{ color: "#2D2D2D", lineHeight: 1.75 }}
      >
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="prose-editorial">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} style={{ color: "#1A1A1A", fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}
