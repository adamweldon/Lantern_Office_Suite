# make_decks.py -- the second review's PowerPoint files (1.24.33): decks of the kinds teachers, trainers and tradesmen
# have, made with python-pptx and its own (PowerPoint-made) template, a few parts then edited by hand for what
# python-pptx does not write (numbering types, right-to-left text, sections, a SmartArt diagram, a Google Slides-style
# file, damaged parts); LibreOffice's own saves of some of them; and files that are not PowerPoint presentations.
# Run from anywhere: python3 tests/fixtures/pptx_review2_1233/make_decks.py   (LibreOffice is used where it is installed)
import datetime, io, os, re, shutil, subprocess, sys, tempfile, zipfile
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "decks")
os.makedirs(OUT, exist_ok=True)

def png(w, h, rgb, quad=None):
    im = Image.new("RGB", (w, h), rgb)
    if quad:   # four colours, one a quarter (top left, top right, bottom left, bottom right)
        for i, c in enumerate(quad):
            x0, y0 = (i % 2) * w // 2, (i // 2) * h // 2
            im.paste(c, (x0, y0, x0 + w // 2, y0 + h // 2))
    b = io.BytesIO(); im.save(b, "PNG"); b.seek(0); return b

def edit(data, edits):
    """edits: {part name: fn(text) -> text} applied to a saved deck's parts; {name: bytes} adds or replaces a part;
    {name: None} removes one"""
    zi = zipfile.ZipFile(io.BytesIO(data)); out = io.BytesIO(); zo = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
    done = set()
    for n in zi.namelist():
        d = zi.read(n)
        if n in edits:
            e = edits[n]; done.add(n)
            if e is None: continue
            d = e if isinstance(e, (bytes, bytearray)) else e(d.decode("utf-8")).encode("utf-8")
        zo.writestr(n, d)
    for n, e in edits.items():
        if n not in done and isinstance(e, (bytes, bytearray)): zo.writestr(n, e)
    zo.close(); return out.getvalue()

def save(p, name, edits=None):
    b = io.BytesIO(); p.save(b); d = b.getvalue()
    if edits: d = edit(d, edits)
    open(os.path.join(OUT, name), "wb").write(d)
    return d

def box(s, x, y, w, h, text, shape=None):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h)) if shape else s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = sh.text_frame
    lines = text if isinstance(text, list) else [text]
    tf.text = lines[0]
    for l in lines[1:]: tf.add_paragraph().text = l
    return sh

def bullets(ph, items):
    """items: [(level, text)] into a placeholder"""
    tf = ph.text_frame
    for i, (lv, t) in enumerate(items):
        q = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        q.text = t; q.level = lv

def wide(p): p.slide_width = Inches(13.333); p.slide_height = Inches(7.5)

# ---- right decks, PowerPoint's template ------------------------------------------------------------------------------
# r01: a toolbox talk -- title slide, bullets at three levels, section header, two content, comparison, picture with caption
p = Presentation(); L = p.slide_layouts
p.core_properties.title = "Safe lifting"
s = p.slides.add_slide(L[0]); s.shapes.title.text = "Safe Lifting"; s.placeholders[1].text = "Toolbox talk, Monday 7:30"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Before you lift"
bullets(s.placeholders[1], [(0, "Size up the load"), (1, "Weight on the label"), (2, "Over 25 kg: two people"), (1, "Sharp edges"), (0, "Clear the path")])
s = p.slides.add_slide(L[2]); s.shapes.title.text = "Part 2: Carrying"; s.placeholders[1].text = "Keep it close"
s = p.slides.add_slide(L[3]); s.shapes.title.text = "Hand tools and power tools"
bullets(s.placeholders[1], [(0, "Saw"), (0, "Chisel"), (0, "Plane")]); bullets(s.placeholders[2], [(0, "Drill"), (0, "Grinder"), (0, "Router")])
s = p.slides.add_slide(L[4]); s.shapes.title.text = "Gloves"
s.placeholders[1].text = "Leather"; bullets(s.placeholders[2], [(0, "Rough timber"), (0, "Steel edges")])
s.placeholders[3].text = "Nitrile"; bullets(s.placeholders[4], [(0, "Oils"), (0, "Solvents")])
s = p.slides.add_slide(L[8]); s.shapes.title.text = "The right grip"
s.placeholders[1].insert_picture(png(300, 200, (20, 120, 200))); s.placeholders[2].text = "Palms under the box, elbows in."
s.notes_slide.notes_text_frame.text = "Show the grip.\n\nPause: let them try it.\nAsk who has a bad back."
save(p, "r01_toolbox.pptx")

