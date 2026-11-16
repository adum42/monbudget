// Retrait des mouvements et catégorie « Mouvement de compte » (#69), sans connexion.
// Fausse base (outils.js) : « TEST QA Virement interne » (cv) est cochée « Mouvement de compte ».
// Départ : novembre = entrée 2 000 (Salaire, sans catégorie) + sortie 4,20 (Boulangerie, Courses c1) ;
// soldes : Compte courant k1 = 2 345,80 €, Livret k2 = 500,00 €.
const {test,expect}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const COURANT='TEST QA Compte courant';
const LIVRET='TEST QA Livret';
const euros=v=>v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();
const metrique=(page,libelle)=>page.locator('#metrics .metric',{hasText:libelle}).locator('.metric-value');
const kpi=(page,libelle)=>page.locator('#stats-kpis .stats-kpi',{hasText:libelle}).locator('.stats-kpi-value');

// Critère du ticket : sortie de 200 € sur le compte courant et entrée de 200 € sur le livret, en « Virement interne ».
async function ajouterVirement(page,base){
  const ligne=(id,type,compte_id)=>({id,user_id:ID_USER,description:'TEST QA Virement livret',montant:200,type,
    categorie_id:'cv',date:'2026-11-02',tricount:'non',epingle:false,note:null,compte_id});
  base.tables.transactions.push(ligne('v1','sortie','k1'),ligne('v2','entrée','k2'));
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
  await expect(page.locator('.tx-item',{hasText:'TEST QA Virement livret'})).toHaveCount(2);
}
async function verifierMetriques(page,entrees,sorties){
  await expect(metrique(page,'Entrées')).toHaveText(euros(entrees));
  await expect(metrique(page,'Sorties')).toHaveText(euros(sorties));
  await expect(metrique(page,'Solde du mois')).toHaveText(euros(entrees-sorties));
}
async function verifierStats(page,{depenses,solde,top5,categoriesGraphique,entrees6,sorties6}){
  await onglet(page,'Statistiques');
  await expect(kpi(page,'Dépenses')).toHaveText(euros(depenses));
  await expect(kpi(page,'Solde du mois')).toHaveText(euros(solde));
  await expect(page.locator('#stats-top5 .top5-name')).toHaveText(top5);
  expect(await page.evaluate(()=>chartCat?chartCat.data.labels:[])).toEqual(categoriesGraphique);
  // Évolution 6 mois : juin à novembre 2026, seuls octobre et novembre ont des opérations.
  expect(await page.evaluate(()=>chartMonths.data.datasets.map(d=>d.data))).toEqual([entrees6,sorties6]);
  await onglet(page,'Transactions');
}

test('plus aucun moyen de créer ni de filtrer un mouvement',async({app})=>{
  await expect(app.getByRole('button',{name:/Mouvement entre comptes/})).toHaveCount(0);
  expect(await app.locator('#f-type option').allTextContents()).toEqual(['Tous','Entrées','Sorties']);
  await expect(app.locator('#modal-tx-depuis, #modal-tx-vers, #tx-mvt-row, #btn-type-mvt')).toHaveCount(0);
  // En modification, le choix du type ne propose qu'entrée et sortie.
  await app.locator('.tx-item',{hasText:'TEST QA Boulangerie'}).click();
  await expect(app.locator('#tx-type-toggle-row .type-btn')).toHaveText(['+ Entrée','− Sortie']);
  await expect(app.locator('#tx-cat-row')).toBeVisible();
  await expect(app.locator('#tx-compte-row')).toBeVisible();
});

