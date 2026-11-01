import {THEME_KEY,validTheme,themeNames,themeColors,type Theme} from '../lib/themes';
const root=document.documentElement;
const picker=document.querySelector<HTMLElement>('[data-appearance-panel]');
const trigger=document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const choices=[...document.querySelectorAll<HTMLInputElement>('[data-theme-choice]')];
function apply(theme:Theme){
  root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themeColors[theme]);
  choices.forEach(choice=>{choice.checked=choice.value===theme;choice.disabled=false;});
  trigger?.setAttribute('aria-label',`Choose theme, ${themeNames[theme]} selected`);
  if(trigger)trigger.title=`Theme: ${themeNames[theme]}`;
  const status=picker?.querySelector('[data-theme-status]');
  if(status)status.textContent=`${themeNames[theme]} theme selected`;
}
function restore(){
  try{apply(validTheme(localStorage.getItem(THEME_KEY)));}
  catch{apply(validTheme(root.dataset.theme));}
}
choices.forEach(choice=>choice.addEventListener('change',()=>{
  if(!choice.checked)return;
  const theme=validTheme(choice.value);apply(theme);
  try{localStorage.setItem(THEME_KEY,theme);}catch{/* This visit still uses the chosen theme. */}
}));
picker?.addEventListener('toggle',event=>{
  const open=(event as ToggleEvent).newState==='open';
  trigger?.setAttribute('aria-expanded',String(open));
  if(open)choices.find(choice=>choice.checked)?.focus({preventScroll:true});
});
window.addEventListener('storage',event=>{if(event.key===THEME_KEY||event.key===null)restore();});
window.addEventListener('pageshow',event=>{if(event.persisted)restore();});
restore();
