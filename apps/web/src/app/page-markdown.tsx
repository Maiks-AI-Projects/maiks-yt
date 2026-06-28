import type { ReactNode } from "react";

type MarkdownBlock =
  | {
    kind: "heading";
    level: 1 | 2 | 3;
    text: string;
  }
  | {
    kind: "paragraph";
    text: string;
  }
  | {
    kind: "blockquote";
    text: string;
  }
  | {
    kind: "list";
    ordered: boolean;
    items: string[];
  }
  | {
    kind: "code";
    text: string;
  };

const isSafeMarkdownHref = (href: string): boolean =>
  href.startsWith("/")
  || href.startsWith("https://")
  || href.startsWith("http://")
  || href.startsWith("mailto:");

const renderInlineMarkdown = (text: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    const [source, label, href] = match;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(label && href && isSafeMarkdownHref(href)
      ? (
        <a href={href} key={`${href}-${match.index}`}>
          {label}
        </a>
      )
      : label ?? source);
    lastIndex = match.index + source.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
};

const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = (): void => {
    if (paragraphLines.length > 0) {
      blocks.push({
        kind: "paragraph",
        text: paragraphLines.join(" ").trim()
      });
      paragraphLines = [];
    }
  };

  const flushList = (): void => {
    if (listItems.length > 0) {
      blocks.push({
        kind: "list",
        ordered: listOrdered,
        items: listItems
      });
      listItems = [];
      listOrdered = false;
    }
  };

  const flushCode = (): void => {
    blocks.push({
      kind: "code",
      text: codeLines.join("\n")
    });
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: headingMatch[1]!.length as 1 | 2 | 3,
        text: headingMatch[2]!.trim()
      });
      continue;
    }

    const unorderedListMatch = /^[-*]\s+(.+)$/.exec(line);
    const orderedListMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (unorderedListMatch || orderedListMatch) {
      flushParagraph();
      const ordered = Boolean(orderedListMatch);
      if (listItems.length > 0 && listOrdered !== ordered) {
        flushList();
      }
      listOrdered = ordered;
      listItems.push((unorderedListMatch?.[1] ?? orderedListMatch?.[1] ?? "").trim());
      continue;
    }

    const blockquoteMatch = /^>\s?(.+)$/.exec(line);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "blockquote",
        text: blockquoteMatch[1]!.trim()
      });
      continue;
    }

    paragraphLines.push(line.trim());
  }

  if (inCodeBlock) {
    flushCode();
  }
  flushParagraph();
  flushList();

  return blocks;
};

export const PageMarkdown = ({
  body
}: {
  body: string;
}): React.ReactNode => (
  <div className="content-page-markdown">
    {parseMarkdownBlocks(body).map((block, index) => {
      if (block.kind === "heading") {
        const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3";
        return (
          <HeadingTag key={`${block.kind}-${index}`}>
            {renderInlineMarkdown(block.text)}
          </HeadingTag>
        );
      }

      if (block.kind === "list") {
        const ListTag = block.ordered ? "ol" : "ul";
        return (
          <ListTag key={`${block.kind}-${index}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
            ))}
          </ListTag>
        );
      }

      if (block.kind === "blockquote") {
        return <blockquote key={`${block.kind}-${index}`}>{renderInlineMarkdown(block.text)}</blockquote>;
      }

      if (block.kind === "code") {
        return (
          <pre key={`${block.kind}-${index}`}>
            <code>{block.text}</code>
          </pre>
        );
      }

      return <p key={`${block.kind}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
    })}
  </div>
);
