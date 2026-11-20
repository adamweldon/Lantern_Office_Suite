# cases.py -- the grid_1269 review cases for draft 1.24.29 (Sheets: drag selection, right-click menus, Insert/Delete,
# Format Cells, row height / column width, hide / unhide, SUBTOTAL and AGGREGATE over hidden rows, .xlsx, undo).
# Written by a reviewer who did not write the feature, from what Microsoft Excel does, not from Lantern's source.
#
# Each case: id, claim (1-8, as numbered in the draft's description), does (what is done, in words), excel (what
# Excel does), harm (high / medium / low: what a person loses if Lantern does otherwise), cells (the sheet it starts
# from), steps (replayed with the real mouse and keys by replay.py), expect (what is checked).  "lo": the same
# operation done in LibreOffice (Excel's stand-in for moving formulas); lo_expect.py turns it into lo_expect.json.
# "unjudged": Excel's own behaviour is not certain enough to call a difference a fault.
#
# Steps: ("click", T [, mods]) ("drag", T1, T2) ("rclick", T) ("pick", menu item) ("radio"/"check", dialog label)
# ("field", value) ("select", aria-label, value) ("ok",) ("cancel",) ("key", k) ("type", text) ("tap", T)
# ("longpress", T) ("tapitem", item) ("tapdlg", label) ("button", toolbar text) ("save", name) ("import", name)
# T: a cell "B2", a row number "r3", a column letter "cC", "corner", "editor" (the formula bar).
# Expect: sel ("cells","B2:D5") / ("rows",2,5) / ("cols","B","D") / ("all",); active; notext; menu; dlg; dlg_checked;
# dlg_field; raw {ref: text}; cells_exact {...}; lo True; vals; shown; bold/italic/align; merged {ref: [cols, rows]};
# hidden_rows; hidden_cols; row_h / col_w {x: ratio to a usual row / column, as Excel draws it}; rowhead/colhead
# (Lantern's shading: "hsel" whole row/column, "hon" part of the selection, "" none); msg; warned; xlsx; js.
import statistics

CASES = []
def case(id, claim, does, excel, harm, cells, steps, expect, **kw):
    d = dict(id=id, claim=claim, does=does, excel=excel, harm=harm, cells=dict(cells), steps=steps, expect=expect)
    d.update(kw); CASES.append(d)

CELLMENU = ["Cut", "Copy", "Paste", "Insert…", "Delete…", "Clear Contents", "Sort A to Z", "Sort Z to A", "Format Cells…"]
ROWMENU = ["Cut", "Copy", "Paste", "Insert", "Delete", "Clear Contents", "Format Cells…", "Row Height…", "Hide", "Unhide"]
COLMENU = ["Cut", "Copy", "Paste", "Insert", "Delete", "Clear Contents", "Format Cells…", "Column Width…", "Hide", "Unhide"]
INS, DEL, FMT, RH, CW = "Insert…", "Delete…", "Format Cells…", "Row Height…", "Column Width…"
CTRLPLUS, CTRLMINUS = "Control+Shift+Equal", "Control+Minus"

def colw(L):
    n = 0
    for ch in L: n = n * 26 + ord(ch) - 64
    return "() => document.querySelector('thead th:nth-child(%d)').getBoundingClientRect().width" % (n + 1)
def rowh(r):
    return "() => document.querySelector('tbody tr:nth-child(%d)').getBoundingClientRect().height" % r

# Excel draws a column of w characters (Calibri 11, 7-pixel digits) trunc(w*7+5) pixels wide: 8.43 -> 64, 20 -> 145.
def xl_ratio(w): return int(w * 7 + 5) / 64.0

# A first click on a cell far from the data. On a sheet just opened, the keyboard does not reach the grid after a drag
# unless a cell was clicked first (cases S39-S42 record that on their own); the other cases click first so that each
# tests its own claim.
FOCUS = ("click", "K20")
def MERGE(a, b):
    return [FOCUS, ("drag", a, b), ("key", "Control+1"), ("check", "Merge cells", True), ("ok",)]

# ---------------------------------------------------------------- data the cases start from
SMALL = {"A1": "Item", "B1": "Qty", "A2": "rice", "B2": "2", "A3": "beans", "B3": "5", "A4": "oil", "B4": "1", "C2": "=B2*3"}
BLOCK = dict(("%s%d" % (c, r), str(r * 10 + i + 1)) for r in range(1, 7) for i, c in enumerate("ABCDE"))
FORMS_C = dict(BLOCK, **{"G1": "=C3", "G2": "=SUM(C1:C5)", "G3": "=SUM(B1:D5)", "G4": "=SUM(C3:C5)", "G5": "=$C$3",
                         "G6": "=C2+C3", "G7": "=B3", "G8": "=SUM(C1:C2)", "G9": "=SUM(C4:C6)", "G10": '="C3"&C3',
                         "G11": "=LOG10(C3)", "G12": "=C$3+$C3", "G13": "=SUM(C2:C4)", "C8": "=SUM(C1:C6)", "C9": "=C3*2"})
FORMS_R = dict(BLOCK, **{"A9": "=C3", "B9": "=SUM(A3:E3)", "C9": "=SUM(B2:D4)", "D9": "=SUM(C3:E3)", "E9": "=$C$3",
                         "F9": "=B3", "G9": "=SUM(A3:B3)", "H9": "=C3+D3", "H3": "=SUM(A3:E3)", "A10": "=SUM(C1:C6)"})
FORMS_BC = dict(BLOCK, **{"G1": "=SUM(B1:C5)", "G2": "=SUM(A1:C5)", "G3": "=SUM(B1:B5)", "G4": "=C2", "G5": "=B4",
                          "G6": "=D2", "G7": "=SUM(B2:C2)", "G8": "=SUM(B3:C6)", "G9": "=B2+C3"})
ROWS = {"A1": "Item", "B1": "Qty"}
for i, nm in enumerate(["rice", "beans", "oil", "salt", "flour", "sugar", "tea", "soap"]):
    ROWS["A%d" % (i + 2)] = nm; ROWS["B%d" % (i + 2)] = str(i + 1)
ROWS.update({"B10": "=SUM(B2:B9)", "C2": "=B2*2", "C5": "=B5*2", "C9": "=B9*2", "D1": "=SUM(B2:B9)", "D2": "=$B$5",
             "D3": "=B$5+$B5", "D4": "=SUBTOTAL(109,B2:B9)", "D5": "=AVERAGE(B4:B6)", "D6": "=B10/2"})
COLS = dict(("%s2" % c, str(i + 1)) for i, c in enumerate("ABCDEF"))
COLS.update({"G2": "=SUM(A2:F2)", "A3": "=C2*2", "B3": "=SUM(B2:D2)", "C3": "=$C$2", "D3": "=SUM(A2:B2)",
             "E3": "=F2-E2", "A4": "=C2+D2", "F4": "=SUM(C2:E2)", "A1": "a", "C1": "c", "F1": "f"})
SUBT = {"B1": "Amount", "B2": "1", "B3": "2", "B4": "4", "B5": "8", "B6": "16"}
NUMS = {"B2": "1234.5", "B3": "0.5", "B4": "7", "C2": "0.125", "C3": "3.14159", "C4": "45000", "C5": "1234567.8"}

# ================================================================ claim 1: selecting by dragging
case("S01", 1, "drag from B2 to D5 over empty and filled cells", "B2:D5 is selected, B2 active, no page text selected", "high",
     SMALL, [("drag", "B2", "D5")], {"sel": ("cells", "B2:D5"), "active": "B2", "notext": True})
case("S02", 1, "drag from D5 back up to B2", "B2:D5 is selected, D5 (where the drag began) is active", "medium",
     SMALL, [("drag", "D5", "B2")], {"sel": ("cells", "B2:D5"), "active": "D5", "notext": True})
case("S03", 1, "drag from A1 to B4 over cells full of words and numbers", "A1:B4 selected, no text selected", "high",
     SMALL, [("drag", "A1", "B4")], {"sel": ("cells", "A1:B4"), "notext": True})
case("S04", 1, "drag B2 to C3, then a second drag E5 to F8", "the second drag replaces the first: E5:F8, E5 active", "high",
     SMALL, [("drag", "B2", "C3"), ("drag", "E5", "F8")], {"sel": ("cells", "E5:F8"), "active": "E5", "notext": True})
case("S05", 1, "three drags in a row, the last A1 to A3", "A1:A3 selected, no text selected after any of them", "high",
     SMALL, [("drag", "B2", "D4"), ("drag", "C1", "C6"), ("drag", "A1", "A3")], {"sel": ("cells", "A1:A3"), "notext": True})
case("S06", 1, "drag B2 to D5, then click F7", "the click selects F7 alone", "medium",
     SMALL, [("drag", "B2", "D5"), ("click", "F7")], {"sel": ("cells", "F7"), "active": "F7"})
case("S07", 1, "press and release the mouse on C3 without moving off it", "C3 alone", "medium",
     SMALL, [("drag", "C3", "C3")], {"sel": ("cells", "C3"), "active": "C3"})
case("S08", 1, "drag down the row numbers from 2 to 5", "rows 2 to 5 selected, their numbers shaded in full", "high",
     SMALL, [("drag", "r2", "r5")], {"sel": ("rows", 2, 5), "rowhead": {1: "", 2: "hsel", 5: "hsel", 6: ""}, "notext": True})
case("S09", 1, "drag up the row numbers from 6 to 3", "rows 3 to 6", "medium",
     SMALL, [("drag", "r6", "r3")], {"sel": ("rows", 3, 6)})
case("S10", 1, "drag across the column letters from B to D", "columns B to D, their letters shaded in full", "high",
     SMALL, [("drag", "cB", "cD")], {"sel": ("cols", "B", "D"), "colhead": {"A": "", "B": "hsel", "D": "hsel", "E": ""}, "notext": True})
case("S11", 1, "drag across the column letters from E back to C", "columns C to E", "medium",
     SMALL, [("drag", "cE", "cC")], {"sel": ("cols", "C", "E")})
case("S12", 1, "click row number 2, Shift+click row number 6", "rows 2 to 6", "medium",
     SMALL, [("click", "r2"), ("click", "r6", ["Shift"])], {"sel": ("rows", 2, 6)})
case("S13", 1, "click column letter B, Shift+click E", "columns B to E", "medium",
     SMALL, [("click", "cB"), ("click", "cE", ["Shift"])], {"sel": ("cols", "B", "E")})
case("S14", 1, "click cell B3, then Shift+click row number 6", "whole rows 3 to 6 (from the active cell's row), B3 stays active", "medium",
     SMALL, [("click", "B3"), ("click", "r6", ["Shift"])], {"sel": ("rows", 3, 6), "active": "B3"})
case("S15", 1, "click cell C2, then Shift+click column letter E", "whole columns C to E, C2 stays active", "medium",
     SMALL, [("click", "C2"), ("click", "cE", ["Shift"])], {"sel": ("cols", "C", "E"), "active": "C2"})
case("S16", 1, "click the corner above row 1", "the whole sheet; every row number and column letter shaded in full", "low",
     SMALL, [("click", "corner")], {"sel": ("all",), "rowhead": {1: "hsel", 40: "hsel"}, "colhead": {"A": "hsel", "Z": "hsel"}})
case("S17", 1, "drag B2 to C4, press Shift+Space", "whole rows 2 to 4", "medium",
     SMALL, [FOCUS, ("drag", "B2", "C4"), ("key", "Shift+Space")], {"sel": ("rows", 2, 4)})
case("S18", 1, "drag B2 to C4, press Ctrl+Space", "whole columns B and C", "medium",
     SMALL, [FOCUS, ("drag", "B2", "C4"), ("key", "Control+Space")], {"sel": ("cols", "B", "C")})
