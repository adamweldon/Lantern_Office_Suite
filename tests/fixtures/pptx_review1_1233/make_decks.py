# make_decks.py -- the PowerPoint files review 1 of 1.24.33 reads (tests/fixtures/pptx_review1_1233/decks). Each is a
# deck a trainer, teacher or tradesman really has, made with python-pptx and its own template, then edited by hand for
# what python-pptx does not write; or written by hand the way Google Slides, Keynote, LibreOffice and PowerPoint
# (Strict) write them. What each slide should read as is in cases_read.js.
# Run from anywhere: python3 tests/fixtures/pptx_review1_1233/make_decks.py   (LibreOffice makes d13; without it, d13 is kept)
import io, os, re, sys, zipfile, shutil, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pp import *
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
OUT = os.path.join(HERE, "decks")
os.makedirs(OUT, exist_ok=True)
def out(name, data):
    open(os.path.join(OUT, name), "wb").write(data)
    print("%-28s %7d bytes" % (name, len(data)))
PNG = img(400, 300, (30, 120, 60))

# --- d01: an ordinary course deck, one slide of each of PowerPoint's usual layouts (16:9) ---------------------------
def d01():
    p = new_prs(wide=True)
    s = slide(p, 0, "Forklift Safety Refresher"); s.placeholders[1].text = "Warehouse crew, March 2026"
    s = slide(p, 1, "Daily checks")
    para_set(s.placeholders[1].text_frame, ["Tyres and forks", "Hydraulic hoses for leaks", "Horn, lights and alarm", "Seat belt latches"])
    s.notes_slide.notes_text_frame.text = "Walk round the truck with them.\nPoint at each item."
    s = slide(p, 1, "Carrying a load")
    para_set(s.placeholders[1].text_frame, [("Keep the load low", 0), ("About 15 cm above the floor", 1), ("Mast tilted back", 1), ("Look where you are going", 0),
                                            ("Reverse if the load blocks your view", 1), ("Sound the horn at blind corners", 2)])
    s = slide(p, 2, "Part 2: Charging"); s.placeholders[1].text = "Batteries, gas and fire"
    s = slide(p, 3, "Do and don\u2019t")
    para_set(s.placeholders[1].text_frame, ["Do wear the seat belt", "Do lower the forks when parked"])
    para_set(s.placeholders[2].text_frame, ["Don\u2019t carry passengers", "Don\u2019t speed in the aisles"])
    s = slide(p, 4, "Electric or gas?")
    s.placeholders[1].text = "Electric"; para_set(s.placeholders[2].text_frame, ["Quiet", "Charge overnight"])
    s.placeholders[3].text = "Gas (LPG)"; para_set(s.placeholders[4].text_frame, ["Change the cylinder outdoors", "No charging time"])
    s = slide(p, 5, "Who to call")
    tbox(s, 1, 2, 6, 1.5, ["Supervisor: ext. 214", "First aid: ext. 999"])
    s = slide(p, 6)
    tbox(s, 0.6, 0.4, 8, 0.8, ["Any questions?"])
    s = slide(p, 8, "Worn fork heel")
    s.placeholders[1].insert_picture(io.BytesIO(PNG)); s.placeholders[2].text = "Replace the fork at 10% wear"
    s = slide(p, 1, "Speed limits")
    para_set(s.placeholders[1].text_frame, [([{"t": "10 km/h", "b": 1}, " in the yard"], 0), ([{"t": "Walking pace", "i": 1}, " in the aisles"], 0)])
    s.notes_slide.notes_text_frame.text = "Ask who has been warned.\nShow the signs."
    s = slide(p, 7, "Fire extinguisher")
    para_set(s.placeholders[1].text_frame, ["Pull the pin", "Aim at the base", "Squeeze", "Sweep side to side"])
    s.placeholders[2].text = "Remember PASS"
    data = save(p)
    data = patch(data, edits={"docProps/core.xml": lambda x: re.sub(r"<dc:title>[^<]*</dc:title>|<dc:title/>", "<dc:title>Forklift refresher</dc:title>", x)})
    out("d01_course.pptx", data)
    return data

# --- d02: numbered lists ---------------------------------------------------------------------------------------------
def d02():
    p = new_prs()
    s = slide(p, 1, "Lockout steps")
    para_set(s.placeholders[1].text_frame, [(t, 0, {"auto": "arabicPeriod"}) for t in ["Tell the operator", "Switch off", "Lock and tag", "Prove dead"]])
    s = slide(p, 1, "Carry on from five")
    para_set(s.placeholders[1].text_frame, [(t, 0, {"auto": "arabicPeriod", "start": 5}) for t in ["Refit the guard", "Remove your lock"]])
    s = slide(p, 1, "Choose one")
    para_set(s.placeholders[1].text_frame, [(t, 0, {"auto": "alphaLcParenR"}) for t in ["Replace the hose", "Repair the hose"]])
    s = slide(p, 1, "Parts of the course")
    para_set(s.placeholders[1].text_frame, [(t, 0, {"auto": "romanUcPeriod"}) for t in ["Theory", "Practice", "Test"]])
    s = slide(p, 1, "Steps with details")
    para_set(s.placeholders[1].text_frame, [("Isolate", 0, {"auto": "arabicPeriod"}), ("At the main breaker", 1), ("And at the local switch", 1), ("Prove dead", 0, {"auto": "arabicPeriod"})])
    s = slide(p, 5, "Numbers in a text box")
    tbox(s, 1, 2, 7, 3, [(t, 0, {"auto": "arabicParenR"}) for t in ["Fill the tank", "Check the level"]])
    s = slide(p, 1, "Numbered by the box")
    para_set(s.placeholders[1].text_frame, ["Read the plate", "Set the dial"])
    data = save(p)
    # slide 7: the shape's own list style numbers its first level (its paragraphs say nothing of bullets)
    def own(x):
        return x.replace("<a:lstStyle/>", '<a:lstStyle><a:lvl1pPr marL="457200" indent="-457200"><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/></a:lvl1pPr></a:lstStyle>')
    def own2(x):   # only the content placeholder's lstStyle (the second one)
        i = x.index('idx="1"'); return x[:i] + own(x[i:])
    out("d02_numbers.pptx", patch(data, edits={"ppt/slides/slide7.xml": own2}))