test('virement interne : visible dans la liste, absent des totaux, KPIs, graphiques et top 5, présent dans les soldes',async({app,base})=>{
  await ajouterVirement(app,base);
  // Liste : les deux opérations, avec leur compte et leur badge habituel
  const lignes=app.locator('.tx-item',{hasText:'TEST QA Virement livret'});
  await expect(lignes.filter({hasText:COURANT}).locator('.badge')).toHaveText('Sortie');
  await expect(lignes.filter({hasText:LIVRET}).locator('.badge')).toHaveText('Entrée');
  await expect(lignes.first().locator('.tx-meta')).toContainText('TEST QA Virement interne');
  // Le filtre par catégorie les retrouve toujours
  await app.selectOption('#f-cat','cv');
  await expect(app.locator('.tx-item')).toHaveCount(2);
  await app.selectOption('#f-cat','all');
  // Mêmes métriques qu'avant le virement
  await verifierMetriques(app,2000,4.2);
  await verifierStats(app,{depenses:4.2,solde:1995.8,top5:['🛒 TEST QA Courses'],categoriesGraphique:['🛒 TEST QA Courses'],
    entrees6:[0,0,0,0,0,2000],sorties6:[0,0,0,0,650,4.2]});
  // Soldes : −200 sur le compte courant, +200 sur le livret
  await onglet(app,'Comptes');
  await expect(app.locator('.compte-card',{hasText:COURANT}).locator('.compte-solde-actuel')).toHaveText(euros(2145.8));
  await expect(app.locator('.compte-card',{hasText:LIVRET}).locator('.compte-solde-actuel')).toHaveText(euros(700));
  await expect(app.locator('#patrimoine-total')).toHaveText(euros(2845.8));
});

test('saisie d\'un virement par la modale : catégorie et compte envoyés, sans compte_dest_id',async({app,base})=>{
  for(const [bouton,compte] of [['− Sortie d\'argent','k1'],['+ Entrée d\'argent','k2']]){
    await app.getByRole('button',{name:bouton}).click();
    await expect(app.locator('#modal-tx-desc')).toBeFocused();
    await app.fill('#modal-tx-desc','TEST QA Virement saisi');
    await app.fill('#modal-tx-amount','200');
    await app.selectOption('#modal-tx-compte',compte);
    await app.selectOption('#modal-tx-cat','cv');
    await app.click('#tx-modal-save');
    await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  }
  const corps=base.ecritures.map(e=>e.corps[0]);
  expect(corps).toMatchObject([{type:'sortie',compte_id:'k1',categorie_id:'cv',montant:200},{type:'entrée',compte_id:'k2',categorie_id:'cv',montant:200}]);
  for(const c of corps) expect(c).not.toHaveProperty('compte_dest_id');
  await expect(app.locator('.tx-item',{hasText:'TEST QA Virement saisi'})).toHaveCount(2);
  await verifierMetriques(app,2000,4.2);
});

test('cocher « Mouvement de compte » sur une autre catégorie décoche l\'ancienne, le signale, et l\'exclusion suit',async({app,base})=>{
  await ajouterVirement(app,base);
  await onglet(app,'Catégories');
  const ligne=nom=>app.locator('.cat-item',{hasText:nom});
  await expect(ligne('TEST QA Virement interne').locator('.cat-mvt-compte')).toBeVisible();
  await expect(app.locator('#cat-list .cat-mvt-compte')).toHaveCount(1);

  // La catégorie déjà cochée : case cochée, aucun message
  await ligne('TEST QA Virement interne').locator('.btn-edit').click();
  await expect(app.locator('#modal-cat-mvt')).toBeChecked();
  await expect(app.locator('#cat-modal-info')).toBeHidden();
  await app.getByRole('button',{name:'Annuler'}).click();

  // Courses : on coche, le message prévient avant d'enregistrer
  await ligne('TEST QA Courses').locator('.btn-edit').click();
  await expect(app.locator('#modal-cat-mvt')).not.toBeChecked();
  await app.locator('label[for="modal-cat-mvt"]').click();
  await expect(app.locator('#cat-modal-info')).toHaveText('TEST QA Virement interne ne sera plus la catégorie Mouvement de compte.');
  await app.locator('label[for="modal-cat-mvt"]').click();               // décocher retire le message
  await expect(app.locator('#cat-modal-info')).toBeHidden();
  await app.locator('label[for="modal-cat-mvt"]').click();
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);

  // Deux requêtes, dans cet ordre (sinon 23505) : décocher l'ancienne, puis enregistrer la nouvelle
  expect(base.ecritures.map(e=>[e.methode,e.filtres,e.corps])).toEqual([
    ['PATCH',{id:'cv'},{mouvement_compte:false}],
    ['PATCH',{id:'c1'},{nom:'TEST QA Courses',emoji:'🛒',mouvement_compte:true}],
  ]);
  await expect(app.locator('#cat-info')).toHaveText('TEST QA Virement interne n\'est plus la catégorie Mouvement de compte.');
  await expect(app.locator('#cat-list .cat-mvt-compte')).toHaveCount(1);
  await expect(ligne('TEST QA Courses').locator('.cat-mvt-compte')).toBeVisible();

  // L'exclusion suit : le virement compte à nouveau, la boulangerie (Courses) est exclue
  await onglet(app,'Transactions');
  await verifierMetriques(app,2200,200);
  await verifierStats(app,{depenses:200,solde:2000,top5:['🔁 TEST QA Virement interne'],categoriesGraphique:['🔁 TEST QA Virement interne'],
    entrees6:[0,0,0,0,0,2200],sorties6:[0,0,0,0,650,200]});
  await expect(app.locator('.tx-item',{hasText:'TEST QA Boulangerie'})).toBeVisible();   // toujours listée
});

