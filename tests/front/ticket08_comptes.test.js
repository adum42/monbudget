// Tests unitaires des fonctions pures des cartes comptes (#8).
// Usage : node tests/front/ticket08_comptes.test.js [index.html]
// Le bloc « FONCTIONS PURES COMPTES (#8) » est extrait tel quel de index.html : on teste le vrai code.
// Il s'appuie sur lireMontant, MONTANT_MAX et messageErreurSupabase du bloc « FONCTIONS PURES (#6) »,
// extrait lui aussi. Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const extraire=(debutTxt,finTxt)=>{
  const d=html.indexOf(debutTxt),f=html.indexOf(finTxt,d);
  assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debutTxt);
  return html.slice(d,f);
};
// Le bloc #6 s'arrête au début du bloc #45 (et non à « MODAL TX ») : une erreur dans #45
// ne doit pas faire échouer les tests de #6 et #8 (#9).
const bloc06=extraire('// ── TRANSACTIONS : FONCTIONS PURES (#6)','// ── DATE DU JOUR : FONCTION PURE (#45)');
const bloc08=extraire('// ══ DÉBUT FONCTIONS PURES COMPTES (#8)','// ══ FIN FONCTIONS PURES COMPTES (#8)');
const f=new Function(bloc06+'\n'+bloc08+
  ';return {TYPES_COMPTE,libelleTypeCompte,arrondiCentimes,ecartCompte,voyantCompte,totalPatrimoine,couleurCompte,formatDateFr,'+
  'validerSaisieCompte,construireLigneCompte,compteDefautARetirer,messageErreurCompte};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

// Ligne de v_soldes_comptes (forme renvoyée par l'API : numeric en nombre JSON, date en texte)
const ligne=(m={})=>({compte_id:'k1',nom:'Compte courant',type:'courant',solde_initial:1000,date_solde_initial:'2026-09-30',
  solde_calcule:1512.4,dernier_solde_banque:1512.4,date_dernier_solde_banque:'2026-10-25',
  solde_calcule_a_date_banque:1512.4,ecart:0,nb_jours_depuis_releve:3,...m});
const etat=m=>f.voyantCompte(ligne(m)).etat;

// ── libelleTypeCompte : les 4 types de la contrainte #3
cas('type courant',()=>assert.strictEqual(f.libelleTypeCompte('courant'),'Compte courant'));
cas('type livret',()=>assert.strictEqual(f.libelleTypeCompte('livret'),'Livret d\'épargne'));
cas('type investissement',()=>assert.strictEqual(f.libelleTypeCompte('investissement'),'Investissement'));
cas('type especes',()=>assert.strictEqual(f.libelleTypeCompte('especes'),'Espèces'));
cas('type inconnu renvoyé tel quel',()=>assert.strictEqual(f.libelleTypeCompte('pel'),'pel'));
cas('type absent -> —',()=>assert.strictEqual(f.libelleTypeCompte(null),'—'));
cas('TYPES_COMPTE = exactement les 4 valeurs de comptes_type_check',()=>
  assert.deepStrictEqual(f.TYPES_COMPTE.map(t=>t.valeur),['courant','livret','investissement','especes']));

// ── arrondiCentimes
cas('arrondi : 0.1+0.2 -> 0.3',()=>assert.strictEqual(f.arrondiCentimes(0.1+0.2),0.3));
cas('arrondi : chaîne numérique "12.345" -> 12.35',()=>assert.strictEqual(f.arrondiCentimes('12.345'),12.35));
cas('arrondi : -0.004 -> 0 (et pas -0)',()=>assert.ok(Object.is(f.arrondiCentimes(-0.004),0)));
cas('arrondi : null / vide / illisible -> null',()=>{
  assert.strictEqual(f.arrondiCentimes(null),null);assert.strictEqual(f.arrondiCentimes(''),null);assert.strictEqual(f.arrondiCentimes('abc'),null);});

// ── ecartCompte
cas('écart nul',()=>assert.strictEqual(f.ecartCompte(ligne()),0));
cas('écart négatif −15,00 (maquette)',()=>assert.strictEqual(f.ecartCompte(ligne({ecart:-15})),-15));
cas('écart positif en chaîne "3.5"',()=>assert.strictEqual(f.ecartCompte(ligne({ecart:'3.5'})),3.5));
cas('écart flottant résiduel 1e-10 -> 0',()=>assert.strictEqual(f.ecartCompte(ligne({ecart:1e-10})),0));
cas('écart null (aucun relevé) -> null',()=>assert.strictEqual(f.ecartCompte(ligne({ecart:null})),null));
cas('pas de ligne de vue -> null',()=>assert.strictEqual(f.ecartCompte(null),null));

// ── voyantCompte : seuils 14 / 15 / 30 / 31 jours
cas('voyant : écart 0, relevé de 3 j -> rapproché',()=>{
  const v=f.voyantCompte(ligne());assert.strictEqual(v.etat,'rapproche');assert.strictEqual(v.texte,'✓ rapproché');assert.strictEqual(v.classe,'badge-ok');});
cas('voyant : écart 0, relevé du jour (0 j) -> rapproché',()=>assert.strictEqual(etat({nb_jours_depuis_releve:0}),'rapproche'));
cas('voyant : écart 0, 14 j -> rapproché',()=>assert.strictEqual(etat({nb_jours_depuis_releve:14}),'rapproche'));
cas('voyant : écart 0, 15 j -> à revérifier (pas rapproché)',()=>{
  const v=f.voyantCompte(ligne({nb_jours_depuis_releve:15}));assert.strictEqual(v.etat,'a_verifier');assert.strictEqual(v.texte,'✓ il y a 15 j');});
cas('voyant : écart 0, 30 j -> à revérifier',()=>assert.strictEqual(etat({nb_jours_depuis_releve:30}),'a_verifier'));
cas('voyant : écart 0, 31 j -> ⏱ 31 jours',()=>{
  const v=f.voyantCompte(ligne({nb_jours_depuis_releve:31}));assert.strictEqual(v.etat,'ancien');assert.strictEqual(v.texte,'⏱ 31 jours');assert.strictEqual(v.classe,'badge-ko');});
cas('voyant : 47 j (maquette Espèces) -> ⏱ 47 jours',()=>assert.strictEqual(f.voyantCompte(ligne({nb_jours_depuis_releve:47})).texte,'⏱ 47 jours'));
cas('voyant : écart −15, 14 j -> ⚠ écart',()=>{
  const v=f.voyantCompte(ligne({ecart:-15,nb_jours_depuis_releve:14}));assert.strictEqual(v.etat,'ecart');assert.strictEqual(v.texte,'⚠ écart');});
cas('voyant : écart −15, 15 j -> ⚠ écart',()=>assert.strictEqual(etat({ecart:-15,nb_jours_depuis_releve:15}),'ecart'));
cas('voyant : écart −15, 30 j -> ⚠ écart',()=>assert.strictEqual(etat({ecart:-15,nb_jours_depuis_releve:30}),'ecart'));
cas('voyant : écart −15, 31 j -> ⏱ (l\'ancienneté prime)',()=>assert.strictEqual(etat({ecart:-15,nb_jours_depuis_releve:31}),'ancien'));
cas('voyant : écart 0,01 -> ⚠ écart (au centime)',()=>assert.strictEqual(etat({ecart:0.01}),'ecart'));
cas('voyant : écart 0,004 (arrondi à 0) -> rapproché',()=>assert.strictEqual(etat({ecart:0.004}),'rapproche'));
cas('voyant : écart "0.00" (chaîne) -> rapproché',()=>assert.strictEqual(etat({ecart:'0.00'}),'rapproche'));
cas('voyant : aucun relevé -> « Aucun relevé »',()=>{
  const v=f.voyantCompte(ligne({dernier_solde_banque:null,date_dernier_solde_banque:null,solde_calcule_a_date_banque:null,ecart:null,nb_jours_depuis_releve:null}));
  assert.strictEqual(v.etat,'sans_releve');assert.strictEqual(v.texte,'Aucun relevé');assert.strictEqual(v.classe,'badge-info');});
cas('voyant : compte absent de la vue -> « Aucun relevé »',()=>assert.strictEqual(f.voyantCompte(null).etat,'sans_releve'));
cas('voyant : relevé antérieur au solde initial (écart null, 10 j) -> « Relevé à saisir »',()=>{
  const v=f.voyantCompte(ligne({ecart:null,solde_calcule_a_date_banque:null,nb_jours_depuis_releve:10}));
  assert.strictEqual(v.etat,'sans_releve');assert.strictEqual(v.texte,'Relevé à saisir');});
cas('voyant : relevé antérieur au solde initial et vieux de 40 j -> ⏱ 40 jours',()=>assert.strictEqual(etat({ecart:null,nb_jours_depuis_releve:40}),'ancien'));
cas('voyant : relevé daté dans le futur (−1 j) traité comme 0 j',()=>assert.strictEqual(etat({nb_jours_depuis_releve:-1}),'rapproche'));
cas('voyant : chaque état a un titre (infobulle)',()=>{
  for(const m of [{},{ecart:-1},{nb_jours_depuis_releve:20},{nb_jours_depuis_releve:40},{ecart:null},{date_dernier_solde_banque:null}])
    assert.ok(f.voyantCompte(ligne(m)).titre.length>10);});

// ── totalPatrimoine
cas('total : aucun compte -> 0',()=>assert.strictEqual(f.totalPatrimoine([]),0));
cas('total : liste absente -> 0',()=>assert.strictEqual(f.totalPatrimoine(undefined),0));
cas('total : somme des soldes calculés (maquette)',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:1512.4},{solde_calcule:333.77},{solde_calcule:40}]),1886.17));
cas('total : 0,1 + 0,2 = 0,3 exactement',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:0.1},{solde_calcule:0.2}]),0.3));
cas('total : dix fois 0,1 = 1 exactement',()=>assert.strictEqual(f.totalPatrimoine(Array(10).fill({solde_calcule:0.1})),1));
cas('total : 1,15 + 0,29 = 1,44 exactement (pas d\'addition en flottants)',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:1.15},{solde_calcule:0.29}]),1.44));
cas('total : compte à découvert soustrait',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:100},{solde_calcule:-35.5}]),64.5));
cas('total : soldes en chaînes (numeric) additionnés',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:'10.10'},{solde_calcule:'20.20'}]),30.3));
cas('total : solde null ignoré',()=>assert.strictEqual(f.totalPatrimoine([{solde_calcule:null},{solde_calcule:5}]),5));
cas('total : +x et −x -> 0 (pas −0)',()=>assert.ok(Object.is(f.totalPatrimoine([{solde_calcule:-0.3},{solde_calcule:0.1},{solde_calcule:0.2}]),0)));
cas('total : n\'utilise pas dernier_solde_banque',()=>assert.strictEqual(f.totalPatrimoine([ligne({solde_calcule:10,dernier_solde_banque:999})]),10));

