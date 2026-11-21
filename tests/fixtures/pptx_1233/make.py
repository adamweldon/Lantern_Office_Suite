# make.py -- writes the PowerPoint files tests/pptx.js reads (1.24.33), with python-pptx and its own template, then
# edits a few parts by hand for what python-pptx does not write (a hidden slide, a numbered list from 3, an EMF picture).
# Run from the repository: python3 tests/fixtures/pptx_1233/make.py
import io, os, re, zipfile
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
def png(w, h, rgb):
    b = io.BytesIO(); Image.new("RGB", (w, h), rgb).save(b, "PNG"); b.seek(0); return b
p = Presentation()
L = p.slide_layouts
s = p.slides.add_slide(L[0]); s.shapes.title.text = "Pump station basics"; s.placeholders[1].text = "A course for operators"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Before you start"
tf = s.placeholders[1].text_frame; tf.text = "Lock out the panel"
q = tf.add_paragraph(); q.text = "Hang your own tag"; q.level = 1
q = tf.add_paragraph(); r = q.add_run(); r.text = "Test "; r = q.add_run(); r.text = "dead"; r.font.bold = True; q.level = 1
q = tf.add_paragraph(); r = q.add_run(); r.text = "Read the "; r = q.add_run(); r.text = "manual"; r.font.italic = True; r.hyperlink.address = "https://example.org/manual"
s.notes_slide.notes_text_frame.text = "Ask who has locked out before.\nShow a lock."
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Two columns"
b = s.shapes.add_textbox(Inches(5), Inches(2), Inches(4), Inches(1)); b.text_frame.text = "Right box"
b = s.shapes.add_textbox(Inches(0.5), Inches(2), Inches(4), Inches(1)); b.text_frame.text = "Left box"
b = s.shapes.add_textbox(Inches(0.5), Inches(5), Inches(9), Inches(1)); b.text_frame.text = "Under both"
s = p.slides.add_slide(L[6])
b = s.shapes.add_textbox(Inches(0.5), Inches(4), Inches(9), Inches(2)); b.text_frame.text = "A long sentence low on the slide that says what the wet well does and why the floats hang where they do."
b = s.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(1)); b.text_frame.text = "No title box here"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Float heights"
t = s.shapes.add_table(4, 3, Inches(0.5), Inches(1.8), Inches(9), Inches(3)).table
for ri, row in enumerate([["Float", "Height", "Job"], ["FS1", "0.5 m", "off"], ["FS2", "1.0 m", "lead on"], ["FS3 and FS4", "", ""]]):
    for ci, v in enumerate(row): t.cell(ri, ci).text = v
