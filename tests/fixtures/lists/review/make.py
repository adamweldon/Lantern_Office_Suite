# make.py -- the input files of the 1.24.27 lists review (tests/fixtures/review_lists_1267.json). Run from anywhere:
#   python3 tests/fixtures/lists/review/make.py
# Hand-written in the form the named program writes (no rsids or paraIds; nobody's name). How sure the form is of the
# program is said in each case of the JSON. The lo_*.docx files are real LibreOffice saves (soffice --convert-to) of
# the .fodt files written here; pydocx_*.docx are python-docx's own template.
import io, os, subprocess, sys, zipfile
D = os.path.dirname(os.path.abspath(__file__))
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
OD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.'
NS = ('xmlns:w="%s" xmlns:r="%s" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
      'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" mc:Ignorable="w14 w15"') % (W, R)
def pack(name, body, numbering, styles=None):
    styles = styles or (HEAD + '<w:styles %s><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
        '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>'
        '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style>'
        '</w:styles>') % NS
    parts = [
        ('[Content_Types].xml', HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="%sdocument.main+xml"/><Override PartName="/word/styles.xml" ContentType="%sstyles+xml"/><Override PartName="/word/numbering.xml" ContentType="%snumbering+xml"/></Types>' % (OD, OD, OD)),
        ('_rels/.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/officeDocument" Target="word/document.xml"/></Relationships>' % (PR, R)),
        ('word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/styles" Target="styles.xml"/><Relationship Id="rId2" Type="%s/numbering" Target="numbering.xml"/></Relationships>' % (PR, R, R)),
        ('word/document.xml', HEAD + '<w:document %s><w:body>%s<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>' % (NS, body)),
        ('word/styles.xml', styles),
        ('word/numbering.xml', HEAD + '<w:numbering %s>%s</w:numbering>' % (NS, numbering)),
    ]
    with zipfile.ZipFile(os.path.join(D, name), 'w', zipfile.ZIP_DEFLATED) as z:
        for k, v in parts: z.writestr(zipfile.ZipInfo(k, (1980, 1, 1, 0, 0, 0)), v.encode('utf-8'), zipfile.ZIP_DEFLATED)
def esc(t): return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def T(t, rpr=''): return '<w:r>' + ('<w:rPr>' + rpr + '</w:rPr>' if rpr else '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>'
def P(t, ppr=''): return '<w:p>' + ('<w:pPr>' + ppr + '</w:pPr>' if ppr else '') + (T(t) if t else '') + '</w:p>'
def LI(t, num, ilvl, extra=''): return P(t, '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="%d"/><w:numId w:val="%s"/></w:numPr>%s' % (ilvl, num, extra))
def lvl(i, fmt, text, left, hanging=360, jc='left', rpr='', start=1, tplc=None, tentative=False):
    return ('<w:lvl w:ilvl="%d"%s%s><w:start w:val="%d"/><w:numFmt w:val="%s"/><w:lvlText w:val="%s"/><w:lvlJc w:val="%s"/><w:pPr><w:ind w:left="%d" w:hanging="%d"/></w:pPr>%s</w:lvl>'
            % (i, ' w:tplc="%s"' % tplc if tplc else '', ' w:tentative="1"' if tentative else '', start, fmt, esc(text), jc, left, hanging, '<w:rPr>' + rpr + '</w:rPr>' if rpr else ''))
# Word's Numbering button (Home > Numbering, the 1. 2. 3. it gives by default): hybridMultilevel, 1. a. i. three times,
# the roman levels right-aligned with a hanging of 180 (Word 2016-365 writes this; sure of the formats and indents)
WTPL = ['0409000F', '04090019', '0409001B']
def word_numbered(aid, nsid, used=3):
    s = '<w:abstractNum w:abstractNumId="%d" w15:restartNumberingAfterBreak="0"><w:nsid w:val="%s"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="DD3A1C2E"/>' % (aid, nsid)
    for i in range(9):
        f = ['decimal', 'lowerLetter', 'lowerRoman'][i % 3]
        s += lvl(i, f, '%%%d.' % (i + 1), 720 * (i + 1), 180 if i % 3 == 2 else 360, 'right' if i % 3 == 2 else 'left', tplc=WTPL[i % 3], tentative=i >= used)
    return s + '</w:abstractNum>'
# Word's Bullets button: Symbol (U+F0B7), "o" in Courier New, Wingdings (U+F0A7), three times (sure)
def word_bullets(aid, nsid):
    s = '<w:abstractNum w:abstractNumId="%d" w15:restartNumberingAfterBreak="0"><w:nsid w:val="%s"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="5C1E6A3A"/>' % (aid, nsid)
    for i in range(9):
        k = i % 3
        txt, font = [('', 'Symbol'), ('o', 'Courier New'), ('', 'Wingdings')][k]
        s += lvl(i, 'bullet', txt, 720 * (i + 1), rpr='<w:rFonts w:ascii="%s" w:hAnsi="%s"%s w:hint="default"/>' % (font, font, ' w:cs="Courier New"' if k == 1 else ''), tplc=['04090001', '04090003', '04090005'][k], tentative=i >= 3)
    return s + '</w:abstractNum>'
def num(n, a, over=''): return '<w:num w:numId="%d"><w:abstractNumId w:val="%d"/>%s</w:num>' % (n, a, over)
# --- Word: the Numbering button, three levels and back, and a second list restarted (lvlOverride) ---------------
pack('word_numbering_button.docx',
     P('Lockout', '<w:pStyle w:val="Heading1"/>') + LI('Isolate the supply', 1, 0) + LI('Open the disconnect', 1, 1) + LI('Fit your own padlock', 1, 2) + LI('One lock each', 1, 2) +
     LI('Tag it', 1, 1) + LI('Test for dead', 1, 0) + LI('Prove the tester', 1, 1) + LI('Work', 1, 0),
     word_numbered(0, '3C5E2A1F') + num(1, 0))
# --- Word: the Bullets button, three levels and a fourth ---------------------------------------------------------
pack('word_bullets_button.docx', LI('Tools', 2, 0) + LI('Hand tools', 2, 1) + LI('Spanner', 2, 2) + LI('13 mm', 2, 3) + LI('Power tools', 2, 1) + LI('Parts', 2, 0), word_bullets(0, '6A2B4C11') + num(2, 0))
# --- Word: bullets with a numbered list under one item (a second list at ilvl 1, Word's Numbering button pressed there) -
pack('word_bullets_numbered_under.docx', LI('Before you start', 1, 0) + LI('Read the manual', 2, 1) + LI('Find the drain plug', 2, 1) + LI('Afterwards', 1, 0),
     word_bullets(0, '6A2B4C12') + word_numbered(1, '3C5E2A20') + num(1, 0) + num(2, 1))
# --- Word: all nine levels of the Numbering button (and an ilvl past nine, which Word never writes) --------------
pack('word_nine_levels.docx', ''.join(LI('Level %d' % (i + 1), 1, i) for i in range(9)) + LI('Back to one', 1, 0), word_numbered(0, '3C5E2A21', 9) + num(1, 0))
# --- Word's multilevel library: "1. 1.1. 1.1.1." (multilevel, tmpl 0409001F; sure of formats, fairly sure of indents) -
ml = '<w:abstractNum w:abstractNumId="0" w15:restartNumberingAfterBreak="0"><w:nsid w:val="1B4F2E33"/><w:multiLevelType w:val="multilevel"/><w:tmpl w:val="0409001F"/>'
for i in range(9):
    ml += lvl(i, 'decimal', '.'.join('%%%d' % (k + 1) for k in range(i + 1)) + '.', [360, 792, 1224, 1728, 2232, 2736, 3240, 3744, 4320][i], [360, 432, 504, 648, 792, 936, 1080, 1224, 1440][i])
pack('word_multilevel_1_1_1.docx', LI('Scope', 1, 0) + LI('Machines covered', 1, 1) + LI('Presses', 1, 2) + LI('People', 1, 1) + LI('Method', 1, 0), ml + '</w:abstractNum>' + num(1, 0))
# --- Word's multilevel library: "1) a) i)" (its first entry; multilevel, tmpl 0409001D; sure of the lvlText) --------
mp = '<w:abstractNum w:abstractNumId="0" w15:restartNumberingAfterBreak="0"><w:nsid w:val="2D7A1E44"/><w:multiLevelType w:val="multilevel"/><w:tmpl w:val="0409001D"/>'
for i, (f, t) in enumerate([('decimal', '%1)'), ('lowerLetter', '%2)'), ('lowerRoman', '%3)'), ('decimal', '(%4)'), ('lowerLetter', '(%5)'), ('lowerRoman', '(%6)'), ('decimal', '%7.'), ('lowerLetter', '%8.'), ('lowerRoman', '%9.')]):
    mp += lvl(i, f, t, 360 * (i + 1))
pack('word_multilevel_paren.docx', LI('Clean the filter', 1, 0) + LI('Take it out', 1, 1) + LI('Wash it', 1, 1) + LI('In warm water', 1, 2) + LI('Refit it', 1, 0), mp + '</w:abstractNum>' + num(1, 0))
# --- Word, a contract's "(a)" and "(i)" (Define new number format; hybridMultilevel) -----------------------------
ca = '<w:abstractNum w:abstractNumId="0"><w:nsid w:val="4A1E2B55"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="7E1A2C3D"/>' + lvl(0, 'lowerLetter', '(%1)', 720) + lvl(1, 'lowerRoman', '(%2)', 1440, jc='right', hanging=180)
for i in range(2, 9): ca += lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], '%%%d.' % (i + 1), 720 * (i + 1))
pack('word_contract_parens.docx', P('The tenant shall:') + LI('pay the rent on time;', 1, 0) + LI('keep the property clean, including', 1, 0) + LI('the garden; and', 1, 1) + LI('the drains;', 1, 1) + LI('give notice of repairs.', 1, 0), ca + '</w:abstractNum>' + num(1, 0))
# --- Word: the library's "A. B. C." chosen for the list (level 0 upperLetter, the rest Word's 1. a. i. levels) ------
ua = '<w:abstractNum w:abstractNumId="0"><w:nsid w:val="5B2C3D66"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="04090015"/>' + lvl(0, 'upperLetter', '%1.', 720, tplc='04090015')
for i in range(1, 9): ua += lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], '%%%d.' % (i + 1), 720 * (i + 1), 180 if i % 3 == 2 else 360, 'right' if i % 3 == 2 else 'left', tplc=WTPL[i % 3], tentative=True)
pack('word_upper_letter.docx', LI('Electrical', 1, 0) + LI('Isolator', 1, 1) + LI('Fuses', 1, 1) + LI('Mechanical', 1, 0), ua + '</w:abstractNum>' + num(1, 0))
# --- Word: 30 items at the second level (Word letters them a ... z, aa, bb, cc, dd) --------------------------------
pack('word_30_letters.docx', LI('Parts list', 1, 0) + ''.join(LI('Part %d' % (i + 1), 1, 1) for i in range(30)) + LI('Assembly', 1, 0), word_numbered(0, '3C5E2A22') + num(1, 0))
# --- Word: a template whose second level is 1, 2, 3 (decimal "%2."), as Word's List Number 2 style is -------------
dz = '<w:abstractNum w:abstractNumId="0"><w:nsid w:val="6C3D4E77"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="04090001"/>' + lvl(0, 'decimal', '%1.', 720) + lvl(1, 'decimal', '%2.', 1440) + lvl(2, 'decimalZero', '%3.', 2160)
for i in range(3, 9): dz += lvl(i, 'decimal', '%%%d.' % (i + 1), 720 * (i + 1))
pack('word_decimal_second.docx', LI('Fill', 1, 0) + LI('Open the cap', 1, 1) + LI('Pour slowly', 1, 1) + LI('Zero-padded third', 1, 2) + LI('Close', 1, 0), dz + '</w:abstractNum>' + num(1, 0))
# --- Word: one list carried on after a paragraph, a second restarted (startOverride 1), a third from 5 -------------
pack('word_start_override.docx', LI('First', 1, 0) + LI('Second', 1, 0) + P('A note between.') + LI('Third, carried on', 1, 0) + LI('sub', 1, 1) +
     P('New list:') + LI('From one', 3, 0) + LI('Two', 3, 0) + P('Part two:') + LI('From five', 4, 0) + LI('sub of five', 4, 1),
     word_numbered(0, '3C5E2A23') + num(1, 0) + num(3, 0, '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>') + num(4, 0, '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="5"/></w:lvlOverride>'))
