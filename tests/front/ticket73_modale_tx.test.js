// Tests unitaires du bloc « FONCTIONS PURES MODALE TRANSACTION (#73) » : un seul bouton
// « + Nouvelle opération », modale colorée et signée selon sortie / entrée.
// Usage : node tests/front/ticket73_modale_tx.test.js [index.html]
// Aucun réseau, aucune base, aucune dépendance (Node seul).
const assert=require('assert');
const fs=require('fs'),path=require('path');
const fichier=process.argv[2]||path.join(__dirname,'..','..','index.html');
const html=fs.readFileSync(fichier,'utf8');
const debut='// ══ DÉBUT FONCTIONS PURES MODALE TRANSACTION (#73)',fin='// ══ FIN FONCTIONS PURES MODALE TRANSACTION (#73)';
const d=html.indexOf(debut),f=html.indexOf(fin,d);
assert.ok(d>0&&f>d,'bloc introuvable dans '+fichier+' : '+debut);
const {apparenceModaleTx,TYPE_NOUVELLE_TX}=
  new Function(html.slice(d,f)+';return {apparenceModaleTx,TYPE_NOUVELLE_TX};')();

let ko=0,n=0;
const cas=(nom,fn)=>{n++;try{fn();console.log('OK  '+nom);}catch(e){ko++;console.log('KO  '+nom+' : '+e.message);}};

// ── Type par défaut
cas('une nouvelle opération part sur Sortie',()=>assert.strictEqual(TYPE_NOUVELLE_TX,'sortie'));

// ── Titres (tableau du ticket)
cas('création d\'une sortie : « − Nouvelle sortie »',()=>assert.strictEqual(apparenceModaleTx('sortie','nouveau').titre,'− Nouvelle sortie'));
cas('création d\'une entrée : « + Nouvelle entrée »',()=>assert.strictEqual(apparenceModaleTx('entrée','nouveau').titre,'+ Nouvelle entrée'));
cas('modification d\'une sortie : « − Modifier la sortie »',()=>assert.strictEqual(apparenceModaleTx('sortie','edition').titre,'− Modifier la sortie'));
cas('modification d\'une entrée : « + Modifier l\'entrée »',()=>assert.strictEqual(apparenceModaleTx('entrée','edition').titre,'+ Modifier l\'entrée'));
cas('duplication = création (« Nouvelle … »)',()=>{
  assert.strictEqual(apparenceModaleTx('sortie','duplication').titre,'− Nouvelle sortie');
  assert.strictEqual(apparenceModaleTx('entrée','duplication').titre,'+ Nouvelle entrée');
});
cas('le signe du titre est le vrai signe moins (U+2212), comme le bouton « − Sortie »',()=>
  assert.strictEqual(apparenceModaleTx('sortie','nouveau').titre.charCodeAt(0),0x2212));

// ── Couleurs (variables existantes)
cas('sortie en rouge (--red)',()=>assert.strictEqual(apparenceModaleTx('sortie','nouveau').couleur,'var(--red)'));
cas('entrée en vert (--green)',()=>assert.strictEqual(apparenceModaleTx('entrée','nouveau').couleur,'var(--green)'));
cas('couleur identique en création et en modification',()=>{
  for(const t of ['sortie','entrée'])
    assert.strictEqual(apparenceModaleTx(t,'nouveau').couleur,apparenceModaleTx(t,'edition').couleur);
});
cas('classe CSS de la modale selon le type',()=>{
  assert.strictEqual(apparenceModaleTx('sortie','nouveau').classe,'type-sortie');
  assert.strictEqual(apparenceModaleTx('entrée','edition').classe,'type-entree');
});

// ── Signe du montant
cas('montant précédé de « − » pour une sortie',()=>assert.strictEqual(apparenceModaleTx('sortie','nouveau').signe,'−'));
cas('montant précédé de « + » pour une entrée',()=>assert.strictEqual(apparenceModaleTx('entrée','nouveau').signe,'+'));

// ── Bouton d'enregistrement
cas('bouton « Enregistrer la sortie »',()=>assert.strictEqual(apparenceModaleTx('sortie','nouveau').enregistrer,'Enregistrer la sortie'));
cas('bouton « Enregistrer l\'entrée »',()=>assert.strictEqual(apparenceModaleTx('entrée','nouveau').enregistrer,'Enregistrer l\'entrée'));
cas('même libellé de bouton en modification',()=>{
  assert.strictEqual(apparenceModaleTx('sortie','edition').enregistrer,'Enregistrer la sortie');
  assert.strictEqual(apparenceModaleTx('entrée','edition').enregistrer,'Enregistrer l\'entrée');
});

// ── Type renvoyé et cas limites
cas('type normalisé renvoyé',()=>{
  assert.strictEqual(apparenceModaleTx('sortie','nouveau').type,'sortie');
  assert.strictEqual(apparenceModaleTx('entrée','nouveau').type,'entrée');
});
cas('type inconnu, vide ou absent -> présenté comme une sortie',()=>{
  for(const t of ['mouvement','',null,undefined,'Entrée','entree'])
    assert.strictEqual(apparenceModaleTx(t,'nouveau').titre,'− Nouvelle sortie','type '+t);
});
cas('mode absent -> création',()=>assert.strictEqual(apparenceModaleTx('entrée').titre,'+ Nouvelle entrée'));
cas('fonction pure : deux appels identiques donnent des objets égaux mais distincts',()=>{
  const a=apparenceModaleTx('sortie','nouveau'),b=apparenceModaleTx('sortie','nouveau');
  assert.deepStrictEqual(a,b);assert.notStrictEqual(a,b);
});

console.log(`\n${n-ko}/${n} cas réussis`);
process.exit(ko?1:0);
