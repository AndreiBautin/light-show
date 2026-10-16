/** The element with this id, checked to be the expected kind. Throws if the page is wrong. */
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`missing #${id}`);
  return el;
}
