# gen_other.py -- the decks of review 1 of 1.24.33 that python-pptx does not make: written by hand the way Google Slides
# and Keynote export them, a Strict file, LibreOffice's own saves, damaged files, and files that are not presentations.
# Called by make_decks.py.
import io, os, re, shutil, subprocess, tempfile, zipfile
from pp import *

NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
CT = "application/vnd.openxmlformats-officedocument.presentationml."
GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

def theme(name="Simple Light"):
    clr = "".join('<a:%s><a:srgbClr val="%s"/></a:%s>' % (k, v, k) for k, v in [("dk1", "000000"), ("lt1", "FFFFFF"), ("dk2", "595959"), ("lt2", "EEEEEE"), ("accent1", "4285F4"), ("accent2", "212121"),
        ("accent3", "78909C"), ("accent4", "FFAB40"), ("accent5", "0097A7"), ("accent6", "EEFF41"), ("hlink", "0097A7"), ("folHlink", "0097A7")])
    f = '<a:latin typeface="Arial"/><a:ea typeface="Arial"/><a:cs typeface="Arial"/>'
    s = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    ln = '<a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">' + s + '<a:prstDash val="solid"/><a:round/></a:ln>'
    return (HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="%s"><a:themeElements><a:clrScheme name="%s">%s</a:clrScheme>'
            '<a:fontScheme name="%s"><a:majorFont>%s</a:majorFont><a:minorFont>%s</a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst>%s%s%s</a:fillStyleLst>'
            '<a:lnStyleLst>%s%s%s</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
            '<a:bgFillStyleLst>%s%s%s</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>') % (name, name, clr, name, f, f, s, s, s, ln, ln, ln, s, s, s)

def sp(id, name, ph, xfrm, paras, txbox=False):
    """ph: None or (type, idx, sz); xfrm: None or (x, y, cx, cy); paras: list of xml strings"""
    phx = ""
    if ph:
        t, i, sz = ph
        phx = "<p:ph%s%s%s/>" % (' type="%s"' % t if t else "", ' sz="%s"' % sz if sz else "", ' idx="%s"' % i if i is not None else "")
    xf = '<a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm>' % xfrm if xfrm else ""
    return ('<p:sp><p:nvSpPr><p:cNvPr id="%d" name="%s"/><p:cNvSpPr%s><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>%s</p:nvPr></p:nvSpPr><p:spPr>%s<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
            '<p:txBody><a:bodyPr/><a:lstStyle/>%s</p:txBody></p:sp>') % (id, name, ' txBox="1"' if txbox else "", phx, xf, "".join(paras) or "<a:p><a:endParaRPr/></a:p>")

