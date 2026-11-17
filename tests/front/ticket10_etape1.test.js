// Tests unitaires du ticket #10 : validation de l'étape 1 (multi-comptes).
// Chaque fonction est déjà testée ticket par ticket (#8, #69, #70, #72, #82, #100). Ici, on rejoue
// le SCÉNARIO du ticket en enchaînant ces fonctions, comme le fait l'écran :
//   1. un compte courant (et un livret), une dépense, un relevé égal -> voyant vert « ✓ rapproché » ;
//   2. un virement interne en deux opérations -> les deux soldes bougent, le patrimoine ne bouge pas,
//      les opérations sont exclues des stats et l'indicateur « Mouvements de compte » vaut 0 ;
//   3. le filtre par compte et le sous-total suivent les lignes affichées.
// Mêmes montants que tests/sql/cas/ticket10_etape1.sql, qui vérifie la vraie vue v_soldes_comptes.
//
// Usage : node tests/front/ticket10_etape1.test.js [index.html]
// Les blocs de fonctions pures sont extraits tels quels de index.html. Aucun réseau, aucune base,
// aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const extraire=(debutTxt,finTxt)=>{
  const d=html.indexOf(debutTxt),f=html.indexOf(finTxt,d);
  assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debutTxt);
  return html.slice(d,f);
};
const bloc=nom=>extraire('// ══ DÉBUT FONCTIONS PURES '+nom,'// ══ FIN FONCTIONS PURES '+nom);
const sources=[
  extraire('// ── TRANSACTIONS : FONCTIONS PURES (#6)','// ── DATE DU JOUR : FONCTION PURE (#45)'),
  bloc('COMPTES (#8)'),
  bloc('MOUVEMENT DE COMPTE (#69)'),
  bloc('INDICATEUR MOUVEMENTS DE COMPTE (#70)'),
  bloc('ÉPARGNE (#100)'),
  bloc('FILTRES ET SOUS-TOTAL (#72)'),
].join('\n');
const f=new Function(sources+`;return {voyantCompte,ecartCompte,totalPatrimoine,opsDepuisReleve,txPourStats,
  totalMouvementsCompte,badgeMouvementsCompte,epargneParMois,filtrerTransactions,sousTotalTransactions,texteSousTotal};`)();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

// ── Données du scénario ──────────────────────────────────────────────────
const AUJOURDHUI='2026-11-04';
const CATS=[
  {id:'c1',nom:'Courses',mouvement_compte:false},
  {id:'cv',nom:'Virement interne',mouvement_compte:true},   // catégorie cochée « Mouvement de compte » (#68)
];
const COMPTES=[
  {id:'k1',nom:'Courant',type:'courant',solde_initial:1000,date_solde_initial:'2026-10-31'},
  {id:'k2',nom:'Livret',type:'livret',solde_initial:200,date_solde_initial:'2026-10-31'},
];
const DEPENSE={id:'d',description:'Dépense',type:'sortie',montant:42.5,date:'2026-11-02',compte_id:'k1',categorie_id:'c1'};
const VIR_SORTIE={id:'vs',description:'Virement',type:'sortie',montant:100,date:AUJOURDHUI,compte_id:'k1',categorie_id:'cv'};
const VIR_ENTREE={id:'ve',description:'Virement',type:'entrée',montant:100,date:AUJOURDHUI,compte_id:'k2',categorie_id:'cv'};

// Lignes de v_soldes_comptes, calculées comme la vraie vue (voir supabase/migrations/202611161145_…) :
// solde initial + entrées − sorties à partir de date_solde_initial ; écart au jour du dernier relevé.
// Le calcul réel, en base, est vérifié par tests/sql/cas/ticket10_etape1.sql avec les mêmes montants.
function vue(txs,releves){
  return COMPTES.map(c=>{
    const flux=txs.filter(t=>t.compte_id===c.id&&t.date>=c.date_solde_initial)
      .map(t=>({date:t.date,c:Math.round(t.montant*100)*(t.type==='entrée'?1:-1)}));
    const somme=l=>(c.solde_initial*100+l.reduce((s,x)=>s+x.c,0))/100;
    const r=releves.filter(x=>x.compte_id===c.id).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
    const aDate=r?somme(flux.filter(x=>x.date<=r.date)):null;
    return {compte_id:c.id,solde_initial:c.solde_initial,date_solde_initial:c.date_solde_initial,
      solde_calcule:somme(flux),dernier_solde_banque:r?r.montant:null,date_dernier_solde_banque:r?r.date:null,
      solde_calcule_a_date_banque:aDate,ecart:r?Math.round((r.montant-aDate)*100)/100:null,
      nb_jours_depuis_releve:r?Math.round((Date.parse(AUJOURDHUI)-Date.parse(r.date))/86400000):null};
  });
}
const ligneDe=(lignes,id)=>lignes.find(l=>l.compte_id===id);

