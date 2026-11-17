// Pastille à la couleur du compte dans la liste des transactions (#76), sans connexion : Supabase simulé en mémoire.
// Fausse base (outils.js) : « TEST QA Salaire » et « TEST QA Boulangerie » sur le compte courant k1 (#5B6EF5),
// « TEST QA Loyer octobre » hors du mois affiché. On ajoute des opérations sur le livret k2 (#22C97A),
// sans compte, ou sur un compte à la couleur piégée.
const {test,expect,UTILISATEUR}=require('./outils');

const lignes=page=>page.locator('#tx-list .tx-item');
const ligne=(page,texte)=>lignes(page).filter({hasText:texte});
const pastille=(page,texte)=>ligne(page,texte).locator('.pastille-compte');
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();
const couleur=loc=>loc.evaluate(el=>getComputedStyle(el).backgroundColor);
const rgb=hex=>{const n=parseInt(hex.slice(1),16);return `rgb(${n>>16}, ${(n>>8)&255}, ${n&255})`;};

const tx=(id,desc,m={})=>({id,user_id:UTILISATEUR.id,description:desc,montant:10,type:'sortie',categorie_id:null,
  date:'2026-11-02',tricount:'non',epingle:false,note:null,compte_id:'k1',...m});

test('le 🏦 a disparu ; chaque ligne affiche une pastille à la couleur de son compte',async({app,base})=>{
  base.tables.transactions.push(tx('t76a','TEST QA Épargne',{compte_id:'k2',type:'entrée'}));
  await app.reload();
  await expect(lignes(app)).toHaveCount(3);
  await expect(app.locator('#tx-list')).not.toContainText('🏦');
  await expect(ligne(app,'TEST QA Salaire').locator('.tx-compte')).toHaveText('TEST QA Compte courant');
  await expect(ligne(app,'TEST QA Épargne').locator('.tx-compte')).toHaveText('TEST QA Livret');
  expect(await couleur(pastille(app,'TEST QA Salaire'))).toBe(rgb('#5B6EF5'));
  expect(await couleur(pastille(app,'TEST QA Boulangerie'))).toBe(rgb('#5B6EF5'));
  expect(await couleur(pastille(app,'TEST QA Épargne'))).toBe(rgb('#22C97A'));
});

test('la pastille est ronde, de 8 px, et masquée aux lecteurs d\'écran',async({app})=>{
  const p=pastille(app,'TEST QA Salaire');
  await expect(p).toHaveAttribute('aria-hidden','true');
  const boite=await p.boundingBox();
  expect(Math.round(boite.width)).toBe(8);
  expect(Math.round(boite.height)).toBe(8);
  expect(await p.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('50%');
  // Le nom du compte reste lisible : la pastille n'a pas de texte
  await expect(p).toHaveText('');
});

test('transaction sans compte : ni pastille ni nom',async({app,base})=>{
  base.tables.transactions.push(tx('t76b','TEST QA Ancienne opération',{compte_id:null}));
  await app.reload();
  await expect(lignes(app)).toHaveCount(3);
  await expect(ligne(app,'TEST QA Ancienne opération').locator('.tx-compte')).toHaveCount(0);
  await expect(ligne(app,'TEST QA Ancienne opération').locator('.pastille-compte')).toHaveCount(0);
});

test('compte sans couleur valide : couleur par défaut #5B6EF5',async({app,base})=>{
  base.tables.comptes.find(c=>c.id==='k2').couleur=null;
  base.tables.transactions.push(tx('t76c','TEST QA Sans couleur',{compte_id:'k2'}));
  await app.reload();
  await expect(ligne(app,'TEST QA Sans couleur')).toBeVisible();
  expect(await couleur(pastille(app,'TEST QA Sans couleur'))).toBe(rgb('#5B6EF5'));
});

test('couleur piégée en base : rien n\'est injecté, couleur par défaut',async({app,base})=>{
  const piege='red;background:url(x);position:fixed';
  base.tables.comptes.find(c=>c.id==='k2').couleur=piege;
  base.tables.transactions.push(tx('t76d','TEST QA Piège',{compte_id:'k2'}));
  await app.reload();
  const p=pastille(app,'TEST QA Piège');
  await expect(p).toHaveCount(1);
  expect(await couleur(p)).toBe(rgb('#5B6EF5'));
  expect(await p.evaluate(el=>el.getAttribute('style'))).not.toMatch(/url|fixed|red/);
  expect(await p.evaluate(el=>getComputedStyle(el).position)).not.toBe('fixed');
  await expect(app.locator('#tx-list [style*="url("]')).toHaveCount(0);
});

test('nom de compte avec du HTML : échappé, la pastille reste unique',async({app,base})=>{
  base.tables.comptes.find(c=>c.id==='k2').nom='TEST QA <b>gras</b> & "co"';
  base.tables.transactions.push(tx('t76e','TEST QA Échappement',{compte_id:'k2'}));
  await app.reload();
  const l=ligne(app,'TEST QA Échappement');
  await expect(l.locator('.tx-compte')).toHaveText('TEST QA <b>gras</b> & "co"');
  await expect(l.locator('.tx-compte b')).toHaveCount(0);
  await expect(l.locator('.pastille-compte')).toHaveCount(1);
});

test('changer la couleur du compte change la pastille, sans recharger la page',async({app,base})=>{
  expect(await couleur(pastille(app,'TEST QA Salaire'))).toBe(rgb('#5B6EF5'));
  await onglet(app,'Comptes');
  await app.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-edit-compte-id]').click();
  await expect(app.locator('#modal-c-nom')).toBeFocused();
  await app.fill('#modal-c-color','#ff0000');
  await app.click('#compte-modal-save');
  await expect(app.locator('#compte-modal')).not.toHaveClass(/open/);
  expect(base.tables.comptes.find(c=>c.id==='k1').couleur.toLowerCase()).toBe('#ff0000');
  await onglet(app,'Transactions');
  expect(await couleur(pastille(app,'TEST QA Salaire'))).toBe(rgb('#ff0000'));
  expect(await couleur(pastille(app,'TEST QA Boulangerie'))).toBe(rgb('#ff0000'));
});

test('à 1280 et 390 px : pastille alignée sur le nom, sans défilement horizontal',async({app,base})=>{
  base.tables.comptes.find(c=>c.id==='k2').nom='TEST QA Un livret au nom vraiment très très long pour tester la coupe';
  base.tables.transactions.push(tx('t76f','TEST QA Nom long',{compte_id:'k2'}));
  await app.reload();
  const l=ligne(app,'TEST QA Nom long');
  await expect(l).toBeVisible();
  const [bp,bt]=await Promise.all([l.locator('.pastille-compte').boundingBox(),l.locator('.tx-compte').boundingBox()]);
  // la pastille est dans la ligne du nom du compte, centrée verticalement à ±3 px
  expect(Math.abs((bp.y+bp.height/2)-(bt.y+bt.height/2))).toBeLessThanOrEqual(3);
  expect(bp.x).toBeGreaterThanOrEqual(bt.x);
  expect(await app.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  // le montant reste entièrement dans la largeur de l'écran, à droite du nom
  const ba=await l.locator('.tx-amount').boundingBox();
  const largeur=await app.evaluate(()=>document.documentElement.clientWidth);
  expect(ba.x+ba.width).toBeLessThanOrEqual(largeur);
  expect(ba.x).toBeGreaterThan(bt.x);
});
