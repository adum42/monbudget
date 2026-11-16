// Tests unitaires de l'indicateur « Mouvements de compte » (#70) : entrées − sorties de la catégorie
// cochée, sur le mois affiché ou tout l'historique, et badge vert / rouge.
// Usage : node tests/front/ticket70_indicateur_mouvements.test.js [index.html]
// Les blocs « FONCTIONS PURES MOUVEMENT DE COMPTE (#69) » et « … INDICATEUR MOUVEMENTS DE COMPTE (#70) »
// sont extraits tels quels de index.html. Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const bloc=(nom)=>{
  const debut=html.indexOf('// ══ DÉBUT FONCTIONS PURES '+nom);
  const fin=html.indexOf('// ══ FIN FONCTIONS PURES '+nom,debut);
  assert.ok(debut>0&&fin>debut,'bloc '+nom+' introuvable dans '+fichier);
  return html.slice(debut,fin);
};
const f=new Function(bloc('MOUVEMENT DE COMPTE (#69)')+'\n'+bloc('INDICATEUR MOUVEMENTS DE COMPTE (#70)')+
  ';return {totalMouvementsCompte,badgeMouvementsCompte};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const CATS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:true}];
const SANS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:false}];
const tx=(id,m={})=>({id,type:'sortie',montant:100,date:'2026-11-05',compte_id:'k1',categorie_id:'cv',...m});
const NOV='2026-11';

