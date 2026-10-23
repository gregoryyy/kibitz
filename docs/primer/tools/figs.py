"""Figures for the neurosymbolic primer v01. Deck style: Helvetica, deck colors."""
import re, math
from xml.sax.saxutils import escape as esc

OUT = "/home/claude/primer/figs/"
FONT = "Helvetica, 'Helvetica Neue', Arial, sans-serif"
INK, MUTED, LINE, CHIP = "#1E2A30", "#5E6E76", "#C9D3D6", "#F2F5F6"
RED, RED2, RED3 = "#F3533A", "#FF9A85", "#B9321A"
BLUE, CYAN, YEL, CYAN2 = "#004C8C", "#00B0F0", "#FFC62F", "#00E2FF"
PANEL = "#FFFFFF"


class S:
    def __init__(self, w, h, title, desc):
        self.w, self.h = w, h
        self.o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
                  f'font-family="{FONT}" role="img" aria-labelledby="t d">',
                  f'<title id="t">{esc(title)}</title><desc id="d">{esc(desc)}</desc>',
                  '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">'
                  f'<path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="{INK}" stroke-width="1.2"/></marker>'
                  '<marker id="arrm" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">'
                  f'<path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="{MUTED}" stroke-width="1.2"/></marker>'
                  '<marker id="arrr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">'
                  f'<path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="{RED}" stroke-width="1.4"/></marker>'
                  '<marker id="arrb" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">'
                  f'<path d="M0,0.5 L7,4 L0,7.5" fill="none" stroke="{BLUE}" stroke-width="1.4"/></marker>'
                  '</defs>',
                  f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>']

    def a(self, s):
        self.o.append(s)

    def text(self, x, y, s, size=8, fill=INK, weight="normal", anchor="start", style="", extra=""):
        self.a(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" font-weight="{weight}" '
               f'text-anchor="{anchor}" font-style="{style}"{extra}>{esc(s)}</text>')

    def lines(self, x, y, items, size=7.6, fill=MUTED, lh=10.2, anchor="start"):
        for i, s in enumerate(items):
            self.text(x, y + i * lh, s, size, fill, anchor=anchor)

    def rect(self, x, y, w, h, fill=CHIP, stroke="none", rx=3, sw=1, dash=""):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.a(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def chip(self, x, y, w, h, s, size=8, fill=CHIP, color=INK, weight="normal", stroke="none"):
        self.rect(x, y, w, h, fill, stroke)
        self.text(x + w / 2, y + h / 2 + size * 0.36, s, size, color, weight, "middle")

    def arrow(self, x1, y1, x2, y2, color=INK, marker="arr", sw=1.2, dash=""):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.a(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}" marker-end="url(#{marker})"{d}/>')

    def path(self, d, color=INK, sw=1.2, marker=None, fill="none", dash=""):
        m = f' marker-end="url(#{marker})"' if marker else ""
        da = f' stroke-dasharray="{dash}"' if dash else ""
        self.a(f'<path d="{d}" fill="{fill}" stroke="{color}" stroke-width="{sw}"{m}{da}/>')

    def panel(self, x, y, w, h, title=None, sub=None):
        self.rect(x, y, w, h, PANEL, LINE, rx=6, sw=0.8)
        if title:
            self.text(x + 12, y + 18, title, 10.5, INK, "bold")
        if sub:
            self.text(x + 12, y + 31, sub, 7.6, MUTED)

    def save(self, name):
        self.a("</svg>")
        open(OUT + name, "w").write("\n".join(self.o))
        print("wrote", name)


# ------------------------------------------------------------------ fig01
def fig01():
    s = S(720, 430, "Flaw to fix",
          "Eight systematic flaws of a language model on the left, each joined by an arrow to the part of the "
          "application that compensates it on the right: the engine, the index and the checker.")
    s.text(24, 30, "Flaw to fix", 16, INK, "bold")
    s.text(24, 46, "What the model gets wrong on its own, and which part of the application compensates it.", 8.5, MUTED)
    rows = [
        ("Illegal moves and invented lines", "no board, only text (Step 4)", "The checker", "every move the model names is verified (Step 6)", RED),
        ("Confident wrong judgments", "plausibility, not truth (Step 3)", "Facts first", "the engine's lines and scores go into the prompt (Step 5)", RED),
        ("Invented facts, outdated knowledge", "recall from training (Step 3)", "Retrieval", "library and games, with references shown (Step 7)", BLUE),
        ("Mixed-up positions", "similarity is not equality (Step 2)", "Exact keys", "EPD, pawn structure, theme tags instead of vectors (Step 7)", BLUE),
        ("Made-up reasons for a correct move", "explains whatever it is handed (Step 3)", "Grounded explanation", "the engine supplies the better move and its line (Step 9)", RED),
        ("Not repeatable", "sampling from a distribution (Step 3)", "The review", "exact and repeatable, engine only (Step 8)", RED),
        ("Gives the game away", "says what it knows", "Help setting", "what the model may see is set where the context is built (Step 10)", BLUE),
        ("Hidden instructions in data", "instruction and data in one stream (Step 4)", "Quoted input, checked output", "trust boundary at the tool layer (Part 3)", INK),
    ]
    LX, LW, RX, RW, Y0, RH = 24, 300, 400, 296, 92, 40
    s.rect(LX, 62, LW, 20, INK, rx=4)
    s.text(LX + LW / 2, 76, "Language model: systematic flaws", 8.5, "#FFFFFF", "bold", "middle")
    s.rect(RX, 62, RW, 20, INK, rx=4)
    s.text(RX + RW / 2, 76, "Engine, index and checker: compensations", 8.5, "#FFFFFF", "bold", "middle")
    for i, (fl, cause, fix, how, col) in enumerate(rows):
        y = Y0 + i * RH
        s.rect(LX, y, LW, RH - 6, CHIP, rx=4)
        s.text(LX + 10, y + 15, fl, 8.6, INK, "bold")
        s.text(LX + 10, y + 27, cause, 7.2, MUTED)
        s.rect(RX, y, RW, RH - 6, "#FFFFFF", col, rx=4, sw=1)
        s.text(RX + 10, y + 15, fix, 8.6, col if col != INK else INK, "bold")
        s.text(RX + 10, y + 27, how, 7.2, MUTED)
        s.arrow(LX + LW + 6, y + (RH - 6) / 2, RX - 4, y + (RH - 6) / 2, col, "arrr" if col == RED else ("arrb" if col == BLUE else "arr"), 1.4)
    s.text(24, 422, "Red: the engine and the checker.  Blue: the index and the context.  Illustrative grouping; Part 2 has the detail.", 7, MUTED)
    s.save("fig01_flaw_to_fix.svg")


# ------------------------------------------------------------------ fig02
def fig02():
    s = S(720, 340, "Tokenization",
          "A sentence cut into one token per word, the move list 1. e4 e5 2. Nf3 d6 3. d4 cut into fragments, and a FEN string cut into tokens that run across the ranks of the board.")
    s.text(24, 30, "Tokenization", 16, INK, "bold")
    s.text(24, 46, "The model reads fragments of text, not words, squares or pieces. Illustrative cut in the style of a byte-pair vocabulary.", 8.5, MUTED)
    cols = [RED2, CHIP]
    s.text(24, 76, "A sentence", 9, INK, "bold")
    x = 24
    for i, t in enumerate(["The", " bishop", " pins", " the", " knight", " to", " the", " queen", "."]):
        w = 16 + 6.5 * len(t)
        s.chip(x, 86, w, 22, t.replace(" ", "␣"), 9, cols[i % 2], INK)
        x += w + 3
    s.text(x + 8, 101, "one token per word", 8, MUTED)
    s.text(24, 150, "Move list", 9, INK, "bold")
    toks = ["1", ".", " e", "4", " e", "5", " 2", ".", " N", "f", "3", " d", "6", " 3", ".", " d", "4"]
    x = 24
    for i, t in enumerate(toks):
        w = 16 + 7 * len(t)
        s.chip(x, 160, w, 22, t.replace(" ", "␣"), 9, cols[i % 2], INK, "bold" if t.strip() in ("d", "4") and i >= 15 else "normal")
        x += w + 3
    s.text(x + 8, 175, "→ next token?", 8.5, MUTED)
    s.text(24, 200, "The square e4 is two tokens; Nf3 is three. The model has to learn from text alone that ␣e followed by 4 names a square.", 7.6, MUTED)
    s.text(24, 236, "Position (FEN)", 9, INK, "bold")
    fen = "rn2kb1r/pp2qppp/2p2n2/4p1B1/2B1P3/1QN5/PPP2PPP/R3K2R b KQkq - 1 9"
    ftoks = ["rn", "2", "kb", "1", "r", "/pp", "2", "q", "ppp", "/", "2", "p", "2", "n", "2", "/", "4", "p", "1", "B", "1", "/", "2",
             "B", "1", "P", "3", "/", "1", "QN", "5", "/", "PPP", "2", "PPP", "/R", "3", "K", "2", "R", " b", " KQ", "kq", " -", " 1", " 9"]
    assert "".join(ftoks) == fen, "".join(ftoks)
    x, y = 24, 246
    for i, t in enumerate(ftoks):
        w = 10 + 6.2 * len(t)
        if x + w > 696:
            x, y = 24, y + 27
        s.chip(x, y, w, 20, t.replace(" ", "␣"), 8.5, cols[i % 2], INK)
        x += w + 2
    s.text(24, y + 40, "Rank boundaries (“/”) and token boundaries do not line up: a token such as “/pp” spans two ranks, and “QN” two pieces.", 7.6, MUTED)
    s.text(24, y + 52, "The position after 9. Bg5 in the Opera Game. Black to move.", 7.6, MUTED)
    s.save("fig02_tokenization.svg")


# ------------------------------------------------------------------ fig03
def fig03():
    s = S(720, 360, "Embedding",
          "A two-dimensional sketch of the embedding space. Left, ordinary words: king, queen, man, woman with parallel arrows, and the word bank "
          "between its river sense and its money sense. Right, chess tokens grouped by use, and the token d4 moved by its context in the Philidor.")
    s.text(24, 30, "Embedding", 16, INK, "bold")
    s.text(24, 46, "Tokens used in similar ways end up close together. Two of 12,288 dimensions, illustrative. Words on the left, moves on the right.", 8.5, MUTED)
    s.panel(24, 60, 672, 282)
    s.a(f'<line x1="360" y1="72" x2="360" y2="330" stroke="{LINE}" stroke-width="0.8" stroke-dasharray="3 3"/>')
    s.text(40, 80, "Words", 8.5, INK, "bold")
    s.text(376, 80, "Chess moves", 8.5, INK, "bold")
    def dot(x, y, label, col=INK, size=8, weight="normal", dx=5, dy=3, anchor="start"):
        s.a(f'<circle cx="{x}" cy="{y}" r="2.8" fill="{col}"/>')
        s.text(x + dx, y + dy, label, size, col, weight, anchor)
    def cloud(x, y, w, h, label):
        s.a(f'<ellipse cx="{x}" cy="{y}" rx="{w}" ry="{h}" fill="{CHIP}" stroke="{LINE}" stroke-width="0.6"/>')
        s.text(x, y - h + 11, label, 7, MUTED, anchor="middle", style="italic")
    # king/queen/man/woman parallelogram
    cloud(150, 150, 95, 58, "people and rank")
    pts = {"man": (90, 170), "woman": (150, 184), "king": (130, 128), "queen": (190, 142)}
    for l, (x, y) in pts.items():
        dot(x, y, l, INK, 8, "bold" if l in ("king", "queen") else "normal")
    s.arrow(93, 166, 127, 133, MUTED, "arrm", 0.9, dash="3 2")
    s.arrow(153, 180, 187, 147, MUTED, "arrm", 0.9, dash="3 2")
    s.text(150, 214, "king \u2212 man + woman \u2248 queen", 7, MUTED, anchor="middle", style="italic")
    # bank between two senses
    cloud(110, 282, 58, 32, "river words")
    for (x, y, l) in [(90, 284, "shore"), (118, 294, "water")]:
        dot(x, y, l, MUTED)
    cloud(290, 282, 58, 32, "money words")
    for (x, y, l) in [(272, 284, "loan"), (296, 294, "account")]:
        dot(x, y, l, MUTED)
    dot(200, 262, "bank", INK, 8, "bold", dx=-14, dy=-6)
    s.arrow(194, 266, 142, 278, RED, "arrr", 1.3)
    s.arrow(206, 266, 258, 278, RED, "arrr", 1.3)
    s.text(200, 248, "one point, two senses", 6.6, RED, anchor="middle")
    s.text(200, 318, "\u201cthe river bank\u201d \u00b7 \u201cthe bank approved the loan\u201d", 6.6, MUTED, anchor="middle")
    # chess side
    cloud(450, 140, 62, 44, "knight moves")
    for (x, y, l) in [(425, 140, "Nf3"), (460, 128, "Nc3"), (468, 156, "Nc6")]:
        dot(x, y, l)
    cloud(600, 130, 62, 44, "bishop moves")
    for (x, y, l) in [(575, 130, "Bg4"), (612, 118, "Bg5"), (615, 146, "Bb5")]:
        dot(x, y, l)
    cloud(520, 262, 88, 52, "center pawn moves")
    for (x, y, l) in [(485, 256, "e4"), (525, 240, "e5"), (560, 262, "d5"), (505, 282, "d4"), (545, 290, "exd4")]:
        dot(x, y, l, INK, 8, "bold" if l == "d4" else "normal")
    s.path("M507,280 C540,230 590,205 640,190", RED, 1.6, "arrr")
    s.a(f'<circle cx="644" cy="188" r="3.4" fill="{RED}"/>')
    s.text(644, 176, "d4 after 1. e4 e5 2. Nf3 d6", 7.2, RED, "bold", "end")
    s.text(634, 198, "the Philidor: a challenge to e5,", 6.6, RED, anchor="end")
    s.text(634, 207, "a pin on f3 available", 6.6, RED, anchor="end")
    s.text(470, 304, "d4 as a first move", 6.6, MUTED, style="italic")
    s.text(686, 326, "Step 3: context moves the point", 7, RED, anchor="end")
    s.save("fig03_embedding.svg")


# ------------------------------------------------------------------ fig05 (attention grid)
def fig05():
    import numpy as np
    TOK = ["1.", "e4", "e5", "2.", "Nf3", "d6", "3.", "d4"]
    N = len(TOK)
    HEADS = {"A": RED, "B": RED2, "C": RED3}
    COL_HEAD = {1: "A", 4: "B", 5: "B", 2: "C"}
    rng = np.random.default_rng(3)
    W = np.zeros((N, N))
    for i in range(N):
        raw = rng.uniform(0.3, 1.0, i + 1)
        raw[i] += 0.9
        if i >= 1:
            raw[i - 1] += 0.4
        if TOK[i].endswith("."):
            raw[i] += 1.5
        W[i, :i + 1] = raw / raw.sum()
    W[7] = [.03, .20, .22, .02, .12, .16, .03, .22]
    assert abs(W.sum(1) - 1).max() < 1e-9
    RAMP = ["#FDF3F1", "#FBC5BA", "#F8553B", "#C32B17", "#8A1004"]
    def hex2rgb(h):
        return np.array([int(h[k:k + 2], 16) for k in (1, 3, 5)], float)
    def ramp(v, vmax=0.5):
        t = min(max(v / vmax, 0), 1) * (len(RAMP) - 1)
        k = min(int(t), len(RAMP) - 2)
        c = hex2rgb(RAMP[k]) * (1 - (t - k)) + hex2rgb(RAMP[k + 1]) * (t - k)
        return "#%02X%02X%02X" % tuple(int(round(x)) for x in c)
    s = S(720, 405, "Attention pattern",
          "An eight by eight grid of illustrative attention weights for the tokens 1. e4 e5 2. Nf3 d6 3. d4. Each row is one token looking back "
          "at the tokens before it; cells above the diagonal are masked. The row for d4 is highlighted with its percentages.")
    s.a('<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        '<rect width="5" height="5" fill="#EEF2F3"/><line x1="0" y1="0" x2="0" y2="5" stroke="#E3E9EA" stroke-width="2"/></pattern>'
        '<linearGradient id="scale" x1="0" x2="1">' + "".join(
            f'<stop offset="{k / (len(RAMP) - 1):.2f}" stop-color="{c}"/>' for k, c in enumerate(RAMP)) + '</linearGradient></defs>')
    s.text(24, 34, "Attention pattern", 16, INK, "bold")
    s.text(24, 52, "Illustrative weights for the move list. Each row is one token looking back at the tokens before it.", 8.5, MUTED)
    GX, GY, CW, CH = 104, 96, 44, 29
    s.text(GX + N * CW / 2, 70, "looks at (earlier tokens) →", 7.5, MUTED, anchor="middle")
    s.text(20, GY + N * CH / 2, "token ↓", 7.5, MUTED, anchor="middle", extra=f' transform="rotate(-90 20 {GY + N * CH / 2})"')
    for j, t in enumerate(TOK):
        s.rect(GX + j * CW + 1.5, GY - 18, CW - 3, 14, "#FFF1D6" if t == "d4" else CHIP)
        s.text(GX + j * CW + CW / 2, GY - 8, t, 7, INK, "bold" if t == "d4" else "normal", "middle")
    for i, t in enumerate(TOK):
        cy = GY + i * CH + CH / 2
        s.rect(GX - 62, cy - 8, 56, 16, "#FFF1D6" if t == "d4" else CHIP)
        s.text(GX - 34, cy + 2.8, t, 7.5, INK, "bold" if t == "d4" else "normal", "middle")
    for i in range(N):
        for j in range(N):
            x, y = GX + j * CW, GY + i * CH
            fill = "url(#hatch)" if j > i else ramp(W[i, j])
            s.a(f'<rect x="{x}" y="{y}" width="{CW}" height="{CH}" fill="{fill}" stroke="#FFFFFF" stroke-width="1.2"/>')
            if i == N - 1:
                v = W[i, j]
                dark = hex2rgb(ramp(v)) @ [0.299, 0.587, 0.114] < 150
                s.text(x + CW / 2, y + CH / 2 + 2.8, f"{round(v * 100)} %", 7, "#FFFFFF" if dark else INK, "bold", "middle")
    s.rect(GX - 0.5, GY + (N - 1) * CH - 0.5, N * CW + 1, CH + 1, "none", INK, rx=1.5, sw=1.6)
    by = GY + N * CH + 5
    for j in range(N):
        h = COL_HEAD.get(j)
        s.rect(GX + j * CW + 2, by, CW - 4, 5, HEADS[h] if h else "#D5DDE0", rx=1.5)
    ly, lx = by + 20, GX
    for h, lab in [("A", "Head A ≈ same side, same kind: e4 and d4"), ("B", "Head B ≈ opening pattern: Nf3, d6"), ("C", "Head C ≈ attacker and target: e5")]:
        s.rect(lx, ly - 7, 10, 7, HEADS[h], rx=1.5)
        s.text(lx + 14, ly, lab, 7.2, INK)
        lx += 150 if h == "A" else 140
    s.text(GX, ly + 14, "Head colors mark which head contributes most to each weight of the d4 row.", 7, MUTED)
    def badge(cx, cy, n):
        s.a(f'<circle cx="{cx}" cy="{cy}" r="7.5" fill="{INK}"/>')
        s.text(cx, cy + 3, str(n), 8.5, "#FFFFFF", "bold", "middle")
    badge(GX + N * CW + 12, GY + (N - 1) * CH + CH / 2, 1)
    badge(GX + 6 * CW, GY + 2 * CH, 2)
    badge(GX + 4.5 * CW, GY + 3.5 * CH, 3)
    PX = 492
    s.a(f'<line x1="{PX - 8}" y1="84" x2="{PX - 8}" y2="384" stroke="{LINE}" stroke-width="0.8"/>')
    y = 92
    def note(num, head, lines):
        nonlocal y
        if num:
            s.a(f'<circle cx="{PX + 7}" cy="{y - 3.5}" r="6.5" fill="{INK}"/>')
            s.text(PX + 7, y - 0.8, str(num), 7.5, "#FFFFFF", "bold", "middle")
            hx = PX + 19
        else:
            hx = PX
        s.text(hx, y, head, 9, INK, "bold")
        y += 12
        for ln in lines:
            s.text(hx, y, ln, 7.6, MUTED)
            y += 10.2
        y += 8
    note(1, "The d4 row", ["d4 looks back at every earlier token.", "Its weights add up to 100 %. These are", "the arcs on the transformer figure."])
    note(2, "No look-ahead", ["Gray cells are masked: a token never", "sees the tokens that come after it."])
    note(3, "The diagonal", ["Each token also looks at itself."])
    note(None, "Parallel in training", ["All rows are computed at once; every row", "predicts its own next token."])
    note(None, "One row at a time in generation", ["Each new token adds one row. Earlier", "rows stay fixed in the KV cache."])
    note(None, "Cost grows with the square", ["8 tokens → 64 cells;", "1,000 tokens → a million cells."])
    sy = max(y, 350)
    s.text(PX, sy, "Attention weight", 7.5, INK, "bold")
    s.rect(PX, sy + 5, 150, 8, "url(#scale)", rx=2)
    s.text(PX, sy + 23, "0 %", 7, MUTED)
    s.text(PX + 150, sy + 23, "≥ 50 %", 7, MUTED, anchor="end")
    s.rect(PX + 162, sy + 5, 14, 8, "url(#hatch)", rx=0)
    s.text(PX + 180, sy + 12, "masked", 7, MUTED)
    s.save("fig05_attention_pattern.svg")


# ------------------------------------------------------------------ fig06 (relabel)
def embedding_shift_inner():
    src = open("/mnt/user-data/outputs/embedding-shift.svg").read()
    src = re.sub(r"<\?xml[^>]*\?>", "", src)
    src = src.replace(">Amount + context<", ">d4 + context<").replace(">Amount<", ">d4<")
    return src


def fig06():
    src = embedding_shift_inner()
    open(OUT + "fig06_embedding_shift.svg", "w").write(src)
    print("wrote fig06_embedding_shift.svg")


# ------------------------------------------------------------------ fig04 (transformer, rebuilt)
def fig04():
    s = S(720, 300, "The transformer for the running example",
          "Top: input 1. e4 e5 2. Nf3 d6 3. d4, 96 layers of attention and MLP, unembedding, output distribution with Bg4 first. "
          "Middle: the attention panel with arcs from d4 to earlier tokens and three heads; the MLP panel with features. "
          "Bottom: the embedding shift of d4 and the unembedding with Bg4, exd4, Nd7 and Nf6.")
    # top strip
    s.panel(6, 6, 232, 42)
    s.text(14, 20, "Input:", 8, INK, "bold")
    s.text(14, 31, "token embedding vector", 8, INK)
    s.text(14, 42, "“… 2. Nf3 d6 3. d4”", 8, MUTED, style="italic")
    s.arrow(240, 27, 254, 27, INK, "arr", 1.2)
    s.panel(258, 6, 228, 42)
    x = 266
    for k in range(13):
        col_a = RED3 if k < 3 else (RED if k < 6 else "#FF7A3A")
        col_m = BLUE if k < 6 else CYAN
        if k == 12:
            col_a, col_m = YEL, CYAN2
        if k == 11:
            s.text(x + 6, 29, "…", 10, INK, "bold")
            x += 16
            continue
        s.rect(x, 12, 7, 16, col_a, rx=1.5)
        s.text(x + 3.5, 24, "A", 5.5, "#FFFFFF", "bold", "middle")
        s.rect(x + 8, 12, 7, 16, col_m, rx=1.5)
        s.text(x + 11.5, 24, "M", 5.5, "#FFFFFF", "bold", "middle")
        lab = {0: "1", 1: "2", 2: "3", 3: "4", 8: "10", 9: "11", 10: "12", 12: "96"}.get(k)
        if lab:
            s.text(x + 7.5, 40, lab, 5.5, MUTED, anchor="middle")
        x += 17.5
    s.text(372, 44, "96 layers", 7.5, INK, "bold", "middle")
    s.arrow(488, 27, 502, 27, INK, "arr", 1.2)
    s.rect(506, 6, 208, 42, "#FDEDEA", RED2, rx=6, sw=0.8)
    s.chip(512, 17, 12, 18, "U", 7, MUTED, "#FFFFFF", "bold")
    s.text(530, 20, "Output:", 8, INK, "bold")
    s.text(530, 31, "token distribution", 8, INK)
    s.text(530, 42, "“Bg4” 48 %, then exd4, Nd7, Nf6", 8, BLUE, "bold")
    # attention panel
    s.panel(6, 54, 480, 112)
    s.a(f'<circle cx="22" cy="70" r="8" fill="{RED}"/>')
    s.text(22, 73, "A", 8, "#FFFFFF", "bold", "middle")
    s.text(34, 74, "Attention", 11, INK, "bold")
    s.text(100, 68, "Token looks back and adds what is relevant. Features are captured", 7.2, MUTED)
    s.text(100, 78, "in 96 parallel heads (per layer, numbers for GPT-3).", 7.2, MUTED)
    toks = ["1.", "e4", "e5", "2.", "Nf3", "d6", "3.", "d4"]
    tx, ty = 16, 132
    centers = []
    for t in toks:
        w = 20 + 6 * len(t)
        cur = t == "d4"
        s.chip(tx, ty, w, 20, t, 8.5, "#FFFFFF" if cur else CHIP, INK, "bold", INK if cur else "none")
        centers.append(tx + w / 2)
        tx += w + 5
    s.text(centers[-1], ty + 29, "Current position", 6, MUTED, anchor="middle")
    arcs = [(1, RED, 1.8), (2, RED3, 1.6), (4, RED2, 1.4), (5, RED2, 1.4), (0, RED2, 0.7), (3, RED2, 0.6), (6, RED2, 0.6)]
    x0 = centers[-1]
    for j, col, sw in arcs:
        x1 = centers[j]
        h = 18 + (x0 - x1) * 0.22
        s.path(f"M{x0},{ty - 1} C{x0},{ty - h} {x1},{ty - h} {x1},{ty - 1}", col, sw, "arrr" if sw > 1 else None)
    hx = 318
    s.rect(hx, 88, 24, 2.5, RED)
    s.text(hx + 28, 92, "Head A ≈ same side, same kind", 7.2, RED, "bold")
    s.text(hx + 28, 101, "relates e4 and d4, the center pawns", 6.6, MUTED)
    s.rect(hx, 108, 24, 2.5, RED2)
    s.text(hx + 28, 112, "Head B ≈ opening pattern", 7.2, RED2, "bold")
    s.text(hx + 28, 121, "relates e4 e5 Nf3 d6 d4, the Philidor", 6.6, MUTED)
    s.rect(hx, 128, 24, 2.5, RED3)
    s.text(hx + 28, 132, "Head C ≈ attacker and target", 7.2, RED3, "bold")
    s.text(hx + 28, 141, "relates d4 and e5", 6.6, MUTED)
    # MLP panel
    s.panel(492, 54, 222, 112)
    s.a(f'<circle cx="508" cy="70" r="8" fill="{CYAN}"/>')
    s.text(508, 73, "M", 8, "#FFFFFF", "bold", "middle")
    s.text(520, 74, "MLP", 11, INK, "bold")
    s.text(556, 68, "Nonlinear combination and", 7.2, MUTED)
    s.text(556, 78, "transformation of features.", 7.2, MUTED)
    s.text(500, 94, "vector after attention", 6, MUTED)
    s.text(606, 94, "detectors", 6, MUTED, anchor="middle")
    s.text(706, 94, "update, to next layer", 6, MUTED, anchor="end")
    pins = [("e5 pawn attacked", RED), ("knight on f3 pinnable", RED2), ("Philidor, famous game", RED3)]
    py = [108, 124, 140]
    for (lab, col), yy in zip(pins, py):
        s.text(560, yy + 3, lab, 6.6, INK, anchor="end")
        s.a(f'<circle cx="566" cy="{yy}" r="3.2" fill="{col}"/>')
    dets = [(606, 104), (606, 116), (606, 128), (606, 140), (606, 152)]
    for (dx, dy) in dets:
        for yy in py:
            s.a(f'<line x1="569" y1="{yy}" x2="{dx}" y2="{dy}" stroke="{LINE}" stroke-width="0.6"/>')
        s.a(f'<circle cx="{dx}" cy="{dy}" r="2.6" fill="{"#C9D3D6"}"/>')
        s.a(f'<line x1="{dx}" y1="{dy}" x2="650" y2="124" stroke="{LINE}" stroke-width="0.6"/>')
    s.a(f'<circle cx="606" cy="128" r="4" fill="{CYAN}"/>')
    for yy, col in zip(py, [RED, RED2, RED3]):
        s.a(f'<line x1="569" y1="{yy}" x2="606" y2="128" stroke="{col}" stroke-width="1.2"/>')
    s.arrow(610, 128, 650, 124, BLUE, "arrb", 1.6)
    s.text(656, 120, "(Bg4 pins the", 6.8, BLUE, "bold", style="italic")
    s.text(656, 129, "knight and", 6.8, BLUE, "bold", style="italic")
    s.text(656, 138, "develops)", 6.8, BLUE, "bold", style="italic")
    # embedding shift (nested)
    inner = embedding_shift_inner()
    inner = re.sub(r'<svg([^>]*)>', lambda m: '<svg' + re.sub(r'\s(width|height)="[^"]*"', '', m.group(1)) + ' x="6" y="172" width="480" height="98">', inner, count=1)
    s.a(f'<rect x="6" y="172" width="480" height="122" rx="6" fill="{PANEL}" stroke="{LINE}" stroke-width="0.8"/>')
    s.a(inner)
    s.text(16, 288, "Layer by layer, attention (a) and MLP (m) pushes move the point for d4; the pushes add up to its meaning in this game.", 6.6, MUTED)
    # unembedding
    s.panel(492, 172, 222, 122)
    s.a(f'<circle cx="508" cy="188" r="8" fill="{MUTED}"/>')
    s.text(508, 191, "U", 8, "#FFFFFF", "bold", "middle")
    s.text(520, 192, "Unembedding", 11, INK, "bold")
    s.text(500, 206, "Distance to 50,257 token embeddings → probabilities", 6.6, MUTED)
    s.a(f'<ellipse cx="610" cy="250" rx="90" ry="34" fill="{CHIP}" stroke="{LINE}" stroke-width="0.8" stroke-dasharray="3 2"/>')
    s.a(f'<line x1="486" y1="250" x2="596" y2="250" stroke="{MUTED}" stroke-width="0.8"/>')
    s.a(f'<circle cx="598" cy="250" r="4" fill="{MUTED}"/>')
    s.a(f'<line x1="598" y1="250" x2="626" y2="246" stroke="{BLUE}" stroke-width="1" stroke-dasharray="2 2"/>')
    s.a(f'<circle cx="628" cy="246" r="5" fill="none" stroke="{BLUE}" stroke-width="1.5"/><circle cx="628" cy="246" r="2" fill="{BLUE}"/>')
    s.text(636, 249, "Bg4", 8, BLUE, "bold", style="italic")
    s.text(656, 249, "48 %", 7, BLUE)
    for (x, y, l, p) in [(575, 232, "exd4", "25 %"), (552, 260, "Nd7", "10 %"), (640, 270, "Nf6", "7 %")]:
        s.a(f'<circle cx="{x}" cy="{y}" r="2.4" fill="{MUTED}"/>')
        s.text(x + 5, y + 3, f"{l} {p}", 6.8, MUTED)
    s.save("fig04_transformer.svg")


# ------------------------------------------------------------------ fig07
def fig07():
    s = S(720, 300, "The context window",
          "Left: the context window holding rules, facts, the move list and the question, with earlier material faded. Middle: the board "
          "the model never had, drawn with question marks. Right: a curve of how far the model's internal board drifts from the real one as the game goes on.")
    s.text(24, 30, "The context window", 16, INK, "bold")
    s.text(24, 46, "What the model can see is the text in the window. The board is never in it.", 8.5, MUTED)
    # window
    s.panel(24, 62, 280, 220, "In the window")
    items = [("system prompt: role and rules", MUTED), ("facts the application adds", MUTED), ("1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3", INK),
             ("5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6", INK), ("9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 …", INK), ("the question", MUTED)]
    yy = 92
    for t, c in items:
        s.rect(36, yy, 256, 18, CHIP if c == MUTED else "#FFF1D6", rx=3)
        s.text(44, yy + 12, t, 7.4, c)
        yy += 23
    s.text(36, yy + 12, "Everything else is outside: no memory between calls,", 7, MUTED)
    s.text(36, yy + 22, "no board, no engine, unless the application adds it.", 7, MUTED)
    s.text(36, yy + 40, "Cost: attention grows with the square of the window.", 7, MUTED, style="italic")
    # board never had
    s.panel(320, 62, 170, 220, "The board the model never had")
    bx, by, c = 352, 96, 15
    for r in range(8):
        for f in range(8):
            s.rect(bx + f * c, by + r * c, c, c, "#DDE3E6" if (r + f) % 2 else "#F6F8F9", rx=0)
    for (r, f) in [(1, 4), (3, 3), (4, 5), (6, 2), (2, 6)]:
        s.text(bx + f * c + c / 2, by + r * c + c * 0.72, "?", 9, RED, "bold", "middle")
    s.text(405, 232, "reconstructed from the move list,", 6.8, MUTED, anchor="middle")
    s.text(405, 242, "approximately (Karvonen 2024)", 6.8, MUTED, anchor="middle")
    # drift
    s.panel(506, 62, 190, 220, "Drift and dilution")
    ox, oy, w, h = 530, 100, 150, 120
    s.a(f'<line x1="{ox}" y1="{oy + h}" x2="{ox + w}" y2="{oy + h}" stroke="{MUTED}" stroke-width="0.8"/>')
    s.a(f'<line x1="{ox}" y1="{oy}" x2="{ox}" y2="{oy + h}" stroke="{MUTED}" stroke-width="0.8"/>')
    pts = []
    for k in range(0, 61, 4):
        agree = 1.0 / (1 + (k / 32.0) ** 2.2)
        pts.append((ox + k / 60 * w, oy + h - agree * (h - 6)))
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    s.path(d, RED, 1.6)
    pts2 = [(ox + k / 60 * w, oy + h - (0.65 / (1 + (k / 55.0) ** 3) + 0.35) * (h - 6)) for k in range(0, 61, 4)]
    s.path("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts2), RED2, 1.4, dash="3 2")
    s.text(ox + w, oy + h + 11, "move 60", 6.5, MUTED, anchor="end")
    s.text(ox, oy + h + 11, "move 1", 6.5, MUTED)
    s.text(ox - 6, oy + h / 2, "agreement of internal and real board", 6, MUTED, anchor="middle", extra=f' transform="rotate(-90 {ox - 6} {oy + h / 2})"')
    s.rect(ox + 8, oy + h - 36, 12, 2.2, RED)
    s.text(ox + 24, oy + h - 33, "plain model", 6.4, INK)
    s.rect(ox + 8, oy + h - 24, 12, 2.2, RED2)
    s.text(ox + 24, oy + h - 21, "reasoning model", 6.4, INK)
    s.text(ox + 24, oy + h - 12, "(later, less often, not never)", 5.8, MUTED)
    s.text(ox, oy + h + 22, "Illustrative curves; the engine's board", 6.2, MUTED)
    s.text(ox, oy + h + 31, "stays exact at every move.", 6.2, MUTED)
    s.save("fig07_context_window.svg")


# ------------------------------------------------------------------ fig08 (the loop)
def fig08():
    s = S(720, 330, "The loop",
          "A cycle: the board position goes to the engine, the engine's facts pass a valve set by the help setting into the model, "
          "the model's answer passes the checker, the player reads it and decides the move, which changes the board.")
    s.text(24, 30, "The loop", 16, INK, "bold")
    s.text(24, 46, "The engine produces facts, the model turns them into words, the checker verifies the words, the player decides.", 8.5, MUTED)
    def box(x, y, w, h, title, lines, col=INK, fill="#FFFFFF"):
        s.rect(x, y, w, h, fill, col, rx=6, sw=1.2)
        s.text(x + w / 2, y + 17, title, 9.5, col, "bold", "middle")
        for i, l in enumerate(lines):
            s.text(x + w / 2, y + 31 + i * 10, l, 6.8, MUTED, anchor="middle")
    box(40, 130, 130, 64, "Board", ["position (FEN)", "the exact state"], INK)
    box(220, 70, 150, 64, "Engine", ["Stockfish: lines, scores,", "motifs, themes", "deterministic"], RED)
    box(420, 70, 150, 64, "Model", ["Claude: plans, reasons,", "lessons", "generation"], BLUE)
    box(420, 200, 150, 64, "Checker", ["chess.js + engine lines", "backed / unlisted / wrong"], RED)
    box(220, 200, 150, 64, "Player", ["reads, asks, decides", "the move"], INK)
    # arrows
    s.arrow(170, 150, 220, 112, INK, "arr", 1.3)
    s.text(176, 122, "position", 6.6, MUTED)
    # valve between engine and model
    s.arrow(370, 102, 420, 102, RED, "arrr", 1.6)
    s.a(f'<polygon points="388,94 402,102 388,110" fill="#FFFFFF" stroke="{RED}" stroke-width="1"/>')
    s.a(f'<polygon points="402,94 388,102 402,110" fill="#FFFFFF" stroke="{RED}" stroke-width="1" transform="translate(0,0)"/>')
    s.text(395, 90, "help setting", 6.6, RED, anchor="middle")
    s.text(395, 124, "Off · Flag mistakes · Full", 6.2, MUTED, anchor="middle")
    s.text(395, 133, "facts first", 6.6, RED, "bold", "middle")
    s.arrow(495, 134, 495, 200, BLUE, "arrb", 1.6)
    s.text(500, 170, "answer (text)", 6.6, MUTED)
    s.arrow(420, 232, 370, 232, RED, "arrr", 1.6)
    s.text(395, 226, "marked", 6.6, MUTED, anchor="middle")
    s.text(395, 248, "answer", 6.6, MUTED, anchor="middle")
    s.arrow(220, 232, 170, 180, INK, "arr", 1.3)
    s.text(176, 214, "move", 6.6, MUTED)
    s.path("M330,200 C360,160 400,150 440,134", MUTED, 0.9, "arrm", dash="2 2")
    s.text(352, 166, "question", 6.4, MUTED)
    # notes
    s.text(600, 86, "Three guarantees", 8.5, INK, "bold")
    s.lines(600, 100, ["Facts come from the engine,", "never from the model's memory."], 6.8, MUTED, 9.5)
    s.lines(600, 128, ["Every move the model names is", "checked before the player sees it."], 6.8, MUTED, 9.5)
    s.lines(600, 156, ["The player decides; the model", "recommends."], 6.8, MUTED, 9.5)
    s.text(600, 196, "Planned: the model asks the", 6.8, MUTED)
    s.text(600, 206, "engine through tools, within", 6.8, MUTED)
    s.text(600, 216, "caps, read-only, traceable.", 6.8, MUTED)
    s.text(24, 310, "Replace the engine by a scheduler, a rules engine or a billing system and the loop is unchanged.", 7, MUTED, style="italic")
    s.save("fig08_loop.svg")


# ------------------------------------------------------------------ fig15 (architecture)
def fig15():
    s = S(720, 330, "Where things run",
          "The browser page with the board, Stockfish in Web Workers, chess.js and the symbolic knowledge, and an optional in-browser model; "
          "the local server with static files, model weights and the AI gateway that holds the keys; the providers behind the gateway.")
    s.text(24, 30, "Where things run", 16, INK, "bold")
    s.text(24, 46, "A single page plus a small local server. Keys stay on the server; the engine runs in the page.", 8.5, MUTED)
    def box(x, y, w, h, title, lines, col=INK):
        s.rect(x, y, w, h, "#FFFFFF", col, rx=5, sw=1)
        s.text(x + w / 2, y + 15, title, 8.2, col, "bold", "middle")
        for i, l in enumerate(lines):
            s.text(x + w / 2, y + 27 + i * 9.5, l, 6.4, MUTED, anchor="middle")
    # server group
    s.rect(24, 62, 500, 86, "#F7F9FA", LINE, rx=6, sw=0.8, dash="3 2")
    s.text(32, 74, "Local Node server (site/server)", 7, MUTED, style="italic")
    box(40, 84, 130, 52, "Static files", ["+ security headers (CSP,", "cross-origin isolation)"])
    box(190, 84, 130, 52, "Model weights", ["site/models", "(offline mode only)"])
    box(350, 84, 150, 52, "AI gateway /api/ai/", ["keys from .env, limits,", "schema validation, NDJSON"], RED)
    box(560, 84, 136, 52, "Providers", ["Anthropic (Claude), OpenAI,", "Mistral, Ollama"], RED)
    s.arrow(500, 110, 560, 110, RED, "arrr", 1.3)
    # browser group
    s.rect(24, 164, 500, 150, "#F7F9FA", LINE, rx=6, sw=0.8, dash="3 2")
    s.text(32, 176, "Browser page (site/src)", 7, MUTED, style="italic")
    box(40, 192, 150, 52, "Board, dialogue, panels", ["index.html + ES modules", "no framework, no bundler"], INK)
    box(40, 256, 150, 46, "In-browser model", ["optional: wllama on", "WebGPU / WASM"], BLUE)
    s.arrow(115, 244, 115, 256, MUTED, "arrm", 0.8, dash="2 2")
    s.text(120, 253, "quick or offline", 6, MUTED)
    box(230, 186, 130, 46, "Stockfish 19 (WASM)", ["analyst + opponent", "Web Workers"], RED)
    box(230, 242, 130, 46, "Symbolic knowledge", ["chess.js, knowledge.js,", "tutor.js, play.js"], RED)
    box(390, 214, 120, 46, "Checker", ["checkAnswer() in tutor.js", "marks every move"], RED)
    s.arrow(190, 212, 230, 206, INK, "arr", 1)
    s.arrow(190, 226, 230, 262, INK, "arr", 1)
    s.arrow(360, 262, 390, 246, INK, "arr", 1)
    s.arrow(150, 192, 400, 136, BLUE, "arrb", 1.3)
    s.text(262, 156, "facts + question", 6.4, BLUE)
    s.path("M105,164 C105,150 105,150 105,136", MUTED, 0.8, "arrm", dash="2 2")
    s.text(110, 152, "serves the page", 6, MUTED)
    s.text(24, 326, "Other deployments of the same page: as a Claude artifact (host model instead of the gateway), or fully offline (in-browser model, nothing leaves the machine).", 6.6, MUTED)
    s.save("fig15_where_things_run.svg")


if __name__ == "__main__":
    fig01(); fig02(); fig03(); fig04(); fig05(); fig06(); fig07(); fig08(); fig15()