// ── couleurCompte, formatDateFr
cas('couleur valide gardée',()=>assert.strictEqual(f.couleurCompte({couleur:'#14B8A6'}),'#14B8A6'));
cas('couleur injectée refusée -> défaut',()=>assert.strictEqual(f.couleurCompte({couleur:'red;background:url(x)'}),'#5B6EF5'));
cas('couleur absente / compte absent -> défaut',()=>{assert.strictEqual(f.couleurCompte({couleur:null}),'#5B6EF5');assert.strictEqual(f.couleurCompte(null),'#5B6EF5');});
cas('date 2026-10-25 -> 25/10/2026',()=>assert.strictEqual(f.formatDateFr('2026-10-25'),'25/10/2026'));
cas('date vide -> ""',()=>{assert.strictEqual(f.formatDateFr(null),'');assert.strictEqual(f.formatDateFr(''),'');});

// ── validerSaisieCompte
const s0={nom:'Compte courant',banque:'Banque fictive',type:'courant',couleur:'#5B6EF5',soldeInitial:'',dateSoldeInitial:'2026-09-30',parDefaut:false,plafond:''};
const vc=m=>f.validerSaisieCompte({...s0,...m});
cas('saisie compte valide',()=>assert.strictEqual(vc({}),null));
cas('saisie : nom vide',()=>assert.match(vc({nom:'  '}),/nom/));
cas('saisie : type vide (23514 évité)',()=>assert.match(vc({type:''}),/type/));
cas('saisie : type inconnu',()=>assert.match(vc({type:'pel'}),/type/));
cas('saisie : les 4 types acceptés',()=>{for(const t of ['courant','livret','investissement','especes'])assert.strictEqual(vc({type:t}),null);});
cas('saisie : solde initial négatif accepté (découvert)',()=>assert.strictEqual(vc({soldeInitial:'-35,50'}),null));
cas('saisie : solde initial illisible',()=>assert.match(vc({soldeInitial:'12abc'}),/illisible/));
cas('saisie : solde initial trop grand',()=>assert.match(vc({soldeInitial:'1e10'}),/dépasser/));
cas('saisie : plafond 0 refusé',()=>assert.match(vc({plafond:'0'}),/supérieur à 0/));
cas('saisie : plafond négatif refusé',()=>assert.match(vc({plafond:'-5'}),/supérieur à 0/));
cas('saisie : plafond 0,004 (arrondi à 0) refusé',()=>assert.match(vc({plafond:'0,004'}),/supérieur à 0/));
cas('saisie : plafond illisible',()=>assert.match(vc({plafond:'beaucoup'}),/illisible/));
cas('saisie : plafond sur un compte courant accepté',()=>assert.strictEqual(vc({plafond:'1000'}),null));

