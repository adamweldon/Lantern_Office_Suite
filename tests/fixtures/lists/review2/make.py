# make.py -- remakes every hand-written file of the second lists review (1.24.27) in this folder.
# Word and Google Docs are not on the review machine: their files are written here in the form those programs
# write (how sure the reviewer is of each form is said beside it, and in the case's "made"). The LibreOffice files
# are made by LibreOffice itself (soffice --headless) from the HTML written here, when soffice is on the machine.
# Usage: python3 tests/fixtures/lists/review2/make.py
import os, shutil, subprocess, tempfile, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')
RELS = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
DOCRELS = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
           '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
           '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')
STYLES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="%s"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>'
          '<w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
          '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
          '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>'
          '</w:styles>') % W

def lvl(i, fmt, text, jc="left", left=None, hanging=360, font=None, start=1):
    left = left if left is not None else 720 * (i + 1)
    rpr = '<w:rPr><w:rFonts w:ascii="%s" w:hAnsi="%s" w:hint="default"/></w:rPr>' % (font, font) if font else ""
    return ('<w:lvl w:ilvl="%d" w:tplc="04090019"><w:start w:val="%d"/><w:numFmt w:val="%s"/><w:lvlText w:val="%s"/><w:lvlJc w:val="%s"/>'
            '<w:pPr><w:ind w:left="%d" w:hanging="%d"/></w:pPr>%s</w:lvl>') % (i, start, fmt, text, jc, left, hanging, rpr)
# Word's Numbering button (Home > Numbering, the default "1." format, then Tab): 1. a. i. 1. a. i. 1. a. i., the roman
# levels right-aligned (sure: this is the hybridMultilevel list Word 2016-365 writes for the button)
def word_numbering(aid):
    f = ["decimal", "lowerLetter", "lowerRoman"]
    return '<w:abstractNum w:abstractNumId="%d" w15:restartNumberingAfterBreak="0" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w:nsid w:val="1A2B3C4%d"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="0409000F"/>' % (aid, aid) + \
        "".join(lvl(i, f[i % 3], "%%%d." % (i + 1), "right" if i % 3 == 2 else "left", hanging=180 if i % 3 == 2 else 360) for i in range(9)) + "</w:abstractNum>"
# Word's Bullets button: a filled dot (Symbol), o (Courier New), a square (Wingdings), again (sure)
def word_bullets(aid):
    sym = [("", "Symbol"), ("o", "Courier New"), ("", "Wingdings")]
    return '<w:abstractNum w:abstractNumId="%d"><w:nsid w:val="5D6E7F8%d"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="04090001"/>' % (aid, aid) + \
        "".join(lvl(i, "bullet", sym[i % 3][0], font=sym[i % 3][1]) for i in range(9)) + "</w:abstractNum>"
# Google Docs' export (File > Download > Microsoft Word): each list its own abstractNum, every level written, no
# tplc/nsid, w:u none in each level's run (fairly sure of the levels and formats; less of the exact indents)
def gdocs_levels(aid, fmts):
    out = '<w:abstractNum w:abstractNumId="%d">' % aid
    for i in range(9):
        f = fmts[i % len(fmts)]
        out += ('<w:lvl w:ilvl="%d"><w:start w:val="1"/><w:numFmt w:val="%s"/><w:lvlText w:val="%%%d."/><w:lvlJc w:val="%s"/><w:pPr><w:ind w:left="%d" w:hanging="360"/></w:pPr>'
                '<w:rPr><w:u w:val="none"/></w:rPr></w:lvl>') % (i, f, i + 1, "right" if f in ("lowerRoman", "upperRoman") else "left", 720 * (i + 1))
    return out + "</w:abstractNum>"
def numbering(abstracts, nums):
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:numbering xmlns:w="%s">' % W) + "".join(abstracts) + \
        "".join('<w:num w:numId="%d"><w:abstractNumId w:val="%d"/></w:num>' % (n, a) for n, a in nums) + "</w:numbering>"
def p(text, num=None, ilvl=0, style=None, gdocs=False):
    ppr = ""
    if style: ppr += '<w:pStyle w:val="%s"/>' % style
    if num is not None: ppr += '<w:numPr><w:ilvl w:val="%d"/><w:numId w:val="%d"/></w:numPr>' % (ilvl, num)
    if gdocs and num is not None: ppr += '<w:ind w:left="%d" w:hanging="360"/>' % (720 * (ilvl + 1))
    t = text.replace("&", "&amp;").replace("<", "&lt;")
    return '<w:p>%s<w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % ("<w:pPr>" + ppr + "</w:pPr>" if ppr else "", t)
