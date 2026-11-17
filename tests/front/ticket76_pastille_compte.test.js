// Tests unitaires de pastilleCompteTx (#76) : pastille à la couleur du compte dans la liste des transactions.
// Usage : node tests/front/ticket76_pastille_compte.test.js [index.html]
// La fonction est dans le bloc « FONCTIONS PURES PASTILLE COMPTE (#76) », extrait tel quel de index.html
// avec les blocs #6 (libelleCompteTx) et #8 (couleurCompte). Aucun réseau, aucune base, Node seul.
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
const bloc76=extraire('// ══ DÉBUT FONCTIONS PURES PASTILLE COMPTE (#76)','// ══ FIN FONCTIONS PURES PASTILLE COMPTE (#76)');
const {pastilleCompteTx}=new Function(bloc06+'\n'+bloc08+'\n'+bloc76+';return {pastilleCompteTx};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const DEFAUT='#5B6EF5';
const COMPTES=[
  {id:'k1',nom:'Compte courant',couleur:'#22C97A'},
  {id:'k2',nom:'Livret',couleur:null},
  {id:'k3',nom:'Espèces',couleur:'red;background:url(x)'},
  {id:'k4',nom:'<b>Piégé</b>',couleur:'#F05252'},
];

cas('compte avec couleur valide -> nom et couleur du compte',()=>
  assert.deepStrictEqual(pastilleCompteTx({compte_id:'k1'},COMPTES),{libelle:'Compte courant',couleur:'#22C97A'}));
cas('compte sans couleur (null) -> couleur par défaut',()=>
  assert.deepStrictEqual(pastilleCompteTx({compte_id:'k2'},COMPTES),{libelle:'Livret',couleur:DEFAUT}));
cas('couleur piégée en base -> couleur par défaut, jamais la valeur brute',()=>{
  const p=pastilleCompteTx({compte_id:'k3'},COMPTES);
  assert.strictEqual(p.couleur,DEFAUT);
  assert.ok(!/url|;|red/.test(p.couleur));
});
cas('couleur sans # ou de mauvaise longueur -> couleur par défaut',()=>{
  for(const c of ['22C97A','#22C9','#22C97A00','#GGGGGG',''])
    assert.strictEqual(pastilleCompteTx({compte_id:'k1'},[{id:'k1',nom:'X',couleur:c}]).couleur,DEFAUT,c);
});
cas('transaction sans compte -> null (ni pastille ni nom)',()=>{
  assert.strictEqual(pastilleCompteTx({compte_id:null},COMPTES),null);
  assert.strictEqual(pastilleCompteTx({},COMPTES),null);
});
cas('compte introuvable -> « ? » et couleur par défaut',()=>
  assert.deepStrictEqual(pastilleCompteTx({compte_id:'zz'},COMPTES),{libelle:'?',couleur:DEFAUT}));
cas('liste de comptes absente -> « ? » et couleur par défaut, sans erreur',()=>{
  assert.deepStrictEqual(pastilleCompteTx({compte_id:'k1'},undefined),{libelle:'?',couleur:DEFAUT});
  assert.deepStrictEqual(pastilleCompteTx({compte_id:'k1'},null),{libelle:'?',couleur:DEFAUT});
});
cas('transaction absente -> null, sans erreur',()=>{
  assert.strictEqual(pastilleCompteTx(null,COMPTES),null);
  assert.strictEqual(pastilleCompteTx(undefined,COMPTES),null);
});
cas('le nom est renvoyé tel quel (l\'échappement se fait au rendu, avec esc)',()=>
  assert.strictEqual(pastilleCompteTx({compte_id:'k4'},COMPTES).libelle,'<b>Piégé</b>'));
cas('couleur en minuscules acceptée',()=>
  assert.strictEqual(pastilleCompteTx({compte_id:'k1'},[{id:'k1',nom:'X',couleur:'#abcdef'}]).couleur,'#abcdef'));

console.log(`\n${n-ko}/${n} cas OK`);
process.exit(ko?1:0);