# --- Word: lists in a table's cells (Numbering button in a cell, Tab for the second level) -------------------------
cell = lambda inner: '<w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>' + inner + '</w:tc>'
tbl = ('<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="4680"/></w:tblGrid>'
       '<w:tr>' + cell(P('Task')) + cell(P('Steps')) + '</w:tr><w:tr>' + cell(P('Oil change')) + cell(LI('Drain', 5, 0) + LI('into a pan', 5, 1) + LI('Refill', 5, 0)) + '</w:tr></w:tbl>')
pack('word_table_lists.docx', LI('Before the table', 1, 0) + tbl + LI('After the table', 1, 0), word_numbered(0, '3C5E2A24') + num(1, 0) + word_numbered(1, '3C5E2A25') + num(5, 1))
# --- Word: a list that skips a level (ilvl 0, then 2) and one that starts at the second level ---------------------
pack('word_skip_levels.docx', LI('Top', 1, 0) + LI('Third level straight away', 1, 2) + LI('Top again', 1, 0) + P('Then:') + LI('Starts at the second level', 6, 1) + LI('and goes on', 6, 1),
     word_numbered(0, '3C5E2A26') + num(1, 0) + word_numbered(1, '3C5E2A27') + num(6, 1))
# --- Word, Hebrew: right-to-left paragraphs, the list's own Hebrew letters at the second level (hebrew1) -----------
he = '<w:abstractNum w:abstractNumId="0"><w:nsid w:val="7D4E5F88"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="04090001"/>' + lvl(0, 'decimal', '%1.', 720) + lvl(1, 'hebrew1', '%2.', 1440)
for i in range(2, 9): he += lvl(i, ['decimal', 'lowerLetter', 'lowerRoman'][i % 3], '%%%d.' % (i + 1), 720 * (i + 1))
rtl = '<w:bidi/>'
pack('word_rtl_hebrew.docx', LI('בדיקה', 1, 0, rtl) + LI('שמן', 1, 1, rtl) + LI('מים', 1, 1, rtl) + LI('סיום', 1, 0, rtl), he + '</w:abstractNum>' + num(1, 0))
# --- hostile: an ilvl of 12 and of -1, a numId with no num, a num with no abstractNum, a level with no numFmt -----
hz = '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>' + lvl(0, 'decimal', '%1.', 720) + '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:lvlText w:val="%2."/></w:lvl></w:abstractNum>'
pack('hostile_list_levels.docx', LI('ilvl 0', 1, 0) + LI('no numFmt at ilvl 1', 1, 1) + LI('ilvl 12', 1, 12) + P('ilvl -1', '<w:numPr><w:ilvl w:val="-1"/><w:numId w:val="1"/></w:numPr>') +
     LI('numId 99 (none)', 99, 0) + LI('num 7 has no abstractNum', 7, 0) + LI('ilvl 3, no such level', 1, 3), hz + num(1, 0) + '<w:num w:numId="7"><w:abstractNumId w:val="42"/></w:num>')
