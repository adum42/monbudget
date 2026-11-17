// Tests unitaires du sélecteur d'emoji des catégories (#78) : catalogue, recherche, saisie libre.
// Usage : node tests/front/ticket78_emojis.test.js [index.html]
// Le bloc « FONCTIONS PURES EMOJIS (#78) » est extrait tel quel de index.html. Aucun réseau, Node seul.
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const extraire=(debutTxt,finTxt)=>{
  const d=html.indexOf(debutTxt),f=html.indexOf(finTxt,d);
  assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debutTxt);
  return html.slice(d,f);
};
const bloc78=extraire('// ══ DÉBUT FONCTIONS PURES EMOJIS (#78)','// ══ FIN FONCTIONS PURES EMOJIS (#78)');
const {EMOJI_CATS,normaliserRechercheEmoji,filtrerEmojis,validerEmojiLibre}=
  new Function(bloc78+';return {EMOJI_CATS,normaliserRechercheEmoji,filtrerEmojis,validerEmojiLibre};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};
const tous=Object.values(EMOJI_CATS).flat();
const emojis=tous.map(x=>x[0]);

// ── Catalogue ──────────────────────────────────────────
// Les 100 emojis d'avant #78 (✈️ figurait dans Transport et Voyages : il reste dans Transport)
const ANCIENS=['🛒','🍽️','🍕','🍔','☕','🛍️','🏠','🔧','💡','🚿','🛋️','🧹','🌿','🐾','👶','💊','🏥','💇','💅','🧴',
  '🚗','🚌','✈️','🚂','🚲','⛽','🅿️','🚕','🛵','⛵','💰','💳','🏦','📈','📉','💸','🪙','💎','🏆','🎯',
  '🎮','🎬','🎵','🎸','📚','🏋️','⚽','🎾','🎨','🎭','🎪','🎲','♟️','🧩','🎤','👕','👗','👟','👜','💄','🕶️','⌚','📱','💻','📷',
  '🏖️','🏔️','🗺️','🏨','🎡','🗼','🗽','🏯','🌅','💼','📊','📋','🖥️','📞','📧','✏️','📌','🗂️','🤝',
  '🎁','🎉','🎂','💝','🌟','⭐','🔥','💫','✨','🌈','🍀','🦋','🌸','🦁','🐬'];
const ANCIENS_GROUPES=['🏠 Quotidien','🚗 Transport','💰 Finances','🎮 Loisirs','👕 Shopping','✈️ Voyages','💼 Pro','🎁 Autres'];

cas('catalogue d\'environ 250 emojis (entre 240 et 300)',()=>assert.ok(emojis.length>=240&&emojis.length<=300,String(emojis.length)));
cas('aucun doublon entre les groupes',()=>{
  const vus=new Set(),doublons=emojis.filter(e=>vus.has(e)||!vus.add(e));
  assert.deepStrictEqual(doublons,[]);
});
cas('les 100 anciens emojis (99 distincts) sont toujours présents',()=>{
  assert.strictEqual(new Set(ANCIENS).size,99);
  assert.deepStrictEqual(ANCIENS.filter(e=>!emojis.includes(e)),[]);
});
cas('les 8 anciens groupes sont conservés, en tête et dans le même ordre',()=>
  assert.deepStrictEqual(Object.keys(EMOJI_CATS).slice(0,8),ANCIENS_GROUPES));
cas('les anciens emojis restent dans leur groupe d\'origine',()=>{
  const groupe=e=>Object.keys(EMOJI_CATS).find(g=>EMOJI_CATS[g].some(x=>x[0]===e));
  for(const e of ['🛒','🍽️','💊']) assert.strictEqual(groupe(e),'🏠 Quotidien',e);
  for(const e of ['✈️','⛽']) assert.strictEqual(groupe(e),'🚗 Transport',e);
  for(const e of ['🪙','🏦']) assert.strictEqual(groupe(e),'💰 Finances',e);
  for(const e of ['🏖️','🗽']) assert.strictEqual(groupe(e),'✈️ Voyages',e);
  for(const e of ['🔥','🦁']) assert.strictEqual(groupe(e),'🎁 Autres',e);
});
cas('nouveaux groupes présents (maison, alimentation, santé, abonnements, enfants, animaux, administratif, fêtes)',()=>{
  const g=Object.keys(EMOJI_CATS).join('|');
  for(const m of ['Maison','Alimentation','Santé','Abonnements','Enfants','Animaux','Administratif','Fêtes']) assert.ok(g.includes(m),m);
});
cas('emojis demandés par le ticket présents',()=>{
  for(const e of ['⚡','💧','📶','🧾','🔑','🛏️','🥖','🥗','🍷','🍺','🍰','🍣','🥩','🦷','👓','🩺','💉','🧘','📺','🎧','☁️','📰','🎟️',
    '🎓','🧸','🍼','🏫','🐶','🐱','🦴','🐟','🏛️','📄','⚖️','🎄','🎃','💐']) assert.ok(emojis.includes(e),e);
});
cas('chaque emoji a 1 à 4 mots-clés',()=>{
  for(const [e,m] of tous){const k=m.split(' ').filter(Boolean);assert.ok(k.length>=1&&k.length<=4,e+' '+m);}
});
cas('chaque entrée du catalogue est un emoji valide pour la saisie libre',()=>{
  for(const e of emojis) assert.ok(validerEmojiLibre(e).ok,e);
});

// ── Recherche ──────────────────────────────────────────
cas('normalisation : accents, majuscules et espaces',()=>
  assert.strictEqual(normaliserRechercheEmoji('  ÉLEC Santé '),'elec sante'));
cas('« elec » trouve ⚡ (début de mot, sans accent)',()=>{
  const r=filtrerEmojis(EMOJI_CATS,'elec');
  assert.ok(r.includes('⚡'));
  assert.ok(r.every(e=>/(^| )élec/i.test(tous.find(x=>x[0]===e)[1])),r.join(''));
});
cas('« resto » trouve 🍽️',()=>assert.ok(filtrerEmojis(EMOJI_CATS,'resto').includes('🍽️')));
cas('« sante » et « SANTÉ » donnent le même résultat, avec 💊 et 🏥',()=>{
  const a=filtrerEmojis(EMOJI_CATS,'sante'),b=filtrerEmojis(EMOJI_CATS,'SANTÉ');
  assert.deepStrictEqual(a,b);
  assert.ok(a.includes('💊')&&a.includes('🏥'));
});
cas('« courses » trouve 🛒',()=>assert.ok(filtrerEmojis(EMOJI_CATS,'courses').includes('🛒')));
cas('recherche limitée au début des mots : « tricite » ne trouve rien',()=>
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'tricite'),[]));
cas('mot inconnu -> liste vide',()=>assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'zzzz'),[]));
cas('recherche vide ou blanche -> liste vide (la grille revient au groupe courant)',()=>{
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,''),[]);
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'   '),[]);
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,null),[]);
});
cas('plusieurs mots : tous doivent correspondre',()=>{
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'pain bou'),['🥖']);
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'pain zzz'),[]);
});
cas('résultat sans doublon, dans l\'ordre du catalogue',()=>{
  const r=filtrerEmojis(EMOJI_CATS,'c');
  assert.strictEqual(new Set(r).size,r.length);
  const pos=r.map(e=>emojis.indexOf(e));
  assert.deepStrictEqual(pos,[...pos].sort((a,b)=>a-b));
});
cas('caractères spéciaux sans effet de bord (pas d\'expression régulière)',()=>{
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'.*'),[]);
  assert.deepStrictEqual(filtrerEmojis(EMOJI_CATS,'(['),[]);
});
cas('catalogue absent -> liste vide, sans erreur',()=>assert.deepStrictEqual(filtrerEmojis(undefined,'elec'),[]));

