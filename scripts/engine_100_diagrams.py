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
    Image as RLImage,
    PageBreak,
    HRFlowable,
    Table,
    TableStyle
)
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
CASES_DIAGRAMS_DIR = os.path.join(DOCS_DIR, "diagrams", "cases_100")
os.makedirs(CASES_DIAGRAMS_DIR, exist_ok=True)

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

def get_font(size, bold=False):
    font_file = "segoeuib.ttf" if bold else "segoeui.ttf"
    font_path = os.path.join("C:/Windows/Fonts", font_file)
    if os.path.exists(font_path):
        return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()

def draw_box(draw, x, y, w, h, text, fill=BG_WHITE, border=BORDER_DEFAULT, border_w=1, text_color=TEXT_DARK, radius=8, bold=False, font_size=10):
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

def generate_exact_diagram(steps, final_step, error_text, out_path, caption=""):
    num_steps = len(steps)
    y_step = 56
    w = 660
    h = 60 + (num_steps + 1) * y_step + 30
    
    img = Image.new("RGB", (w, h), BG_WHITE)
    draw = ImageDraw.Draw(img)
    
    cx = 230
    box_w = 220
    box_h = 32
    
    y = 40
    step_positions = []
    
    for i, s in enumerate(steps):
        draw_box(draw, cx, y, box_w, box_h, s, font_size=9.5)
        step_positions.append((cx + box_w/2, y))
        next_y = y + y_step
        draw_arrow(draw, (cx, y + box_h/2), (cx, next_y - box_h/2))
        y = next_y
        
    # Success box
    draw_box(draw, cx, y, box_w, box_h, final_step, border=BORDER_GREEN, border_w=1.5, font_size=9.5)
    
    # Error box
    err_x = 490
    err_y = y
    err_w = 200
    err_h = 34
    draw_box(draw, err_x, err_y, err_w, err_h, error_text, border=BORDER_RED, border_w=1.5, font_size=9)
    
    # Red lines
    num_branches = len(step_positions)
    max_right = w - 30
    min_right = cx + box_w/2 + 25
    step_offset = (max_right - min_right) / max(1, num_branches - 1) if num_branches > 1 else 0
    
    for idx, (px, py) in enumerate(step_positions):
        mid_x = max_right - idx * step_offset
        target_x = err_x - err_w/2 + 15 + idx * ((err_w - 30) / max(1, num_branches - 1))
        
        draw.line([px, py, mid_x, py], fill=LINE_RED, width=1)
        draw.line([mid_x, py, mid_x, err_y - 17], fill=LINE_RED, width=1)
        draw.line([mid_x, err_y - 17, target_x, err_y - 17], fill=LINE_RED, width=1)
        draw.polygon([(target_x, err_y - 17), (target_x - 3, err_y - 23), (target_x + 3, err_y - 23)], fill=LINE_RED)
        
        if idx == 0:
            font = get_font(9, False)
            draw.text((mid_x + 4, py + (err_y - py)/2), "fail", fill=LINE_RED, font=font)
            
    if caption:
        font = get_font(8.5, False)
        bbox = font.getbbox(caption)
        tw = bbox[2] - bbox[0]
        draw.text(((w - tw)/2, h - 18), caption, fill=TEXT_MUTED, font=font)
        
    img.save(out_path, quality=95)
    return out_path

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
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        
        if self._pageNumber > 1:
            self.drawString(36, 810, "Blynt UK Cloud Accounting — Complete 100 Architectural Diagrams Specification")
            self.drawRightString(A4[0] - 36, 810, "Master Specification V1.0")
            self.setStrokeColor(colors.HexColor("#162D5F"))
            self.setLineWidth(1)
            self.line(36, 804, A4[0] - 36, 804)

        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(36, 32, A4[0] - 36, 32)
        
        self.drawString(36, 22, "Confidential  •  Strictly Verified Architecture  •  100 Distinct Scenarios")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 36, 22, page_str)
        self.restoreState()

print("Base diagram and canvas engine ready.")
