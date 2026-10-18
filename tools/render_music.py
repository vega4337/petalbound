"""Render four original 3:12 ambient chamber arrangements. Python + numpy.

64 bars at 80 BPM: opening, theme, answer, interlude, variation, lift,
reprise, and a gentle return. Note/reverb tails wrap across the loop seam.
No samples, external services, or runtime generation are needed.
"""
from pathlib import Path
from functools import lru_cache
import wave
import numpy as np

RATE, BPM, BARS = 24000, 80, 64
BEAT = 60 / BPM
LENGTH = BARS * 4 * BEAT
SIZE = round(LENGTH * RATE)
OUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


@lru_cache(maxsize=256)
def note(midi, beats, kind):
    frequency = hz(midi)
    seconds = beats * BEAT
    t = np.arange(round(seconds * RATE), dtype=np.float64) / RATE
    phase = 2 * np.pi * frequency * t
    if kind == 'keys':
        # Rounded felt/electric-piano hybrid: soft attack, slowly fading overtones.
        signal = (np.sin(phase + .6 * np.sin(phase) * np.exp(-t * 2))
                  + .16 * np.sin(phase * 2) * np.exp(-t * 2.7)
                  + .035 * np.sin(phase * 3) * np.exp(-t * 4))
        envelope = (1 - np.exp(-t * 65)) * np.exp(-t * 1.5)
    elif kind == 'harp':
        signal = np.sin(phase) + .18 * np.sin(phase * 2) + .045 * np.sin(phase * 3)
        envelope = (1 - np.exp(-t * 100)) * np.exp(-t * 2.2)
    elif kind == 'flute':
        vibrato = .022 * np.sin(2 * np.pi * 4.2 * t) * np.minimum(t / .6, 1)
        signal = np.sin(phase + vibrato) + .055 * np.sin(2 * phase)
        envelope = np.minimum(t / .18, 1) * np.minimum((seconds - t) / .45, 1)
        envelope *= .84 + .16 * np.sin(np.pi * t / seconds)
    elif kind == 'celesta':
        signal = np.sin(phase) + .14 * np.sin(phase * 2.002) * np.exp(-t * 3)
        envelope = (1 - np.exp(-t * 75)) * np.exp(-t * 1.8)
    elif kind == 'pad':
        signal = (np.sin(phase) + .23 * np.sin(phase * 1.0012 + .4)
                  + .08 * np.sin(phase * 2))
        envelope = np.minimum(t / .85, 1) * np.minimum((seconds - t) / 1.2, 1)
        envelope *= .82 + .08 * np.sin(2 * np.pi * .19 * t)
    else:
        signal = np.sin(phase) + .07 * np.sin(2 * phase)
        envelope = (1 - np.exp(-t * 18)) * np.exp(-t * .65)
    envelope *= np.minimum((seconds - t) / .035, 1)
    return (signal * np.maximum(0, envelope)).astype(np.float32)


def put(mix, beat, midi, duration, kind, gain):
    signal = note(midi, duration, kind) * gain
    start = round(beat * BEAT * RATE) % SIZE
    first = min(len(signal), SIZE - start)
    mix[start:start + first] += signal[:first]
    if first < len(signal):
        mix[:len(signal) - first] += signal[first:]


