// Tests unitaires du filtre par compte et de la ligne de sous-total des transactions affichées (#72).
// Usage : node tests/front/ticket72_filtres_sous_total.test.js [index.html]
// Les blocs « FONCTIONS PURES MOUVEMENT DE COMPTE (#69) » et « … FILTRES ET SOUS-TOTAL (#72) »
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
const f=new Function(bloc('MOUVEMENT DE COMPTE (#69)')+'\n'+bloc('FILTRES ET SOUS-TOTAL (#72)')+
  ';return {filtrerTransactions,sousTotalTransactions,texteSousTotal,valeurFiltreCompte};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const CATS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:true}];
const SANS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:false}];
const tx=(id,m={})=>({id,type:'sortie',montant:10,date:'2026-11-05',compte_id:'k1',categorie_id:'c1',tricount:'non',epingle:false,description:'Op '+id,note:null,...m});
const JEU=[
  tx('a',{type:'entrée',montant:2000,description:'Salaire',categorie_id:null}),
  tx('b',{montant:4.2,description:'Boulangerie',epingle:true}),
  tx('c',{montant:30,compte_id:'k2',description:'Cinéma',note:'avec Léa',tricount:'oui'}),
  tx('d',{montant:100,categorie_id:'cv',description:'Virement vers livret'}),
  tx('e',{type:'entrée',montant:100,categorie_id:'cv',compte_id:'k2',description:'Virement depuis courant'}),
  tx('f',{montant:650,date:'2026-10-05',description:'Loyer octobre'}),
  tx('g',{montant:5,compte_id:null,description:'Ancienne sans compte'}),
];
const ids=l=>l.map(t=>t.id).sort().join(',');
const NOV={mois:'2026-11'};

// filtrerTransactions
cas('sans filtre, mois affiché : toutes les opérations du mois',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,NOV)),'a,b,c,d,e,g'));
cas('« Tout voir » (mois null) : tout l\'historique',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{mois:null})),'a,b,c,d,e,f,g'));
cas('« Tout voir » aussi avec une chaîne vide',()=>assert.strictEqual(f.filtrerTransactions(JEU,{mois:''}).length,7));
cas('critère : un compte -> seulement ses transactions',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,compte:'k2'})),'c,e'));
cas('critère : « Tous les comptes » (all) -> toutes',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,compte:'all'})),'a,b,c,d,e,g'));
cas('opération sans compte : seulement sous « Tous les comptes »',()=>{
  assert.ok(!f.filtrerTransactions(JEU,{...NOV,compte:'k1'}).some(t=>t.id==='g'));
  assert.ok(f.filtrerTransactions(JEU,{...NOV,compte:'all'}).some(t=>t.id==='g'));
});
cas('identifiant de compte comparé en texte (nombre / chaîne)',()=>
  assert.strictEqual(f.filtrerTransactions([tx('x',{compte_id:7})],{compte:'7'}).length,1));
cas('critère : compte + type',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,compte:'k1',type:'entrée'})),'a'));
cas('critère : compte + catégorie',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,compte:'k1',categorie:'c1'})),'b'));
cas('critère : compte + recherche (description, sans casse)',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,compte:'k1',recherche:'  BOULANG '})),'b'));
cas('recherche dans la note',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,recherche:'léa'})),'c'));
cas('critère : compte + « Tout voir »',()=>assert.strictEqual(ids(f.filtrerTransactions(JEU,{mois:null,compte:'k1',categorie:'c1'})),'b,f'));
cas('filtre Tricount (absent = non)',()=>{
  assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,tricount:'oui'})),'c');
  assert.strictEqual(f.filtrerTransactions([tx('x',{tricount:null})],{tricount:'non'}).length,1);
});
cas('filtre épingle oui / non',()=>{
  assert.strictEqual(ids(f.filtrerTransactions(JEU,{...NOV,epingle:'oui'})),'b');
  assert.ok(!f.filtrerTransactions(JEU,{...NOV,epingle:'non'}).some(t=>t.id==='b'));
});
cas('aucun filtre ne correspond -> liste vide',()=>assert.deepStrictEqual(f.filtrerTransactions(JEU,{...NOV,compte:'k2',type:'sortie',categorie:'cv'}),[]));
cas('ne modifie pas la liste d\'origine',()=>{const copie=JSON.stringify(JEU);f.filtrerTransactions(JEU,{compte:'k1'});assert.strictEqual(JSON.stringify(JEU),copie);});
cas('liste ou filtres absents, lignes vides ignorées',()=>{
  assert.deepStrictEqual(f.filtrerTransactions(undefined,NOV),[]);
  assert.strictEqual(f.filtrerTransactions([null,tx('x')],undefined).length,1);
});

