"""Rebuild Petalbound's original, seamless instrumental soundtrack.
Requires Python 3 and numpy only. The ready-to-play WAV files are already included.
"""
from pathlib import Path
import wave
import numpy as np

RATE = 24000
BPM = 84
BEAT = 60 / BPM
LENGTH = BEAT * 64  # sixteen bars; wrapped tails make exact, click-free loops
SIZE = round(LENGTH * RATE)
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)

def put(mix, start, signal):
    indices = (np.arange(len(signal)) + round(start * RATE)) % SIZE
    np.add.at(mix, indices, signal)

def note(frequency, seconds, kind, seed=1):
    t = np.arange(round(seconds * RATE)) / RATE
    random = np.random.default_rng(seed)
    if kind == 'piano':
        signal = sum(np.sin(2 * np.pi * frequency * (k + 1) * t + k * .17)
                     * np.exp(-t * (1.1 + k * .8)) / (k + 1) ** 2
                     for k in range(5))
        signal *= (1 - np.exp(-t * 120))
    elif kind == 'harp':
        signal = (np.sin(2*np.pi*frequency*t) + .27*np.sin(4*np.pi*frequency*t)
                  + .09*np.sin(6*np.pi*frequency*t))
        signal *= (1-np.exp(-t*230)) * np.exp(-t*3.2)
    elif kind == 'bell':
        signal = (np.sin(2*np.pi*frequency*t)*np.exp(-t*1.8)
                  + .3*np.sin(2*np.pi*frequency*2.004*t)*np.exp(-t*3)
                  + .1*np.sin(2*np.pi*frequency*3.98*t)*np.exp(-t*5))
        signal *= 1-np.exp(-t*140)
    elif kind == 'flute':
        phase = 2*np.pi*frequency*t + .035*np.sin(2*np.pi*4.4*t)
        signal = np.sin(phase) + .09*np.sin(2*phase)
        signal *= np.minimum(t/.14, 1) * np.minimum((seconds-t)/.3, 1)
    elif kind == 'pad':
        signal = (np.sin(2*np.pi*frequency*t)+.35*np.sin(2*np.pi*frequency*1.002*t)
                  +.12*np.sin(4*np.pi*frequency*t))
        signal *= np.minimum(t/.5, 1) * np.minimum((seconds-t)/.8, 1) * .75
    elif kind == 'brush':
        signal = random.normal(0, .2, len(t)) * np.exp(-t*35)
        signal = np.convolve(signal, np.ones(6)/6, mode='same')
    else:
        signal = np.sin(2*np.pi*frequency*t) * (1-np.exp(-t*70)) * np.exp(-t*1.5)
    signal *= np.minimum((seconds-t)/.02, 1)
    return signal

def hz(midi): return 440 * 2 ** ((midi-69)/12)

motif = [0,4,7,12,11,7,4,2,5,9,12,16,14,12,9,5,
         4,7,11,14,16,14,12,7,5,9,12,14,12,9,7,2]
for biome, (name, root, instrument) in enumerate([
    ('meadow', 60, 'piano'), ('clouds', 62, 'harp'),
    ('desert', 60, 'flute'), ('twilight', 57, 'bell')
]):
    mix = np.zeros(SIZE, dtype=np.float64)
    for bar in range(16):
        chord = [[0,4,7,11], [5,9,12,16], [7,11,14,17], [0,4,7,14]][bar//2 % 4]
        for degree in chord:
            put(mix, bar*4*BEAT, note(hz(root-12+degree), 4.7*BEAT, 'pad')*.065)
        put(mix, bar*4*BEAT, note(hz(root-24+chord[0]), 2.4*BEAT, 'bass')*.13)
        for step in range(4):
            when = (bar*4 + step + (.035 if step%2 else 0))*BEAT
            degree = motif[(bar*4+step)%32]
            if (bar+step)%7 != 6:
                put(mix, when, note(hz(root+degree), 1.65*BEAT, instrument)*.15)
            if biome != 2 and step % 2 == 0:
                put(mix, when+.5*BEAT, note(hz(root+12+chord[step]), .9*BEAT, 'bell')*.03)
            if biome < 3:
                put(mix, when, note(80, .12, 'brush', bar*5+step)*.18)
    # Soft multi-tap room reflection, wrapped around the loop instead of truncated.
    dry = mix.copy()
    for delay, gain in [(.113,.14),(.227,.10),(.379,.075),(.571,.045)]:
        mix += np.roll(dry, round(delay*RATE))*gain
    mix = np.tanh(mix*1.4)
    mix *= .82 / max(.82, np.max(np.abs(mix)))
    pcm = np.int16(np.clip(mix,-1,1)*32767)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as handle:
        handle.setnchannels(1); handle.setsampwidth(2); handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())
    print(f'{name}: {LENGTH:.2f}s · {RATE} Hz · peak {np.max(np.abs(mix)):.3f}')
