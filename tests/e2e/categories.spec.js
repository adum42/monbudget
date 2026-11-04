// Suppression de catégorie (#44), sans connexion : Supabase simulé en mémoire.
// Fausse base : c1 « TEST QA Courses » 🛒 (portée par la transaction t2), c2 « TEST QA Loisirs » 🎮.
const {test,expect}=require('./outils');

const ligneCat=(page,nom)=>page.locator('.cat-item',{hasText:nom});
const croix=(page,nom)=>ligneCat(page,nom).locator('[data-del-cat-id]');
const crayon=(page,nom)=>ligneCat(page,nom).locator('.btn-edit');
const modale=page=>page.locator('#cat-modal');
const message=page=>page.locator('#cat-confirm-msg');

async function ongletCategories(page){
  await page.getByRole('button',{name:'Catégories',exact:true}).click();
  await expect(ligneCat(page,'TEST QA Courses')).toBeVisible();
}
// La fenêtre de suppression est ouverte, et ne propose QUE la catégorie attendue
async function confirmationPour(page,nom,autre){
  await expect(modale(page)).toHaveClass(/open/);
  await expect(message(page)).toContainText(nom);
  await expect(message(page)).not.toContainText(autre);
  await expect(page.locator('#cat-confirm-annuler')).toBeFocused();   // focus posé 100 ms après l'ouverture
}
const suppressions=base=>base.ecritures.filter(e=>e.methode==='DELETE'&&e.table==='categories');

test('la croix supprime la catégorie de sa ligne, après confirmation',async({app,base})=>{
  await ongletCategories(app);
  await croix(app,'TEST QA Courses').click();
  await confirmationPour(app,'🛒 TEST QA Courses','Loisirs');
  await expect(message(app)).toHaveText('Supprimer la catégorie 🛒 TEST QA Courses ? Les transactions liées passeront en « Sans catégorie ».');
  expect(suppressions(base)).toHaveLength(0);                          // rien n'est parti avant la confirmation

  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(modale(app)).not.toHaveClass(/open/);
  await expect(ligneCat(app,'TEST QA Courses')).toHaveCount(0);
  await expect(ligneCat(app,'TEST QA Loisirs')).toBeVisible();          // aucune autre catégorie ne bouge
  expect(suppressions(base)).toHaveLength(1);
  expect(suppressions(base)[0].filtres).toEqual({id:'c1'});

  // La transaction liée est toujours là, en « Sans catégorie »
  await app.getByRole('button',{name:'Transactions',exact:true}).click();
  const tx=app.locator('.tx-item',{hasText:'TEST QA Boulangerie'});
  await expect(tx).toBeVisible();
  await expect(tx).not.toContainText('TEST QA Courses');
  await expect(app.locator('#f-cat option',{hasText:'TEST QA Courses'})).toHaveCount(0);
  await expect(app.locator('#modal-tx-cat option',{hasText:'TEST QA Courses'})).toHaveCount(0);
});

test('Annuler ne supprime rien, puis la croix de B ne propose que B',async({app,base})=>{
  await ongletCategories(app);
  await croix(app,'TEST QA Courses').click();
  await confirmationPour(app,'TEST QA Courses','Loisirs');
  await app.click('#cat-confirm-annuler');
  await expect(modale(app)).not.toHaveClass(/open/);

  await croix(app,'TEST QA Loisirs').click();
  await confirmationPour(app,'🎮 TEST QA Loisirs','Courses');
  await app.click('#cat-confirm-annuler');
  expect(suppressions(base)).toHaveLength(0);
  await expect(ligneCat(app,'TEST QA Courses')).toBeVisible();
  await expect(ligneCat(app,'TEST QA Loisirs')).toBeVisible();
});

