/**
 * The ?scene= link. A scene named in the URL is a choice: show it and stay on
 * it. In auto mode the URL stays bare so a reload keeps cycling. Pure string
 * work, so it is tested without a browser.
 */

/** Index of the scene the query names, or undefined if it names none we have. */
export function sceneFromQuery(search: string, ids: readonly string[]): number | undefined {
  const id = new URLSearchParams(search).get('scene')?.trim().toLowerCase();
  if (!id) return undefined;
  const index = ids.indexOf(id);
  return index >= 0 ? index : undefined;
}

/** The query string to show for this state, keeping any other parameters. */
export function queryForScene(search: string, sceneId: string | undefined): string {
  const params = new URLSearchParams(search);
  if (sceneId === undefined) params.delete('scene');
  else params.set('scene', sceneId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Whether a bare flag like ?debug is present (any value but "0" or "false"). */
export function flagFromQuery(search: string, name: string): boolean {
  const value = new URLSearchParams(search).get(name);
  return value !== null && value !== '0' && value.toLowerCase() !== 'false';
}
