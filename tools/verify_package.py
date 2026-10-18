"""Check the extracted game package with Python's standard library only."""
from pathlib import Path
from html.parser import HTMLParser
import re
import struct
import wave
import array

ROOT = Path(__file__).resolve().parents[1]

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.paths = [], []
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        for key in ('src','href'):
            if key in attrs and not attrs[key].startswith(('http:','https:','#')):
                self.paths.append(attrs[key])

document = Document()
document.feed((ROOT/'index.html').read_text(encoding='utf-8'))
assert len(document.ids) == len(set(document.ids)), 'Duplicate HTML id'
for relative in document.paths:
    assert (ROOT/relative.split('?')[0]).is_file(), f'Missing file: {relative}'

scripts = '\n'.join(p.read_text(encoding='utf-8') for p in (ROOT/'src').glob('*.js'))
ids = set(re.findall(r'''\$\(["']([\w-]+)["']\)''', scripts))
assert ids <= set(document.ids), f'Unresolved elements: {ids-set(document.ids)}'

for file in (ROOT/'assets/art').glob('*.png'):
    with file.open('rb') as image:
        header = image.read(24)
    assert header[:8] == b'\x89PNG\r\n\x1a\n', f'Invalid PNG: {file.name}'
    width,height = struct.unpack('>II',header[16:24])
    assert width >= 1000 and height >= 700
    print(f'Art OK: {file.name} ({width} x {height})')

for file in (ROOT/'assets/audio').glob('*.wav'):
    with wave.open(str(file),'rb') as audio:
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
        assert audio.getframerate() == 24000 and audio.getnframes() > 1000000
        assert audio.getnframes() / audio.getframerate() == 192, f'Unexpected duration: {file.name}'
        values = array.array('h', audio.readframes(audio.getnframes()))
    assert max(map(abs,values)) < 32700, f'Clipping: {file.name}'
    assert abs(values[-1]-values[0]) < 2000, f'Loop discontinuity: {file.name}'
    print(f'Audio OK: {file.name}')

assert len(list((ROOT/'assets/art').glob('*.png'))) == 6
assert len(list((ROOT/'assets/audio').glob('*.wav'))) == 4
print(f'Package passed. {len(document.ids)} UI elements and every required asset resolved.')