case("S19", 1, "click C3, Shift+Space", "row 3, C3 still active", "medium",
     SMALL, [("click", "C3"), ("key", "Shift+Space")], {"sel": ("rows", 3, 3), "active": "C3"})
case("S20", 1, "click C3, Ctrl+Space", "column C, C3 still active", "medium",
     SMALL, [("click", "C3"), ("key", "Control+Space")], {"sel": ("cols", "C", "C"), "active": "C3"})
case("S21", 1, "drag B2 to D4 and look at the headers", "letters B-D and numbers 2-4 lightly shaded, the others not", "low",
     SMALL, [("drag", "B2", "D4")], {"colhead": {"A": "", "B": "hon", "D": "hon", "E": ""}, "rowhead": {1: "", 2: "hon", 4: "hon", 5: ""}})
case("S22", 1, "click row number 3 and look at the headers", "row 3's number in full, every column letter lightly", "low",
     SMALL, [("click", "r3")], {"rowhead": {2: "", 3: "hsel", 4: ""}, "colhead": {"A": "hon", "M": "hon"}})
case("S23", 1, "click column letter C and look at the headers", "C in full, every row number lightly", "low",
     SMALL, [("click", "cC")], {"colhead": {"B": "", "C": "hsel", "D": ""}, "rowhead": {1: "hon", 20: "hon"}})
