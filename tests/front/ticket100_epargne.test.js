// Tests unitaires de l'histogramme « Épargne — 6 mois » (#100) : épargne du mois = entrées − sorties,
// hors catégorie « Mouvement de compte », en centimes entiers ; null pour un mois sans opération.
// Usage : node tests/front/ticket100_epargne.test.js [index.html]
// Les blocs « FONCTIONS PURES MOUVEMENT DE COMPTE (#69) » et « … ÉPARGNE (#100) » sont extraits
// tels quels de index.html. Aucun réseau, aucune base, aucune dépendance (Node seul).
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
const f=new Function(bloc('MOUVEMENT DE COMPTE (#69)')+'\n'+bloc('ÉPARGNE (#100)')+
  ';return {moisGlissants,epargneParMois,libelleEpargne,bornesAxeEpargne};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const CATS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:true}];
const SANS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:false}];
const tx=(id,m={})=>({id,type:'sortie',montant:100,date:'2026-11-05',compte_id:'k1',categorie_id:'c1',...m});
const NOV=['2026-11'];
const SIX=['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11'];
const ep=(l,mois=NOV,cats=CATS)=>f.epargneParMois(l,cats,mois);

// epargneParMois : critères du ticket
cas('critère : 2 000 € d\'entrées, 1 400 € de sorties -> +600',()=>
  assert.deepStrictEqual(ep([tx('e',{type:'entrée',montant:2000}),tx('s',{montant:1400})]),[600]));
cas('critère : 1 000 € d\'entrées, 1 300 € de sorties -> −300',()=>
  assert.deepStrictEqual(ep([tx('e',{type:'entrée',montant:1000}),tx('s',{montant:1300})]),[-300]));
cas('critère : sortie + entrée « Mouvement de compte » ne changent pas la barre',()=>{
  const base=[tx('e',{type:'entrée',montant:2000}),tx('s',{montant:1400})];
  const mvt=[tx('ms',{montant:500,categorie_id:'cv'}),tx('me',{type:'entrée',montant:300,categorie_id:'cv',compte_id:'k2'})];
  assert.deepStrictEqual(ep(base.concat(mvt)),[600]);
});
cas('critère : mois sans aucune opération -> null',()=>assert.deepStrictEqual(ep([tx('s',{date:'2026-10-05'})]),[null]));
cas('critère : mois avec seulement des opérations « Mouvement de compte » -> null',()=>
  assert.deepStrictEqual(ep([tx('ms',{categorie_id:'cv'}),tx('me',{type:'entrée',categorie_id:'cv'})]),[null]));
cas('critère : opérations dont le total vaut 0 -> 0 (barre à 0), et pas −0',()=>{
  const r=ep([tx('e',{type:'entrée',montant:250}),tx('s',{montant:250})]);
  assert.deepStrictEqual(r,[0]);assert.ok(Object.is(r[0],0),'pas de −0');
});
cas('critère : centimes, 0,1 + 0,2 − 0,3 -> 0 (et pas 5,5e-17)',()=>{
  const r=ep([tx('a',{type:'entrée',montant:0.1}),tx('b',{type:'entrée',montant:0.2}),tx('c',{montant:0.3})]);
  assert.ok(Object.is(r[0],0),'obtenu '+r[0]);
});
cas('centimes : 10 × 0,10 en entrée − 0,99 en sortie -> 0,01',()=>{
  const l=Array.from({length:10},(_,i)=>tx('e'+i,{type:'entrée',montant:0.1}));l.push(tx('s',{montant:0.99}));
  assert.deepStrictEqual(ep(l),[0.01]);
});
cas('écart au centime conservé : 1 234,56 − 1 000,05 -> 234,51',()=>
  assert.deepStrictEqual(ep([tx('e',{type:'entrée',montant:1234.56}),tx('s',{montant:1000.05})]),[234.51]));
cas('montant en chaîne (numeric renvoyé en texte) accepté',()=>
  assert.deepStrictEqual(ep([tx('e',{type:'entrée',montant:'12.34'})]),[12.34]));
cas('6 mois : une valeur par mois, dans l\'ordre, null pour les mois vides',()=>
  assert.deepStrictEqual(ep([
    tx('a',{date:'2026-07-31',type:'entrée',montant:50}),
    tx('b',{date:'2026-09-01',montant:20}),
    tx('c',{date:'2026-11-30',type:'entrée',montant:10}),
    tx('d',{date:'2026-05-31',type:'entrée',montant:999}),   // hors période
    tx('e',{date:'2026-12-01',montant:999}),                 // hors période
  ],SIX),[null,50,null,-20,null,10]));
