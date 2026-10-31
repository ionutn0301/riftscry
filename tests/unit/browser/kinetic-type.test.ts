// @vitest-environment happy-dom
import {afterEach,it,expect} from 'vitest';
import {prepareKineticTitle,setKineticTitle} from '../../../src/scripts/kinetic-type';
afterEach(()=>{document.body.innerHTML='';});
it('keeps one complete accessible title, authored emphasis and its exact text while preparing words',()=>{
  document.body.innerHTML='<h1 aria-label="Every game leaves a ripple.">Every game leaves<br>a <em>ripple.</em></h1>';
  const heading=document.querySelector('h1')!;prepareKineticTitle(heading);
  expect(heading.getAttribute('aria-label')).toBe('Every game leaves a ripple.');expect(heading.querySelector('em')!.textContent).toBe('ripple.');
  expect(heading.querySelectorAll('.kinetic-word')).toHaveLength(5);
  expect([...heading.querySelectorAll('.kinetic-word-mask')].every(word=>word.getAttribute('aria-hidden')==='true')).toBe(true);
  prepareKineticTitle(heading);expect(heading.querySelectorAll('.kinetic-word')).toHaveLength(5);
  setKineticTitle(heading,'Follow your echoes.');expect(heading.textContent).toBe('Follow your echoes.');expect(heading.getAttribute('aria-label')).toBe('Follow your echoes.');
  expect(heading.querySelectorAll('.kinetic-word')).toHaveLength(3);
});