# --- d03: bullets that come from the layout and the master ------------------------------------------------------------
def d03():
    p = new_prs()
    s = slide(p, 1, "Plain text by the layout")         # layout 2 (Title and Content): its content box has no bullets
    para_set(s.placeholders[1].text_frame, [("A plain line", 0), ("Another plain line", 0), ("A dash under it", 1)])
    s = slide(p, 3, "Left plain, right bulleted")       # the left box's own list style says no bullets
    para_set(s.placeholders[1].text_frame, ["Left one", "Left two"])
    para_set(s.placeholders[2].text_frame, ["Right one", "Right two"])
    s = slide(p, 2, "A bullet of its own")              # Section Header's text box has none; this paragraph asks for one
    para_set(s.placeholders[1].text_frame, [("Has its own bullet", 0, {"char": "\u2022"}), ("Has none", 0)])
    s = slide(p, 0, "Two subtitle lines"); para_set(s.placeholders[1].text_frame, ["First subtitle line", "Second subtitle line"])
    s = slide(p, 3, "Indent set to nothing")            # marL=0 indent=0 moves the bullet, it does not remove it
    para_set(s.placeholders[1].text_frame, [("Still a bullet", 0, {"marL": 0, "indent": 0})])
    s = slide(p, 5, "A text box at level two")
    tbox(s, 1, 2, 7, 2, [("Level one line", 0), ("Level two line", 1)])
    s = slide(p, 3, "Bullets turned off by hand")
    para_set(s.placeholders[1].text_frame, [("No bullet here", 0, {"none": True}), ("A bullet here", 0)])
    data = save(p)
    def lay2(x):
        i = x.index('idx="1"'); j = x.index("<a:lstStyle/>", i)
        return x[:j] + '<a:lstStyle><a:lvl1pPr marL="0" indent="0"><a:buNone/></a:lvl1pPr></a:lstStyle>' + x[j + len("<a:lstStyle/>"):]
    def left(x):
        i = x.index('idx="1"'); j = x.index("<a:lstStyle/>", i)
        return x[:j] + '<a:lstStyle><a:lvl1pPr marL="0" indent="0"><a:buNone/></a:lvl1pPr></a:lstStyle>' + x[j + len("<a:lstStyle/>"):]
    # layout 2's content box: python-pptx's template has <p:txBody> with no lstStyle there; write one
    def lay2b(x):
        i = x.index('idx="1"'); j = x.index("<a:bodyPr/>", i) + len("<a:bodyPr/>")
        k = x.index("<a:lstStyle/>", j) if x.find("<a:lstStyle/>", j) == j else None
        ins = '<a:lstStyle><a:lvl1pPr marL="0" indent="0"><a:buNone/></a:lvl1pPr></a:lstStyle>'
        return x[:j] + ins + (x[j + len("<a:lstStyle/>"):] if k is not None else x[j:])
    out("d03_inherit.pptx", patch(data, edits={"ppt/slideLayouts/slideLayout2.xml": lay2b, "ppt/slides/slide2.xml": left}))
    # d03b: the master's first level has no bullet; a layout gives one back
    p = new_prs()
    s = slide(p, 1, "No bullets in this master"); para_set(s.placeholders[1].text_frame, ["Plain one", "Plain two"])
    s = slide(p, 3, "The layout gives them back"); para_set(s.placeholders[1].text_frame, ["Dashed one"]); para_set(s.placeholders[2].text_frame, ["Plain right"])
    data = save(p)
    def master(x):
        i = x.index("<p:bodyStyle>"); j = x.index("</a:lvl1pPr>", i)
        seg = x[i:j].replace('<a:buFont typeface="Arial"/><a:buChar char="\u2022"/>', "<a:buNone/>")
        return x[:i] + seg + x[j:]
    def lay4(x):
        i = x.index('idx="1"'); j = x.index("<a:bodyPr/>", i) + len("<a:bodyPr/>")
        rest = x[j:]
        if rest.startswith("<a:lstStyle/>"): rest = rest[len("<a:lstStyle/>"):]
        return x[:j] + '<a:lstStyle><a:lvl1pPr><a:buFont typeface="Arial"/><a:buChar char="\u2013"/></a:lvl1pPr></a:lstStyle>' + rest
    out("d03b_master.pptx", patch(data, edits={"ppt/slideMasters/slideMaster1.xml": master, "ppt/slideLayouts/slideLayout4.xml": lay4}))

# --- d04: tables ------------------------------------------------------------------------------------------------------
def d04():
    p = new_prs()
    s = slide(p, 5, "Bolt torque")
    t = s.shapes.add_table(4, 3, Inches(0.5), Inches(1.8), Inches(9), Inches(2.5)).table
    for ri, row in enumerate([["Bolt", "Torque", "Notes"], ["M8", "25 Nm", "dry"], ["M10", "49 Nm", "dry"], ["M12", "85 Nm", "oiled: 75 Nm"]]):
        for ci, v in enumerate(row): t.cell(ri, ci).text = v
    s = slide(p, 5, "Shift rota")
    t = s.shapes.add_table(4, 3, Inches(0.5), Inches(1.8), Inches(9), Inches(2.5)).table
    for ri, row in enumerate([["Day", "Early", "Late"], ["Mon", "Anna", "Ben"], ["Tue", "", "Cara"], ["Wed", "Dev", ""]]):
        for ci, v in enumerate(row): t.cell(ri, ci).text = v
    t.cell(1, 1).merge(t.cell(2, 1))      # Anna on Monday and Tuesday
    t.cell(3, 1).merge(t.cell(3, 2))      # Dev all Wednesday
    s = slide(p, 1, "A table in the content box")
    gf = into_ph(s, 1, s.shapes.add_table(2, 2, Inches(0.5), Inches(1.6), Inches(9), Inches(1.2))); t = gf.table
    for ri, row in enumerate([["Size", "Fuse"], ["1.5 mm\u00b2", "16 A"]]):
        for ci, v in enumerate(row): t.cell(ri, ci).text = v
    s = slide(p, 5, "No header row")
    gf = s.shapes.add_table(2, 2, Inches(0.5), Inches(1.8), Inches(6), Inches(1)); gf.table.first_row = False
    for ri, row in enumerate([["Water", "Blue"], ["Gas", "Yellow"]]):
        for ci, v in enumerate(row): gf.table.cell(ri, ci).text = v
    s = slide(p, 5, "Text above a table")
    tbox(s, 0.5, 1.6, 8, 0.6, ["Check these before you start:"])
    t = s.shapes.add_table(2, 2, Inches(0.5), Inches(2.5), Inches(6), Inches(1)).table
    for ri, row in enumerate([["Item", "OK?"], ["Guard", "yes"]]):
        for ci, v in enumerate(row): t.cell(ri, ci).text = v
    s = slide(p, 5, "Two lines in a cell")
    t = s.shapes.add_table(2, 2, Inches(0.5), Inches(1.8), Inches(6), Inches(1.5)).table
    t.cell(0, 0).text = "Step"; t.cell(0, 1).text = "What"
    t.cell(1, 0).text = "1"; tf = t.cell(1, 1).text_frame; tf.text = "Isolate"; tf.add_paragraph().text = "then lock"
    out("d04_tables.pptx", save(p))

