import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIZ } from '../quiz.js';
import { HOST_KEY, grade } from '../host-key.js';

test('exactly 18 approved questions arranged into three six-question formats', () => {
  assert.equal(QUIZ.length, 18);
  assert.equal(new Set(QUIZ.map(q=>q.id)).size, 18);
  assert.deepEqual(QUIZ.map(q=>q.round), [...Array(6).fill(1), ...Array(6).fill(2), ...Array(6).fill(3)]);
  assert.deepEqual(QUIZ.map(q=>q.type), [...Array(6).fill('fake'), ...Array(6).fill('twist'), ...Array(6).fill('person')]);
  for (const q of QUIZ) {
    assert.equal(typeof q.title, 'string');
    assert.ok(q.stem.length>8);
    assert.ok(HOST_KEY[q.id], `missing host key for ${q.id}`);
    if(q.type==='fake')assert.equal(q.options.length,4);
    if(q.type==='person')assert.equal(q.clues.length,5);
  }
  assert.equal(QUIZ[11].stem.includes('unhinged routine'),false);
  assert.ok(QUIZ[17].clues[0].includes('foul-mouthed parrot'));
  assert.ok(QUIZ[17].clues[2].includes('other groom'));
});

test('fake answers award 100 exactly for the fabricated option', () => {
  for(const q of QUIZ.filter(q=>q.type==='fake')){
    for(const option of 'ABCD') {
      assert.equal(grade(q,{response:option}),option===HOST_KEY[q.id].correct?100:0);
    }
  }
});

test('written plot twists recognize common answers and allow host partial overrides', () => {
  for(const [id,response] of [['q07','condoms gutkha stones'],['q08','Aladdin magic lamp'],['q09','sitting on toilet'],['q10','40 knives'],['q11','ten live birds'],['q12','wearing underwear and returning it']]){
    const q=QUIZ.find(v=>v.id===id);
    assert.equal(grade(q,{response}),200,`expected full marks for ${id}`);
  }
  assert.equal(grade(QUIZ[6],{response:'condoms'}),0);
  assert.equal(grade(QUIZ[6],{response:'stones and gutkha'}),100);
  assert.equal(grade(QUIZ[11],{response:'panties'}),100);
});

test('celebrity points depend on clue at submission, no partial credit for wrong guesses', () => {
  const q=QUIZ[12];
  for(let clue=1;clue<=5;clue++) {
    assert.equal(grade(q,{response:'Samay Raina',clueCount:clue}),600-clue*100);
    assert.equal(grade(q,{response:'Rakhi Sawant',clueCount:clue}),0);
  }
});

test('25 competitors and 18 questions produce consistent totals across segments', () => {
  const players=Array.from({length:25},(_,i)=>({id:i,total:0,scores:[]}));
  for(const q of QUIZ) {
    for(const p of players) {
      const k=HOST_KEY[q.id];
      const response=q.type==='fake'?(p.id%2===0?k.correct:'A'===k.correct?'B':'A'):q.type==='person'?(p.id%2===0?k.answer:'Somebody Else'):p.id%2===0?k.answer:'No idea';
      const pts=grade(q,{response,clueCount:(p.id%5)+1});
      p.total+=pts;
      p.scores.push(pts);
    }
  }
  for(const p of players){
    for(const end of [6,12,18]){
      const sum=p.scores.slice(0,end).reduce((a,b)=>a+b,0);
      assert.ok(sum>=0);
      if(end===18) assert.equal(sum,p.total);
    }
  }
});