// totalMouvementsCompte : critères du ticket
cas('critère : sortie 100 + entrée 100 dans le mois -> 0',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s'),tx('e',{type:'entrée',compte_id:'k2'})],CATS,NOV),0));
cas('critère : seulement la sortie -> −100',()=>assert.strictEqual(f.totalMouvementsCompte([tx('s')],CATS,NOV),-100));
cas('seulement l\'entrée -> +100',()=>assert.strictEqual(f.totalMouvementsCompte([tx('e',{type:'entrée'})],CATS,NOV),100));
const A_CHEVAL=[tx('s',{date:'2026-10-31'}),tx('e',{type:'entrée',date:'2026-11-02',compte_id:'k2'})];
cas('critère : virement 31/10 -> 02/11 : octobre −100',()=>assert.strictEqual(f.totalMouvementsCompte(A_CHEVAL,CATS,'2026-10'),-100));
cas('critère : virement 31/10 -> 02/11 : novembre +100',()=>assert.strictEqual(f.totalMouvementsCompte(A_CHEVAL,CATS,NOV),100));
cas('critère : virement 31/10 -> 02/11 : tout l\'historique (null) -> 0',()=>assert.strictEqual(f.totalMouvementsCompte(A_CHEVAL,CATS,null),0));
cas('tout l\'historique aussi avec une chaîne vide',()=>assert.strictEqual(f.totalMouvementsCompte(A_CHEVAL,CATS,''),0));
cas('critère : arrondi au centime, 0,1 + 0,2 − 0,3 -> 0 (et pas 5,5e-17)',()=>{
  const r=f.totalMouvementsCompte([tx('a',{type:'entrée',montant:0.1}),tx('b',{type:'entrée',montant:0.2}),tx('c',{montant:0.3})],CATS,NOV);
  assert.strictEqual(r,0);assert.ok(Object.is(r,0),'pas de −0');
});
cas('arrondi : 10 × 0,10 en entrée − 1 en sortie -> 0',()=>{
  const l=Array.from({length:10},(_,i)=>tx('e'+i,{type:'entrée',montant:0.1}));l.push(tx('s',{montant:1}));
  assert.strictEqual(f.totalMouvementsCompte(l,CATS,NOV),0);
});
cas('écart au centime conservé : 150,10 − 150 -> −0,1',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s',{montant:150.1}),tx('e',{type:'entrée',montant:150})],CATS,NOV),-0.1));
cas('montant en chaîne (numeric renvoyé en texte) accepté',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s',{montant:'12.34'})],CATS,NOV),-12.34));
cas('les autres catégories et les opérations sans catégorie sont ignorées',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s'),tx('a',{type:'entrée',categorie_id:'c1',montant:500}),tx('b',{type:'entrée',categorie_id:null,montant:7})],CATS,NOV),-100));
cas('les opérations d\'un autre mois sont ignorées sur le mois affiché',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s'),tx('x',{date:'2026-12-01',type:'entrée',montant:40})],CATS,NOV),-100));
cas('aucune opération de la catégorie dans le mois -> 0 (badge vert)',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('a',{categorie_id:'c1'})],CATS,NOV),0));
cas('liste vide ou absente -> 0',()=>{assert.strictEqual(f.totalMouvementsCompte([],CATS,NOV),0);assert.strictEqual(f.totalMouvementsCompte(undefined,CATS,NOV),0);});
cas('aucune catégorie cochée -> null (badge masqué)',()=>assert.strictEqual(f.totalMouvementsCompte([tx('s')],SANS,NOV),null));
cas('catégories absentes -> null',()=>assert.strictEqual(f.totalMouvementsCompte([tx('s')],undefined,NOV),null));
cas('identifiants comparés en texte (nombre / chaîne)',()=>
  assert.strictEqual(f.totalMouvementsCompte([tx('s',{categorie_id:7})],[{id:'7',mouvement_compte:true}],NOV),-100));
cas('lignes vides, montant illisible ou type inconnu ignorés',()=>
  assert.strictEqual(f.totalMouvementsCompte([null,tx('s'),tx('z',{montant:'abc'}),tx('m',{type:'mouvement'})],CATS,NOV),-100));
cas('la liste d\'origine n\'est pas modifiée',()=>{
  const l=[tx('s'),tx('e',{type:'entrée'})];const copie=JSON.stringify(l);
  f.totalMouvementsCompte(l,CATS,NOV);assert.strictEqual(JSON.stringify(l),copie);
});

// badgeMouvementsCompte
cas('total nul -> badge vert « ✓ Mouvements de compte : 0,00 € »',()=>
  assert.deepStrictEqual(f.badgeMouvementsCompte(0),{ok:true,classe:'badge-ok',texte:'✓ Mouvements de compte : 0,00 €'}));
cas('critère : −100 -> badge rouge « ✗ Mouvements de compte : −100,00 € » (signe moins typographique)',()=>
  assert.deepStrictEqual(f.badgeMouvementsCompte(-100),{ok:false,classe:'badge-ko',texte:'✗ Mouvements de compte : −100,00 €'}));
cas('écart positif -> « +100,00 € »',()=>assert.strictEqual(f.badgeMouvementsCompte(100).texte,'✗ Mouvements de compte : +100,00 €'));
cas('exemple du ticket : −150 -> « −150,00 € »',()=>assert.strictEqual(f.badgeMouvementsCompte(-150).texte,'✗ Mouvements de compte : −150,00 €'));
cas('centimes : −0,1 -> « −0,10 € »',()=>assert.strictEqual(f.badgeMouvementsCompte(-0.1).texte,'✗ Mouvements de compte : −0,10 €'));
cas('milliers séparés comme fmt() (fr-FR)',()=>{
  const attendu=(1234.5).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  assert.strictEqual(f.badgeMouvementsCompte(-1234.5).texte,'✗ Mouvements de compte : −'+attendu+' €');
});
cas('résidu flottant sous le demi-centime -> vert',()=>assert.strictEqual(f.badgeMouvementsCompte(0.1+0.2-0.3).ok,true));
cas('null ou undefined (aucune catégorie cochée) -> null',()=>{assert.strictEqual(f.badgeMouvementsCompte(null),null);assert.strictEqual(f.badgeMouvementsCompte(undefined),null);});
cas('valeur illisible -> null',()=>assert.strictEqual(f.badgeMouvementsCompte(NaN),null));
cas('enchaînement : virement à cheval, badges des deux mois et de « Tout voir »',()=>{
  const b=m=>f.badgeMouvementsCompte(f.totalMouvementsCompte(A_CHEVAL,CATS,m));
  assert.strictEqual(b('2026-10').classe,'badge-ko');assert.strictEqual(b(NOV).classe,'badge-ko');assert.strictEqual(b(null).classe,'badge-ok');
});

console.log(`\n${n-ko}/${n} cas réussis`);
if(ko) process.exit(1);