# --- Google Docs: File > Download > Microsoft Word. Each list defines all nine levels; bullets are the characters
# themselves; the paragraph carries its own indent; runs carry w:rtl 0. (From memory of Docs' exports: fairly sure of
# the nine levels, the bullet characters and the indents; less sure of every attribute.) ---------------------------
def gd_list(aid, fmts, texts, jcs=None):
    s = '<w:abstractNum w:abstractNumId="%d">' % aid
    for i in range(9):
        s += lvl(i, fmts[i], texts[i], 720 * (i + 1), 360, (jcs or ['left'] * 9)[i], rpr='<w:u w:val="none"/>')
    return s + '</w:abstractNum>'
GDN = gd_list(1, ['decimal', 'lowerLetter', 'lowerRoman'] * 3, ['%%%d.' % (i + 1) for i in range(9)], ['left', 'left', 'right'] * 3)
GDB = gd_list(2, ['bullet'] * 9, ['●', '○', '■'] * 3)
GDO = gd_list(3, ['upperRoman', 'upperLetter', 'decimal', 'lowerLetter', 'lowerRoman', 'decimal', 'lowerLetter', 'lowerRoman', 'decimal'], ['%%%d.' % (i + 1) for i in range(9)], ['right', 'left', 'left', 'left', 'right', 'left', 'left', 'right', 'left'])
def GLI(t, n, i): return ('<w:p><w:pPr><w:numPr><w:ilvl w:val="%d"/><w:numId w:val="%d"/></w:numPr><w:spacing w:after="0" w:afterAutospacing="0" w:before="0" w:beforeAutospacing="0" w:line="276" w:lineRule="auto"/>'
                          '<w:ind w:left="%d" w:hanging="360"/><w:rPr><w:u w:val="none"/></w:rPr></w:pPr><w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000"><w:rPr><w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>') % (i, n, 720 * (i + 1), esc(t))
