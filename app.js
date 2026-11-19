'use strict';

const get = (id) => document.getElementById(id);
const canvas = get('apparatus');
const plungerTarget = get('plunger-target');
const flaskTarget = get('flask-target');
const apparatus = createApparatus(canvas, plungerTarget, flaskTarget);
const tabs = Array.from(document.querySelectorAll('[data-lab]'));
const apparatusScene = get('scene');
const massValue = (pumps) => (2 + pumps * .5 * 1.2).toFixed(2);
const vacuumMass = (pumps) => (120 + (3 - pumps * .5) * 1.2).toFixed(2);
const vacuumPressure = (pumps) => Math.round(100 * (3 - pumps * .5) / 3);
const heatVolume = (temperature) => Math.round(250 * (temperature + 273.15) / 293.15);
const pressureVolume = (pressure) => (2000 / pressure).toFixed(1);
const bathOptions = {
  ice: { label: '얼음 가득 물', temperature: 0, mode: 'cold' },
  room: { label: '실온 물', temperature: 20, mode: 'room' },
  hot: { label: '뜨거운 물', temperature: 65, mode: 'hot' },
};

const labs = {
  mass: {
    initial: 0,
    title: '풍선에 공기를 넣고 무게 재기',
    description: '같은 풍선에 공기를 넣기 전과 넣은 후의 무게를 비교해요.',
    question: '공기를 넣은 풍선의 무게는 어떻게 될까요?',
    options: ['더 무거워요', '같아요', '더 가벼워요'],
    answer: 0,
    columns: ['풍선 상태', '풍선 전체 질량'],
    concept: '공기도 무게가 있어요. 같은 풍선에 공기를 넣으면 풍선과 공기를 합한 질량이 늘어나요.',
    note: '저울의 g은 질량 단위예요. 이 시뮬레이션은 주변 공기가 풍선을 위로 밀어 올리는 효과인 부력을 보정한 모형값을 보여 줘요.',
  },
  vacuum: {
    initial: 0,
    title: '진공기로 공기를 빼고 무게 재기',
    description: '단단한 밀폐 용기에서 공기를 빼고, 용기와 남은 공기의 무게를 비교해요.',
    question: '진공기로 용기 속 공기를 빼면 무게는 어떻게 될까요?',
    options: ['더 무거워요', '같아요', '더 가벼워요'],
    answer: 2,
    columns: ['공기를 뺀 횟수', '용기 전체 질량'],
    concept: '공기를 빼면 용기 속에 남아 있는 공기의 양이 줄어들어 전체 질량이 작아져요. 이 실험으로 공기도 무게가 있음을 알 수 있어요.',
    note: '같은 크기의 단단한 용기에서 공기를 뺀 뒤 진공기 연결을 분리하고 재는 모형이에요. 용기 자체 질량은 120 g이며, 끝까지 조작해도 공기가 조금 남아 있어요.',
  },
  heat: {
    initial: 'room',
    title: '플라스크를 세 가지 물에 담그기',
    description: '삼각 플라스크 입구에 씌운 풍선이 어떻게 달라지는지 살펴봐요.',
    question: '얼음물에 있을 때보다 뜨거운 물에 있을 때 풍선의 크기는 어떨까요?',
    options: ['더 커요', '같아요', '더 작아요'],
    answer: 0,
    columns: ['물의 온도', '공기 전체 부피'],
    concept: '공기의 양과 압력이 거의 같을 때, 데워진 공기는 더 큰 공간을 차지하고 식은 공기는 더 작은 공간을 차지해요.',
    note: '부피는 플라스크와 풍선 속 공기를 합한 모형값이에요. 공기가 물과 같은 온도에 이르렀다고 가정하며 풍선 고무의 탄성 때문에 생기는 압력 차이는 생략했어요.',
  },
  pressure: {
    initial: 100,
    title: '끝을 막은 주사기 밀고 당기기',
    description: '주사기 손잡이를 움직이며 갇힌 공기가 차지하는 공간을 살펴봐요.',
    question: '주사기 손잡이를 밀어 공기의 압력을 높이면 부피는 어떻게 될까요?',
    options: ['늘어나요', '같아요', '줄어들어요'],
    answer: 2,
    columns: ['주사기 속 압력', '공기 부피'],
    concept: '공기가 새지 않고 온도가 일정할 때, 압력을 높이면 부피가 줄고 압력을 낮추면 부피가 늘어나요.',
    note: '주사기를 천천히 밀고 당겨 온도가 일정하다고 가정해요. kPa는 압력의 단위이고, 점은 갇힌 공기의 양이 일정하다는 것을 보여 줘요.',
  },
};

