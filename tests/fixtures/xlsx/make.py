# make.py -- the Excel files tests/xlsx.js reads (1.24.28). Run from the repository:
#   python3 tests/fixtures/xlsx/make.py
# excel_form.xlsx  written here in Excel's own form (as Excel 365 saved Adam's House file, 2026-11-18, with other
#                  words and numbers): shared text, a shared formula written once for G4:G6, a title merged over C1:E1
#                  and centred, column widths, a frozen top row, bold headings, a custom format, a date, per cent,
#                  a name (Rate), _xlfn.CONCAT, =-2^2 (4 in Excel), TRUE, #N/A, text that looks like a number
#                  (00123), rich text, wrapped text, a fill, a hidden column, x14ac and mc:Ignorable, calcChain,
#                  printer settings
# workbook2.xlsx   three sheets (one hidden) and a chart sheet; a formula that uses another sheet
# date1904.xlsx    the 1904 date system (a Mac's Excel of old)
# strict.xlsx      the Strict names (purl.oclc.org)
# big.xlsx         cells past column Z and past row 2000
# inline.xlsx      no shared text: inline strings and t="str" formulas (as some programs write)
# openpyxl.xlsx    openpyxl's own (if it is installed): formulas, merged cells, widths, freeze, bold, formats
# libreoffice.xlsx LibreOffice's own, from libreoffice.fods (if soffice is installed)
import io, os, subprocess, sys, zipfile
D = os.path.dirname(os.path.abspath(__file__))
M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR = 'http://schemas.openxmlformats.org/package/2006/relationships'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
OD = 'application/vnd.openxmlformats-officedocument.'
def pack(name, parts):
    with zipfile.ZipFile(os.path.join(D, name), 'w', zipfile.ZIP_DEFLATED) as z:
        for k, v in parts: z.writestr(zipfile.ZipInfo(k, (1980, 1, 1, 0, 0, 0)), v, zipfile.ZIP_DEFLATED)
def ct(sheets, extra='', strings=True):
    return HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>' \
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' \
        '<Override PartName="/xl/workbook.xml" ContentType="%sspreadsheetml.sheet.main+xml"/>' % OD + \
        ''.join('<Override PartName="/xl/worksheets/sheet%d.xml" ContentType="%sspreadsheetml.worksheet+xml"/>' % (i + 1, OD) for i in range(sheets)) + \
        '<Override PartName="/xl/styles.xml" ContentType="%sspreadsheetml.styles+xml"/>' % OD + ('<Override PartName="/xl/sharedStrings.xml" ContentType="%sspreadsheetml.sharedStrings+xml"/>' % OD if strings else '') + extra + '</Types>'
ROOTRELS = HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/officeDocument" Target="xl/workbook.xml"/></Relationships>' % (PR, R)
def sst(words):
    return HEAD + '<sst xmlns="%s" count="%d" uniqueCount="%d">%s</sst>' % (M, len(words), len(words), ''.join(w if w.startswith('<si>') else '<si><t>%s</t></si>' % w for w in words))
NS = 'xmlns="%s" xmlns:r="%s" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" ' \
    'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" ' \
    'xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3"' % (M, R)
