import os
import sys
import math
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    PageBreak,
    HRFlowable,
)
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams")
os.makedirs(DIAGRAMS_DIR, exist_ok=True)

# Visual styling matching Figure 7 exactly
BG_WHITE = "#FFFFFF"
BORDER_DEFAULT = "#94A3B8"
BORDER_GREEN = "#10B981"
BORDER_RED = "#EF4444"
LINE_DEFAULT = "#334155"
LINE_RED = "#EF4444"
TEXT_DARK = "#1E293B"
TEXT_MUTED = "#64748B"
NAVY = "#162D5F"
CORAL = "#FF7F6C"
BG_LIGHT = "#F8FAFC"

def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_box(draw, x, y, w, h, text, fill=BG_WHITE, border=BORDER_DEFAULT, border_w=1, text_color=TEXT_DARK, radius=8, bold=False, font_size=10.5):
    x1, y1, x2, y2 = x - w/2, y - h/2, x + w/2, y + h/2
    draw.rounded_rectangle([int(x1), int(y1), int(x2), int(y2)], radius=int(radius), fill=fill, outline=border, width=int(border_w))
    font = get_font(font_size, bold)
    lines = text.split("\n")
    line_height = font_size + 4
    total_text_h = len(lines) * line_height
    start_y = y - total_text_h / 2 + 2
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        lw = bbox[2] - bbox[0]
        lx = x - lw / 2
        ly = start_y + i * line_height
        draw.text((int(lx), int(ly)), line, fill=text_color, font=font)
    return (x1, y1, x2, y2)

def draw_arrow(draw, p1, p2, color=LINE_DEFAULT, width=1.5, arrow_len=7):
    x1, y1 = p1
    x2, y2 = p2
    draw.line([x1, y1, x2, y2], fill=color, width=int(width))
    angle = math.atan2(y2 - y1, x2 - x1)
    ax1 = x2 - arrow_len * math.cos(angle - math.pi / 6)
    ay1 = y2 - arrow_len * math.sin(angle - math.pi / 6)
    ax2 = x2 - arrow_len * math.cos(angle + math.pi / 6)
    ay2 = y2 - arrow_len * math.sin(angle + math.pi / 6)
    draw.polygon([(x2, y2), (ax1, ay1), (ax2, ay2)], fill=color)

def draw_curved_arrow_to(draw, start, mid_x, end, color=LINE_RED, width=1.5, arrow_len=7):
    x1, y1 = start
    x2, y2 = end
    draw.line([x1, y1, mid_x, y1], fill=color, width=int(width))
    draw.line([mid_x, y1, mid_x, y2], fill=color, width=int(width))
    draw.line([mid_x, y2, x2, y2], fill=color, width=int(width))
    draw.polygon([(x2, y2), (x2 - 4, y2 - arrow_len), (x2 + 4, y2 - arrow_len)], fill=color)

def generate_figure_7_style_diagram(title, steps, final_step, error_text, filename, caption=""):
    """
    Renders an exact Figure 7 style flowchart:
    - Vertical stack of steps
    - Bottom green success box
    - Bottom right red error box
    - Red failure branches from all steps to error box with 'fail' label
    """
    num_steps = len(steps)
    y_step = 64
    w = 680
    h = 80 + (num_steps + 1) * y_step + 40
    
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)
    
    cx = 240
    box_w = 230
    box_h = 36
    
    # Calculate positions
    start_y = 50
    y = start_y
    step_positions = []
    
    for i, s in enumerate(steps):
        draw_box(draw, cx, y, box_w, box_h, s, font_size=10.5)
        step_positions.append((cx + box_w/2, y))
        next_y = y + y_step
        draw_arrow(draw, (cx, y + box_h/2), (cx, next_y - box_h/2))
        y = next_y
        
    # Final success step (Green outline)
    final_y = y
    draw_box(draw, cx, final_y, box_w, box_h, final_step, border=BORDER_GREEN, border_w=1.5, font_size=10.5)
    
    # Error box at bottom right
    err_x = 510
    err_y = final_y
    err_w = 210
    err_h = 38
    draw_box(draw, err_x, err_y, err_w, err_h, error_text, border=BORDER_RED, border_w=1.5, font_size=9.5)
    
    # Red failure branches
    # Stagger intermediate mid_x lines so they don't overlap
    num_branches = len(step_positions)
    max_right = w - 40
    min_right = cx + box_w/2 + 30
    step_offset = (max_right - min_right) / max(1, num_branches - 1) if num_branches > 1 else 0
    
    for idx, (px, py) in enumerate(step_positions):
        # branch goes right to mid_x, then down to err_y - 19, then into err box top
        mid_x = max_right - idx * step_offset
        target_x = err_x - err_w/2 + 20 + idx * ((err_w - 40) / max(1, num_branches - 1))
        
        # Draw orthogonal red line
        draw.line([px, py, mid_x, py], fill=LINE_RED, width=1)
        draw.line([mid_x, py, mid_x, err_y - 19], fill=LINE_RED, width=1)
        draw.line([mid_x, err_y - 19, target_x, err_y - 19], fill=LINE_RED, width=1)
        
        # Arrow pointing down into top of error box
        draw.line([target_x, err_y - 19, target_x, err_y - 19], fill=LINE_RED, width=1)
        draw.polygon([(target_x, err_y - 19), (target_x - 3.5, err_y - 25), (target_x + 3.5, err_y - 25)], fill=LINE_RED)
        
        # Label 'fail' on the rightmost outer line
        if idx == 0:
            font = get_font(9.5, False)
            draw.text((mid_x + 6, py + (err_y - py)/2), "fail", fill=LINE_RED, font=font)
            
    # Optional caption
    if caption:
        font = get_font(9.5, False)
        bbox = font.getbbox(caption)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw)/2, h - 25), caption, fill=TEXT_MUTED, font=font)
        
    out_path = os.path.join(DIAGRAMS_DIR, filename)
    img.save(out_path, quality=95)
    return out_path

# Numbered canvas for PDF page numbering
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        if self._pageNumber > 1:
            self.drawString(36, 808, getattr(self, '_doc_title', 'Blynt UK Cloud Accounting'))
            self.drawRightString(A4[0] - 36, 808, "Architecture & Verification Guide")
            self.setStrokeColor(colors.HexColor("#162D5F"))
            self.setLineWidth(1)
            self.line(36, 802, A4[0] - 36, 802)

        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 38, A4[0] - 36, 38)
        
        self.drawString(36, 26, "Blynt Accounting — Strictly Confidential  •  Zero Mathematical Tolerance")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 26, page_str)
        self.restoreState()

print("Script template ready.")