# --- d05: charts ------------------------------------------------------------------------------------------------------
def d05():
    p = new_prs()
    s = slide(p, 5, "Sales by quarter")
    cd = CategoryChartData(); cd.categories = ["Q1", "Q2", "Q3", "Q4"]; cd.add_series("Sales", (10, 20, 30, 40))
    ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(1.8), Inches(8), Inches(4.5), cd).chart
    ch.has_title = True; ch.chart_title.text_frame.text = "Units sold"
    s = slide(p, 5, "Where the time goes")
    cd = CategoryChartData(number_format="0%"); cd.categories = ["Driving", "Loading", "Waiting"]; cd.add_series("Share", (0.5, 0.3, 0.2))
    s.shapes.add_chart(XL_CHART_TYPE.PIE, Inches(1), Inches(1.8), Inches(8), Inches(4.5), cd)
    s = slide(p, 5, "Two years")
    cd = CategoryChartData(); cd.categories = ["Jan", "Feb", "Mar"]; cd.add_series("2025", (5, 6, 7)); cd.add_series("2026", (6, 8, 9))
    s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(1), Inches(1.8), Inches(8), Inches(4.5), cd)
    s = slide(p, 5, "Pressure and flow")
    xy = XyChartData(); sr = xy.add_series("Pump A"); [sr.add_data_point(x, y) for x, y in [(1, 2.5), (2, 4.0), (3, 5.5)]]
    s.shapes.add_chart(XL_CHART_TYPE.XY_SCATTER, Inches(1), Inches(1.8), Inches(8), Inches(4.5), xy)
    s = slide(p, 3, "Chart and points")
    para_set(s.placeholders[1].text_frame, ["Hours are rising", "Plan the service"])
    cd = CategoryChartData(); cd.categories = ["Pump 1", "Pump 2"]; cd.add_series("Hours", (120, 118))
    into_ph(s, 2, s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(4.65), Inches(1.6), Inches(4.0), Inches(4.5), cd))
    import datetime
    s = slide(p, 5, "Readings by month")
    cd = CategoryChartData(); cd.categories = [datetime.date(2025, 1, 1), datetime.date(2025, 2, 1), datetime.date(2025, 3, 1)]; cd.add_series("Level", (1.2, 1.4, 1.1))
    cd.categories.number_format = "mmm yyyy" if hasattr(cd.categories, "number_format") else None
    s.shapes.add_chart(XL_CHART_TYPE.LINE, Inches(1), Inches(1.8), Inches(8), Inches(4.5), cd)
    out("d05_charts.pptx", save(p))