# Excel's styles: font 0 Aptos Narrow 11, font 1 bold, font 2 red; fills none, gray125, yellow; a border; numFmt 164
STYLES = HEAD + ('<styleSheet xmlns="%s" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac x16r2 xr" '
    'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0&quot; ft&quot;"/></numFmts>'
    '<fonts count="3" x14ac:knownFonts="1"><font><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>'
    '<font><b/><sz val="11"/><color theme="1"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font>'
    '<font><sz val="11"/><color rgb="FFFF0000"/><name val="Aptos Narrow"/><family val="2"/><scheme val="minor"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill></fills>'
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'                       # 0 plain
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>'   # 1 centred
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'                                # 2 bold
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'                      # 3 0.0" ft"
    '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'                        # 4 0%
    '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'                       # 5 date
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'  # 6 red on yellow, a border
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf>'  # 7 wrapped
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1" applyNumberFormat="1"/>'       # 8 text, '0123
    '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>'  # 9 bold #,##0.00 right
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>') % M
def c(ref, v=None, s=0, t=None, f=None):
    a = ' r="%s"' % ref + (' s="%d"' % s if s else '') + (' t="%s"' % t if t else '')
    body = (f or '') + ('<v>%s</v>' % v if v is not None else '')
    return '<c%s>%s</c>' % (a, body) if body else '<c%s/>' % a
def row(r, cells, extra=''):
    return '<row r="%d" spans="1:8" x14ac:dyDescent="0.25"%s>%s</row>' % (r, extra, ''.join(cells))

# --- excel_form.xlsx ------------------------------------------------------------------------------------------------
words = ['Room', 'Length', 'Width', 'Area', 'Use', 'Share', 'Share of area', 'Hall', 'Whole', 'Kitchen', 'Half', 'Workshop', 'Store', 'Total',
         'Paint for two rooms', '00123', '<si><r><rPr><b/><sz val="11"/></rPr><t>Bold</t></r><r><t xml:space="preserve"> and plain</t></r></si>', 'A line that wraps in its cell', 'Red on yellow']
SW = ('<worksheet %s xr:uid="{00000000-0000-0000-0000-000000000001}"><dimension ref="A1:H12"/><sheetViews><sheetView tabSelected="1" workbookViewId="0">'
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
    '<sheetFormatPr defaultRowHeight="15" x14ac:dyDescent="0.25"/><cols><col min="1" max="1" width="15.28515625" bestFit="1" customWidth="1"/>'
    '<col min="6" max="6" width="12.42578125" bestFit="1" customWidth="1"/><col min="8" max="8" width="9.140625" hidden="1" customWidth="1"/></cols><sheetData>') % NS + \
    row(1, [c('C1', 14, 1, 's'), c('D1', s=1), c('E1', s=1)]) + \
    row(2, [c('A2', 0, 2, 's'), c('B2', 1, 2, 's'), c('C2', 2, 2, 's'), c('D2', 3, 2, 's'), c('E2', 4, 2, 's'), c('F2', 5, 2, 's'), c('G2', 6, 2, 's')]) + \
    row(3, [c('A3', 7, 0, 's'), c('B3', 15, 3), c('C3', 20, 3), c('D3', 300), c('E3', 8, 0, 's'), c('F3', 1, 4), c('G3', 300, f='<f>D3*F3</f>')]) + \
    row(4, [c('A4', 9, 0, 's'), c('B4', 12, 3), c('C4', 15, 3), c('D4', 180), c('E4', 10, 0, 's'), c('F4', 0.5, 4), c('G4', 90, f='<f t="shared" ref="G4:G6" si="0">D4*F4</f>')]) + \
    row(5, [c('A5', 11, 0, 's'), c('B5', 12, 3), c('C5', 12, 3), c('D5', 144), c('E5', 8, 0, 's'), c('F5', 1, 4), c('G5', 144, f='<f t="shared" si="0"/>')]) + \
    row(6, [c('A6', 12, 0, 's'), c('B6', 10, 3), c('C6', 10, 3), c('D6', 100), c('E6', 8, 0, 's'), c('F6', 1, 4), c('G6', 100, f='<f t="shared" si="0"/>')]) + \
    row(7, [c('A7', 13, 2, 's'), c('D7', 724, 9, f='<f>SUM(D3:D6)</f>'), c('G7', 634, 9, f='<f>SUM(G3:G6)</f>')]) + \
    row(8, [c('A8', 46343, 5), c('B8', 'Hall and Kitchen', 0, 'str', f='<f>_xlfn.CONCAT(A3," and ",A4)</f>'), c('C8', 4, f='<f>-2^2</f>'), c('D8', 1, 0, 'b'), c('E8', '#N/A', 0, 'e'), c('F8', 15, 8, 's')]) + \
    row(9, [c('A9', 16, 0, 's'), c('B9', 17, 7, 's'), c('C9', 18, 6, 's'), c('D9', 0.2, f='<f>Rate</f>'), c('E9', 172.8, f='<f>D5*(1+Rate)</f>'), c('F9', 0.2, 4)]) + \
    row(10, [c('A10', 64, f='<f>2^3^2</f>'), c('B10', 4, f='<f>Sheet1!D8*4</f>')], ' hidden="1"') + \
    '</sheetData><mergeCells count="1"><mergeCell ref="C1:E1"/></mergeCells><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' \
    '<pageSetup orientation="portrait" r:id="rId1"/></worksheet>'
WB = HEAD + ('<workbook %s><fileVersion appName="xl" lastEdited="7" lowestEdited="7" rupBuild="28526"/><workbookPr defaultThemeVersion="202300"/>'
    '<bookViews><workbookView xWindow="-120" yWindow="-120" windowWidth="29040" windowHeight="15720"/></bookViews><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>'
    '<definedNames><definedName name="Rate">Sheet1!$F$9</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">Sheet1!$A$1:$G$7</definedName></definedNames>'
    '<calcPr calcId="191029"/></workbook>') % NS
pack('excel_form.xlsx', [('[Content_Types].xml', ct(1, '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
        '<Override PartName="/xl/calcChain.xml" ContentType="%sspreadsheetml.calcChain+xml"/>' % OD)),
    ('_rels/.rels', ROOTRELS), ('xl/workbook.xml', WB),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId3" Type="%s/styles" Target="styles.xml"/><Relationship Id="rId2" Type="%s/theme" Target="theme/theme1.xml"/>'
        '<Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId5" Type="%s/calcChain" Target="calcChain.xml"/><Relationship Id="rId4" Type="%s/sharedStrings" Target="sharedStrings.xml"/></Relationships>' % (PR, R, R, R, R, R)),
    ('xl/theme/theme1.xml', HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements/></a:theme>'),
    ('xl/worksheets/sheet1.xml', HEAD + SW),
    ('xl/worksheets/_rels/sheet1.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/printerSettings" Target="../printerSettings/printerSettings1.bin"/></Relationships>' % (PR, R)),
    ('xl/printerSettings/printerSettings1.bin', b'\x00' * 64),
    ('xl/styles.xml', STYLES), ('xl/sharedStrings.xml', sst(words)),
    ('xl/calcChain.xml', HEAD + '<calcChain xmlns="%s"><c r="G3" i="1"/><c r="G4"/><c r="G5"/><c r="G6"/><c r="D7"/><c r="G7"/></calcChain>' % M)])

# --- workbook2.xlsx: three sheets, one hidden, a chart sheet, a formula from another sheet -----------------------------
def sheet(rows):
    return HEAD + '<worksheet xmlns="%s" xmlns:r="%s"><sheetData>%s</sheetData></worksheet>' % (M, R, ''.join(rows))
w2 = ['Item', 'Price', 'Bolts', 'Nuts', 'Order', 'Qty', 'Cost', 'Rates', 'VAT']
pack('workbook2.xlsx', [('[Content_Types].xml', ct(3, '<Override PartName="/xl/chartsheets/sheet1.xml" ContentType="%sspreadsheetml.chartsheet+xml"/>' % OD)), ('_rels/.rels', ROOTRELS),
    ('xl/workbook.xml', HEAD + '<workbook xmlns="%s" xmlns:r="%s"><sheets><sheet name="Prices" sheetId="1" r:id="rId1"/><sheet name="Order" sheetId="2" r:id="rId2"/>'
        '<sheet name="Rates" sheetId="3" state="hidden" r:id="rId3"/><sheet name="Chart1" sheetId="4" r:id="rId4"/></sheets></workbook>' % (M, R)),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="%s/worksheet" Target="worksheets/sheet2.xml"/>'
        '<Relationship Id="rId3" Type="%s/worksheet" Target="/xl/worksheets/sheet3.xml"/><Relationship Id="rId4" Type="%s/chartsheet" Target="chartsheets/sheet1.xml"/>'
        '<Relationship Id="rId5" Type="%s/styles" Target="styles.xml"/><Relationship Id="rId6" Type="%s/sharedStrings" Target="sharedStrings.xml"/></Relationships>' % (PR, R, R, R, R, R, R)),
    ('xl/worksheets/sheet1.xml', sheet(['<row r="1">%s%s</row>' % (c('A1', 0, 0, 's'), c('B1', 1, 0, 's')), '<row r="2">%s%s</row>' % (c('A2', 2, 0, 's'), c('B2', 0.25)), '<row r="3">%s%s</row>' % (c('A3', 3, 0, 's'), c('B3', 0.1))])),
    ('xl/worksheets/sheet2.xml', sheet(['<row r="1">%s%s%s</row>' % (c('A1', 4, 0, 's'), c('B1', 5, 0, 's'), c('C1', 6, 0, 's')),
        '<row r="2">%s%s%s</row>' % (c('A2', 2, 0, 's'), c('B2', 100), c('C2', 30, f='<f>B2*Prices!B2*(1+\'Rates\'!B1)</f>')),
        '<row r="3">%s%s%s</row>' % (c('A3', 3, 0, 's'), c('B3', 50), c('C3', 5, f='<f>B3*B2/B2*0.1</f>'))])),
    ('xl/worksheets/sheet3.xml', sheet(['<row r="1">%s%s</row>' % (c('A1', 8, 0, 's'), c('B1', 0.2))])),
    ('xl/chartsheets/sheet1.xml', HEAD + '<chartsheet xmlns="%s" xmlns:r="%s"><sheetViews><sheetView workbookViewId="0"/></sheetViews></chartsheet>' % (M, R)),
    ('xl/styles.xml', STYLES), ('xl/sharedStrings.xml', sst(w2))])

