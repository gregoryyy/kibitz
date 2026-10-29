"""Build the web page and the PDF of the primer v01 from the exported markdown and the figures."""
import re, base64, subprocess, pathlib, html, shutil
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
FIGS = ROOT / "figs"
OUT = ROOT
NAME = "primer-v01"
md = (ROOT / f"{NAME}.md").read_text()

FIG = {1: "fig01_flaw_to_fix", 2: "fig02_tokenization", 3: "fig03_embedding", 4: "fig04_transformer",
       5: "fig05_attention_pattern", 6: "fig06_embedding_shift", 7: "fig07_context_window", 8: "fig08_loop",
       9: "fig09_plan", 10: "fig10_own_idea", 11: "fig11_review", 12: "fig12_reads_graph", 13: "fig13_study_plan",
       14: "fig14_your_turn", 15: "fig15_where_things_run"}

# byline and title block
md = re.sub(r"^# A Gentle Primer on Neurosymbolic AI\n\n## Building a Chess Tutor\n\n.*?\n", "", md, count=1, flags=re.S)
md = re.sub(r"^(?:&#91;|\[)image: [^\n]*\n\n?", "", md, flags=re.M | re.I)
# insert figure images before captions
def ins(m):
    n = int(m.group(1))
    return f"![Figure {n}](figs/{FIG[n]}.png)\n\n{m.group(0)}"
md = re.sub(r"^\*Figure (\d+)\.", ins, md, flags=re.M)
# plain-text references inside parentheses stay as they are; code blocks keep their fences
(ROOT / f"{NAME}_build.md").write_text(md)

# ------------------------------------------------------------------ HTML
body = subprocess.run(["pandoc", "-f", "gfm", "-t", "html5", "--no-highlight", str(ROOT / f"{NAME}_build.md")],
                      capture_output=True, text=True, check=True).stdout

def inline_img(m):
    src = m.group(1)
    name = pathlib.Path(src).stem
    alt = re.search(r'alt="([^"]*)"', m.group(0))
    alt = alt.group(1) if alt else ""
    svg = FIGS / f"{name}.svg"
    if svg.exists():
        s = svg.read_text()
        s = re.sub(r"<\?xml[^>]*\?>", "", s)
        s = re.sub(r'<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"', r"<svg\1", s, count=1)
        return f'<figure class="svg">{s}</figure>'
    png = (FIGS / f"{name}.png").read_bytes()
    b64 = base64.b64encode(png).decode()
    cls = "shot wide" if name.endswith("your_turn") else "shot"
    return f'<figure class="{cls}"><img src="data:image/png;base64,{b64}" alt="{html.escape(alt)}" loading="lazy"></figure>'

body = re.sub(r'<img src="figs/([^"]+)"[^>]*>', inline_img, body)
body = body.replace("<p><figure", "<figure").replace("</figure></p>", "</figure>")