# --- d06: pictures ----------------------------------------------------------------------------------------------------
def d06():
    p = new_prs()
    s = slide(p, 6); s.shapes.add_picture(io.BytesIO(img(640, 480, (200, 60, 30))), 0, 0, p.slide_width, p.slide_height)          # 1 only a picture
    s = slide(p, 3, "Picture beside points"); para_set(s.placeholders[1].text_frame, ["Check the guard", "Check the belt"])   # 2
    into_ph(s, 2, s.shapes.add_picture(io.BytesIO(img(300, 400, (20, 20, 160))), Inches(5), Inches(2), Inches(3), Inches(4)), keep_xfrm=False)
    s = slide(p, 5, "Logo and photo")                                                                                       # 3
    s.shapes.add_picture(io.BytesIO(img(200, 200, (250, 200, 0))), Inches(8.8), Inches(0.2), Inches(0.8), Inches(0.8))
    s.shapes.add_picture(io.BytesIO(img(300, 200, (0, 90, 160))), Inches(1), Inches(1.8), Inches(6), Inches(4))
    s = slide(p, 5, "A JPEG photo"); s.shapes.add_picture(io.BytesIO(img(320, 240, (90, 90, 90), "JPEG")), Inches(1), Inches(1.8), Inches(6), Inches(4.5))  # 4
    s = slide(p, 5, "A GIF drawing"); s.shapes.add_picture(io.BytesIO(img(64, 48, (0, 200, 0), "GIF")), Inches(1), Inches(1.8), Inches(6), Inches(4.5))     # 5
    s = slide(p, 5, "A TIFF scan"); s.shapes.add_picture(io.BytesIO(img(64, 48, (0, 0, 0), "PNG")), Inches(1), Inches(1.8), Inches(6), Inches(4.5))         # 6 (made TIFF below)
    s = slide(p, 5, "An icon"); s.shapes.add_picture(io.BytesIO(img(96, 96, (160, 0, 160))), Inches(1), Inches(1.8), Inches(3), Inches(3))                 # 7 (SVG with its PNG)
    s = slide(p, 5, "A linked picture"); s.shapes.add_picture(io.BytesIO(img(50, 50, (1, 2, 3))), Inches(1), Inches(1.8), Inches(3), Inches(3))           # 8 (linked)
    s = slide(p, 5, "A shape filled with a photo")                                                                          # 9
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1), Inches(2), Inches(6), Inches(3)); sh.text_frame.text = "Our new pump"
    s = slide(p, 8, "Photo to come"); s.placeholders[2].text = "Add the photo of the panel here"                                  # 10 an empty picture box
    s = slide(p, 5, "A BMP screenshot"); s.shapes.add_picture(io.BytesIO(img(40, 30, (10, 200, 200), "BMP")), Inches(1), Inches(1.8), Inches(6), Inches(4.5))  # 11
    s = slide(p, 5, "Turned in PowerPoint")                                                                                 # 12
    pic = s.shapes.add_picture(io.BytesIO(img(300, 200, (120, 60, 0))), Inches(2.5), Inches(2), Inches(4.5), Inches(3)); pic.rotation = 90
    s = slide(p, 5, "Cropped in PowerPoint")                                                                                # 13
    pic = s.shapes.add_picture(io.BytesIO(img(400, 200, (0, 60, 120))), Inches(1), Inches(2), Inches(6), Inches(3)); pic.crop_left = 0.25; pic.crop_right = 0.25
    data = save(p)
    z = zipfile.ZipFile(io.BytesIO(data))
    def target(n, ext):
        m = re.search(r'Target="\.\./media/(image\d+)\.%s"' % ext, z.read("ppt/slides/_rels/slide%d.xml.rels" % n).decode()); return m.group(1)
    tif = target(6, "png"); svgpng = target(7, "png"); linked = target(8, "png"); fill = None
    b = io.BytesIO(); Image.new("RGB", (64, 48), (0, 0, 0)).save(b, "TIFF"); TIFF = b.getvalue()
    SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="40" fill="purple"/></svg>'
    def s6rels(x): return x.replace("../media/%s.png" % tif, "../media/%s.tiff" % tif)
    def s7rels(x): return add_rel(x, "rId99", RT + "image", "../media/icon1.svg")
    def s7(x):
        return x.replace('<a:blip r:embed="rId2"/>', '<a:blip r:embed="rId2"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId99"/></a:ext></a:extLst></a:blip>')
    def s8rels(x): return re.sub(r'Target="\.\./media/%s\.png"' % linked, 'Target="file:///C:/Users/trainer/Pictures/pump.png" TargetMode="External"', x)
    def s8(x): return x.replace('<a:blip r:embed="rId2"/>', '<a:blip r:link="rId2"/>')
    def s9rels(x): return add_rel(x, "rId9", RT + "image", "../media/fill1.jpeg")
    def s9(x):   # the photo as the shape's fill
        return re.sub(r'(<p:spPr>.*?</a:prstGeom>)', r'\1<a:blipFill><a:blip r:embed="rId9"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>', x, count=1, flags=re.S)
    def ct(x):
        for e, c in (("tiff", "image/tiff"), ("svg", "image/svg+xml"), ("jpeg", "image/jpeg")): x = ct_default(x, e, c)
        return x
    out("d06_pictures.pptx", patch(data, edits={"ppt/slides/_rels/slide6.xml.rels": s6rels, "ppt/slides/_rels/slide7.xml.rels": s7rels, "ppt/slides/slide7.xml": s7,
        "ppt/slides/_rels/slide8.xml.rels": s8rels, "ppt/slides/slide8.xml": s8, "ppt/slides/_rels/slide9.xml.rels": s9rels, "ppt/slides/slide9.xml": s9, "[Content_Types].xml": ct},
        add={"ppt/media/%s.tiff" % tif: TIFF, "ppt/media/icon1.svg": SVG, "ppt/media/fill1.jpeg": img(120, 60, (200, 120, 0), "JPEG")},
        drop=["ppt/media/%s.png" % tif, "ppt/media/%s.png" % linked]))

# --- d07: reading order, groups ---------------------------------------------------------------------------------------
def d07():
    p = new_prs(wide=True)
    s = slide(p, 5, "Before and after")     # 1: two columns whose tops differ by a fiftieth of an inch
    tbox(s, 0.8, 2.04, 5.5, 2.5, ["Before: the old valve", "It leaked at the stem"])
    tbox(s, 7.0, 2.02, 5.5, 2.5, ["After: the new valve", "No leak at 6 bar"])
    s = slide(p, 5, "Written bottom first")   # 2: the boxes are in the file bottom first
    tbox(s, 1, 5.0, 8, 0.6, ["Third: sign the permit"]); tbox(s, 1, 3.5, 8, 0.6, ["Second: isolate"]); tbox(s, 1, 2.0, 8, 0.6, ["First: read the job card"])
    s = slide(p, 5, "A group")                # 3: a group scaled and moved; a box outside it between its two
    g = s.shapes.add_group_shape()
    tbox_g = g.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(0.6)); tbox_g.text_frame.text = "Inside, top"
    tbox_g = g.shapes.add_textbox(Inches(1), Inches(5), Inches(4), Inches(0.6)); tbox_g.text_frame.text = "Inside, bottom"
    tbox(s, 7, 3.6, 5, 0.6, ["Outside, middle"])
    s = slide(p, 5, "Three steps")            # 4: three boxes along a line
    for i, (x, t) in enumerate([(9.0, "3. Test"), (0.8, "1. Isolate"), (4.9, "2. Lock")]): tbox(s, x, 3, 3.5, 1, [t])
    s = slide(p, 10, "Vertical title"); para_set(s.placeholders[1].text_frame, ["Text beside it"])   # 5
    s = slide(p, 5, "A flow chart")           # 6: shapes with words, joined by lines
    a = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1), Inches(3), Inches(2.5), Inches(1)); a.text_frame.text = "Fault found"
    b = s.shapes.add_shape(MSO_SHAPE.DIAMOND, Inches(5), Inches(3), Inches(2.5), Inches(1)); b.text_frame.text = "Safe to fix?"
    c = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(9), Inches(3), Inches(2.5), Inches(1)); c.text_frame.text = "Fix it"
    s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(3.5), Inches(3.5), Inches(5), Inches(3.5))
    s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(7.5), Inches(3.5), Inches(9), Inches(3.5))
    s = slide(p, 5, "Notes under a picture")  # 7: a caption box under a picture, a box beside it
    s.shapes.add_picture(io.BytesIO(PNG), Inches(1), Inches(1.8), Inches(5), Inches(3.75))
    tbox(s, 1, 5.7, 5, 0.6, ["Figure 1: the wet well"]); tbox(s, 7, 1.8, 5, 2, ["Floats hang at three heights"])
    s = slide(p, 5, "Three steps, not quite level")   # 8
    for x, y, t in [(0.8, 2.3, "1. Isolate"), (4.9, 2.0, "2. Lock"), (9.0, 2.15, "3. Test")]: tbox(s, x, y, 3.5, 1, [t])
    s = slide(p, 6)                           # 9: a photo and its caption grouped together, on a slide with a title in a text box
    tbox(s, 0.8, 0.4, 10, 0.8, ["The wet well"])
    g = s.shapes.add_group_shape()
    g.shapes.add_picture(io.BytesIO(PNG), Inches(1), Inches(1.6), Inches(6), Inches(4.5)); tb = g.shapes.add_textbox(Inches(1), Inches(6.2), Inches(6), Inches(0.5)); tb.text_frame.text = "Float switches on the left wall"
    data = save(p)
    # slide 3's group: moved and halved (its children are drawn at half size, from (1 in, 1 in) to (5 in, 5.6 in) -> (1 in, 2 in) to (3 in, 4.3 in))
    def grp(x):
        return re.sub(r"<p:grpSpPr>.*?</p:grpSpPr>|<p:grpSpPr/>", lambda m: m.group(0), x, count=1)
    def s3(x):
        parts_ = x.split("<p:grpSp>")
        g = parts_[1]
        g = re.sub(r"<p:grpSpPr>.*?</p:grpSpPr>|<p:grpSpPr/>", '<p:grpSpPr><a:xfrm><a:off x="914400" y="1828800"/><a:ext cx="1828800" cy="2103120"/><a:chOff x="914400" y="914400"/><a:chExt cx="3657600" cy="4206240"/></a:xfrm></p:grpSpPr>', g, count=1)
        return parts_[0] + "<p:grpSp>" + g
    out("d07_order.pptx", patch(data, edits={"ppt/slides/slide3.xml": s3}))