// ── construireLigneCompte
cas('ligne compte complète',()=>assert.deepStrictEqual(f.construireLigneCompte({...s0,nom:' Livret A ',type:'livret',soldeInitial:'1250,456',plafond:'22950'}),
  {nom:'Livret A',banque:'Banque fictive',type:'livret',couleur:'#5B6EF5',solde_initial:1250.46,date_solde_initial:'2026-09-30',plafond:22950}));
cas('ligne compte : solde initial vide -> 0, plafond vide -> null, date vide -> null',()=>{
  const l=f.construireLigneCompte({...s0,dateSoldeInitial:''});
  assert.strictEqual(l.solde_initial,0);assert.strictEqual(l.plafond,null);assert.strictEqual(l.date_solde_initial,null);});
cas('ligne compte : solde négatif conservé',()=>assert.strictEqual(f.construireLigneCompte({...s0,soldeInitial:'-35,5'}).solde_initial,-35.5));
cas('ligne compte : ni user_id ni par_defaut',()=>{const l=f.construireLigneCompte(s0);assert.ok(!('user_id' in l)&&!('par_defaut' in l));});
cas('ligne compte : nom avec apostrophe et balises gardé tel quel',()=>assert.strictEqual(f.construireLigneCompte({...s0,nom:'TEST QA L\'épargne <b>&</b>'}).nom,'TEST QA L\'épargne <b>&</b>'));

