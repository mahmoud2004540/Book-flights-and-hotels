export const THEME_STORAGE_KEY = "rehlaty-theme";

/**
 * يُطبَّق قبل أول رسم لمنع وميض الوضع الفاتح على من اختار الداكن.
 * لا بد أن يكون سكربتًا حاجزًا في <head> — أي تأخير يعني ومضة مرئية.
 */
const SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
