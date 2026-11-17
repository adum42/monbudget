// Parcours de bout en bout du ticket #10 (validation de l'étape 1), sans connexion.
// Fausse base en mémoire (outils.js), horloge figée au mercredi 04/11/2026 à 10 h (Paris).
//
// Scénario du ticket, entièrement par l'écran :
//   1. créer un compte courant (solde initial 1 000,00 € au 31/10) ;
//   2. saisir une dépense de 42,50 € sur ce compte (02/11) -> solde calculé 957,50 € ;
//   3. saisir un solde banque égal (957,50 € au 03/11) -> la carte passe au vert « ✓ rapproché » ;
//   4. saisir un virement interne de 100 € en deux opérations (sortie du nouveau compte, entrée sur
//      « TEST QA Livret ») dans la catégorie « Mouvement de compte » -> les deux soldes bougent,
//      le patrimoine ne bouge pas, les métriques du mois ne bougent pas, l'indicateur vaut 0 ;
//   5. filtre par compte et sous-total sur le nouveau compte.
// Départ (donneesInitiales) : Compte courant k1 = 2 345,80 € ; Livret k2 = 500,00 € ; patrimoine 2 845,80 €.
// Mêmes montants que tests/sql/cas/ticket10_etape1.sql et tests/front/ticket10_etape1.test.js.
const {test,expect,nouvelleOperation}=require('./outils');

const NOUVEAU='TEST QA Courant étape 1';
const LIVRET='TEST QA Livret';
const euros=v=>v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();
const carte=(page,nom)=>page.locator('.compte-card',{hasText:nom});

// Saisie d'une opération par la modale ; le compte est choisi par son nom (son id est attribué par la base).
async function operation(page,type,{desc,montant,date,compte,categorie}){
  await nouvelleOperation(page,type);
  await page.fill('#modal-tx-desc',desc);
  await page.fill('#modal-tx-amount',montant);
  await page.fill('#modal-tx-date',date);
  await page.selectOption('#modal-tx-compte',{label:compte});
  if(categorie) await page.selectOption('#modal-tx-cat',categorie);
  await page.click('#tx-modal-save');
  await expect(page.locator('#tx-modal')).not.toHaveClass(/open/);
}

// Aucun défilement horizontal (vérifié à 1280 et 390 px).
async function sansDefilementHorizontal(page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),
    'défilement horizontal').toBe(true);
}