# Extended, voice-led chords in C major / A minor; each realm has a different
# harmonic route and melodic language rather than a transposed short ostinato.
CHORDS = [
    [48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59],
    [50, 53, 57, 60], [52, 55, 59, 62], [41, 48, 55, 57], [43, 50, 53, 57],
]
ROUTES = [
    [0, 1, 2, 3, 4, 5, 2, 7, 0, 5, 1, 4, 6, 3, 2, 3],
    [2, 0, 4, 3, 1, 5, 6, 7, 2, 5, 0, 1, 4, 6, 7, 0],
    [1, 4, 6, 5, 1, 0, 2, 7, 4, 5, 1, 3, 6, 4, 7, 0],
    [1, 5, 2, 0, 4, 1, 6, 7, 1, 0, 5, 4, 2, 6, 7, 0],
]
PHRASES = [
    [[(0, 76, 1.5), (2, 74, .7), (3, 72, 2), (6, 67, 1.5)],
     [(0, 69, 2), (3, 72, 1), (4.5, 74, 1.5), (7, 71, 2)],
     [(1, 67, 1), (2.5, 69, 1), (4, 72, 2.5)],
     [(0, 74, 1), (2, 71, 1), (4, 67, 3)]],
    [[(0, 79, 1), (1.5, 76, 1), (4, 74, 2), (7, 72, 1.5)],
     [(1, 77, 1.5), (3, 76, 1.5), (5, 72, 2)],
     [(0, 69, 2), (3, 72, 1.5), (6, 76, 2)],
     [(0, 74, 2), (4, 71, 1), (6, 67, 2)]],
    [[(.5, 69, 2.5), (4, 72, 1.5), (6.5, 71, 1)],
     [(0, 67, 2), (3, 65, 2), (6, 64, 2)],
     [(1, 69, 2), (4, 74, 2.5)],
     [(0, 72, 2.5), (4, 71, 1.5), (6, 67, 2)]],
    [[(0, 76, 2), (3, 71, 1), (5, 72, 2)],
     [(1, 74, 2), (4, 69, 3)],
     [(0, 77, 2), (4, 76, 2), (7, 72, 2)],
     [(0, 71, 2), (3, 67, 2), (6, 64, 2)]],
]

for realm, (name, lead) in enumerate([
    ('meadow', 'keys'), ('clouds', 'harp'), ('desert', 'flute'), ('twilight', 'celesta')
]):
    mix = np.zeros(SIZE, dtype=np.float32)
    for bar in range(BARS):
        section, local = divmod(bar, 8)
        chord = CHORDS[ROUTES[realm][(bar // 2) % 16]]
        at = bar * 4
        fullness = [.65, .85, .9, .55, .8, 1, .8, .55][section]
        # Slowly breathing harmony, with alternating voicing and sustained bass.
        for j, pitch in enumerate(chord):
            put(mix, at + j * .035, pitch + (12 if j == 3 and section == 5 else 0),
                5.7, 'pad', .025 * fullness)
        put(mix, at, chord[0] - 12, 3.7, 'bass', .085 * fullness)
        if local % 2 == 1 and section not in (0, 3, 7):
            put(mix, at + 2.5, chord[0] - 5, 1.7, 'bass', .034)
        # Accompaniment opens and closes; no incessant four-note lead pattern.
        steps = [0, 2.5] if section in (0, 3, 7) else [0, 1.5, 2.5, 3.5]
        order = [0, 2, 1, 3] if bar % 2 == 0 else [2, 1, 3, 1]
        for step, position in enumerate(steps):
            put(mix, at + position + .018 * (bar % 3), chord[order[step]] + 12,
                2.3, 'harp' if realm == 1 else 'keys', .048 * fullness)
        if realm == 3 and local in (2, 6) and section != 3:
            put(mix, at + 1, chord[2] + 24, 3, 'celesta', .023)
    # Two-bar call/response phrases leave room for the game. The opening and
    # interlude are instrumental; later statements change register and timing.
    for section in (1, 2, 4, 5, 6):
        for phrase in range(3):
            pattern = PHRASES[realm][(phrase + section) % 4]
            for beat, pitch, duration in pattern:
                shift = -12 if section == 4 else 0
                put(mix, section * 32 + phrase * 8 + beat, pitch + shift,
                    duration + .7, lead, .067 if realm == 2 else .085)
    # A sparse closing answer resolves towards the opening harmony.
    for beat, pitch in [(240, 72), (244, 71), (248, 67)]:
        put(mix, beat, pitch, 3.5, lead, .042)
    dry = mix.copy()
    for delay, gain in [(.137, .12), (.283, .09), (.419, .065), (.619, .045), (1.073, .025)]:
        mix += np.roll(dry, round(delay * RATE)) * gain
    mix = np.tanh(mix * 1.2)
    # Match perceived loudness across realms, with ample room for game effects.
    rms = np.sqrt(np.mean(mix.astype(np.float64) ** 2))
    mix *= min(.105 / rms, .78 / np.max(np.abs(mix)))
    pcm = np.int16(np.clip(mix, -1, 1) * 32767)
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(pcm.tobytes())
    print(f'{name}: {LENGTH:.0f}s, 64 bars, peak {np.max(np.abs(mix)):.3f}, RMS {np.sqrt(np.mean(mix**2)):.3f}', flush=True)