test('nouvelle catégorie cochée : l\'ancienne est décochée d\'abord',async({app,base})=>{
  await onglet(app,'Catégories');
  await app.getByRole('button',{name:'+ Nouvelle catégorie'}).click();
  await expect(app.locator('#modal-cat-nom')).toBeFocused();
  await app.fill('#modal-cat-nom','TEST QA Transferts');
  await app.locator('label[for="modal-cat-mvt"]').click();
  await expect(app.locator('#cat-modal-info')).toContainText('TEST QA Virement interne ne sera plus');
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  expect(base.ecritures.map(e=>[e.methode,e.filtres])).toEqual([['PATCH',{id:'cv'}],['POST',{}]]);
  expect(base.ecritures[1].corps[0]).toMatchObject({nom:'TEST QA Transferts',mouvement_compte:true,type:'les deux'});
  await expect(app.locator('.cat-item',{hasText:'TEST QA Transferts'}).locator('.cat-mvt-compte')).toBeVisible();
  await expect(app.locator('#cat-list .cat-mvt-compte')).toHaveCount(1);
});

test('décocher la seule catégorie cochée : plus rien n\'est exclu, aucun message',async({app,base})=>{
  await ajouterVirement(app,base);
  await onglet(app,'Catégories');
  await app.locator('.cat-item',{hasText:'TEST QA Virement interne'}).locator('.btn-edit').click();
  await app.locator('label[for="modal-cat-mvt"]').click();
  await expect(app.locator('#cat-modal-info')).toBeHidden();
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  expect(base.ecritures.map(e=>[e.methode,e.filtres,e.corps.mouvement_compte])).toEqual([['PATCH',{id:'cv'},false]]);
  await expect(app.locator('#cat-info')).toBeHidden();
  await expect(app.locator('#cat-list .cat-mvt-compte')).toHaveCount(0);
  await onglet(app,'Transactions');
  await verifierMetriques(app,2200,204.2);
});

test('erreur base au changement de catégorie cochée : message, fenêtre ouverte, rien n\'a changé',async({app,base,journal})=>{
  journal.attendre(/saveCat/);
  journal.attendre(/status of 400/);
  await onglet(app,'Catégories');
  await app.locator('.cat-item',{hasText:'TEST QA Courses'}).locator('.btn-edit').click();
  await app.locator('label[for="modal-cat-mvt"]').click();
  base.forcerErreur('42501');
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal-error')).toContainText('42501');
  await expect(app.locator('#cat-modal')).toHaveClass(/open/);
  expect(base.ecritures).toHaveLength(1);                                 // 2e requête non envoyée
  expect(base.tables.categories.find(c=>c.id==='cv').mouvement_compte).toBe(true);
  expect(base.tables.categories.find(c=>c.id==='c1').mouvement_compte).toBe(false);
});

test('la fausse base refuse une 2e catégorie cochée (garde-fou du test, comme l\'index unique de #68)',async({app,base,journal})=>{
  journal.attendre(/status of 400/);
  // Envoi direct d'une seule requête qui coche Courses sans décocher Virement interne : refusé en 23505
  const code=await app.evaluate(async()=>{const{error}=await sb.from('categories').update({mouvement_compte:true}).eq('id','c1');return error&&error.code;});
  expect(code).toBe('23505');
  expect(base.tables.categories.filter(c=>c.mouvement_compte)).toHaveLength(1);
});
