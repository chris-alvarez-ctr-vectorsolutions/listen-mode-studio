// Theme music for the open and the close. A built-in pair ships with the app; Settings can replace either one.
import introUrl from '../assets/theme-intro.mp3?url';
import outroUrl from '../assets/theme-outro.mp3?url';
import { decode } from './audio.js';
import { deleteAudio, getAudio, saveAudio } from './store.js';

const BUILT_IN = { intro: introUrl, outro: outroUrl };
const KEY = '_theme';
export const THEME_FOR = { open: 'intro', close: 'outro' };

export const hasCustomTheme = async which => !!(await getAudio(KEY, which));
export const saveTheme = (which, blob) => saveAudio(KEY, which, blob);
export const clearTheme = which => deleteAudio(KEY, which);

export async function themeBlob(which) {
  return (await getAudio(KEY, which)) || (await (await fetch(BUILT_IN[which])).blob());
}
export async function themeBuffer(which) {
  return decode(await (await themeBlob(which)).arrayBuffer());
}