# table of contents from h2/h3
toc = []
def slug(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
def addid(m):
    level, text = m.group(1), m.group(2)
    plain = re.sub(r"<[^>]+>", "", text)
    sid = slug(plain)
    toc.append((level, plain, sid))
    return f'<h{level} id="{sid}">{text}</h{level}>'
body = re.sub(r"<h([23])(?: id=\"[^\"]*\")?>(.*?)</h\1>", lambda m: addid(m), body)
toc_html = "<nav class=\"toc\"><p class=\"toc-title\">Contents</p><ul>" + "".join(
    f'<li class="l{l}"><a href="#{s}">{html.escape(t)}</a></li>' for l, t, s in toc if l == "2" or t.startswith("Step") or t.startswith("The Claude")) + "</ul></nav>"

CSS = """
:root{--ink:#1E2A30;--muted:#5E6E76;--line:#C9D3D6;--chip:#F2F5F6;--red:#F3533A;--blue:#004C8C;--bg:#FFFFFF;--quote:#FFF7E6}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ink:#E8EEF0;--muted:#A5B2B8;--line:#3A464C;--chip:#232C31;--bg:#141A1D;--quote:#2A2418}}
:root[data-theme="dark"]{--ink:#E8EEF0;--muted:#A5B2B8;--line:#3A464C;--chip:#232C31;--bg:#141A1D;--quote:#2A2418}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Helvetica,"Helvetica Neue",Arial,sans-serif;line-height:1.55;font-size:17px}
main{max-width:760px;margin:0 auto;padding:40px 16px 80px}
header.title{margin:24px 0 36px}
header.title h1{font-size:40px;line-height:1.1;margin:0 0 4px;letter-spacing:-0.01em}
header.title .sub{font-size:24px;color:var(--muted);margin:0 0 14px}
header.title .meta{font-size:14px;color:var(--muted)}
h2{font-size:26px;margin:52px 0 12px;padding-top:12px;border-top:1px solid var(--line);letter-spacing:-0.01em}
h3{font-size:20px;margin:34px 0 8px}
p{margin:0 0 14px}
blockquote{margin:14px 0;padding:10px 16px;background:var(--quote);border-left:3px solid var(--red);font-size:15.5px}
blockquote p{margin:0}
code,pre{font-family:Menlo,Consolas,"Liberation Mono",monospace;font-size:13.5px}
pre{background:var(--chip);padding:12px 14px;border-radius:6px;overflow-x:auto;line-height:1.45}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:12px 0 18px}
th,td{border-top:1px solid var(--line);padding:7px 10px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600;font-size:13px}
figure{margin:22px 0 6px}
figure.svg svg{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:8px;background:#fff}
figure.shot img{display:block;max-width:100%;margin:0 auto;border:1px solid var(--line);border-radius:8px}
figure.shot:not(.wide) img{max-width:560px}
figure + p em{display:block;font-size:13.5px;color:var(--muted);margin:6px 0 22px}
nav.toc{background:var(--chip);border-radius:8px;padding:14px 18px;margin:0 0 30px;font-size:14.5px}
nav.toc .toc-title{margin:0 0 6px;font-weight:700}
nav.toc ul{list-style:none;margin:0;padding:0;columns:2;column-gap:24px}
nav.toc li.l3{padding-left:14px}
nav.toc a{color:var(--ink);text-decoration:none}
nav.toc a:hover{text-decoration:underline}
ul,ol{padding-left:22px}
li{margin:0 0 5px}
a{color:var(--blue)}
.note{font-size:14px;color:var(--muted);border-top:1px solid var(--line);margin-top:48px;padding-top:14px}
@media (max-width:600px){body{font-size:16px}header.title h1{font-size:30px}header.title .sub{font-size:20px}nav.toc ul{columns:1}h2{font-size:22px}}
"""

page = f"""<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Neurosymbolic AI primer</title>
<meta name="description" content="A gentle primer on neurosymbolic AI: how a language model works, where it fails, and how a chess engine beside it makes a reliable tutor.">
<style>{CSS}</style>
</head>
<body>
<main>
<header class="title">
<h1>A Gentle Primer on Neurosymbolic AI</h1>
<p class="sub">Building a Chess Tutor</p>
<p class="meta">Gregor Heinrich &middot; October 2026 &middot; v01</p>
</header>
{body}
<p class="note">Version 01, October 2026. The Kibitz flipbook pages are reproduced from the application; engine numbers are from the runs shown there and differ slightly between runs. Figures 1 to 8 and 15 are illustrative drawings.</p>
</main>
</body>
</html>"""
(OUT / f"{NAME}.html").write_text(page)
print("html", len(page))

# ------------------------------------------------------------------ PDF figures (SVG -> PDF via Chromium)
PDFF = ROOT / "pdffigs"
PDFF.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    for svg in FIGS.glob("*.svg"):
        s = svg.read_text()
        m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s) or re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', s)
        w, h = float(m.group(1)), float(m.group(2))
        wrap = ROOT / "pdfwrap.html"
        wrap.write_text(f'<html><head><style>@page{{size:{w}pt {h}pt;margin:0}}body{{margin:0}}img{{display:block;width:{w}pt;height:{h}pt}}</style></head>'
                        f'<body><img src="file://{svg}"></body></html>')
        pg.goto(f"file://{wrap}")
        pg.wait_for_timeout(150)
        pg.pdf(path=str(PDFF / (svg.stem + ".pdf")), prefer_css_page_size=True, print_background=True)
    b.close()
for png in FIGS.glob("*.png"):
    if not (FIGS / (png.stem + ".svg")).exists():
        shutil.copy(png, PDFF / png.name)