t.cell(3, 0).merge(t.cell(3, 2))
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Two pictures"
s.shapes.add_picture(png(40, 30, (200, 0, 0)), Inches(0.5), Inches(2), Inches(1), Inches(0.75))
s.shapes.add_picture(png(400, 300, (0, 120, 0)), Inches(3), Inches(2), Inches(6), Inches(4.5))
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Run hours"
cd = CategoryChartData(); cd.categories = ["Pump 1", "Pump 2"]; cd.add_series("Hours", (120, 118))
s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(2), Inches(8), Inches(4.5), cd)
s = p.slides.add_slide(L[5]); s.shapes.title.text = "Grouped"
g = s.shapes.add_group_shape()
b = g.shapes.add_textbox(Inches(1), Inches(2), Inches(3), Inches(1)); b.text_frame.text = "Inside the group"
b = g.shapes.add_textbox(Inches(1), Inches(3.5), Inches(3), Inches(1)); b.text_frame.text = "Also inside"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Hidden slide"; s.placeholders[1].text = "Only for the trainer"
s = p.slides.add_slide(L[1]); s.shapes.title.text = "Steps from three"
tf = s.placeholders[1].text_frame; tf.text = "Isolate"; tf.add_paragraph().text = "Prove dead"; tf.add_paragraph().text = "Work"
s = p.slides.add_slide(L[5]); s.shapes.title.text = "A Visio drawing"
s.shapes.add_picture(png(20, 20, (0, 0, 200)), Inches(1), Inches(2), Inches(4), Inches(3))
buf = io.BytesIO(); p.save(buf)
# the hand edits
zi = zipfile.ZipFile(io.BytesIO(buf.getvalue())); out = io.BytesIO(); zo = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
names = zi.namelist()
def slide_xml(n): return "ppt/slides/slide%d.xml" % n
emf_target = None
for n in names:
    d = zi.read(n)
    if n == slide_xml(9): d = d.replace(b"<p:sld ", b'<p:sld show="0" ', 1)
    if n == slide_xml(10):
        d = d.decode("utf-8")
        first = [True]
        def num(m):
            if first[0]: first[0] = False; return '<a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod" startAt="3"/></a:pPr>'
            return '<a:p><a:pPr><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod" startAt="3"/></a:pPr>'
        body = d[d.index('idx="1"'):]
        d = d[:d.index('idx="1"')] + re.sub(r"<a:p>", num, body)
        d = d.encode("utf-8")
    if n == "ppt/slides/_rels/slide11.xml.rels":
        m = re.search(rb'Target="../media/(image\d+)\.png"', d); emf_target = m.group(1).decode()
        d = d.replace(m.group(0), b'Target="../media/' + m.group(1) + b'.emf"')
    if n == "[Content_Types].xml" and b'Extension="emf"' not in d: d = d.replace(b"<Default ", b'<Default Extension="emf" ContentType="image/x-emf"/><Default ', 1)
    zo.writestr(n, d)
# an EMF file's header (record 1, EMR_HEADER, and the " EMF" signature) is enough for the reader: it is not shown either way
zo.writestr("ppt/media/%s.emf" % emf_target, bytes([1, 0, 0, 0, 108, 0, 0, 0]) + b"\0" * 32 + b" EMF" + b"\0" * 64)
zo.close()
open(os.path.join(HERE, "python_pptx.pptx"), "wb").write(out.getvalue())
print("wrote python_pptx.pptx", len(out.getvalue()), "bytes")
# smartart.pptx: a slide with a SmartArt diagram (python-pptx cannot make one: its graphic frame and data part written
# here as PowerPoint writes them, with no drawing of it), three points, one under another
p = Presentation(); s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = "Lockout as a diagram"
buf = io.BytesIO(); p.save(buf)
DGM = "http://schemas.openxmlformats.org/drawingml/2006/diagram"
frame = ('<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Diagram 3"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
         '<p:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></p:xfrm><a:graphic><a:graphicData uri="' + DGM + '">'
         '<dgm:relIds xmlns:dgm="' + DGM + '" r:dm="rId10" r:lo="rId11" r:qs="rId12" r:cs="rId13"/></a:graphicData></a:graphic></p:graphicFrame>')
def pt(i, text=None, ty=None):
    t = '<dgm:t><a:bodyPr/><a:lstStyle/><a:p>' + ('<a:r><a:rPr lang="en-US"/><a:t>%s</a:t></a:r>' % text if text else '<a:endParaRPr lang="en-US"/>') + '</a:p></dgm:t>'
    return '<dgm:pt modelId="{%s}"%s><dgm:prSet/><dgm:spPr/>%s</dgm:pt>' % (i, ' type="%s"' % ty if ty else "", t if ty in (None, "doc") else "")
data = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><dgm:dataModel xmlns:dgm="' + DGM + '" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst>' +
        pt("00000000-0000-0000-0000-000000000000", None, "doc") + pt("11111111-0000-0000-0000-000000000001", "Isolate") + pt("11111111-0000-0000-0000-000000000002", "Lock the breaker") +
        pt("11111111-0000-0000-0000-000000000003", "Prove dead") + pt("22222222-0000-0000-0000-000000000001", None, "parTrans") + '</dgm:ptLst><dgm:cxnLst>' +
        '<dgm:cxn modelId="{33333333-0000-0000-0000-000000000001}" srcId="{00000000-0000-0000-0000-000000000000}" destId="{11111111-0000-0000-0000-000000000001}" srcOrd="0" destOrd="0"/>' +
        '<dgm:cxn modelId="{33333333-0000-0000-0000-000000000002}" srcId="{11111111-0000-0000-0000-000000000001}" destId="{11111111-0000-0000-0000-000000000002}" srcOrd="0" destOrd="0"/>' +
        '<dgm:cxn modelId="{33333333-0000-0000-0000-000000000003}" srcId="{00000000-0000-0000-0000-000000000000}" destId="{11111111-0000-0000-0000-000000000003}" srcOrd="1" destOrd="0"/>' +
        '</dgm:cxnLst><dgm:bg/><dgm:whole/></dgm:dataModel>')
zi = zipfile.ZipFile(io.BytesIO(buf.getvalue())); out = io.BytesIO(); zo = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
for n in zi.namelist():
    d = zi.read(n)
    if n == "ppt/slides/slide1.xml": d = d.replace(b"</p:spTree>", frame.encode() + b"</p:spTree>")
    if n == "ppt/slides/_rels/slide1.xml.rels":
        d = d.replace(b"</Relationships>", b''.join(b'<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagram%s" Target="../diagrams/%s1.xml"/>' % (i, k.encode(), f.encode())
                                                    for i, k, f in [(10, "Data", "data"), (11, "Layout", "layout"), (12, "QuickStyle", "quickStyle"), (13, "Colors", "colors")]) + b"</Relationships>")
    if n == "[Content_Types].xml":
        d = d.replace(b"</Types>", b'<Override PartName="/ppt/diagrams/data1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml"/></Types>')
    zo.writestr(n, d)
zo.writestr("ppt/diagrams/data1.xml", data)
zo.close()
open(os.path.join(HERE, "smartart.pptx"), "wb").write(out.getvalue())
print("wrote smartart.pptx", len(out.getvalue()), "bytes")
# emf.pptx: an EMF picture (menu.emf: LibreOffice's EMF of menu.svg, made with soffice --convert-to emf menu.svg) alone on
# a slide, and beside a PNG on another; python-pptx places a PNG of the same size, then its part is swapped for the EMF
p = Presentation()
s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = "A drawing in EMF"
s.shapes.add_picture(png(378, 238, (0, 0, 0)), Inches(1), Inches(2), Inches(5), Inches(3.15))
s = p.slides.add_slide(p.slide_layouts[5]); s.shapes.title.text = "Two pictures side by side"
s.shapes.add_picture(png(378, 238, (0, 0, 0)), Inches(0.5), Inches(2), Inches(4), Inches(2.52))
s.shapes.add_picture(png(200, 200, (200, 30, 30)), Inches(5.5), Inches(2), Inches(3), Inches(3))
buf = io.BytesIO(); p.save(buf)
zi = zipfile.ZipFile(io.BytesIO(buf.getvalue())); out = io.BytesIO(); zo = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED)
black = None
for n in zi.namelist():
    if n.startswith("ppt/media/") and Image.open(io.BytesIO(zi.read(n))).getpixel((0, 0)) == (0, 0, 0): black = n.split("/")[-1].rsplit(".", 1)[0]
for n in zi.namelist():
    d = zi.read(n)
    if n.startswith("ppt/slides/_rels/"): d = d.replace(("../media/%s.png" % black).encode(), ("../media/%s.emf" % black).encode())
    if n == "[Content_Types].xml" and b'Extension="emf"' not in d: d = d.replace(b"<Default ", b'<Default Extension="emf" ContentType="image/x-emf"/><Default ', 1)
    if n == "ppt/media/%s.png" % black: continue
    zo.writestr(n, d)
zo.writestr("ppt/media/%s.emf" % black, open(os.path.join(HERE, "menu.emf"), "rb").read())
zo.close()
open(os.path.join(HERE, "emf.pptx"), "wb").write(out.getvalue())
print("wrote emf.pptx", len(out.getvalue()), "bytes")
