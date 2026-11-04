// Tests unitaires des fonctions pures des soldes banque (#55).
// Usage : node tests/front/ticket55_soldes.test.js [index.html]
// Le bloc « FONCTIONS PURES SOLDES BANQUE (#55) » est extrait tel quel de index.html : on teste le vrai code.
// Il s'appuie sur lireMontant et MONTANT_MAX (bloc #6), formatDateFr et arrondiCentimes (bloc #8),
// extraits eux aussi. Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const extraire=(debutTxt,finTxt)=>{
  const d=html.indexOf(debutTxt),f=html.indexOf(finTxt,d);
  assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debutTxt);
  return html.slice(d,f);
};
const bloc06=extraire('// ── TRANSACTIONS : FONCTIONS PURES (#6)','// ── DATE DU JOUR : FONCTION PURE (#45)');
const bloc08=extraire('// ══ DÉBUT FONCTIONS PURES COMPTES (#8)','// ══ FIN FONCTIONS PURES COMPTES (#8)');
const bloc55=extraire('// ══ DÉBUT FONCTIONS PURES SOLDES BANQUE (#55)','// ══ FIN FONCTIONS PURES SOLDES BANQUE (#55)');
const f=new Function(bloc06+'\n'+bloc08+'\n'+bloc55+';return {lireMontant,validerSaisieSolde,trouverSolde,messageSuppressionSolde};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};
const NBSP=/[  ]/g; // espaces insécables de toLocaleString('fr-FR')

// ── validerSaisieSolde : montant lisible et date présente, sinon un message
const ok=(montant,date='2026-11-04')=>f.validerSaisieSolde({montant,date});
cas('relevé valide',()=>assert.strictEqual(ok(1250.4),null));
cas('relevé nul accepté',()=>assert.strictEqual(ok(0),null));
cas('relevé négatif accepté (découvert)',()=>assert.strictEqual(ok(-35.2),null));
cas('montant vide -> message',()=>assert.match(ok(f.lireMontant('')),/montant/));
cas('montant non numérique -> message',()=>assert.match(ok(f.lireMontant('abc')),/montant/));
cas('montant NaN direct -> message',()=>assert.match(ok(NaN),/montant/));
cas('montant Infinity -> message',()=>assert.match(ok(Infinity),/montant/));
cas('montant en texte (non converti) -> message',()=>assert.match(ok('12'),/montant/));
cas('virgule française lue par lireMontant',()=>assert.strictEqual(ok(f.lireMontant('1250,40')),null));
cas('plafond atteint accepté',()=>assert.strictEqual(ok(9999999999.99),null));
cas('plafond dépassé -> message',()=>assert.match(ok(10000000000),/dépasser/));
cas('plafond dépassé en négatif -> message',()=>assert.match(ok(-10000000000),/dépasser/));
cas('date vide -> message',()=>assert.match(ok(100,''),/date/));
cas('date absente -> message',()=>assert.match(f.validerSaisieSolde({montant:100}),/date/));
cas('date illisible -> message',()=>assert.match(ok(100,'04/11/2026'),/date/));
cas('montant contrôlé avant la date',()=>assert.match(f.validerSaisieSolde({montant:NaN,date:''}),/montant/));
cas('saisie absente -> message sans erreur',()=>assert.match(f.validerSaisieSolde(null),/montant/));

// ── trouverSolde : le relevé de la ligne cliquée, et seulement lui
const S1={id:'s1',date:'2026-11-01',montant:1200},S2={id:'s2',date:'2026-10-15',montant:1100},S3={id:12,date:'2026-09-30',montant:5};
const liste=[S2,S1,S3];
cas('trouve s1 (pas la première ligne)',()=>assert.strictEqual(f.trouverSolde(liste,'s1'),S1));
cas('trouve s2',()=>assert.strictEqual(f.trouverSolde(liste,'s2'),S2));
cas('id numérique comparé en texte',()=>assert.strictEqual(f.trouverSolde(liste,'12'),S3));
cas('id inconnu -> null',()=>assert.strictEqual(f.trouverSolde(liste,'zz'),null));
cas('id vide / null / undefined -> null',()=>{
  for(const id of ['',null,undefined]) assert.strictEqual(f.trouverSolde(liste,id),null);
});
cas('liste absente -> null',()=>assert.strictEqual(f.trouverSolde(null,'s1'),null));

// ── messageSuppressionSolde : nomme la date (JJ/MM/AAAA) et le montant du relevé
const msg=r=>f.messageSuppressionSolde(r).replace(NBSP,' ');
cas('message de l\'exemple',()=>assert.strictEqual(msg(S1),'Supprimer le relevé du 01/11/2026 (1 200,00 €) ?'));
cas('montant à 2 décimales',()=>assert.strictEqual(msg({date:'2026-10-15',montant:4.2}),'Supprimer le relevé du 15/10/2026 (4,20 €) ?'));
cas('montant négatif',()=>assert.strictEqual(msg({date:'2026-10-15',montant:-35.5}),'Supprimer le relevé du 15/10/2026 (-35,50 €) ?'));
cas('montant nul (pas « -0 »)',()=>assert.strictEqual(msg({date:'2026-10-15',montant:-0}),'Supprimer le relevé du 15/10/2026 (0,00 €) ?'));
cas('montant en texte (numeric renvoyé en chaîne)',()=>assert.strictEqual(msg({date:'2026-10-15',montant:'1100.5'}),'Supprimer le relevé du 15/10/2026 (1 100,50 €) ?'));
cas('relevé de S2 ne parle pas de S1',()=>{const m=msg(S2);assert.ok(m.includes('15/10/2026')&&!m.includes('01/11/2026'));});
cas('relevé absent -> message générique sans erreur',()=>assert.strictEqual(msg(null),'Supprimer le relevé du ? (? €) ?'));

console.log(`\n${n-ko}/${n} cas OK`);
process.exit(ko?1:0);
