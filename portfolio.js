(() => {
  const room = document.getElementById('projector-room');
  const canvas = document.getElementById('room-light');
  const context = canvas?.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let previousMotionPreference;
  try { previousMotionPreference = localStorage.getItem('zw-motion'); } catch { /* Storage is optional. */ }
  if (context) enhanceRoom();

  function enhanceRoom() {
    const title = document.getElementById('hero-title');
    const control = document.getElementById('lamp-control');
    const input = document.getElementById('lamp-position');
    const phone = matchMedia('(max-width: 660px)');
    const plate = room.querySelector('img');
    let view;
    let frame = 0;
    let previousTime = 0;
    let position = Number(input.value);
    let target = position;
    let visible = true;
    let ready = false;

    function requestFrame() {
      if (ready && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    }

    function measure() {
      const box = room.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const density = Math.min(devicePixelRatio || 1, Math.sqrt(880000 / (box.width * box.height)));
      canvas.width = Math.floor(box.width * density);
      canvas.height = Math.floor(box.height * density);
      const style = getComputedStyle(title);
      context.font = `700 ${style.fontSize} "Barlow Condensed"`;
      if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing;
      const metrics = context.measureText('SLIDE PROJECTOR');
      const ascent = metrics.fontBoundingBoxAscent || parseFloat(style.fontSize) * .83;
      const descent = metrics.fontBoundingBoxDescent || parseFloat(style.fontSize) * .2;
      const lines = Array.from(title.children, (span) => {
        const rect = span.getBoundingClientRect();
        return {
          word: span.textContent.toUpperCase(),
          x: rect.left - box.left,
          y: rect.top - box.top + (rect.height + ascent - descent) / 2
        };
      });
      view = { width: box.width, height: box.height, lines, font: context.font, spacing: style.letterSpacing };
      requestFrame();
    }

    function point(x, y, z) {
      const [width, height, cx, cy, focal] = phone.matches
        ? [640, 850, 400, 455, 650]
        : [1440, 690, 720, 313, 950];
      const scale = focal / (8.5 - z);
      return {
        x: (cx + x * scale) * view.width / width,
        y: (cy - (y - .8) * scale) * view.height / height
      };
    }

    function polygon(points, fill) {
      context.beginPath();
      points.forEach(({ x, y }, index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.closePath();
      context.fillStyle = fill;
      context.fill();
    }

    function textAt(dx, dy, color) {
      context.fillStyle = color;
      for (const line of view.lines) context.fillText(line.word, line.x + dx, line.y + dy);
    }

    function draw() {
      const { width, height, font, spacing } = view;
      const unit = Math.min(width / (phone.matches ? 640 : 1440), height / (phone.matches ? 850 : 690));
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      context.clearRect(0, 0, width, height);
      context.font = font;
      if ('letterSpacing' in context) context.letterSpacing = spacing;

      const slide = position / 100;
      const lensX = -1.9 + slide * (phone.matches ? .46 : .67);
      const lens = point(lensX, -.03, 3.7);
      const projectedLens = point(lensX, -.03, 0);
      const aimX = width * (phone.matches ? .54 : .62) + slide * width * .062;
      const aimY = height * .37;
      const aperture = [
        { x: aimX - width * .30, y: aimY - height * .19 },
        { x: aimX + width * .28, y: aimY - height * .17 },
        { x: aimX + width * .32, y: aimY + height * .19 },
        { x: aimX - width * .25, y: aimY + height * .18 }
      ];

      const railStart = point(-1.9 - (phone.matches ? .46 : .67), -.03, 3.7);
      const railEnd = point(-1.9 + (phone.matches ? .46 : .67), -.03, 3.7);
      context.fillStyle = '#272820';
      context.fillRect(railStart.x - 13 * unit, lens.y + 7 * unit, railEnd.x - railStart.x + 26 * unit, 9 * unit);
      context.fillStyle = '#534b35';
      context.fillRect(railStart.x - 13 * unit, lens.y + 7 * unit, railEnd.x - railStart.x + 26 * unit, 2 * unit);
      const casing = context.createLinearGradient(0, lens.y - 10 * unit, 0, lens.y + 12 * unit);
      casing.addColorStop(0, '#837d64');
      casing.addColorStop(.28, '#49473b');
      casing.addColorStop(1, '#21231c');
      context.fillStyle = casing;
      context.fillRect(lens.x - 20 * unit, lens.y - 11 * unit, 27 * unit, 24 * unit);
      context.fillStyle = '#242720';
      context.fillRect(lens.x - 7 * unit, lens.y - 9 * unit, 15 * unit, 20 * unit);
      context.fillStyle = '#c5ac70';
      context.fillRect(lens.x + 5 * unit, lens.y - 7 * unit, 3 * unit, 15 * unit);

      context.save();
      context.globalCompositeOperation = 'screen';
      const ray = context.createLinearGradient(lens.x, lens.y, aimX, aimY);
      ray.addColorStop(0, '#e3bd6f64');
      ray.addColorStop(.22, '#bfa57431');
      ray.addColorStop(.82, '#d9bb6b08');
      ray.addColorStop(1, '#d9bb6b00');
      context.save();
      context.filter = `blur(${3 * unit}px)`;
      polygon([lens, aperture[0], aperture[1], aperture[2]], ray);
      context.restore();
      const light = context.createRadialGradient(aimX, aimY, 0, aimX, aimY, width * .36);
      light.addColorStop(0, '#d5ad524e');
      light.addColorStop(.52, '#d2b3772c');
      light.addColorStop(1, '#d5bc8f00');
      context.save();
      context.filter = `blur(${7 * unit}px)`;
      polygon(aperture, light);
      context.restore();
      const halo = context.createRadialGradient(lens.x, lens.y, 0, lens.x, lens.y, 21 * unit);
      halo.addColorStop(0, '#fff3c8e8');
      halo.addColorStop(.25, '#ffdc809b');
      halo.addColorStop(1, '#ffd07500');
      context.fillStyle = halo;
      context.fillRect(lens.x - 22 * unit, lens.y - 22 * unit, 44 * unit, 44 * unit);
      context.restore();

      // Intersection of the point-source rays with Z=0, in the fixed camera's image.
      const standOff = .44;
      const scale = (3.7 / (3.7 - standOff)) * ((8.5 - standOff) / 8.5);
      context.save();
      context.translate(projectedLens.x * (1 - scale), projectedLens.y * (1 - scale));
      context.scale(scale, scale);
      context.shadowColor = '#191b14a0';
      context.shadowBlur = 5 * unit * canvas.width / width;
      textAt(0, 0, '#24261b92');
      context.restore();

      const sideLight = Math.round(81 + 20 * (slide + 1));
      for (let depth = 6; depth >= 1; depth--) {
        textAt(depth * unit * (.77 - slide * .55), depth * unit, `rgb(${sideLight}, ${sideLight - 15}, ${sideLight - 34})`);
      }
      const face = context.createLinearGradient(aimX - width * .34, 0, aimX + width * .34, 0);
      face.addColorStop(0, '#c1af83');
      face.addColorStop(.48, '#fff1cd');
      face.addColorStop(.74, '#eee0b9');
      face.addColorStop(1, '#bcac87');
      textAt(0, 0, face);
      room.classList.add('is-lit');
    }

    function render(now) {
      frame = 0;
      if (!view) return;
      const elapsed = previousTime ? Math.min(50, now - previousTime) : 16;
      previousTime = now;
      const difference = target - position;
      position = motion.matches || previousMotionPreference === 'off' || Math.abs(difference) < .25
        ? target
        : position + difference * (1 - Math.exp(-elapsed / 48));
      draw();
      if (position !== target) requestFrame();
      else previousTime = 0;
    }

    input.addEventListener('input', () => {
      target = Number(input.value);
      requestFrame();
    });
    motion.addEventListener('change', requestFrame);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : requestFrame());
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) requestFrame();
      else stop();
    }).observe(room);
    canvas.addEventListener('contextlost', () => {
      stop();
      ready = false;
      room.classList.remove('is-lit');
      control.hidden = true;
    });
    canvas.addEventListener('contextrestored', () => {
      ready = true;
      control.hidden = false;
      measure();
    });

    // The plate and legible DOM title are already present while enhancement loads.
    Promise.all([document.fonts.load('700 48px "Barlow Condensed"'), plate.decode()])
      .then(([fonts]) => {
        if (fonts.length === 0) return;
        ready = true;
        control.hidden = false;
        new ResizeObserver(measure).observe(room);
        measure();
      })
      .catch(() => {});
  }

  const preview = document.querySelector('.image-study');
  if (!preview) return;
  const observePreview = new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    const math = [
      import('./research/image-lab.mjs'),
      import('./research/math.mjs')
    ];
    Promise.all(math).then(([images, transforms]) => {
      const controls = document.getElementById('details-control');
      const input = document.getElementById('image-details');
      const output = document.getElementById('details-value');
      const reconstructed = document.getElementById('example-image');
      const still = document.getElementById('example-still');
      const raster = reconstructed.getContext('2d');
      if (!raster) return;
      const source = images.generateTeachingImage('fields');
      const transform = transforms.haar2D(source, 64);
      const pixels = raster.createImageData(64, 64);
      const coefficients = new Float64Array(source.length);
      let frame = 0;

      function update() {
        frame = 0;
        const percent = Number(input.value);
        const retained = images.retainHaarDetails(transform, percent, coefficients);
        const values = transforms.inverseHaar2D(retained);
        values.forEach((value, index) => {
          const tone = Math.min(1, Math.max(0, value));
          const offset = index * 4;
          pixels.data[offset] = 23 + tone * 209;
          pixels.data[offset + 1] = 30 + tone * 196;
          pixels.data[offset + 2] = 27 + tone * 167;
          pixels.data[offset + 3] = 255;
        });
        raster.putImageData(pixels, 0, 0);
        reconstructed.setAttribute('aria-label', `Generated fields reconstructed from ${percent}% of the wavelet details plus the average.`);
        output.value = `${percent}%`;
      }

      update();
      still.hidden = true;
      reconstructed.hidden = false;
      controls.hidden = false;
      input.addEventListener('input', () => {
        if (!frame) frame = requestAnimationFrame(update);
      });
    }).catch(() => {});
  }, { rootMargin: '120px' });
  observePreview.observe(preview);
})();
