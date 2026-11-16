// Tests unitaires des fonctions pures de la modale transaction (#6).
// Usage : node tests/front/ticket06_fonctions_tx.test.js [index.html]
// Le bloc « FONCTIONS PURES (#6) » est extrait tel quel de index.html : on teste le vrai code.
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const debut=html.indexOf('// ── TRANSACTIONS : FONCTIONS PURES (#6)');
// Fin = début du bloc #45 (et non « MODAL TX ») : une erreur dans #45 ne fait pas échouer #6 (#9).
const fin=html.indexOf('// ── DATE DU JOUR : FONCTION PURE (#45)');
assert.ok(debut>0&&fin>debut,'bloc des fonctions pures introuvable dans '+fichier);
const f=new Function(html.slice(debut,fin)+
  ';return {lireMontant,compteParDefaut,validerSaisieTx,construireLigneTx,messageErreurSupabase,libelleCompteTx,MONTANT_MAX};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};
const base={description:'Courses',montant:12.5,date:'2026-10-03',type:'sortie',compteId:'k1'};
const COMPTES=[{id:'k1',nom:'CCP Banque fictive',par_defaut:true},{id:'k2',nom:'Livret A'},{id:'k3',nom:'Livret DD'}];

// lireMontant
cas('lireMontant : nombre simple',()=>assert.strictEqual(f.lireMontant('12.5'),12.5));
cas('lireMontant : virgule décimale',()=>assert.strictEqual(f.lireMontant('12,5'),12.5));
cas('lireMontant : vide -> NaN',()=>assert.ok(Number.isNaN(f.lireMontant(''))));
cas('lireMontant : espaces -> NaN',()=>assert.ok(Number.isNaN(f.lireMontant('   '))));
cas('lireMontant : illisible -> NaN',()=>assert.ok(Number.isNaN(f.lireMontant('abc'))));
cas('lireMontant : négatif conservé (refusé ensuite)',()=>assert.strictEqual(f.lireMontant('-12'),-12));
cas('lireMontant : notation 1e10',()=>assert.strictEqual(f.lireMontant('1e10'),1e10));

// compteParDefaut
cas('compteParDefaut : compte marqué',()=>assert.strictEqual(f.compteParDefaut(COMPTES),'k1'));
cas('compteParDefaut : un seul compte non marqué',()=>assert.strictEqual(f.compteParDefaut([{id:'x'}]),'x'));
cas('compteParDefaut : plusieurs comptes sans défaut -> null',()=>assert.strictEqual(f.compteParDefaut([{id:'x'},{id:'y'}]),null));
cas('compteParDefaut : aucun compte -> null',()=>assert.strictEqual(f.compteParDefaut([]),null));
cas('compteParDefaut : liste absente -> null',()=>assert.strictEqual(f.compteParDefaut(undefined),null));

// validerSaisieTx
const v=(m,o)=>f.validerSaisieTx({...base,...m},o);
cas('valide : sortie complète',()=>assert.strictEqual(v({}),null));
cas('valide : description vide',()=>assert.match(v({description:''}),/description/));
cas('valide : montant vide',()=>assert.match(v({montant:NaN}),/Indiquez un montant/));
cas('valide : montant -12 (critère #6)',()=>assert.match(v({montant:-12}),/positif/));
cas('valide : montant 0',()=>assert.match(v({montant:0}),/positif/));
cas('valide : montant 0,004 (arrondi à 0)',()=>assert.match(v({montant:0.004}),/0,01/));
cas('valide : montant 0,005 (arrondi à 0,01) accepté',()=>assert.strictEqual(v({montant:0.005}),null));
cas('valide : montant max accepté',()=>assert.strictEqual(v({montant:9999999999.99}),null));
cas('valide : montant 1e10 refusé (critère #6, 22003 en base)',()=>assert.match(v({montant:1e10}),/dépasser/));
cas('valide : montant 9999999999,996 (arrondi au-dessus du max)',()=>assert.match(v({montant:9999999999.996}),/dépasser/));
cas('valide : date vide',()=>assert.match(v({date:''}),/date/));
cas('valide : sortie sans compte refusée',()=>assert.match(v({compteId:null}),/compte/));
cas('valide : ancienne tx sans compte acceptée si autorisé',()=>assert.strictEqual(v({compteId:null},{compteObligatoire:false}),null));
cas('valide : entrée complète',()=>assert.strictEqual(v({type:'entrée'}),null));
cas('valide : sortie sans compte acceptée si « sans compte » autorisé',()=>assert.strictEqual(v({compteId:null},{compteObligatoire:false}),null));
cas('valide : message de montant sans « mouvement » (#69)',()=>assert.doesNotMatch(v({montant:-1}),/mouvement/));

// construireLigneTx
cas('ligne : sortie -> catégorie gardée, sans compte_dest_id (#69)',()=>{
  const l=f.construireLigneTx({...base,categorieId:'c1',tricount:'oui',epingle:1,note:''});
  assert.deepStrictEqual(l,{description:'Courses',montant:12.5,type:'sortie',date:'2026-10-03',compte_id:'k1',categorie_id:'c1',tricount:'oui',epingle:true,note:null});
});
cas('ligne : compte_dest_id jamais envoyée, même si la saisie en contient une (#69, #86)',()=>{
  for(const type of ['entrée','sortie']) assert.ok(!('compte_dest_id' in f.construireLigneTx({...base,type,compteDestId:'k3'})),type);
});
cas('ligne : entrée de virement interne -> catégorie et Tricount gardés',()=>{
  const l=f.construireLigneTx({...base,type:'entrée',compteId:'k2',categorieId:'cv',tricount:'non'});
  assert.strictEqual(l.compte_id,'k2');assert.strictEqual(l.categorie_id,'cv');assert.strictEqual(l.tricount,'non');
});
cas('ligne : Tricount absent -> non',()=>assert.strictEqual(f.construireLigneTx(base).tricount,'non'));
cas('ligne : montant arrondi au centime',()=>assert.strictEqual(f.construireLigneTx({...base,montant:12.345}).montant,12.35));
cas('ligne : pas de user_id (ajouté à l\'insert seulement)',()=>assert.ok(!('user_id' in f.construireLigneTx(base))));

// messageErreurSupabase
const m=e=>f.messageErreurSupabase(e);
cas('erreur 23514',()=>assert.match(m({code:'23514',message:'violates check'}),/positif.*\(erreur 23514\)/));
cas('erreur 23514 : plus de mention des mouvements (#69)',()=>assert.doesNotMatch(m({code:'23514',message:'x'}),/mouvement/));
cas('erreur 22003',()=>assert.match(m({code:'22003',message:'numeric field overflow'}),/trop grand.*22003/));
cas('erreur 23503',()=>assert.match(m({code:'23503',message:'fk'}),/compte.*23503/));
cas('erreur 42501',()=>assert.match(m({code:'42501',message:'rls'}),/session.*42501/));
cas('erreur réseau',()=>assert.match(m({message:'TypeError: Failed to fetch'}),/serveur/));
cas('erreur inconnue : message et code repris',()=>assert.strictEqual(m({code:'XX000',message:'boum'}),'Enregistrement impossible : boum (erreur XX000)'));
cas('erreur sans code',()=>assert.strictEqual(m({message:'boum'}),'Enregistrement impossible : boum'));
cas('pas d\'erreur -> chaîne vide',()=>assert.strictEqual(m(null),''));

// libelleCompteTx
cas('libellé : sortie',()=>assert.strictEqual(f.libelleCompteTx({type:'sortie',compte_id:'k1'},COMPTES),'CCP Banque fictive'));
cas('libellé : entrée sur le livret',()=>assert.strictEqual(f.libelleCompteTx({type:'entrée',compte_id:'k2'},COMPTES),'Livret A'));
cas('libellé : plus de « Depuis → Vers » (#69)',()=>assert.strictEqual(f.libelleCompteTx({type:'sortie',compte_id:'k2',compte_dest_id:'k1'},COMPTES),'Livret A'));
cas('libellé : sans compte -> vide',()=>assert.strictEqual(f.libelleCompteTx({type:'sortie',compte_id:null},COMPTES),''));
cas('libellé : compte inconnu -> ?',()=>assert.strictEqual(f.libelleCompteTx({type:'sortie',compte_id:'zz'},COMPTES),'?'));

console.log(ko?`\n${ko} échec(s) / ${n}`:`\nTous les cas passent (${n})`);process.exit(ko?1:0);