// ── compteDefautARetirer (deux requêtes, #8)
const LC=[{id:'k1',par_defaut:true},{id:'k2',par_defaut:false},{id:'k3'}];
cas('défaut : k2 devient défaut -> retirer k1 d\'abord',()=>assert.strictEqual(f.compteDefautARetirer(LC,'k2',true),'k1'));
cas('défaut : nouveau compte par défaut -> retirer k1',()=>assert.strictEqual(f.compteDefautARetirer(LC,null,true),'k1'));
cas('défaut : k1 reste défaut -> rien à retirer',()=>assert.strictEqual(f.compteDefautARetirer(LC,'k1',true),null));
cas('défaut : case non cochée -> rien à retirer',()=>assert.strictEqual(f.compteDefautARetirer(LC,'k2',false),null));
cas('défaut : aucun compte par défaut existant -> rien à retirer',()=>assert.strictEqual(f.compteDefautARetirer([{id:'k2'}],'k2',true),null));
cas('défaut : aucun compte -> rien à retirer',()=>assert.strictEqual(f.compteDefautARetirer([],null,true),null));

// ── messageErreurCompte
const me=(e,a)=>f.messageErreurCompte(e,a);
cas('erreur 23503 à la suppression : compte avec opérations',()=>assert.match(me({code:'23503',message:'fk'},'supprimer'),/porte des opérations.*\(erreur 23503\)/));
cas('erreur 23505 : compte par défaut',()=>assert.match(me({code:'23505',message:'dup'},'enregistrer'),/par défaut.*23505/));
cas('erreur 23514 : type ou plafond',()=>assert.match(me({code:'23514',message:'check'},'enregistrer'),/type de compte.*23514/));
cas('erreur 42501 : reprise du message #6 (session)',()=>assert.match(me({code:'42501',message:'rls'},'supprimer'),/session.*42501/));
cas('erreur réseau : reprise du message #6',()=>assert.match(me({message:'TypeError: Failed to fetch'},'enregistrer'),/serveur/));
cas('erreur inconnue à l\'enregistrement',()=>assert.strictEqual(me({code:'XX000',message:'boum'},'enregistrer'),'Enregistrement impossible : boum (erreur XX000)'));
cas('erreur inconnue à la suppression',()=>assert.strictEqual(me({code:'XX000',message:'boum'},'supprimer'),'Suppression impossible : boum (erreur XX000)'));
cas('pas d\'erreur -> chaîne vide',()=>assert.strictEqual(me(null,'enregistrer'),''));

console.log(ko?`\n${ko} échec(s) / ${n}`:`\nTous les cas passent (${n})`);process.exit(ko?1:0);