# --- date1904.xlsx --------------------------------------------------------------------------------------------------
pack('date1904.xlsx', [('[Content_Types].xml', ct(1)), ('_rels/.rels', ROOTRELS),
    ('xl/workbook.xml', HEAD + '<workbook xmlns="%s" xmlns:r="%s"><workbookPr date1904="1"/><sheets><sheet name="Days" sheetId="1" r:id="rId1"/></sheets></workbook>' % (M, R)),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="%s/styles" Target="styles.xml"/>'
        '<Relationship Id="rId3" Type="%s/sharedStrings" Target="sharedStrings.xml"/></Relationships>' % (PR, R, R, R)),
    # 44881 in the 1904 system is 2026-11-17 (46343 in the 1900 one); 1.5 is a number of days, not a date
    ('xl/worksheets/sheet1.xml', sheet(['<row r="1">%s%s%s</row>' % (c('A1', 44881, 5), c('B1', 1.5), c('C1', 0.75, f='<f>B1/2</f>'))])),
    ('xl/styles.xml', STYLES), ('xl/sharedStrings.xml', sst([]))])

# --- strict.xlsx ----------------------------------------------------------------------------------------------------
SM, SR = 'http://purl.oclc.org/ooxml/spreadsheetml/main', 'http://purl.oclc.org/ooxml/officeDocument/relationships'
pack('strict.xlsx', [('[Content_Types].xml', ct(1)),
    ('_rels/.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/officeDocument" Target="xl/workbook.xml"/></Relationships>' % (PR, SR)),
    ('xl/workbook.xml', HEAD + '<workbook xmlns="%s" xmlns:r="%s" conformance="strict"><sheets><sheet name="Strict" sheetId="1" r:id="rId1"/></sheets></workbook>' % (SM, SR)),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="%s/sharedStrings" Target="sharedStrings.xml"/></Relationships>' % (PR, SR, SR)),
    ('xl/worksheets/sheet1.xml', HEAD + '<worksheet xmlns="%s" xmlns:r="%s"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2</v></c><c r="C1"><f>B1*21</f><v>42</v></c></row></sheetData></worksheet>' % (SM, SR)),
    ('xl/sharedStrings.xml', HEAD + '<sst xmlns="%s"><si><t>Strict</t></si></sst>' % SM)])

