'use strict';

window.createApparatus = function createApparatus(canvas, plungerTarget, flaskTarget) {
  const ctx = canvas.getContext('2d');
  const WIDTH = 640;
  const HEIGHT = 350;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const palette = {
    teal: '#226c62',
    ink: '#243f57',
    dark: '#172b41',
    blue: '#3884b7',
  };
  let activeLab = '';
  let shown = 0;
  let target = 0;
  let condition = '';
  let frame = 0;
  let flaskDragging = false;
  const bathCenters = { ice: 110, room: 320, hot: 530 };
  let flaskPosition = { x: 320, y: 285 };

  function box(x, y, width, height, radius, fill, stroke = null, lineWidth = 2) {
    ctx.beginPath();
    const corners = Array.isArray(radius) ? radius : [radius, radius, radius, radius];
    const [tl, tr, br, bl] = corners.map((corner) => Math.min(corner, width / 2, height / 2));
    const right = x + width;
    const bottom = y + height;
    ctx.moveTo(x + tl, y);
    ctx.lineTo(right - tr, y);
    ctx.quadraticCurveTo(right, y, right, y + tr);
    ctx.lineTo(right, bottom - br);
    ctx.quadraticCurveTo(right, bottom, right - br, bottom);
    ctx.lineTo(x + bl, bottom);
    ctx.quadraticCurveTo(x, bottom, x, bottom - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function shape(path, fill, stroke = null, lineWidth = 2) {
    const outline = new Path2D(path);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill(outline);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke(outline);
    }
    return outline;
  }

  function oval(x, y, width, height, fill, stroke = null) {
    ctx.beginPath();
    ctx.ellipse(x, y, width, height, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function line(x1, y1, x2, y2, stroke, width = 2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function gradient(x1, y1, x2, y2, stops) {
    const paint = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([offset, color]) => paint.addColorStop(offset, color));
    return paint;
  }

  function label(value, x, y, { size = 15, color = palette.ink, weight = 700, align = 'center', mono = false } = {}) {
    ctx.font = `${weight} ${size}px ${mono ? 'monospace' : '"Noto Sans KR", "Malgun Gothic", system-ui, sans-serif'}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  function shadow(x, y, radius) {
    oval(x, y, radius, 13, '#2547551c');
    oval(x, y, radius * .77, 7, '#25475515');
  }

  function balloon(x, y, radius, flatness = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius * flatness);
    const fill = gradient(-.74, -1.4, .82, -.03, [[0, '#ffac8b'], [.5, '#e77353'], [1, '#c84e41']]);
    shape('M 0 .04 C -.17 -.04 -.86 -.26 -.91 -.88 C -1.04 -1.61 -.57 -1.99 0 -1.99 C .57 -1.99 1.04 -1.61 .91 -.88 C .86 -.26 .17 -.04 0 .04 Z', fill, '#a63b39', .027);
    shape('M -.64 -.93 C -.68 -1.32 -.52 -1.57 -.31 -1.64 C -.21 -1.67 -.17 -1.57 -.25 -1.51 C -.43 -1.36 -.47 -1.16 -.49 -.98 C -.51 -.85 -.63 -.82 -.64 -.93 Z', '#fff4dfa8');
    ctx.restore();
  }

  function drawScale(liters, vacuum = false) {
    shadow(320, 305, 173);
    const body = gradient(0, 244, 0, 300, [[0, '#4b6877'], [.4, '#314e64'], [1, '#243f56']]);
    shape('M 208 241 L 432 241 L 466 272 Q 470 277 467 291 Q 466 302 454 303 H 186 Q 174 302 173 291 Q 170 278 174 272 Z', body, '#213e54', 3);
    shape('M 208 241 H 432 L 459 266 H 181 Z', '#8da4ab', '#496979', 2);
    box(200, 229, 240, 18, 6, '#5f7c89', '#365468', 2);
    box(200, 225, 240, 15, 6, gradient(0, 225, 0, 240, [[0, '#e9f5f3'], [1, '#9eb9bd']]), '#4c6c79', 2);
    line(213, 230, 427, 230, '#f8fffc', 2);
    box(257, 263, 126, 28, 5, '#132d37', '#799398', 1.5);
    label(`${((vacuum ? 120 : 2) + liters * 1.2).toFixed(2)} g`, 320, 277, { color: '#c1f2dd', size: 20, mono: true });
    oval(222, 276, 6, 6, '#a2d5c8');
    oval(418, 276, 6, 6, '#a2d5c8');
    if (vacuum) {
      // A rigid vessel keeps its outside volume during air removal.
      box(259, 113, 122, 112, 15, '#def4f0b0', '#477b8a', 3);
      box(251, 103, 138, 17, 6, '#506f7e', '#2f5268', 2);
      box(309, 87, 22, 18, 4, '#3f7e83', '#2b5c6e', 2);
      line(320, 92, 320, 100, '#a5d8c9', 2);
      const dots = Math.round(36 * liters / 3);
      for (let i = 0; i < dots; i += 1) {
        oval(272 + (i * 37 % 94), 130 + (i * 29 % 80), 3, 3, '#36877e');
      }
      box(422, 116, 130, 71, 10, '#527c86', '#315365', 2);
      box(431, 126, 112, 33, 5, '#d8ede7', '#315365', 2);
      label('진공기', 487, 143, { size: 17 });
            const pumping = condition === 'pumping';
      label(pumping ? '공기를 빼는 중' : '측정 중 · 연결 분리', 487, 207, { size: 13, color: '#365c68' });
      shape(pumping
        ? 'M 432 172 C 406 167 411 99 377 87 Q 345 75 320 93'
        : 'M 432 172 C 406 167 411 99 377 87 Q 363 80 348 86', null, '#537d8a', 6);
      if (!pumping) box(341, 80, 11, 12, 3, '#284d60');
      return;
    }
    if (liters < .025) {
      shape('M 253 217 C 241 210 251 197 271 197 C 294 196 318 205 332 215 L 353 214 L 356 221 L 335 223 C 307 225 274 226 253 217 Z', '#e77558', '#a63b39', 2);
      shape('M 259 210 Q 277 202 296 211', null, '#ffb497', 2);
      return;
    }
    const radius = 25 + 55 * Math.cbrt(liters / 3);
    // Rest the broad side of the balloon on the scale pan.
    ctx.save();
    ctx.translate(320, 225 - radius * .92);
    ctx.rotate(Math.PI / 2);
    balloon(0, radius * .82, radius);
    shape('M 0 ' + (radius * .82) + ' l -7 10 q 7 4 14 0 Z', '#d65a45', '#a63b39', 1.7);
    ctx.restore();
  }

  function drawFlask(temperature) {
    ctx.save();
    ctx.translate(flaskPosition.x, flaskPosition.y);
    ctx.scale(.68, .68);
    ctx.translate(-320, -289);
    const flask = 'M 300 131 H 340 V 173 Q 340 183 347 195 L 386 266 Q 394 284 377 289 H 263 Q 246 284 254 266 L 293 195 Q 300 183 300 173 Z';
    const glass = gradient(252, 150, 390, 260, [[0, '#f6fffcf0'], [.48, '#c0e4e588'], [1, '#f2fffcdd']]);
    shape(flask, glass, '#467b88', 3);
    shape('M 303 170 Q 304 184 297 197 L 259 269 Q 256 277 263 280', null, '#ffffffc7', 4);
    [220, 236, 252, 268].forEach((y, index) => line(350 + index * 4, y, 364 + index * 4, y, '#4374868c', 1.5));
    box(295, 126, 50, 10, 4, '#cfe8e8', '#467b88', 2);
    const airInBalloon = Math.max(0, 250 * (temperature + 273.15) / 293.15 - 230);
    const inflation = Math.max(0, Math.min(1, (airInBalloon - 3) / 56));
    const radius = 12 + 34 * Math.sqrt(inflation);
    balloon(320, 126, radius, .3 + .7 * Math.sqrt(inflation));
    box(297, 126, 46, 9, 4, '#dc6f54', '#a63b39', 2);
    ctx.restore();
    flaskTarget.style.left = `${100 * flaskPosition.x / WIDTH}%`;
    flaskTarget.style.top = `${100 * (flaskPosition.y - 92) / HEIGHT}%`;
  }

  function drawBath(temperature) {
    const baths = [
      { key: 'ice', x: 110, title: '얼음 가득 물', degrees: '0 °C', tint: '#9ed9ed', edge: '#548eae' },
      { key: 'room', x: 320, title: '실온 물', degrees: '20 °C', tint: '#9ed9cf', edge: '#4d9589' },
      { key: 'hot', x: 530, title: '뜨거운 물', degrees: '65 °C', tint: '#efc28d', edge: '#b27c4e' },
    ];
    for (const bath of baths) {
      const x = bath.x;
      shadow(x, 309, 90);
      box(x - 87, 225, 174, 81, 11, '#f3ffffb0', '#658a95', 2);
      oval(x, 231, 86, 13, bath.tint, bath.edge);
      if (bath.key === 'ice') {
        for (let i = 0; i < 18; i += 1) {
          const iceX = x - 72 + (i * 37 % 144);
          const iceY = 229 + (i * 19 % 56);
          box(iceX - 8, iceY - 6, 17, 13, 3, '#e0f6ff', '#78adc4', 1);
          line(iceX - 4, iceY - 2, iceX + 3, iceY - 2, '#fff', 1);
        }
      }
      if (bath.key === 'hot') {
        for (const steamX of [x - 60, x, x + 60]) {
          shape(`M ${steamX} 214 q -8 -9 0 -18 q 8 -9 0 -18`, null, '#b96a4c80', 2);
        }
      }
    }
    drawFlask(temperature);
    for (const bath of baths) {
      const x = bath.x;
      ctx.save();
      ctx.globalAlpha = .3;
      box(x - 85, 233, 170, 72, 10, bath.tint);
      ctx.restore();
      shape(`M ${x - 86} 231 Q ${x} 256 ${x + 86} 231`, null, bath.edge, 2);
      if (condition === bath.key) box(x - 92, 220, 184, 91, 14, null, '#28776b', 3);
      label(bath.title, x, 323, { size: 16 });
      label(bath.degrees, x, 342, { size: 13, color: '#466374' });
    }
  }

  function pistonX(pressure) {
    return 550 - 6 * (2000 / pressure);
  }

  function handlePosition() {
    return pistonX(shown) - 240;
  }

  function drawSyringe(pressure) {
    const piston = pistonX(pressure);
    const handle = handlePosition();
    plungerTarget.style.left = `${100 * handle / WIDTH}%`;
    shadow(328, 254, 219);

    // The nozzle, the clear barrel and the narrow stop at the right edge stay fixed.
    box(551, 178, 39, 22, 4, '#d6edf1', '#457e8f', 2.5);
    box(582, 174, 26, 30, 5, '#2b7085', '#1b4f63', 2);
    line(597, 180, 597, 198, '#98c1ca', 2);
    box(262, 145, 295, 88, 11, gradient(0, 145, 0, 233, [[0, '#f6ffff'], [.44, '#d1e8e8a0'], [1, '#bcdfe1']]), '#477b8a', 3);
    box(piston, 150, 550 - piston, 78, [0, 6, 6, 0], '#7acac28c');
    line(piston + 3, 223, 550, 223, '#4f9c9980', 2);
    box(handle, 181, 237, 16, 5, '#73909d', '#466679', 2);
    line(handle + 12, 184, piston - 6, 184, '#aecbd3', 2);
    box(piston - 8, 149, 13, 80, 4, '#365967', '#284855', 2);
    box(258, 135, 14, 108, 6, '#bddee3', '#487d8a', 2);
    box(handle - 10, 155, 20, 68, 6, '#4d8391', '#305a69', 2);
    line(handle - 3, 162, handle - 3, 216, '#94c0ca', 2);

    for (let mark = 0; mark <= 40; mark += 5) {
      const x = 550 - 6 * mark;
      const major = mark % 10 === 0;
      line(x, 152, x, major ? 171 : 161, '#426c7c', 1.8);
      if (major) label(mark, x, 132, { size: 13, weight: 760, mono: true });
    }
    label('mL', 590, 132, { size: 12, weight: 700, mono: true });

    // Keep a fixed number of dots inside the changing gas volume.
    for (let dot = 0; dot < 16; dot += 1) {
      const column = (dot * 11 % 17 + .8) / 17.4;
      const row = (dot * 7 % 19 + 1) / 21;
      oval(piston + 8 + column * (532 - piston), 171 + row * 48, 2.6, 2.6, '#317b799c');
    }

    line(597, 205, 597, 264, '#4c7685', 1.5);
    oval(597, 205, 3, 3, '#4c7685');
    label('막힌 끝', 589, 281, { size: 17 });

    line(handle, 224, handle, 265, '#4c7685', 1.5);
    line(handle - 12, 266, handle + 12, 266, '#4c7685', 1.5);
    shape(`M ${handle - 9} 262 l -5 4 l 5 4 M ${handle + 9} 262 l 5 4 l -5 4`, null, '#4c7685', 1.5);
    label('손잡이', handle, 283, { size: 17 });
    label('주사기 속 공기', (piston + 550) / 2, 306, { size: 16, color: palette.teal });
  }

  function paint() {
    if (!ctx) return;
    const resolution = window.devicePixelRatio || 1;
    const ratio = Math.min(4, Math.max(1, resolution * canvas.clientWidth / WIDTH));
    const pixelWidth = Math.round(WIDTH * ratio);
    const pixelHeight = Math.round(HEIGHT * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    ctx.setTransform(pixelWidth / WIDTH, 0, 0, pixelHeight / HEIGHT, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (activeLab === 'mass') drawScale(shown);
    if (activeLab === 'vacuum') drawScale(shown, true);
    if (activeLab === 'heat') drawBath(shown);
    if (activeLab === 'pressure') drawSyringe(shown);
  }

  function update(lab, value, mode, animate = true) {
    cancelAnimationFrame(frame);
    const previousLab = activeLab;
    activeLab = lab;
    condition = mode;
    target = value;
    if (lab === 'heat' && !flaskDragging) flaskPosition = { x: bathCenters[mode], y: 285 };
    if (!animate || previousLab !== lab || reduceMotion.matches || Math.abs(target - shown) < .001) {
      shown = target;
      paint();
      return;
    }
    const startValue = shown;
    const started = performance.now();
    const duration = lab === 'heat' ? 1800 : 230;
    function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = lab === 'heat'
        ? (1 - Math.cos(Math.PI * progress)) / 2
        : 1 - (1 - progress) ** 3;
      shown = startValue + (target - startValue) * eased;
      paint();
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  if ('ResizeObserver' in window) new ResizeObserver(paint).observe(canvas);
  else window.addEventListener('resize', paint);

  return {
    update,
    handlePosition,
    pressureFromHandle: (x) => 12000 / Math.max(1, 310 - x),
    flaskPosition: () => ({ ...flaskPosition }),
    beginFlaskDrag: () => { flaskDragging = true; },
    moveFlask: (x, y) => {
      flaskPosition = { x: Math.max(65, Math.min(575, x)), y: Math.max(200, Math.min(305, y)) };
      paint();
      return Object.keys(bathCenters).find((key) =>
        Math.abs(flaskPosition.x - bathCenters[key]) < 78 && flaskPosition.y >= 244
      );
    },
    settleFlask: (key) => {
      flaskDragging = false;
      flaskPosition = { x: bathCenters[key], y: 285 };
      paint();
    },
  };
};
