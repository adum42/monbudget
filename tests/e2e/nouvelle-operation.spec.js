// Bouton unique « + Nouvelle opération » et modale colorée selon sortie / entrée (#73),
// sans connexion : Supabase simulé en mémoire. Un parcours par critère d'acceptation,
// lancés à 1280 et 390 px (projets bureau-1280 et mobile-390).
const {test,expect,nouvelleOperation}=require('./outils');

const ROUGE='rgb(240, 82, 82)',VERT='rgb(34, 201, 122)';   // --red et --green de :root

// Apparence complète de la modale pour un type : titre, sélecteur, signe et couleur du montant, bouton.
async function verifierApparence(page,{titre,type}){
  const couleur=type==='entrée'?VERT:ROUGE;
  const modale=page.locator('#tx-modal');
  await expect(page.locator('#tx-modal-title')).toHaveText(titre);
  await expect(page.locator('#tx-modal-title')).toHaveCSS('color',couleur);
  await expect(page.locator('#tx-type-toggle-row')).toBeVisible();
  const actif=type==='entrée'?'#btn-type-in':'#btn-type-out',inactif=type==='entrée'?'#btn-type-out':'#btn-type-in';
  await expect(page.locator(actif)).toHaveClass(type==='entrée'?/active-in/:/active-out/);
  await expect(page.locator(actif)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator(inactif)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator(inactif)).not.toHaveClass(/active-/);
  await expect(page.locator(actif)).toHaveCSS('background-color',type==='entrée'?'rgba(34, 201, 122, 0.12)':'rgba(240, 82, 82, 0.12)');   // fond pâle
  await expect(page.locator(inactif)).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  await expect(page.locator('#tx-montant-signe')).toHaveText(type==='entrée'?'+':'−');
  await expect(page.locator('#tx-montant-signe')).toHaveCSS('color',couleur);
  await expect(page.locator('#modal-tx-amount')).toHaveCSS('color',couleur);
  const bouton=modale.locator('#tx-modal-save');
  await expect(bouton).toHaveText(type==='entrée'?'Enregistrer l\'entrée':'Enregistrer la sortie');
  await expect(bouton).toHaveCSS('background-color',couleur);
}

// Valeurs de tous les champs de la modale (pour vérifier qu'un changement de type ne vide rien).
const lireChamps=page=>page.evaluate(()=>({
  desc:document.getElementById('modal-tx-desc').value,
  montant:document.getElementById('modal-tx-amount').value,
  date:document.getElementById('modal-tx-date').value,
  compte:document.getElementById('modal-tx-compte').value,
  cat:document.getElementById('modal-tx-cat').value,
  note:document.getElementById('modal-tx-note').value,
  tricount:document.querySelector('#tx-tricount-row .tricount-btn[class*="active-"]').id,
  epingle:document.getElementById('modal-tx-epingle').checked,
}));

test('un seul bouton « + Nouvelle opération », qui ouvre « − Nouvelle sortie » en rouge',async({app})=>{
  await expect(app.getByRole('button',{name:/Entrée d'argent|Sortie d'argent/})).toHaveCount(0);
  await expect(app.locator('#tab-transactions .btn-add')).toHaveCount(1);
  await expect(app.locator('#tab-transactions .btn-add')).toHaveText('+ Nouvelle opération');
  await nouvelleOperation(app);
  await verifierApparence(app,{titre:'− Nouvelle sortie',type:'sortie'});
  // Sélecteur dans l'ordre − Sortie | + Entrée
  await expect(app.locator('#tx-type-toggle-row .type-btn')).toHaveText(['− Sortie','+ Entrée']);
});

test('passer sur « + Entrée » puis revenir à Sortie : couleurs et libellés suivent, saisie conservée',async({app})=>{
  await nouvelleOperation(app);
  await app.fill('#modal-tx-desc','TEST QA Remboursement');
  await app.fill('#modal-tx-amount','42.5');
  await app.fill('#modal-tx-date','2026-11-02');
  await app.selectOption('#modal-tx-compte','k2');
  await app.selectOption('#modal-tx-cat','c2');
  await app.fill('#modal-tx-note','TEST QA note');
  await app.click('#tc-btn-oui');
  await app.click('label.epingle-toggle');   // la case est masquée par le bouton « Épinglé »
  await expect(app.locator('#modal-tx-epingle')).not.toBeChecked();
  const saisie=await lireChamps(app);
  expect(saisie).toEqual({desc:'TEST QA Remboursement',montant:'42.5',date:'2026-11-02',compte:'k2',cat:'c2',
    note:'TEST QA note',tricount:'tc-btn-oui',epingle:false});

  await app.click('#btn-type-in');
  await verifierApparence(app,{titre:'+ Nouvelle entrée',type:'entrée'});
  expect(await lireChamps(app)).toEqual(saisie);

  await app.click('#btn-type-out');
  await verifierApparence(app,{titre:'− Nouvelle sortie',type:'sortie'});
  expect(await lireChamps(app)).toEqual(saisie);
});

