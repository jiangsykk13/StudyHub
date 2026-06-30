import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";
import hljs from "highlight.js";
import katex from "katex";

const marked = new Marked({
  gfm: true,
  breaks: false
});

export function renderNoteContent(markdown: string): {
  html: string;
  toc: Array<{ text: string; id: string }>;
} {
  const toc: Array<{ text: string; id: string }> = [];
  const withMermaid = replaceMermaid(markdown);
  const withMath = replaceMath(withMermaid);
  const raw = marked.parse(withMath, { async: false });
  const highlighted = replaceCodeBlocks(raw);
  const withHeadingIds = addHeadingIds(highlighted, toc);
  return { html: sanitizeNoteHtml(withHeadingIds), toc };
}

function replaceMath(markdown: string): string {
  return markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expression: string) => renderMath(expression, true))
    .replace(/\$([^$\n]+?)\$/g, (_match, expression: string) => renderMath(expression, false));
}

function replaceMermaid(markdown: string): string {
  return markdown.replace(/```mermaid\s*\n([\s\S]*?)```/g, (_match, source: string) => {
    return `<pre class="mermaid">${escapeHtml(source.trim())}</pre>`;
  });
}

function renderMath(expression: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expression.trim(), {
      displayMode,
      output: "html",
      throwOnError: false,
      strict: "ignore"
    });
  } catch {
    return escapeHtml(expression);
  }
}

function replaceCodeBlocks(html: string): string {
  return html.replace(
    /<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match, language: string | undefined, escapedCode: string) =>
      renderHighlightedCode(decodeHtml(escapedCode), normalizeLanguage(language))
  );
}

function addHeadingIds(html: string, toc: Array<{ text: string; id: string }>): string {
  const seen = new Map<string, number>();
  return html.replace(
    /<h([1-3])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (_match, level: string, text: string) => {
      const plain = stripHtml(text);
      const baseId = slugify(plain);
      const count = seen.get(baseId) ?? 0;
      seen.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      toc.push({ text: plain, id });
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
  );
}

function sanitizeNoteHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "li",
      "ol",
      "p",
      "pre",
      "span",
      "strong",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "ul"
    ],
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      code: ["class"],
      div: ["class"],
      h1: ["id"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      h5: ["id"],
      h6: ["id"],
      pre: ["class"],
      span: ["aria-hidden", "class"]
    },
    allowedClasses: {
      code: [/^[A-Za-z0-9_-]+$/],
      div: [/^[A-Za-z0-9_-]+$/],
      pre: ["mermaid"],
      span: [/^[A-Za-z0-9_-]+$/]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank"
      }),
      code: (_tagName, attribs) => ({
        tagName: "code",
        attribs,
        text: undefined
      })
    }
  });
}

export function renderHighlightedCode(code: string, language: string): string {
  const highlighted =
    language && hljs.getLanguage(language)
      ? hljs.highlight(code, { language, ignoreIllegals: true }).value
      : escapeHtml(code);
  const languageClass = language ? ` language-${escapeAttribute(language)}` : "";
  return `<pre><code class="hljs${languageClass}">${highlighted}</code></pre>`;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "section"
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeLanguage(language: string | undefined): string {
  if (!language) return "";
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    shell: "bash",
    sh: "bash",
    yml: "yaml"
  };
  const normalized = language.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return aliases[normalized] ?? normalized;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeAttribute(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
