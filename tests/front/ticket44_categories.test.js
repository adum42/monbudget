// Tests unitaires des fonctions pures de la suppression de catégorie (#44).
// Usage : node tests/front/ticket44_categories.test.js [index.html]
// Le bloc « FONCTIONS PURES CATÉGORIES (#44) » est extrait tel quel de index.html : on teste le vrai code.
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const extraire=(debutTxt,finTxt)=>{
  const d=html.indexOf(debutTxt),f=html.indexOf(finTxt,d);
  assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debutTxt);
  return html.slice(d,f);
};
const bloc44=extraire('// ══ DÉBUT FONCTIONS PURES CATÉGORIES (#44)','// ══ FIN FONCTIONS PURES CATÉGORIES (#44)');
const f=new Function(bloc44+';return {trouverCategorie,messageSuppressionCategorie};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

const A={id:'a',nom:'Alimentation',emoji:'🛒'},B={id:'b',nom:'Loisirs',emoji:'🎮'},N={id:7,nom:'Numérique',emoji:null};
const liste=[A,B,N];

// ── trouverCategorie : renvoie la catégorie de l'identifiant demandé, et seulement elle
cas('trouve A',()=>assert.strictEqual(f.trouverCategorie(liste,'a'),A));
cas('trouve B (pas A)',()=>assert.strictEqual(f.trouverCategorie(liste,'b'),B));
cas('id numérique comparé en texte (data-* est toujours du texte)',()=>assert.strictEqual(f.trouverCategorie(liste,'7'),N));
cas('id inconnu -> null',()=>assert.strictEqual(f.trouverCategorie(liste,'zz'),null));
cas('id null -> null',()=>assert.strictEqual(f.trouverCategorie(liste,null),null));
cas('id undefined -> null',()=>assert.strictEqual(f.trouverCategorie(liste,undefined),null));
cas('id vide -> null',()=>assert.strictEqual(f.trouverCategorie(liste,''),null));
cas('liste vide -> null',()=>assert.strictEqual(f.trouverCategorie([],'a'),null));
cas('liste absente -> null',()=>assert.strictEqual(f.trouverCategorie(null,'a'),null));
cas('UUID réel',()=>{
  const u={id:'3f1c2b9e-0d4a-4c1e-9b7a-2e6f5d8c1a00',nom:'X'};
  assert.strictEqual(f.trouverCategorie([A,u],'3f1c2b9e-0d4a-4c1e-9b7a-2e6f5d8c1a00'),u);
});

// ── messageSuppressionCategorie : nomme la catégorie (émoji + nom) et annonce « Sans catégorie »
const attendu='Supprimer la catégorie 🛒 Alimentation ? Les transactions liées passeront en « Sans catégorie ».';
cas('message de l\'exemple du ticket',()=>assert.strictEqual(f.messageSuppressionCategorie(A),attendu));
cas('émoji absent -> 📁',()=>assert.ok(f.messageSuppressionCategorie(N).startsWith('Supprimer la catégorie 📁 Numérique ?')));
cas('nom absent -> « sans nom »',()=>assert.ok(f.messageSuppressionCategorie({id:'x',emoji:'🎁'}).includes('🎁 sans nom ?')));
cas('catégorie absente -> message générique sans erreur',()=>assert.ok(f.messageSuppressionCategorie(null).includes('📁 sans nom')));
cas('texte saisi rendu tel quel (inséré avec textContent, pas en HTML)',()=>
  assert.ok(f.messageSuppressionCategorie({nom:'<img src=x onerror=alert(1)>',emoji:'🛒'}).includes('<img src=x onerror=alert(1)>')));
cas('nom de B pour B',()=>assert.ok(f.messageSuppressionCategorie(B).includes('🎮 Loisirs')&&!f.messageSuppressionCategorie(B).includes('Alimentation')));

console.log(`\n${n-ko}/${n} cas OK`);
process.exit(ko?1:0);
