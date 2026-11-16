// Tests unitaires de opsDepuisReleve (#82) : ligne « Depuis le relevé (N opération(s)) » des cartes comptes.
// Usage : node tests/front/ticket82_depuis_releve.test.js [index.html]
// La fonction est dans le bloc « FONCTIONS PURES COMPTES (#8) », extrait tel quel de index.html
// avec le bloc #6 dont il dépend. Aucun réseau, aucune base, aucune dépendance (Node seul).
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
const {opsDepuisReleve,voyantCompte}=new Function(bloc06+'\n'+bloc08+';return {opsDepuisReleve,voyantCompte};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

// Exemple du ticket : CCP CIC, relevé de 21,00 € le 05/11, sortie « Test » de 1,50 € le 06/11.
const ligne=(m={})=>({compte_id:'k1',solde_initial:30,date_solde_initial:'2026-10-31',
  solde_calcule:19.5,dernier_solde_banque:21,date_dernier_solde_banque:'2026-11-05',
  solde_calcule_a_date_banque:21,ecart:0,nb_jours_depuis_releve:0,...m});
const tx=(date,m={})=>({id:'t'+date+(m.id||''),compte_id:'k1',compte_dest_id:null,type:'sortie',montant:1.5,date,...m});
const avant=[tx('2026-11-01',{type:'entrée',montant:10}),tx('2026-11-03',{montant:19})];

// ── Critère d'acceptation principal
cas('exemple du ticket : 1 opération, −1,50',()=>{
  assert.deepStrictEqual(opsDepuisReleve(ligne(),[...avant,tx('2026-11-06')]),
    {nb:1,montant:-1.5,texte:'Depuis le relevé (1 opération)'});
});
cas('exemple du ticket : voyant toujours « ✓ rapproché »',()=>
  assert.strictEqual(voyantCompte(ligne()).texte,'✓ rapproché'));

// ── Aucune opération après le relevé : carte inchangée
cas('aucune opération après le relevé -> null',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),avant),null));
cas('aucune transaction chargée -> null',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[]),null));
cas('liste de transactions absente -> null',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),undefined),null));

// ── Opération du jour même du relevé : incluse dans le relevé, pas comptée
cas('opération le jour du relevé non comptée',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[tx('2026-11-05')]),null));
cas('jour du relevé + lendemain : seul le lendemain compte',()=>{
  const r=opsDepuisReleve(ligne(),[tx('2026-11-05',{id:'a'}),tx('2026-11-06')]);
  assert.strictEqual(r.nb,1);assert.strictEqual(r.texte,'Depuis le relevé (1 opération)');
});

// ── Plusieurs opérations, singulier / pluriel, total nul
cas('3 opérations : pluriel et montant net',()=>{
  const r=opsDepuisReleve(ligne({solde_calcule:'48.75'}),
    [tx('2026-11-06'),tx('2026-11-07',{type:'entrée',montant:30}),tx('2026-11-08',{montant:0.75})]);
  assert.strictEqual(r.nb,3);assert.strictEqual(r.montant,27.75);
  assert.strictEqual(r.texte,'Depuis le relevé (3 opérations)');
});
cas('plusieurs opérations de total nul : ligne affichée à 0',()=>{
  const r=opsDepuisReleve(ligne({solde_calcule:21}),[tx('2026-11-06',{montant:5}),tx('2026-11-07',{type:'entrée',montant:5})]);
  assert.ok(r);assert.strictEqual(r.nb,2);assert.ok(Object.is(r.montant,0),'0 et pas -0');
});
cas('montant arrondi au centime (flottants)',()=>{
  const r=opsDepuisReleve(ligne({solde_calcule:0.1+0.2,solde_calcule_a_date_banque:0.1}),[tx('2026-11-06')]);
  assert.strictEqual(r.montant,0.2);
});
cas('montants en chaînes (numeric renvoyé par l\'API)',()=>{
  const r=opsDepuisReleve(ligne({solde_calcule:'19.50',solde_calcule_a_date_banque:'21.00'}),[tx('2026-11-06')]);
  assert.strictEqual(r.montant,-1.5);
});

// ── Écart non calculable : rien n'est ajouté
cas('aucun relevé -> null',()=>
  assert.strictEqual(opsDepuisReleve(ligne({dernier_solde_banque:null,date_dernier_solde_banque:null,
    solde_calcule_a_date_banque:null,ecart:null,nb_jours_depuis_releve:null}),[tx('2026-11-06')]),null));
cas('relevé antérieur au solde initial -> null',()=>
  assert.strictEqual(opsDepuisReleve(ligne({date_dernier_solde_banque:'2026-10-20',solde_calcule_a_date_banque:null,ecart:null}),
    [tx('2026-11-06')]),null));
cas('pas de ligne de vue -> null',()=>assert.strictEqual(opsDepuisReleve(null,[tx('2026-11-06')]),null));

// ── Périmètre du comptage
cas('transactions d\'un autre compte ignorées',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[tx('2026-11-06',{compte_id:'k2'})]),null));
cas('transaction sans compte ignorée',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[tx('2026-11-06',{compte_id:null})]),null));
cas('mouvement sortant compté (tant que #69 n\'est pas livré)',()=>
  assert.strictEqual(opsDepuisReleve(ligne(),[tx('2026-11-06',{type:'mouvement',compte_dest_id:'k2'})]).nb,1));
cas('mouvement entrant compté',()=>{
  const r=opsDepuisReleve(ligne({solde_calcule:121}),[tx('2026-11-06',{type:'mouvement',compte_id:'k2',compte_dest_id:'k1',montant:100})]);
  assert.strictEqual(r.nb,1);assert.strictEqual(r.montant,100);
});
cas('compte_dest_id d\'une entrée ou sortie ignoré',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[tx('2026-11-06',{compte_id:'k2',compte_dest_id:'k1'})]),null));
cas('opération antérieure au solde initial ignorée (relevé futur au solde initial)',()=>{
  // Relevé le 05/11, solde initial le 10/11 : impossible en vrai (vue -> null), on vérifie la borne seule.
  const r=opsDepuisReleve(ligne({date_solde_initial:'2026-11-07'}),[tx('2026-11-06'),tx('2026-11-08',{id:'b'})]);
  assert.strictEqual(r.nb,1);
});
cas('sans date de solde initial : toutes les opérations après le relevé',()=>
  assert.strictEqual(opsDepuisReleve(ligne({date_solde_initial:null}),[tx('2026-11-06'),tx('2026-11-09',{id:'b'})]).nb,2));
cas('relevé ancien (⏱) : ligne toujours calculée',()=>{
  const l=ligne({nb_jours_depuis_releve:40});
  assert.strictEqual(voyantCompte(l).etat,'ancien');
  assert.strictEqual(opsDepuisReleve(l,[tx('2026-11-06')]).nb,1);
});
cas('transaction sans date ignorée',()=>
  assert.strictEqual(opsDepuisReleve(ligne({solde_calcule:21}),[tx(null)]),null));

console.log(`\n${n-ko}/${n} cas réussis`);
if(ko) process.exit(1);