// ── Saisie libre ───────────────────────────────────────
const accepte=v=>{const r=validerEmojiLibre(v);assert.ok(r.ok,v+' refusé : '+r.message);return r.emoji;};
const refuse=v=>{const r=validerEmojiLibre(v);assert.ok(!r.ok,v+' accepté');assert.ok(r.message);return r.message;};
cas('🦖 accepté',()=>assert.strictEqual(accepte('🦖'),'🦖'));
cas('espaces autour retirés',()=>assert.strictEqual(accepte('  🦖 \n'),'🦖'));
cas('emoji avec sélecteur de variante (🛍️, ✈️, ❤️) accepté',()=>{accepte('🛍️');accepte('✈️');accepte('❤️');});
cas('emoji composé ZWJ 👨‍👩‍👧 accepté tel quel',()=>assert.strictEqual(accepte('👨‍👩‍👧'),'👨‍👩‍👧'));
cas('emoji avec couleur de peau 👍🏽 accepté',()=>accepte('👍🏽'));
cas('texte refusé (« abc », « a »)',()=>{refuse('abc');refuse('a');});
cas('chiffres refusés (« 12 », « 1 », touche 1️⃣)',()=>{refuse('12');refuse('1');refuse('1️⃣');refuse('#️⃣');});
cas('deux emojis refusés (« 🍕🍔 », « 🍕 🍔 »)',()=>{refuse('🍕🍔');refuse('🍕 🍔');});
cas('emoji + texte refusé',()=>{refuse('🍕a');refuse('a🍕');refuse('🍕!');});
cas('vide refusé avec « Colle un emoji. »',()=>{
  assert.strictEqual(refuse(''),'Colle un emoji.');
  assert.strictEqual(refuse('   '),'Colle un emoji.');
  assert.strictEqual(refuse(null),'Colle un emoji.');
});
cas('message de refus explicite',()=>assert.strictEqual(refuse('abc'),'Colle un seul emoji, sans texte ni chiffre.'));
cas('HTML refusé',()=>{refuse('<b>');refuse('<img src=x>');});
cas('symbole non emoji refusé (€, →)',()=>{refuse('€');refuse('→');});

console.log(`\n${n-ko}/${n} cas OK`);
if(ko) process.exit(1);
