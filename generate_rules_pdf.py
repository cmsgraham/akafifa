"""Generate a slick branded PDF of the REDZONE rules.

Usage:
    python3 generate_rules_pdf.py
Output:
    redzone_rules.pdf  (in the current directory)
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Brand palette ──────────────────────────────────────────────────────────
RZ_RED = HexColor("#E11D2A")
RZ_RED_DARK = HexColor("#9F1019")
RZ_BG = HexColor("#0B0F14")
RZ_SURFACE = HexColor("#141A22")
RZ_SURFACE_2 = HexColor("#1C2530")
RZ_BORDER = HexColor("#2A3441")
RZ_TEXT = HexColor("#F4F6F8")
RZ_TEXT_MUTED = HexColor("#9BA7B5")
RZ_SUCCESS = HexColor("#22C55E")
RZ_WARNING = HexColor("#F59E0B")
RZ_BLUE = HexColor("#60A5FA")
RZ_PURPLE = HexColor("#A78BFA")

ROOT = Path(__file__).parent
LOGO_HORIZONTAL = ROOT / "frontend" / "public" / "redzone-logo-horizontal.png"
LOGO_STACKED = ROOT / "frontend" / "public" / "redzone-logo-stacked.png"
LOGO_ICON = ROOT / "frontend" / "public" / "redzone-icon-white.png"

PAGE_W, PAGE_H = LETTER
MARGIN = 0.6 * inch

# ── Styles ─────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

H_TITLE = ParagraphStyle(
    "H_TITLE", parent=base["Title"], fontName="Helvetica-Bold",
    fontSize=42, leading=46, textColor=RZ_RED, alignment=TA_LEFT, spaceAfter=4,
)
H_SUB = ParagraphStyle(
    "H_SUB", parent=base["Normal"], fontName="Helvetica",
    fontSize=14, leading=18, textColor=RZ_TEXT_MUTED, spaceAfter=8,
)
H_SECTION = ParagraphStyle(
    "H_SECTION", parent=base["Heading1"], fontName="Helvetica-Bold",
    fontSize=22, leading=26, textColor=RZ_RED, spaceBefore=10, spaceAfter=6,
)
H_SUBSECTION = ParagraphStyle(
    "H_SUBSECTION", parent=base["Heading2"], fontName="Helvetica-Bold",
    fontSize=14, leading=18, textColor=RZ_TEXT, spaceBefore=10, spaceAfter=4,
)
BODY = ParagraphStyle(
    "BODY", parent=base["BodyText"], fontName="Helvetica",
    fontSize=10.5, leading=15, textColor=RZ_TEXT, spaceAfter=6,
)
BODY_MUTED = ParagraphStyle(
    "BODY_MUTED", parent=BODY, textColor=RZ_TEXT_MUTED, fontSize=9.5, leading=13,
)
RULE_TITLE = ParagraphStyle(
    "RULE_TITLE", parent=base["BodyText"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=13, textColor=RZ_TEXT,
)
RULE_DESC = ParagraphStyle(
    "RULE_DESC", parent=base["BodyText"], fontName="Helvetica",
    fontSize=9.5, leading=13, textColor=RZ_TEXT_MUTED, spaceAfter=2,
)
QUOTE = ParagraphStyle(
    "QUOTE", parent=base["BodyText"], fontName="Helvetica-Oblique",
    fontSize=10, leading=14, textColor=RZ_TEXT_MUTED, leftIndent=10,
)
COVER_TITLE = ParagraphStyle(
    "COVER_TITLE", parent=base["Title"], fontName="Helvetica-Bold",
    fontSize=64, leading=68, textColor=RZ_TEXT, alignment=TA_CENTER, spaceAfter=8,
)
COVER_TAG = ParagraphStyle(
    "COVER_TAG", parent=base["Normal"], fontName="Helvetica-Bold",
    fontSize=18, leading=22, textColor=RZ_RED, alignment=TA_CENTER, spaceAfter=20,
)
COVER_SUB = ParagraphStyle(
    "COVER_SUB", parent=base["Normal"], fontName="Helvetica-Oblique",
    fontSize=12, leading=16, textColor=RZ_TEXT_MUTED, alignment=TA_CENTER,
)

# ── Page background painter ────────────────────────────────────────────────
def _draw_background(canvas, doc, *, cover: bool = False):
    canvas.saveState()
    # Solid dark bg
    canvas.setFillColor(RZ_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Top accent stripe
    canvas.setFillColor(RZ_RED)
    canvas.rect(0, PAGE_H - 0.12 * inch, PAGE_W, 0.12 * inch, fill=1, stroke=0)
    # Bottom accent stripe
    canvas.setFillColor(RZ_RED_DARK)
    canvas.rect(0, 0, PAGE_W, 0.12 * inch, fill=1, stroke=0)

    if not cover:
        # Header logo + page number
        try:
            canvas.drawImage(
                str(LOGO_HORIZONTAL),
                MARGIN, PAGE_H - 0.55 * inch,
                width=1.4 * inch, height=0.32 * inch,
                preserveAspectRatio=True, mask="auto",
            )
        except Exception:
            pass
        canvas.setFillColor(RZ_TEXT_MUTED)
        canvas.setFont("Helvetica", 8.5)
        canvas.drawRightString(
            PAGE_W - MARGIN, PAGE_H - 0.45 * inch,
            "REDZONE • Rules & How to Play",
        )
        canvas.drawRightString(
            PAGE_W - MARGIN, 0.32 * inch,
            f"Page {doc.page}",
        )
        canvas.setFillColor(RZ_BORDER)
        canvas.rect(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - 2 * MARGIN, 0.5, fill=1, stroke=0)
    canvas.restoreState()


def on_cover(canvas, doc):
    _draw_background(canvas, doc, cover=True)


def on_content(canvas, doc):
    _draw_background(canvas, doc, cover=False)


# ── Layout helpers ─────────────────────────────────────────────────────────
def card(content_flowables, *, bg=RZ_SURFACE, border=RZ_BORDER, pad=8):
    inner = Table([[content_flowables]], colWidths=[PAGE_W - 2 * MARGIN - 2 * pad])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, border),
        ("LEFTPADDING", (0, 0), (-1, -1), pad),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]))
    return inner


def callout(title, body, *, color=RZ_BLUE, emoji="💡"):
    title_p = Paragraph(
        f'<font color="{color.hexval()}"><b>{emoji} {title}</b></font>', BODY,
    )
    body_p = Paragraph(f'<font color="{RZ_TEXT_MUTED.hexval()}">{body}</font>', BODY_MUTED)
    return card([title_p, Spacer(1, 3), body_p], bg=HexColor("#1A1F2B"), border=color)


def rule_row(title, description):
    check = Paragraph(
        f'<font color="{RZ_RED.hexval()}" size="13"><b>✓</b></font>',
        ParagraphStyle("c", parent=BODY, alignment=TA_CENTER),
    )
    text = [
        Paragraph(title, RULE_TITLE),
        Paragraph(description, RULE_DESC),
    ]
    t = Table([[check, text]], colWidths=[0.32 * inch, PAGE_W - 2 * MARGIN - 0.32 * inch - 16])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RZ_SURFACE_2),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.4, RZ_BORDER),
    ]))
    return t


def step_row(num, text):
    bubble = Paragraph(
        f'<font color="white"><b>{num}</b></font>',
        ParagraphStyle("c", parent=BODY, alignment=TA_CENTER, fontSize=11, leading=14),
    )
    bubble_t = Table([[bubble]], colWidths=[0.34 * inch], rowHeights=[0.34 * inch])
    bubble_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RZ_RED),
        ("BOX", (0, 0), (-1, -1), 0, RZ_RED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    body = Paragraph(text, BODY)
    t = Table(
        [[bubble_t, body]],
        colWidths=[0.5 * inch, PAGE_W - 2 * MARGIN - 0.5 * inch - 16],
    )
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def section_header(num, label, emoji=""):
    """Big red banner with section number."""
    num_p = Paragraph(
        f'<font color="white" size="32"><b>{num:02d}</b></font>',
        ParagraphStyle("n", parent=BODY, alignment=TA_CENTER, leading=34),
    )
    label_p = Paragraph(
        f'<font color="white" size="22"><b>{emoji} {label}</b></font>',
        ParagraphStyle("l", parent=BODY, alignment=TA_LEFT, leading=26),
    )
    t = Table(
        [[num_p, label_p]],
        colWidths=[0.9 * inch, PAGE_W - 2 * MARGIN - 0.9 * inch - 16],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), RZ_RED_DARK),
        ("BACKGROUND", (1, 0), (1, 0), RZ_RED),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def subhead(text):
    return Paragraph(text, H_SUBSECTION)


def fun_quote(text):
    return Paragraph(f'<i>"{text}"</i>', QUOTE)


# ── Story ──────────────────────────────────────────────────────────────────
def build_story():
    story = []

    # ───── COVER ─────
    story.append(Spacer(1, 1.4 * inch))
    if LOGO_STACKED.exists():
        story.append(Image(str(LOGO_STACKED), width=2.6 * inch, height=2.6 * inch, kind="proportional"))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("THE RULEBOOK", COVER_TITLE))
    story.append(Paragraph("⚽  Predict. Duel. Dominate.  ⚽", COVER_TAG))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(
        "Everything you need to know about scoring points,<br/>"
        "winning duels, surviving flash challenges,<br/>"
        "and trash-talking responsibly in the Match Lounge.",
        COVER_SUB,
    ))
    story.append(Spacer(1, 0.6 * inch))
    story.append(Paragraph(
        f'<font color="{RZ_TEXT_MUTED.hexval()}" size="9">'
        "redzone-soccer.com  •  Official Player Handbook  •  Edition 2026"
        "</font>",
        ParagraphStyle("f", parent=BODY, alignment=TA_CENTER),
    ))
    story.append(PageBreak())

    # ───── TABLE OF CONTENTS ─────
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Table of Contents", H_TITLE))
    story.append(Paragraph(
        "Six chapters. One trophy. Zero excuses.", H_SUB,
    ))
    toc_data = [
        ["01", "Scoring", "How points are awarded — and stolen", "3"],
        ["02", "Predictions", "Submit, edit, repeat. Just don't be late.", "5"],
        ["03", "Leaderboard", "Where legends live and tie-breakers happen", "6"],
        ["04", "Duels", "1v1 me, bro — with points on the line", "7"],
        ["05", "Flash Challenges", "Pay to play, pray to win", "9"],
        ["06", "Match Lounge", "Talk smack. Stay classy.", "11"],
    ]
    toc = Table(toc_data, colWidths=[0.5 * inch, 1.6 * inch, 4.2 * inch, 0.5 * inch])
    toc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), RZ_RED),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (0, -1), 14),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("BACKGROUND", (1, 0), (-1, -1), RZ_SURFACE),
        ("TEXTCOLOR", (1, 0), (1, -1), RZ_TEXT),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (1, 0), (1, -1), 12),
        ("TEXTCOLOR", (2, 0), (2, -1), RZ_TEXT_MUTED),
        ("FONTSIZE", (2, 0), (2, -1), 10),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Oblique"),
        ("TEXTCOLOR", (3, 0), (3, -1), RZ_RED),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LINEBELOW", (1, 0), (-1, -2), 0.4, RZ_BORDER),
    ]))
    story.append(toc)
    story.append(Spacer(1, 0.4 * inch))
    story.append(callout(
        "Pro Tip",
        "If you only read one section, make it Scoring. "
        "If you read two, make the second one Duels — that's where the bragging rights live.",
        color=RZ_RED, emoji="🔥",
    ))
    story.append(PageBreak())

    # ───── 01 SCORING ─────
    story.append(section_header(1, "Scoring", "🎯"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("How Scoring Works", H_SECTION))
    story.append(Paragraph(
        "For every match, you predict the final score. After the match is "
        "confirmed, your prediction is scored against the actual result. "
        "Three points if you nailed it, one point if you guessed the right "
        "winner, zero if you backed the wrong horse. Simple as that.",
        BODY,
    ))
    story.append(fun_quote(
        "I predicted Brazil 7–1 Germany once. Nobody believed me. I retired undefeated. — Anonymous"
    ))
    story.append(Spacer(1, 8))

    # Scoring table
    scoring_rows = [
        ["RESULT", "POINTS", "EXAMPLE"],
        [
            Paragraph(
                f'<font color="{RZ_SUCCESS.hexval()}"><b>Exact Score</b></font><br/>'
                f'<font color="{RZ_TEXT_MUTED.hexval()}" size="8">Both home and away scores match exactly</font>',
                BODY,
            ),
            Paragraph(f'<font color="{RZ_SUCCESS.hexval()}" size="22"><b>3</b></font>',
                      ParagraphStyle("c", parent=BODY, alignment=TA_CENTER)),
            Paragraph('You said <b>2-1</b>, result was <b>2-1</b>. Chef\'s kiss.', BODY_MUTED),
        ],
        [
            Paragraph(
                f'<font color="{RZ_WARNING.hexval()}"><b>Correct Outcome</b></font><br/>'
                f'<font color="{RZ_TEXT_MUTED.hexval()}" size="8">Right winner (or draw) but wrong score</font>',
                BODY,
            ),
            Paragraph(f'<font color="{RZ_WARNING.hexval()}" size="22"><b>1</b></font>',
                      ParagraphStyle("c", parent=BODY, alignment=TA_CENTER)),
            Paragraph('You said <b>2-1</b>, result was <b>3-0</b>. Close enough — both home wins.', BODY_MUTED),
        ],
        [
            Paragraph(
                f'<font color="{RZ_TEXT_MUTED.hexval()}"><b>Miss</b></font><br/>'
                f'<font color="{RZ_TEXT_MUTED.hexval()}" size="8">Wrong outcome entirely</font>',
                BODY,
            ),
            Paragraph(f'<font color="{RZ_TEXT_MUTED.hexval()}" size="22"><b>0</b></font>',
                      ParagraphStyle("c", parent=BODY, alignment=TA_CENTER)),
            Paragraph('You said <b>2-1</b>, result was <b>0-0</b>. Pack it up, friend.', BODY_MUTED),
        ],
    ]
    sc_table = Table(scoring_rows, colWidths=[2.3 * inch, 1.0 * inch, 3.0 * inch])
    sc_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RZ_RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, 1), RZ_SURFACE),
        ("BACKGROUND", (0, 2), (-1, 2), RZ_SURFACE_2),
        ("BACKGROUND", (0, 3), (-1, 3), RZ_SURFACE),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RZ_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(sc_table)

    story.append(Spacer(1, 14))
    story.append(callout(
        "Outcome Determination",
        "<b>Home win:</b> home score &gt; away score &nbsp;•&nbsp; "
        "<b>Draw:</b> home = away &nbsp;•&nbsp; "
        "<b>Away win:</b> home &lt; away. We promise we didn't make this up.",
        color=RZ_RED, emoji="📐",
    ))
    story.append(PageBreak())

    # ───── 02 PREDICTIONS ─────
    story.append(section_header(2, "Predictions", "🔮"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Submit One Prediction Per Match", H_SECTION))
    story.append(Paragraph(
        "Submit one prediction per match with your expected final score for each team. "
        "Yes, that means you have to actually pick a number. \"They both score a lot\" "
        "is not a valid prediction. We checked.",
        BODY,
    ))
    story.append(Spacer(1, 6))
    story.append(rule_row(
        "Submit Before Lock Time",
        "Each match has a lock time (default: 1 hour before kickoff). You must submit "
        "your prediction before this time. Once locked, predictions cannot be changed — "
        "not even if your dog ate your tactical analysis."
    ))
    story.append(rule_row(
        "Edit Freely Until Locked",
        "Create, update, or delete your prediction as many times as you want before lock. "
        "Only your final prediction counts. Flip-flop guilt-free."
    ))
    story.append(rule_row(
        "Automatic Scoring",
        "Once a match result is confirmed, points are calculated automatically. "
        "You don't need to do anything — just check the leaderboard and gloat."
    ))
    story.append(rule_row(
        "Score Format",
        "Both home and away scores must be non-negative whole numbers (0, 1, 2, …). "
        "No decimals. No negatives. \"3.14 - π\" will be rejected."
    ))
    story.append(Spacer(1, 12))
    story.append(callout(
        "Tip",
        "Submit your predictions early! If a match kicks off earlier than expected, "
        "late predictions won't be accepted. The server enforces lock time regardless "
        "of what your screen shows. Yes, even if you swear it was on time.",
        color=RZ_BLUE, emoji="💡",
    ))
    story.append(Spacer(1, 8))
    story.append(fun_quote(
        "I'll do my predictions later. — Last words of every player on the leaderboard's bottom half."
    ))
    story.append(PageBreak())

    # ───── 03 LEADERBOARD ─────
    story.append(section_header(3, "Leaderboard", "🏆"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Leaderboard & Rankings", H_SECTION))
    story.append(Paragraph(
        "Your standings are based on accumulated points from predictions and flash "
        "challenges. The leaderboard never lies. Your friends, however, definitely will.",
        BODY,
    ))
    story.append(Spacer(1, 6))
    story.append(subhead("Leaderboard Views"))
    views = [
        [Paragraph('<b>Global</b>', RULE_TITLE),
         Paragraph('<b>By Tournament</b>', RULE_TITLE),
         Paragraph('<b>By Stage</b>', RULE_TITLE)],
        [Paragraph('All matches across all tournaments. The grand stage.', RULE_DESC),
         Paragraph('Points from one tournament only. Pick your battlefield.', RULE_DESC),
         Paragraph('Points from a specific round/stage. Surgical precision.', RULE_DESC)],
    ]
    vt = Table(views, colWidths=[(PAGE_W - 2 * MARGIN - 16) / 3] * 3)
    vt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RZ_SURFACE_2),
        ("BOX", (0, 0), (-1, -1), 0.4, RZ_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RZ_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(vt)
    story.append(Spacer(1, 14))
    story.append(subhead("Tie-Breaker Rules"))
    story.append(Paragraph(
        "When players are tied on points, we use these rules in order. "
        "Yes, even alphabetical. Sorry, Zachary.", BODY_MUTED,
    ))
    story.append(Spacer(1, 4))
    story.append(step_row(1, "Highest total points."))
    story.append(step_row(2, "Most exact-score predictions."))
    story.append(step_row(3, "Most correct-outcome predictions."))
    story.append(step_row(4, "Alphabetical by display name (final tie-breaker — change your name to AAA)."))
    story.append(Spacer(1, 12))
    story.append(callout(
        "Frozen Stages",
        "When a tournament stage ends, an admin may freeze its leaderboard. "
        "Frozen standings are final. No thawing. No appeals. Like a Pixar villain.",
        color=RZ_BLUE, emoji="🔒",
    ))
    story.append(PageBreak())

    # ───── 04 DUELS ─────
    story.append(section_header(4, "Duels", "⚔️"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Duels (Point Staking)", H_SECTION))
    story.append(Paragraph(
        "Challenge another player to a 1-on-1 prediction showdown. Wager your earned "
        "points — the winner takes the full pot. The loser takes a long, hard look in the mirror.",
        BODY,
    ))
    story.append(Spacer(1, 6))
    story.append(subhead("How Duels Work"))
    story.append(step_row(1, "Choose a match, an opponent, and a stake amount (1–50 points)."))
    story.append(step_row(2, "Your opponent has 24 hours to accept or decline. The clock is ticking."))
    story.append(step_row(3, "If accepted, both players' stakes are placed in escrow (deducted from balance)."))
    story.append(step_row(4, "Both submit predictions through the normal system — no separate duel prediction needed."))
    story.append(step_row(5, "When the result is confirmed, the player with more prediction points wins the pot (2× stake)."))
    story.append(Spacer(1, 12))
    story.append(subhead("Staking & Escrow"))
    story.append(rule_row("Stake Range", "Wager between 1 and 50 points per duel. No betting your house."))
    story.append(rule_row("Escrow on Accept", "When accepted, both stakes are deducted and held in escrow. The pot is real."))
    story.append(rule_row("Winner Takes All", "The winner receives the full pot (2× stake). Net gain = stake amount."))
    story.append(rule_row("Tie = Refund", "If both score the same prediction points, both stakes are fully refunded. No hard feelings."))
    story.append(rule_row("Insufficient Points", "You cannot create or accept a duel without enough available points. Sorry, broke duelists."))
    story.append(PageBreak())

    story.append(section_header(4, "Duels (cont.)", "⚔️"))
    story.append(Spacer(1, 10))
    story.append(subhead("Duel Rules"))
    story.append(rule_row("One Duel Per Matchup", "Only one active duel per challenger/opponent/match combination. No spamming."))
    story.append(rule_row("Standard Predictions", "Both players use their regular predictions. The arena is shared."))
    story.append(rule_row("No Prediction = 0 Points", "Forget to predict? You score 0 in the duel. Show up or pay up."))
    story.append(rule_row("24-Hour Expiry", "Duel invitations expire after 24 hours if not accepted or declined. Pending duels have no escrow."))
    story.append(Spacer(1, 14))
    story.append(subhead("Duel Lifecycle"))
    lc = Table([[
        Paragraph(
            f'<font color="white"><b>PENDING</b></font> → '
            f'<font color="{RZ_BLUE.hexval()}"><b>ACTIVE</b></font> '
            f'<font color="{RZ_TEXT_MUTED.hexval()}">(escrow)</font> → '
            f'<font color="{RZ_SUCCESS.hexval()}"><b>COMPLETED</b></font> '
            f'<font color="{RZ_TEXT_MUTED.hexval()}">(payout)</font><br/><br/>'
            f'<font color="{RZ_TEXT_MUTED.hexval()}">     ↘ </font>'
            f'<font color="#F87171"><b>DECLINED</b></font><br/>'
            f'<font color="{RZ_TEXT_MUTED.hexval()}">     ↘ EXPIRED</font>',
            ParagraphStyle("lc", parent=BODY, alignment=TA_CENTER, fontName="Courier-Bold", fontSize=10, leading=15),
        )
    ]], colWidths=[PAGE_W - 2 * MARGIN - 16])
    lc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RZ_SURFACE_2),
        ("BOX", (0, 0), (-1, -1), 0.6, RZ_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(lc)
    story.append(Spacer(1, 12))
    story.append(fun_quote(
        "Two players entered the duel. One left with bragging rights. "
        "The other left their group chat. — Forbes, probably"
    ))
    story.append(PageBreak())

    # ───── 05 CHALLENGES ─────
    story.append(section_header(5, "Flash Challenges", "⚡"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Flash Challenges (Paid Entry)", H_SECTION))
    story.append(Paragraph(
        "Quick questions created by admins during matches or tournament stages. "
        "Pay an entry fee from your points balance — answer correctly to win reward points. "
        "Fast, risky, glorious.",
        BODY,
    ))
    story.append(Spacer(1, 6))
    story.append(subhead("How Challenges Work"))
    story.append(step_row(1, "An admin creates a challenge with a question, entry cost, and reward points."))
    story.append(step_row(2, "You pay the entry cost from your available balance when you submit your first answer."))
    story.append(step_row(3, "You can change your answer for free as many times as you want before close time."))
    story.append(step_row(4, "After the event, the admin selects the correct answer and resolves the challenge."))
    story.append(step_row(5, "Right answer? Reward points are yours. Wrong answer? Your entry fee is gone. Such is life."))
    story.append(Spacer(1, 10))
    story.append(subhead("Entry & Rewards"))
    story.append(rule_row("Paid Entry", "Each challenge has an entry cost, deducted from your challenge balance on first answer."))
    story.append(rule_row("Free Edits", "After your initial entry, change your answer as often as you want before close — no extra cost."))
    story.append(rule_row("Reward Points", "Correct answers earn reward points added to your challenge balance."))
    story.append(rule_row("Insufficient Balance", "You cannot enter if your available balance is less than the entry cost. Save up, hero."))
    story.append(PageBreak())

    story.append(section_header(5, "Flash Challenges (cont.)", "⚡"))
    story.append(Spacer(1, 10))
    story.append(subhead("Challenge Rules"))
    story.append(rule_row("Types", "Yes/No questions or multiple-choice questions with one correct answer."))
    story.append(rule_row("Time Windows", "Each challenge has open and close times. You can only answer while it's active and open."))
    story.append(rule_row("Resolution", "Admins select the correct answer after the event. Reward points are awarded immediately."))
    story.append(rule_row("Cancellation = Refund", "If an admin cancels a challenge, every participant gets their entry cost fully refunded."))
    story.append(Spacer(1, 14))
    story.append(subhead("Challenge Lifecycle"))
    cl = Table([[
        Paragraph(
            f'<font color="{RZ_TEXT_MUTED.hexval()}"><b>DRAFT</b></font> → '
            f'<font color="{RZ_BLUE.hexval()}"><b>ACTIVE</b></font> '
            f'<font color="{RZ_TEXT_MUTED.hexval()}">(open for answers)</font> → '
            f'<font color="{RZ_WARNING.hexval()}"><b>LOCKED</b></font> → '
            f'<font color="{RZ_SUCCESS.hexval()}"><b>RESOLVED</b></font> '
            f'<font color="{RZ_TEXT_MUTED.hexval()}">(rewards paid)</font><br/><br/>'
            f'<font color="{RZ_TEXT_MUTED.hexval()}">          ↘ </font>'
            f'<font color="#F87171"><b>CANCELLED</b></font> '
            f'<font color="{RZ_TEXT_MUTED.hexval()}">(refunds issued)</font>',
            ParagraphStyle("cl", parent=BODY, alignment=TA_CENTER, fontName="Courier-Bold", fontSize=10, leading=15),
        )
    ]], colWidths=[PAGE_W - 2 * MARGIN - 16])
    cl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), RZ_SURFACE_2),
        ("BOX", (0, 0), (-1, -1), 0.6, RZ_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    story.append(cl)
    story.append(Spacer(1, 14))
    story.append(callout(
        "Stay Alert!",
        "Flash challenges can appear at any time during live matches. "
        "Check the Challenges tab regularly to catch them before they close. "
        "Remember: you can always change your mind before the deadline at no extra cost.",
        color=RZ_PURPLE, emoji="⚡",
    ))
    story.append(PageBreak())

    # ───── 06 LOUNGE ─────
    story.append(section_header(6, "Match Lounge", "💬"))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Match Lounge", H_SECTION))
    story.append(Paragraph(
        "Every match has a comment section where you can chat, react, and discuss with "
        "other players. It's where the real game happens.",
        BODY,
    ))
    story.append(Spacer(1, 6))
    story.append(rule_row(
        "Grace Period",
        "Edit or delete your own comments within 5 minutes of posting. After that, "
        "they're permanent. Yes, even the typo. Especially the typo."
    ))
    story.append(rule_row(
        "Character Limit",
        "Each comment can be up to 500 characters. If your hot take needs more than that, "
        "it's not a hot take — it's a thesis."
    ))
    story.append(rule_row(
        "Mention Other Players",
        "Type @ to mention other players in your comments. They'll be highlighted, "
        "notified, and possibly mildly stressed."
    ))
    story.append(rule_row(
        "Be Respectful",
        "Admins can delete any comment at any time. Keep it fun and friendly. "
        "Trash talk = ✅. Trash behavior = ❌."
    ))
    story.append(Spacer(1, 16))
    story.append(fun_quote(
        "I came for the predictions. I stayed for the comments. — Every player, ever."
    ))
    story.append(Spacer(1, 24))

    # Final closing card
    closing = [
        Paragraph(
            f'<font color="{RZ_RED.hexval()}" size="20"><b>That\'s it. Now go play.</b></font>',
            ParagraphStyle("c", parent=BODY, alignment=TA_CENTER, leading=24),
        ),
        Spacer(1, 8),
        Paragraph(
            f'<font color="{RZ_TEXT_MUTED.hexval()}">'
            "Predict bravely. Duel boldly. Comment kindly. "
            "And may the bracket gods smile upon you."
            "</font>",
            ParagraphStyle("c", parent=BODY, alignment=TA_CENTER),
        ),
        Spacer(1, 14),
        Paragraph(
            f'<font color="{RZ_TEXT.hexval()}"><b>redzone-soccer.com/rules</b></font>',
            ParagraphStyle("c", parent=BODY, alignment=TA_CENTER),
        ),
    ]
    story.append(card(closing, bg=RZ_SURFACE, border=RZ_RED, pad=20))

    return story


def main():
    out = ROOT / "redzone_rules.pdf"
    doc = BaseDocTemplate(
        str(out),
        pagesize=LETTER,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=0.85 * inch,
        bottomMargin=0.55 * inch,
        title="REDZONE — Rules & How to Play",
        author="REDZONE",
        subject="Official rulebook for the REDZONE prediction game",
    )

    cover_frame = Frame(
        MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="cover",
    )
    content_frame = Frame(
        MARGIN, 0.55 * inch, PAGE_W - 2 * MARGIN, PAGE_H - 0.85 * inch - 0.55 * inch,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        id="content",
    )

    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=on_cover),
        PageTemplate(id="content", frames=[content_frame], onPage=on_content),
    ])

    story = build_story()
    # Force switch to content template after the cover page break
    from reportlab.platypus import NextPageTemplate
    final_story = [NextPageTemplate("content")] + story
    doc.build(final_story)
    print(f"✓ Wrote {out}")


if __name__ == "__main__":
    main()
