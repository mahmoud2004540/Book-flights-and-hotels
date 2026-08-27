export const THEME_STORAGE_KEY = "rehlaty-theme";

/**
 * Applied before first paint so someone who chose dark never sees a flash of
 * light. It has to be a blocking script in <head> — any delay is a visible flash.
 */
const SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
