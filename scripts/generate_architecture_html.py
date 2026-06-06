from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "docs" / "ARCHITECTURE_ONPREM_AWS.md"
DRAWIO_PATH = ROOT / "docs" / "TELCOX_ARCHITECTURE.drawio"
OUT_PATH = ROOT / "docs" / "ARCHITECTURE_ONPREM_AWS.html"


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = re.sub(r"[^a-z0-9áéíóúñü]+", "-", value)
    return value.strip("-") or "section"


def inline_md(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def markdown_to_html(markdown: str) -> tuple[str, list[tuple[int, str, str]]]:
    lines = markdown.splitlines()
    out: list[str] = []
    toc: list[tuple[int, str, str]] = []
    paragraph: list[str] = []
    in_list = False
    in_code = False
    code_lang = ""
    code_lines: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            out.append(f"<p>{inline_md(' '.join(paragraph))}</p>")
            paragraph = []

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```"):
            if not in_code:
                flush_paragraph()
                close_list()
                in_code = True
                code_lang = stripped[3:].strip()
                code_lines = []
            else:
                code = "\n".join(code_lines)
                if code_lang == "mermaid":
                    out.append(
                        '<figure class="diagram-card">'
                        '<figcaption>Diagrama Mermaid renderizado</figcaption>'
                        f'<div class="mermaid">{html.escape(code)}</div>'
                        "</figure>"
                    )
                else:
                    out.append(f'<pre><code>{html.escape(code)}</code></pre>')
                in_code = False
                code_lang = ""
                code_lines = []
            continue

        if in_code:
            code_lines.append(line)
            continue

        if not stripped:
            flush_paragraph()
            close_list()
            continue

        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            close_list()
            level = len(heading.group(1))
            text = heading.group(2).strip()
            anchor = slugify(text)
            toc.append((level, text, anchor))
            out.append(f'<h{level} id="{anchor}">{inline_md(text)}</h{level}>')
            continue

        if stripped.startswith("- "):
            flush_paragraph()
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline_md(stripped[2:].strip())}</li>")
            continue

        paragraph.append(stripped)

    flush_paragraph()
    close_list()
    return "\n".join(out), toc


def drawio_pages() -> list[tuple[str, str]]:
    tree = ET.parse(DRAWIO_PATH)
    root = tree.getroot()
    pages: list[tuple[str, str]] = []
    for diagram in root.findall("diagram"):
        name = diagram.attrib.get("name", "Diagrama")
        model = diagram.find("mxGraphModel")
        if model is not None:
            xml_text = ET.tostring(model, encoding="unicode")
        else:
            xml_text = diagram.text or ""
        pages.append((name, xml_text))
    return pages


def build_drawio_html() -> str:
    blocks: list[str] = []
    for name, xml_text in drawio_pages():
        data = {
            "highlight": "#2E74B5",
            "nav": True,
            "resize": True,
            "toolbar": "zoom layers lightbox",
            "edit": "_blank",
            "xml": xml_text,
        }
        blocks.append(
            '<section class="drawio-card">'
            f"<h3>{html.escape(name)}</h3>"
            f"<div class=\"mxgraph\" data-mxgraph='{html.escape(json.dumps(data, ensure_ascii=False), quote=True)}'></div>"
            "</section>"
        )
    return "\n".join(blocks)


def build_toc(toc: list[tuple[int, str, str]]) -> str:
    items = []
    for level, text, anchor in toc:
        if level <= 3:
            items.append(f'<a class="toc-l{level}" href="#{anchor}">{html.escape(text)}</a>')
    return "\n".join(items)


def main() -> None:
    markdown = MD_PATH.read_text(encoding="utf-8")
    body, toc = markdown_to_html(markdown)
    drawio = build_drawio_html()
    toc_html = build_toc(toc)

    html_doc = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TelcoX - Arquitectura Aplicada</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
  <style>
    :root {{
      --ink: #0b2545;
      --blue: #2e74b5;
      --soft-blue: #e8eef5;
      --line: #d7dee8;
      --muted: #5f6b7a;
      --paper: #ffffff;
      --bg: #f4f7fb;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: #182230;
      background: var(--bg);
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.55;
    }}
    .topbar {{
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 24px;
      background: var(--ink);
      color: #fff;
      box-shadow: 0 2px 12px rgba(15, 23, 42, .18);
    }}
    .brand {{ font-weight: 700; letter-spacing: .2px; }}
    .actions {{ display: flex; gap: 10px; align-items: center; }}
    button, .link-button {{
      border: 1px solid rgba(255,255,255,.35);
      background: #fff;
      color: var(--ink);
      border-radius: 6px;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      font-size: 13px;
    }}
    .layout {{
      display: grid;
      grid-template-columns: 290px minmax(0, 1fr);
      gap: 24px;
      width: min(1440px, calc(100% - 40px));
      margin: 24px auto 56px;
    }}
    aside {{
      position: sticky;
      top: 72px;
      align-self: start;
      max-height: calc(100vh - 96px);
      overflow: auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
    }}
    aside h2 {{ margin: 0 0 12px; font-size: 15px; color: var(--ink); }}
    aside a {{
      display: block;
      color: #26384d;
      text-decoration: none;
      border-left: 3px solid transparent;
      padding: 5px 6px;
      font-size: 13px;
    }}
    aside a:hover {{ color: var(--blue); border-left-color: var(--blue); background: #f7faff; }}
    .toc-l1 {{ font-weight: 700; }}
    .toc-l2 {{ margin-left: 8px; }}
    .toc-l3 {{ margin-left: 18px; color: var(--muted); }}
    main {{
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 38px 48px;
      box-shadow: 0 8px 28px rgba(15, 23, 42, .08);
    }}
    .cover {{
      border-bottom: 4px solid var(--blue);
      padding-bottom: 18px;
      margin-bottom: 28px;
    }}
    .cover h1 {{
      margin: 0 0 8px;
      color: var(--ink);
      font-size: clamp(30px, 4vw, 44px);
      line-height: 1.08;
    }}
    .cover p {{ color: var(--muted); margin: 0; font-size: 15px; }}
    h1, h2, h3 {{ color: var(--ink); line-height: 1.2; }}
    h1 {{ margin-top: 34px; font-size: 30px; }}
    h2 {{ margin-top: 30px; font-size: 24px; border-bottom: 1px solid var(--line); padding-bottom: 7px; }}
    h3 {{ margin-top: 24px; font-size: 18px; color: #1f4d78; }}
    p {{ margin: 0 0 12px; }}
    ul {{ margin: 0 0 16px 22px; padding: 0; }}
    li {{ margin: 5px 0; }}
    code {{
      background: #eef3f8;
      border: 1px solid #d9e3ef;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: Consolas, Monaco, monospace;
      font-size: .94em;
    }}
    pre {{
      overflow: auto;
      background: #0f172a;
      color: #e5e7eb;
      border-radius: 8px;
      padding: 16px;
    }}
    .diagram-card, .drawio-card {{
      break-inside: avoid;
      margin: 20px 0 28px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 16px;
    }}
    .diagram-card figcaption {{
      font-weight: 700;
      color: var(--ink);
      margin-bottom: 10px;
    }}
    .mermaid {{
      display: flex;
      justify-content: center;
      width: 100%;
      overflow: auto;
      padding: 8px;
    }}
    .drawio-section {{
      margin-top: 34px;
      padding-top: 20px;
      border-top: 3px solid var(--soft-blue);
    }}
    .drawio-card h3 {{ margin-top: 0; }}
    .mxgraph {{
      width: 100%;
      min-height: 560px;
      border: 1px solid #e3e9f2;
      border-radius: 6px;
      background: #fff;
    }}
    .note {{
      background: #fff8e8;
      border: 1px solid #e0b64c;
      border-radius: 8px;
      padding: 12px 14px;
      color: #4d3b00;
      margin: 18px 0;
    }}
    footer {{
      width: min(1440px, calc(100% - 40px));
      margin: 0 auto 36px;
      color: var(--muted);
      font-size: 12px;
      text-align: center;
    }}
    @media (max-width: 980px) {{
      .layout {{ grid-template-columns: 1fr; }}
      aside {{ position: relative; top: 0; max-height: none; }}
      main {{ padding: 28px 22px; }}
    }}
    @page {{ size: A4; margin: 14mm; }}
    @media print {{
      body {{ background: #fff; }}
      .topbar, aside, footer {{ display: none !important; }}
      .layout {{ display: block; width: 100%; margin: 0; }}
      main {{ border: 0; box-shadow: none; padding: 0; }}
      h1, h2, h3, .diagram-card, .drawio-card {{ break-inside: avoid; }}
      .mxgraph {{ min-height: 420px; }}
      a {{ color: inherit; text-decoration: none; }}
    }}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">TelcoX - Documentacion de Arquitectura</div>
    <div class="actions">
      <a class="link-button" href="TELCOX_ARCHITECTURE.drawio" target="_blank">Abrir Draw.io</a>
      <button type="button" onclick="window.print()">Descargar PDF</button>
    </div>
  </div>
  <div class="layout">
    <aside>
      <h2>Contenido</h2>
      {toc_html}
      <a class="toc-l2" href="#diagramas-drawio-integrados">Diagramas Draw.io integrados</a>
    </aside>
    <main>
      <section class="cover">
        <h1>TelcoX - Arquitectura Aplicada</h1>
        <p>Vista navegable generada desde <code>docs/ARCHITECTURE_ONPREM_AWS.md</code>. Incluye Mermaid renderizado, Draw.io integrado y exportacion a PDF desde el navegador.</p>
      </section>
      <div class="note">
        Para descargar como PDF usa el boton <strong>Descargar PDF</strong> y selecciona "Guardar como PDF" en el dialogo de impresion del navegador.
      </div>
      {body}
      <section id="diagramas-drawio-integrados" class="drawio-section">
        <h2>Diagramas Draw.io Integrados</h2>
        <p>Estos diagramas se cargan desde <code>docs/TELCOX_ARCHITECTURE.drawio</code> y se muestran con el visor de diagrams.net.</p>
        {drawio}
      </section>
    </main>
  </div>
  <footer>Generado automaticamente desde ARCHITECTURE_ONPREM_AWS.md y TELCOX_ARCHITECTURE.drawio.</footer>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: "default",
      securityLevel: "loose",
      flowchart: {{ useMaxWidth: true, htmlLabels: true }},
      er: {{ useMaxWidth: true }}
    }});
  </script>
</body>
</html>
"""
    OUT_PATH.write_text(html_doc, encoding="utf-8")
    print(OUT_PATH)


if __name__ == "__main__":
    main()