cas('opérations sans catégorie comptées',()=>assert.deepStrictEqual(ep([tx('s',{categorie_id:null,montant:7})]),[-7]));
cas('aucune catégorie cochée : rien n\'est exclu',()=>
  assert.deepStrictEqual(ep([tx('s',{categorie_id:'cv',montant:40})],NOV,SANS),[-40]));
cas('catégories absentes : rien n\'est exclu',()=>
  assert.deepStrictEqual(f.epargneParMois([tx('s',{categorie_id:'cv',montant:40})],undefined,NOV),[-40]));
cas('identifiants comparés en texte (nombre / chaîne)',()=>
  assert.deepStrictEqual(f.epargneParMois([tx('s',{categorie_id:7}),tx('e',{type:'entrée',montant:5})],[{id:'7',mouvement_compte:true}],NOV),[5]));
cas('lignes vides, montant illisible, type inconnu ou ancien « mouvement » ignorés (et ne rendent pas le mois « avec opérations »)',()=>{
  assert.deepStrictEqual(ep([null,undefined,tx('x',{montant:'abc'}),tx('y',{type:'mouvement'}),tx('z',{type:'autre'})]),[null]);
  assert.deepStrictEqual(ep([null,tx('x',{montant:'abc'}),tx('s',{montant:3})]),[-3]);
});
cas('liste vide ou absente -> null pour chaque mois',()=>{
  assert.deepStrictEqual(ep([],SIX),[null,null,null,null,null,null]);
  assert.deepStrictEqual(ep(undefined,NOV),[null]);
});
cas('liste de mois vide ou absente -> []',()=>{assert.deepStrictEqual(ep([tx('s')],[]),[]);assert.deepStrictEqual(f.epargneParMois([tx('s')],CATS,undefined),[]);});
cas('n\'altère pas la liste reçue',()=>{const l=[tx('s')];const copie=JSON.stringify(l);ep(l);assert.strictEqual(JSON.stringify(l),copie);});

// moisGlissants : même période que « Évolution 6 mois »
cas('moisGlissants : 6 mois jusqu\'au 4 novembre 2026',()=>
  assert.deepStrictEqual(f.moisGlissants(new Date(2026,10,4,10),6),SIX));
cas('moisGlissants : passage d\'année (février 2027)',()=>
  assert.deepStrictEqual(f.moisGlissants(new Date(2027,1,15),6),['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02']));
cas('moisGlissants : le 31 du mois (pas de saut de mois)',()=>
  assert.deepStrictEqual(f.moisGlissants(new Date(2026,2,31,23,59),3),['2026-01','2026-02','2026-03']));

// libelleEpargne : infobulle
const NB=' ';   // espace fine insécable des milliers, fr-FR
cas('libellé : positif avec « + »',()=>assert.strictEqual(f.libelleEpargne(612),'+612,00 €'));
cas('libellé : négatif avec le vrai signe moins « − »',()=>assert.strictEqual(f.libelleEpargne(-150),'−150,00 €'));
cas('libellé : 0 -> « 0,00 € » sans signe',()=>assert.strictEqual(f.libelleEpargne(0),'0,00 €'));
cas('libellé : null / undefined -> « aucune opération »',()=>{
  assert.strictEqual(f.libelleEpargne(null),'aucune opération');assert.strictEqual(f.libelleEpargne(undefined),'aucune opération');
});
cas('libellé : milliers et centimes au format fr-FR',()=>{
  assert.strictEqual(f.libelleEpargne(1234.5),'+1'+NB+'234,50 €');
  assert.strictEqual(f.libelleEpargne(-0.01),'−0,01 €');
});

// bornesAxeEpargne : ligne 0 au milieu
cas('bornes symétriques sur la plus grande valeur absolue',()=>assert.deepStrictEqual(f.bornesAxeEpargne([600,-300,null]),{min:-600,max:600}));
cas('bornes : un négatif plus grand que le positif',()=>assert.deepStrictEqual(f.bornesAxeEpargne([50,-1300]),{min:-1300,max:1300}));
cas('bornes : 100 € au moins (mois vides ou à 0)',()=>{
  assert.deepStrictEqual(f.bornesAxeEpargne([null,null,0]),{min:-100,max:100});
  assert.deepStrictEqual(f.bornesAxeEpargne([]),{min:-100,max:100});
  assert.deepStrictEqual(f.bornesAxeEpargne(undefined),{min:-100,max:100});
});

console.log(`\n${n-ko}/${n} cas réussis`);
if(ko) process.exit(1);