test('une entrée et une sortie créées ainsi : bon type et montant positif',async({app,base})=>{
  await nouvelleOperation(app,'entrée');
  await app.fill('#modal-tx-desc','TEST QA Prime');
  await app.fill('#modal-tx-amount','150');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);

  await nouvelleOperation(app);
  await app.fill('#modal-tx-desc','TEST QA Cinéma');
  await app.fill('#modal-tx-amount','11.9');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);

  const corps=base.ecritures.map(e=>e.corps[0]);
  expect(base.ecritures.map(e=>e.methode)).toEqual(['POST','POST']);
  expect(corps).toMatchObject([{description:'TEST QA Prime',type:'entrée',montant:150},{description:'TEST QA Cinéma',type:'sortie',montant:11.9}]);
  for(const c of corps) expect(c.montant).toBeGreaterThan(0);
  // La liste montre l'entrée en + et la sortie en −
  await expect(app.locator('.tx-item',{hasText:'TEST QA Prime'})).toContainText('+');
  await expect(app.locator('.tx-item',{hasText:'TEST QA Cinéma'})).toContainText('-');
});

test('toutes les catégories sont proposées pour les deux types',async({app})=>{
  await nouvelleOperation(app);
  const attendu=['Sans catégorie','🛒 TEST QA Courses','🎮 TEST QA Loisirs','🔁 TEST QA Virement interne'];
  await expect(app.locator('#modal-tx-cat option')).toHaveText(attendu);
  await app.click('#btn-type-in');
  await expect(app.locator('#modal-tx-cat option')).toHaveText(attendu);
  await app.click('#btn-type-out');
  await expect(app.locator('#modal-tx-cat option')).toHaveText(attendu);
});

test('modifier une entrée existante : « + Modifier l\'entrée » en vert ; une sortie : « − Modifier la sortie » en rouge',async({app,base})=>{
  await app.locator('.tx-item',{hasText:'TEST QA Salaire'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await verifierApparence(app,{titre:'+ Modifier l\'entrée',type:'entrée'});
  await expect(app.locator('#modal-tx-amount')).toHaveValue('2000');
  await app.getByRole('button',{name:'Annuler'}).click();

  await app.locator('.tx-item',{hasText:'TEST QA Boulangerie'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await verifierApparence(app,{titre:'− Modifier la sortie',type:'sortie'});

  // Corriger le type en modification : le titre suit, l'enregistrement envoie le nouveau type.
  await app.click('#btn-type-in');
  await verifierApparence(app,{titre:'+ Modifier l\'entrée',type:'entrée'});
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  expect(base.ecritures).toHaveLength(1);
  expect(base.ecritures[0]).toMatchObject({methode:'PATCH',table:'transactions',filtres:{id:'t2'}});
  expect(base.ecritures[0].corps).toMatchObject({type:'entrée',montant:4.2});
});

test('la touche N ouvre la modale sur Sortie, même après une entrée',async({app})=>{
  await nouvelleOperation(app,'entrée');
  await verifierApparence(app,{titre:'+ Nouvelle entrée',type:'entrée'});
  await app.getByRole('button',{name:'Annuler'}).click();
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);

  await app.locator('body').press('n');
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await verifierApparence(app,{titre:'− Nouvelle sortie',type:'sortie'});
});

test('dupliquer une entrée : « + Nouvelle entrée » ; annuler une suppression garde l\'apparence',async({app})=>{
  await app.locator('.tx-item',{hasText:'TEST QA Salaire'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  // Le pied de la modale est reconstruit par la confirmation de suppression : le bouton doit rester vert.
  await app.click('#tx-modal-delete');
  await app.locator('#tx-modal-footer').getByRole('button',{name:'Annuler'}).click();
  await verifierApparence(app,{titre:'+ Modifier l\'entrée',type:'entrée'});

  await app.click('#tx-modal-dup');
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await verifierApparence(app,{titre:'+ Nouvelle entrée',type:'entrée'});
  await expect(app.locator('#modal-tx-desc')).toHaveValue('TEST QA Salaire');
});

test('erreur de la base à l\'enregistrement : modale ouverte, apparence et saisie conservées',async({app,base,journal})=>{
  journal.attendre(/saveTx/);
  journal.attendre(/status of 400/);
  base.forcerErreur('23514');
  await nouvelleOperation(app,'entrée');
  await app.fill('#modal-tx-desc','TEST QA Erreur');
  await app.fill('#modal-tx-amount','10');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal-error')).toBeVisible();
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await verifierApparence(app,{titre:'+ Nouvelle entrée',type:'entrée'});
  await expect(app.locator('#modal-tx-desc')).toHaveValue('TEST QA Erreur');
});

test('modale lisible sans défilement horizontal, sélecteur et bouton visibles',async({app})=>{
  await nouvelleOperation(app);
  await app.click('#btn-type-in');
  for(const sel of ['#btn-type-out','#btn-type-in','#tx-montant-signe','#modal-tx-amount','#tx-modal-save'])
    await expect(app.locator(sel)).toBeInViewport();
  const debord=await app.evaluate(()=>{
    const m=document.querySelector('#tx-modal .modal');
    return {page:document.documentElement.scrollWidth-document.documentElement.clientWidth,modale:m.scrollWidth-m.clientWidth};
  });
  expect(debord.page).toBeLessThanOrEqual(0);
  expect(debord.modale).toBeLessThanOrEqual(0);
});