gnums = '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="3"/></w:num>'
pack('gdocs_export.docx', GLI('Prepare', 1, 0) + GLI('Gloves', 1, 1) + GLI('Nitrile', 1, 2) + GLI('Rags', 1, 1) + GLI('Drain', 1, 0) +
     '<w:p><w:r><w:t>Kit:</w:t></w:r></w:p>' + GLI('Bucket', 2, 0) + GLI('Lid', 2, 1) + GLI('Seal', 2, 2) + GLI('Funnel', 2, 0), GDN + GDB + GDO + gnums)
pack('gdocs_outline_preset.docx', GLI('Introduction', 3, 0) + GLI('Purpose', 3, 1) + GLI('Who it is for', 3, 2) + GLI('Trades', 3, 3) + GLI('Electricians', 3, 4) + GLI('Method', 3, 0), GDN + GDB + GDO + gnums)
# --- LibreOffice: flat ODF written as LibreOffice's own toolbar list ("Toggle Ordered List", Tab for a level), then
# saved as Word by LibreOffice itself (real saves). LibreOffice's toolbar numbering is 1. at every level. -----------
FODT_HEAD = ('<?xml version="1.0" encoding="UTF-8"?><office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
             'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
             'office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">')
def lo_list_style(name, fmts):
    s = '<text:list-style style:name="%s">' % name
    for i in range(10):
        s += ('<text:list-level-style-number text:level="%d" style:num-suffix="." style:num-format="%s"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment">'
              '<style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="%.3fin" fo:text-indent="-0.25in" fo:margin-left="%.3fin"/></style:list-level-properties></text:list-level-style-number>') % (i + 1, fmts[i % len(fmts)], 0.5 * (i + 1), 0.5 * (i + 1))
    return s + '</text:list-style>'
