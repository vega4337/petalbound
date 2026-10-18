/* Asset paths are relative to index.html: works on GitHub project pages and file://. */
window.PetalAssets = (() => {
  const paths = {
    meadow: 'assets/art/meadow.png',
    clouds: 'assets/art/clouds.png',
    desert: 'assets/art/desert.png',
    twilight: 'assets/art/twilight.png',
    spirit: 'assets/art/spirit-atlas.png',
    creatures: 'assets/art/creatures-atlas.png'
  };
  const music = ['meadow', 'clouds', 'desert', 'twilight'].map(name => `assets/audio/${name}.wav?v=arrangements-2`);
  const images = {}, failures = [];
  let completed = 0;
  const jobs = Object.entries(paths).map(([name, path]) => new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      if (ok) images[name] = image;
      else failures.push(name);
      completed++;
      const bar = document.getElementById('loadingProgress');
      const text = document.getElementById('loadingText');
      if (bar) bar.style.width = `${completed / Object.keys(paths).length * 100}%`;
      if (text) text.textContent = `Unfolding the world · ${completed} / ${Object.keys(paths).length}`;
      resolve();
    };
    image.onload = () => {
      // A slow connection may complete after the loading-screen timeout.
      images[name] = image;
      const missing = failures.indexOf(name);
      if (missing >= 0) failures.splice(missing, 1);
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = path;
    if (image.complete && image.naturalWidth) finish(true);
    // A browser extension or an unavailable file must never trap the title screen.
    setTimeout(() => finish(Boolean(image.complete && image.naturalWidth)), 12000);
  }));
  return { images, failures, paths, music, ready: Promise.all(jobs) };
})();
