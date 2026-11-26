# pdfw.py -- a tiny PDF writer for the hand-made fixtures of review 2: objects written as given, with a classic
# cross-reference table, an xref stream, object streams, a hybrid file, and incremental updates appended to an
# existing file. Nothing here is Lantern's.
import zlib, re

def ser(v):
    if v is None: return b"null"
    if v is True: return b"true"
    if v is False: return b"false"
    if isinstance(v, bytes): return v
    if isinstance(v, int): return str(v).encode()
    if isinstance(v, float): return ("%.4f" % v).rstrip("0").rstrip(".").encode()
    if isinstance(v, str): return v.encode("latin-1")
    if isinstance(v, list): return b"[" + b" ".join(ser(x) for x in v) + b"]"
    if isinstance(v, dict): return b"<<" + b" ".join(b"/" + k.encode() + b" " + ser(x) for k, x in v.items()) + b">>"
    raise TypeError(type(v))

def R(n, g=0): return ("%d %d R" % (n, g)).encode()
def lit(s):
    if isinstance(s, str): s = s.encode("latin-1")
    return b"(" + s.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)") + b")"
def hexs(b): return b"<" + b.hex().encode() + b">"
def utf16(s): return hexs(b"\xfe\xff" + s.encode("utf-16-be"))

class Stream:
    def __init__(self, data, d=None, compress=True):
        if isinstance(data, str): data = data.encode("latin-1")
        self.d = dict(d or {})
        if compress:
            data = zlib.compress(data); self.d["Filter"] = b"/FlateDecode"
        self.data = data

def body(num, v, gen=0):
    head = ("%d %d obj\n" % (num, gen)).encode()
    if isinstance(v, Stream):
        d = dict(v.d); d["Length"] = len(v.data)
        return head + ser(d) + b"\nstream\n" + v.data + b"\nendstream\nendobj\n"
    return head + ser(v) + b"\nendobj\n"

def classic(objs, root, info=None, header=b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", extra_trailer=None):
    """objs: {num: value}; a plain file with a classic table"""
    out = bytearray(header); offs = {}
    for n in sorted(objs):
        offs[n] = len(out); out += body(n, objs[n])
    size = max(objs) + 1
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % size
    for n in range(1, size):
        out += (b"%010d 00000 n \n" % offs[n]) if n in offs else b"0000000000 65535 f \n"
    tr = {"Size": size, "Root": R(root)}
    if info: tr["Info"] = R(info)
    if extra_trailer: tr.update(extra_trailer)
    out += b"trailer\n" + ser(tr) + b"\nstartxref\n%d\n%%%%EOF\n" % x
    return bytes(out), offs, x

def xref_stream_bytes(entries, size, root, prev=None, info=None, num=None, index=None, extra=None):
    """entries: {objnum: (type, f2, f3)}; returns the xref stream object (bytes) to be written at its offset"""
    nums = sorted(entries)
    if index is None:
        index = []
        for n in nums:
            if index and index[-2] + index[-1] == n: index[-1] += 1
            else: index += [n, 1]
    rows = b""
    for n in nums:
        t, a, b = entries[n]
        rows += bytes([t]) + a.to_bytes(4, "big") + b.to_bytes(2, "big")
    d = {"Type": b"/XRef", "Size": size, "W": [1, 4, 2], "Index": index, "Root": R(root)}
    if prev is not None: d["Prev"] = prev
    if info: d["Info"] = R(info)
    if extra: d.update(extra)
    return body(num, Stream(rows, d))

def objstm(pairs, first_num=None):
    """pairs: [(num, value)] -> Stream holding them"""
    heads, bodies, off = [], b"", 0
    for n, v in pairs:
        b = ser(v) + b"\n"
        heads.append(b"%d %d" % (n, off)); off += len(b); bodies += b
    head = b" ".join(heads) + b"\n"
    return Stream(head + bodies, {"Type": b"/ObjStm", "N": len(pairs), "First": len(head)})

def with_objstm(plain, packed, root, info=None, header=b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"):
    """plain: {num: value} written on their own; packed: {num: value} in one object stream; an xref stream at the end"""
    out = bytearray(header); ent = {0: (0, 0, 65535)}
    for n in sorted(plain):
        ent[n] = (1, len(out), 0); out += body(n, plain[n])
    sn = max(list(plain) + list(packed)) + 1
    st = objstm(sorted(packed.items()))
    ent[sn] = (1, len(out), 0); out += body(sn, st)
    for k, n in enumerate(sorted(packed)): ent[n] = (2, sn, k)
    xn = sn + 1; ent[xn] = (1, len(out), 0)
    x = len(out)
    out += xref_stream_bytes(ent, xn + 1, root, info=info, num=xn)
    out += b"startxref\n%d\n%%%%EOF\n" % x
    return bytes(out)

def last_startxref(b):
    m = list(re.finditer(rb"startxref\s+(\d+)", b))[-1]
    return int(m.group(1))

def update_classic(base, objs, root, size, info=None):
    """an incremental update with a classic table, /Prev to the base's last section"""
    prev = last_startxref(base)
    out = bytearray(base)
    if not out.endswith(b"\n"): out += b"\n"
    offs = {}
    for n in sorted(objs):
        offs[n] = len(out); out += body(n, objs[n])
    x = len(out)
    out += b"xref\n0 1\n0000000000 65535 f \n"
    for n in sorted(offs):
        out += b"%d 1\n%010d 00000 n \n" % (n, offs[n])
    tr = {"Size": size, "Root": R(root), "Prev": prev}
    if info: tr["Info"] = R(info)
    out += b"trailer\n" + ser(tr) + b"\nstartxref\n%d\n%%%%EOF\n" % x
    return bytes(out)

def update_xrefstm(base, objs, root, size, packed=None, info=None, free=None):
    """an incremental update with an xref stream (and, if given, a new object stream holding `packed`)"""
    prev = last_startxref(base)
    out = bytearray(base)
    if not out.endswith(b"\n"): out += b"\n"
    ent = {}
    for n in sorted(objs):
        ent[n] = (1, len(out), 0); out += body(n, objs[n])
    nxt = size
    if packed:
        sn = nxt; nxt += 1
        ent[sn] = (1, len(out), 0); out += body(sn, objstm(sorted(packed.items())))
        for k, n in enumerate(sorted(packed)): ent[n] = (2, sn, k)
    for n in (free or []): ent[n] = (0, 0, 1)
    xn = nxt; nxt += 1
    ent[xn] = (1, len(out), 0)
    x = len(out)
    out += xref_stream_bytes(ent, nxt, root, prev=prev, info=info, num=xn)
    out += b"startxref\n%d\n%%%%EOF\n" % x
    return bytes(out)
