/* Playback lifecycle regression checks; real browser loop/output checks are
   complementary, because these stubs do not render audible audio. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Context {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; this.resumes = 0; }
  resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({duration: 192}); }
  createGain() { return {gain: {value: 0, setTargetAtTime(value) { this.value = value; }}, connect() {}}; }
  createBufferSource() {
    return {connect() {}, disconnect() {}, start(when, offset) { this.offset = offset; },
      stop() { this.onended?.(); }};
  }
}
class Media {
  constructor() { this.paused = true; this.events = {}; this.currentTime = 0; }
  addEventListener(event, fn) { this.events[event] = fn; }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
let failedPath = null, requests = 0;
const sandbox = {window: {location: {protocol: 'https:'}}, Audio: Media, Date, Set,
  fetch: async path => { requests++; return {ok: path !== failedPath, status: 404, arrayBuffer: async () => new ArrayBuffer(8)}; }};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../src/audio.js'), 'utf8'), sandbox);
const Music = sandbox.window.PetalSoundtrack;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
(async () => {
  const context = new Context(), music = new Music(['a', 'b', 'c', 'd']);
  music.start(context); music.mix(0, 0, false, false); await flush();
  assert.equal(requests, 2, 'Only current/next tracks fetched');
  assert(music.tracks[0].source.loop && music.tracks[0].source.loopEnd === 192);
  context.currentTime = 193.25;
  const loopingSource = music.tracks[0].source;
  music.mix(0, 0, false, false);
  assert.equal(music.tracks[0].source, loopingSource, 'No restart at track duration');
  assert.equal(requests, 2, 'No re-download at loop');
  music.pause();
  assert.equal(music.tracks[0].offset, 1.25, 'Pause preserves wrapped position');
  assert.equal(music.tracks[0].source, null, 'Intentional stop does not restart');
  music.start();
  assert.equal(music.tracks[0].source.offset, 1.25, 'Resume continues from pause');
  music.mix(0, .5, false, false);
  assert.equal(music.tracks[0].gain.gain.value, music.tracks[1].gain.gain.value);
  music.mix(0, 0, true, false);
  assert.equal(music.tracks[0].gain.gain.value, 0);
  music.tracks[0].source.stop();
  assert(music.tracks[0].source, 'Unexpected end recovers automatically');
  context.state = 'interrupted';
  music.mix(0, 0, false, false);
  assert.equal(context.resumes, 1, 'Interrupted audio context resumes');
  failedPath = 'd'; music.mix(2, 0, false, false); await flush();
  assert.equal(music.tracks[0].buffer, null, 'Old realm decoded buffer released');
  assert.equal(music.tracks[1].buffer, null);
  assert(music.tracks[2].source);
  assert(music.tracks[3].failed);
  assert.equal(music.failed, false, 'Next realm failure does not stop current music');
  const late = new Music(['a', 'b']); late.start(context); late.pause(); await flush();
  assert.equal(late.tracks[0].source, null, 'Loading completion respects pause');
  late.start(); assert(late.tracks[0].source);
  sandbox.window.location.protocol = 'file:';
  const local = new Music(['a', 'b']); local.start(context);
  assert.equal(local.mode, 'media'); assert(local.tracks[0].media.loop);
  const media = local.tracks[0].media; media.currentTime = 192; media.paused = true; media.events.ended();
  assert.equal(media.currentTime, 0); assert.equal(media.paused, false, 'Local-file fallback restarts');
  local.pause(); media.events.ended(); assert(media.paused, 'Paused fallback remains silent');
  console.log('PASS: native loop configuration, pause/resume offsets, mute, crossfades, end recovery, interruptions, realm eviction, failure isolation, async loading and local-file fallback.');
})().catch(error => { console.error(error); process.exitCode = 1; });
