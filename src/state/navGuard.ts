// Cross-navigation "unsaved work" guard. A focused entry screen (e.g. Log feed
// with a running timer) registers a guard; the tab bar consults it before
// switching tabs, so a tab tap can prompt "discard?" exactly like the back
// button does. Module singleton — only one entry screen is active at a time.
export type NavGuard = {
  /** True if leaving now would lose unsaved work. */
  hasUnsaved: () => boolean;
  /** Show the discard prompt; call `proceed` only if the user confirms. */
  confirm: (proceed: () => void) => void;
};

let current: NavGuard | null = null;

export function registerNavGuard(g: NavGuard): void {
  current = g;
}
export function unregisterNavGuard(g: NavGuard): void {
  if (current === g) current = null;
}
export function getNavGuard(): NavGuard | null {
  return current;
}