def lo_items(tree):
    s = ''
    for t, kids in tree:
        s += '<text:list-item><text:p text:style-name="P1">%s</text:p>%s</text:list-item>' % (esc(t), ('<text:list>' + lo_items(kids) + '</text:list>') if kids else '')
    return s
def fodt(name, style_fmts, tree, extra_styles='', pre=''):
    x = FODT_HEAD + '<office:automatic-styles><style:style style:name="P1" style:family="paragraph" style:list-style-name="L1"/>' + lo_list_style('L1', style_fmts) + extra_styles + '</office:automatic-styles>'
    x += '<office:body><office:text>' + pre + '<text:list text:style-name="L1">' + lo_items(tree) + '</text:list></office:text></office:body></office:document>'
    p = os.path.join(D, name); open(p, 'w', encoding='utf-8').write(x); return p
TREE = [('Isolate', [('Open the disconnect', [('Fit your padlock', [])]), ('Tag it', [])]), ('Test', []), ('Work', [])]
fodt('lo_toolbar_list.fodt', ['1'], TREE)
fodt('lo_abc_list.fodt', ['1', 'a', 'i'], TREE)
for f in ['lo_toolbar_list', 'lo_abc_list']:
    subprocess.run(['soffice', '--headless', '--convert-to', 'docx:MS Word 2007 XML', '--outdir', D, os.path.join(D, f + '.fodt')], capture_output=True, timeout=240)
# --- python-docx's own template: List Number, List Number 2, List Bullet 2 (Word's built-in list styles) ----------
try:
    import docx
    d = docx.Document()
    d.add_paragraph('Steps', style='Heading 1')
    d.add_paragraph('Drain', style='List Number'); d.add_paragraph('Open the plug', style='List Number 2'); d.add_paragraph('Catch the oil', style='List Number 2')
    d.add_paragraph('Refill', style='List Number'); d.add_paragraph('Bullet under it', style='List Bullet 2')
    d.save(os.path.join(D, 'pydocx_list_styles.docx'))
except Exception as e:
    print('python-docx:', e)
print('made', sorted(f for f in os.listdir(D) if f.endswith('.docx')))