function makeState(initial) {
  return { value: initial, prediction: null, records: new Set(), explanation: false };
}

const states = Object.fromEntries(Object.entries(labs).map(([id, lab]) => [id, makeState(lab.initial)]));
let current = 'mass';
let drag = null;
let vacuumPumping = false;
let vacuumTimer;

function announce(message) {
  const live = get('announcement');
  live.textContent = '';
  // A new text node allows repeated announcements after another trial.
  live.append(document.createTextNode(message));
}

function button(label, className, onClick) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.addEventListener('click', onClick);
  return node;
}

function pumpVacuum() {
  vacuumPumping = true;
  setValue(states.vacuum.value + 1);
  vacuumTimer = setTimeout(() => {
    vacuumPumping = false;
    if (current === 'vacuum') renderExperiment(false);
  }, 550);
}

function renderControls() {
  const lab = labs[current];
  const choices = get('choices');
  choices.replaceChildren(...lab.options.map((label, index) => {
    return button(label, 'choice', () => {
      const state = states[current];
      state.prediction = index;
      renderChoices();
      renderExplanation();
      announce(`예측을 선택했어요. ${label}`);
    });
  }));

  const actions = get('actions');
  const group = document.createElement('div');
  group.className = 'actions-grid';
  if (current === 'mass') {
    group.classList.add('two');
    const inflate = button('공기 넣기 (+0.5 L)', 'action', () => setValue(states.mass.value + 1));
    const deflate = button('공기 모두 빼기', 'action', () => setValue(0));
    inflate.id = 'inflate';
    deflate.id = 'deflate';
    group.append(inflate, deflate);
    actions.replaceChildren(group);
  }
  if (current === 'vacuum') {
    group.classList.add('two');
    const evacuate = button('진공기로 공기 빼기', 'action', pumpVacuum);
    const refill = button('공기 다시 채우기', 'action', () => setValue(0));
    evacuate.id = 'evacuate';
    refill.id = 'refill';
    group.append(evacuate, refill);
    actions.replaceChildren(group);
  }
  if (current === 'heat') {
    Object.entries(bathOptions).forEach(([key, option]) => {
      const bath = button(option.label, 'action', () => setValue(key));
      const degrees = document.createElement('small');
      degrees.textContent = `${option.temperature} °C`;
      bath.append(degrees);
      bath.dataset.bath = key;
      group.append(bath);
    });
    actions.replaceChildren(group);
  }
  if (current === 'pressure') {
    group.classList.add('two');
    const label = document.createElement('label');
    label.className = 'range-label';
    label.htmlFor = 'pressure-range';
    label.textContent = '주사기 속 압력';
    const output = document.createElement('span');
    output.id = 'pressure-setting';
    output.setAttribute('aria-hidden', 'true');
    label.append(output);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'pressure-range';
    slider.min = '50';
    slider.max = '150';
    slider.step = '5';
    slider.addEventListener('input', () => setValue(Number(slider.value), false));
    const extents = document.createElement('div');
    extents.className = 'range-extents';
    extents.setAttribute('aria-hidden', 'true');
    extents.innerHTML = '<span>낮은 압력</span><span>높은 압력</span>';
    const pull = button('← 당기기', 'action', () => setValue(states.pressure.value - 10));
    const push = button('밀기 →', 'action', () => setValue(states.pressure.value + 10));
    pull.id = 'pull';
    push.id = 'push';
    group.append(pull, push);
    actions.replaceChildren(label, slider, extents, group);
  }
}

function renderChoices() {
  Array.from(get('choices').children).forEach((choice, index) => {
    choice.setAttribute('aria-pressed', String(states[current].prediction === index));
  });
}

