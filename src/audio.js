/* Original, pre-rendered music stems. All four start in the initial user gesture
   so later biome crossfades also work under mobile autoplay restrictions. */
window.PetalSoundtrack = class PetalSoundtrack {
  constructor(paths) {
    this.started = false;
    this.failed = false;
    this.volume = .45;
    this.rate = 1;
    this.levels = [0, 0, 0, 0];
    this.tracks = paths.map(path => {
      const track = new Audio(path);
      track.loop = true;
      track.preload = 'none';
      track.volume = 0;
      track.addEventListener('error', () => { this.failed = true; });
      return track;
    });
  }
  start() {
    this.started = true;
    for (const track of this.tracks) {
      if (track.paused) track.play().catch(() => {});
    }
  }
  pause() { for (const track of this.tracks) track.pause(); }
  mix(biome, blend, muted, paused, intensity = 0) {
    if (!this.started) return;
    if (this.failed) { this.pause(); return; }
    if (paused) { this.pause(); return; }
    this.rate += ((.98 + Math.min(1, intensity) * .055) - this.rate) * .035;
    for (let i = 0; i < this.tracks.length; i++) {
      const weight = i === biome ? 1 - blend : i === (biome + 1) % 4 ? blend : 0;
      const target = muted ? 0 : Math.sqrt(weight) * this.volume * .65;
      this.levels[i] += (target - this.levels[i]) * .13;
      this.tracks[i].volume = Math.max(0, Math.min(1, this.levels[i]));
      this.tracks[i].playbackRate = this.rate;
    }
  }
};
