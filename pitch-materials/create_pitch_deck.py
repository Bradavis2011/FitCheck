#!/usr/bin/env python3
"""
Generate the "Or This?" Seed Stage Pitch Deck as a PowerPoint file.
Designed for Y Combinator and similar accelerator applications.
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ── Brand Colors ──
CORAL = RGBColor(0xE8, 0x5D, 0x4C)
CORAL_LIGHT = RGBColor(0xFF, 0x7A, 0x6B)
CORAL_DARK = RGBColor(0xC9, 0x4A, 0x3A)
CREAM = RGBColor(0xFB, 0xF7, 0xF4)
BLACK = RGBColor(0x1A, 0x1A, 0x1A)
CHARCOAL = RGBColor(0x2D, 0x2D, 0x2D)
SAGE = RGBColor(0xA8, 0xB5, 0xA0)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0x99, 0x99, 0x99)
GREEN = RGBColor(0x10, 0xB9, 0x81)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)

# ── Slide Dimensions (16:9) ──
SLIDE_WIDTH = Inches(13.333)
SLIDE_HEIGHT = Inches(7.5)


def set_slide_bg(slide, color):
    """Set solid background color for a slide."""
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, fill_color=None, shape_type=MSO_SHAPE.RECTANGLE):
    """Add a colored shape to the slide."""
    shape = slide.shapes.add_shape(shape_type, left, top, width, height)
    shape.line.fill.background()
    if fill_color:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    return shape


def add_text_box(slide, left, top, width, height, text, font_size=18,
                 font_color=BLACK, bold=False, alignment=PP_ALIGN.LEFT,
                 font_name="Calibri", line_spacing=1.2):
    """Add a text box with specified formatting."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = font_color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    p.space_after = Pt(0)
    if line_spacing != 1.0:
        p.line_spacing = Pt(font_size * line_spacing)
    return txBox


