// UI 微反馈：资源数值变化时让对应木牌格子跳动一次。
// 独立模块，不依赖 main.js 内部状态；只读 DOM 文本，不改变游戏规则。
const motion = matchMedia('(prefers-reduced-motion: reduce)');

for (const id of ['wood', 'scrap', 'kills']) {
  const value = document.getElementById(id);
  if (!value) continue;
  const cell = value.closest<HTMLElement>('.res');
  if (!cell) continue;
  let last = value.textContent;
  new MutationObserver(() => {
    const now = value.textContent;
    if (now === last) return;
    last = now;
    if (motion.matches) return;
    cell.classList.remove('pop');
    void cell.offsetWidth;
    cell.classList.add('pop');
  }).observe(value, { childList: true, characterData: true, subtree: true });
}