function renderMetrics(metrics) {
  const element = get('metrics');
  if (!element.children.length) {
    metrics.forEach(() => {
      const metric = document.createElement('div');
      metric.className = 'metric';
      metric.append(document.createElement('span'), document.createElement('strong'));
      element.append(metric);
    });
  }
  metrics.forEach(([label, value], index) => {
    const metric = element.children[index];
    metric.firstElementChild.textContent = label;
    metric.lastElementChild.textContent = value;
  });
}

function renderExperiment(animate = true) {
  const value = states[current].value;
  const sceneStatus = get('scene-status');
  const caption = get('scene-caption');
  const hint = get('control-hint');
  plungerTarget.hidden = current !== 'pressure';
  flaskTarget.hidden = current !== 'heat';
  get('record').disabled = current === 'vacuum' && vacuumPumping;
  if (current === 'mass') {
    const liters = value * .5;
    apparatusScene.dataset.mode = 'mass';
    sceneStatus.textContent = value ? '공기를 넣은 풍선' : '빈 풍선';
    caption.textContent = '전자저울 · 부력을 보정한 모형값';
    hint.textContent = '빈 풍선을 먼저 기록하고, 공기를 넣은 뒤 다시 기록해 보세요.';
    get('inflate').disabled = value >= 6;
    get('deflate').disabled = value <= 0;
    renderMetrics([['넣은 공기의 부피', `${liters.toFixed(1)} L`], ['풍선 전체 질량', `${massValue(value)} g`]]);
    apparatus.update(current, liters, 'mass', animate);
  }
  if (current === 'vacuum') {
    apparatusScene.dataset.mode = 'vacuum';
    sceneStatus.textContent = vacuumPumping ? '진공기로 공기를 빼는 중' : value ? '공기를 빼고 용기 무게 측정' : '공기가 들어 있는 밀폐 용기';
    caption.textContent = '진공기 연결을 분리한 상태에서 무게를 재요.';
    hint.textContent = '처음 무게를 기록한 뒤, 진공기로 공기를 빼고 다시 기록해 보세요.';
    get('evacuate').disabled = value >= 5 || vacuumPumping;
    get('refill').disabled = value <= 0 || vacuumPumping;
    renderMetrics([['용기 속 공기의 압력', `${vacuumPressure(value)} kPa`], ['용기 전체 질량', `${vacuumMass(value)} g`]]);
    apparatus.update(current, 3 - value * .5, vacuumPumping ? 'pumping' : 'vacuum', animate);
  }
  if (current === 'heat') {
    const bath = bathOptions[value];
    apparatusScene.dataset.mode = bath.mode;
    sceneStatus.textContent = `${bath.label} · ${bath.temperature} °C`;
    caption.textContent = '플라스크를 끌어서 원하는 물통에 담가 보세요.';
    hint.textContent = '마우스나 손가락으로 플라스크를 옮겨요. 아래 물통 선택 버튼도 사용할 수 있어요.';
    document.querySelectorAll('[data-bath]').forEach((option) => {
      option.setAttribute('aria-pressed', String(option.dataset.bath === value));
    });
    renderMetrics([['물의 온도', `${bath.temperature} °C`], ['공기 전체 부피', `${heatVolume(bath.temperature)} mL`]]);
    apparatus.update(current, bath.temperature, value, animate);
  }
  if (current === 'pressure') {
    apparatusScene.dataset.mode = 'pressure';
    sceneStatus.textContent = '끝을 막은 주사기';
    caption.textContent = '손가락이나 마우스로 손잡이를 끌어 보세요.';
    hint.textContent = '서로 다른 압력에서 공기 부피를 두 번 이상 기록해 보세요.';
    const slider = get('pressure-range');
    slider.value = String(value);
    slider.setAttribute('aria-valuetext', `${value} 킬로파스칼`);
    get('pressure-setting').textContent = `${value} kPa`;
    get('pull').disabled = value <= 50;
    get('push').disabled = value >= 150;
    renderMetrics([['주사기 속 공기의 압력', `${value} kPa`], ['공기 부피', `${pressureVolume(value)} mL`]]);
    apparatus.update(current, value, 'pressure', animate);
  }
}

function setValue(value, animate = true) {
  if (current === 'mass') value = Math.max(0, Math.min(6, value));
  if (current === 'vacuum') value = Math.max(0, Math.min(5, value));
  if (current === 'pressure') value = Math.max(50, Math.min(150, Math.round(value / 5) * 5));
  if (value === states[current].value) return;
  states[current].value = value;
  renderExperiment(animate);
}