def docx(name, body, numxml):
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="%s" xmlns:r="%s"><w:body>' % (W, R)) + "".join(body) + \
          '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>'
    f = os.path.join(HERE, name)
    with zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CT); z.writestr("_rels/.rels", RELS); z.writestr("word/_rels/document.xml.rels", DOCRELS)
        z.writestr("word/document.xml", doc); z.writestr("word/styles.xml", STYLES); z.writestr("word/numbering.xml", numxml)
    return f
LP = "ListParagraph"
# 1. a Word procedure: numbered steps (the Numbering button), lettered and roman sub-steps by Tab, and a bulleted note
#    list (the Bullets button) under one step at the second level
docx("word_sop_numbers_and_bullets.docx", [
    p("Changing the pump seal", style="Heading1"),
    p("Isolate the pump", 1, 0, LP), p("Open the breaker", 1, 1, LP), p("Fit your own lock", 1, 1, LP), p("Your own tag on the lock", 1, 2, LP),
    p("Drain the casing", 1, 0, LP), p("The oil may be hot", 2, 1, LP), p("Have rags ready", 2, 1, LP),
    p("Replace the seal", 1, 0, LP), p("Test for leaks.")],
    numbering([word_numbering(0), word_bullets(1)], [(1, 0), (2, 1)]))
# 2. Google Docs' "I. A. 1." outline, downloaded as .docx
docx("gdocs_outline_IA1.docx", [
    p("Background", 1, 0, gdocs=True), p("The site", 1, 1, gdocs=True), p("Access road", 1, 2, gdocs=True), p("Water supply", 1, 2, gdocs=True),
    p("Findings", 1, 0, gdocs=True), p("The pump", 1, 1, gdocs=True)],
    numbering([gdocs_levels(0, ["upperRoman", "upperLetter", "decimal"])], [(1, 0)]))
# 3. Word: a second-level list goes on after a note that is not in the list (Word shows b., at the second level)
docx("word_sublist_after_note.docx", [
    p("Drain the oil", 1, 0, LP), p("Open the plug", 1, 1, LP), p("Note: the oil may be hot."), p("Let it drain fully", 1, 1, LP), p("Refill", 1, 0, LP)],
    numbering([word_numbering(0)], [(1, 0)]))
# 4. Word: from the third level straight back to the first
docx("word_level3_back_to_1.docx", [
    p("Isolate", 1, 0, LP), p("Breaker", 1, 1, LP), p("Your own lock", 1, 2, LP), p("Your own tag", 1, 2, LP), p("Test", 1, 0, LP), p("Under test", 1, 1, LP)],
    numbering([word_numbering(0)], [(1, 0)]))

# 5. LibreOffice: its own HTML (what it puts on the clipboard and writes for Save as HTML) and its own .docx, of a
#    nested list made in LibreOffice from the HTML below (LibreOffice is sure; the HTML in is the reviewer's)
SRC = ('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Outline</title></head><body><h1>Pump service</h1>'
       '<ol><li>Isolate the pump<ol type="a"><li>Open the breaker</li><li>Fit a lock<ol type="i"><li>Your own lock</li><li>Your own tag</li></ol></li></ol></li>'
       '<li>Drain the casing<ul><li>Use a tray</li></ul></li><li>Refit the plug</li></ol></body></html>')
so = shutil.which("soffice")
if so:
    t = tempfile.mkdtemp()
    open(os.path.join(t, "lo_outline.html"), "w", encoding="utf-8").write(SRC)
    subprocess.run([so, "--headless", "--convert-to", "odt", "--outdir", t, os.path.join(t, "lo_outline.html")], capture_output=True, timeout=300)
    subprocess.run([so, "--headless", "--convert-to", "html", "--outdir", os.path.join(t, "h"), os.path.join(t, "lo_outline.odt")], capture_output=True, timeout=300)
    subprocess.run([so, "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", t, os.path.join(t, "lo_outline.odt")], capture_output=True, timeout=300)
    if os.path.exists(os.path.join(t, "h", "lo_outline.html")): shutil.copy(os.path.join(t, "h", "lo_outline.html"), os.path.join(HERE, "lo_outline_saved.html"))
    if os.path.exists(os.path.join(t, "lo_outline.docx")): shutil.copy(os.path.join(t, "lo_outline.docx"), os.path.join(HERE, "lo_outline.docx"))
    shutil.rmtree(t, ignore_errors=True)
else:
    print("soffice is not on this machine: the LibreOffice files are kept as they are")
print("made:", ", ".join(sorted(f for f in os.listdir(HERE) if f.endswith((".docx", ".html")))))