# r02: boxes on a slide -- grids, a timeline, a heading over two columns, step boxes
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Four steps, a grid"   # 2 by 2, the same gap both ways
box(s, 0.5, 1.8, 4.2, 2.2, ["1. Prepare the form", "Oil the boards"]); box(s, 5.2, 1.8, 4.2, 2.2, ["2. Mix", "3 sand to 1 cement"])
box(s, 0.5, 4.4, 4.2, 2.2, ["3. Pour", "Fill in layers"]); box(s, 5.2, 4.4, 4.2, 2.2, ["4. Cure", "Keep it wet 7 days"])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Six steps, a grid"   # 3 by 2, wider gaps across than down
for i, (t, u) in enumerate([("1. Isolate", "Main switch off"), ("2. Lock", "Your own lock"), ("3. Tag", "Name and date"), ("4. Test", "Try the start button"), ("5. Work", "Only now"), ("6. Restore", "Tell the crew")]):
    box(s, 0.4 + (i % 3) * 3.2, 1.8 + (i // 3) * 2.45, 2.7, 2.2, [t, u])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Our history"   # a timeline in one row, with a line under it
s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(0.5), Inches(4.5), Inches(9.5), Inches(4.5))
for i, (y, t) in enumerate([("1985", "Founded"), ("1992", "First depot"), ("2001", "Second depot"), ("2012", "New fleet"), ("2020", "Solar roof")]):
    box(s, 0.5 + i * 1.85, 3.2, 1.6, 1.1, [y, t])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Our history, up and down"   # a timeline, above and below its line in turn
s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(0.5), Inches(4.4), Inches(9.5), Inches(4.4))
for i, (y, t) in enumerate([("1985", "Founded"), ("1992", "First depot"), ("2001", "Second depot"), ("2012", "New fleet"), ("2020", "Solar roof")]):
    box(s, 0.4 + i * 1.75, 2.9 if i % 2 == 0 else 4.7, 2.1, 1.2, [y, t])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Two ways to fix a leak"   # a heading over two columns
box(s, 0.5, 1.6, 9.0, 0.6, "Turn the water off first, at the stop tap.")
box(s, 0.5, 2.6, 4.3, 3.5, ["Compression joint", "Tighten a quarter turn", "Do not overtighten"])
box(s, 5.2, 2.6, 4.3, 3.5, ["Soldered joint", "Drain the pipe", "Clean and flux"])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Columns with their own headings"   # each heading over its own column
box(s, 0.5, 1.7, 4.3, 0.6, "Petrol engines"); box(s, 5.2, 1.7, 4.3, 0.6, "Diesel engines")
box(s, 0.5, 2.45, 4.3, 3.0, ["Spark plugs", "Lighter oil"]); box(s, 5.2, 2.45, 4.3, 3.0, ["Glow plugs", "Fuel filter water trap"])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Step boxes"   # chevrons left to right, a step a little lower each time
for i, t in enumerate(["Plan", "Order parts", "Fit", "Test"]):
    box(s, 0.4 + i * 2.35, 3.0 + i * 0.15, 2.2, 1.0, t, MSO_SHAPE.CHEVRON)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Picture left, words right"   # a caption box beside a picture
s.shapes.add_picture(png(200, 260, (150, 90, 40)), Inches(0.5), Inches(1.8), Inches(3.5), Inches(4.5))
box(s, 4.5, 1.8, 5, 1.0, "The old pump"); box(s, 4.5, 3.0, 5, 2.0, ["Bearings worn", "Seal leaking"])
save(p, "r02_boxes.pptx")

# r03: a table with joined cells, charts (percent, dates, several series, a scatter), a chart in a content placeholder
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Rota"
t = s.shapes.add_table(4, 4, Inches(0.5), Inches(1.8), Inches(9), Inches(3)).table
for ri, row in enumerate([["Day", "Morning", "Afternoon", "Night"], ["Mon", "Ann", "Bo", "Cy"], ["Tue", "Ann", "Dee", ""], ["Wed", "Off", "", ""]]):
    for ci, v in enumerate(row): t.cell(ri, ci).text = v
