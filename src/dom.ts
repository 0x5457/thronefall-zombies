// Tiny DOM helpers shared by HUD/interior/title modules. No framework, no game rules.
export const $ = <E extends Element = HTMLElement>(selector: string): E =>
  document.querySelector(selector) as E;

export const maybe = <E extends Element = HTMLElement>(selector: string): E | null =>
  document.querySelector(selector);

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string | null,
  text?: string | number | null,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};