# --- big.xlsx: past Z and past row 2000 --------------------------------------------------------------------------------
rows = ['<row r="1"><c r="A1"><v>1</v></c><c r="Z1"><v>26</v></c><c r="AA1"><v>27</v></c><c r="AB1"><f>AA1+1</f><v>28</v></c></row>']
rows += ['<row r="%d"><c r="A%d"><v>%d</v></c></row>' % (r, r, r) for r in range(2, 2004)]
pack('big.xlsx', [('[Content_Types].xml', ct(1, strings=False)), ('_rels/.rels', ROOTRELS),
    ('xl/workbook.xml', HEAD + '<workbook xmlns="%s" xmlns:r="%s"><sheets><sheet name="Big" sheetId="1" r:id="rId1"/></sheets></workbook>' % (M, R)),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' % (PR, R)),
    ('xl/worksheets/sheet1.xml', sheet(rows))])

# --- inline.xlsx: no shared text, cells with no r ----------------------------------------------------------------------
pack('inline.xlsx', [('[Content_Types].xml', ct(1, strings=False)), ('_rels/.rels', ROOTRELS),
    ('xl/workbook.xml', HEAD + '<workbook xmlns="%s" xmlns:r="%s"><sheets><sheet name="Inline" sheetId="1" r:id="rId1"/></sheets></workbook>' % (M, R)),
    ('xl/_rels/workbook.xml.rels', HEAD + '<Relationships xmlns="%s"><Relationship Id="rId1" Type="%s/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' % (PR, R)),
    ('xl/worksheets/sheet1.xml', sheet(['<row><c t="inlineStr"><is><t>Name</t></is></c><c t="inlineStr"><is><t>Joined</t></is></c></row>',
        '<row><c t="inlineStr"><is><t>Ann_x000D_</t></is></c><c t="str"><f>A2&amp;"!"</f><v>Ann\r!</v></c><c><v>1E-3</v></c><c t="d"><v>2026-11-17T00:00:00</v></c></row>']))])