function sortedRecords() {
  const records = [...states[current].records];
  if (current === 'heat') {
    return records.sort((left, right) => bathOptions[left].temperature - bathOptions[right].temperature);
  }
  return records.sort((left, right) => left - right);
}

function rowValues(value) {
  if (current === 'mass') return [value ? `공기 ${(value * .5).toFixed(1)} L 넣음` : '빈 풍선', `${massValue(value)} g`];
  if (current === 'vacuum') return [value ? `공기 빼기 ${value}회` : '공기 빼기 전', `${vacuumMass(value)} g`];
  if (current === 'heat') {
    const bath = bathOptions[value];
    return [`${bath.label} (${bath.temperature} °C)`, `${heatVolume(bath.temperature)} mL`];
  }
  return [`${value} kPa`, `${pressureVolume(value)} mL`];
}

function comparison(values) {
  const first = values[0];
  const last = values[values.length - 1];
  if (current === 'mass') {
    const difference = (Number(massValue(last)) - Number(massValue(first))).toFixed(2);
    return `기록을 비교하면, 공기를 더 많이 넣었을 때 질량이 ${difference} g 더 커요.`;
  }
  if (current === 'vacuum') {
    const difference = (Number(vacuumMass(first)) - Number(vacuumMass(last))).toFixed(2);
    return `기록을 비교하면, 공기를 더 많이 뺐을 때 질량이 ${difference} g 더 작아요.`;
  }
  if (current === 'heat') {
    const difference = heatVolume(bathOptions[last].temperature) - heatVolume(bathOptions[first].temperature);
    return `기록을 비교하면, 물의 온도가 더 높을 때 공기 부피가 ${difference} mL 더 커요.`;
  }
  const difference = (Number(pressureVolume(first)) - Number(pressureVolume(last))).toFixed(1);
  return `기록을 비교하면, 압력이 더 높을 때 공기 부피가 ${difference} mL 더 작아요.`;
}

function renderRecords() {
  const records = sortedRecords();
  const [condition, value] = labs[current].columns;
  get('condition-column').textContent = condition;
  get('value-column').textContent = value;
  get('record-count').textContent = records.length ? `${records.length}개 조건` : '';
  get('no-records').hidden = records.length > 0;
  get('record-table').hidden = records.length === 0;
  const rows = records.map((setting) => {
    const row = document.createElement('tr');
    rowValues(setting).forEach((entry) => {
      const cell = row.insertCell();
      cell.textContent = entry;
    });
    return row;
  });
  get('record-rows').replaceChildren(...rows);
  get('comparison').hidden = records.length < 2;
  get('comparison').textContent = records.length >= 2 ? comparison(records) : '';
}

function renderExplanation() {
  const lab = labs[current];
  const state = states[current];
  get('explanation').hidden = !state.explanation;
  get('explain').setAttribute('aria-expanded', String(state.explanation));
  get('explain').textContent = state.explanation ? '결과 해석 닫기' : '결과 해석 보기';
  const feedback = get('prediction-feedback');
  feedback.hidden = state.prediction === null;
  feedback.textContent = state.prediction === lab.answer
    ? '예측과 실험 결과가 같아요.'
    : `처음 예측은 ‘${lab.options[state.prediction]}’였어요. 실험 결과는 ‘${lab.options[lab.answer]}’예요.`;
  get('concept').textContent = lab.concept;
  get('model-note').textContent = lab.note;
}

function renderLab() {
  const lab = labs[current];
  get('lab-panel').setAttribute('aria-labelledby', `tab-${current}`);
  get('lab-title').textContent = lab.title;
  get('lab-description').textContent = lab.description;
  get('question').textContent = lab.question;
  get('announcement').textContent = '';
  get('record').textContent = '현재 결과 기록';
  renderControls();
  renderChoices();
  renderExperiment(false);
  renderRecords();
  renderExplanation();
}

