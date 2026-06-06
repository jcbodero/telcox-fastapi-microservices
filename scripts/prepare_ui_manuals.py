from __future__ import annotations

import html
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
TARGET_DIR = ROOT / "ui" / "public" / "manuales"


def run_html_generator() -> None:
    generator = ROOT / "scripts" / "generate_architecture_html.py"
    if generator.exists():
        subprocess.run([sys.executable, str(generator)], cwd=ROOT, check=True)


def copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def prepare_manuals() -> list[Path]:
    run_html_generator()

    if TARGET_DIR.exists():
        shutil.rmtree(TARGET_DIR)
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    copied: list[Path] = []
    for source in DOCS_DIR.iterdir():
        if source.is_file() and source.suffix.lower() in {".md", ".html", ".drawio", ".docx", ".pdf", ".png", ".svg"}:
            target = TARGET_DIR / source.name
            copy_file(source, target)
            copied.append(target)

    for folder_name in ["generated_report_assets", "architecture_html_assets"]:
        source_dir = DOCS_DIR / folder_name
        if source_dir.exists() and source_dir.is_dir():
            target_dir = TARGET_DIR / folder_name
            shutil.copytree(source_dir, target_dir)
            copied.extend(path for path in target_dir.rglob("*") if path.is_file())

    write_index(copied)
    return copied


def title_for(path: Path) -> str:
    stem = path.stem.replace("_", " ").replace("-", " ")
    return " ".join(word.capitalize() for word in stem.split())


def write_index(files: list[Path]) -> None:
    rows = []
    for file_path in sorted(files, key=lambda item: item.name.lower()):
        rel = file_path.relative_to(TARGET_DIR).as_posix()
        if rel == "index.html":
            continue
        kind = file_path.suffix.lower().lstrip(".").upper() or "FILE"
        rows.append(
            f"<tr><td>{html.escape(title_for(file_path))}</td>"
            f"<td>{kind}</td>"
            f"<td><a href=\"{html.escape(rel)}\">Abrir</a></td>"
            f"<td><a href=\"{html.escape(rel)}\" download>Descargar</a></td></tr>"
        )

    index = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TelcoX - Manuales</title>
  <style>
    body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; background: #f4f7fb; color: #172033; }}
    header {{ background: #0b2545; color: #fff; padding: 28px 36px; }}
    main {{ width: min(1100px, calc(100% - 40px)); margin: 28px auto; background: #fff; border: 1px solid #d7dee8; border-radius: 8px; padding: 28px; }}
    h1 {{ margin: 0 0 8px; }}
    p {{ color: #5f6b7a; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 22px; }}
    th, td {{ border-bottom: 1px solid #e4eaf2; padding: 12px 10px; text-align: left; }}
    th {{ background: #e8eef5; color: #0b2545; }}
    a {{ color: #2e74b5; font-weight: 700; text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <header>
    <h1>TelcoX - Manuales y Documentacion</h1>
    <p>Repositorio de documentos servidos desde la UI. Esta ruta debe estar protegida con Basic Auth en el Ingress.</p>
  </header>
  <main>
    <p>Selecciona un documento para abrirlo en el navegador o descargarlo.</p>
    <table>
      <thead><tr><th>Documento</th><th>Tipo</th><th>Ver</th><th>Descargar</th></tr></thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
  </main>
</body>
</html>
"""
    (TARGET_DIR / "index.html").write_text(index, encoding="utf-8")


if __name__ == "__main__":
    copied_files = prepare_manuals()
    print(f"Prepared {len(copied_files)} manual files in {TARGET_DIR}")