# --- openpyxl.xlsx ----------------------------------------------------------------------------------------------------
try:
    import openpyxl
    from openpyxl.styles import Font, Alignment
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Costs'
    ws.append(['Item', 'Qty', 'Price', 'Cost'])
    for i, (n, q, p) in enumerate([('Posts', 12, 8.5), ('Rails', 22, 4.25)], start=2):
        ws.append([n, q, p, '=B%d*C%d' % (i, i)])
    ws.append(['Total', None, None, '=SUM(D2:D3)'])
    for cc in ws[1]: cc.font = Font(bold=True)
    ws['C2'].number_format = ws['C3'].number_format = ws['D2'].number_format = ws['D3'].number_format = ws['D4'].number_format = '"$"#,##0.00'
    ws['A4'].alignment = Alignment(horizontal='right')
    ws.column_dimensions['A'].width = 20
    ws.merge_cells('A6:D6'); ws['A6'] = 'Prices from the yard'
    ws.freeze_panes = 'A2'
    wb.save(os.path.join(D, 'openpyxl.xlsx'))
except ImportError:
    print('openpyxl is not installed: openpyxl.xlsx is left as it was')

# --- libreoffice.xlsx, from libreoffice.fods --------------------------------------------------------------------------
try:
    subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx', '--outdir', D, os.path.join(D, 'libreoffice.fods')], check=True, capture_output=True, timeout=180)
except Exception as e:
    print('soffice could not make libreoffice.xlsx (%s): it is left as it was' % e)
print('made', sorted(f for f in os.listdir(D) if f.endswith('.xlsx')))
