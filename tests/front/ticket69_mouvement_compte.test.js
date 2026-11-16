// Tests unitaires des fonctions pures « Mouvement de compte » (#69) : exclusion des statistiques
// des opérations de la catégorie cochée, et changement de catégorie cochée.
// Usage : node tests/front/ticket69_mouvement_compte.test.js [index.html]
// Le bloc « FONCTIONS PURES MOUVEMENT DE COMPTE (#69) » est extrait tel quel de index.html.
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const debut=html.indexOf('// ══ DÉBUT FONCTIONS PURES MOUVEMENT DE COMPTE (#69)');
const fin=html.indexOf('// ══ FIN FONCTIONS PURES MOUVEMENT DE COMPTE (#69)',debut);
assert.ok(debut>0&&fin>debut,'bloc des fonctions pures #69 introuvable dans '+fichier);
const f=new Function(html.slice(debut,fin)+
  ';return {categorieMouvementCompte,estMouvementDeCompte,txPourStats,categorieMouvementARetirer,messageMouvementCompteRetire};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const CATS=[
  {id:'c1',nom:'Courses',mouvement_compte:false},
  {id:'cv',nom:'Virement interne',mouvement_compte:true},
  {id:'c2',nom:'Épargne',mouvement_compte:false},
];
const SANS=[{id:'c1',nom:'Courses',mouvement_compte:false},{id:'cv',nom:'Virement interne',mouvement_compte:false}];
const tx=(id,m={})=>({id,type:'sortie',montant:10,date:'2026-11-05',compte_id:'k1',categorie_id:'c1',...m});
// Critère du ticket : sortie de 200 € et entrée de 200 € en « Virement interne », plus 2 opérations normales.
const TXS=[
  tx('s',{montant:200,categorie_id:'cv'}),
  tx('e',{type:'entrée',montant:200,compte_id:'k2',categorie_id:'cv'}),
  tx('a',{montant:42}),
  tx('b',{type:'entrée',montant:1500,categorie_id:null}),
];
const somme=(l,type)=>l.filter(t=>t.type===type).reduce((s,t)=>s+t.montant,0);

// categorieMouvementCompte
cas('catégorie cochée trouvée',()=>assert.strictEqual(f.categorieMouvementCompte(CATS).id,'cv'));
cas('aucune catégorie cochée -> null',()=>assert.strictEqual(f.categorieMouvementCompte(SANS),null));
cas('liste vide ou absente -> null',()=>{assert.strictEqual(f.categorieMouvementCompte([]),null);assert.strictEqual(f.categorieMouvementCompte(undefined),null);});
cas('colonne absente (avant #68) -> null',()=>assert.strictEqual(f.categorieMouvementCompte([{id:'c1',nom:'X'}]),null));
cas('valeur non booléenne ignorée (seul true compte)',()=>assert.strictEqual(f.categorieMouvementCompte([{id:'c1',mouvement_compte:'true'},{id:'c2',mouvement_compte:1}]),null));

// estMouvementDeCompte
cas('opération de la catégorie cochée -> vrai',()=>assert.strictEqual(f.estMouvementDeCompte(TXS[0],CATS),true));
cas('entrée de la catégorie cochée -> vrai',()=>assert.strictEqual(f.estMouvementDeCompte(TXS[1],CATS),true));
cas('autre catégorie -> faux',()=>assert.strictEqual(f.estMouvementDeCompte(TXS[2],CATS),false));
cas('sans catégorie -> faux',()=>assert.strictEqual(f.estMouvementDeCompte(TXS[3],CATS),false));
cas('aucune catégorie cochée -> faux',()=>assert.strictEqual(f.estMouvementDeCompte(TXS[0],SANS),false));
cas('transaction absente -> faux',()=>assert.strictEqual(f.estMouvementDeCompte(null,CATS),false));
cas('identifiants comparés en texte (nombre / chaîne)',()=>assert.strictEqual(f.estMouvementDeCompte({categorie_id:7},[{id:'7',mouvement_compte:true}]),true));
cas('s\'appuie sur la liste des catégories, pas sur la jointure',()=>
  assert.strictEqual(f.estMouvementDeCompte({...TXS[2],categories:{nom:'Virement interne',mouvement_compte:true}},CATS),false));

