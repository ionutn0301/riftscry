export const THEME_KEY='riftscry:theme';
export const themes=['frost','ember','obsidian'] as const;
export type Theme=typeof themes[number];
export const themeNames:Record<Theme,string>={frost:'Frost',ember:'Ember',obsidian:'Obsidian'};
export const themeColors:Record<Theme,string>={frost:'#071016',ember:'#140e0c',obsidian:'#0e0e10'};
export const validTheme=(value:unknown):Theme=>themes.includes(value as Theme)?value as Theme:'frost';