function endDrag() {
  if (!drag) return;
  const { pointer, element } = drag;
  drag = null;
  element.classList.remove('dragging');
  if (element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
  if (element === flaskTarget) apparatus.settleFlask(states.heat.value);
}

function switchLab(id) {
  if (id === current) return;
  endDrag();
  current = id;
  tabs.forEach((tab) => {
    const selected = tab.dataset.lab === current;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  renderLab();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => switchLab(tab.dataset.lab));
  tab.addEventListener('keydown', (event) => {
    const length = tabs.length;
    const destinations = {
      ArrowRight: (index + 1) % length,
      ArrowLeft: (index + length - 1) % length,
      Home: 0,
      End: length - 1,
    };
    if (!Object.prototype.hasOwnProperty.call(destinations, event.key)) return;
    event.preventDefault();
    const next = tabs[destinations[event.key]];
    switchLab(next.dataset.lab);
    next.focus();
  });
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * 640 / rect.width,
    y: (event.clientY - rect.top) * 350 / rect.height,
  };
}

for (const element of [plungerTarget, flaskTarget]) {
  element.addEventListener('pointerdown', (event) => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const point = pointerPosition(event);
    const position = element === flaskTarget
      ? apparatus.flaskPosition()
      : { x: apparatus.handlePosition(), y: 0 };
    drag = {
      pointer: event.pointerId, element,
      offsetX: point.x - position.x, offsetY: point.y - position.y,
    };
    if (element === flaskTarget) apparatus.beginFlaskDrag();
    element.setPointerCapture(event.pointerId);
    element.classList.add('dragging');
  });
  element.addEventListener('pointermove', (event) => {
    if (drag?.pointer !== event.pointerId || drag.element !== element) return;
    const point = pointerPosition(event);
    if (element === plungerTarget) {
      setValue(apparatus.pressureFromHandle(point.x - drag.offsetX), false);
    } else {
      const bath = apparatus.moveFlask(point.x - drag.offsetX, point.y - drag.offsetY);
      if (bath) setValue(bath);
    }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
    element.addEventListener(name, (event) => {
      if (drag?.pointer === event.pointerId) endDrag();
    });
  });
}
window.addEventListener('orientationchange', endDrag);
window.addEventListener('resize', endDrag);
window.addEventListener('blur', endDrag);

get('record').addEventListener('click', () => {
  const state = states[current];
  const duplicate = state.records.has(state.value);
  state.records.add(state.value);
  renderRecords();
  const [condition, result] = rowValues(state.value);
  announce(duplicate ? '이 조건은 이미 기록했어요.' : `${condition}, ${result}. 기록했어요.`);
  const currentLab = current;
  const record = get('record');
  record.textContent = duplicate ? '이미 기록한 조건이에요' : '기록했어요 ✓';
  clearTimeout(record.timeoutId);
  record.timeoutId = setTimeout(() => {
    if (current === currentLab) record.textContent = '현재 결과 기록';
  }, 1050);
});

get('explain').addEventListener('click', () => {
  states[current].explanation = !states[current].explanation;
  renderExplanation();
});

get('reset').addEventListener('click', () => {
  endDrag();
  if (current === 'vacuum') {
    clearTimeout(vacuumTimer);
    vacuumPumping = false;
  }
  states[current] = makeState(labs[current].initial);
  renderChoices();
  renderExperiment(false);
  renderRecords();
  renderExplanation();
  get('record').textContent = '현재 결과 기록';
  announce('이 실험을 처음 상태로 되돌렸어요.');
});

const fullscreen = get('fullscreen');

function updateFullscreenLabel() {
  const active = Boolean(document.fullscreenElement) || document.body.classList.contains('classroom-mode');
  fullscreen.setAttribute('aria-pressed', String(active));
  get('fullscreen-label').textContent = active ? '수업 화면 끝내기' : '수업 화면';
}

function setClassroomMode(active) {
  document.body.classList.toggle('classroom-mode', active);
  if (active) window.scrollTo(0, 0);
  updateFullscreenLabel();
}

fullscreen.addEventListener('click', async () => {
  if (document.body.classList.contains('classroom-mode')) {
    setClassroomMode(false);
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else if (document.fullscreenEnabled) {
    try {
      await document.documentElement.requestFullscreen();
      window.scrollTo(0, 0);
    } catch {
      setClassroomMode(true);
    }
  } else {
    setClassroomMode(true);
  }
});
document.addEventListener('fullscreenchange', updateFullscreenLabel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('classroom-mode')) {
    setClassroomMode(false);
    fullscreen.focus();
  }
});

renderLab();
