"use client";

import mermaid from "mermaid";
import { useEffect, useRef } from "react";

export function NoteRenderedContent(props: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false
    });

    async function renderMermaidBlocks() {
      const container = containerRef.current;
      if (!container) return;
      const blocks = Array.from(container.querySelectorAll("pre.mermaid"));
      for (const [index, block] of blocks.entries()) {
        const source = block.textContent?.trim() ?? "";
        if (!source) continue;
        try {
          const result = await mermaid.render(`note-mermaid-${Date.now()}-${index}`, source);
          if (cancelled) return;
          const wrapper = document.createElement("div");
          wrapper.className =
            "my-4 overflow-x-auto rounded-md border border-slate-200 bg-white p-3";
          wrapper.innerHTML = result.svg;
          block.replaceWith(wrapper);
        } catch {
          block.classList.add("rounded-md", "border", "border-amber-200", "bg-amber-50", "p-3");
        }
      }
    }

    void renderMermaidBlocks();
    return () => {
      cancelled = true;
    };
  }, [props.html]);

  return (
    <div
      ref={containerRef}
      className="prose max-w-none rounded-md border border-slate-200 bg-white p-5 text-sm leading-6"
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
}
