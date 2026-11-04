// Échappement HTML des écrans hors liste des transactions et cartes comptes (#49), sans connexion :
// liste des catégories, listes déroulantes de catégories, historique des soldes, Top 5 des stats.
// Fausse base (outils.js) complétée ici par des catégories et un solde aux noms piégés.
const {test,expect}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const ET='TEST QA A & B <test>';
const APOSTROPHE='TEST QA L\'épicerie';
const PIEGE='TEST QA <img src=x onerror="window.__xss=1;alert(1)">\'"';
const NOTE='TEST QA <b>gras</b> & l\'été';

// Ajoute les données de #49 à la fausse base, puis recharge la page pour qu'elle les lise.
async function chargerDonneesPiegees(page,base){
  const t=base.tables;
  t.categories.push(
    {id:'c3',user_id:ID_USER,nom:ET,emoji:'🧪',couleur:'#F59E0B',type:'les deux'},
    {id:'c4',user_id:ID_USER,nom:APOSTROPHE,emoji:'🥖',couleur:'#EC4899',type:'les deux'},
    {id:'c5',user_id:ID_USER,nom:PIEGE,emoji:'<i>é</i>',couleur:'#14B8A6',type:'les deux'},
  );
  const sortie=(id,description,montant,categorie_id)=>({id,user_id:ID_USER,description,montant,type:'sortie',categorie_id,
    date:'2026-11-02',tricount:'non',epingle:false,note:null,compte_id:'k1',compte_dest_id:null});
  t.transactions.push(
    sortie('t4','TEST QA Achat A&B',30,'c3'),
    sortie('t5','TEST QA Pain',20,'c4'),
    sortie('t6','TEST QA Piège',10,'c5'),
  );
  // s2 avant s1 dans la table : la croix testée (s1) n'est ni la première ligne de la table, ni la dernière saisie
  t.soldes.push(
    {id:'s2',user_id:ID_USER,compte_id:'k1',date:'2026-10-15',montant:1100,note:'TEST QA à garder'},
    {id:'s1',user_id:ID_USER,compte_id:'k1',date:'2026-11-01',montant:1200,note:NOTE},
  );
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
  await expect(page.locator('.tx-item',{hasText:'TEST QA Pain'})).toBeVisible();
}

// Aucune balise injectée n'a été interprétée : ni image, ni gras, ni script exécuté.
async function rienInterprete(page){
  expect(await page.evaluate(()=>window.__xss)).toBeUndefined();
  await expect(page.locator('#cat-list img, #stats-top5 img, #solde-history-list img, #cat-list i, #stats-top5 i')).toHaveCount(0);
  await expect(page.locator('#solde-history-list b')).toHaveCount(0);
}
const textesOptions=(page,sel)=>page.locator(`${sel} option`).allTextContents();

test.beforeEach(async({page})=>{
  page.on('dialog',d=>{throw new Error('boîte de dialogue inattendue : '+d.message());});
});

test('les noms piégés s\'affichent tels quels dans les catégories, les listes et le Top 5',async({app,base})=>{
  await chargerDonneesPiegees(app,base);

  // Onglet Catégories
  await app.getByRole('button',{name:'Catégories',exact:true}).click();
  const noms=await app.locator('#cat-list .cat-name').allTextContents();
  expect(noms).toEqual(expect.arrayContaining([ET,APOSTROPHE,PIEGE]));
  await expect(app.locator('.cat-item',{hasText:'TEST QA <img'}).locator('.cat-emoji-display')).toHaveText('<i>é</i>');

  // Listes déroulantes : filtre de la liste et fenêtre transaction
  for(const sel of ['#f-cat','#modal-tx-cat']){
    const textes=await textesOptions(app,sel);
    expect(textes).toEqual(expect.arrayContaining([`🧪 ${ET}`,`🥖 ${APOSTROPHE}`,`<i>é</i> ${PIEGE}`]));
    expect(await app.locator(`${sel} option`).evaluateAll(o=>o.map(x=>x.value))).toEqual(expect.arrayContaining(['c3','c4','c5']));
  }

  // Top 5 des statistiques (mois de novembre, sorties affectées)
  await app.getByRole('button',{name:'Statistiques',exact:true}).click();
  await expect(app.locator('#stats-top5-card')).toBeVisible();
  const top5=await app.locator('#stats-top5 .top5-name').allTextContents();
  expect(top5).toEqual([`🧪 ${ET}`,`🥖 ${APOSTROPHE}`,`<i>é</i> ${PIEGE}`,'🛒 TEST QA Courses']);
  await rienInterprete(app);
});