case("S24", 1, "in D2 type =SUM( then drag over B2 to B4", "the formula being typed reads =SUM(B2:B4", "high",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B2", "B4")], {"editor": "=SUM(B2:B4"})
case("S25", 1, "in D2 type =SUM(, drag B2 to B4, type ) and Enter", "D2 holds =SUM(B2:B4) and shows 8", "high",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B2", "B4"), ("type", ")"), ("key", "Enter")],
     {"raw": {"D2": "=SUM(B2:B4)"}, "vals": {"D2": 8}})
case("S26", 1, "in D3 type =, click B3, type *2 and Enter", "D3 holds =B3*2 (10)", "high",
     SMALL, [("click", "D3"), ("type", "="), ("click", "B3"), ("type", "*2"), ("key", "Enter")], {"raw": {"D3": "=B3*2"}, "vals": {"D3": 10}})
case("S27", 1, "in E2 type =SUM(, drag B2:B4, type a comma, drag C2:C4, type ) and Enter", "=SUM(B2:B4,C2:C4)", "medium",
     SMALL, [("click", "E2"), ("type", "=SUM("), ("drag", "B2", "B4"), ("type", ","), ("drag", "C2", "C4"), ("type", ")"), ("key", "Enter")],
     {"raw": {"E2": "=SUM(B2:B4,C2:C4)"}, "vals": {"E2": 14}})
case("S28", 1, "in D2 type =SUM(, drag upwards from B4 to B2, type ) and Enter", "=SUM(B2:B4) (Excel writes the range top-left first)", "low",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B4", "B2"), ("type", ")"), ("key", "Enter")], {"raw": {"D2": "=SUM(B2:B4)"}, "vals": {"D2": 8}})
case("S29", 1, "click D2, click into the formula bar, type =SUM(, drag B2 to B4, type ) and Enter", "D2 holds =SUM(B2:B4)", "medium",
     SMALL, [("click", "D2"), ("click", "editor"), ("type", "=SUM("), ("drag", "B2", "B4"), ("type", ")"), ("key", "Enter")],
     {"raw": {"D2": "=SUM(B2:B4)"}})
case("S30", 1, "in D2 type =SUM(, drag B2 to B4, then Escape", "the edit is dropped: D2 stays empty", "low",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B2", "B4"), ("key", "Escape")], {"raw": {"D2": None}})
case("S31", 1, "drag B2 to C3, type 7 and Enter", "only the active cell B2 gets 7", "high",
     SMALL, [FOCUS, ("drag", "B2", "C3"), ("type", "7"), ("key", "Enter")], {"raw": {"B2": "7", "B3": "5", "C3": None, "C2": "=B2*3"}})
case("S32", 1, "drag B2 to C3, type 7 and Enter", "the selection stays B2:C3 and B3 becomes active", "low",
     SMALL, [FOCUS, ("drag", "B2", "C3"), ("type", "7"), ("key", "Enter")], {"sel": ("cells", "B2:C3"), "active": "B3"})
case("S33", 1, "drag B2 to C3 and press Delete", "all four cells emptied", "high",
     SMALL, [FOCUS, ("drag", "B2", "C3"), ("key", "Delete")], {"raw": {"B2": None, "B3": None, "C2": None, "A2": "rice", "B4": "1"}})
case("S34", 1, "drag A1 to B2, then Shift+Down", "A1:B3", "medium",
     SMALL, [FOCUS, ("drag", "A1", "B2"), ("key", "Shift+ArrowDown")], {"sel": ("cells", "A1:B3")})
case("S35", 1, "merge B2:C3 (Format Cells), then drag from A1 onto the merged cell", "the selection takes the whole merged cell: A1:C3", "medium",
     {"A1": "x"}, [*MERGE("B2", "C3"), ("drag", "A1", "B2")],
     {"sel": ("cells", "A1:C3")})
case("S36", 1, "drag from row number 2 and let the pointer drift onto cell C5", "rows 2 to 5 (Excel keeps selecting whole rows)", "low",
     SMALL, [("drag", "r2", "C5")], {"sel": ("rows", 2, 5)})
case("S37", 1, "drag from column letter B and let the pointer drift down onto D5", "columns B to D", "low",
     SMALL, [("drag", "cB", "D5")], {"sel": ("cols", "B", "D")})
case("S38", 1, "drag A1 to C4, Ctrl+C, click E1, Ctrl+V", "the block is pasted at E1:G4, formulas moved (=F2*3)", "medium",
     SMALL, [FOCUS, ("drag", "A1", "C4"), ("key", "Control+c"), ("click", "E1"), ("key", "Control+v"), ("wait", 300)],
     {"raw": {"E1": "Item", "F2": "2", "G2": "=F2*3", "E4": "oil", "F4": "1"}})
case("S39", 1, "open a sheet, drag B2 to C3 (the first thing done), press Delete", "the four cells are emptied", "high",
     SMALL, [("drag", "B2", "C3"), ("key", "Delete")], {"raw": {"B2": None, "B3": None, "C2": None}})
case("S40", 1, "open a sheet, drag B2 to C4 first thing, press Shift+Space", "rows 2 to 4", "medium",
     SMALL, [("drag", "B2", "C4"), ("key", "Shift+Space")], {"sel": ("rows", 2, 4)})
case("S41", 1, "open a sheet, drag B2 to C3 first thing, press Ctrl+1", "Format Cells opens", "medium",
     SMALL, [("drag", "B2", "C3"), ("key", "Control+1")], {"dlg": "Format Cells"})
case("S42", 1, "open a sheet, drag B2 to C3 first thing, press Ctrl+C, click E1, Ctrl+V", "the block is copied to E1:F2", "high",
     SMALL, [("drag", "B2", "C3"), ("key", "Control+c"), ("click", "E1"), ("key", "Control+v"), ("wait", 300)], {"raw": {"E1": "2", "F1": "=E1*3", "E2": "5"}})
case("S43", 3, "right-click C3, Insert..., OK; then press Down", "the dialog gives the keyboard back to the sheet: C4 active", "medium",
     SMALL, [("rclick", "C3"), ("pick", INS), ("ok",), ("key", "ArrowDown")], {"active": "C4"})
case("S44", 6, "right-click row number 3, Row Height 30, OK; then press Down", "the keyboard is back on the sheet: A4 active", "medium",
     SMALL, [("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",), ("key", "ArrowDown")], {"active": "A4"})
case("S45", 2, "right-click C3, Clear Contents from the menu... on an empty cell; then type 9 and Enter", "9 goes into C3", "medium",
     SMALL, [("rclick", "C3"), ("pick", "Clear Contents"), ("type", "9"), ("key", "Enter")], {"raw": {"C3": "9"}})
case("S46", 1, "click K20, drag B2 to C3, type 7 (no Enter), then press Tab", "7 is entered in B2 and C2 becomes active (Tab moves within the selection)", "low",
     SMALL, [FOCUS, ("drag", "B2", "C3"), ("type", "7"), ("key", "Tab")], {"raw": {"B2": "7"}, "active": "C2", "sel": ("cells", "B2:C3")})
case("S47", 1, "in D2 type =SUM(, click B2 (no drag), type ) and Enter", "D2 holds =SUM(B2), B2 untouched", "high",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("click", "B2"), ("type", ")"), ("key", "Enter")], {"raw": {"D2": "=SUM(B2)", "B2": "2"}, "vals": {"D2": 2}})
case("S48", 1, "in D3 type =, click B3, press Enter", "D3 holds =B3 (5); B3 untouched", "high",
     SMALL, [("click", "D3"), ("type", "="), ("click", "B3"), ("key", "Enter")], {"raw": {"D3": "=B3", "B3": "5"}})
case("S49", 1, "in D3 type =B2+, then drag B3 to B4", "the formula being typed reads =B2+B3:B4", "medium",
     SMALL, [("click", "D3"), ("type", "=B2+"), ("drag", "B3", "B4")], {"editor": "=B2+B3:B4"})
case("S51", 1, "merge A3:B5, then click row number 4", "row 4 alone (a whole-row selection is not widened by a merged cell; excel.tips.net T003093: clicking a column heading crossing a merged cell selects only that column)", "medium",
     {"A3": "m"}, [*MERGE("A3", "B5"), ("click", "r4")], {"sel": ("rows", 4, 4)})
case("S52", 1, "go back to the list of sheets, open the sheet by its name, drag B2 to C3, press Delete", "the cells are emptied", "high",
     SMALL, [("clicktext", "← Sheets"), ("clicktext", "Grid"), ("drag", "B2", "C3"), ("key", "Delete")], {"raw": {"B2": None, "B3": None, "C2": None}})
case("S53", 1, "in D2 type =SUM(, drag B2 to B3, then drag C2 to C4 (meant the other column)", "the second range replaces the first: =SUM(C2:C4", "medium",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B2", "B3"), ("drag", "C2", "C4")], {"editor": "=SUM(C2:C4"})
case("S54", 1, "in D3 type =1+, click B3, Enter", "=1+B3 (6)", "high",
     SMALL, [("click", "D3"), ("type", "=1+"), ("click", "B3"), ("key", "Enter")], {"raw": {"D3": "=1+B3", "B3": "5"}, "vals": {"D3": 6}})
case("S50", 1, "in D2 type =SUM(, drag B2 to B3, then drag again B2 to B4 (changed mind)", "the second drag replaces the first: =SUM(B2:B4", "medium",
     SMALL, [("click", "D2"), ("type", "=SUM("), ("drag", "B2", "B3"), ("drag", "B2", "B4")], {"editor": "=SUM(B2:B4"})

# ================================================================ claim 2: the right-click menus
case("M01", 2, "right-click C3 while A1 is active", "the cell menu; C3 is selected first", "high",
     SMALL, [("rclick", "C3")], {"menu": CELLMENU, "sel": ("cells", "C3"), "active": "C3"})
case("M02", 2, "drag B2 to D4, right-click C3 (inside it)", "the selection stays B2:D4, B2 active", "high",
     SMALL, [("drag", "B2", "D4"), ("rclick", "C3")], {"menu": CELLMENU, "sel": ("cells", "B2:D4"), "active": "B2"})
case("M03", 2, "drag B2 to D4, right-click F6 (outside it)", "F6 is selected", "medium",
     SMALL, [("drag", "B2", "D4"), ("rclick", "F6")], {"menu": CELLMENU, "sel": ("cells", "F6")})
case("M04", 2, "right-click row number 3", "row 3 selected, the row menu", "high",
     SMALL, [("rclick", "r3")], {"menu": ROWMENU, "sel": ("rows", 3, 3)})
case("M05", 2, "right-click column letter C", "column C selected, the column menu (Column Width...)", "high",
     SMALL, [("rclick", "cC")], {"menu": COLMENU, "sel": ("cols", "C", "C")})
case("M06", 2, "drag rows 2 to 5, right-click row number 4", "rows 2 to 5 stay selected", "high",
     SMALL, [("drag", "r2", "r5"), ("rclick", "r4")], {"menu": ROWMENU, "sel": ("rows", 2, 5)})
case("M07", 2, "drag rows 2 to 5, right-click row number 8", "row 8 alone", "medium",
     SMALL, [("drag", "r2", "r5"), ("rclick", "r8")], {"menu": ROWMENU, "sel": ("rows", 8, 8)})
case("M08", 2, "drag cells B2 to C4, right-click row number 3", "row 3 is not wholly selected, so row 3 is selected", "medium",
     SMALL, [("drag", "B2", "C4"), ("rclick", "r3")], {"menu": ROWMENU, "sel": ("rows", 3, 3)})
case("M09", 2, "drag column letters B to D, right-click C", "columns B to D stay selected", "medium",
     SMALL, [("drag", "cB", "cD"), ("rclick", "cC")], {"menu": COLMENU, "sel": ("cols", "B", "D")})
case("M10", 2, "right-click C3, press Escape", "the menu closes, C3 stays selected", "medium",
     SMALL, [("rclick", "C3"), ("key", "Escape")], {"menu": None, "sel": ("cells", "C3")})
case("M11", 2, "right-click C3, then left-click E5", "the menu closes", "medium",
     SMALL, [("rclick", "C3"), ("click", "E5")], {"menu": None})
case("M12", 2, "click C3, press the menu key", "the cell menu for C3", "medium",
     SMALL, [("click", "C3"), ("key", "ContextMenu")], {"menu": CELLMENU, "sel": ("cells", "C3")})
case("M13", 2, "click C3, press Shift+F10", "the cell menu for C3", "medium",
     SMALL, [("click", "C3"), ("key", "Shift+F10")], {"menu": CELLMENU})
case("M14", 2, "click row number 3, press Shift+F10", "Excel shows the row menu for a whole-row selection", "low",
     SMALL, [("click", "r3"), ("key", "Shift+F10")], {"menu": ROWMENU}, unjudged=True)
case("M15", 2, "drag row numbers 2 to 4, right-click cell C3, choose Insert...", "three whole rows are inserted at once, no dialog", "high",
     ROWS, [("drag", "r2", "r4"), ("rclick", "C3"), ("pick", INS)], {"dlg": None, "lo": True}, lo=[("ins", "A2:A4", "rows")])
case("M16", 2, "drag column letters B to C, right-click C3, choose Delete...", "columns B and C are deleted at once, no dialog", "high",
     COLS, [("drag", "cB", "cC"), ("rclick", "C3"), ("pick", DEL)], {"dlg": None, "lo": True}, lo=[("del", "B1:C1", "cols")])
case("M17", 2, "right-click B2 (=A2*2), Copy; right-click C3, Paste", "C3 gets =B3*2", "medium",
     {"A2": "5", "B2": "=A2*2", "B3": "4"}, [("rclick", "B2"), ("pick", "Copy"), ("rclick", "C3"), ("pick", "Paste"), ("wait", 300)],
     {"raw": {"B2": "=A2*2", "C3": "=B3*2"}, "vals": {"C3": 8}})
case("M18", 2, "right-click B2 (=A2*2), Cut; right-click D5, Paste", "the formula moves unchanged: D5 =A2*2, B2 empty", "medium",
     {"A2": "5", "B2": "=A2*2"}, [("rclick", "B2"), ("pick", "Cut"), ("rclick", "D5"), ("pick", "Paste"), ("wait", 300)],
     {"raw": {"B2": None, "D5": "=A2*2"}, "vals": {"D5": 10}})
case("M19", 2, "drag B2 to C3, right-click, Clear Contents", "B2, B3, C2 emptied; the rest kept", "high",
     SMALL, [("drag", "B2", "C3"), ("rclick", "C3"), ("pick", "Clear Contents")],
     {"raw": {"B2": None, "B3": None, "C2": None, "A2": "rice", "B4": "1"}})
case("M20", 2, "right-click row number 2, Clear Contents", "row 2 emptied, row 3 kept", "high",
     SMALL, [("rclick", "r2"), ("pick", "Clear Contents")], {"raw": {"A2": None, "B2": None, "C2": None, "A3": "beans", "B3": "5"}})
case("M21", 2, "make B2 bold (Format Cells), Clear Contents, then type x in B2", "Clear Contents keeps the format: x is bold", "low",
     SMALL, [("rclick", "B2"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "B2"), ("pick", "Clear Contents"),
             ("click", "B2"), ("type", "x"), ("key", "Enter")], {"raw": {"B2": "x"}, "bold": {"B2": True}})
case("M22", 2, "Name/Qty table, right-click A3 (one cell), Sort A to Z", "the table is sorted by Name under its header row", "medium",
     {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "9", "A4": "fig", "B4": "1"},
     [("rclick", "A3"), ("pick", "Sort A to Z")],
     {"cells_exact": {"A1": "Name", "B1": "Qty", "A2": "apple", "B2": "9", "A3": "fig", "B3": "1", "A4": "pear", "B4": "3"}})
case("M23", 2, "drag A2 to B4, right-click inside, Sort Z to A", "rows sorted by column A, Z first", "medium",
     {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "9", "A4": "fig", "B4": "1"},
     [("drag", "A2", "B4"), ("rclick", "A3"), ("pick", "Sort Z to A")],
     {"cells_exact": {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "fig", "B3": "1", "A4": "apple", "B4": "9"}})
case("M24", 2, "drag from B4 to A2 (B4 active), right-click inside, Sort A to Z", "sorted by the active cell's column B", "low",
     {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "9", "A4": "fig", "B4": "1"},
     [("drag", "B4", "A2"), ("rclick", "A3"), ("pick", "Sort A to Z")],
     {"cells_exact": {"A1": "Name", "B1": "Qty", "A2": "fig", "B2": "1", "A3": "pear", "B3": "3", "A4": "apple", "B4": "9"}})
case("M25", 2, "table with C = B*2 on each row; right-click A3, Sort A to Z", "each row's formula still doubles its own row", "medium",
     {"A1": "Name", "B1": "Qty", "C1": "Double", "A2": "pear", "B2": "3", "C2": "=B2*2", "A3": "apple", "B3": "9", "C3": "=B3*2",
      "A4": "fig", "B4": "1", "C4": "=B4*2"}, [("rclick", "A3"), ("pick", "Sort A to Z")],
     {"raw": {"A2": "apple", "A3": "fig", "A4": "pear"}, "vals": {"C2": 18, "C3": 2, "C4": 6}})
case("M26", 2, "A2:A5 = 10, pear, 2, apple; select them, Sort A to Z", "numbers before words, numbers by value: 2, 10, apple, pear", "medium",
     {"A2": "10", "A3": "pear", "A4": "2", "A5": "apple"}, [("drag", "A2", "A5"), ("rclick", "A3"), ("pick", "Sort A to Z")],
     {"raw": {"A2": "2", "A3": "10", "A4": "apple", "A5": "pear"}})
case("M27", 2, "right-click a cell near the bottom right of the window (O29)", "the menu opens wholly on screen", "medium",
     SMALL, [("rclick", "O29")], {"menu": CELLMENU, "menu_on_screen": True})
case("M28", 2, "right-click C3, Escape, right-click D4", "a menu again, for D4", "medium",
     SMALL, [("rclick", "C3"), ("key", "Escape"), ("rclick", "D4")], {"menu": CELLMENU, "sel": ("cells", "D4")})
case("M29", 2, "right-click C3, choose Insert...", "the Insert dialog opens", "high",
     SMALL, [("rclick", "C3"), ("pick", INS)], {"dlg": "Insert", "menu": None})
case("M30", 2, "right-click row number 3, Format Cells...", "the Format Cells dialog opens", "medium",
     SMALL, [("rclick", "r3"), ("pick", FMT)], {"dlg": "Format Cells"})

# ================================================================ claim 3: Insert... / Delete... cells
case("D01", 3, "click C3, Ctrl++", "the Insert dialog, Shift cells down chosen", "medium",
     FORMS_C, [("click", "C3"), ("key", CTRLPLUS)], {"dlg": "Insert", "dlg_checked": "Shift cells down"})
case("D02", 3, "select the tall range B2:B5, Ctrl++", "Excel guesses from the shape: Shift cells right", "low",
     FORMS_C, [FOCUS, ("drag", "B2", "B5"), ("key", CTRLPLUS)], {"dlg": "Insert", "dlg_checked": "Shift cells right"})
case("D03", 3, "select the wide range B2:E2, Ctrl++", "Shift cells down", "low",
     FORMS_C, [FOCUS, ("drag", "B2", "E2"), ("key", CTRLPLUS)], {"dlg": "Insert", "dlg_checked": "Shift cells down"})
case("D04", 3, "click C3, Ctrl+-", "the Delete dialog, Shift cells up chosen", "medium",
     FORMS_C, [("click", "C3"), ("key", CTRLMINUS)], {"dlg": "Delete", "dlg_checked": "Shift cells up"})
case("D05", 3, "select the tall range B2:B5, Ctrl+-", "Shift cells left", "low",
     FORMS_C, [FOCUS, ("drag", "B2", "B5"), ("key", CTRLMINUS)], {"dlg": "Delete", "dlg_checked": "Shift cells left"})
case("D06", 3, "select the wide range B2:E2, Ctrl+-", "Shift cells up", "low",
     FORMS_C, [FOCUS, ("drag", "B2", "E2"), ("key", CTRLMINUS)], {"dlg": "Delete", "dlg_checked": "Shift cells up"})
case("D07", 3, "right-click C3, Insert..., Shift cells down, OK", "column C from row 3 moves down one; formulas follow", "high",
     FORMS_C, [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "down")])
case("D08", 3, "right-click C3, Insert..., Shift cells right, OK", "row 3 from column C moves right one; formulas follow", "high",
     FORMS_R, [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells right"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "right")])
case("D09", 3, "right-click C3, Delete..., Shift cells up, OK", "C3 goes, the cells below move up; =C3 becomes #REF!", "high",
     FORMS_C, [("rclick", "C3"), ("pick", DEL), ("radio", "Shift cells up"), ("ok",)], {"lo": True}, lo=[("del", "C3", "up")])
case("D10", 3, "right-click B3, Delete..., Shift cells left, OK", "B3 goes, the row moves left; formulas follow", "high",
     FORMS_R, [("rclick", "B3"), ("pick", DEL), ("radio", "Shift cells left"), ("ok",)], {"lo": True}, lo=[("del", "B3", "left")])
case("D11", 3, "right-click C3, Insert..., Entire row, OK", "a whole row 3 is inserted", "high",
     FORMS_C, [("rclick", "C3"), ("pick", INS), ("radio", "Entire row"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "rows")])
case("D12", 3, "right-click C3, Insert..., Entire column, OK", "a whole column C is inserted", "high",
     FORMS_R, [("rclick", "C3"), ("pick", INS), ("radio", "Entire column"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "cols")])
case("D13", 3, "right-click C3, Delete..., Entire row, OK", "row 3 deleted; references to it #REF!", "high",
     FORMS_C, [("rclick", "C3"), ("pick", DEL), ("radio", "Entire row"), ("ok",)], {"lo": True}, lo=[("del", "C3", "rows")])
case("D14", 3, "right-click C3, Delete..., Entire column, OK", "column C deleted; references to it #REF!", "high",
     FORMS_R, [("rclick", "C3"), ("pick", DEL), ("radio", "Entire column"), ("ok",)], {"lo": True}, lo=[("del", "C3", "cols")])
case("D15", 3, "select B2:C2, Insert..., Shift cells down", "columns B and C move down from row 2", "high",
     FORMS_BC, [("drag", "B2", "C2"), ("rclick", "B2"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "B2:C2", "down")])
case("D16", 3, "select B2:C3, Insert..., Shift cells down", "two cells' depth inserted in B and C", "high",
     FORMS_BC, [("drag", "B2", "C3"), ("rclick", "B2"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "B2:C3", "down")])
case("D17", 3, "select C3:C5, Insert..., Shift cells down", "three cells inserted in C", "high",
     FORMS_C, [("drag", "C3", "C5"), ("rclick", "C4"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "C3:C5", "down")])
case("D18", 3, "select B2:C3, Delete..., Shift cells up", "four cells removed, the rest of B and C moves up", "high",
     FORMS_BC, [("drag", "B2", "C3"), ("rclick", "B2"), ("pick", DEL), ("radio", "Shift cells up"), ("ok",)], {"lo": True}, lo=[("del", "B2:C3", "up")])
case("D19", 3, "select B3:D3, Delete..., Shift cells left", "three cells removed from row 3", "high",
     FORMS_R, [("drag", "B3", "D3"), ("rclick", "C3"), ("pick", DEL), ("radio", "Shift cells left"), ("ok",)], {"lo": True}, lo=[("del", "B3:D3", "left")])
case("D20", 3, "right-click C3, Insert..., Cancel", "nothing changes", "medium",
     FORMS_C, [("rclick", "C3"), ("pick", INS), ("cancel",)], {"cells_exact": FORMS_C, "dlg": None})
case("D21", 3, "click C3, Ctrl++, press Enter", "Enter is OK: cells shift down", "medium",
     FORMS_C, [("click", "C3"), ("key", CTRLPLUS), ("key", "Enter")], {"lo": True, "dlg": None}, lo=[("ins", "C3", "down")])
case("D22", 3, "click C3, Ctrl++, Shift cells right, OK", "row 3 moves right", "high",
     FORMS_R, [("click", "C3"), ("key", CTRLPLUS), ("radio", "Shift cells right"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "right")])
case("D23", 3, "click C3, Ctrl+-, Entire row, OK", "row 3 deleted", "high",
     FORMS_C, [("click", "C3"), ("key", CTRLMINUS), ("radio", "Entire row"), ("ok",)], {"lo": True}, lo=[("del", "C3", "rows")])
case("D24", 3, "C100 holds a value, G1 =C100; insert at C3 shifting down", "the value moves to C101, G1 becomes =C101", "medium",
     dict(BLOCK, **{"C100": "end", "G1": "=C100"}), [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"lo": True}, lo=[("ins", "C3", "down")])
case("D25", 3, "Z1 holds a value; right-click B1, Insert..., Shift cells right", "the value moves to AA1", "medium",
     {"A1": "1", "B1": "2", "Z1": "z"}, [("rclick", "B1"), ("pick", INS), ("radio", "Shift cells right"), ("ok",)],
     {"lo": True}, lo=[("ins", "B1", "right")])
case("D26", 3, "G1 is typed in small letters, =sum(c1:c5); insert at C3 shifting down", "=SUM(C1:C6)", "medium",
     dict(BLOCK, G1="=sum(c1:c5)"), [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"lo": True}, lo=[("ins", "C3", "down")])
case("D27", 3, "G1 =SUM(C:C); insert at C3 shifting down", "=SUM(C:C) unchanged, same total", "low",
     dict(BLOCK, G1="=SUM(C:C)"), [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"lo": True}, lo=[("ins", "C3", "down")])
case("D28", 3, "G1 =SUM(C3:C4); select C3:C4, Delete..., Shift cells up", "=SUM(#REF!)", "high",
     dict(BLOCK, G1="=SUM(C3:C4)", G2="=C5"), [("drag", "C3", "C4"), ("rclick", "C3"), ("pick", DEL), ("radio", "Shift cells up"), ("ok",)],
     {"lo": True}, lo=[("del", "C3:C4", "up")])
case("D29", 3, "C3 bold; insert at C3 shifting down", "the bold cell moves to C4", "medium",
     FORMS_C, [("rclick", "C3"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"bold": {"C4": True, "C5": False}})
case("D30", 3, "B3 bold; insert at B3 shifting right", "the bold cell moves to C3", "medium",
     FORMS_R, [("rclick", "B3"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "B3"), ("pick", INS), ("radio", "Shift cells right"), ("ok",)],
     {"bold": {"C3": True, "D3": False}})
case("D31", 3, "C4 bold; delete C3 shifting up", "the bold cell moves up to C3", "medium",
     FORMS_C, [("rclick", "C4"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "C3"), ("pick", DEL), ("radio", "Shift cells up"), ("ok",)],
     {"bold": {"C3": True, "C4": False}})
case("D32", 4, "merge C5:C6; insert at C3 shifting down (the merged cell lies wholly in column C)", "it moves to C6:C7", "medium",
     FORMS_C, [*MERGE("C5", "C6"), ("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"merged": {"C6": [1, 2], "C5": [1, 1]}})
case("D33", 4, "merge B5:C6; insert at C3 shifting down (only column C would move)", "refused, with a message; nothing moves", "medium",
     dict(BLOCK, G1="=C3"), [*MERGE("B5", "C6"),
                             ("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"msg": "merged cell", "raw": {"C3": "33", "C4": "43", "G1": "=C3"}, "merged": {"B5": [2, 2]}})
case("D34", 4, "merge C2:C4; delete B3 shifting left (row 3 would move under half the merged cell)", "refused, with a message", "medium",
     dict(BLOCK, G1="=D3"), [*MERGE("C2", "C4"),
                             ("rclick", "B3"), ("pick", DEL), ("radio", "Shift cells left"), ("ok",)],
     {"msg": "merged cell", "raw": {"B3": "32", "D3": "34", "G1": "=D3"}, "merged": {"C2": [1, 3]}})
case("D35", 4, "merge D3:E3; insert at B3 shifting right", "the merged cell moves to E3:F3", "medium",
     dict(BLOCK), [*MERGE("D3", "E3"),
                   ("rclick", "B3"), ("pick", INS), ("radio", "Shift cells right"), ("ok",)], {"merged": {"E3": [2, 1], "D3": [1, 1]}})
case("D36", 4, "merge C1:C2 (above the insert); insert at C3 shifting down", "allowed, the merge stays at C1:C2", "medium",
     dict(BLOCK, G1="=C3"), [*MERGE("C1", "C2"),
                             ("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)],
     {"merged": {"C1": [1, 2]}, "raw": {"C4": "33", "G1": "=C4"}})
case("D37", 4, "merge B5:C6; select B3:C3, insert shifting down (B and C both move)", "allowed: the merged cell moves to B6:C7", "medium",
     dict(BLOCK), [*MERGE("B5", "C6"),
                   ("drag", "B3", "C3"), ("rclick", "B3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"merged": {"B6": [2, 2], "B5": [1, 1]}})
case("D38", 3, "absolute and mixed references, insert at C3 shifting down", "$C$3 -> $C$4, C$3 -> C$4, $C3 -> $C4", "high",
     dict(BLOCK, **{"G1": "=$C$3", "G2": "=C$3", "G3": "=$C3", "G4": "=$C$2", "G5": "=SUM($C$1:$C$5)"}),
     [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "down")])
case("D39", 3, "B4 and B5 referenced; delete B2:B3 shifting up", "=B4 -> =B2, =B2 -> #REF!", "high",
     dict(BLOCK, **{"G1": "=B4", "G2": "=B2", "G3": "=SUM(B1:B6)", "G4": "=SUM(A1:B6)"}),
     [("drag", "B2", "B3"), ("rclick", "B2"), ("pick", DEL), ("radio", "Shift cells up"), ("ok",)], {"lo": True}, lo=[("del", "B2:B3", "up")])
case("D40", 3, "delete C3:D3 shifting left", "=SUM(A3:E3) -> =SUM(A3:C3); =E3 -> =C3", "high",
     dict(BLOCK, **{"G1": "=SUM(A3:E3)", "G2": "=E3", "G3": "=D3", "G4": "=SUM(C3:D3)", "G5": "=SUM(B2:E4)"}),
     [("drag", "C3", "D3"), ("rclick", "C3"), ("pick", DEL), ("radio", "Shift cells left"), ("ok",)], {"lo": True}, lo=[("del", "C3:D3", "left")])
case("D41", 3, "functions with digits in their names, insert at C3 shifting down", "=ATAN2(C3,1) -> =ATAN2(C4,1); =LOG10(C3) -> =LOG10(C4)", "medium",
     dict(BLOCK, **{"G1": "=ATAN2(C3,1)", "G2": "=LOG10(C3)", "G3": "=DAYS360(C1,C3)", "G4": "=ROUND(C3/7,2)"}),
     [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "down")])
case("D42", 3, "a range starting just below the insert, and one ending just above it", "C4:C6 -> C5:C7; C1:C2 stays", "high",
     dict(BLOCK, **{"G1": "=SUM(C4:C6)", "G2": "=SUM(C1:C2)", "G3": "=SUM(C3:C3)", "G4": "=AVERAGE(C2:C4)"}),
     [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",)], {"lo": True}, lo=[("ins", "C3", "down")])

# ================================================================ claim 4: whole rows and columns
case("R01", 4, "right-click row number 5, Insert", "a row above 5; =SUM(B2:B9) -> =SUM(B2:B10)", "high",
     ROWS, [("rclick", "r5"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A5", "rows")])
case("R02", 4, "drag row numbers 3 to 5, right-click 4, Insert", "three rows above row 3", "high",
     ROWS, [("drag", "r3", "r5"), ("rclick", "r4"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A3:A5", "rows")])
case("R03", 4, "right-click row number 5, Delete", "row 5 goes; =B5*2 elsewhere is #REF!", "high",
     ROWS, [("rclick", "r5"), ("pick", "Delete")], {"lo": True}, lo=[("del", "A5", "rows")])
case("R04", 4, "drag row numbers 3 to 4, right-click 3, Delete", "two rows go; ranges shrink", "high",
     ROWS, [("drag", "r3", "r4"), ("rclick", "r3"), ("pick", "Delete")], {"lo": True}, lo=[("del", "A3:A4", "rows")])
case("R05", 4, "right-click column letter C, Insert", "a column left of C; formulas follow", "high",
     COLS, [("rclick", "cC"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "C1", "cols")])
case("R06", 4, "drag column letters B to C, right-click B, Insert", "two columns left of B", "high",
     COLS, [("drag", "cB", "cC"), ("rclick", "cB"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "B1:C1", "cols")])
case("R07", 4, "right-click column letter C, Delete", "column C goes", "high",
     COLS, [("rclick", "cC"), ("pick", "Delete")], {"lo": True}, lo=[("del", "C1", "cols")])
case("R08", 4, "drag column letters C to D, Delete", "columns C and D go", "high",
     COLS, [("drag", "cC", "cD"), ("rclick", "cC"), ("pick", "Delete")], {"lo": True}, lo=[("del", "C1:D1", "cols")])
case("R09", 4, "click row number 5, Ctrl++", "a row is inserted at once, no dialog", "medium",
     ROWS, [("click", "r5"), ("key", CTRLPLUS)], {"dlg": None, "lo": True}, lo=[("ins", "A5", "rows")])
case("R10", 4, "click column letter C, Ctrl+-", "column C deleted at once, no dialog", "medium",
     COLS, [("click", "cC"), ("key", CTRLMINUS)], {"dlg": None, "lo": True}, lo=[("del", "C1", "cols")])
case("R11", 4, "right-click row number 1, Insert", "everything moves down one", "high",
     ROWS, [("rclick", "r1"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A1", "rows")])
case("R12", 4, "B5 =SUM(B2:B4) under the figures; insert a row at 5 (between figures and total)", "the total moves to B6, still =SUM(B2:B4)", "medium",
     {"B2": "1", "B3": "2", "B4": "3", "B5": "=SUM(B2:B4)"}, [("rclick", "r5"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A5", "rows")])
case("R13", 4, "=SUM(B2:B4); insert a row at 2 (the range's first row)", "=SUM(B3:B5)", "medium",
     {"B2": "1", "B3": "2", "B4": "3", "D1": "=SUM(B2:B4)"}, [("rclick", "r2"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A2", "rows")])
case("R14", 4, "C1 =B5*2 where B5 is a total; delete row 5", "C1 becomes =#REF!*2", "high",
     {"B2": "1", "B3": "2", "B4": "3", "B5": "=SUM(B2:B4)", "C1": "=B5*2"}, [("rclick", "r5"), ("pick", "Delete")], {"lo": True}, lo=[("del", "A5", "rows")])
case("R15", 4, "=SUM(B2:B5); delete row 5 (the range's last row)", "=SUM(B2:B4)", "high",
     {"B2": "1", "B3": "2", "B4": "3", "B5": "4", "D1": "=SUM(B2:B5)"}, [("rclick", "r5"), ("pick", "Delete")], {"lo": True}, lo=[("del", "A5", "rows")])
case("R16", 4, "=SUM(B3:B4); delete rows 3 and 4", "=SUM(#REF!)", "high",
     {"B2": "1", "B3": "2", "B4": "3", "B5": "4", "D1": "=SUM(B3:B4)", "D2": "=SUM(B2:B5)"}, [("drag", "r3", "r4"), ("rclick", "r3"), ("pick", "Delete")],
     {"lo": True}, lo=[("del", "A3:A4", "rows")])
case("R17", 4, "drag row numbers 3 to 12, Insert", "ten rows inserted", "medium",
     ROWS, [("drag", "r3", "r12"), ("rclick", "r5"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A3:A12", "rows")])
case("R18", 4, "row 5 made 30 points high; insert a row at 3", "the tall row is now row 6; row 5 is usual", "medium",
     ROWS, [("rclick", "r5"), ("pick", RH), ("field", "30"), ("ok",), ("rclick", "r3"), ("pick", "Insert")], {"row_h": {5: 1.0, 6: 2.0}})
case("R19", 4, "hide row 6; insert a row at 2", "the hidden row is now row 7", "high",
     ROWS, [("rclick", "r6"), ("pick", "Hide"), ("rclick", "r2"), ("pick", "Insert")], {"hidden_rows": [7], "raw": {"A7": "flour"}})
case("R20", 4, "hide row 6; delete row 2", "the hidden row is now row 5", "high",
     ROWS, [("rclick", "r6"), ("pick", "Hide"), ("rclick", "r2"), ("pick", "Delete")], {"hidden_rows": [5], "raw": {"A5": "flour"}})
case("R21", 4, "hide row 4; delete row 3", "the hidden row is now row 3", "medium",
     ROWS, [("rclick", "r4"), ("pick", "Hide"), ("rclick", "r3"), ("pick", "Delete")], {"hidden_rows": [3], "raw": {"A3": "oil"}})
case("R22", 4, "column C made 20 wide; insert a column at B", "the wide column is now D, C is usual", "medium",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "20"), ("ok",), ("remember", "wide", colw("C")), ("remember", "usual", colw("Y")),
            ("rclick", "cB"), ("pick", "Insert")], {"same_as": [(colw("D"), "wide"), (colw("C"), "usual")]})
case("R23", 4, "hide column D; insert a column at B", "the hidden column is now E", "high",
     COLS, [("rclick", "cD"), ("pick", "Hide"), ("rclick", "cB"), ("pick", "Insert")], {"hidden_cols": ["E"]})
case("R24", 4, "hide column E; delete column B", "the hidden column is now D", "high",
     COLS, [("rclick", "cE"), ("pick", "Hide"), ("rclick", "cB"), ("pick", "Delete")], {"hidden_cols": ["D"]})
case("R25", 4, "merge A5:B6; insert a row at 3", "the merged cell is now A6:B7", "medium",
     {"A5": "m"}, [*MERGE("A5", "B6"), ("rclick", "r3"), ("pick", "Insert")],
     {"merged": {"A6": [2, 2], "A5": [1, 1]}, "raw": {"A6": "m"}})
case("R26", 4, "merge A3:B5; insert a row at 4 (inside it)", "the merged cell grows to A3:B6", "medium",
     {"A3": "m"}, [*MERGE("A3", "B5"), ("rclick", "r4"), ("pick", "Insert")],
     {"merged": {"A3": [2, 4]}})
case("R27", 4, "merge A3:B5; delete row 4 (inside it)", "the merged cell shrinks to A3:B4", "medium",
     {"A3": "m"}, [*MERGE("A3", "B5"), ("rclick", "r4"), ("pick", "Delete")],
     {"merged": {"A3": [2, 2]}})
case("R43", 4, "merge A3:B5; column C holds c2..c6; right-click row number 4, Delete", "only row 4 goes: C3 c3, C4 c5, the merged cell A3:B4", "high",
     {"A3": "m", "C2": "c2", "C3": "c3", "C4": "c4", "C5": "c5", "C6": "c6"}, [*MERGE("A3", "B5"), ("rclick", "r4"), ("pick", "Delete")],
     {"cells_exact": {"A3": "m", "C2": "c2", "C3": "c3", "C4": "c5", "C5": "c6"}, "merged": {"A3": [2, 2]}})
case("R44", 4, "merge B2:D2; row 1 holds b1..e1; right-click column letter C, Delete", "only column C goes: B1 b1, C1 d1, D1 e1; the merged cell B2:C2", "high",
     {"B2": "m", "B1": "b1", "C1": "c1", "D1": "d1", "E1": "e1"}, [*MERGE("B2", "D2"), ("rclick", "cC"), ("pick", "Delete")],
     {"cells_exact": {"B2": "m", "B1": "b1", "C1": "d1", "D1": "e1"}, "merged": {"B2": [2, 1]}})
case("R28", 4, "merge A3:B4; delete rows 3 and 4", "the merged cell is gone", "medium",
     {"A3": "m", "A5": "next"}, [*MERGE("A3", "B4"),
                                 ("drag", "r3", "r4"), ("rclick", "r3"), ("pick", "Delete")], {"merged": {"A3": [1, 1]}, "raw": {"A3": "next"}})
case("R29", 4, "merge C2:D3; insert a column at B", "the merged cell is now D2:E3", "medium",
     {"C2": "m"}, [*MERGE("C2", "D3"), ("rclick", "cB"), ("pick", "Insert")],
     {"merged": {"D2": [2, 2], "C2": [1, 1]}})
case("R30", 4, "merge B2:D2; insert a column at C (inside it)", "the merged cell grows to B2:E2", "medium",
     {"B2": "m"}, [*MERGE("B2", "D2"), ("rclick", "cC"), ("pick", "Insert")],
     {"merged": {"B2": [4, 1]}})
case("R31", 4, "B4 bold; insert a row at 5", "the new row takes the format of the row above: B5 bold", "low",
     ROWS, [("rclick", "B4"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "r5"), ("pick", "Insert"), ("click", "B5"), ("type", "9"), ("key", "Enter")],
     {"bold": {"B5": True}})
case("R32", 4, "B5 shown as money; insert a row at 3", "the money format goes with it to B6", "medium",
     ROWS, [("rclick", "B5"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("rclick", "r3"), ("pick", "Insert")],
     {"shown": {"B6": "$4.00"}})
case("R33", 4, "B5 shown as money; delete row 3", "the money format goes with it to B4", "medium",
     ROWS, [("rclick", "B5"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("rclick", "r3"), ("pick", "Delete")],
     {"shown": {"B4": "$4.00"}})
case("R34", 4, "Z1 holds a value; right-click column letter B, Insert", "a column is inserted; the value moves to AA1", "medium",
     {"A1": "1", "B1": "2", "Z1": "z"}, [("rclick", "cB"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "B1", "cols")])
case("R35", 4, "B100 holds a value; insert a row at 3", "it moves to B101", "medium",
     {"B2": "1", "B100": "last", "C1": "=B100"}, [("rclick", "r3"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A3", "rows")])
case("R36", 4, "=SUM(A1:E1), =C1, =SUM(C1:D1); delete column C", "=SUM(A1:D1), #REF!, =SUM(C1:C1)", "high",
     {"A1": "1", "B1": "2", "C1": "3", "D1": "4", "E1": "5", "A3": "=SUM(A1:E1)", "B3": "=C1", "C3": "=SUM(C1:D1)", "D3": "=E1"},
     [("rclick", "cC"), ("pick", "Delete")], {"lo": True}, lo=[("del", "C1", "cols")])
case("R37", 4, "=SUM(B:B) and =COUNT(2:2); insert a row at 2", "B:B stays, 2:2 becomes 3:3", "low",
     {"B2": "1", "B3": "2", "C2": "5", "E1": "=SUM(B:B)", "E5": "=COUNT(2:2)"}, [("rclick", "r2"), ("pick", "Insert")], {"lo": True}, lo=[("ins", "A2", "rows")])
case("R38", 4, "click B5, Shift+Space, Ctrl+-", "row 5 deleted at once", "medium",
     ROWS, [("click", "B5"), ("key", "Shift+Space"), ("key", CTRLMINUS)], {"dlg": None, "lo": True}, lo=[("del", "A5", "rows")])
case("R39", 4, "click B5, Shift+Space, Ctrl++", "a row inserted at 5 at once", "medium",
     ROWS, [("click", "B5"), ("key", "Shift+Space"), ("key", CTRLPLUS)], {"dlg": None, "lo": True}, lo=[("ins", "A5", "rows")])
case("R40", 4, "row 5 made 30 high; delete row 5", "row 5 (the old row 6) is of usual height", "medium",
     ROWS, [("rclick", "r5"), ("pick", RH), ("field", "30"), ("ok",), ("rclick", "r5"), ("pick", "Delete")], {"row_h": {5: 1.0}})
case("R41", 4, "insert a row at 5, then look at the selection", "row 5 (the new, empty one) is still selected", "low",
     ROWS, [("rclick", "r5"), ("pick", "Insert")], {"sel": ("rows", 5, 5)})
case("R42", 4, "click column letter C, Ctrl++", "a column is inserted at once", "medium",
     COLS, [("click", "cC"), ("key", CTRLPLUS)], {"dlg": None, "lo": True}, lo=[("ins", "C1", "cols")])

# ================================================================ claim 5: Format Cells
case("F01", 5, "click C3, Ctrl+1", "the Format Cells dialog", "medium", NUMS, [("click", "C3"), ("key", "Control+1")], {"dlg": "Format Cells"})
case("F02", 5, "select B2:B4, Format Cells, Money $1,234.50", "$1,234.50  $0.50  $7.00", "high",
     NUMS, [("drag", "B2", "B4"), ("rclick", "B3"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",)],
     {"shown": {"B2": "$1,234.50", "B3": "$0.50", "B4": "$7.00"}})
case("F03", 5, "C2 = 0.125, Format Cells, Per cent 12%", "13% (Excel rounds half away from zero)", "medium",
     NUMS, [("rclick", "C2"), ("pick", FMT), ("select", "Number format", "0%"), ("ok",)], {"shown": {"C2": "13%"}})
case("F04", 5, "C3 = 3.14159, Format Cells, own code 0.000", "3.142", "medium",
     NUMS, [("rclick", "C3"), ("pick", FMT), ("select", "Number format", "*"), ("field", "0.000"), ("ok",)], {"shown": {"C3": "3.142"}})
case("F05", 5, "C4 = 45000, Format Cells, Date 2026-11-17 style", "2023-03-15", "medium",
     NUMS, [("rclick", "C4"), ("pick", FMT), ("select", "Number format", "yyyy-mm-dd"), ("ok",)], {"shown": {"C4": "2023-03-15"}})
case("F06", 5, "C5 = 1234567.8, Format Cells, own code #,##0", "1,234,568", "medium",
     NUMS, [("rclick", "C5"), ("pick", FMT), ("select", "Number format", "*"), ("field", "#,##0"), ("ok",)], {"shown": {"C5": "1,234,568"}})
case("F07", 5, "Format Cells, Bold", "B2 bold", "medium", NUMS, [("rclick", "B2"), ("pick", FMT), ("check", "Bold", True), ("ok",)], {"bold": {"B2": True, "B3": False}})
case("F08", 5, "Format Cells, Italic", "B2 italic", "medium", NUMS, [("rclick", "B2"), ("pick", FMT), ("check", "Italic", True), ("ok",)], {"italic": {"B2": True}})
case("F09", 5, "select B2:C3, Format Cells, Bold", "all four bold", "high",
     NUMS, [("drag", "B2", "C3"), ("rclick", "C3"), ("pick", FMT), ("check", "Bold", True), ("ok",)], {"bold": {"B2": True, "B3": True, "C2": True, "C3": True, "B4": False}})
case("F10", 5, "Format Cells, Horizontal Centre", "B2 centred", "medium",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("select", "Horizontal alignment", "center"), ("ok",)], {"align": {"B2": "center"}})
case("F11", 5, "a number, Format Cells, Horizontal Left", "B2 to the left", "low",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("select", "Horizontal alignment", "left"), ("ok",)], {"align": {"B2": "left"}})
case("F12", 5, "A1 Item, B1 Qty; select A1:C1, Format Cells, Merge cells", "one cell A1:C1 holding Item; Qty is dropped", "high",
     SMALL, [("drag", "A1", "C1"), ("rclick", "A1"), ("pick", FMT), ("check", "Merge cells", True), ("ok",)],
     {"merged": {"A1": [3, 1]}, "raw": {"A1": "Item", "B1": None}})
case("F13", 5, "merge A1:C1 while B1 holds Qty", "Excel asks first (OK / Cancel) that only the upper-left value will be kept", "low",
     SMALL, [("drag", "A1", "C1"), ("rclick", "A1"), ("pick", FMT), ("check", "Merge cells", True), ("ok",)],
     {"warned_before": True, "warned_text": "Merging cells only keeps the upper-left value and discards other values."})
case("F14", 5, "merge A1:B2, then Format Cells on it and untick Merge cells", "unmerged again, A1 keeps its value", "medium",
     SMALL, [("drag", "A1", "B2"), ("rclick", "A1"), ("pick", FMT), ("check", "Merge cells", True), ("ok",),
             ("rclick", "A1"), ("pick", FMT), ("check", "Merge cells", False), ("ok",)], {"merged": {"A1": [1, 1]}, "raw": {"A1": "Item"}})
case("F15", 5, "make B2 bold, open Format Cells on it again", "the dialog shows Bold ticked", "low",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("rclick", "B2"), ("pick", FMT)], {"dlg_checks": {"Bold": True, "Italic": False}})
case("F16", 5, "merge A1:B2, open Format Cells on it again", "Merge cells ticked", "low",
     SMALL, [*MERGE("A1", "B2"), ("rclick", "A1"), ("pick", FMT)],
     {"dlg_checks": {"Merge cells": True}})
case("F17", 5, "B2 shown as money; open Format Cells on it again", "the dialog shows the money format", "low",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("rclick", "B2"), ("pick", FMT)],
     {"dlg_select": {"Number format": "$#,##0.00"}})
case("F18", 5, "Format Cells, tick Bold, Cancel", "nothing changes", "medium",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("check", "Bold", True), ("cancel",)], {"bold": {"B2": False}, "dlg": None})
case("F19", 5, "B2:B3: Bold, Italic and money in one Format Cells; then Ctrl+Z once", "one undo takes all three back", "high",
     NUMS, [("drag", "B2", "B3"), ("rclick", "B2"), ("pick", FMT), ("check", "Bold", True), ("check", "Italic", True),
            ("select", "Number format", "$#,##0.00"), ("ok",), ("key", "Control+z")],
     {"bold": {"B2": False, "B3": False}, "italic": {"B2": False}, "shown": {"B2": "1234.5"}})
case("F20", 5, "merge A1:B1 (B1 holds Qty), then Ctrl+Z", "Qty is back in B1 and the cells are apart", "high",
     SMALL, [("drag", "A1", "B1"), ("rclick", "A1"), ("pick", FMT), ("check", "Merge cells", True), ("ok",), ("key", "Control+z")],
     {"merged": {"A1": [1, 1]}, "raw": {"A1": "Item", "B1": "Qty"}})
case("F21", 5, "right-click row number 3, Format Cells, Bold; then type x in H3", "a format given to a whole row applies to new entries: bold", "low",
     SMALL, [("rclick", "r3"), ("pick", FMT), ("check", "Bold", True), ("ok",), ("click", "H3"), ("type", "x"), ("key", "Enter")],
     {"bold": {"H3": True, "H4": False}})
case("F22", 5, "column B Money; then type 5 in B20", "$5.00", "low",
     SMALL, [("rclick", "cB"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("click", "B20"), ("type", "5"), ("key", "Enter")],
     {"shown": {"B20": "$5.00"}})
case("F23", 5, "B2 money, then Format Cells General", "1234.5 again", "medium",
     NUMS, [("rclick", "B2"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("rclick", "B2"), ("pick", FMT),
            ("select", "Number format", ""), ("ok",)], {"shown": {"B2": "1234.5"}})
case("F24", 5, "merge A1:B1 where B1 = 5 and C5 =B1*2", "C5 keeps =B1*2, now 0", "low",
     {"A1": "x", "B1": "5", "C5": "=B1*2"}, [*MERGE("A1", "B1")],
     {"raw": {"C5": "=B1*2", "B1": None}, "vals": {"C5": 0}})
case("F25", 5, "merge A2:B3 then type 42 into it", "A2 holds 42", "medium",
     {}, [*MERGE("A2", "B3"), ("click", "A2"), ("type", "42"), ("key", "Enter")],
     {"raw": {"A2": "42"}, "merged": {"A2": [2, 2]}})

# ================================================================ claim 6: heights, widths, hide, unhide, arrows
case("H01", 6, "right-click row number 3, Row Height...", "the dialog shows 15", "medium", ROWS, [("rclick", "r3"), ("pick", RH)], {"dlg": "Row Height", "dlg_field": 15})
case("H02", 6, "row 3 height 30", "row 3 twice as tall as the others", "high", ROWS, [("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",)], {"row_h": {3: 2.0, 4: 1.0}})
case("H03", 6, "row 3 height 0", "row 3 hidden", "medium", ROWS, [("rclick", "r3"), ("pick", RH), ("field", "0"), ("ok",)], {"hidden_rows": [3]})
case("H04", 6, "right-click column letter C, Column Width...", "the dialog shows 8.43", "low", COLS, [("rclick", "cC"), ("pick", CW)], {"dlg": "Column Width", "dlg_field": 8.43})
case("H05", 6, "column C width 8.43 (Excel's usual width)", "C stays as wide as the other columns", "low",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "8.43"), ("ok",)], {"col_w": {"C": 1.0}})
case("H06", 6, "column C width 20", "C is %.2f times a usual column (145 against 64 pixels)" % xl_ratio(20), "low",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "20"), ("ok",)], {"col_w": {"C": xl_ratio(20)}})
case("H07", 6, "column C width 0", "column C hidden", "medium", COLS, [("rclick", "cC"), ("pick", CW), ("field", "0"), ("ok",)], {"hidden_cols": ["C"]})
case("H08", 6, "row 3 height 30, then Row Height... again", "the dialog shows 30", "low",
     ROWS, [("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",), ("rclick", "r3"), ("pick", RH)], {"dlg_field": 30})
case("H09", 6, "column C width 20, then Column Width... again", "the dialog shows 20", "low",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "20"), ("ok",), ("rclick", "cC"), ("pick", CW)], {"dlg_field": 20})
case("H10", 6, "drag row numbers 2 to 4, Row Height 30", "all three rows 30", "medium",
     ROWS, [("drag", "r2", "r4"), ("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",)], {"row_h": {2: 2.0, 3: 2.0, 4: 2.0, 5: 1.0}})
case("H11", 6, "drag column letters B to D, Column Width 20", "all three equally wide, wider than E", "medium",
     COLS, [("drag", "cB", "cD"), ("rclick", "cC"), ("pick", CW), ("field", "20"), ("ok",)],
     {"js": [("() => { var w = function (n) { return document.querySelector('thead th:nth-child(' + n + ')').getBoundingClientRect().width; }; return w(3) === w(4) && w(4) === w(5) && w(3) > w(6) * 1.5; }", True)]})
case("H12", 6, "right-click row number 3, Hide", "row 3 hidden, its neighbours shown", "high", ROWS, [("rclick", "r3"), ("pick", "Hide")], {"hidden_rows": [3]})
case("H13", 6, "drag row numbers 3 to 5, right-click 4, Hide", "rows 3 to 5 hidden", "high",
     ROWS, [("drag", "r3", "r5"), ("rclick", "r4"), ("pick", "Hide")], {"hidden_rows": [3, 4, 5]})
case("H14", 6, "hide row 3; drag row numbers 2 to 4; right-click 2, Unhide", "row 3 shown again", "high",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("drag", "r2", "r4"), ("rclick", "r2"), ("pick", "Unhide")], {"hidden_rows": []})
case("H15", 6, "hide row 3; right-click row number 6, Unhide", "nothing: the selection does not reach row 3", "low",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("rclick", "r6"), ("pick", "Unhide")], {"hidden_rows": [3]})
case("H16", 6, "hide rows 3 and 7; click H20, Ctrl+A, right-click row number 1, Unhide", "every row shown", "high",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("rclick", "r7"), ("pick", "Hide"), ("click", "H20"), ("key", "Control+a"), ("rclick", "r1"), ("pick", "Unhide")],
     {"hidden_rows": []})
case("H17", 6, "hide row 3 and column C; click H20, Ctrl+A, right-click row number 1, Unhide", "rows shown; column C stays hidden (a row's Unhide is for rows)", "low",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("rclick", "cC"), ("pick", "Hide"), ("click", "H20"), ("key", "Control+a"), ("rclick", "r1"), ("pick", "Unhide")],
     {"hidden_rows": [], "hidden_cols": ["C"]})
case("H18", 6, "hide column C; drag letters B to D; right-click B, Unhide", "column C shown", "high",
     COLS, [("rclick", "cC"), ("pick", "Hide"), ("drag", "cB", "cD"), ("rclick", "cB"), ("pick", "Unhide")], {"hidden_cols": []})
case("H19", 6, "hide row 3; click B2, press Down", "B4 (the hidden row is skipped)", "high",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("click", "B2"), ("key", "ArrowDown")], {"active": "B4"})
case("H20", 6, "hide row 3; click B4, press Up", "B2", "high", ROWS, [("rclick", "r3"), ("pick", "Hide"), ("click", "B4"), ("key", "ArrowUp")], {"active": "B2"})
case("H21", 6, "hide column C; click B2, press Right", "D2", "high", COLS, [("rclick", "cC"), ("pick", "Hide"), ("click", "B2"), ("key", "ArrowRight")], {"active": "D2"})
case("H22", 6, "hide row 3; in B2 type 5 and Enter", "B4 becomes active", "medium",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("click", "B2"), ("type", "5"), ("key", "Enter")], {"active": "B4", "raw": {"B2": "5"}})
case("H23", 6, "hide row 3; click B2, Shift+Down", "B2:B4", "low", ROWS, [("rclick", "r3"), ("pick", "Hide"), ("click", "B2"), ("key", "Shift+ArrowDown")], {"sel": ("cells", "B2:B4")})
case("H24", 6, "hide row 3", "SUM over B2:B9 still counts row 3 (36)", "high", ROWS, [("rclick", "r3"), ("pick", "Hide")], {"vals": {"B10": 36, "D1": 36}})
case("H25", 6, "hide row 3; drag B2 to B4", "B2:B4", "low", ROWS, [("rclick", "r3"), ("pick", "Hide"), ("drag", "B2", "B4")], {"sel": ("cells", "B2:B4")})
case("H26", 6, "row 3 height 30, hide it, then unhide it", "it comes back 30 high", "medium",
     ROWS, [("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",), ("rclick", "r3"), ("pick", "Hide"), ("drag", "r2", "r4"), ("rclick", "r2"), ("pick", "Unhide")],
     {"hidden_rows": [], "row_h": {3: 2.0}})
case("H27", 6, "column C width 0, then select B:D and Unhide", "C shown again", "medium",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "0"), ("ok",), ("drag", "cB", "cD"), ("rclick", "cB"), ("pick", "Unhide")], {"hidden_cols": []})
case("H28", 6, "hide column C; look at the letters", "A, B, D, E ... (C not drawn)", "medium", COLS, [("rclick", "cC"), ("pick", "Hide")], {"hidden_cols": ["C"]})
case("H29", 6, "hide column D; click C2, Shift+Right", "C2:E2", "low", COLS, [("rclick", "cD"), ("pick", "Hide"), ("click", "C2"), ("key", "Shift+ArrowRight")], {"sel": ("cells", "C2:E2")})
case("H30", 6, "hide rows 3 and 4; click B2, Down", "B5", "medium",
     ROWS, [("drag", "r3", "r4"), ("rclick", "r3"), ("pick", "Hide"), ("click", "B2"), ("key", "ArrowDown")], {"active": "B5"})

# ================================================================ claim 7: SUBTOTAL / AGGREGATE over hidden rows; .xlsx
def subt(id, formula, hidden_val, plain_val, harm="high", hide="r4", does=None):
    cells = dict(SUBT, D1=formula)
    case(id, 7, does or "B2:B6 = 1,2,4,8,16, row 4 (the 4) hidden; D1 %s" % formula,
         "%s" % hidden_val, harm, cells, [("rclick", hide), ("pick", "Hide")], {"vals": {"D1": hidden_val}})
subt("T01", "=SUBTOTAL(109,B2:B6)", 27, 31)
subt("T02", "=SUBTOTAL(9,B2:B6)", 31, 31)
subt("T03", "=SUBTOTAL(101,B2:B6)", 6.75, 6.2)
subt("T04", "=SUBTOTAL(1,B2:B6)", 6.2, 6.2, "medium")
subt("T05", "=SUBTOTAL(102,B2:B6)", 4, 5, "medium")
subt("T06", "=SUBTOTAL(2,B2:B6)", 5, 5, "medium")
subt("T07", "=SUBTOTAL(103,B2:B6)", 4, 5, "medium")
subt("T08", "=SUBTOTAL(104,B2:B6)", 16, 16, "medium")
subt("T09", "=SUBTOTAL(105,B2:B6)", 2, 1, "medium", hide="r2", does="B2:B6 = 1,2,4,8,16, row 2 (the 1) hidden; D1 =SUBTOTAL(105,B2:B6)")
subt("T10", "=SUBTOTAL(106,B2:B6)", 256, 1024, "medium")
subt("T11", "=SUBTOTAL(107,B2:B6)", statistics.stdev([1, 2, 8, 16]), 0, "medium")
subt("T12", "=SUBTOTAL(110,B2:B6)", statistics.variance([1, 2, 8, 16]), 0, "medium")
subt("T13", "=SUBTOTAL(111,B2:B6)", statistics.pvariance([1, 2, 8, 16]), 0, "medium")
subt("T14", "=SUBTOTAL(7,B2:B6)", statistics.stdev([1, 2, 4, 8, 16]), 0, "medium")
subt("T15", "=AGGREGATE(9,5,B2:B6)", 27, 31)
subt("T16", "=AGGREGATE(9,1,B2:B6)", 27, 31)
subt("T17", "=AGGREGATE(9,3,B2:B6)", 27, 31)
subt("T18", "=AGGREGATE(9,7,B2:B6)", 27, 31)
subt("T19", "=AGGREGATE(9,4,B2:B6)", 31, 31)
subt("T20", "=AGGREGATE(9,6,B2:B6)", 31, 31)
subt("T21", "=AGGREGATE(9,0,B2:B6)", 31, 31)
subt("T22", "=AGGREGATE(1,5,B2:B6)", 6.75, 6.2)
subt("T23", "=AGGREGATE(14,5,B2:B6,3)", 2, 4, "medium")
subt("T24", "=AGGREGATE(4,5,B2:B6)", 16, 16, "medium")
case("T25", 7, "B12:F12 = 1,2,4,8,16 across a row, column D (the 4) hidden; =SUBTOTAL(109,B12:F12)",
     "31: hiding a COLUMN does not change SUBTOTAL (Excel ignores only hidden rows)", "medium",
     {"B12": "1", "C12": "2", "D12": "4", "E12": "8", "F12": "16", "A1": "=SUBTOTAL(109,B12:F12)"}, [("rclick", "cD"), ("pick", "Hide")], {"vals": {"A1": 31}})
case("T26", 7, "the same row, column D hidden; =AGGREGATE(9,5,B12:F12)", "31 (AGGREGATE ignores hidden rows, not columns)", "medium",
     {"B12": "1", "C12": "2", "D12": "4", "E12": "8", "F12": "16", "A1": "=AGGREGATE(9,5,B12:F12)"}, [("rclick", "cD"), ("pick", "Hide")], {"vals": {"A1": 31}})
case("T27", 7, "hide row 4, then unhide it; =SUBTOTAL(109,B2:B6)", "31 again", "medium",
     dict(SUBT, D1="=SUBTOTAL(109,B2:B6)"), [("rclick", "r4"), ("pick", "Hide"), ("drag", "r3", "r5"), ("rclick", "r3"), ("pick", "Unhide")], {"vals": {"D1": 31}})
case("T28", 7, "row 4 hidden by Row Height 0; =SUBTOTAL(109,B2:B6)", "27 (height 0 is hidden)", "medium",
     dict(SUBT, D1="=SUBTOTAL(109,B2:B6)"), [("rclick", "r4"), ("pick", RH), ("field", "0"), ("ok",)], {"vals": {"D1": 27}})
case("T29", 7, "B7 =SUBTOTAL(9,B2:B6); D1 =SUBTOTAL(9,B2:B7)", "31: SUBTOTAL leaves out other SUBTOTALs", "low",
     dict(SUBT, B7="=SUBTOTAL(9,B2:B6)", D1="=SUBTOTAL(9,B2:B7)"), [], {"vals": {"D1": 31}})
case("T30", 7, "rows 2 and 6 hidden; =SUBTOTAL(109,B2:B6)", "14", "medium",
     dict(SUBT, D1="=SUBTOTAL(109,B2:B6)"), [("rclick", "r2"), ("pick", "Hide"), ("rclick", "r6"), ("pick", "Hide")], {"vals": {"D1": 14}})
case("T31", 7, "hide row 4, Ctrl+Z; =SUBTOTAL(109,B2:B6)", "31", "medium",
     dict(SUBT, D1="=SUBTOTAL(109,B2:B6)"), [("rclick", "r4"), ("pick", "Hide"), ("key", "Control+z")], {"vals": {"D1": 31}, "hidden_rows": []})
case("T32", 7, "hide row 4; insert a row at 2; =SUBTOTAL(109,...) follows", "the hidden 4 is still left out: 27, formula =SUBTOTAL(109,B3:B7)", "medium",
     dict(SUBT, D1="=SUBTOTAL(109,B2:B6)"), [("rclick", "r4"), ("pick", "Hide"), ("rclick", "r2"), ("pick", "Insert")],
     {"vals": {"D1": 27}, "raw": {"D1": "=SUBTOTAL(109,B3:B7)"}, "hidden_rows": [5]})

XL_BASE = dict(SUBT, D1="=SUBTOTAL(109,B2:B6)")
case("X01", 7, "hide row 3, Save .xlsx", "the file marks row 3 hidden", "high",
     XL_BASE, [("rclick", "r3"), ("pick", "Hide"), ("save", "x1")], {"xlsx": {"file": "x1", "hidden_rows": [3]}})
case("X02", 7, "hide column D, Save .xlsx", "the file marks column D hidden", "high",
     XL_BASE, [("rclick", "cD"), ("pick", "Hide"), ("save", "x2")], {"xlsx": {"file": "x2", "hidden_cols": ["D"]}})
case("X03", 7, "row 5 height 30, Save .xlsx", "the file gives row 5 30 points", "medium",
     XL_BASE, [("rclick", "r5"), ("pick", RH), ("field", "30"), ("ok",), ("save", "x3")], {"xlsx": {"file": "x3", "heights": {5: 30}}})
case("X04", 7, "column E width 20, Save .xlsx", "Excel writes width 20.7109375 (20 characters plus its padding), so Excel shows 20 again", "low",
     XL_BASE, [("rclick", "cE"), ("pick", CW), ("field", "20"), ("ok",), ("save", "x4")], {"xlsx": {"file": "x4", "widths": {"E": 20.7109375}}})
case("X05", 7, "merge F1:G2, Save .xlsx", "the file keeps the merged cell", "low",
     dict(XL_BASE, F1="m"), [*MERGE("F1", "G2"), ("save", "x5")],
     {"xlsx": {"file": "x5", "merges": ["F1:G2"]}})
case("X06", 7, "hide row 3 and column C, row 5 30 high; save; Import file that .xlsx", "all three come back", "high",
     XL_BASE, [("rclick", "r3"), ("pick", "Hide"), ("rclick", "cC"), ("pick", "Hide"), ("rclick", "r5"), ("pick", RH), ("field", "30"), ("ok",),
               ("save", "x6"), ("import", "x6")], {"hidden_rows": [3], "hidden_cols": ["C"], "row_h": {5: 2.0}})
case("X07", 7, "Import file: an .xlsx with rows 3 and 6 hidden", "rows 3 and 6 hidden; a note says so", "high",
     {}, [("import", "imp_rows")], {"hidden_rows": [3, 6], "note": "Hidden rows"})
case("X08", 7, "Import file: an .xlsx with column C hidden", "column C hidden", "high", {}, [("import", "imp_cols")], {"hidden_cols": ["C"]})
case("X09", 7, "Import file: an .xlsx with row 5 30 points high", "row 5 twice the usual height", "medium", {}, [("import", "imp_height")], {"row_h": {5: 2.0, 4: 1.0}})
case("X10", 7, "Import file: B2:B6 1..16, row 4 hidden, D1 =SUBTOTAL(109,B2:B6)", "27", "high", {}, [("import", "imp_subt")], {"vals": {"D1": 27}})
case("X11", 7, "Import file with row 3 hidden; then select rows 2-4 and Unhide", "row 3 shown", "medium",
     {}, [("import", "imp_rows"), ("drag", "r2", "r4"), ("rclick", "r2"), ("pick", "Unhide")], {"hidden_rows": [6]})
case("X12", 7, "hide row 4, insert a row at 2, Save .xlsx", "the file hides row 5 (where the hidden row went)", "medium",
     XL_BASE, [("rclick", "r4"), ("pick", "Hide"), ("rclick", "r2"), ("pick", "Insert"), ("save", "x12")],
     {"xlsx": {"file": "x12", "hidden_rows": [5], "cells": {"D1": "=SUBTOTAL(109,B3:B7)"}}})
case("X13", 7, "Import file: an .xlsx with column D 20.7109375 wide (Excel's 20)", "D is as wide as Excel's 20 against its usual columns", "low",
     {}, [("import", "imp_width")], {"col_w": {"D": xl_ratio(20)}})

IMPORTS = {
    "imp_rows": {"cells": {"A%d" % r: str(r * 10) for r in range(1, 9)}, "hidden_rows": [3, 6]},
    "imp_cols": {"cells": {"%s1" % c: c for c in "ABCDEF"}, "hidden_cols": ["C"]},
    "imp_height": {"cells": {"A1": "1", "A5": "5"}, "heights": {5: 30}},
    "imp_subt": {"cells": dict(XL_BASE), "hidden_rows": [4]},
    "imp_width": {"cells": {"A1": "1", "D1": "4"}, "widths": {"D": 20.7109375}},
}

def build_xlsx(spec, path):
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Sheet1"
    for ref, v in spec.get("cells", {}).items():
        try: v = float(v) if "." in v else int(v)
        except ValueError: pass
        ws[ref] = v
    for r in spec.get("hidden_rows", []): ws.row_dimensions[r].hidden = True
    for c in spec.get("hidden_cols", []): ws.column_dimensions[c].hidden = True
    for r, h in spec.get("heights", {}).items(): ws.row_dimensions[r].height = h
    for c, w in spec.get("widths", {}).items(): ws.column_dimensions[c].width = w
    for m in spec.get("merges", []): ws.merge_cells(m)
    wb.save(path)

# ================================================================ claim 8: undo
case("U01", 8, "insert a row at 5, Ctrl+Z", "everything back as it was", "high", ROWS, [("rclick", "r5"), ("pick", "Insert"), ("key", "Control+z")], {"cells_exact": ROWS})
case("U02", 8, "delete row 3, Ctrl+Z", "everything back, no #REF! left", "high", ROWS, [("rclick", "r3"), ("pick", "Delete"), ("key", "Control+z")], {"cells_exact": ROWS})
case("U03", 8, "insert at C3 shifting down, Ctrl+Z", "back as it was", "high",
     FORMS_C, [("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",), ("key", "Control+z")], {"cells_exact": FORMS_C})
case("U04", 8, "delete B3 shifting left, Ctrl+Z", "back as it was", "high",
     FORMS_R, [("rclick", "B3"), ("pick", DEL), ("radio", "Shift cells left"), ("ok",), ("key", "Control+z")], {"cells_exact": FORMS_R})
case("U05", 8, "hide row 3, Ctrl+Z", "row 3 shown", "high", ROWS, [("rclick", "r3"), ("pick", "Hide"), ("key", "Control+z")], {"hidden_rows": []})
case("U06", 8, "row 3 height 30, Ctrl+Z", "usual height", "medium", ROWS, [("rclick", "r3"), ("pick", RH), ("field", "30"), ("ok",), ("key", "Control+z")], {"row_h": {3: 1.0}})
case("U07", 8, "column C width 0, Ctrl+Z", "column C shown", "medium", COLS, [("rclick", "cC"), ("pick", CW), ("field", "0"), ("ok",), ("key", "Control+z")], {"hidden_cols": []})
case("U08", 8, "row 5 30 high, row 6 hidden, A7:B8 merged; insert a row at 3; Ctrl+Z", "height, hidden row and merged cell all back where they were", "high",
     ROWS, [("rclick", "r5"), ("pick", RH), ("field", "30"), ("ok",), ("rclick", "r6"), ("pick", "Hide"), *MERGE("A7", "B8"),
            ("rclick", "r3"), ("pick", "Insert"), ("key", "Control+z")],
     {"row_h": {5: 2.0, 6: 0.0, 3: 1.0}, "hidden_rows": [6], "merged": {"A7": [2, 2], "A8": [1, 1]}})
case("U09", 8, "insert a row at 5, Ctrl+Z, Ctrl+Y", "the row is inserted again", "low",
     ROWS, [("rclick", "r5"), ("pick", "Insert"), ("key", "Control+z"), ("key", "Control+y")], {"lo": True}, lo=[("ins", "A5", "rows")])
case("U10", 8, "Clear Contents on B2:C3 from the menu, Ctrl+Z", "back", "high",
     SMALL, [("drag", "B2", "C3"), ("rclick", "B2"), ("pick", "Clear Contents"), ("key", "Control+z")], {"cells_exact": SMALL})
case("U11", 8, "Sort A to Z from the menu, Ctrl+Z", "the old order back", "high",
     {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "9", "A4": "fig", "B4": "1"},
     [("rclick", "A3"), ("pick", "Sort A to Z"), ("key", "Control+z")],
     {"cells_exact": {"A1": "Name", "B1": "Qty", "A2": "pear", "B2": "3", "A3": "apple", "B3": "9", "A4": "fig", "B4": "1"}})
case("U12", 8, "hide row 3, unhide it, Ctrl+Z", "row 3 hidden again", "medium",
     ROWS, [("rclick", "r3"), ("pick", "Hide"), ("drag", "r2", "r4"), ("rclick", "r2"), ("pick", "Unhide"), ("key", "Control+z")], {"hidden_rows": [3]})
case("U13", 8, "insert a row at 3, delete column B, then Ctrl+Z twice", "back to the start", "high",
     ROWS, [("rclick", "r3"), ("pick", "Insert"), ("rclick", "cB"), ("pick", "Delete"), ("key", "Control+z"), ("key", "Control+z")], {"cells_exact": ROWS})
case("U14", 8, "merge A3:B4, delete rows 3 to 4, Ctrl+Z", "the merged cell is back", "medium",
     {"A3": "m", "A5": "n"}, [*MERGE("A3", "B4"), ("drag", "r3", "r4"), ("rclick", "r3"),
                              ("pick", "Delete"), ("key", "Control+z")], {"merged": {"A3": [2, 2]}, "raw": {"A3": "m", "A5": "n"}})
case("U15", 8, "column C 20 wide; delete column C; Ctrl+Z", "C is 20 wide again", "medium",
     COLS, [("rclick", "cC"), ("pick", CW), ("field", "20"), ("ok",), ("remember", "wide", colw("C")), ("rclick", "cC"), ("pick", "Delete"), ("key", "Control+z")],
     {"same_as": [(colw("C"), "wide")], "cells_exact": COLS})
case("U16", 8, "merge B5:C6; type 5 in A1; try to insert at C3 shifting down (refused); Ctrl+Z", "the refused insert left nothing to undo: Ctrl+Z takes back the 5", "medium",
     dict(BLOCK), [*MERGE("B5", "C6"), ("click", "G1"), ("type", "5"), ("key", "Enter"),
                   ("rclick", "C3"), ("pick", INS), ("radio", "Shift cells down"), ("ok",), ("key", "Control+z")],
     {"raw": {"G1": None, "C3": "33"}, "merged": {"B5": [2, 2]}})
case("U17", 8, "hide column D; insert a column at B; Ctrl+Z", "column D hidden again, nothing else", "medium",
     COLS, [("rclick", "cD"), ("pick", "Hide"), ("rclick", "cB"), ("pick", "Insert"), ("key", "Control+z")], {"hidden_cols": ["D"], "cells_exact": COLS})
case("U18", 8, "formats moved by an insert: B5 money, insert row 3, Ctrl+Z", "B5 shows money again, B6 does not", "medium",
     ROWS, [("rclick", "B5"), ("pick", FMT), ("select", "Number format", "$#,##0.00"), ("ok",), ("rclick", "r3"), ("pick", "Insert"), ("key", "Control+z")],
     {"shown": {"B5": "$4.00", "B6": "5"}})
case("U19", 8, "Ctrl+Z after inserting three rows (one action)", "one Ctrl+Z takes all three back", "high",
     ROWS, [("drag", "r3", "r5"), ("rclick", "r4"), ("pick", "Insert"), ("key", "Control+z")], {"cells_exact": ROWS})

# ================================================================ the phone (Pixel 5): long press
case("P01", 2, "phone: long press C3", "the cell menu; C3 selected", "high", SMALL, [("longpress", "C3")], {"menu": CELLMENU, "sel": ("cells", "C3")}, dev="phone")
case("P02", 2, "phone: long press row number 3", "the row menu; row 3 selected", "high", SMALL, [("longpress", "r3")], {"menu": ROWMENU, "sel": ("rows", 3, 3)}, dev="phone")
case("P03", 2, "phone: long press column letter C", "the column menu", "high", SMALL, [("longpress", "cC")], {"menu": COLMENU, "sel": ("cols", "C", "C")}, dev="phone")
case("P04", 4, "phone: long press row number 5, tap Insert", "a row inserted at 5; formulas follow", "high",
     ROWS, [("longpress", "r5"), ("tapitem", "Insert")], {"lo": True}, lo=[("ins", "A5", "rows")], dev="phone")
case("P05", 3, "phone: long press C3, tap Insert..., tap Entire row, tap OK", "a row inserted at 3", "high",
     FORMS_C, [("longpress", "C3"), ("tapitem", INS), ("tapdlg", "Entire row"), ("tapdlg", "OK")], {"lo": True}, lo=[("ins", "C3", "rows")], dev="phone")
case("P06", 2, "phone: long press C3, then tap B6", "the menu closes", "medium", SMALL, [("longpress", "C3"), ("tap", "B6")], {"menu": None}, dev="phone")
case("P07", 2, "phone: long press C12", "the menu is wholly on the screen", "medium", SMALL, [("longpress", "C12")], {"menu": CELLMENU, "menu_on_screen": True}, dev="phone")
case("P08", 2, "phone: a short tap on C3", "no menu; C3 selected", "medium", SMALL, [("tap", "C3")], {"menu": None, "sel": ("cells", "C3")}, dev="phone")
case("P09", 5, "phone: long press C3, tap Format Cells...", "the dialog is wholly on the screen", "medium",
     SMALL, [("longpress", "C3"), ("tapitem", FMT)], {"dlg": "Format Cells", "dlg_on_screen": True}, dev="phone")
case("P10", 6, "phone: long press row number 3, Row Height..., 30, OK", "row 3 twice as tall", "medium",
     ROWS, [("longpress", "r3"), ("tapitem", RH), ("field", "30"), ("tapdlg", "OK")], {"row_h": {3: 2.0}}, dev="phone")
case("P11", 6, "phone: long press row number 3, tap Hide", "row 3 hidden", "high", ROWS, [("longpress", "r3"), ("tapitem", "Hide")], {"hidden_rows": [3]}, dev="phone")
case("P12", 2, "phone: tap A2, Select range, tap B3, then long press A3 (inside)", "A2:B3 stays selected", "medium",
     SMALL, [("tap", "A2"), ("button", "Select range"), ("tap", "B3"), ("longpress", "A3")], {"sel": ("cells", "A2:B3"), "menu": CELLMENU}, dev="phone")
case("P13", 2, "phone: long press A2 (a cell with a word in it)", "no page text gets selected", "low", SMALL, [("longpress", "A2")], {"notext": True, "menu": CELLMENU}, dev="phone")
case("P14", 4, "phone: long press column letter C, tap Delete", "column C deleted", "high",
     COLS, [("longpress", "cC"), ("tapitem", "Delete")], {"lo": True}, lo=[("del", "C1", "cols")], dev="phone")
case("P15", 8, "phone: long press row number 3, Insert, then the undo button", "back as it was", "high",
     ROWS, [("longpress", "r3"), ("tapitem", "Insert"), ("button", "↶")], {"cells_exact": ROWS}, dev="phone")
case("P16", 3, "phone: long press C3, Delete..., Shift cells up, OK", "C3 removed, column C moves up", "high",
     FORMS_C, [("longpress", "C3"), ("tapitem", DEL), ("tapdlg", "Shift cells up"), ("tapdlg", "OK")], {"lo": True}, lo=[("del", "C3", "up")], dev="phone")