# --- d08: the characters people type ----------------------------------------------------------------------------------
def d08():
    p = new_prs()
    s = slide(p, 1, "Tabs and fixed spaces"); para_set(s.placeholders[1].text_frame, ["Pump 1\t120 h", "Pump 2\t118 h", "10\u00a0bar"])
    s = slide(p, 1, "Checks \u2705"); para_set(s.placeholders[1].text_frame, ["\u2705 Guard on", "\u26a0\ufe0f Belt worn", "\U0001f525 Hot surface"])
    s = slide(p, 1, "\u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0623\u0648\u0644\u0627\u064b")
    para_set(s.placeholders[1].text_frame, [("\u0627\u0631\u062a\u062f\u0650 \u0627\u0644\u062e\u0648\u0630\u0629", 0, {"rtl": True, "algn": "r"}), ("\u0627\u0641\u062d\u0635 \u0627\u0644\u0633\u0644\u0645", 0, {"rtl": True, "algn": "r"})])
    s = slide(p, 1, "\u5b89\u5168\u7b2c\u4e00"); para_set(s.placeholders[1].text_frame, ["\u30d8\u30eb\u30e1\u30c3\u30c8\u3092\u7740\u7528", "\u5b89\u5168\u5e2f\u3092\u7740\u7528"])
    s = slide(p, 1, "A line break in a point"); para_set(s.placeholders[1].text_frame, [(["First line", {"br": 1}, "second line"], 0), ("Next point", 0)])
    s = slide(p, 1, None); tf = s.shapes.title.text_frame; para_set(tf, [(["Lockout", {"br": 1}, "Tagout"], 0)])
    para_set(s.placeholders[1].text_frame, ["Two words in the title"])
    s = slide(p, 1, "Raised, lowered, struck")
    para_set(s.placeholders[1].text_frame, [(["Area in m", {"t": "2", "base": 30000}], 0), (["H", {"t": "2", "base": -25000}, "O"], 0),
                                            ([{"t": "Old limit", "strike": 1}, " New limit"], 0), ([{"t": "Must", "u": 1}, " wear gloves"], 0)])
    s = slide(p, 1, "Links")
    para_set(s.placeholders[1].text_frame, [(["See ", {"t": "the HSE page", "link": "https://www.hse.gov.uk/work-equipment-machinery/"}], 0),
                                            (["Mail ", {"t": "the trainer", "link": "mailto:trainer@example.org"}], 0), (["Go to ", {"t": "the quiz", "link": "https://example.org/quiz"}], 0)])
    s = slide(p, 5, "Page numbers"); b = tbox(s, 1, 2, 6, 1, ["Page "])
    s = slide(p, 1, "Signs: <stop> & \u201cgo\u201d"); para_set(s.placeholders[1].text_frame, ["5 < 6 & 7 > 3", "\u201cQuoted\u201d and \u2018single\u2019"])
    s = slide(p, 1, "Capitals by style"); para_set(s.placeholders[1].text_frame, [([{"t": "Warning", "cap": "all"}, " read this"], 0)])
    data = save(p)
    def s8(x):   # the third link jumps to another slide (internal), as PowerPoint writes it
        return x
    def s8rels(x):
        return re.sub(r'<Relationship Id="(rId\d+)" Type="[^"]*hyperlink" Target="https://example.org/quiz" TargetMode="External"/>',
                      r'<Relationship Id="\1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide10.xml"/>', x)
    def s8b(x):
        m = re.search(r'<a:hlinkClick r:id="(rId\d+)"/></a:rPr><a:t>the quiz', x)
        return x.replace(m.group(0), '<a:hlinkClick r:id="%s" action="ppaction://hlinksldjump"/></a:rPr><a:t>the quiz' % m.group(1)) if m else x
    def s9(x):   # a slide-number field after "Page "
        return x.replace("<a:t>Page </a:t></a:r>", '<a:t>Page </a:t></a:r><a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum"><a:rPr lang="en-US"/><a:t>9</a:t></a:fld>')
    out("d08_text.pptx", patch(data, edits={"ppt/slides/slide8.xml": s8b, "ppt/slides/_rels/slide8.xml.rels": s8rels, "ppt/slides/slide9.xml": s9}))