def add_multiline_text(slide, left, top, width, height, lines, default_size=18,
                       default_color=BLACK, default_bold=False, alignment=PP_ALIGN.LEFT,
                       font_name="Calibri", line_spacing=1.3):
    """Add a text box with multiple paragraphs. Each line is a dict or string."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True

    for i, line in enumerate(lines):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()

        if isinstance(line, str):
            p.text = line
            p.font.size = Pt(default_size)
            p.font.color.rgb = default_color
            p.font.bold = default_bold
        elif isinstance(line, dict):
            p.text = line.get("text", "")
            p.font.size = Pt(line.get("size", default_size))
            p.font.color.rgb = line.get("color", default_color)
            p.font.bold = line.get("bold", default_bold)

        p.font.name = font_name
        p.alignment = alignment
        p.space_after = Pt(line.get("space_after", 4) if isinstance(line, dict) else 4)
        p.line_spacing = Pt((line.get("size", default_size) if isinstance(line, dict) else default_size) * line_spacing)

    return txBox


def add_rounded_rect(slide, left, top, width, height, fill_color):
    """Add a rounded rectangle."""
    shape = add_shape(slide, left, top, width, height, fill_color, MSO_SHAPE.ROUNDED_RECTANGLE)
    return shape


def build_deck():
    prs = Presentation()
    prs.slide_width = SLIDE_WIDTH
    prs.slide_height = SLIDE_HEIGHT

    # Use blank layout
    blank_layout = prs.slide_layouts[6]

    # ════════════════════════════════════════════════════════════════
    # SLIDE 1: TITLE
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, CREAM)

    # Large coral accent bar at top
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.08), CORAL)

    # Brand name
    add_text_box(slide, Inches(1), Inches(1.8), Inches(11), Inches(1.5),
                 "Or This?", font_size=72, font_color=CORAL, bold=True,
                 alignment=PP_ALIGN.CENTER, font_name="Georgia")

    # Tagline
    add_text_box(slide, Inches(2), Inches(3.4), Inches(9), Inches(0.8),
                 "Confidence in every choice.", font_size=28, font_color=CHARCOAL,
                 alignment=PP_ALIGN.CENTER, font_name="Georgia")

    # One-liner
    add_text_box(slide, Inches(1.5), Inches(4.5), Inches(10), Inches(0.8),
                 "AI-powered outfit feedback in 30 seconds. Your honest friend in your pocket.",
                 font_size=20, font_color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

    # Stage + round
    add_text_box(slide, Inches(3), Inches(5.8), Inches(7), Inches(0.5),
                 "Seed Stage  |  Y Combinator Application  |  2026",
                 font_size=16, font_color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

    # Bottom accent
    add_shape(slide, Inches(0), Inches(7.42), SLIDE_WIDTH, Inches(0.08), CORAL)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 2: THE PROBLEM
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "THE PROBLEM", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(1.2),
                 "Every day, millions of women stand in front of the mirror\nand ask: \"Does this actually look good?\"",
                 font_size=32, font_color=BLACK, bold=True, font_name="Georgia")

    # Problem bullets
    problems = [
        {"text": "72% of women say outfit indecision causes daily stress", "size": 20, "bold": False, "color": CHARCOAL, "space_after": 14},
        {"text": "The average woman changes outfits 2-3x before leaving the house", "size": 20, "bold": False, "color": CHARCOAL, "space_after": 14},
        {"text": "No trusted, instant feedback source exists at the moment of decision", "size": 20, "bold": False, "color": CHARCOAL, "space_after": 14},
    ]
    add_multiline_text(slide, Inches(0.8), Inches(2.8), Inches(7), Inches(2.5), problems)

    # Right side - pain points box
    card = add_rounded_rect(slide, Inches(8.5), Inches(2.8), Inches(4), Inches(3.5), CREAM)
    add_multiline_text(slide, Inches(8.8), Inches(3.0), Inches(3.5), Inches(3.2), [
        {"text": "Current \"solutions\" fail:", "size": 18, "bold": True, "color": CORAL, "space_after": 16},
        {"text": "Friends — biased, unavailable", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Partners — \"you look fine\"", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Social media — too slow, public", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Fashion apps — inspiration, not feedback", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Stylists — expensive, not instant", "size": 16, "color": CHARCOAL, "space_after": 8},
    ])

    # Bottom quote
    add_text_box(slide, Inches(0.8), Inches(6.0), Inches(11), Inches(0.8),
                 "\"I just want someone honest to tell me if this works — right now, before I walk out the door.\"",
                 font_size=18, font_color=CORAL, font_name="Georgia", alignment=PP_ALIGN.LEFT)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 3: THE SOLUTION
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "THE SOLUTION", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(1.0),
                 "Your honest friend in your pocket.\nInstant AI outfit feedback — anytime, anywhere.",
                 font_size=32, font_color=BLACK, bold=True, font_name="Georgia")

    # Core loop - 4 steps
    steps = [
        ("1", "Snap", "Take a full-body\nphoto or selfie"),
        ("2", "Tell Us", "Occasion, setting,\nweather, your vibe"),
        ("3", "Get Feedback", "AI analysis in\n30 seconds flat"),
        ("4", "Ask More", "Follow-up questions\nlike a real friend"),
    ]

    for i, (num, title, desc) in enumerate(steps):
        x = Inches(0.8 + i * 3.1)
        # Number circle
        circle = add_shape(slide, x, Inches(2.8), Inches(0.7), Inches(0.7), CORAL, MSO_SHAPE.OVAL)
        add_text_box(slide, x, Inches(2.85), Inches(0.7), Inches(0.6),
                     num, font_size=24, font_color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
        # Title
        add_text_box(slide, x, Inches(3.7), Inches(2.5), Inches(0.5),
                     title, font_size=22, font_color=BLACK, bold=True)
        # Description
        add_text_box(slide, x, Inches(4.2), Inches(2.5), Inches(1.0),
                     desc, font_size=16, font_color=CHARCOAL)

    # What makes it different
    add_shape(slide, Inches(0.8), Inches(5.6), Inches(11.5), Inches(0.04), CREAM)
    add_text_box(slide, Inches(0.8), Inches(5.8), Inches(11), Inches(0.8),
                 "Not inspiration. Not shopping. Not social media. Just honest, instant, private outfit feedback.",
                 font_size=18, font_color=CORAL, font_name="Georgia")

    # ════════════════════════════════════════════════════════════════
    # SLIDE 4: HOW IT WORKS (AI DETAIL)
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "THE AI", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "A Vogue editor in your pocket — powered by vision AI",
                 font_size=32, font_color=BLACK, bold=True, font_name="Georgia")

    # Left: what the AI does
    add_multiline_text(slide, Inches(0.8), Inches(2.2), Inches(5.5), Inches(4.5), [
        {"text": "What you get:", "size": 20, "bold": True, "color": BLACK, "space_after": 12},
        {"text": "Overall score (1-10) with editorial summary", "size": 17, "color": CHARCOAL, "space_after": 8},
        {"text": "What's working — specific, actionable praise", "size": 17, "color": CHARCOAL, "space_after": 8},
        {"text": "What to reconsider — honest, constructive notes", "size": 17, "color": CHARCOAL, "space_after": 8},
        {"text": "Quick fixes — things you can change in 2 minutes", "size": 17, "color": CHARCOAL, "space_after": 8},
        {"text": "Occasion match score — how well it fits the event", "size": 17, "color": CHARCOAL, "space_after": 8},
        {"text": "", "size": 10, "space_after": 6},
        {"text": "Then ask follow-ups — \"What shoes would work better?\"", "size": 17, "bold": True, "color": CORAL, "space_after": 8},
        {"text": "\"Is this too casual for a client dinner?\"", "size": 17, "bold": True, "color": CORAL, "space_after": 8},
    ])

    # Right: AI knowledge card
    card = add_rounded_rect(slide, Inches(7.2), Inches(2.2), Inches(5.3), Inches(4.5), CREAM)
    add_multiline_text(slide, Inches(7.5), Inches(2.4), Inches(4.8), Inches(4.2), [
        {"text": "Built-in fashion expertise:", "size": 18, "bold": True, "color": CORAL, "space_after": 14},
        {"text": "Color theory & palette harmony", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Proportions & silhouette rules", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Fit principles & tailoring", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Occasion-appropriate dress codes", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Seasonal trend awareness", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Body balance guidelines", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "", "size": 10, "space_after": 8},
        {"text": "Powered by Google Gemini Vision", "size": 14, "color": LIGHT_GRAY, "space_after": 4},
        {"text": "Automated AI training pipeline", "size": 14, "color": LIGHT_GRAY, "space_after": 4},
        {"text": "Prompt v3.0 — Vogue editorial voice", "size": 14, "color": LIGHT_GRAY, "space_after": 4},
    ])

    # ════════════════════════════════════════════════════════════════
    # SLIDE 5: MARKET OPPORTUNITY
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "MARKET OPPORTUNITY", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "A massive, underserved market at the intersection of fashion & AI",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    # TAM / SAM / SOM circles
    markets = [
        ("TAM", "$1.7T", "Global fashion\nmarket", Inches(1.0)),
        ("SAM", "$45B", "Women's personal\nstyling & fashion apps", Inches(4.5)),
        ("SOM", "$500M", "AI-powered outfit\nfeedback (Year 5)", Inches(8.0)),
    ]

    for label, value, desc, x in markets:
        # Circle
        circle = add_shape(slide, x, Inches(2.5), Inches(3.2), Inches(3.2), None, MSO_SHAPE.OVAL)
        circle.fill.solid()
        circle.fill.fore_color.rgb = CREAM
        circle.line.color.rgb = CORAL
        circle.line.width = Pt(2)

        add_text_box(slide, x, Inches(2.8), Inches(3.2), Inches(0.5),
                     label, font_size=16, font_color=CORAL, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x, Inches(3.3), Inches(3.2), Inches(0.8),
                     value, font_size=40, font_color=BLACK, bold=True, alignment=PP_ALIGN.CENTER,
                     font_name="Georgia")
        add_text_box(slide, x, Inches(4.2), Inches(3.2), Inches(1.0),
                     desc, font_size=14, font_color=CHARCOAL, alignment=PP_ALIGN.CENTER)

    # Why now
    add_shape(slide, Inches(0.8), Inches(5.9), Inches(11.5), Inches(0.04), CREAM)
    add_multiline_text(slide, Inches(0.8), Inches(6.1), Inches(11), Inches(1.2), [
        {"text": "Why now?  Vision AI has crossed the quality threshold. For the first time, AI can reliably analyze real-world outfit photos and give specific, useful feedback. This category literally could not exist 18 months ago.", "size": 17, "color": CHARCOAL, "space_after": 4},
    ])

    # ════════════════════════════════════════════════════════════════
    # SLIDE 6: BUSINESS MODEL
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "BUSINESS MODEL", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "Freemium SaaS with a clear upgrade path",
                 font_size=32, font_color=BLACK, bold=True, font_name="Georgia")

    # Three tier cards
    tiers = [
        ("FREE", "$0", [
            "3 AI checks/day",
            "3 follow-ups per check",
            "7-day history",
            "Ad-supported",
            "Give-to-get bonus checks",
        ], CREAM, BLACK),
        ("PLUS", "$4.99/mo", [
            "Unlimited AI checks",
            "5 follow-ups per check",
            "Full outfit history",
            "No ads",
            "Community feedback",
        ], CORAL, WHITE),
        ("PRO", "$14.99/mo", [
            "Everything in Plus",
            "10 follow-ups per check",
            "5 expert reviews/month",
            "Event planning mode",
            "Style analytics & DNA",
        ], BLACK, WHITE),
    ]

    for i, (name, price, features, bg, text_color) in enumerate(tiers):
        x = Inches(0.8 + i * 4.1)
        card = add_rounded_rect(slide, x, Inches(2.2), Inches(3.6), Inches(4.5), bg)

        # Tier name
        add_text_box(slide, x + Inches(0.3), Inches(2.4), Inches(3.0), Inches(0.5),
                     name, font_size=16, font_color=text_color if bg != CORAL else WHITE, bold=True)

        # Price
        price_color = text_color if bg != CREAM else CORAL
        add_text_box(slide, x + Inches(0.3), Inches(2.9), Inches(3.0), Inches(0.6),
                     price, font_size=36, font_color=price_color, bold=True, font_name="Georgia")

        # Features
        feature_lines = [{"text": f, "size": 15, "color": text_color if bg != CREAM else CHARCOAL, "space_after": 6} for f in features]
        add_multiline_text(slide, x + Inches(0.3), Inches(3.7), Inches(3.0), Inches(3.0), feature_lines)

    # Revenue note
    add_text_box(slide, Inches(0.8), Inches(6.9), Inches(11), Inches(0.5),
                 "Additional revenue: Expert review add-ons  •  Affiliate shopping links  •  Brand partnerships  •  Google AdMob (free tier)",
                 font_size=14, font_color=LIGHT_GRAY)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 7: UNIT ECONOMICS
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "UNIT ECONOMICS", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "AI costs are dropping fast — our margins improve every quarter",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    # Key metrics
    metrics = [
        ("~$0.003", "Cost per\nAI check", "Gemini Vision API\ncost per outfit analysis"),
        ("~$0.50", "Blended monthly\ncost per user", "Including infrastructure,\nstorage, and AI calls"),
        ("$4.99-$14.99", "Monthly\nrevenue per paid user", "Strong gross margins\non subscription revenue"),
        ("10-30x", "Target\nLTV:CAC", "Organic-first acquisition\ndrives efficient growth"),
    ]

    for i, (value, label, detail) in enumerate(metrics):
        x = Inches(0.8 + i * 3.1)
        card = add_rounded_rect(slide, x, Inches(2.4), Inches(2.7), Inches(3.0), CREAM)
        add_text_box(slide, x, Inches(2.7), Inches(2.7), Inches(0.6),
                     value, font_size=32, font_color=CORAL, bold=True, alignment=PP_ALIGN.CENTER,
                     font_name="Georgia")
        add_text_box(slide, x, Inches(3.4), Inches(2.7), Inches(0.6),
                     label, font_size=16, font_color=BLACK, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x, Inches(4.1), Inches(2.7), Inches(0.8),
                     detail, font_size=13, font_color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

    add_multiline_text(slide, Inches(0.8), Inches(5.8), Inches(11), Inches(1.5), [
        {"text": "Key insight: AI API costs have dropped 90% in the past 18 months and continue falling. Our COGS improves automatically over time — the opposite of most consumer businesses.", "size": 17, "color": CHARCOAL, "space_after": 4},
    ])

    # ════════════════════════════════════════════════════════════════
    # SLIDE 8: GROWTH FLYWHEEL
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "GROWTH FLYWHEEL", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "Built-in virality: \"Or This?\" is inherently shareable",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    # Left: The flywheel steps
    flywheel_steps = [
        {"text": "The core loop creates natural sharing moments:", "size": 20, "bold": True, "color": BLACK, "space_after": 16},
        {"text": "1.  User gets outfit feedback → tells friends", "size": 18, "color": CHARCOAL, "space_after": 10},
        {"text": "2.  A/B comparisons (\"Or This?\") shared for votes", "size": 18, "color": CHARCOAL, "space_after": 10},
        {"text": "3.  Friends download to participate", "size": 18, "color": CHARCOAL, "space_after": 10},
        {"text": "4.  New users try AI feedback → get hooked", "size": 18, "color": CHARCOAL, "space_after": 10},
        {"text": "5.  Repeat — every outfit is a potential share", "size": 18, "color": CHARCOAL, "space_after": 10},
    ]
    add_multiline_text(slide, Inches(0.8), Inches(2.2), Inches(5.5), Inches(3.5), flywheel_steps)

    # Right: channels card
    card = add_rounded_rect(slide, Inches(7.2), Inches(2.2), Inches(5.3), Inches(4.5), CREAM)
    add_multiline_text(slide, Inches(7.5), Inches(2.4), Inches(4.8), Inches(4.2), [
        {"text": "Go-to-market channels:", "size": 18, "bold": True, "color": CORAL, "space_after": 14},
        {"text": "TikTok/Reels — outfit content is dominant", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Reddit — r/femalefashionadvice (2M+)", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Influencer seeding — micro-creators", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "Word of mouth — \"have you tried this app?\"", "size": 16, "color": CHARCOAL, "space_after": 8},
        {"text": "", "size": 10, "space_after": 8},
        {"text": "Launch strategy:", "size": 18, "bold": True, "color": CORAL, "space_after": 14},
        {"text": "Private beta → 500 users", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "ProductHunt launch", "size": 16, "color": CHARCOAL, "space_after": 6},
        {"text": "Creator partnerships", "size": 16, "color": CHARCOAL, "space_after": 6},
    ])

    # ════════════════════════════════════════════════════════════════
    # SLIDE 9: COMPETITIVE LANDSCAPE
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "COMPETITIVE LANDSCAPE", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "We own the \"moment of decision\" — nobody else does",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    # Competitor grid
    competitors = [
        ("Stitch Fix / Trunk Club", "Subscription boxes", "Shipping delay, expensive,\nnot instant", CREAM),
        ("Pinterest / Instagram", "Inspiration & discovery", "Not feedback, not private,\nnot actionable", CREAM),
        ("ChatGPT / General AI", "General-purpose AI", "No fashion expertise,\nno specialized UX", CREAM),
        ("Or This?", "Instant AI outfit feedback\nat the moment of decision", "Fast, private, expert-quality,\nalways available", CORAL),
    ]

    for i, (name, what, diff, bg) in enumerate(competitors):
        x = Inches(0.8 + (i % 4) * 3.1)
        y = Inches(2.4)
        text_color = WHITE if bg == CORAL else CHARCOAL
        name_color = WHITE if bg == CORAL else BLACK

        card = add_rounded_rect(slide, x, y, Inches(2.7), Inches(3.0), bg)
        add_text_box(slide, x + Inches(0.2), y + Inches(0.3), Inches(2.3), Inches(0.5),
                     name, font_size=17, font_color=name_color, bold=True)
        add_text_box(slide, x + Inches(0.2), y + Inches(0.9), Inches(2.3), Inches(0.6),
                     what, font_size=14, font_color=text_color)
        add_text_box(slide, x + Inches(0.2), y + Inches(1.7), Inches(2.3), Inches(1.0),
                     diff, font_size=13, font_color=text_color)

    # Moat
    add_shape(slide, Inches(0.8), Inches(5.8), Inches(11.5), Inches(0.04), CREAM)
    add_multiline_text(slide, Inches(0.8), Inches(6.0), Inches(11), Inches(1.0), [
        {"text": "Our moat:  Proprietary AI training pipeline that improves with every outfit analyzed. Style DNA profiles that deepen over time. Community network effects. The more you use it, the better it knows you.", "size": 16, "color": CHARCOAL, "space_after": 4},
    ])

    # ════════════════════════════════════════════════════════════════
    # SLIDE 10: TRACTION & PRODUCT STATUS
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "TRACTION & STATUS", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "Complete product built. Ready for users.",
                 font_size=32, font_color=BLACK, bold=True, font_name="Georgia")

    # Status items
    status_items = [
        ("BUILT", "Full-stack app", "37 screens, 16 API domains,\n54+ database tables"),
        ("LIVE", "Backend deployed", "Railway hosting, PostgreSQL,\nall services operational"),
        ("READY", "App store submission", "iOS + Android builds\nprepared for review"),
        ("ACTIVE", "AI pipeline", "Automated 7-stage training\nPrompt v3.0 in production"),
    ]

    for i, (badge, title, desc) in enumerate(status_items):
        x = Inches(0.8 + i * 3.1)
        # Badge
        badge_shape = add_rounded_rect(slide, x, Inches(2.4), Inches(1.0), Inches(0.4), GREEN)
        add_text_box(slide, x, Inches(2.4), Inches(1.0), Inches(0.4),
                     badge, font_size=12, font_color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
        # Title
        add_text_box(slide, x, Inches(3.0), Inches(2.7), Inches(0.5),
                     title, font_size=20, font_color=BLACK, bold=True)
        # Desc
        add_text_box(slide, x, Inches(3.5), Inches(2.7), Inches(1.0),
                     desc, font_size=15, font_color=CHARCOAL)

    # Targets
    add_shape(slide, Inches(0.8), Inches(4.8), Inches(11.5), Inches(0.04), CREAM)
    add_text_box(slide, Inches(0.8), Inches(5.0), Inches(5), Inches(0.5),
                 "Month 6 Targets", font_size=18, font_color=CORAL, bold=True)

    targets = [
        ("50K", "MAU"),
        ("10K", "Daily checks"),
        ("30%", "D7 retention"),
        ("4.0/5", "Helpfulness"),
    ]

    for i, (val, label) in enumerate(targets):
        x = Inches(0.8 + i * 3.1)
        add_text_box(slide, x, Inches(5.5), Inches(2.5), Inches(0.6),
                     val, font_size=36, font_color=CORAL, bold=True, font_name="Georgia")
        add_text_box(slide, x, Inches(6.1), Inches(2.5), Inches(0.4),
                     label, font_size=16, font_color=CHARCOAL)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 11: ROADMAP
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "ROADMAP", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "Focused execution: nail the core, then expand",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    phases = [
        ("NOW", "Core Loop", [
            "App store launch",
            "AI feedback refinement",
            "Private beta (500 users)",
            "Organic growth seeding",
        ], CORAL, WHITE),
        ("Q3 2026", "Community", [
            "Community feedback live",
            "\"Or This?\" comparisons",
            "Give-to-get flywheel",
            "Gamification & streaks",
        ], CHARCOAL, WHITE),
        ("Q4 2026", "Monetize", [
            "Plus & Pro tiers live",
            "Expert stylist marketplace",
            "A/B test pricing",
            "Revenue optimization",
        ], BLACK, WHITE),
        ("2027", "Scale", [
            "Video outfit analysis",
            "Shopping/affiliate integration",
            "Brand partnerships",
            "International expansion",
        ], CREAM, CHARCOAL),
    ]

    for i, (when, title, items, bg, text_color) in enumerate(phases):
        x = Inches(0.8 + i * 3.1)
        card = add_rounded_rect(slide, x, Inches(2.2), Inches(2.7), Inches(4.5), bg)

        add_text_box(slide, x + Inches(0.2), Inches(2.4), Inches(2.3), Inches(0.4),
                     when, font_size=14, font_color=text_color, bold=True)
        add_text_box(slide, x + Inches(0.2), Inches(2.8), Inches(2.3), Inches(0.5),
                     title, font_size=22, font_color=text_color, bold=True, font_name="Georgia")

        item_lines = [{"text": f"•  {item}", "size": 15, "color": text_color, "space_after": 6} for item in items]
        add_multiline_text(slide, x + Inches(0.2), Inches(3.5), Inches(2.3), Inches(3.0), item_lines)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 12: THE TEAM
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, WHITE)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "THE TEAM", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.0), Inches(11), Inches(0.8),
                 "Built by people who understand the problem",
                 font_size=30, font_color=BLACK, bold=True, font_name="Georgia")

    # Team member placeholders
    team = [
        ("[Founder Name]", "CEO / Product", [
            "[Background summary]",
            "[Relevant experience]",
            "[Why this problem]",
        ]),
        ("[Co-founder Name]", "CTO / Engineering", [
            "[Background summary]",
            "[Technical expertise]",
            "[Previous builds]",
        ]),
        ("[Advisor / Co-founder]", "[Role]", [
            "[Background summary]",
            "[Industry connections]",
            "[Domain expertise]",
        ]),
    ]

    for i, (name, role, bullets) in enumerate(team):
        x = Inches(0.8 + i * 4.1)
        # Avatar placeholder
        avatar = add_shape(slide, x + Inches(0.8), Inches(2.4), Inches(1.5), Inches(1.5),
                           CREAM, MSO_SHAPE.OVAL)
        add_text_box(slide, x + Inches(0.8), Inches(2.85), Inches(1.5), Inches(0.6),
                     "Photo", font_size=14, font_color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

        # Name & role
        add_text_box(slide, x, Inches(4.1), Inches(3.3), Inches(0.5),
                     name, font_size=20, font_color=BLACK, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x, Inches(4.6), Inches(3.3), Inches(0.4),
                     role, font_size=16, font_color=CORAL, alignment=PP_ALIGN.CENTER)

        bullet_lines = [{"text": b, "size": 14, "color": CHARCOAL, "space_after": 4} for b in bullets]
        add_multiline_text(slide, x + Inches(0.3), Inches(5.2), Inches(2.7), Inches(1.5),
                           bullet_lines, alignment=PP_ALIGN.CENTER)

    add_text_box(slide, Inches(0.8), Inches(6.8), Inches(11), Inches(0.5),
                 "Note: Update this slide with real team bios, photos, and relevant credentials.",
                 font_size=13, font_color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 13: THE ASK
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, CREAM)
    add_shape(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.06), CORAL)

    add_text_box(slide, Inches(0.8), Inches(0.4), Inches(4), Inches(0.6),
                 "THE ASK", font_size=14, font_color=CORAL, bold=True)

    add_text_box(slide, Inches(0.8), Inches(1.2), Inches(11), Inches(0.8),
                 "Raising $1.5M seed to launch and scale",
                 font_size=36, font_color=BLACK, bold=True, font_name="Georgia")

    # Use of funds
    funds = [
        ("40%", "Engineering", "Scale infrastructure, hire\n2 engineers, accelerate\nfeature development"),
        ("25%", "Growth", "Creator partnerships,\ncommunity seeding,\nlaunch marketing"),
        ("20%", "AI / Data", "Training pipeline, model\nimprovement, Style DNA\ndata collection"),
        ("15%", "Operations", "Team growth, legal,\ncompliance, 18-month\nrunway extension"),
    ]

    for i, (pct, label, desc) in enumerate(funds):
        x = Inches(0.8 + i * 3.1)
        card = add_rounded_rect(slide, x, Inches(2.6), Inches(2.7), Inches(2.8), WHITE)
        add_text_box(slide, x, Inches(2.8), Inches(2.7), Inches(0.6),
                     pct, font_size=36, font_color=CORAL, bold=True, alignment=PP_ALIGN.CENTER,
                     font_name="Georgia")
        add_text_box(slide, x, Inches(3.4), Inches(2.7), Inches(0.4),
                     label, font_size=18, font_color=BLACK, bold=True, alignment=PP_ALIGN.CENTER)
        add_text_box(slide, x, Inches(3.9), Inches(2.7), Inches(1.2),
                     desc, font_size=14, font_color=CHARCOAL, alignment=PP_ALIGN.CENTER)

    # Milestones
    add_text_box(slide, Inches(0.8), Inches(5.8), Inches(5), Inches(0.4),
                 "18-month milestones with this raise:", font_size=16, font_color=BLACK, bold=True)

    milestones_text = [
        {"text": "250K MAU  •  75K daily outfit checks  •  Series A metrics ($1M+ ARR)  •  Proven unit economics", "size": 18, "color": CORAL, "bold": True, "space_after": 4},
    ]
    add_multiline_text(slide, Inches(0.8), Inches(6.2), Inches(11), Inches(0.6), milestones_text)

    # ════════════════════════════════════════════════════════════════
    # SLIDE 14: CLOSING
    # ════════════════════════════════════════════════════════════════
    slide = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide, CORAL)

    add_text_box(slide, Inches(1), Inches(2.0), Inches(11), Inches(1.2),
                 "Or This?", font_size=72, font_color=WHITE, bold=True,
                 alignment=PP_ALIGN.CENTER, font_name="Georgia")

    add_text_box(slide, Inches(2), Inches(3.4), Inches(9), Inches(0.8),
                 "Confidence in every choice.", font_size=28, font_color=WHITE,
                 alignment=PP_ALIGN.CENTER, font_name="Georgia")

    add_text_box(slide, Inches(2), Inches(4.6), Inches(9), Inches(0.6),
                 "[founder@orthis.app]  •  orthis.app", font_size=20, font_color=WHITE,
                 alignment=PP_ALIGN.CENTER)

    add_text_box(slide, Inches(2), Inches(5.8), Inches(9), Inches(0.8),
                 "The only app that gives you honest outfit feedback\nin 30 seconds — right when you need it most.",
                 font_size=18, font_color=WHITE, alignment=PP_ALIGN.CENTER)

    # ── Save ──
    output_path = "/home/user/FitCheck/pitch-materials/OrThis_Seed_Pitch_Deck.pptx"
    prs.save(output_path)
    print(f"Pitch deck saved to: {output_path}")
    return output_path


if __name__ == "__main__":
    build_deck()
