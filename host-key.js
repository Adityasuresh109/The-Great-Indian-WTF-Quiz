// HOST ONLY. This module is dynamically imported by the host screen.
// On a public static site, motivated technically skilled players could locate
// this asset. Do not use this setup for cash/prize tournaments requiring secrecy.
export const HOST_KEY = {
  q01: { correct: 'D', answer: 'The fake driving-licence testing office.', explanation: 'The fake IPL, fake SBI branch and fake arbitration court were reported.' },
  q02: { correct: 'B', answer: 'The dismantled bus shelter.', explanation: 'The bridge, mobile tower and illegally filled-in pond were reported.' },
  q03: { correct: 'C', answer: 'The groom and the rented SUV.', explanation: 'The wig, photographer and multiplication-table cases were reported.' },
  q04: { correct: 'B', answer: 'The wrong-biryani emergency police complaint.', explanation: 'The mutton curry, beer request and emergency-system test were reported.' },
  q05: { correct: 'A', answer: 'The burglar calling the police from a bathroom.', explanation: 'The sleeping burglar, snake retaliation and Maggi divorce account were reported.' },
  q06: { correct: 'D', answer: 'The Jaipur egg bhurji burglary.', explanation: 'Khichdi, pakoras and noodles were all reported break-in meal incidents.' },
  q07: { answer: 'Condoms, gutkha and stones.', explanation: 'Police alleged that canteen samosas were deliberately contaminated.', joke: 'Forget aloo samosa. These assholes invented the STD Special.', full: ['condom','gutkha','stone'], partial: ['condom','gutkha','stone'] },
  q08: { answer: "Aladdin's magic lamp.", explanation: 'Scammers allegedly staged a genie demonstration to con a Meerut doctor.', joke: 'Three wishes? Use the first to ask for a fucking refund.', patterns: ['magic lamp','aladdin','genie lamp','jinn lamp'] },
  q09: { answer: 'He was sitting on the toilet, relieving himself.', explanation: 'The participant joined a Gujarat High Court virtual hearing while using the toilet.', joke: 'The judge was delivering justice. This gentleman was delivering something else.', patterns: ['toilet','pooping','poop','shitting','shit','defecat','relieving','taking a dump','bathroom'] },
  q10: { answer: 'Forty knives.', explanation: 'Doctors in Amritsar surgically removed forty swallowed knives.', joke: "He didn't have butterflies in his stomach. He had a cutlery department.", patterns: ['knife','knives','blade'] },
  q11: { answer: 'Ten live birds concealed in the tubes.', explanation: 'Eight yellow-faced grassquits and two blue grosbeaks were reportedly inside the tubes.', joke: 'An entire fucking aviary in his underwear.', patterns: ['bird','finch','grassquit','grosbeak','sparrow'] },
  q12: { answer: 'He took their underwear, wore it, returned it the following night, and took another pair.', explanation: 'The reported CCTV footage exposed a repeated theft-and-return pattern.', joke: 'An underwear exchange subscription nobody signed up for.', full: ['underwear|panties|panty|knickers|lingerie', 'wear|wore|put on|used|return|swap|borrow'], partial: ['underwear','panties','panty','knickers','lingerie'] },
  q13: { answer: 'Samay Raina', aliases: ['samay raina', 'samay', 'raina'] },
  q14: { answer: 'Rakhi Sawant', aliases: ['rakhi sawant', 'rakhi'] },
  q15: { answer: 'Donald Trump', aliases: ['donald trump', 'trump', 'donald j trump', 'donald j. trump', 'doland trump'] },
  q16: { answer: 'Nirmala Sitharaman', aliases: ['nirmala sitharaman', 'nirmala', 'sitharaman', 'nirmala sitaraman'] },
  q17: { answer: 'Salman Khan', aliases: ['salman khan', 'salman', 'sallu bhai', 'bhaijaan'] },
  q18: { answer: 'Ravi Kishan', aliases: ['ravi kishan', 'ravi kishen', 'ravi'] }
};
export function grade(q, submission) {
  if (!submission) return 0;
  const k = HOST_KEY[q.id];
  if (q.type === 'fake') return submission.response === k.correct ? 100 : 0;
  const raw = String(submission.response || '').toLowerCase().trim();
  const norm = raw.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.type === 'person') return k.aliases.includes(norm) ? Math.max(100, 600 - 100 * (submission.clueCount || 5)) : 0;
  if (!norm) return 0;
  if (k.full) {
    const full = k.full.every(token => token.split('|').some(alias => norm.includes(alias)));
    if (full) return 200;
    const count = k.partial.filter(token => norm.includes(token)).length;
    return q.id === 'q07' ? (count >= 2 ? 100 : 0) : (count >= 1 ? 100 : 0);
  }
  return k.patterns.some(p => norm.includes(p)) ? 200 : 0;
}