# markdown for latex: point images to pdffigs, drop html-only bits
mdl = md.replace("](figs/", "](pdffigs/")
def latex_img(m):
    n = int(m.group(1)); name = FIG[n]
    ext = "pdf" if (PDFF / f"{name}.pdf").exists() else "png"
    width = "0.62" if ext == "png" and n != 14 else "1.0"
    return f"![Figure {n}](pdffigs/{name}.{ext}){{width={width}\\linewidth}}"
mdl = re.sub(r"!\[Figure (\d+)\]\(pdffigs/[^)]+\)", latex_img, mdl)
# captions: italic paragraph after image -> keep; pandoc makes a figure with implicit caption only if alt present and alone; we keep the image alone (no caption) and the italic line below
mdl = re.sub(r"^!\[Figure (\d+)\]", r"![](", mdl, flags=re.M).replace("![](", "![]", 1) if False else mdl
mdl = re.sub(r"^!\[Figure \d+\]\(", "![](", mdl, flags=re.M)
# avoid implicit_figures: add a trailing non-breaking space so pandoc doesn't treat image as figure? Simpler: disable extension.
(ROOT / f"{NAME}_latex.md").write_text(mdl)

HEADER = r"""
\usepackage{geometry}
\geometry{a4paper,left=24mm,right=24mm,top=24mm,bottom=26mm}
\usepackage{fontspec}
\setmainfont{TeX Gyre Heros}
\setsansfont{TeX Gyre Heros}
\setmonofont{DejaVu Sans Mono}[Scale=0.84]
\usepackage{setspace}\setstretch{1.08}
\usepackage{xcolor}
\definecolor{ink}{HTML}{1E2A30}\definecolor{muted}{HTML}{5E6E76}\definecolor{red}{HTML}{F3533A}\definecolor{blue}{HTML}{004C8C}
\usepackage{titlesec}
\titleformat{\section}{\Large\bfseries}{\thesection}{0.8em}{}
\titleformat{\subsection}{\large\bfseries}{\thesubsection}{0.8em}{}
\titlespacing*{\section}{0pt}{22pt}{8pt}
\titlespacing*{\subsection}{0pt}{16pt}{5pt}
\usepackage{fancyhdr}\pagestyle{fancy}\fancyhf{}
\fancyfoot[L]{\small\color{muted}A Gentle Primer on Neurosymbolic AI \textperiodcentered{} v01}
\fancyfoot[R]{\small\color{muted}\thepage}
\renewcommand{\headrulewidth}{0pt}
\usepackage{booktabs,longtable,array}
\renewcommand{\arraystretch}{1.15}
\usepackage{fvextra}
\DefineVerbatimEnvironment{Highlighting}{Verbatim}{breaklines,fontsize=\small}
\fvset{breaklines=true,fontsize=\small}
\usepackage{etoolbox}
\AtBeginEnvironment{quote}{\small\color{ink}}
\setlength{\parskip}{5pt plus 2pt}\setlength{\parindent}{0pt}
\usepackage{float}\floatplacement{figure}{H}
\usepackage{caption}\captionsetup{font=small,labelfont=bf}
\makeatletter\def\maxwidth{\ifdim\Gin@nat@width>\linewidth\linewidth\else\Gin@nat@width\fi}\makeatother
"""
(ROOT / "header.tex").write_text(HEADER)
META = """---
title: "A Gentle Primer on Neurosymbolic AI"
subtitle: "Building a Chess Tutor"
author: "Gregor Heinrich"
date: "October 2026 · v01"
lang: en-US
toc: false
numbersections: false
---

"""
(ROOT / f"{NAME}_latex_full.md").write_text(META + mdl)
r = subprocess.run(["pandoc", str(ROOT / f"{NAME}_latex_full.md"), "-f", "markdown-implicit_figures+pipe_tables+backtick_code_blocks",
                    "--pdf-engine=xelatex", "-H", str(ROOT / "header.tex"), "--template", str(ROOT / "tmpl.tex"), "-V", "colorlinks", "-V", "linkcolor=blue", "-V", "urlcolor=blue", "-o", str(OUT / f"{NAME}.pdf")],
                   capture_output=True, text=True, cwd=str(ROOT))
print(r.returncode, r.stderr[-3000:])