// ── 1. Compte courant, dépense, relevé égal ───────────────────────────────
cas('compte neuf, sans relevé : voyant « Aucun relevé », solde = solde initial',()=>{
  const l=ligneDe(vue([],[]),'k1');
  assert.strictEqual(l.solde_calcule,1000);
  assert.strictEqual(f.voyantCompte(l).texte,'Aucun relevé');
});
cas('après la dépense de 42,50 : solde calculé 957,50, toujours « Aucun relevé »',()=>{
  const l=ligneDe(vue([DEPENSE],[]),'k1');
  assert.strictEqual(l.solde_calcule,957.5);
  assert.strictEqual(f.voyantCompte(l).etat,'sans_releve');
});
const RELEVE_EGAL={compte_id:'k1',date:'2026-11-03',montant:957.5};
cas('critère : relevé égal au solde calculé -> écart 0 et carte au vert « ✓ rapproché »',()=>{
  const l=ligneDe(vue([DEPENSE],[RELEVE_EGAL]),'k1');
  assert.strictEqual(f.ecartCompte(l),0);
  assert.deepStrictEqual([f.voyantCompte(l).etat,f.voyantCompte(l).texte,f.voyantCompte(l).classe],['rapproche','✓ rapproché','badge-ok']);
});
cas('relevé différent d\'un centime -> « ⚠ écart »',()=>{
  const l=ligneDe(vue([DEPENSE],[{...RELEVE_EGAL,montant:957.49}]),'k1');
  assert.strictEqual(f.ecartCompte(l),-0.01);
  assert.strictEqual(f.voyantCompte(l).etat,'ecart');
});
cas('patrimoine avant le virement = 957,50 + 200 = 1 157,50',()=>
  assert.strictEqual(f.totalPatrimoine(vue([DEPENSE],[RELEVE_EGAL])),1157.5));

// ── 2. Virement interne en deux opérations ────────────────────────────────
const TOUT=[DEPENSE,VIR_SORTIE,VIR_ENTREE];
cas('critère : virement de 100 -> les deux soldes bougent (courant 857,50, livret 300)',()=>{
  const v=vue(TOUT,[RELEVE_EGAL]);
  assert.strictEqual(ligneDe(v,'k1').solde_calcule,857.5);
  assert.strictEqual(ligneDe(v,'k2').solde_calcule,300);
});
cas('le patrimoine ne bouge pas avec le virement (1 157,50)',()=>
  assert.strictEqual(f.totalPatrimoine(vue(TOUT,[RELEVE_EGAL])),1157.5));
cas('virement après le relevé : carte courant « Depuis le relevé (1 opération) » −100, voyant toujours vert',()=>{
  const l=ligneDe(vue(TOUT,[RELEVE_EGAL]),'k1');
  assert.deepStrictEqual(f.opsDepuisReleve(l,TOUT),{nb:1,montant:-100,texte:'Depuis le relevé (1 opération)'});
  assert.strictEqual(f.voyantCompte(l).etat,'rapproche');
});
cas('critère : indicateur « Mouvements de compte » à 0 -> badge vert',()=>{
  const total=f.totalMouvementsCompte(TOUT,CATS,'2026-11');
  assert.strictEqual(total,0);
  assert.strictEqual(f.badgeMouvementsCompte(total).texte,'✓ Mouvements de compte : 0,00 €');
});
cas('virement saisi à moitié (sortie seule) -> badge rouge « −100,00 € »',()=>
  assert.strictEqual(f.badgeMouvementsCompte(f.totalMouvementsCompte([DEPENSE,VIR_SORTIE],CATS,'2026-11')).texte,
    '✗ Mouvements de compte : −100,00 €'));
cas('exclusion des stats : seule la dépense reste (métriques, KPIs, graphiques, top 5)',()=>
  assert.deepStrictEqual(f.txPourStats(TOUT,CATS).map(t=>t.id),['d']));
cas('épargne du mois (#100) : −42,50, le virement n\'y entre pas',()=>
  assert.deepStrictEqual(f.epargneParMois(TOUT,CATS,['2026-10','2026-11']),[null,-42.5]));
cas('sans catégorie cochée, rien n\'est exclu et l\'indicateur est masqué',()=>{
  const sans=CATS.map(c=>({...c,mouvement_compte:false}));
  assert.strictEqual(f.txPourStats(TOUT,sans).length,3);
  assert.strictEqual(f.badgeMouvementsCompte(f.totalMouvementsCompte(TOUT,sans,'2026-11')),null);
});

// ── 3. Filtre par compte et sous-total ────────────────────────────────────
cas('filtre « Courant » : la dépense et la sortie du virement',()=>
  assert.deepStrictEqual(f.filtrerTransactions(TOUT,{mois:'2026-11',compte:'k1'}).map(t=>t.id),['d','vs']));
cas('sous-total du courant : 2 opérations, le virement exclu des montants',()=>{
  const st=f.sousTotalTransactions(f.filtrerTransactions(TOUT,{mois:'2026-11',compte:'k1'}),CATS,'all');
  assert.deepStrictEqual(st,{nb:2,entrees:0,sorties:42.5});
  assert.deepStrictEqual(f.texteSousTotal(st),{nb:'2 opérations',entrees:'+0,00 €',sorties:'−42,50 €'});
});
cas('filtre sur la catégorie « Mouvement de compte » : le virement entre dans le sous-total',()=>{
  const affichees=f.filtrerTransactions(TOUT,{mois:'2026-11',categorie:'cv'});
  assert.deepStrictEqual(f.sousTotalTransactions(affichees,CATS,'cv'),{nb:2,entrees:100,sorties:100});
});
cas('tous les comptes, sans filtre : 3 opérations, montants hors virement',()=>
  assert.deepStrictEqual(f.sousTotalTransactions(f.filtrerTransactions(TOUT,{mois:'2026-11'}),CATS,'all'),{nb:3,entrees:0,sorties:42.5}));
cas('l\'indicateur ignore les filtres : même valeur quel que soit le compte filtré',()=>{
  // On lui passe toutes les transactions, comme renderIndicateurMouvements ; filtrer sur un compte
  // donnerait −100 : c'est bien le comportement à NE PAS avoir.
  assert.strictEqual(f.totalMouvementsCompte(TOUT,CATS,'2026-11'),0);
  assert.strictEqual(f.totalMouvementsCompte(f.filtrerTransactions(TOUT,{compte:'k1'}),CATS,'2026-11'),-100);
});

console.log(`\n${n-ko}/${n} cas réussis`);
if(ko) process.exit(1);
