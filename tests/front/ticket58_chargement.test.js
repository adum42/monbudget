// Tests unitaires du bloc « FONCTIONS PURES CHARGEMENT (#58) » : pas de fenêtre de saisie
// tant que le chargement des données n'est pas terminé.
// Usage : node tests/front/ticket58_chargement.test.js [index.html]
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const debut='// ══ DÉBUT FONCTIONS PURES CHARGEMENT (#58)',fin='// ══ FIN FONCTIONS PURES CHARGEMENT (#58)';
const d=html.indexOf(debut),f=html.indexOf(fin,d);
assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debut);
const {saisieBloquee,etatBoutonsSaisie,raccourciNouvelleTxPossible,TITRE_CHARGEMENT}=
  new Function(html.slice(d,f)+';return {saisieBloquee,etatBoutonsSaisie,raccourciNouvelleTxPossible,TITRE_CHARGEMENT};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

// ── saisieBloquee
cas('aucun chargement -> saisie possible',()=>assert.strictEqual(saisieBloquee(0),false));
cas('un chargement en cours -> bloquée',()=>assert.strictEqual(saisieBloquee(1),true));
cas('deux chargements superposés -> bloquée',()=>assert.strictEqual(saisieBloquee(2),true));
cas('valeur absente -> saisie possible (jamais bloquée à tort)',()=>{
  assert.strictEqual(saisieBloquee(undefined),false);
  assert.strictEqual(saisieBloquee(null),false);
});
cas('compteur négatif (ne devrait pas arriver) -> saisie possible',()=>assert.strictEqual(saisieBloquee(-1),false));

// ── etatBoutonsSaisie
cas('pendant le chargement : boutons inactifs avec infobulle',()=>
  assert.deepStrictEqual(etatBoutonsSaisie(1),{disabled:true,title:'Chargement des données en cours…'}));
cas('infobulle = constante TITRE_CHARGEMENT',()=>assert.strictEqual(etatBoutonsSaisie(3).title,TITRE_CHARGEMENT));
cas('chargement terminé : boutons actifs, sans infobulle',()=>
  assert.deepStrictEqual(etatBoutonsSaisie(0),{disabled:false,title:null}));

// ── raccourciNouvelleTxPossible (touche N)
const ok={connecte:true,ongletTransactions:true,modaleOuverte:false,chargementsEnCours:0};
cas('N : connecté, onglet Transactions, rien d\'ouvert, chargé -> oui',()=>assert.strictEqual(raccourciNouvelleTxPossible(ok),true));
cas('N : pendant le chargement -> non (cas du ticket)',()=>assert.strictEqual(raccourciNouvelleTxPossible({...ok,chargementsEnCours:1}),false));
cas('N : non connecté -> non',()=>assert.strictEqual(raccourciNouvelleTxPossible({...ok,connecte:false}),false));
cas('N : autre onglet -> non',()=>assert.strictEqual(raccourciNouvelleTxPossible({...ok,ongletTransactions:false}),false));
cas('N : une fenêtre déjà ouverte -> non',()=>assert.strictEqual(raccourciNouvelleTxPossible({...ok,modaleOuverte:true}),false));
cas('N : valeurs non booléennes acceptées',()=>{
  assert.strictEqual(raccourciNouvelleTxPossible({connecte:{id:'u'},ongletTransactions:1,modaleOuverte:0,chargementsEnCours:0}),true);
  assert.strictEqual(raccourciNouvelleTxPossible({connecte:null,ongletTransactions:true,modaleOuverte:false,chargementsEnCours:0}),false);
});

console.log(`\n${n-ko}/${n} cas OK`);
if(ko) process.exit(1);