// sousTotalTransactions
cas('critère : sans filtre catégorie, « Mouvement de compte » exclue des montants mais comptée dans N',()=>{
  const st=f.sousTotalTransactions(f.filtrerTransactions(JEU,NOV),CATS,'all');
  assert.deepStrictEqual(st,{nb:6,entrees:2000,sorties:39.2});
});
cas('critère : filtre catégorie sur « Mouvement de compte » -> ses montants comptent',()=>{
  const st=f.sousTotalTransactions(f.filtrerTransactions(JEU,{...NOV,categorie:'cv'}),CATS,'cv');
  assert.deepStrictEqual(st,{nb:2,entrees:100,sorties:100});
});
cas('filtre sur une autre catégorie : mouvements absents de toute façon',()=>
  assert.deepStrictEqual(f.sousTotalTransactions(f.filtrerTransactions(JEU,{...NOV,categorie:'c1'}),CATS,'c1'),{nb:3,entrees:0,sorties:39.2}));
cas('filtre compte k2 : seule l\'entrée « Mouvement » est listée, exclue des montants',()=>
  assert.deepStrictEqual(f.sousTotalTransactions(f.filtrerTransactions(JEU,{...NOV,compte:'k2'}),CATS,'all'),{nb:2,entrees:0,sorties:30}));
cas('aucune catégorie cochée : rien n\'est exclu',()=>
  assert.deepStrictEqual(f.sousTotalTransactions(f.filtrerTransactions(JEU,NOV),SANS,'all'),{nb:6,entrees:2100,sorties:139.2}));
cas('critère : aucune ligne affichée -> null (masqué)',()=>{assert.strictEqual(f.sousTotalTransactions([],CATS,'all'),null);assert.strictEqual(f.sousTotalTransactions(undefined,CATS,'all'),null);});
cas('uniquement des mouvements sans filtre catégorie : N affiché, montants à 0',()=>
  assert.deepStrictEqual(f.sousTotalTransactions([JEU[3],JEU[4]],CATS,'all'),{nb:2,entrees:0,sorties:0}));
cas('arrondi au centime : 0,1 + 0,2 -> 0,3 exactement',()=>
  assert.strictEqual(f.sousTotalTransactions([tx('x',{montant:0.1}),tx('y',{montant:0.2})],CATS,'all').sorties,0.3));
cas('montant en chaîne accepté, montant illisible ignoré',()=>
  assert.deepStrictEqual(f.sousTotalTransactions([tx('x',{montant:'12.34'}),tx('y',{montant:'abc'})],CATS,'all'),{nb:2,entrees:0,sorties:12.34}));
cas('le tri n\'a pas d\'effet',()=>{
  const l=f.filtrerTransactions(JEU,NOV);
  assert.deepStrictEqual(f.sousTotalTransactions(l,CATS,'all'),f.sousTotalTransactions([...l].reverse(),CATS,'all'));
});

// texteSousTotal
const sp=s=>s.replace(/[  ]/g,' ');
cas('format « N opérations · +X € · −Y € »',()=>{
  const t=f.texteSousTotal({nb:6,entrees:2000,sorties:39.2});
  assert.deepStrictEqual({nb:t.nb,entrees:sp(t.entrees),sorties:sp(t.sorties)},{nb:'6 opérations',entrees:'+2 000,00 €',sorties:'−39,20 €'});
});
cas('singulier pour une opération',()=>assert.strictEqual(f.texteSousTotal({nb:1,entrees:0,sorties:5}).nb,'1 opération'));
cas('zéro affiché « +0,00 € » / « −0,00 € »',()=>{
  const t=f.texteSousTotal({nb:2,entrees:0,sorties:0});assert.strictEqual(t.entrees,'+0,00 €');assert.strictEqual(t.sorties,'−0,00 €');
});
cas('null -> null',()=>assert.strictEqual(f.texteSousTotal(null),null));

// valeurFiltreCompte
const COMPTES=[{id:'k1',nom:'Courant'},{id:'k2',nom:'Livret'}];
cas('compte encore présent : valeur gardée',()=>assert.strictEqual(f.valeurFiltreCompte('k2',COMPTES),'k2'));
cas('critère : compte disparu -> « Tous les comptes »',()=>assert.strictEqual(f.valeurFiltreCompte('k9',COMPTES),'all'));
cas('all, vide ou absent -> all',()=>{for(const v of ['all','',null,undefined]) assert.strictEqual(f.valeurFiltreCompte(v,COMPTES),'all');});
cas('liste de comptes vide ou absente -> all',()=>{assert.strictEqual(f.valeurFiltreCompte('k1',[]),'all');assert.strictEqual(f.valeurFiltreCompte('k1',undefined),'all');});

console.log(`\n${n-ko}/${n} cas réussis`);
if(ko) process.exit(1);
