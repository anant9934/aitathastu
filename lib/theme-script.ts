/**
 * Theme constants shared by the server layout and the client toggle (D-2).
 * Kept out of the "use client" module so the server can inline the script.
 */
export const THEME_STORAGE_KEY = "tathastu-theme";

/** Runs in <head> before the body paints, so a stored Light choice never flashes Dark. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;
