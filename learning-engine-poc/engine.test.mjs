import test from 'node:test';
import assert from 'node:assert/strict';
import { content, routeStory, nextQuestion, hintFor, bubbleStep, scheduleInterval, createInkStory } from './engine.mjs';
import { parse } from '@markmap/parse';
import { DefaultScheduler, Rating } from 'ts-fsrs';
import { Window } from 'happy-dom';

test('the single source content maps to each requested learning format', () => {
  assert.equal(content.concepts.length, 3);
  assert.equal(content.questions.length, 3);
  assert.equal(content.flashcards.length, 3);
  assert.ok(content.source.length > 20);
});
test('story decisions return explanatory feedback for right and wrong choices', () => {
  assert.equal(routeStory('scan').correct, true);
  assert.match(routeStory('always').text, /desordenaria/);
  assert.match(routeStory('first').text, /demais/);
});
test('InkJS compiles the branch story and returns explanation after each choice', () => {
  const story=createInkStory();
  story.Continue();
  assert.equal(story.currentChoices.length,2);
  story.ChooseChoiceIndex(0);
  assert.match(story.ContinueMaximally(),/compares adjacent values/);
  const retry=createInkStory();retry.Continue();retry.ChooseChoiceIndex(1);
  assert.match(retry.ContinueMaximally(),/only swap when the pair is out of order/);
});
test('Markmap parses the concept outline into a collapsible hierarchy', () => {
  const root=parse('# Ordenação\n## Comparar\n## Trocar\n### Condição\n## Repetir').root;
  assert.equal(root.children.length,3);
  assert.equal(root.children[1].children.length,1);
});
test('Markmap renders SVG nodes at a phone-sized viewport in a DOM emulator', async () => {
  const window=new Window({url:'http://localhost'});
  globalThis.window=window;globalThis.document=window.document;globalThis.SVGElement=window.SVGElement;globalThis.SVGSVGElement=window.SVGSVGElement;globalThis.ResizeObserver=window.ResizeObserver;
  const [{Markmap},{approximateMeasurer}]=await Promise.all([import('@markmap/view'),import('@markmap/render')]);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.getBoundingClientRect=()=>({x:0,y:0,width:390,height:260});document.body.append(svg);
  const map=Markmap.create(svg,parse('# Ordenação\n## Comparar\n## Trocar').root,{measurer:approximateMeasurer,duration:0});
  assert.equal(svg.querySelectorAll('[data-key^="node:"]').length,3);
  assert.equal(svg.querySelectorAll('[data-key^="edge:"]').length,2);
  map.destroy();window.happyDOM.abort();delete globalThis.window;delete globalThis.document;delete globalThis.SVGElement;delete globalThis.SVGSVGElement;delete globalThis.ResizeObserver;
});
test('adaptive selection prioritizes an objective with the lowest observed mastery', () => {
  assert.equal(nextQuestion({compare:{seen:4,correct:4},swap:{seen:3,correct:1}}).id, 'repeat');
});
test('hints reveal progressively and do not contain the answer option verbatim', () => {
  const question=content.questions[0];
  assert.notEqual(hintFor(question,0), question.options[0]);
  assert.notEqual(hintFor(question,1), question.options[0]);
});
test('bubble sort step compares neighboring items and swaps only inverted values', () => {
  const step=bubbleStep([4,2,3],{i:0,pass:0});
  assert.deepEqual(step.values,[2,4,3]);
  assert.deepEqual(step.compared,[0,1]);
  assert.equal(step.swapped,true);
  assert.equal(bubbleStep([2,4,3],{i:0,pass:0}).swapped,false);
});
test('bubble sort continues until a full pass makes no swaps', () => {
  let values=[2,4,3,1],cursor={i:0,pass:0},done=false,guard=0;
  while(!done&&guard++<100){const step=bubbleStep(values,cursor);values=step.values;cursor=step.cursor;done=step.done;}
  assert.deepEqual(values,[1,2,3,4]);
  assert.ok(done);
});
test('flashcard intervals match the current Alfred scheduler rules', () => {
  assert.equal(scheduleInterval(0,'again'),0);
  assert.equal(scheduleInterval(0,'good'),3);
  assert.equal(scheduleInterval(4,'hard'),5);
  assert.equal(scheduleInterval(4,'easy'),10);
});
test('TS-FSRS schedules a persistent card state and a due date locally', async () => {
  const scheduler=await DefaultScheduler({enableFuzz:false});
  const now=new Date('2026-11-24T12:00:00.000Z');
  const card=scheduler.newCard({now});
  const result=scheduler.review({card,grade:Rating.Good,now});
  assert.ok(result.card.dueAt instanceof Date);
  assert.equal(result.card.cardId,card.cardId);
  assert.ok(result.card.scheduledDays>=0);
  assert.equal(card.reps,0,'review does not mutate the original FSRS card');
});
