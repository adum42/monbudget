// Lignes allégées de la liste des transactions (#74), sans connexion : Supabase simulé en mémoire.
// Plus de badge « Entrée » / « Sortie » (le montant signé et coloré suffit), plus de mention « Hors Tricount ».
// Fausse base (outils.js), novembre 2026 : « TEST QA Salaire » (entrée, hors Tricount) et
// « TEST QA Boulangerie » (sortie, hors Tricount) ; on ajoute une sortie « à valider » et une entrée « validée ».
// Ces parcours n'utilisent ni les boutons de saisie de l'onglet ni la modale transaction (refondus par #73).
const {test,expect,UTILISATEUR}=require('./outils');

const lignes=page=>page.locator('#tx-list .tx-item');
const ligne=(page,texte)=>lignes(page).filter({hasText:texte});

async function ajouterTricount(page,base){
  base.tables.transactions.push(
    {id:'t74a',user_id:UTILISATEUR.id,description:'TEST QA Restaurant partagé',montant:48,type:'sortie',categorie_id:null,date:'2026-11-02',tricount:'oui',epingle:false,note:null,compte_id:'k1'},
    {id:'t74b',user_id:UTILISATEUR.id,description:'TEST QA Remboursement ami',montant:24,type:'entrée',categorie_id:null,date:'2026-11-02',tricount:'oui validé',epingle:false,note:null,compte_id:'k1'},
  );
  await page.reload();
  await expect(lignes(page)).toHaveCount(4);
}

test('plus de badge Entrée / Sortie ; montant signé et coloré',async({app})=>{
  await expect(lignes(app)).toHaveCount(2);
  await expect(app.locator('#tx-list .badge')).toHaveCount(0);
  for(const mot of ['Entrée','Sortie'])
    await expect(app.locator('#tx-list .tx-right',{hasText:mot})).toHaveCount(0);
  const salaire=ligne(app,'TEST QA Salaire').locator('.tx-amount');
  await expect(salaire).toHaveText(/^\+2\s?000,00 €$/);
  await expect(salaire).toHaveClass(/\bgreen\b/);
  const boulangerie=ligne(app,'TEST QA Boulangerie').locator('.tx-amount');
  await expect(boulangerie).toHaveText(/^-4,20 €$/);
  await expect(boulangerie).toHaveClass(/\bred\b/);
  // Hors Tricount, le montant est seul à droite de la ligne
  expect(await app.$$eval('#tx-list .tx-right',els=>els.map(e=>e.children.length))).toEqual([1,1]);
});

test('hors Tricount : aucune mention ; « Valider Tricount » et « ✅ Validé » toujours affichés',async({app,base})=>{
  await ajouterTricount(app,base);
  await expect(app.locator('#tx-list')).not.toContainText('Hors Tricount');
  await expect(app.locator('#tx-list .btn-tricount-non')).toHaveCount(0);
  // Lignes hors Tricount : seul le montant à droite
  for(const t of ['TEST QA Salaire','TEST QA Boulangerie'])
    await expect(ligne(app,t).locator('.tx-right > *')).toHaveCount(1);
  await expect(ligne(app,'TEST QA Restaurant partagé').getByRole('button',{name:'Valider Tricount'})).toBeVisible();
  await expect(ligne(app,'TEST QA Remboursement ami').locator('.btn-tricount-done')).toHaveText('✅ Validé');
});

test('« Valider Tricount » reste cliquable',async({app,base})=>{
  await ajouterTricount(app,base);
  await ligne(app,'TEST QA Restaurant partagé').getByRole('button',{name:'Valider Tricount'}).click();
  await expect(ligne(app,'TEST QA Restaurant partagé').locator('.btn-tricount-done')).toHaveText('✅ Validé');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);   // le clic n'ouvre pas la modale
  expect(base.tables.transactions.find(t=>t.id==='t74a').tricount).toBe('oui validé');
});

test('le filtre « Hors tricount » fonctionne toujours',async({app,base})=>{
  await ajouterTricount(app,base);
  await app.selectOption('#f-tricount','non');
  await expect(lignes(app)).toHaveCount(2);
  await expect(ligne(app,'TEST QA Salaire')).toBeVisible();
  await expect(ligne(app,'TEST QA Boulangerie')).toBeVisible();
  await app.selectOption('#f-tricount','oui');
  await expect(lignes(app)).toHaveCount(1);
  await expect(ligne(app,'TEST QA Restaurant partagé')).toBeVisible();
  await app.selectOption('#f-tricount','oui validé');
  await expect(lignes(app)).toHaveCount(1);
  await expect(ligne(app,'TEST QA Remboursement ami')).toBeVisible();
});

test('montant calé à droite, sans défilement horizontal',async({app,base})=>{
  await ajouterTricount(app,base);
  const mesures=await app.$$eval('#tx-list .tx-item',els=>els.map(el=>{
    const r=el.getBoundingClientRect();
    const m=el.querySelector('.tx-amount').getBoundingClientRect();
    const style=getComputedStyle(el);
    return {droiteLigne:r.right-parseFloat(style.paddingRight)-parseFloat(style.borderRightWidth),droiteMontant:m.right,
            dernier:el.querySelector('.tx-right').lastElementChild.classList.contains('tx-amount')};
  }));
  expect(mesures).toHaveLength(4);
  for(const m of mesures){
    expect(m.dernier).toBe(true);
    expect(Math.abs(m.droiteLigne-m.droiteMontant)).toBeLessThanOrEqual(1);
  }
  // Tous les montants sont alignés sur le même bord droit
  const bords=mesures.map(m=>Math.round(m.droiteMontant));
  expect(Math.max(...bords)-Math.min(...bords)).toBeLessThanOrEqual(1);
  expect(await app.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