for(const fermeture of ['Échap','clic à l\'extérieur']){
  test(`ouvrir A, fermer par ${fermeture}, puis la croix de B ne propose que B`,async({app,base})=>{
    await ongletCategories(app);
    await crayon(app,'TEST QA Courses').click();
    await expect(app.locator('#modal-cat-nom')).toBeFocused();
    await expect(app.locator('#modal-cat-nom')).toHaveValue('TEST QA Courses');
    if(fermeture==='Échap'){
      await app.locator('#cat-modal-title').click();   // Échap est ignoré quand le focus est dans un champ (règle existante)
      await app.keyboard.press('Escape');
    }else{
      await modale(app).click({position:{x:5,y:5}});
    }
    await expect(modale(app)).not.toHaveClass(/open/);
    expect(await app.evaluate(()=>editingCatId)).toBeNull();

    await croix(app,'TEST QA Loisirs').click();
    await confirmationPour(app,'TEST QA Loisirs','Courses');
    await app.getByRole('button',{name:'Confirmer la suppression'}).click();
    await expect(modale(app)).not.toHaveClass(/open/);
    expect(suppressions(base).map(e=>e.filtres)).toEqual([{id:'c2'}]);
    await expect(ligneCat(app,'TEST QA Courses')).toBeVisible();
  });
}

test('depuis la fenêtre : Supprimer demande une confirmation, Annuler revient à la fenêtre',async({app,base})=>{
  await ongletCategories(app);
  await crayon(app,'TEST QA Courses').click();
  await expect(app.locator('#modal-cat-nom')).toBeFocused();
  await app.click('#cat-modal-delete');
  await expect(message(app)).toContainText('🛒 TEST QA Courses');
  await app.click('#cat-confirm-annuler');
  await expect(modale(app)).toHaveClass(/open/);                        // la fenêtre reste ouverte
  await expect(app.locator('#cat-modal-delete')).toBeVisible();
  expect(suppressions(base)).toHaveLength(0);

  await app.click('#cat-modal-delete');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(modale(app)).not.toHaveClass(/open/);
  expect(suppressions(base).map(e=>e.filtres)).toEqual([{id:'c1'}]);
});

test('une erreur de la base est affichée, la catégorie reste',async({app,base,journal})=>{
  journal.attendre(/deleteCat/);
  journal.attendre(/status of 400/);
  await ongletCategories(app);
  base.forcerErreur('23503');
  await croix(app,'TEST QA Courses').click();
  await confirmationPour(app,'TEST QA Courses','Loisirs');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();

  await expect(app.locator('#cat-modal-error')).toBeVisible();
  await expect(app.locator('#cat-modal-error')).toContainText('23503');
  await expect(modale(app)).toHaveClass(/open/);
  await expect(message(app)).toContainText('TEST QA Courses');           // la confirmation reste proposée
  expect(base.tables.categories.some(c=>c.id==='c1')).toBe(true);
  await app.click('#cat-confirm-annuler');
  await expect(ligneCat(app,'TEST QA Courses')).toBeVisible();
});

test('confirmation entièrement visible, sans défilement horizontal',async({app})=>{
  await ongletCategories(app);
  await croix(app,'TEST QA Courses').click();
  await confirmationPour(app,'TEST QA Courses','Loisirs');
  for(const sel of ['#cat-confirm-msg','#cat-confirm-annuler','#cat-confirm-supprimer']){
    await expect(app.locator(sel)).toBeInViewport({ratio:1});
  }
  const debord=await app.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});

test('non-régression : créer et modifier une catégorie',async({app,base})=>{
  await ongletCategories(app);
  await app.getByRole('button',{name:'+ Nouvelle catégorie'}).click();
  await expect(app.locator('#modal-cat-nom')).toBeFocused();
  await expect(app.locator('#cat-modal-delete')).toBeHidden();
  await app.fill('#modal-cat-nom','TEST QA Santé');
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(ligneCat(app,'TEST QA Santé')).toBeVisible();

  await crayon(app,'TEST QA Loisirs').click();
  await expect(app.locator('#modal-cat-nom')).toBeFocused();
  await app.fill('#modal-cat-nom','TEST QA Sorties');
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(ligneCat(app,'TEST QA Sorties')).toBeVisible();
  expect(base.ecritures.map(e=>[e.methode,e.table])).toEqual([['POST','categories'],['PATCH','categories']]);
  expect(base.ecritures[1].filtres).toEqual({id:'c2'});
});
