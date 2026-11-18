# make.py -- the Word files tests/docx.js reads (1.24.26). Run from the repository:
#   python3 tests/fixtures/docx/make.py [path to Adam's Using_Lantern.docx]
# word_plain.docx    Word's own document.xml (Adam saved Lantern's text from Word, 2026-11-18), with a small styles.xml of
#                    ours and nobody's name; kept as Word wrote it: Plain Text style, rsids, w14 ids, a centred bold title
# pydocx.docx        python-docx: Title, Heading 1 to 3, List Bullet and List Number (the list is in the style), a table
#                    with cells joined across and down, a picture, a page break, the title in docProps
# features.docx      written here in Word's form: tracked changes, a comment, a footnote, a HYPERLINK field and a PAGE
#                    field, content controls, a text box in mc:AlternateContent, a floating picture, numbering defined
#                    as Word defines it (restarted with lvlOverride), an outline level, highlight, double strike, a
#                    header, A4 landscape with narrow margins
# strict.docx        the same few things with the Strict names (purl.oclc.org)
# book.xlsx          an Excel file, for the message that says so
import io, os, struct, sys, zipfile, zlib
D = os.path.dirname(os.path.abspath(__file__))
def png(w, h, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
def pack(name, parts):
    with zipfile.ZipFile(os.path.join(D, name), 'w', zipfile.ZIP_DEFLATED) as z:
        for k, v in parts: z.writestr(zipfile.ZipInfo(k, (1980, 1, 1, 0, 0, 0)), v, zipfile.ZIP_DEFLATED)
def ct(extra, defaults=''):
    return HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + defaults + \
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' + extra + '</Types>'
ROOTRELS = HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/officeDocument" Target="word/document.xml"/></Relationships>' % (PR, R)
# --- word_plain.docx ------------------------------------------------------------------------------------------------
src = sys.argv[1] if len(sys.argv) > 1 else None
if src and os.path.exists(src):
    doc = zipfile.ZipFile(src).read('word/document.xml')
    styles = HEAD + ('<w:styles xmlns:w="%s"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        '<w:style w:type="paragraph" w:styleId="PlainText"><w:name w:val="Plain Text"/><w:basedOn w:val="Normal"/><w:link w:val="PlainTextChar"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>'
        '<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:style></w:styles>') % W
    pack('word_plain.docx', [('[Content_Types].xml', ct('<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>')),
        ('_rels/.rels', ROOTRELS), ('word/document.xml', doc),
        ('word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/styles" Target="styles.xml"/></Relationships>' % (PR, R)),
        ('word/styles.xml', styles)])
# --- pydocx.docx ----------------------------------------------------------------------------------------------------
import docx
from docx.shared import Inches
from docx.enum.text import WD_BREAK
d = docx.Document()
d.core_properties.title = 'Python docx sample'
d.core_properties.author = ''
d.add_paragraph('Pump maintenance', style='Title')
d.add_heading('Before you start', level=1)
p = d.add_paragraph('Switch off ')
p.add_run('and lock').bold = True
p.add_run(' the isolator; ')
r = p.add_run('then test'); r.italic = True; r.underline = True
p.add_run('.')
d.add_heading('Tools', level=2)
for t in ['Spanner', 'Grease gun', 'Rags']: d.add_paragraph(t, style='List Bullet')
d.add_heading('Steps', level=3)
for t in ['Drain the pump', 'Change the seal', 'Refill and test']: d.add_paragraph(t, style='List Number')
t = d.add_table(rows=3, cols=3); t.style = 'Table Grid'
for i, row in enumerate([['Part', 'Size', 'Qty'], ['Seal', '25 mm', '2'], ['Bolt', 'M8', '4']]):
    for j, v in enumerate(row): t.cell(i, j).text = v
t.cell(1, 2).merge(t.cell(2, 2)); t.cell(1, 2).text = '6 in all'
t2 = d.add_table(rows=2, cols=3); t2.style = 'Table Grid'
t2.cell(0, 0).merge(t2.cell(0, 1)); t2.cell(0, 0).text = 'Two columns'; t2.cell(0, 2).text = 'One'
for j, v in enumerate(['a', 'b', 'c']): t2.cell(1, j).text = v
bio = io.BytesIO(png(64, 32, (30, 90, 200)))
d.add_picture(bio, width=Inches(1.0))
d.add_paragraph('Before the break.').add_run().add_break(WD_BREAK.PAGE)
d.add_paragraph('After the break.')
d.save(os.path.join(D, 'pydocx.docx'))
# --- features.docx --------------------------------------------------------------------------------------------------
NS = ('xmlns:w="%s" xmlns:r="%s" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" '
      'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
      'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:v="urn:schemas-microsoft-com:vml" mc:Ignorable="w14"') % (W, R)
def P(inner, ppr=''): return '<w:p>' + ('<w:pPr>' + ppr + '</w:pPr>' if ppr else '') + inner + '</w:p>'
def T(t, rpr=''): return '<w:r>' + ('<w:rPr>' + rpr + '</w:rPr>' if rpr else '') + '<w:t xml:space="preserve">' + t + '</w:t></w:r>'
blip = lambda rid, cx, cy, anchor: ('<w:r><w:drawing>' + ('<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="1" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>' if anchor else '<wp:inline>') +
    '<wp:extent cx="%d" cy="%d"/>' % (cx, cy) + ('<wp:wrapSquare wrapText="bothSides"/>' if anchor else '') + '<wp:docPr id="%d" name="Picture" descr="a blue box"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="x.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="%s"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic>' % (7 if anchor else 6, rid) +
    ('</wp:anchor>' if anchor else '</wp:inline>') + '</w:drawing></w:r>')
body = ''.join([
    P(T('Feature test'), '<w:pStyle w:val="Title"/>'),
    P(T('Changes'), '<w:outlineLvl w:val="1"/>'),
    P(T('Kept ') + '<w:ins w:id="1" w:author="A" w:date="2026-11-18T00:00:00Z">' + T('inserted ') + '</w:ins><w:del w:id="2" w:author="A" w:date="2026-11-18T00:00:00Z"><w:r><w:delText>deleted </w:delText></w:r></w:del>' + T('end.') +
      '<w:commentRangeStart w:id="0"/>' + T('commented') + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>'),
    P(T('A footnote') + '<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="2"/></w:r>' + T(' and ') +
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> HYPERLINK "https://example.org/a" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + T('a field link') + '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
      T(', page ') + '<w:fldSimple w:instr=" PAGE ">' + T('1') + '</w:fldSimple>' + T(', ') + '<w:hyperlink r:id="rId20" w:history="1">' + T('a link', '<w:rStyle w:val="Hyperlink"/>') + '</w:hyperlink>' + T('.')),
    '<w:sdt><w:sdtPr><w:alias w:val="Box"/></w:sdtPr><w:sdtContent>' + P(T('Inside a content control with ') + '<w:sdt><w:sdtContent>' + T('an inline one') + '</w:sdtContent></w:sdt>' + T('.')) + '</w:sdtContent></w:sdt>',
    P(T('Highlighted', '<w:highlight w:val="yellow"/>') + T(' and ') + T('double struck', '<w:dstrike/>') + T(' and ') + T('not bold', '<w:b w:val="0"/>') + T('.')),
    P(T('Before the box.') + '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="2" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="914400" cy="457200"/><wp:wrapNone/><wp:docPr id="5" name="Text Box"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx><w:txbxContent>' +
      P(T('Text in the box.')) + '</w:txbxContent></wps:txbx><wps:bodyPr/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>' + P(T('Text in the box.')) + '</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>'),
    P(T('One'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    P(T('One a'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>'),
    P(T('Two'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    P(T('A paragraph between.')),
    P(T('Three, carried on'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
    P(T('From one again'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr>'),
    P(T('Dot'), '<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'),
    P(T('Not a list (numId 0)'), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>'),
    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>' +
      '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + ''.join('<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>' + P(T(h, '<w:b/>')) + '</w:tc>' for h in ['A', 'B', 'C']) + '</w:tr>' +
      '<w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr>' + P(T('down two')) + '</w:tc><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr>' + P(T('across two')) + P(T('second line')) + '</w:tc></w:tr>' +
      '<w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc><w:tc>' + P(T('b3')) + '</w:tc><w:tc>' + P(T('c3')) + '</w:tc></w:tr></w:tbl>',
    P(blip('rId21', 609600, 304800, False) + T(' inline, and floating: ') + blip('rId21', 304800, 152400, True)),
    P('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>'),
    P(T('The end.'), '<w:jc w:val="both"/>'),
    '<w:sectPr><w:headerReference w:type="default" r:id="rId22"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'])
numbering = HEAD + ('<w:numbering xmlns:w="%s"><w:abstractNum w:abstractNumId="0"><w:nsid w:val="1A2B3C4D"/><w:multiLevelType w:val="hybridMultilevel"/><w:tmpl w:val="04090019"/>'
    '<w:lvl w:ilvl="0" w:tplc="0409000F"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
    '<w:lvl w:ilvl="1" w:tplc="04090019"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%%2."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
    '<w:abstractNum w:abstractNumId="1"><w:nsid w:val="5E6F7A8B"/><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>'
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num></w:numbering>') % W
fstyles = HEAD + ('<w:styles xmlns:w="%s"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="56"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style>'
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style></w:styles>') % W
foot = HEAD + '<w:footnotes xmlns:w="%s"><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="2">%s</w:footnote></w:footnotes>' % (W, P('<w:r><w:footnoteRef/></w:r>' + T(' The note says this.')))
comments = HEAD + '<w:comments xmlns:w="%s"><w:comment w:id="0" w:author="A">%s</w:comment></w:comments>' % (W, P(T('A comment.')))
header = HEAD + '<w:hdr xmlns:w="%s">%s</w:hdr>' % (W, P(T('Header text')))
OD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.'
pack('features.docx', [
    ('[Content_Types].xml', ct(''.join('<Override PartName="/word/%s.xml" ContentType="%s%s+xml"/>' % (n, OD, t) for n, t in [('styles', 'styles'), ('numbering', 'numbering'), ('footnotes', 'footnotes'), ('comments', 'comments'), ('header1', 'header')]), '<Default Extension="png" ContentType="image/png"/>')),
    ('_rels/.rels', ROOTRELS),
    ('word/document.xml', HEAD + '<w:document %s><w:body>%s</w:body></w:document>' % (NS, body)),
    ('word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="%s">' % PR + ''.join('<Relationship Id="%s" Type="%s/%s" Target="%s"%s/>' % (i, R, t, g, ' TargetMode="External"' if t == 'hyperlink' else '') for i, t, g in [
        ('rId1', 'styles', 'styles.xml'), ('rId2', 'numbering', 'numbering.xml'), ('rId3', 'footnotes', 'footnotes.xml'), ('rId4', 'comments', 'comments.xml'),
        ('rId20', 'hyperlink', 'https://example.org/b?x=1&amp;y=2'), ('rId21', 'image', 'media/image1.png'), ('rId22', 'header', 'header1.xml')]) + '</Relationships>'),
    ('word/styles.xml', fstyles), ('word/numbering.xml', numbering), ('word/footnotes.xml', foot), ('word/comments.xml', comments), ('word/header1.xml', header),
    ('word/media/image1.png', png(64, 32, (30, 90, 200)))])
# --- strict.docx ----------------------------------------------------------------------------------------------------
SW = 'http://purl.oclc.org/ooxml/wordprocessingml/main'
SR = 'http://purl.oclc.org/ooxml/officeDocument/relationships'
sbody = ('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Strict heading</w:t></w:r></w:p>'
         '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:hyperlink r:id="rId9"><w:r><w:t>a link</w:t></w:r></w:hyperlink></w:p>')
pack('strict.docx', [
    ('[Content_Types].xml', ct('<Override PartName="/word/styles.xml" ContentType="%sstyles+xml"/>' % OD)),
    ('_rels/.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/officeDocument" Target="word/document.xml"/></Relationships>' % PR),
    ('word/document.xml', HEAD + '<w:document xmlns:w="%s" xmlns:r="%s" w:conformance="strict"><w:body>%s</w:body></w:document>' % (SW, SR, sbody)),
    ('word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/styles" Target="styles.xml"/><Relationship Id="rId9" Type="http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink" Target="https://example.org/s" TargetMode="External"/></Relationships>' % PR),
    ('word/styles.xml', HEAD + '<w:styles xmlns:w="%s"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style></w:styles>' % SW)])
# --- book.xlsx ------------------------------------------------------------------------------------------------------
import openpyxl
wb = openpyxl.Workbook(); ws = wb.active; ws['A1'] = 'Room'; ws['B1'] = 12; ws['B2'] = '=B1*2'
wb.properties.creator = ''
wb.save(os.path.join(D, 'book.xlsx'))
print('made', sorted(f for f in os.listdir(D) if f.endswith(('.docx', '.xlsx'))))