def build(size, master, layouts, slides, notes_master=None, core_title=None, descriptors=False, theme_xml=None, app="Google Slides"):
    """master: (xml without rels); layouts: [xml]; slides: [dict(xml, layout, notes, media {name: bytes}, rels [(id, type, target, ext)])]"""
    files = []
    ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>',
          '<Default Extension="png" ContentType="image/png"/>', '<Default Extension="jpeg" ContentType="image/jpeg"/>']
    def rels(lst):
        return HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(
            '<Relationship Id="%s" Type="%s" Target="%s"%s/>' % (i, t if ":" in t else RT + t, g, ' TargetMode="External"' if e else "") for i, t, g, e in lst) + "</Relationships>"
    pr = [("rId1", "theme", "theme/theme1.xml", 0), ("rId2", "presProps", "presProps.xml", 0), ("rId3", "viewProps", "viewProps.xml", 0), ("rId4", "slideMaster", "slideMasters/slideMaster1.xml", 0)]
    if notes_master: pr.append(("rId5", "notesMaster", "notesMasters/notesMaster1.xml", 0))
    sid = ""
    for k, s in enumerate(slides):
        pr.append(("rId%d" % (6 + k), "slide", "slides/slide%d.xml" % (k + 1), 0)); sid += '<p:sldId id="%d" r:id="rId%d"/>' % (256 + k, 6 + k)
    files.append(("ppt/presentation.xml", HEAD + '<p:presentation %s strictFirstAndLastChars="0" saveSubsetFonts="1" autoCompressPictures="0"><p:sldMasterIdLst><p:sldMasterId id="2147483659" r:id="rId4"/></p:sldMasterIdLst>%s'
                  '<p:sldIdLst>%s</p:sldIdLst><p:sldSz cx="%d" cy="%d"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr lvl="0"><a:defRPr lang="en"/></a:defPPr></p:defaultTextStyle></p:presentation>'
                  % (NS, '<p:notesMasterIdLst><p:notesMasterId r:id="rId5"/></p:notesMasterIdLst>' if notes_master else "", sid, size[0], size[1])))
    files.append(("ppt/_rels/presentation.xml.rels", rels(pr)))
    files.append(("ppt/theme/theme1.xml", theme_xml or theme()))
    files.append(("ppt/presProps.xml", HEAD + '<p:presentationPr %s/>' % NS))
    files.append(("ppt/viewProps.xml", HEAD + '<p:viewPr %s><p:gridSpacing cx="114300" cy="114300"/></p:viewPr>' % NS))
    lids = "".join('<p:sldLayoutId id="%d" r:id="rId%d"/>' % (2147483648 + k, k + 1) for k in range(len(layouts)))
    files.append(("ppt/slideMasters/slideMaster1.xml", master.replace("<!--LAYOUTS-->", "<p:sldLayoutIdLst>%s</p:sldLayoutIdLst>" % lids)))
    files.append(("ppt/slideMasters/_rels/slideMaster1.xml.rels", rels([("rId%d" % (k + 1), "slideLayout", "../slideLayouts/slideLayout%d.xml" % (k + 1), 0) for k in range(len(layouts))] + [("rId%d" % (len(layouts) + 1), "theme", "../theme/theme1.xml", 0)])))
    ct.append('<Override PartName="/ppt/presentation.xml" ContentType="%spresentation.main+xml"/>' % CT)
    ct.append('<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="%sslideMaster+xml"/>' % CT)
    ct.append('<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>')
    ct.append('<Override PartName="/ppt/presProps.xml" ContentType="%spresProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="%sviewProps+xml"/>' % (CT, CT))
    for k, l in enumerate(layouts):
        files.append(("ppt/slideLayouts/slideLayout%d.xml" % (k + 1), l))
        files.append(("ppt/slideLayouts/_rels/slideLayout%d.xml.rels" % (k + 1), rels([("rId1", "slideMaster", "../slideMasters/slideMaster1.xml", 0)])))
        ct.append('<Override PartName="/ppt/slideLayouts/slideLayout%d.xml" ContentType="%sslideLayout+xml"/>' % (k + 1, CT))
    if notes_master:
        files.append(("ppt/notesMasters/notesMaster1.xml", notes_master))
        files.append(("ppt/notesMasters/_rels/notesMaster1.xml.rels", rels([("rId1", "theme", "../theme/theme2.xml", 0)])))
        files.append(("ppt/theme/theme2.xml", theme("Notes")))
        ct.append('<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="%snotesMaster+xml"/>' % CT)
        ct.append('<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>')
    for k, s in enumerate(slides):
        n = k + 1
        rl = [("rId1", "slideLayout", "../slideLayouts/slideLayout%d.xml" % s["layout"], 0)] + list(s.get("rels", []))
        if s.get("notes"):
            rl.append(("rId%d" % (len(rl) + 20), "notesSlide", "../notesSlides/notesSlide%d.xml" % n, 0))
            files.append(("ppt/notesSlides/notesSlide%d.xml" % n, s["notes"]))
            files.append(("ppt/notesSlides/_rels/notesSlide%d.xml.rels" % n, rels([("rId1", "notesMaster", "../notesMasters/notesMaster1.xml", 0), ("rId2", "slide", "../slides/slide%d.xml" % n, 0)])))
            ct.append('<Override PartName="/ppt/notesSlides/notesSlide%d.xml" ContentType="%snotesSlide+xml"/>' % (n, CT))
        files.append(("ppt/slides/slide%d.xml" % n, s["xml"]))
        files.append(("ppt/slides/_rels/slide%d.xml.rels" % n, rels(rl)))
        ct.append('<Override PartName="/ppt/slides/slide%d.xml" ContentType="%sslide+xml"/>' % (n, CT))
        for m, d in s.get("media", {}).items(): files.append(("ppt/media/" + m, d))
    top = [("rId1", "officeDocument", "ppt/presentation.xml", 0)]
    if core_title is not None:
        top.append(("rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml", 0))
        files.append(("docProps/core.xml", HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>%s</dc:title></cp:coreProperties>' % core_title))
        ct.append('<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>')
    files.append(("_rels/.rels", rels(top)))
    files.insert(0, ("[Content_Types].xml", HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + "".join(ct) + "</Types>"))
    return write_zip([(n, d.encode("utf-8") if isinstance(d, str) else d) for n, d in files], descriptors=descriptors)

# ---- Google Slides: every paragraph says its own bullet (or none); runs split at every change, empty runs at the ends ----
GPP = '<a:pPr marL="%d" lvl="%d" indent="%d" algn="l" rtl="0"><a:spcBef><a:spcPts val="%d"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft>%s</a:pPr>'
def gp(runs, lvl=0, bullet=None):
    if bullet: pp = GPP % (457200 * (lvl + 1), lvl, -342900, 0, '<a:buSzPts val="1800"/><a:buChar char="%s"/>' % bullet)
    else: pp = GPP % (0, 0, 0, 0, "<a:buNone/>")
    rx = ""
    for r in runs:
        if isinstance(r, str): r = {"t": r}
        at = ' lang="en"' + (' b="1"' if r.get("b") else "") + (' i="1"' if r.get("i") else "") + (' u="sng"' if r.get("link") else "")
        inner = ('<a:solidFill><a:schemeClr val="hlink"/></a:solidFill><a:hlinkClick r:id="%s"/>' % r["link"]) if r.get("link") else ""
        rx += ("<a:r><a:rPr%s>%s</a:rPr><a:t>%s</a:t></a:r>" % (at, inner, r["t"])) if inner else ("<a:r><a:rPr%s/><a:t>%s</a:t></a:r>" % (at, r["t"]))
    return "<a:p>" + pp + rx + "<a:endParaRPr/></a:p>"
def g_empty(): return "<a:p>" + GPP % (0, 0, 0, 0, "<a:buNone/>") + '<a:r><a:rPr lang="en"/><a:t></a:t></a:r><a:endParaRPr/></a:p>'

def google():
    W, H = 9144000, 5143500
    bodylvls = "".join('<a:lvl%dpPr marL="%d" marR="0" lvl="%d" indent="-342900" algn="l" rtl="0"><a:lnSpc><a:spcPct val="115000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buClr><a:schemeClr val="dk2"/></a:buClr><a:buSzPts val="1800"/><a:buFont typeface="Arial"/><a:buChar char="%s"/><a:defRPr sz="1800"/></a:lvl%dpPr>'
                       % (k + 1, 457200 * (k + 1), k, "\u25cf\u25cb\u25a0"[k % 3], k + 1) for k in range(9))
    titlelvls = '<a:lvl1pPr lvl="0" algn="l" rtl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:buClr><a:schemeClr val="dk2"/></a:buClr><a:buSzPts val="2800"/><a:buNone/><a:defRPr sz="2800"/></a:lvl1pPr>'
    master = (HEAD + '<p:sldMaster %s><p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="lt1"/></a:solidFill></p:bgPr></p:bg><p:spTree>%s' % (NS, GRP)
              + sp(5, "Google Shape;5;n", ("title", None, None), (311700, 445025, 8520600, 572700), [])
              + sp(6, "Google Shape;6;n", ("body", 1, None), (311700, 1152475, 8520600, 3416400), [])
              + sp(7, "Google Shape;7;n", ("sldNum", 12, None), (8472458, 4663217, 548700, 393600), [])
              + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
              + '<!--LAYOUTS--><p:txStyles><p:titleStyle>%s</p:titleStyle><p:bodyStyle>%s</p:bodyStyle><p:otherStyle><a:defPPr lvl="0"><a:defRPr/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>' % (titlelvls, bodylvls))
    def layout(name, typ, shapes):
        return HEAD + '<p:sldLayout %s type="%s" preserve="1" userDrawn="1"><p:cSld name="%s"><p:spTree>%s%s</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' % (NS, typ, name, GRP, "".join(shapes))
    def lst(none=False, ctr=False):
        if none: return "<a:lstStyle>" + "".join('<a:lvl%dpPr lvl="%d" algn="%s" rtl="0"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:buSzPts val="2100"/><a:buNone/><a:defRPr sz="2100"/></a:lvl%dpPr>' % (k + 1, k, "ctr" if ctr else "l", k + 1) for k in range(9)) + "</a:lstStyle>"
        return "<a:lstStyle>" + bodylvls + "</a:lstStyle>"
    def lsp(id, ph, xf, ls):
        return sp(id, "Google Shape;%d;p2" % id, ph, xf, ['<a:p><a:endParaRPr/></a:p>']).replace("<a:lstStyle/>", ls)
    L1 = layout("TITLE", "title", [lsp(9, ("ctrTitle", None, None), (311700, 744575, 8520600, 2052600), lst(True, True)), lsp(10, ("subTitle", 1, None), (311700, 2834125, 8520600, 792600), lst(True, True))])
    L2 = layout("TITLE_AND_BODY", "tx", [lsp(11, ("title", None, None), (311700, 445025, 8520600, 572700), lst(True)), lsp(12, ("body", 1, None), (311700, 1152475, 8520600, 3416400), lst())])
    L3 = layout("TITLE_AND_TWO_COLUMNS", "twoColTx", [lsp(13, ("title", None, None), (311700, 445025, 8520600, 572700), lst(True)), lsp(14, ("body", 1, None), (311700, 1152475, 3999900, 3416400), lst()),
                                                     lsp(15, ("body", 2, None), (4832400, 1152475, 3999900, 3416400), lst())])
    L4 = layout("SECTION_HEADER", "secHead", [lsp(16, ("title", None, None), (311700, 2150850, 8520600, 841800), lst(True, True))])
    L5 = layout("ONE_COLUMN_TEXT", "tx", [lsp(17, ("title", None, None), (311700, 555600, 2808000, 755700), lst(True)), lsp(18, ("body", 1, None), (311700, 1389600, 2808000, 3179400), lst(True))])
    nm = (HEAD + '<p:notesMaster %s><p:cSld><p:spTree>%s' % (NS, GRP) + sp(2, "Google Shape;2;n", ("sldImg", 2, None), (381300, 685800, 6096075, 3429000), [])
          + sp(3, "Google Shape;3;n", ("body", 1, None), (685800, 4400550, 5486400, 4114800), [])
          + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
          + '<p:notesStyle><a:defPPr marR="0" lvl="0" algn="l" rtl="0"><a:defRPr/></a:defPPr></p:notesStyle></p:notesMaster>')
    def slide_(shapes, n):
        return HEAD + '<p:sld %s><p:cSld><p:spTree>%s%s</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' % (NS, GRP, "".join(shapes))
    def notes(n, paras):
        return (HEAD + '<p:notes %s showMasterSp="0" showMasterPhAnim="0"><p:cSld><p:spTree>%s' % (NS, GRP)
                + '<p:sp><p:nvSpPr><p:cNvPr id="%d" name="Google Shape;%d;p%d:notes"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="381300" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>' % (50 + n, 50 + n, n)
                + '<p:sp><p:nvSpPr><p:cNvPr id="%d" name="Google Shape;%d;p%d:notes"/><p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' % (60 + n, 60 + n, n)
                + '<p:txBody><a:bodyPr spcFirstLastPara="1" wrap="square" lIns="91425" tIns="91425" rIns="91425" bIns="91425" anchor="t" anchorCtr="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>%s</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>' % "".join(paras))
    S = []
    # 1 TITLE: a title and a subtitle, and an empty run at each end
    S.append(dict(layout=1, xml=slide_([sp(55, "Google Shape;55;p13", ("ctrTitle", None, None), (311700, 744575, 8520600, 2052600), [gp(["Welcome to the site"]), ]),
                                         sp(56, "Google Shape;56;p13", ("subTitle", 1, None), (311700, 2834125, 8520600, 792600), [gp(["Induction for new starters"]), g_empty()])], 1),
                  notes=notes(1, [gp(["Introduce yourself."]), gp(["Hand out the badges."])])))
    # 2 TITLE_AND_BODY: bullets at two levels, bold split runs, a link, an empty paragraph at the end
    S.append(dict(layout=2, rels=[("rId3", "hyperlink", "https://example.org/site-map", 1)],
                  xml=slide_([sp(61, "Google Shape;61;p14", ("title", None, None), (311700, 445025, 8520600, 572700), [gp(["Site rules"])]),
                              sp(62, "Google Shape;62;p14", ("body", 1, None), (311700, 1152475, 8520600, 3416400),
                                 [gp([{"t": "Hard hat"}, {"t": " at all times", "b": 0}], 0, "\u25cf"), gp([{"t": "Even in the "}, {"t": "office", "b": 1}, {"t": " corridor"}], 1, "\u25cb"),
                                  gp(["Sign in at the gate"], 0, "\u25cf"), gp(["See the ", {"t": "site map", "link": "rId3"}], 0, "\u25cf"), g_empty()])], 2),
                  notes=notes(2, [gp(["Stress the hard hat rule."])])))
    # 3 TITLE_AND_TWO_COLUMNS
    S.append(dict(layout=3, xml=slide_([sp(66, "Google Shape;66;p15", ("title", None, None), (311700, 445025, 8520600, 572700), [gp(["Allowed and not allowed"])]),
                                         sp(67, "Google Shape;67;p15", ("body", 1, None), (311700, 1152475, 3999900, 3416400), [gp(["Phones in the canteen"], 0, "\u25cf"), gp(["Radios on site"], 0, "\u25cf")]),
                                         sp(68, "Google Shape;68;p15", ("body", 2, None), (4832400, 1152475, 3999900, 3416400), [gp(["Phones on the scaffold"], 0, "\u25cf"), gp(["Smoking"], 0, "\u25cf")])], 3)))
    # 4 SECTION_HEADER
    S.append(dict(layout=4, xml=slide_([sp(71, "Google Shape;71;p16", ("title", None, None), (311700, 2150850, 8520600, 841800), [gp(["Part two: emergencies"])])], 4)))
    # 5 TITLE_AND_BODY with plain paragraphs (bullets off by hand) and a text box Google wrote
    S.append(dict(layout=2, xml=slide_([sp(76, "Google Shape;76;p17", ("title", None, None), (311700, 445025, 8520600, 572700), [gp(["If the alarm sounds"])]),
                                         sp(77, "Google Shape;77;p17", ("body", 1, None), (311700, 1152475, 8520600, 2000000), [gp(["Leave by the nearest exit."]), gp(["Do not stop for belongings."])]),
                                         sp(78, "Google Shape;78;p17", None, (311700, 3400000, 8520600, 600000), [gp(["Assembly point: car park B"])], txbox=True)], 5)))
    # 6 ONE_COLUMN_TEXT: the layout's body has no bullets; the paragraphs here carry no pPr at all
    S.append(dict(layout=5, xml=slide_([sp(81, "Google Shape;81;p18", ("title", None, None), (311700, 555600, 2808000, 755700), ['<a:p><a:r><a:rPr lang="en"/><a:t>First aiders</a:t></a:r></a:p>']),
                                         sp(82, "Google Shape;82;p18", ("body", 1, None), (311700, 1389600, 2808000, 3179400), ['<a:p><a:r><a:rPr lang="en"/><a:t>Sam in the office</a:t></a:r></a:p>', '<a:p><a:r><a:rPr lang="en"/><a:t>Jo in the yard</a:t></a:r></a:p>'])], 6)))
    data = build((W, H), master, [L1, L2, L3, L4, L5], S, notes_master=nm, descriptors=True)
    return data

# ---- Keynote: 1920 by 1080, its own layout names, placeholders placed by the layout only, its bullets in the master ----
def keynote():
    W, H = 24384000, 13716000
    body = "".join('<a:lvl%dpPr marL="%d" indent="-457200" defTabSz="825500"><a:spcBef><a:spcPts val="4500"/></a:spcBef><a:buSzPct val="145000"/><a:buChar char="\u2022"/><a:defRPr sz="4400"/></a:lvl%dpPr>' % (k + 1, 914400 + 457200 * k, k + 1) for k in range(9))
    master = (HEAD + '<p:sldMaster %s><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg><p:spTree>%s' % (NS, GRP)
              + sp(2, "Title Text", ("title", None, None), (1689100, 1625600, 21005800, 2286000), [])
              + sp(3, "Body Level One\u2026", ("body", 1, None), (1689100, 4013200, 21005800, 8128000), [])
              + sp(4, "Slide Number", ("sldNum", 2, "quarter"), (11887200, 12471400, 609600, 584200), [])
              + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
              + '<!--LAYOUTS--><p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:buSzTx/><a:buNone/><a:defRPr sz="9600"/></a:lvl1pPr></p:titleStyle><p:bodyStyle>%s</p:bodyStyle><p:otherStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="3600"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>' % body)
    def layout(name, shapes):
        return HEAD + '<p:sldLayout %s type="tx"><p:cSld name="%s"><p:spTree>%s%s</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' % (NS, name, GRP, "".join(shapes))
    none = '<a:lstStyle><a:lvl1pPr marL="0" indent="0" algn="ctr"><a:spcBef><a:spcPts val="0"/></a:spcBef><a:buSzTx/><a:buNone/><a:defRPr sz="4400"/></a:lvl1pPr></a:lstStyle>'
    L1 = layout("Title &amp; Subtitle", [sp(10, "Title Text", ("ctrTitle", None, None), (1689100, 3429000, 21005800, 4775200), []), sp(11, "Body Level One\u2026", ("body", 13, "quarter"), (1689100, 8318500, 21005800, 1371600), []).replace("<a:lstStyle/>", none)])
    L2 = layout("Title &amp; Bullets", [sp(12, "Title Text", ("title", None, None), None, []), sp(13, "Body Level One\u2026", ("body", 1, None), None, [])])
    L3 = layout("Title, Bullets &amp; Photo", [sp(14, "Title Text", ("title", None, None), (1689100, 1625600, 21005800, 2286000), []),
                                               sp(15, "Body Level One\u2026", ("body", 1, None), (1689100, 4013200, 10363200, 8128000), []),
                                               '<p:sp><p:nvSpPr><p:cNvPr id="16" name="Image"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="pic" sz="half" idx="21"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="12395200" y="4013200"/><a:ext cx="10299700" cy="8128000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>'])
    L4 = layout("Statement", [sp(17, "Body Level One\u2026", ("body", 13, "half"), (1689100, 4775200, 21005800, 4165600), []).replace("<a:lstStyle/>", none)])
    nm = (HEAD + '<p:notesMaster %s><p:cSld><p:spTree>%s' % (NS, GRP) + sp(2, "Shape 1", ("sldImg", None, None), (1143000, 685800, 4572000, 3429000), []) + sp(3, "Shape 2", ("body", 1, "quarter"), (914400, 4343400, 5029200, 4114800), [])
          + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
          + '<p:notesStyle><a:lvl1pPr defTabSz="457200"><a:defRPr sz="1200"/></a:lvl1pPr></p:notesStyle></p:notesMaster>')
    def kp(text, lvl=None): return '<a:p>%s<a:r><a:t>%s</a:t></a:r></a:p>' % ('<a:pPr lvl="%d"/>' % lvl if lvl else "", text)
    def num(): return '<p:sp><p:nvSpPr><p:cNvPr id="99" name="Slide Number"/><p:cNvSpPr txBox="1"><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{86CB4B4D-7CA3-9044-876B-883B54F8677D}" type="slidenum"/></a:p></p:txBody></p:sp>'
    def slide_(shapes): return HEAD + '<p:sld %s><p:cSld><p:spTree>%s%s%s</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' % (NS, GRP, "".join(shapes), num())
    def notes(n, text):
        return (HEAD + '<p:notes %s><p:cSld><p:spTree>%s' % (NS, GRP) + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Shape %d"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>' % n
                + '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Shape %d"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>%s</p:txBody></p:sp>' % (n, "".join(kp(t) for t in text.split("\n")))
                + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')
    S = []
    S.append(dict(layout=1, xml=slide_([sp(119, "Title 1", ("ctrTitle", None, None), None, [kp("Solar panel basics")]), sp(120, "Body Level One\u2026", ("body", 13, "quarter"), None, [kp("For the community workshop")])]),
                  notes=notes(1, "Welcome everyone.")))
    S.append(dict(layout=2, xml=slide_([sp(122, "Title 2", ("title", None, None), None, [kp("What a panel needs")]), sp(123, "Body Level One\u2026", ("body", 1, None), None, [kp("Sunlight"), kp("Facing south in the north"), kp("No shade at noon", 1), kp("A clean surface")])]),
                  notes=notes(2, "Show the panel.\nPoint at the cells.")))
    S.append(dict(layout=3, media={"photo1.jpeg": img(320, 240, (230, 180, 40), "JPEG")}, rels=[("rId2", "image", "../media/photo1.jpeg", 0)],
                  xml=slide_([sp(125, "Title 3", ("title", None, None), None, [kp("The inverter")]), sp(126, "Body Level One\u2026", ("body", 1, None), None, [kp("Turns DC into AC"), kp("Keep it ventilated")]),
                              '<p:pic><p:nvPicPr><p:cNvPr id="127" name="inverter.jpeg"/><p:cNvPicPr><a:picLocks noGrp="1" noChangeAspect="1"/></p:cNvPicPr><p:nvPr><p:ph type="pic" sz="half" idx="21"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"><a:extLst/></a:blip><a:srcRect/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'])))
    S.append(dict(layout=4, xml=slide_([sp(130, "Body Level One\u2026", ("body", 13, "half"), None, [kp("Never open the DC isolator under load")])])))
    return build((W, H), master, [L1, L2, L3, L4], S, notes_master=nm, core_title="Solar panel basics", app="Keynote")

# ---- Strict: d01's parts in the ISO/IEC 29500 Strict names ----------------------------------------------------------
STRICT = [("http://schemas.openxmlformats.org/presentationml/2006/main", "http://purl.oclc.org/ooxml/presentationml/main"),
          ("http://schemas.openxmlformats.org/drawingml/2006/main", "http://purl.oclc.org/ooxml/drawingml/main"),
          ("http://schemas.openxmlformats.org/drawingml/2006/picture", "http://purl.oclc.org/ooxml/drawingml/picture"),
          ("http://schemas.openxmlformats.org/drawingml/2006/table", "http://purl.oclc.org/ooxml/drawingml/table"),
          ("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "http://purl.oclc.org/ooxml/officeDocument/relationships"),
          ("http://schemas.openxmlformats.org/officeDocument/2006/extended-properties", "http://purl.oclc.org/ooxml/officeDocument/extendedProperties")]
def strict(data):
    items = []
    for info, d in parts(data):
        n = info.filename
        if n.endswith(".xml") or n.endswith(".rels"):
            s = d.decode("utf-8")
            for a, b in STRICT: s = s.replace(a, b)
            if n == "ppt/presentation.xml": s = s.replace("<p:presentation ", '<p:presentation conformance="strict" ', 1)
            d = s.encode("utf-8")
        items.append((n, d))
    return write_zip(items)

def soffice():
    return shutil.which("soffice") or shutil.which("libreoffice")

def lo_convert(src_bytes, name, to):
    so = soffice()
    if not so: return None
    t = tempfile.mkdtemp(); f = os.path.join(t, name); open(f, "wb").write(src_bytes)
    subprocess.run([so, "--headless", "--convert-to", to, "--outdir", os.path.join(t, "o"), f], capture_output=True, timeout=300, env=dict(os.environ, HOME=t))
    o = os.path.join(t, "o"); fs = os.listdir(o) if os.path.isdir(o) else []
    r = open(os.path.join(o, fs[0]), "rb").read() if fs else None
    shutil.rmtree(t, ignore_errors=True)
    return r

def main(out, OUT):
    out("d11_google.pptx", google())
    out("d12_keynote.pptx", keynote())
    d01 = open(os.path.join(OUT, "d01_course.pptx"), "rb").read()
    out("d14_strict.pptx", strict(d01))
    for src, dst in (("d01_course.pptx", "d13_lo_course.pptx"), ("d04_tables.pptx", "d13_lo_tables.pptx"), ("d02_numbers.pptx", "d13_lo_numbers.pptx")):
        r = lo_convert(open(os.path.join(OUT, src), "rb").read(), src, "pptx:Impress Office Open XML")
        if r: out(dst, r)
    # damaged
    d02 = open(os.path.join(OUT, "d02_numbers.pptx"), "rb").read()
    out("d18_bad_slide.pptx", patch(d02, edits={"ppt/slides/slide2.xml": lambda x: x[:len(x) // 2]}))
    out("d18_bad_notes.pptx", patch(open(os.path.join(OUT, "d09_notes.pptx"), "rb").read(), edits={"ppt/notesSlides/notesSlide1.xml": lambda x: x.replace("</p:notes>", "")}))
    out("d18_bad_core.pptx", patch(d02, edits={"docProps/core.xml": lambda x: x.replace("</cp:coreProperties>", "<dc:title>broken &amp</cp:coreProperties>")}))
    out("d18_missing_slide.pptx", patch(d02, drop=["ppt/slides/slide3.xml"]))
    out("d18_missing_picture.pptx", patch(d01, drop=lambda n: n.startswith("ppt/media/")))
    out("d18_missing_layout.pptx", patch(d02, drop=["ppt/slideLayouts/slideLayout2.xml", "ppt/slideLayouts/_rels/slideLayout2.xml.rels"]))
    out("d18_bad_layout.pptx", patch(d02, edits={"ppt/slideLayouts/slideLayout2.xml": lambda x: x.replace("</p:sldLayout>", "")}))
    out("d18_truncated.pptx", d02[: int(len(d02) * 0.7)])
    out("d18_no_content_types.pptx", patch(d02, drop=["[Content_Types].xml"]))
    # PowerPoint's other kinds of file, and files that are not presentations
    def ctype(main):
        return lambda x: x.replace("presentationml.presentation.main+xml", main)
    out("w_show.ppsx", patch(d02, edits={"[Content_Types].xml": ctype("presentationml.slideshow.main+xml")}))
    out("w_template.potx", patch(d02, edits={"[Content_Types].xml": ctype("presentationml.template.main+xml")}))
    out("w_macros.pptm", patch(d02, edits={"[Content_Types].xml": lambda x: x.replace("application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml")}))
    # an old binary PowerPoint file (.ppt) begins as every Office 97-2003 file does: the compound file's signature
    out("w_old.ppt", bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) + bytes(16) + bytes([0x3E, 0, 3, 0, 0xFE, 0xFF, 9, 0]) + bytes(512 - 32) + bytes(1024))
    r = lo_convert(d02, "d02_numbers.pptx", "odp")
    if r: out("w_impress.odp", r)
    out("w_keynote.key", write_zip([("Index/Document.iwa", b"\0\x01\x02"), ("Metadata/Properties.plist", b"<plist/>"), ("Metadata/DocumentIdentifier", b"0A1B")]))
    out("w_empty.pptx", b"")
    # a .pptx with a password to open is not a zip: it is a compound file holding EncryptionInfo and EncryptedPackage
    def dirent(name, typ, start, size):
        n = name.encode("utf-16-le") + b"\0\0"
        return n + bytes(64 - len(n)) + bytes([len(n), 0, typ, 1]) + bytes([0xFF] * 12) + bytes(16) + bytes(4) + bytes(16) + start.to_bytes(4, "little") + size.to_bytes(8, "little")
    hdr = bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) + bytes(16) + bytes([0x3E, 0, 3, 0, 0xFE, 0xFF, 9, 0, 6, 0]) + bytes(10) + (1).to_bytes(4, "little") + (1).to_bytes(4, "little") + bytes(4) + (4096).to_bytes(4, "little") + (0xFFFFFFFE).to_bytes(4, "little") + bytes(4) + (0xFFFFFFFE).to_bytes(4, "little") + bytes(4) + (0).to_bytes(4, "little") + bytes([0xFF] * (436 - 4))
    hdr = hdr[:512]
    fat = (0xFFFFFFFD).to_bytes(4, "little") + (0xFFFFFFFE).to_bytes(4, "little") + bytes([0xFF] * (512 - 8))
    dirs = dirent("Root Entry", 5, 0xFFFFFFFE, 0) + dirent("EncryptionInfo", 2, 0, 0) + dirent("EncryptedPackage", 2, 0, 0) + bytes(128)
    out("w_locked.pptx", hdr + fat + dirs)
    out("d20_stored.pptx", patch(d02, store=True))
    odp = open(os.path.join(OUT, "w_impress.odp"), "rb").read() if os.path.exists(os.path.join(OUT, "w_impress.odp")) else None
    r = lo_convert(odp, "talk.odp", "pptx:Impress Office Open XML") if odp else None
    if r: out("d13_lo_from_odp.pptx", r)
    out("w_pdf.pptx", b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
