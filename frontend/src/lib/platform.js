/** Which keyboard the user has: hints say ⌘ on a Mac and Ctrl everywhere else, and the handlers accept either. */
export const isMac = /mac|iphone|ipad|ipod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent);
export const keys = (key) => (isMac ? ['⌘', key] : ['Ctrl', key]);
export const MOD = isMac ? '⌘' : 'Ctrl';
export const kb = (key) => (isMac ? `⌘${key}` : `Ctrl+${key}`);