test('le bouton ✏️ d\'une catégorie avec apostrophe ouvre la bonne fenêtre et enregistre',async({app,base})=>{
  await chargerDonneesPiegees(app,base);
  await app.getByRole('button',{name:'Catégories',exact:true}).click();
  await app.locator('.cat-item',{hasText:APOSTROPHE}).locator('.btn-edit').click();

  await expect(app.locator('#cat-modal')).toHaveClass(/open/);
  await expect(app.locator('#cat-modal-title')).toHaveText('Modifier la catégorie');
  await expect(app.locator('#modal-cat-nom')).toBeFocused();
  await expect(app.locator('#modal-cat-nom')).toHaveValue(APOSTROPHE);
  await expect(app.locator('#modal-emoji-preview')).toHaveText('🥖');

  await app.fill('#modal-cat-nom','TEST QA L\'épicerie & co');
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  await expect(app.locator('#cat-list .cat-name',{hasText:'TEST QA L\'épicerie & co'})).toBeVisible();
  const patch=base.ecritures.filter(e=>e.methode==='PATCH'&&e.table==='categories');
  expect(patch).toHaveLength(1);
  expect(patch[0].filtres).toEqual({id:'c4'});
  expect(patch[0].corps).toMatchObject({nom:'TEST QA L\'épicerie & co'});

  // Le crayon d'une catégorie piégée ouvre aussi la sienne
  await app.locator('.cat-item',{hasText:'TEST QA <img'}).locator('.btn-edit').click();
  await expect(app.locator('#modal-cat-nom')).toHaveValue(PIEGE);
  await rienInterprete(app);
});

test('filtrer et affecter une catégorie avec apostrophe',async({app,base})=>{
  await chargerDonneesPiegees(app,base);

  await app.selectOption('#f-cat',{label:`🥖 ${APOSTROPHE}`});
  await expect(app.locator('.tx-item')).toHaveCount(1);
  await expect(app.locator('.tx-item')).toContainText('TEST QA Pain');

  await app.selectOption('#f-cat','all');
  await app.locator('.tx-item',{hasText:'TEST QA Salaire'}).click();
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await app.selectOption('#modal-tx-cat',{label:`🥖 ${APOSTROPHE}`});
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);

  const patch=base.ecritures.filter(e=>e.methode==='PATCH'&&e.table==='transactions');
  expect(patch).toHaveLength(1);
  expect(patch[0].filtres).toEqual({id:'t1'});
  expect(patch[0].corps).toMatchObject({categorie_id:'c4'});
  await expect(app.locator('.tx-item',{hasText:'TEST QA Salaire'})).toContainText(APOSTROPHE);

  await app.selectOption('#f-cat',{label:`🥖 ${APOSTROPHE}`});
  await expect(app.locator('.tx-item')).toHaveCount(2);
});

test('historique des soldes : note en texte, la croix supprime ce solde seulement',async({app,base})=>{
  await chargerDonneesPiegees(app,base);
  await app.getByRole('button',{name:'Comptes',exact:true}).click();
  await app.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-solde-compte-id]').click();
  await expect(app.locator('#solde-modal')).toHaveClass(/open/);

  const lignes=app.locator('#solde-history-list .solde-entry');
  await expect(lignes).toHaveCount(2);
  await expect(lignes.nth(0).locator('.solde-entry-date')).toHaveText(`2026-11-01 — ${NOTE}`);
  await rienInterprete(app);

  // Une note saisie dans la fenêtre s'affiche, elle aussi, en texte
  await expect(app.locator('#modal-solde-montant')).toBeFocused();
  await app.fill('#modal-solde-montant','1300');
  await app.fill('#modal-solde-date','2026-11-03');
  await app.fill('#modal-solde-note','TEST QA <u>souligné</u> "guillemets"');
  await app.locator('#solde-modal').getByRole('button',{name:'Enregistrer'}).click();
  await expect(lignes).toHaveCount(3);
  await expect(lignes.nth(0).locator('.solde-entry-date')).toHaveText('2026-11-03 — TEST QA <u>souligné</u> "guillemets"');
  await expect(app.locator('#solde-history-list u')).toHaveCount(0);

  // La croix de la ligne du 01/11 supprime s1, et seulement lui (après confirmation depuis #55)
  await lignes.filter({hasText:'2026-11-01'}).locator('[data-del-solde-id]').click();
  await expect(app.locator('#solde-confirm-msg')).toContainText('01/11/2026');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(lignes).toHaveCount(2);
  await expect(lignes.filter({hasText:'2026-11-01'})).toHaveCount(0);
  await expect(lignes.filter({hasText:'TEST QA à garder'})).toHaveCount(1);
  const suppr=base.ecritures.filter(e=>e.methode==='DELETE'&&e.table==='soldes');
  expect(suppr.map(e=>e.filtres)).toEqual([{id:'s1'}]);
  expect(base.tables.soldes.map(s=>s.id)).not.toContain('s1');
});

test('sans caractère spécial, le rendu ne change pas',async({app})=>{
  await app.getByRole('button',{name:'Catégories',exact:true}).click();
  await expect(app.locator('#cat-list .cat-name')).toHaveText(['TEST QA Courses','TEST QA Loisirs']);
  await expect(app.locator('#cat-list .cat-emoji-display')).toHaveText(['🛒','🎮']);
  expect(await textesOptions(app,'#f-cat')).toEqual(['Toutes catégories','🛒 TEST QA Courses','🎮 TEST QA Loisirs']);
  expect(await textesOptions(app,'#modal-tx-cat')).toEqual(['Sans catégorie','🛒 TEST QA Courses','🎮 TEST QA Loisirs']);
  await app.getByRole('button',{name:'Statistiques',exact:true}).click();
  await expect(app.locator('#stats-top5 .top5-name')).toHaveText(['🛒 TEST QA Courses']);
  // Plus aucun onclick construit dans ces écrans
  await app.getByRole('button',{name:'Catégories',exact:true}).click();
  await expect(app.locator('#cat-list [onclick]')).toHaveCount(0);
});