t.cell(2, 3).merge(t.cell(3, 3)); t.cell(3, 1).merge(t.cell(3, 2))
t.cell(2, 3).text = "Eve"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Where the water goes"
cd = CategoryChartData(number_format='0%'); cd.categories = ["Kitchen", "Bathroom", "Garden"]; cd.add_series("Share", (0.25, 0.5, 0.25))
s.shapes.add_chart(XL_CHART_TYPE.PIE, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Rainfall by month"
cd = CategoryChartData(); cd.categories = [datetime.date(2025, m, 1) for m in (1, 2, 3)]; cd.categories.number_format = "mmm yyyy"; cd.add_series("mm", (80, 62, 71))
s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Test scores"
cd = CategoryChartData(); cd.categories = ["Class A", "Class B"]; cd.add_series("Maths", (61, 70)); cd.add_series("Reading", (75, 68)); cd.add_series("Science", (58, 66))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Pass rate"
cd = CategoryChartData(number_format='0.0%'); cd.categories = ["2023", "2024"]; cd.add_series("Pass", (0.875, 0.9125))
s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Percent typed as whole numbers"
cd = CategoryChartData(number_format='0"%"'); cd.categories = ["North", "South"]; cd.add_series("Done", (40, 65))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Deliveries by day"
cd = CategoryChartData(); cd.categories = [datetime.date(2025, 3, d) for d in (3, 4, 5)]; cd.categories.number_format = "d-mmm-yy"; cd.add_series("Loads", (4, 6, 5))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Sales by year"
cd = CategoryChartData(); cd.categories = [datetime.date(y, 1, 1) for y in (2022, 2023, 2024)]; cd.categories.number_format = "yyyy"; cd.add_series("Units", (100, 120, 150))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
save(p, "r03_tables_charts.pptx")

# r04: speaker notes with pauses, runs with looks, links, fields, line breaks, a numbered list, a hidden slide, groups
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Looks and links"
tf = s.placeholders[1].text_frame
q = tf.paragraphs[0]
for txt, f in [("Wear ", None), ("ear", "b"), (" and ", None), ("eye", "i"), (" protection, ", None), ("always", "u")]:
    r = q.add_run(); r.text = txt
    if f == "b": r.font.bold = True
    if f == "i": r.font.italic = True
    if f == "u": r.font.underline = True
q = tf.add_paragraph(); r = q.add_run(); r.text = "Rules at "; r = q.add_run(); r.text = "the safety site"; r.hyperlink.address = "https://example.org/safety rules?a=1&b=2"
q = tf.add_paragraph(); r = q.add_run(); r.text = "First line\vsecond line"
s.notes_slide.notes_text_frame.text = "Welcome everyone.\n\nPause here for questions.\n\n\nThen move on."
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Grouped notes"
g = s.shapes.add_group_shape()
gg = g.shapes.add_group_shape()
box(gg, 1, 2, 3, 0.8, "Top of the inner group"); box(gg, 1, 3.2, 3, 0.8, "Bottom of the inner group")
box(g, 5, 2.4, 3, 0.8, "Beside, in the outer group")
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Trainer only"; s.placeholders[1].text = "Answers to the quiz"
s = p.slides.add_slide(L[1]); s.shapes.title.text = ""; bullets(s.placeholders[1], [(0, "Questions?")])
s = p.slides.add_slide(L[6]); box(s, 0.5, 0.4, 9, 0.9, "Water filter care"); box(s, 0.5, 1.6, 9, 3, ["Rinse the candle weekly", "Never use soap"])
s = p.slides.add_slide(L[6]); box(s, 2, 3, 6, 1, "Thank you")
save(p, "r04_notes_looks.pptx", {
    "ppt/slides/slide3.xml": lambda d: d.replace("<p:sld ", '<p:sld show="0" ', 1),
    "ppt/presentation.xml": lambda d: d.replace("</p:presentation>", '<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p14:section name="Welcome" id="{11111111-1111-1111-1111-111111111111}"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section><p14:section name="Practice" id="{22222222-2222-2222-2222-222222222222}"><p14:sldIdLst><p14:sldId id="257"/><p14:sldId id="258"/><p14:sldId id="259"/><p14:sldId id="260"/><p14:sldId id="261"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst></p:presentation>'),
})

# r05: numbering as PowerPoint writes it -- types, start numbers, levels, numbers from the layout, right-to-left text
p = Presentation(); L = p.slide_layouts
def numbered(name, items):
    s = p.slides.add_slide(L[1]); s.shapes.title.text = name; bullets(s.placeholders[1], items); return s
numbered("Letters", [(0, "Gloves"), (0, "Goggles"), (0, "Boots")])
numbered("Roman from four", [(0, "Fourth"), (0, "Fifth")])
numbered("Steps with sub-steps", [(0, "Isolate"), (1, "Breaker off"), (1, "Lock on"), (0, "Prove dead"), (0, "Work")])
numbered("Plain then numbered", [(0, "Read this first"), (0, "Open the valve"), (0, "Bleed the air")])
s = p.slides.add_slide(L[1]); s.shapes.title.text = "السلامة"; s.placeholders[1].text = "ارتد القفازات"
def autonum(kinds):
    """kinds: one per paragraph of the content box: None (as it is), "none" (buNone), or (type, startAt or None)"""
    def f(d):
        body = d[d.index('idx="1"'):]; head = d[:d.index('idx="1"')]; k = [0]
        def one(m):
            i = k[0]; k[0] += 1
            kd = kinds[i] if i < len(kinds) else None
            lvl = m.group(1) or ""
            if kd is None: return m.group(0)
            if kd == "none": return '<a:p><a:pPr%s marL="0" indent="0"><a:buNone/></a:pPr>' % lvl
            at = ' startAt="%d"' % kd[1] if kd[1] else ""
            return '<a:p><a:pPr%s marL="%d" indent="-457200"><a:buFont typeface="+mj-lt"/><a:buAutoNum type="%s"%s/></a:pPr>' % (lvl, 457200 * (2 if lvl else 1), kd[0], at)
        body = re.sub(r'<a:p>(?:<a:pPr( lvl="\d")?/>)?', one, body)
        return head + body
    return f
save(p, "r05_numbering.pptx", {
    "ppt/slides/slide1.xml": autonum([("alphaLcParenR", None)] * 3),
    "ppt/slides/slide2.xml": autonum([("romanUcPeriod", 4)] * 2),
    "ppt/slides/slide3.xml": autonum([("arabicPeriod", None), ("alphaLcPeriod", None), ("alphaLcPeriod", None), ("arabicPeriod", None), ("arabicPeriod", None)]),
    "ppt/slides/slide4.xml": autonum(["none", ("arabicParenR", None), ("arabicParenR", None)]),
    "ppt/slides/slide5.xml": lambda d: d.replace("<a:p><a:r>", '<a:p><a:pPr algn="r" rtl="1"/><a:r>'),
})

# r06: pictures -- six photos in a grid, one cropped, one turned and flipped, a GIF and a BMP, a picture in a WMF
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Site photos"
cols = [(200, 30, 30), (30, 160, 30), (30, 30, 200), (220, 200, 20), (20, 200, 200), (200, 20, 200)]
for i, c in enumerate(cols): s.shapes.add_picture(png(120, 90, c), Inches(0.5 + (i % 3) * 3.1), Inches(1.8 + (i // 3) * 2.6), Inches(2.8), Inches(2.1))
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Cropped to the top left"
pic = s.shapes.add_picture(png(200, 200, (0, 0, 0), [(220, 20, 20), (20, 20, 220), (20, 180, 20), (230, 230, 30)]), Inches(2), Inches(2), Inches(4), Inches(4))
pic.crop_right = 0.5; pic.crop_bottom = 0.5
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Turned and flipped"
pic = s.shapes.add_picture(png(300, 100, (0, 0, 0), [(220, 20, 20), (20, 20, 220), (220, 20, 20), (20, 20, 220)]), Inches(2), Inches(3), Inches(6), Inches(2))
pic.rotation = 90
s = p.slides.add_slide(L[5]); s.shapes.title.text = "A GIF"
gb = io.BytesIO(); Image.new("RGB", (60, 40), (250, 120, 0)).save(gb, "GIF"); gb.seek(0); s.shapes.add_picture(gb, Inches(2), Inches(2), Inches(3), Inches(2))
s = p.slides.add_slide(L[5]); s.shapes.title.text = "A BMP"
bb = io.BytesIO(); Image.new("RGB", (60, 40), (0, 120, 250)).save(bb, "BMP"); bb.seek(0); s.shapes.add_picture(bb, Inches(2), Inches(2), Inches(3), Inches(2))
s = p.slides.add_slide(L[5]); s.shapes.title.text = "A TIFF"
tb = io.BytesIO(); Image.new("RGB", (60, 40), (120, 0, 250)).save(tb, "TIFF"); tb.seek(0); s.shapes.add_picture(tb, Inches(2), Inches(2), Inches(3), Inches(2))
save(p, "r06_pictures.pptx", {"ppt/slides/slide3.xml": lambda d: d.replace('<a:xfrm rot="5400000">', '<a:xfrm rot="5400000" flipH="1">', 1)})

# r07: wide (16:9) deck, title and core title, footers and slide numbers on the slide (not its text)
p = Presentation(); wide(p); L = p.slide_layouts
p.core_properties.title = "Forklift refresher"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Daily checks"; bullets(s.placeholders[1], [(0, "Tyres"), (0, "Forks"), (0, "Horn")])
save(p, "r07_wide.pptx", {"ppt/slides/slide1.xml": lambda d: d.replace("</p:spTree>", '<p:sp><p:nvSpPr><p:cNvPr id="9" name="Footer"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Depot 4 training</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="10" name="Slide Number"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="12"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US"/><a:t>1</a:t></a:fld></a:p></p:txBody></p:sp></p:spTree>')})

# r08: SmartArt -- a process of three steps and a hierarchy (python-pptx cannot make one: written as PowerPoint writes it)
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Lockout, the process"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Who reports to whom"
def dgm_frame(rid):
    return ('<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Diagram 3"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
            '<p:xfrm><a:off x="914400" y="1828800"/><a:ext cx="7315200" cy="4114800"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">'
            '<dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="%s" r:lo="%sl" r:qs="%sq" r:cs="%sc"/></a:graphicData></a:graphic></p:graphicFrame>' % (rid, rid, rid, rid))
def dgm_data(points, cxns):
    pts = '<dgm:pt modelId="{0}" type="doc"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>'
    for mid, t in points:
        pts += '<dgm:pt modelId="{%s}"><dgm:prSet phldrT="[Text]"/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>%s</a:t></a:r></a:p></dgm:t></dgm:pt>' % (mid, t)
        pts += '<dgm:pt modelId="{%s-p}" type="parTrans" cxnId="{c%s}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>' % (mid, mid)
        pts += '<dgm:pt modelId="{%s-s}" type="sibTrans" cxnId="{c%s}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></dgm:t></dgm:pt>' % (mid, mid)
        pts += '<dgm:pt modelId="{%s-pres}" type="pres"><dgm:prSet presName="node"/><dgm:spPr/></dgm:pt>' % mid
    cx = "".join('<dgm:cxn modelId="{c%s}" srcId="{%s}" destId="{%s}" srcOrd="%d" destOrd="0" parTransId="{%s-p}" sibTransId="{%s-s}"/>' % (d, s_, d, i, d, d) for i, (s_, d) in enumerate(cxns))
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
            '<dgm:ptLst>%s</dgm:ptLst><dgm:cxnLst>%s</dgm:cxnLst><dgm:bg/><dgm:whole/></dgm:dataModel>' % (pts, cx)).encode("utf-8")
DG = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagram"
def add_rels(d, rid, n):
    return d.replace("</Relationships>", '<Relationship Id="%s" Type="%sData" Target="../diagrams/data%d.xml"/><Relationship Id="%sl" Type="%sLayout" Target="../diagrams/layout%d.xml"/><Relationship Id="%sq" Type="%sQuickStyle" Target="../diagrams/quickStyle%d.xml"/><Relationship Id="%sc" Type="%sColors" Target="../diagrams/colors%d.xml"/></Relationships>' % (rid, DG, n, rid, DG, n, rid, DG, n, rid, DG, n))
MINI = lambda root, ns: ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<dgm:%s xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>' % root).encode()
ed = {
    "ppt/slides/slide1.xml": lambda d: d.replace("</p:spTree>", dgm_frame("rId9") + "</p:spTree>"),
    "ppt/slides/slide2.xml": lambda d: d.replace("</p:spTree>", dgm_frame("rId9") + "</p:spTree>"),
    "ppt/slides/_rels/slide1.xml.rels": lambda d: add_rels(d, "rId9", 1),
    "ppt/slides/_rels/slide2.xml.rels": lambda d: add_rels(d, "rId9", 2),
    "ppt/diagrams/data1.xml": dgm_data([("1", "Isolate"), ("2", "Lock and tag"), ("3", "Prove dead")], [("0", "1"), ("0", "2"), ("0", "3")]),
    "ppt/diagrams/data2.xml": dgm_data([("1", "Site manager"), ("2", "Foreman"), ("3", "Electrician"), ("4", "Apprentice")], [("0", "1"), ("1", "2"), ("2", "3"), ("3", "4")]),
    "[Content_Types].xml": lambda d: d.replace("</Types>", "".join('<Override PartName="/ppt/diagrams/%s%d.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagram%s+xml"/>' % (a, n, b) for n in (1, 2) for a, b in [("data", "Data"), ("layout", "Layout"), ("quickStyle", "Style"), ("colors", "Colors")]) + "</Types>"),
}
for n in (1, 2):
    ed["ppt/diagrams/layout%d.xml" % n] = MINI("layoutDef", 0); ed["ppt/diagrams/quickStyle%d.xml" % n] = MINI("styleDef", 0); ed["ppt/diagrams/colors%d.xml" % n] = MINI("colorsDef", 0)
save(p, "r08_smartart.pptx", ed)

# r09: a Google Slides-style file: every paragraph's bullet written on it, placeholders with their own places, notes
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[0]); s.shapes.title.text = "Garden club"; s.placeholders[1].text = "Spring planting"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Seeds to sow now"; bullets(s.placeholders[1], [(0, "Peas"), (1, "Direct in the ground"), (0, "Lettuce")])
s.notes_slide.notes_text_frame.text = "Bring the seed packets."
def google(d):
    # Google writes each paragraph's bullet and indent, a body placeholder as type="body", and buNone on plain text
    d = d.replace('<p:ph idx="1"/>', '<p:ph type="body" idx="1"/>')
    d = re.sub(r'<a:p><a:pPr lvl="1"/>', '<a:p><a:pPr marL="914400" lvl="1" indent="-342900" algn="l" rtl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="1800"/><a:buChar char="○"/></a:pPr>', d)
    d = re.sub(r'<a:p>(?=<a:r>)', '<a:p><a:pPr marL="457200" lvl="0" indent="-342900" algn="l" rtl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buSzPts val="1800"/><a:buChar char="●"/></a:pPr>', d)
    return d
def gtitle(d):
    return re.sub(r'<a:p>(?=<a:r>)', '<a:p><a:pPr marL="0" lvl="0" indent="0" algn="l" rtl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buNone/></a:pPr>', d)
def gslide2(d):
    a = d.index('type="title"'); b = d.index('idx="1"')
    return d[:a] + gtitle(d[a:b]) + google(d[b:])
save(p, "r09_google_style.pptx", {"ppt/slides/slide2.xml": gslide2, "ppt/slides/slide1.xml": gtitle})

# r10: strict OOXML names (ISO/IEC 29500 Strict) for the same toolbox talk
src = open(os.path.join(OUT, "r01_toolbox.pptx"), "rb").read()
zi = zipfile.ZipFile(io.BytesIO(src)); out = io.BytesIO(); zo = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
STRICT = [("http://schemas.openxmlformats.org/officeDocument/2006/relationships/metadata/core-properties", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"),
          ("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "http://purl.oclc.org/ooxml/officeDocument/relationships"),
          ("http://schemas.openxmlformats.org/presentationml/2006/main", "http://purl.oclc.org/ooxml/presentationml/main"),
          ("http://schemas.openxmlformats.org/drawingml/2006/main", "http://purl.oclc.org/ooxml/drawingml/main")]
for n in zi.namelist():
    d = zi.read(n)
    if n.endswith(".xml") or n.endswith(".rels"):
        t = d.decode("utf-8")
        for a, b in STRICT: t = t.replace(a, b)
        d = t.encode("utf-8")
    zo.writestr(n, d)
zo.close(); open(os.path.join(OUT, "r10_strict.pptx"), "wb").write(out.getvalue())

# r11: the same deck zipped as a program that streams its zip writes it (sizes after each part: Java, Google's servers)
class Pipe(io.RawIOBase):
    def __init__(self): self.b = bytearray()
    def writable(self): return True
    def write(self, x): self.b += x; return len(x)
    def seekable(self): return False
pipe = Pipe(); zo = zipfile.ZipFile(pipe, "w", zipfile.ZIP_DEFLATED); zi = zipfile.ZipFile(io.BytesIO(src))
for n in zi.namelist(): zo.writestr(n, zi.read(n))
zo.close(); open(os.path.join(OUT, "r11_streamed_zip.pptx"), "wb").write(bytes(pipe.b))

# r12: a macro deck (.pptm), a show (.ppsx) and a template (.potx): the same slides
for ext, ct in [("pptm", "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml"), ("ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml"), ("potx", "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml")]:
    d = edit(src, {"[Content_Types].xml": lambda t, ct=ct: t.replace("application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", ct)})
    open(os.path.join(OUT, "r12_kind.%s" % ext), "wb").write(d)


# r13: more boxes -- a 3 by 2 grid of steps well under the title, a 2 by 2 grid with a wide gutter, a timeline with its
# years above the line and what happened below, column headings at the usual distance, a grid hand-placed a little uneven
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Six steps, under the title"
for i, (t, u) in enumerate([("1. Isolate", "Main switch off"), ("2. Lock", "Your own lock"), ("3. Tag", "Name and date"), ("4. Test", "Try the start button"), ("5. Work", "Only now"), ("6. Restore", "Tell the crew")]):
    box(s, 0.4 + (i % 3) * 3.2, 2.1 + (i // 3) * 2.45, 2.7, 2.2, [t, u])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Mixing mortar"
for i, (t, u) in enumerate([("1. Measure", "3 sand, 1 cement"), ("2. Dry mix", "Until one colour"), ("3. Add water", "A little at a time"), ("4. Use it", "Within two hours")]):
    box(s, 0.5 + (i % 2) * 4.8, 2.2 + (i // 2) * 2.4, 4.0, 2.1, [t, u])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "The depot over the years"
s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(0.5), Inches(3.6), Inches(9.5), Inches(3.6))
for i, (y, t) in enumerate([("1985", "Founded"), ("1992", "First depot"), ("2001", "Second depot"), ("2012", "New fleet")]):
    box(s, 0.6 + i * 2.3, 2.6, 2.0, 0.6, y); box(s, 0.6 + i * 2.3, 4.2, 2.0, 1.2, t)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Engines"
box(s, 0.5, 2.0, 4.3, 0.6, "Petrol engines"); box(s, 5.2, 2.0, 4.3, 0.6, "Diesel engines")
box(s, 0.5, 2.75, 4.3, 3.0, ["Spark plugs", "Lighter oil"]); box(s, 5.2, 2.75, 4.3, 3.0, ["Glow plugs", "Fuel filter water trap"])
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Four seasons"
box(s, 0.5, 2.0, 4.2, 2.0, ["Spring", "Sow peas"]); box(s, 5.3, 2.2, 4.2, 2.0, ["Summer", "Water at dusk"])
box(s, 0.6, 4.5, 4.2, 2.0, ["Autumn", "Lift potatoes"]); box(s, 5.2, 4.6, 4.2, 2.0, ["Winter", "Mend tools"])
save(p, "r13_more_boxes.pptx")

# r14: a SmartArt process whose fourth step was put in between afterwards (PowerPoint keeps the new point last in the
# list of points, and its place in the order of the connections, srcOrd)
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Lockout, edited"
ed = {
    "ppt/slides/slide1.xml": lambda d: d.replace("</p:spTree>", dgm_frame("rId9") + "</p:spTree>"),
    "ppt/slides/_rels/slide1.xml.rels": lambda d: add_rels(d, "rId9", 1),
    "ppt/diagrams/data1.xml": dgm_data([("1", "Isolate"), ("2", "Lock"), ("4", "Prove dead"), ("3", "Tag")], [("0", "1"), ("0", "2"), ("0", "3"), ("0", "4")]),
    "[Content_Types].xml": lambda d: d.replace("</Types>", "".join('<Override PartName="/ppt/diagrams/%s1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagram%s+xml"/>' % (a, b) for a, b in [("data", "Data"), ("layout", "Layout"), ("quickStyle", "Style"), ("colors", "Colors")]) + "</Types>"),
    "ppt/diagrams/layout1.xml": MINI("layoutDef", 0), "ppt/diagrams/quickStyle1.xml": MINI("styleDef", 0), "ppt/diagrams/colors1.xml": MINI("colorsDef", 0),
}
save(p, "r14_smartart_order.pptx", ed)

# r15: more charts -- quarters under years (two levels of categories), a percent written 0\%, dates as m/d/yyyy
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Sales by quarter"
cd = CategoryChartData()
for y in ("2023", "2024"):
    c = cd.add_category(y)
    for q in ("Q1", "Q2"): c.add_sub_category(q)
cd.add_series("Units", (10, 12, 14, 16))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Attendance"
cd = CategoryChartData(number_format='0\\%'); cd.categories = ["Mon", "Tue"]; cd.add_series("Present", (92, 88))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Inspections"
cd = CategoryChartData(); cd.categories = [datetime.date(2025, 3, 4), datetime.date(2025, 3, 11)]; cd.categories.number_format = "m/d/yyyy"; cd.add_series("Faults", (3, 1))
s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
save(p, "r15_more_charts.pptx")

# r16: small things -- a title slide with only its subtitle filled, a table without a header row, notes with bullets,
# a line break written as python-pptx writes a vertical tab in a run (_x000B_), a title with a line break
p = Presentation(); L = p.slide_layouts
s = p.slides.add_slide(L[0]); s.placeholders[1].text = "Week 3: knots"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Knots"
t = s.shapes.add_table(2, 2, Inches(0.5), Inches(1.8), Inches(9), Inches(1.5))
t.table.first_row = False
for ri, row in enumerate([["Bowline", "A fixed loop"], ["Clove hitch", "To a post"]]):
    for ci, v in enumerate(row): t.table.cell(ri, ci).text = v
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Reef knot"; s.placeholders[1].text = "Right over left, left over right"
nf = s.notes_slide.notes_text_frame; nf.text = "Hand out rope."
for t2 in ("Pair them up", "Check each knot"):
    q = nf.add_paragraph(); q.text = t2
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Two lines"
q = s.placeholders[1].text_frame.paragraphs[0]; r = q.add_run(); r.text = "Name\vDate"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Week 3\vKnots"; s.placeholders[1].text = "x"
def bulnotes(d):
    i = d.index("Pair them up"); j = d.rindex("<a:p>", 0, i)
    d = d[:j] + '<a:p><a:pPr marL="171450" indent="-171450"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/></a:pPr>' + d[j + 5:]
    i = d.index("Check each knot"); j = d.rindex("<a:p>", 0, i)
    return d[:j] + '<a:p><a:pPr marL="171450" indent="-171450"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/></a:pPr>' + d[j + 5:]
save(p, "r16_small_things.pptx", {"ppt/notesSlides/notesSlide1.xml": bulnotes})

# r17: EMF pictures as Visio and older Office put them in a deck: slide 1 an .emf (the shapes of emf/e01_shapes.emf),
# slide 2 the same packed as .emz (gzip), slide 3 an .emf of a path of lines (emf/e23_path_lines.emf)
import gzip
EMFD = os.path.join(HERE, "emf")
if os.path.exists(os.path.join(EMFD, "e01_shapes.emf")) and os.path.exists(os.path.join(EMFD, "e23_path_lines.emf")):
    p = Presentation(); L = p.slide_layouts
    for t in ("A Visio drawing", "The same, packed", "A triangle of lines"):
        s = p.slides.add_slide(L[5]); s.shapes.title.text = t
        s.shapes.add_picture(png(40, 30, (200, 200, 200)), Inches(1), Inches(2), Inches(6), Inches(4.5))
    b = io.BytesIO(); p.save(b); d = b.getvalue(); zi = zipfile.ZipFile(io.BytesIO(d))
    e01 = open(os.path.join(EMFD, "e01_shapes.emf"), "rb").read(); e23 = open(os.path.join(EMFD, "e23_path_lines.emf"), "rb").read()
    ed = {}
    for n, (ext, data) in zip((1, 2, 3), [("emf", e01), ("emz", gzip.compress(e01, mtime=0)), ("emf", e23)]):
        rels = zi.read("ppt/slides/_rels/slide%d.xml.rels" % n).decode()
        m = re.search(r'Target="../media/(image\d+)\.png"', rels)
        ed["ppt/slides/_rels/slide%d.xml.rels" % n] = (lambda old, new: (lambda t: t.replace(old, new)))(m.group(0), 'Target="../media/%s_%d.%s"' % (m.group(1), n, ext))
        ed["ppt/media/%s_%d.%s" % (m.group(1), n, ext)] = data
    ed["[Content_Types].xml"] = lambda t: t.replace("<Default ", '<Default Extension="emf" ContentType="image/x-emf"/><Default Extension="emz" ContentType="image/x-emz"/><Default ', 1)
    out = edit(d, ed)
    # the PNG parts the slides no longer use are left out
    zi2 = zipfile.ZipFile(io.BytesIO(out)); used = set()
    for n in zi2.namelist():
        if n.endswith(".rels"): used.update(re.findall(r'Target="\.\./media/([^"]+)"', zi2.read(n).decode()))
    out = edit(out, {n: None for n in zi2.namelist() if n.startswith("ppt/media/") and n.split("/")[-1] not in used})
    open(os.path.join(OUT, "r17_emf.pptx"), "wb").write(out)
else:
    print("emf/ is not made yet: run make_emf.py, then this again, for r17_emf.pptx")

# r18: a deck from a stranger, written to run a script in whatever shows it: markup in a title, in text, in a link's
# address, in a chart's series name, in a table cell, in SmartArt and in the notes
p = Presentation(); L = p.slide_layouts
EVIL = '<img src=x onerror="alert(1)">'
s = p.slides.add_slide(L[1]); s.shapes.title.text = EVIL; s.placeholders[1].text = "text " + EVIL
q = s.placeholders[1].text_frame.add_paragraph(); r = q.add_run(); r.text = "a link"; r.hyperlink.address = 'https://example.org/"><script>alert(2)</script>'
q = s.placeholders[1].text_frame.add_paragraph(); r = q.add_run(); r.text = "a script link"; r.hyperlink.address = "javascript:alert(3)"
s.notes_slide.notes_text_frame.text = "<script>alert(4)</script>"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Chart"
cd = CategoryChartData(); cd.categories = ['<b onmouseover="alert(5)">A</b>']; cd.add_series('<svg onload="alert(6)">', (1,))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
t = s.shapes.add_table(1, 1, Inches(1), Inches(6.6), Inches(3), Inches(0.5)).table; t.cell(0, 0).text = '<iframe src="javascript:alert(7)">'
save(p, "r18_hostile.pptx")

# ---- damaged and wrong files --------------------------------------------------------------------------------------
open(os.path.join(OUT, "w01_empty.pptx"), "wb").write(b"")
open(os.path.join(OUT, "w02_cut_short.pptx"), "wb").write(src[: len(src) // 2])
open(os.path.join(OUT, "w03_text.pptx"), "wb").write(b"This is not a presentation, it is a note saying where the deck is.\n")
open(os.path.join(OUT, "w04_broken_slide.pptx"), "wb").write(edit(src, {"ppt/slides/slide2.xml": lambda d: d[: len(d) // 2]}))
open(os.path.join(OUT, "w05_broken_notes.pptx"), "wb").write(edit(src, {"ppt/notesSlides/notesSlide1.xml": lambda d: d.replace("</p:notes>", "")}))
open(os.path.join(OUT, "w06_broken_layout.pptx"), "wb").write(edit(src, {"ppt/slideLayouts/slideLayout2.xml": lambda d: d[:300]}))
open(os.path.join(OUT, "w07_missing_picture.pptx"), "wb").write(edit(src, {n: None for n in zipfile.ZipFile(io.BytesIO(src)).namelist() if n.startswith("ppt/media/")}))
open(os.path.join(OUT, "w08_broken_content_types.pptx"), "wb").write(edit(src, {"[Content_Types].xml": lambda d: d[:200]}))
open(os.path.join(OUT, "w09_missing_slide_part.pptx"), "wb").write(edit(src, {"ppt/slides/slide3.xml": None}))
kz = io.BytesIO(); z = zipfile.ZipFile(kz, "w"); z.writestr("Index/Document.iwa", b"\0" * 40); z.writestr("Metadata/Properties.plist", b"<plist/>"); z.writestr("preview.jpg", b"\xff\xd8\xff"); z.close()
open(os.path.join(OUT, "w10_keynote.pptx"), "wb").write(kz.getvalue())
rz = io.BytesIO(); z = zipfile.ZipFile(rz, "w"); z.writestr("photos/one.jpg", b"\xff\xd8\xff"); z.writestr("readme.txt", "holiday photos"); z.close()
open(os.path.join(OUT, "w11_photos.zip.pptx"), "wb").write(rz.getvalue())
import docx, openpyxl
dd = docx.Document(); dd.add_paragraph("A letter, not slides"); db = io.BytesIO(); dd.save(db); open(os.path.join(OUT, "w12_word.pptx"), "wb").write(db.getvalue())
wb = openpyxl.Workbook(); wb.active["A1"] = "a sheet"; xb = io.BytesIO(); wb.save(xb); open(os.path.join(OUT, "w13_excel.pptx"), "wb").write(xb.getvalue())

# ---- LibreOffice: its own saves (pptx, ppt, odp, pdf), and a password-locked file --------------------------------
so = shutil.which("soffice") or shutil.which("libreoffice")
if so:
    tmp = tempfile.mkdtemp(prefix="pptx_r2_"); env = dict(os.environ, HOME=tmp)
    def lo(src_name, filt, out_name):
        d = os.path.join(tmp, "o"); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        subprocess.run([so, "--headless", "--convert-to", filt, "--outdir", d, os.path.join(OUT, src_name)], capture_output=True, timeout=300, env=env)
        got = [f for f in os.listdir(d)]
        if got: shutil.copy(os.path.join(d, got[0]), os.path.join(OUT, out_name))
        else: print("LibreOffice made nothing for", out_name)
    lo("r01_toolbox.pptx", "pptx:Impress Office Open XML", "lo01_toolbox.pptx")
    lo("r02_boxes.pptx", "pptx:Impress Office Open XML", "lo02_boxes.pptx")
    lo("r05_numbering.pptx", "pptx:Impress Office Open XML", "lo05_numbering.pptx")
    lo("r01_toolbox.pptx", "odp", "w15_odp.odp"); os.replace(os.path.join(OUT, "w15_odp.odp"), os.path.join(OUT, "w15_odp.pptx")) if os.path.exists(os.path.join(OUT, "w15_odp.odp")) else None
    lo("r01_toolbox.pptx", "pdf", "w16_pdf.pdf"); os.replace(os.path.join(OUT, "w16_pdf.pdf"), os.path.join(OUT, "w16_pdf.pptx")) if os.path.exists(os.path.join(OUT, "w16_pdf.pdf")) else None
    shutil.rmtree(tmp, ignore_errors=True)
else:
    print("LibreOffice is not installed: its saves are not made")

# ---- compound files (old Office): a password-locked .pptx and an old .ppt, as their parts are named ------------------
# (LibreOffice 24.2 made neither here: its password export wrote a plain zip, and its .ppt is 500 KB; the replay makes
# a real .ppt with LibreOffice where it is installed.) A compound file of 512-byte sectors, each stream 4,096 bytes or
# more so it needs no mini stream; the streams hold filler, as Lantern reads only the names.
import struct, random
def cfb(streams):
    random.seed(7)
    sec = 512; data = []; dirents = []; start = 0
    for name, size in streams:
        n = (size + sec - 1) // sec
        dirents.append((name, start, size)); data.append(bytes(random.getrandbits(8) for _ in range(n * sec))); start += n
    nds = start; ndir = (len(dirents) + 1 + 3) // 4; nfat_entries = nds + ndir + 1
    fat_sec = nds + ndir
    fat = []
    for name, st, size in dirents:
        n = (size + sec - 1) // sec
        fat += [st + i + 1 for i in range(n - 1)] + [0xFFFFFFFE]
    fat += [nds + i + 1 for i in range(ndir - 1)] + [0xFFFFFFFE]
    fat += [0xFFFFFFFD]
    fat += [0xFFFFFFFF] * (128 - len(fat))
    def de(name, typ, st, size, child=0xFFFFFFFF, left=0xFFFFFFFF, right=0xFFFFFFFF):
        nm = name.encode("utf-16-le") + b"\0\0"
        return nm.ljust(64, b"\0") + struct.pack("<HBBIII16sIQQIII", len(nm), typ, 1, left, right, child, b"\0" * 16, 0, 0, 0, st, size, 0)
    ents = [de("Root Entry", 5, 0xFFFFFFFE, 0, child=1)]
    for i, (name, st, size) in enumerate(dirents):
        ents.append(de(name, 2, st, size, right=(i + 2) if i + 1 < len(dirents) else 0xFFFFFFFF))
    while len(ents) % 4: ents.append(b"\0" * 64 + struct.pack("<HBBIII16sIQQIII", 0, 0, 0, 0xFFFFFFFF, 0xFFFFFFFF, 0xFFFFFFFF, b"\0" * 16, 0, 0, 0, 0, 0, 0))
    hdr = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\0" * 16 + struct.pack("<HHHHHH", 0x3E, 3, 0xFFFE, 9, 6, 0) + b"\0" * 4 + struct.pack("<IIIIIIII", 0, 1, nds, 0, 0x1000, 0xFFFFFFFE, 0, 0xFFFFFFFE) + struct.pack("<I", 0)
    difat = [fat_sec] + [0xFFFFFFFF] * 108
    hdr = hdr[:76] + struct.pack("<109I", *difat)
    hdr = hdr.ljust(512, b"\0")
    return hdr + b"".join(data) + b"".join(ents) + struct.pack("<128I", *fat)
open(os.path.join(OUT, "w17_locked.pptx"), "wb").write(cfb([("EncryptionInfo", 4096), ("EncryptedPackage", 8192), ("\x06DataSpaces", 4096)]))
open(os.path.join(OUT, "w14_old_ppt.pptx"), "wb").write(cfb([("Current User", 4096), ("PowerPoint Document", 8192), ("Pictures", 4096)]))
for f in sorted(os.listdir(OUT)): print("%-34s %7d bytes" % (f, os.path.getsize(os.path.join(OUT, f))))