# --- d09: speaker notes -----------------------------------------------------------------------------------------------
def d09():
    p = new_prs()
    s = slide(p, 1, "Blank line in the notes"); s.placeholders[1].text = "Point"; s.notes_slide.notes_text_frame.text = "Say this first.\n\nThen pause and say this."
    s = slide(p, 1, "Bullets in the notes"); s.placeholders[1].text = "Point"
    tf = s.notes_slide.notes_text_frame; para_set(tf, [("Ask the crew:", 0), ("who checked the guard?", 0, {"char": "\u2022"}), ("who signed the card?", 0, {"char": "\u2022"})])
    s = slide(p, 1, "A line break in the notes"); s.placeholders[1].text = "Point"
    para_set(s.notes_slide.notes_text_frame, [(["Hold up the tag", {"br": 1}, "then the lock"], 0)])
    s = slide(p, 1, "Empty notes"); s.placeholders[1].text = "Point"; s.notes_slide.notes_text_frame.text = ""
    s = slide(p, 1, "Notes as LibreOffice writes them"); s.placeholders[1].text = "Point"; s.notes_slide.notes_text_frame.text = "Notes in a box with no number."
    s = slide(p, 1, "Long notes"); s.placeholders[1].text = "Point"
    s.notes_slide.notes_text_frame.text = "\n".join("Paragraph %d of the talk, with enough words to wrap over a line or two in the notes pane." % i for i in range(1, 13))
    data = save(p)
    z = zipfile.ZipFile(io.BytesIO(data))
    nn = [n for n in z.namelist() if re.match(r"ppt/notesSlides/notesSlide\d+\.xml$", n)]
    which = None
    for n in nn:
        if "Notes in a box with no number." in z.read(n).decode(): which = n
    def lo(x): return x.replace('<p:ph type="body" idx="1"/>', '<p:ph type="body"/>')
    out("d09_notes.pptx", patch(data, edits={which: lo}))

