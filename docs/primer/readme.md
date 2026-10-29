# A Gentle Primer on Neurosymbolic AI: Building a Chess Tutor (v01)

URL: https://claude.ai/chat/57d91893-11d6-4526-b902-84bb5585ce19

- [primer-v01.md](primer-v01.md): the text, exported from the Claude Doc, with the figures linked as `figs/figNN_*.png`.
- [primer-v01.pdf](primer-v01.pdf): the published PDF.
- `figs/`: all 15 figures. Figures 1–8 and 15 as SVG (source) and PNG (1440 px render); figures 9–14 are crops of the Kibitz flipbook pages (PNG only).
- `tools/figs.py`: generates the SVG figures (needs numpy; figure 6 reuses `embedding-shift.svg` from the deck).
- `tools/build.py`: reads `primer-v01.md` and builds `primer-v01.html` (inline SVG) and `primer-v01.pdf` (pandoc + XeLaTeX, TeX Gyre Heros) in this directory. Intermediate Markdown files use the same `primer-v01` prefix.

The [current flipbook](../flipbook/readme.md) is regenerated independently. The published v01 figures and quoted coaching retain their original snapshot.
