(() => {
  if (window.__chapterToMarkdown) return;

  const tidy = (s) =>
    s
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

  const getContainer = () => {
    const container = document.getElementById("sbo-rt-content");
    if (!container) return null;

    const sel = window.getSelection && window.getSelection();
    const node = sel && (sel.anchorNode || sel.focusNode);
    if (!node) return container;

    const inContainer = (
      node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
    )?.closest("#sbo-rt-content");
    return inContainer || container;
  };

  const inlineToMd = (node) => {
    if (node.nodeType === Node.TEXT_NODE)
      return node.nodeValue.replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = node.tagName.toLowerCase();
    const children = () => Array.from(node.childNodes).map(inlineToMd).join("");

    if (node.matches?.(".indexterm, a.indexterm")) return "";

    switch (tag) {
      case "em":
      case "i":
        return `*${children()}*`;
      case "strong":
      case "b":
        return `**${children()}**`;
      case "code":
        return `\`${children()}\``;
      case "a": {
        const text = tidy(children());
        const href = node.getAttribute("href") || "";
        return href ? `[${text}](${href})` : text;
      }
      case "br":
        return "  \n";
      default:
        return children();
    }
  };

  const blockToMd = (node, blocks) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue.replace(/\s+/g, " ").trim();
      if (t) blocks.push(t);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node;
    const tag = el.tagName.toLowerCase();

    const style = getComputedStyle(el);
    if (style && (style.display === "none" || style.visibility === "hidden"))
      return;

    if (el.matches?.(".indexterm, a.indexterm")) return;

    const kids = () => Array.from(el.childNodes);
    const asInline = () => tidy(kids().map(inlineToMd).join(""));

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = parseInt(tag[1], 10);
        blocks.push(`${"#".repeat(level)} ${asInline()}`);
        return;
      }
      case "p":
        blocks.push(asInline());
        return;

      case "blockquote": {
        const local = [];
        kids().forEach((n) => blockToMd(n, local));
        const merged = tidy(local.join("\n\n"))
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        blocks.push(merged);
        return;
      }

      case "pre": {
        const code = el.textContent.replace(/\n+$/, "");
        blocks.push("```\n" + code + "\n```");
        return;
      }

      case "ul":
      case "ol": {
        const ordered = tag === "ol";
        let idx = 1;
        for (const li of el.children) {
          if (li.tagName.toLowerCase() !== "li") continue;

          const head = tidy(
            Array.from(li.childNodes)
              .filter(
                (n) =>
                  n.nodeType !== Node.ELEMENT_NODE ||
                  !["ul", "ol"].includes(n.tagName?.toLowerCase?.()),
              )
              .map(inlineToMd)
              .join(""),
          );
          const bullet = ordered ? `${idx}. ` : `- `;
          if (head) blocks.push(bullet + head);

          const nested = Array.from(li.children).filter((c) =>
            ["ul", "ol"].includes(c.tagName.toLowerCase()),
          );
          for (const nest of nested) {
            const nestedLines = [];
            Array.from(nest.children).forEach((nli) => {
              const txt = tidy(
                Array.from(nli.childNodes).map(inlineToMd).join(""),
              );
              const nb = nest.tagName.toLowerCase() === "ol" ? "1. " : "- ";
              if (txt) nestedLines.push(`  ${nb}${txt}`);
            });
            if (nestedLines.length) blocks.push(nestedLines.join("\n"));
          }

          idx++;
        }
        return;
      }

      case "img": {
        const alt = el.getAttribute("alt") || "";
        const src = el.getAttribute("src") || "";
        if (src) blocks.push(`![${alt}](${src})`);
        return;
      }

      case "figure": {
        const img = el.querySelector("img");
        const caption = el.querySelector("figcaption")?.innerText?.trim();
        if (img) {
          const alt = img.getAttribute("alt") || caption || "";
          const src = img.getAttribute("src") || "";
          if (src) blocks.push(`![${alt}](${src})`);
        } else {
          const local = [];
          kids().forEach((n) => blockToMd(n, local));
          if (local.length) blocks.push(local.join("\n\n"));
        }
        if (caption) blocks.push(`*${caption}*`);
        return;
      }

      case "hr":
        blocks.push("---");
        return;

      case "table": {
        const rows = Array.from(el.querySelectorAll("tr"));
        if (!rows.length) return;
        const rowCells = (tr) =>
          Array.from(tr.children).map((td) => tidy(inlineToMd(td)));
        const header = rowCells(rows[0]);
        const body = rows.slice(1).map(rowCells);
        const headerLine = `| ${header.join(" | ")} |`;
        const sepLine = `| ${header.map(() => "---").join(" | ")} |`;
        const bodyLines = body.map((cells) => `| ${cells.join(" | ")} |`);
        blocks.push([headerLine, sepLine, ...bodyLines].join("\n"));
        return;
      }

      default:
        kids().forEach((n) => blockToMd(n, blocks));
    }
  };

  const getTitleFromContainer = (root) => {
    const h = root.querySelector("h1, h2, h3, .title h1, .title h2, .title");
    const t = h?.textContent?.trim() || document.title || "Content";
    return t.replace(/\s+/g, " ").trim();
  };

  const convertContainerToMarkdown = (root) => {
    const title = getTitleFromContainer(root);
    const blocks = [`# ${title}`];
    Array.from(root.childNodes).forEach((n) => blockToMd(n, blocks));

    const first = blocks[1] || "";
    if (
      /^#{1,6}\s+/i.test(first) &&
      first.replace(/^#{1,6}\s+/, "").trim() === title.trim()
    ) {
      blocks.splice(1, 1);
    }

    return tidy(blocks.join("\n\n")) + "\n";
  };

  window.__chapterToMarkdown = {
    run() {
      const root = getContainer();
      if (!root) return { markdown: "", title: "" };

      const markdown = convertContainerToMarkdown(root);
      const title = getTitleFromContainer(root);
      return { markdown, title };
    },
  };
})();
