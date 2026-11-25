#!/usr/bin/env python3
"""Embed simplified meshes of the robot parts into the UI data file.

usage: build-stl-assets.py <dir with the 3 zip files> <ui/src/data.js>

Reads the binary STL files listed in MESHES from the zip archives, simplifies them by vertex
clustering (about 4000 triangles each, enough for a preview) and rewrites the block between
`// BEGIN STL-ASSETS` and `// END STL-ASSETS` in data.js. Parts without an entry in PART_MESH
stay "STL non disponible" in the app and get an upload button.
"""
import base64, json, re, struct, sys, zipfile
from pathlib import Path

HEAD = 'lucky-13-t800-head-model_files.zip'
FIG = 'lucky-13-printable-jointed-figure-model_files.zip'
A = 'individual parts - armature/'

# mesh key -> (zip, member, label)
MESHES = {
    'head': (HEAD, 't800_lucky13_update.stl', 'Tête T-800 (Lucky 13)'),
    'chest': (FIG, A + '00A03 armature chest.stl', 'Armature torse (Lucky 13)'),
    'hips': (FIG, A + '00A06 armature hips.stl', 'Armature bassin (Lucky 13)'),
    'thigh': (FIG, A + '00A12 [2X] armature thigh.stl', 'Armature cuisse (Lucky 13)'),
    'knee': (FIG, A + '00A13 [2X] armature knee.stl', 'Armature genou (Lucky 13)'),
    'shin': (FIG, A + '00A14 [2X] armature shin.stl', 'Armature tibia (Lucky 13)'),
    'foot': (FIG, A + '00A15L armature foot left.stl', 'Armature pied gauche (Lucky 13)'),
    'shoulder': (FIG, A + '00A08 [2X] armature shoulder.stl', 'Armature épaule (Lucky 13)'),
    'upperarm': (FIG, A + '00A09L armature upper arm left.stl', 'Armature bras gauche (Lucky 13)'),
}
# print id -> mesh key (only parts for which a matching STL exists)
PART_MESH = {
    'IM-101': 'thigh', 'IM-102': 'thigh', 'IM-103': 'foot',
    'IM-105': 'shin', 'IM-106': 'head', 'IM-107': 'shin', 'IM-108': 'shin', 'IM-109': 'shin',
    'IM-110': 'hips', 'IM-112': 'shoulder', 'IM-114': 'chest', 'IM-115': 'knee',
    'IM-117': 'chest', 'IM-118': 'upperarm', 'IM-119': 'head',
}
TARGET = 4000


def read_stl(buf):
    n = struct.unpack_from('<I', buf, 80)[0]
    if len(buf) != 84 + 50 * n:
        raise SystemExit('not a binary STL')
    return [struct.unpack_from('<9f', buf, 84 + 50 * i + 12) for i in range(n)]


def cluster(tris, lo, cell):
    vid, verts, out = {}, [], set()

    def vtx(x, y, z):
        key = (int((x - lo[0]) / cell), int((y - lo[1]) / cell), int((z - lo[2]) / cell))
        if key not in vid:
            vid[key] = len(verts)
            verts.append(key)
        return vid[key]

    for t in tris:
        a, b, c = vtx(*t[0:3]), vtx(*t[3:6]), vtx(*t[6:9])
        if a != b and b != c and a != c:
            out.add((a, b, c))
    return verts, sorted(out)


def simplify(tris, target):
    lo = tuple(min(t[k + j] for t in tris for k in (0, 3, 6)) for j in range(3))
    hi = tuple(max(t[k + j] for t in tris for k in (0, 3, 6)) for j in range(3))
    span = max(hi[k] - lo[k] for k in range(3)) or 1.0
    best = None
    for g in (16, 20, 28, 36, 48, 64, 80, 96, 128, 160, 200):
        cell = span / g
        verts, out = cluster(tris, lo, cell)
        if len(out) > target and best:
            break
        best = (cell, verts, out)
    cell, verts, out = best
    return lo, cell, verts, out


def pack(lo, cell, verts, tris):
    v = []
    for (i, j, k) in verts:
        v += [lo[0] + (i + .5) * cell, lo[1] + (j + .5) * cell, lo[2] + (k + .5) * cell]
    vb = base64.b64encode(struct.pack('<%df' % len(v), *v)).decode()
    ib = base64.b64encode(struct.pack('<%dH' % (3 * len(tris)), *[i for t in tris for i in t])).decode()
    return {'v': vb, 'i': ib, 'tris': len(tris)}


def main():
    src, data_js = Path(sys.argv[1]), Path(sys.argv[2])
    assets = {}
    for key, (zname, member, label) in MESHES.items():
        with zipfile.ZipFile(src / zname) as z:
            tris = read_stl(z.read(member))
        lo, cell, verts, out = simplify(tris, TARGET)
        assert len(verts) < 65536
        assets[key] = dict(pack(lo, cell, verts, out), label=label, source=zname, member=member, original=len(tris))
        print(key, len(tris), '->', len(out), 'triangles')
    block = ('// BEGIN STL-ASSETS\n'
             '  var STL_BUNDLE = ' + json.dumps({'meshes': assets, 'parts': PART_MESH}, separators=(',', ':'), ensure_ascii=False) + ';\n'
             '  // END STL-ASSETS')
    text = data_js.read_text(encoding='utf-8')
    pat = re.compile(r'// BEGIN STL-ASSETS.*?// END STL-ASSETS', re.S)
    if not pat.search(text):
        raise SystemExit('markers not found in data.js')
    data_js.write_text(pat.sub(lambda m: block, text), encoding='utf-8')


main()
