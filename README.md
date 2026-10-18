# Petalbound Deluxe — The Four Lights

A complete, build-free browser platformer with original painted scenery and character sprites, four pre-rendered instrumental loops, a four-realm story, an encounter with the Moonkeeper, and an independent endless mode.

**Everything required to play is included.** There are no remote scripts, CDN dependencies, API keys, account requirements, paid asset packs, or runtime package installations.

## Play online

[Play Petalbound Deluxe](https://vega4337.github.io/petalbound/) in your phone or desktop browser. On phones, rotate to landscape and use the on-screen arrow, JUMP, and DASH buttons.

## Start here

1. Extract the entire ZIP. Do not run the game from inside the compressed archive.
2. Open **START-HERE.html** for the visual setup guide, or open **index.html** to play immediately.
3. On Windows, **PLAY-WINDOWS.bat** opens the game in your default browser.
4. Click **Begin the story**. Audio starts after your click, as required by browsers.

Keep `index.html`, `styles.css`, `src`, and `assets` together. Moving only the HTML file will separate it from its artwork and music.

Modern desktop Chrome, Edge, Firefox, and Safari are the intended local targets. Phones and tablets should use the hosted website link. Landscape gives a much wider view of the upcoming terrain.

If your browser restricts local files, use a local server instead:

- Windows with Python: double-click **SERVE-WINDOWS.bat**.
- Or open a terminal in this folder and run `python -m http.server 8000 --bind 127.0.0.1` (on macOS/Linux, use `python3`).
- Open `http://127.0.0.1:8000`. If the browser opens before the server is ready, refresh it once.
- Keep the terminal open while playing; Ctrl+C stops the server.
- You can also run `sh play-local.sh` on macOS/Linux if Python 3 is installed.

The optional Python server only serves the included files. Python is not part of the game engine and is not needed for GitHub Pages or ordinary direct-file play.

## Publish on GitHub Pages

This is the recommended way to share the game with others.

1. Create a new GitHub repository, for example `petalbound`. A **public** repository works with GitHub Free.
2. Extract the ZIP and upload the extracted folder's **contents** to the repository. Upload the actual files and folders, not the ZIP.
3. Ensure `index.html` is directly at the repository root, beside `styles.css`, `src`, and `assets`.
4. Commit the upload to the `main` branch.
5. Go to **Settings → Pages → Build and deployment**.
6. Under **Source**, select **Deploy from a branch**.
7. Choose **main** and **/(root)**, then **Save**.
8. Wait for GitHub to publish it, then use **Visit site** on the Pages settings screen. Publishing can take several minutes.

An empty `.nojekyll` file is included to keep the project a plain static site. There is no build step. If your file uploader does not include dotfiles, the game still uses ordinary static filenames; you can add `.nojekyll` through GitHub's **Add file → Create new file**.

Subfolder hosting is supported: game assets use relative paths rather than `/assets` paths. The same directory works for project sites such as `https://YOUR-USERNAME.github.io/petalbound/`.

Official references:

- [Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Configuring the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Google Apps Script is not required. This edition uses a normal asset folder, which is a natural fit for GitHub Pages or another static website host. The earlier single-file version can still be used with the Apps Script wrapper from the original delivery.

## Controls

| Action | Keyboard | Touch | Standard gamepad |
|---|---|---|---|
| Move | A/D or left/right arrows | Arrow buttons | Left stick or D-pad |
| Jump | Space, W, or up arrow | JUMP | Bottom face button / A |
| Higher jump | Hold jump | Hold JUMP | Hold A |
| Sprint | Hold Shift | Hold DASH | Hold X or right shoulder |
| Petal dash | Tap Shift once unlocked or powered | Tap DASH | Tap X or right shoulder |
| Double jump | Press jump again while airborne once unlocked | Press JUMP again | Press A again |
| Glide | Hold jump while falling once unlocked | Hold JUMP | Hold A |
| Pause | P or Escape | Pause icon | Menu/Start |
| Mute | M | Speaker icon | Use the UI |
| Restart current mode | R | Restart button after failure | Menu starts a new run after failure |
| Fullscreen | F or expand icon | Browser permitting | Use the UI |

The field-guide **?** button explains the mechanics. The sliders button opens music, effects, visual quality, and reduced-motion settings. The **Light** visual option reduces resolution and ambient effects on slower devices.

## Story, secrets, and progression

- **Meadow of Dawn:** learn the terrain and find the first three memory petals.
- **First checkpoint garden, around 600 m:** permanent petal dash unlocks. Dash through any critter, including spiky hedgehogs.
- **Cotton Candy Clouds:** double jump unlocks. Bounce clouds and drifting leaf platforms reward controlled jumps.
- **Sherbet Desert:** leaf glide unlocks. Hold jump while falling; keep moving on sinking sandbars.
- **Twilight Glow Forest:** gather the final petals and reach the last checkpoint garden.
- **The Moonkeeper:** dodge dream wisps while the guardian flies high. When the wings settle, stomp the glowing body or dash through it. Five successful hits awaken the guardian. Then walk right into the open gate.
- **Blossom lotus:** grow larger, gain a protective hit, and break brick blocks.
- **Starfall:** temporary aerial power and a sparkle trail, available even before permanent aerial abilities unlock.
- **Gold stardust:** 100 points each; every 50 grants a life, up to five.
- **Pastel gems:** 500 points each.
- **Memory petals:** twelve optional secrets, worth 1,000 points each plus an ending bonus.

The campaign combines eight room templates in different chapter sequences with realm-specific terrain and enemy combinations. Endless mode chooses new sequences from a seeded generator and gradually increases enemy difficulty. Chunks stream ahead and retire behind checkpoint gardens to keep memory bounded.

Story gardens save progress across visits on the same browser and address. **Continue story** appears on the title screen when a save exists. Resuming returns to the last garden with at least three lives. Collected memory petals, unlocked abilities, score, and journey time are preserved. Ordinary stardust can reappear after a reload. The story's temporary encounter state is restarted when resuming at the final garden.

Starting a new story replaces its saved journey. Starting endless mode preserves the separate story checkpoint. Completing the story clears its active checkpoint and leaves personal records intact.

Browser storage is local: switching browsers, switching from a local file to GitHub, changing the website address, or clearing site data can give you a separate save. No information is uploaded.

## Replace the soundtrack or artwork

No replacement is necessary: the project includes six painted image files and four complete music loops.

### Add your own music

1. Put your audio files in `assets/audio`.
2. Open `src/assets.js` in a text editor.
3. Replace its `music` array with your filenames in realm order. For example:

```javascript
const music = [
  'assets/audio/my-meadow.mp3',
  'assets/audio/my-clouds.mp3',
  'assets/audio/my-desert.mp3',
  'assets/audio/my-twilight.mp3'
];
```

Use tracks with similar loudness and clean loop points. Each track lasts 3 minutes 12 seconds and loops continuously at a steady tempo. Hosted playback uses decoded Web Audio buffers so the loop does not depend on restarting a media element. Only the current and upcoming realm remain decoded in memory, and their volumes crossfade during realm transitions. Pausing preserves the playback position; resuming continues from there. Direct-file play uses HTML audio with an explicit end-of-track restart fallback. Volume is adjustable in-game. Short, responsive jump/coin/impact effects are synthesized through Web Audio; they require no extra files.

The four original instrumental arrangements use warm felt-style keys, harp, flute, celesta, sustained bass, and soft pads. Each 64-bar piece develops through an opening, theme, answer, interlude, variation, lift, reprise, and gentle return. Melody phrases leave space for gameplay; wrapped note and reverb tails join the end back to the beginning. It is not fetched or generated during play. `tools/render_music.py` reproduces the four loops if you have Python and numpy; it is an optional asset-authoring tool, not a play requirement.

### Artwork

Background paths are listed in `src/assets.js`. The panorama renderer handles arbitrary aspect ratios and mirrored horizontal repetition. For the character and creature atlases, retain the frame layout or update the source rectangles in `src/art.js`.

`assets/art/ART-NOTES.md` records the exact prompts used to create the original artwork with the built-in image-generation tool. The original PNG alpha channels are preserved.

## Files and architecture

| File | Purpose |
|---|---|
| `index.html` | Menus, HUD, touch controls, loading screen |
| `styles.css` | Responsive visual design |
| `src/assets.js` | Local asset manifest and resilient image loading |
| `src/audio.js` | File-based soundtrack, crossfades, playback intensity |
| `src/art.js` | Painted panoramas, sprite atlases, lighting, atmosphere, terrain |
| `src/game.js` | Fixed-step physics, room streaming, story, enemies, powers, guardian, saves, UI |
| `assets/art/*.png` | Original painted scenery and sprites |
| `assets/audio/*.wav` | Four ready-to-play instrumental loops |
| `tools/verify_game.cjs` | Dependency-free Node logic regression checks |
| `tools/verify_package.py` | Dependency-free Python package and asset checks |
| `tools/render_music.py` | Optional soundtrack authoring source; requires numpy |

The runtime uses Canvas 2D, classic JavaScript scripts, HTML audio, and Web Audio. It intentionally has no JavaScript modules or fetch-based data loading so direct-file play remains possible. States are `MENU`, `PLAYING`, `PAUSED`, `GAMEOVER`, and `VICTORY`. Physics run at a fixed 120 Hz with buffered jumps and coyote time. Rendering follows the display refresh rate.

## Verification

From the game folder, run these optional checks:

```text
node tools/verify_game.cjs
node tools/verify_audio.cjs
python tools/verify_package.py
```

During authoring, JavaScript syntax, native Canvas renders, platform reach, variable jumps, coyote time, jump buffering, block collisions, powers, dash, glide, bounded streaming, 400 generated chunks, saved-story resume, keyboard/touch event logic, audio envelopes, the guardian's five-hit defeat, and the ending were checked. All four WAV files were inspected for valid format, clipping, and loop boundaries.

Playback was also checked in a mobile-emulated Edge browser: the 192-second buffer continued producing non-silent output across its loop boundary, and pause/resume and mute controls worked. Audio lifecycle regression checks cover interrupted playback, crossfades, end recovery, delayed loading, per-realm failures, buffer release, and direct-file fallback. Physical iPhone/Android playback and perceived musical quality still depend on the actual device and listening preferences.

This repository is published with GitHub Pages from the main branch and repository root.
