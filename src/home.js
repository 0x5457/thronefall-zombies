// Title screen (ARC-04 entry): giant logo over the live camp, start/continue, fire interaction.
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export function createHome({ onStart, onContinue, onSpark, onPointer, onLeave }) {
  const root = el('section');
  root.id = 'home';
  root.hidden = true;
  root.innerHTML = `
    <div class="home-frame">
      <p class="home-kicker">BLACK PINE · CAMPSITE 07</p>
      <div class="home-logo">
        <svg class="home-emblem" viewBox="0 0 120 120" aria-hidden="true">
          <path class="emblem-tree" d="M60 4 26 50h16L18 88h34v28h16V88h34L78 50h16Z"/>
          <path class="emblem-flame" d="M60 54c8 10 12 16 12 24a12 12 0 0 1-24 0c0-8 4-14 12-24z"/>
        </svg>
        <h1>PINEFALL</h1>
        <p class="home-sub">松 林 余 烬</p>
      </div>
      <p class="home-tagline">白昼经营营地，入夜守住房车。<br>五个夜晚之后，救援会来。</p>
      <div class="home-actions">
        <button id="home-start" class="home-btn primary"><span>开始新游戏</span><small>DAY 01 · 新战役</small></button>
        <button id="home-continue" class="home-btn" disabled><span>继续游戏</span><small id="home-save-info">没有找到营地记录</small></button>
      </div>
      <p class="home-foot">轻点画面 · 篝火会溅起火星</p>
    </div>`;

  const start = root.querySelector('#home-start');
  const startLabel = start.querySelector('span');
  const cont = root.querySelector('#home-continue');
  const info = root.querySelector('#home-save-info');
  let hasSave = false,
    confirmUntil = 0,
    confirmTimer;

  function resetConfirm() {
    clearTimeout(confirmTimer);
    confirmUntil = 0;
    start.classList.remove('confirm');
    startLabel.textContent = '开始新游戏';
  }
  start.addEventListener('click', (event) => {
    event.stopPropagation();
    if (hasSave && performance.now() > confirmUntil) {
      confirmUntil = performance.now() + 3000;
      start.classList.add('confirm');
      startLabel.textContent = '再点一次 · 覆盖进度';
      confirmTimer = setTimeout(resetConfirm, 3000);
      return;
    }
    resetConfirm();
    onStart();
  });
  cont.addEventListener('click', (event) => {
    event.stopPropagation();
    if (hasSave) onContinue();
  });
  root.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    onSpark?.();
  });
  root.addEventListener('pointermove', (event) => onPointer?.(event.clientX, event.clientY));
  root.addEventListener('pointerleave', () => onLeave?.());
  document.body.append(root);

  return {
    show({ save, broken = false } = {}) {
      hasSave = !!save;
      resetConfirm();
      cont.disabled = !hasSave;
      info.textContent = hasSave
        ? `第 ${save.day} 天 · 营地 ${save.health}% · ${save.perks} 项专长`
        : broken
          ? '营地记录损坏 · 只能开始新游戏'
          : '没有找到营地记录';
      root.hidden = false;
      root.classList.add('shown');
    },
    hide() {
      root.hidden = true;
      root.classList.remove('shown');
    },
    get visible() {
      return !root.hidden;
    },
  };
}