test('étape 1 : compte courant, dépense, relevé égal (carte verte), virement en deux opérations (indicateur à 0)',async({app,base})=>{
  // ── 1. Créer un compte courant ───────────────────────────────────────────
  await onglet(app,'Comptes');
  await expect(app.locator('#patrimoine-total')).toHaveText(euros(2845.80));
  await app.getByRole('button',{name:'+ Nouveau compte'}).click();
  await expect(app.locator('#compte-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-c-nom')).toBeFocused();          // focus posé 100 ms après l'ouverture
  await expect(app.locator('#modal-c-type')).toHaveValue('courant'); // compte courant proposé par défaut
  await expect(app.locator('#modal-c-par-defaut')).not.toBeChecked(); // k1 reste le compte par défaut
  await app.fill('#modal-c-nom',NOUVEAU);
  await app.fill('#modal-c-solde-initial','1000');
  await app.fill('#modal-c-date-solde-initial','2026-10-31');
  await app.click('#compte-modal-save');
  await expect(app.locator('#compte-modal')).not.toHaveClass(/open/);

  const compteCree=base.tables.comptes.find(c=>c.nom===NOUVEAU);
  expect(compteCree,'compte enregistré en base').toBeTruthy();
  expect([compteCree.type,compteCree.solde_initial,compteCree.date_solde_initial,compteCree.par_defaut])
    .toEqual(['courant',1000,'2026-10-31',false]);
  await expect(carte(app,NOUVEAU).locator('.compte-solde-actuel')).toHaveText(euros(1000));
  await expect(carte(app,NOUVEAU).locator('.compte-voyant')).toHaveText('Aucun relevé');
  await expect(app.locator('#patrimoine-total')).toHaveText(euros(3845.80));

  // ── 2. Saisir une dépense ────────────────────────────────────────────────
  await onglet(app,'Transactions');
  await operation(app,'sortie',{desc:'TEST QA Dépense étape 1',montant:'42.50',date:'2026-11-02',compte:NOUVEAU,categorie:'c1'});
  await onglet(app,'Comptes');
  await expect(carte(app,NOUVEAU).locator('.compte-solde-actuel')).toHaveText(euros(957.50));

  // ── 3. Saisir un solde banque égal : la carte passe au vert ───────────────
  await carte(app,NOUVEAU).getByRole('button',{name:'📊 Saisir un solde'}).click();
  await expect(app.locator('#solde-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-solde-montant')).toBeFocused();
  await app.fill('#modal-solde-montant','957.50');
  await app.fill('#modal-solde-date','2026-11-03');
  await app.click('#solde-modal-save');
  await expect(app.locator('#solde-modal-error')).toBeHidden();
  await app.click('#solde-modal .modal-footer .btn-cancel');
  await expect(app.locator('#solde-modal')).not.toHaveClass(/open/);

  const voyant=carte(app,NOUVEAU).locator('.compte-voyant');
  await expect(voyant).toHaveText('✓ rapproché');
  await expect(voyant).toHaveClass(/badge-ok/);
  await expect(carte(app,NOUVEAU).locator('.compte-detail')).toContainText('0,00 €');   // écart
  const patrimoineAvant=3845.80-42.50;
  await expect(app.locator('#patrimoine-total')).toHaveText(euros(patrimoineAvant));

  // ── 4. Virement interne en deux opérations ───────────────────────────────
  await onglet(app,'Transactions');
  const metriquesAvant=await app.locator('#metrics').innerText();
  await operation(app,'sortie',{desc:'TEST QA Virement étape 1',montant:'100',date:'2026-11-04',compte:NOUVEAU,categorie:'cv'});
  // À moitié saisi : l'indicateur le signale en rouge.
  await expect(app.locator('#mvt-compte-indicateur')).toHaveText('✗ Mouvements de compte : −100,00 €');
  await operation(app,'entrée',{desc:'TEST QA Virement étape 1',montant:'100',date:'2026-11-04',compte:LIVRET,categorie:'cv'});

  // L'indicateur vaut 0 (badge vert) et les métriques du mois n'ont pas bougé (virement exclu, #69).
  await expect(app.locator('#mvt-compte-indicateur')).toHaveText('✓ Mouvements de compte : 0,00 €');
  await expect(app.locator('#mvt-compte-indicateur .badge')).toHaveClass(/badge-ok/);
  expect(await app.locator('#metrics').innerText()).toBe(metriquesAvant);
  await expect(app.locator('.tx-item',{hasText:'TEST QA Virement étape 1'})).toHaveCount(2);   // visibles dans la liste
  await sansDefilementHorizontal(app);

  // Les deux soldes bougent ; le patrimoine ne bouge pas ; la carte reste verte (virement après le relevé).
  await onglet(app,'Comptes');
  await expect(carte(app,NOUVEAU).locator('.compte-solde-actuel')).toHaveText(euros(857.50));
  await expect(carte(app,LIVRET).locator('.compte-solde-actuel')).toHaveText(euros(600));
  await expect(app.locator('#patrimoine-total')).toHaveText(euros(patrimoineAvant));
  await expect(voyant).toHaveText('✓ rapproché');
  await expect(carte(app,NOUVEAU).locator('.compte-depuis-releve')).toContainText('Depuis le relevé (1 opération)');
  await expect(carte(app,NOUVEAU).locator('.compte-depuis-releve')).toContainText('-100,00 €');
  await expect(carte(app,NOUVEAU).locator('.compte-solde-date')).toHaveText('Solde attendu en banque');
  await sansDefilementHorizontal(app);

  // ── 5. Filtre par compte et sous-total ────────────────────────────────────
  await onglet(app,'Transactions');
  await app.selectOption('#f-compte',{label:NOUVEAU});
  await expect(app.locator('.tx-item')).toHaveCount(2);                      // dépense + sortie du virement
  await expect(app.locator('#tx-sous-total .st-nb')).toHaveText('2 opérations');
  await expect(app.locator('#tx-sous-total .st-montant.red')).toHaveText('−42,50 €');   // virement exclu des montants
  await expect(app.locator('#tx-sous-total .st-montant.green')).toHaveText('+0,00 €');
  await expect(app.locator('#mvt-compte-indicateur')).toHaveText('✓ Mouvements de compte : 0,00 €');   // ignore le filtre
  expect(await app.locator('#metrics').innerText()).toBe(metriquesAvant);                       // ignore le filtre
  await sansDefilementHorizontal(app);
});