// txPourStats : critère « n'apparaissent dans aucun total »
cas('critère : les 200 € de virement sont exclus des entrées et des sorties',()=>{
  const r=f.txPourStats(TXS,CATS);
  assert.deepStrictEqual(r.map(t=>t.id),['a','b']);
  assert.strictEqual(somme(r,'sortie'),42);assert.strictEqual(somme(r,'entrée'),1500);
});
cas('aucune catégorie cochée : rien n\'est exclu',()=>assert.strictEqual(f.txPourStats(TXS,SANS).length,4));
cas('la liste d\'origine n\'est pas modifiée',()=>{
  const copie=TXS.slice();f.txPourStats(TXS,CATS);assert.deepStrictEqual(TXS,copie);
});
cas('renvoie une nouvelle liste (trier le résultat ne trie pas l\'original)',()=>assert.notStrictEqual(f.txPourStats(TXS,SANS),TXS));
cas('liste absente -> []',()=>assert.deepStrictEqual(f.txPourStats(undefined,CATS),[]));
cas('éléments vides ignorés',()=>assert.deepStrictEqual(f.txPourStats([null,TXS[2]],CATS).map(t=>t.id),['a']));
cas('critère : l\'exclusion suit la nouvelle catégorie cochée',()=>{
  const apres=[{id:'c1',nom:'Courses',mouvement_compte:true},{id:'cv',nom:'Virement interne',mouvement_compte:false}];
  assert.deepStrictEqual(f.txPourStats(TXS,apres).map(t=>t.id),['s','e','b']);
});
cas('un mois sans opération normale : 0 partout',()=>{
  const r=f.txPourStats(TXS.slice(0,2),CATS);
  assert.strictEqual(somme(r,'entrée')-somme(r,'sortie'),0);assert.strictEqual(r.length,0);
});

// categorieMouvementARetirer : quelle catégorie décocher d'abord (sinon 23505)
cas('cocher une autre catégorie -> l\'ancienne est à décocher',()=>assert.strictEqual(f.categorieMouvementARetirer(CATS,'c1',true).id,'cv'));
cas('nouvelle catégorie cochée -> l\'ancienne est à décocher',()=>assert.strictEqual(f.categorieMouvementARetirer(CATS,null,true).id,'cv'));
cas('la catégorie déjà cochée reste cochée -> rien à retirer',()=>assert.strictEqual(f.categorieMouvementARetirer(CATS,'cv',true),null));
cas('case non cochée -> rien à retirer',()=>assert.strictEqual(f.categorieMouvementARetirer(CATS,'c1',false),null));
cas('aucune catégorie cochée avant -> rien à retirer',()=>assert.strictEqual(f.categorieMouvementARetirer(SANS,'c1',true),null));
cas('identifiant comparé en texte',()=>assert.strictEqual(f.categorieMouvementARetirer([{id:5,mouvement_compte:true}],'5',true),null));

// messageMouvementCompteRetire
cas('message après enregistrement (texte du ticket)',()=>
  assert.strictEqual(f.messageMouvementCompteRetire({nom:'Virement interne'},true),'Virement interne n\'est plus la catégorie Mouvement de compte.'));
cas('message avant enregistrement',()=>
  assert.strictEqual(f.messageMouvementCompteRetire({nom:'Virement interne'},false),'Virement interne ne sera plus la catégorie Mouvement de compte.'));
cas('nom piégé gardé tel quel (inséré avec textContent)',()=>
  assert.ok(f.messageMouvementCompteRetire({nom:'<b>&</b>'},true).startsWith('<b>&</b>')));
cas('catégorie sans nom',()=>assert.match(f.messageMouvementCompteRetire(null,true),/^L'ancienne catégorie n'est plus/));

console.log(ko?`\n${ko} échec(s) / ${n}`:`\nTous les cas passent (${n})`);process.exit(ko?1:0);
