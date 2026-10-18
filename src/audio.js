/* Audio-clock loops: no media restart or network request at each seam.
   Decode only the current and next realm to limit phone memory use. */
window.PetalSoundtrack = class PetalSoundtrack {
  constructor(paths) {
    this.started = false;
    this.paused = true;
    this.failed = false;
    this.volume = .45;
    this.ctx = null;
    this.mode = null;
    this.lastResume = -Infinity;
    this.wanted = new Set([0, 1]);
    this.tracks = paths.map(path => ({path, buffer: null, source: null,
      gain: null, offset: 0, startedAt: 0, loading: null, failed: false, media: null}));
  }
  start(context) {
    this.started = true;
    this.paused = false;
    if (!this.mode) {
      this.ctx = context;
      this.mode = context?.createBufferSource && window.location?.protocol !== 'file:' ? 'buffer' : 'media';
      if (this.mode === 'media') this.createMedia();
    }
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    this.sync();
  }
  createMedia() {
    for (const track of this.tracks) {
      const media = track.media = new Audio(track.path);
      media.loop = true;
      media.preload = 'none';
      media.volume = 0;
      media.addEventListener('error', () => { track.failed = true; });
      media.addEventListener('ended', () => {
        if (this.paused) return;
        media.currentTime = 0;
        media.play().catch(() => {});
      });
    }
  }
  load(track) {
    if (track.buffer || track.loading || track.failed) return;
    track.loading = fetch(track.path).then(response => {
      if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
      return response.arrayBuffer();
    }).then(bytes => this.ctx.decodeAudioData(bytes)).then(buffer => {
      if (this.wanted.has(this.tracks.indexOf(track))) track.buffer = buffer;
    }).catch(() => { track.failed = true; }).finally(() => {
      track.loading = null;
      this.sync();
    });
  }
  playBuffer(track) {
    if (track.source || !track.buffer || this.paused) return;
    if (!track.gain) {
      track.gain = this.ctx.createGain();
      track.gain.gain.value = 0;
      track.gain.connect(this.ctx.destination);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = track.buffer.duration;
    source.connect(track.gain);
    track.source = source;
    track.startedAt = this.ctx.currentTime;
    source.onended = () => {
      source.disconnect();
      if (track.source !== source) return;
      track.source = null;
      track.offset = 0;
      if (!this.paused && this.wanted.has(this.tracks.indexOf(track))) this.playBuffer(track);
    };
    source.start(0, track.offset % track.buffer.duration);
  }
  stopBuffer(track) {
    if (!track.source) return;
    const source = track.source;
    track.offset = (track.offset + this.ctx.currentTime - track.startedAt) % track.buffer.duration;
    track.source = null; // Intentional stops must not trigger recovery.
    source.stop();
    source.disconnect();
  }
  sync() {
    if (!this.started) return;
    this.tracks.forEach((track, i) => {
      if (this.mode === 'media') {
        if (this.paused || !this.wanted.has(i)) track.media.pause();
        else if (track.media.paused && !track.failed) track.media.play().catch(() => {});
        return;
      }
      if (!this.wanted.has(i)) {
        this.stopBuffer(track);
        track.buffer = null;
        track.offset = 0;
      } else if (!this.paused) {
        this.load(track);
        this.playBuffer(track);
      }
    });
  }
  pause() {
    this.paused = true;
    for (const track of this.tracks) {
      if (this.mode === 'buffer') this.stopBuffer(track);
      else track.media?.pause();
    }
  }
  mix(biome, blend, muted, paused) {
    if (!this.started) return;
    if (paused) { if (!this.paused) this.pause(); return; }
    this.paused = false;
    if (this.ctx && this.ctx.state !== 'running' && Date.now() - this.lastResume > 1000) {
      this.lastResume = Date.now();
      this.ctx.resume().catch(() => {});
    }
    const next = (biome + 1) % this.tracks.length;
    this.wanted = new Set([biome, next]);
    this.sync();
    this.failed = this.tracks[biome].failed;
    this.tracks.forEach((track, i) => {
      const weight = i === biome ? 1 - blend : i === next ? blend : 0;
      const target = muted ? 0 : Math.sqrt(weight) * this.volume * .65;
      if (track.gain) track.gain.gain.setTargetAtTime(target, this.ctx.currentTime, .12);
      if (track.media) track.media.volume = target;
    });
  }
};
