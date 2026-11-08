/**
 * Criação de elementos sem innerHTML: todo texto do usuário entra como nó de texto,
 * então não há execução de marcação injetada.
 */
type Prop = string | boolean | ((event: Event) => void) | undefined;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, Prop> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") {
      node.addEventListener(key.replace(/^on/, ""), value);
      continue;
    }
    node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}