# --- d10: what PowerPoint 365 writes: slide order unlike the files' names, absolute targets, sections, a hidden slide,
#          mc:AlternateContent (a transition, an equation), p14 extensions, comments ------------------------------------
def d10():
    p = new_prs()
    for i, t in enumerate(["One", "Two", "Three", "Four", "Five"]):
        s = slide(p, 1, "Slide " + t); s.placeholders[1].text = "Point on slide " + t.lower()
    data = save(p)
    MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"'
    def pres(x):
        x = x.replace("<p:presentation ", "<p:presentation " + MC + " ", 1)
        # the order: Three, One, Two, Five, Four (files slide1..5 are One..Five)
        ids = re.findall(r'<p:sldId id="(\d+)" r:id="(rId\d+)"/>', x)
        order = [2, 0, 1, 4, 3]
        new = "".join('<p:sldId id="%s" r:id="%s"/>' % ids[k] for k in order)
        x = re.sub(r"<p:sldIdLst>.*?</p:sldIdLst>", "<p:sldIdLst>" + new + "</p:sldIdLst>", x, flags=re.S)
        sec = ('<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst><p14:section name="Start" id="{1B4C3D21-0000-4000-8000-000000000001}"><p14:sldIdLst>'
               '<p14:sldId id="%s"/><p14:sldId id="%s"/></p14:sldIdLst></p14:section><p14:section name="End" id="{1B4C3D21-0000-4000-8000-000000000002}"><p14:sldIdLst>'
               '<p14:sldId id="%s"/><p14:sldId id="%s"/><p14:sldId id="%s"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst>') % tuple(ids[k][0] for k in order)
        return x.replace("</p:presentation>", sec + "</p:presentation>")
    def prels(x): return x.replace('Target="slides/', 'Target="/ppt/slides/')
    trans = ('<mc:AlternateContent><mc:Choice Requires="p14"><p:transition spd="slow" p14:dur="2000"><p14:prism/></p:transition></mc:Choice>'
             '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
    def s1(x):   # slide One: hidden, a transition, a p14 creation id
        x = x.replace("<p:sld ", '<p:sld ' + MC + ' show="0" ', 1)
        return x.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + trans).replace("</p:sld>", '<p:extLst><p:ext uri="{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}"><p14:creationId val="2843094112"/></p:ext></p:extLst></p:sld>')
    def s2(x):   # slide Two: an equation in a text box (a14:m), with the picture PowerPoint keeps for programs that cannot read it
        x = x.replace("<p:sld ", "<p:sld " + MC + ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ', 1)
        eq = ('<mc:AlternateContent><mc:Choice Requires="a14"><p:sp><p:nvSpPr><p:cNvPr id="9" name="TextBox 8"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
              '<p:spPr><a:xfrm><a:off x="914400" y="4114800"/><a:ext cx="6400800" cy="584775"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
              '<p:txBody><a:bodyPr wrap="square"><a:spAutoFit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"/><a:t>Flow: </a:t></a:r>'
              '<a14:m><m:oMath><m:r><m:t>Q=A\u00b7v</m:t></m:r></m:oMath></a14:m><a:r><a:rPr lang="en-GB"/><a:t> (area times speed)</a:t></a:r></a:p></p:txBody></p:sp></mc:Choice>'
              '<mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="9" name="TextBox 8"/><p:cNvSpPr txBox="1"><a:spLocks noRot="1" noChangeAspect="1" noMove="1" noResize="1" noEditPoints="1" noAdjustHandles="1" noChangeArrowheads="1" noChangeShapeType="1" noTextEdit="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>'
              '<p:spPr><a:xfrm><a:off x="914400" y="4114800"/><a:ext cx="6400800" cy="584775"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:blipFill><a:blip r:embed="rId7"/><a:stretch><a:fillRect l="-857" t="-8333" b="-20833"/></a:stretch></a:blipFill></p:spPr>'
              '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"><a:noFill/></a:rPr><a:t> </a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent>')
        return x.replace("</p:spTree>", eq + "</p:spTree>")
    def s2rels(x): return add_rel(x, "rId7", RT + "image", "/ppt/media/eq1.png")
    def s3rels(x): return add_rel(x, "rId8", "http://schemas.microsoft.com/office/2018/10/relationships/comments", "../comments/modernComment_102_1.xml")
    def s4rels(x): return add_rel(x, "rId9", RT + "comments", "../comments/comment1.xml")
    def ct(x):
        x = ct_override(x, "/ppt/comments/modernComment_102_1.xml", "application/vnd.ms-powerpoint.comments+xml")
        x = ct_override(x, "/ppt/comments/comment1.xml", "application/vnd.openxmlformats-officedocument.presentationml.comments+xml")
        return ct_default(x, "png", "image/png")
    mc = ('<p188:cmLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p188="http://schemas.microsoft.com/office/powerpoint/2018/8/main">'
          '<p188:cm id="{6C4A9B5E-0000-4000-8000-000000000001}" authorId="{6C4A9B5E-0000-4000-8000-0000000000AA}" created="2026-11-01T10:00:00.000"><p188:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"/><a:t>Check this figure</a:t></a:r></a:p></p188:txBody></p188:cm></p188:cmLst>')
    lc = ('<p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cm authorId="0" dt="2026-11-01T10:00:00.000" idx="1"><p:pos x="10" y="10"/><p:text>Old style comment</p:text></p:cm></p:cmLst>')
    out("d10_powerpoint.pptx", patch(data, edits={"ppt/presentation.xml": pres, "ppt/_rels/presentation.xml.rels": prels, "ppt/slides/slide1.xml": s1, "ppt/slides/slide2.xml": s2,
        "ppt/slides/_rels/slide2.xml.rels": s2rels, "ppt/slides/_rels/slide3.xml.rels": s3rels, "ppt/slides/_rels/slide4.xml.rels": s4rels, "[Content_Types].xml": ct},
        add={"ppt/media/eq1.png": img(200, 40, (255, 255, 255)), "ppt/comments/modernComment_102_1.xml": mc, "ppt/comments/comment1.xml": lc}))

# --- d15: a 4:3 deck with a title in a text box low on the slide, and text boxes only ------------------------------------
def d15():
    p = new_prs()
    s = slide(p, 6); tbox(s, 0.5, 0.3, 9, 0.8, ["Hand washing"]); tbox(s, 0.5, 1.5, 9, 3, ["Wet, soap, rub for 20 seconds", "Rinse and dry"])
    s = slide(p, 6); tbox(s, 0.5, 3.0, 9, 0.8, ["Low on the slide"]); tbox(s, 0.5, 4.2, 9, 1, ["A second box under it"])
    s = slide(p, 6); tbox(s, 0.5, 0.3, 9, 1.5, ["Two lines at the top", "of a slide with no title"]); tbox(s, 0.5, 3, 9, 1, ["Body text"])
    s = slide(p, 6); tbox(s, 0.5, 3.0, 9, 0.8, ["The only line"])
    s = slide(p, 5, ""); para = tbox(s, 0.5, 2, 9, 1, ["A title box left empty"])
    out("d15_4x3.pptx", save(p))

# --- d16: a long course, sixty slides --------------------------------------------------------------------------------
def d16():
    p = new_prs()
    for i in range(1, 61):
        s = slide(p, 1, "Module %d" % i)
        para_set(s.placeholders[1].text_frame, ["Point %d.%d" % (i, k) for k in range(1, 5)])
        if i % 10 == 0: s.notes_slide.notes_text_frame.text = "Break after module %d." % i
    out("d16_sixty.pptx", save(p))

# --- d17: empty things --------------------------------------------------------------------------------------------------
def d17():
    p = new_prs()
    slide(p, 6)                                   # 1: nothing at all
    slide(p, 1, None)                             # 2: a title and content slide never typed in
    s = slide(p, 1, "Only a title")               # 3
    s = slide(p, 1, None); para_set(s.placeholders[1].text_frame, ["Points with no title"])   # 4
    s = slide(p, 1, "   ")                        # 5: a title of spaces
    para_set(s.placeholders[1].text_frame, ["A point"])
    s = slide(p, 1, "Empty points between"); para_set(s.placeholders[1].text_frame, ["One", "", "Two", " "])   # 6
    out("d17_empty.pptx", save(p))

# --- d19: things a Lantern slide cannot hold ---------------------------------------------------------------------------
def d19():
    p = new_prs()
    for t in ["The process", "A Visio drawing", "A video", "A sound", "Ink", "An Excel table"]:
        s = slide(p, 5, t)
    data = save(p)
    OLEPIC = lambda rid, emb, prog, name: (
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Object 3"/><p:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
        '<p:xfrm><a:off x="1219200" y="1752600"/><a:ext cx="6705600" cy="4191000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/presentationml/2006/ole">'
        '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:v="urn:schemas-microsoft-com:vml" Requires="v">'
        '<p:oleObj spid="_x0000_s1026" name="%s" r:id="%s" imgW="6705600" imgH="4191000" progId="%s"><p:embed/></p:oleObj></mc:Choice><mc:Fallback>'
        '<p:oleObj name="%s" r:id="%s" imgW="6705600" imgH="4191000" progId="%s"><p:embed/><p:pic><p:nvPicPr><p:cNvPr id="0" name=""/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
        '<p:blipFill><a:blip r:embed="%s"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1219200" y="1752600"/><a:ext cx="6705600" cy="4191000"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:oleObj></mc:Fallback></mc:AlternateContent></a:graphicData></a:graphic></p:graphicFrame>') % (name, emb, prog, name, emb, prog, rid)
    SMART = ('<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Diagram 3"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></p:xfrm>'
             '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId3" r:lo="rId4" r:qs="rId5" r:cs="rId6"/></a:graphicData></a:graphic></p:graphicFrame>')
    DATA = ('<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst>'
            '<dgm:pt modelId="{00000000-0000-4000-8000-000000000000}" type="doc"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-GB"/></a:p></dgm:t></dgm:pt>'
            + "".join('<dgm:pt modelId="{00000000-0000-4000-8000-00000000000%d}"><dgm:prSet/><dgm:spPr/><dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"/><a:t>%s</a:t></a:r></a:p></dgm:t></dgm:pt>' % (i + 1, t)
                      for i, t in enumerate(["Plan", "Isolate", "Work", "Restore"])) + '</dgm:ptLst><dgm:cxnLst/><dgm:bg/><dgm:whole/></dgm:dataModel>')
    DRAW = ('<dsp:drawing xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dsp:spTree><dsp:nvGrpSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvGrpSpPr/></dsp:nvGrpSpPr><dsp:grpSpPr/>'
            + "".join('<dsp:sp modelId="{1}"><dsp:nvSpPr><dsp:cNvPr id="0" name=""/><dsp:cNvSpPr/></dsp:nvSpPr><dsp:spPr><a:xfrm><a:off x="%d" y="0"/><a:ext cx="1800000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></dsp:spPr><dsp:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-GB"/><a:t>%s</a:t></a:r></a:p></dsp:txBody></dsp:sp>' % (i * 2000000, t)
                      for i, t in enumerate(["Plan", "Isolate", "Work", "Restore"])) + '</dsp:spTree></dsp:drawing>')
    VIDEO = ('<p:pic><p:nvPicPr><p:cNvPr id="4" name="clip"><a:hlinkClick r:id="" action="ppaction://media"/></p:cNvPr><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>'
             '<p:nvPr><a:videoFile r:link="rId3"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" r:embed="rId4"/></p:ext></p:extLst></p:nvPr></p:nvPicPr>'
             '<p:blipFill><a:blip r:embed="rId5"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="1219200" y="1752600"/><a:ext cx="6705600" cy="3771900"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')
    AUDIO = VIDEO.replace("a:videoFile", "a:audioFile").replace('name="clip"', 'name="sound"')
    INK = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" Requires="p14">'
           '<p:contentPart p14:bwMode="auto" r:id="rId3"><p14:nvContentPartPr><p14:cNvPr id="4" name="Ink 3"/><p14:cNvContentPartPr/><p14:nvPr/></p14:nvContentPartPr>'
           '<p14:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="3000000" cy="1000000"/></p14:xfrm></p:contentPart></mc:Choice>'
           '<mc:Fallback><p:pic><p:nvPicPr><p:cNvPr id="4" name="Ink 3"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId4"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
           '<p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="3000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></mc:Fallback></mc:AlternateContent>')
    EMF = bytes([1, 0, 0, 0, 108, 0, 0, 0]) + b"\0" * 32 + b" EMF" + b"\0" * 64
    def tree(add):
        return lambda x: x.replace("</p:spTree>", add + "</p:spTree>")
    E = {}
    E["ppt/slides/slide1.xml"] = tree(SMART)
    E["ppt/slides/_rels/slide1.xml.rels"] = lambda x: add_rel(add_rel(add_rel(add_rel(add_rel(x, "rId3", RT + "diagramData", "../diagrams/data1.xml"), "rId4", RT + "diagramLayout", "../diagrams/layout1.xml"),
        "rId5", RT + "diagramQuickStyle", "../diagrams/quickStyle1.xml"), "rId6", RT + "diagramColors", "../diagrams/colors1.xml"), "rId7", "http://schemas.microsoft.com/office/2007/relationships/diagramDrawing", "../diagrams/drawing1.xml")
    E["ppt/slides/slide2.xml"] = tree(OLEPIC("rId4", "rId3", "Visio.Drawing.15", "Visio"))
    E["ppt/slides/_rels/slide2.xml.rels"] = lambda x: add_rel(add_rel(x, "rId3", RT + "package", "../embeddings/Microsoft_Visio_Drawing1.vsdx"), "rId4", RT + "image", "../media/image20.emf")
    E["ppt/slides/slide3.xml"] = tree(VIDEO)
    E["ppt/slides/_rels/slide3.xml.rels"] = lambda x: add_rel(add_rel(add_rel(x, "rId3", RT + "video", "../media/media1.mp4"), "rId4", "http://schemas.microsoft.com/office/2007/relationships/media", "../media/media1.mp4"), "rId5", RT + "image", "../media/poster1.png")
    E["ppt/slides/slide4.xml"] = tree(AUDIO)
    E["ppt/slides/_rels/slide4.xml.rels"] = lambda x: add_rel(add_rel(add_rel(x, "rId3", RT + "audio", "../media/media2.m4a"), "rId4", "http://schemas.microsoft.com/office/2007/relationships/media", "../media/media2.m4a"), "rId5", RT + "image", "../media/poster2.png")
    E["ppt/slides/slide5.xml"] = tree(INK)
    E["ppt/slides/_rels/slide5.xml.rels"] = lambda x: add_rel(add_rel(x, "rId3", RT + "customXml", "../ink/ink1.xml"), "rId4", RT + "image", "../media/ink1.png")
    E["ppt/slides/slide6.xml"] = tree(OLEPIC("rId4", "rId3", "Excel.Sheet.12", "Worksheet"))
    E["ppt/slides/_rels/slide6.xml.rels"] = lambda x: add_rel(add_rel(x, "rId3", RT + "package", "../embeddings/Microsoft_Excel_Worksheet1.xlsx"), "rId4", RT + "image", "../media/image21.emf")
    def ct(x):
        for e, c in (("emf", "image/x-emf"), ("mp4", "video/mp4"), ("m4a", "audio/mp4"), ("png", "image/png"), ("vsdx", "application/vnd.ms-visio.drawing"), ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")): x = ct_default(x, e, c)
        for n, c in (("/ppt/diagrams/data1.xml", "application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml"), ("/ppt/diagrams/drawing1.xml", "application/vnd.ms-office.drawingml.diagramDrawing+xml"), ("/ppt/ink/ink1.xml", "application/inkml+xml")): x = ct_override(x, n, c)
        return x
    E["[Content_Types].xml"] = ct
    INKML = '<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML"><inkml:trace>10 0, 9 14, 8 28</inkml:trace></inkml:ink>'
    out("d19_objects.pptx", patch(data, edits=E, add={"ppt/diagrams/data1.xml": DATA, "ppt/diagrams/drawing1.xml": DRAW, "ppt/media/image20.emf": EMF, "ppt/media/image21.emf": EMF,
        "ppt/embeddings/Microsoft_Visio_Drawing1.vsdx": b"PK\x05\x06" + b"\0" * 18, "ppt/embeddings/Microsoft_Excel_Worksheet1.xlsx": b"PK\x05\x06" + b"\0" * 18,
        "ppt/media/media1.mp4": b"\0\0\0\x18ftypmp42", "ppt/media/media2.m4a": b"\0\0\0\x18ftypM4A ", "ppt/media/poster1.png": img(160, 90, (0, 0, 0)), "ppt/media/poster2.png": img(32, 32, (9, 9, 9)),
        "ppt/ink/ink1.xml": INKML, "ppt/media/ink1.png": img(120, 40, (255, 255, 255))}))

if __name__ == "__main__":
    import gen_other
    d01(); d02(); d03(); d04(); d05(); d06(); d07(); d08(); d09(); d10(); d15(); d16(); d17(); d19()
    gen_other.main(out, OUT)
