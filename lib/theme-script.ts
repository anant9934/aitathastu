export const THEME_STORAGE_KEY = "tathastu-theme";

/** Runs in <head> before the body paints. Default is Dark (Warm Cinematic) unless explicitly set to Light in localStorage. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}else{document.documentElement.dataset.theme="dark";}}catch(e){document.documentElement.dataset.theme="dark";}})();`;
