// Soldes des comptes après une écriture sur une transaction (#66), sans connexion.
// La fausse base recalcule la vue v_soldes_comptes à chaque lecture (vueSoldesComptes dans outils.js).
// Départ (donneesInitiales) : Compte courant k1 = 1 000 + 2 000 − 4,20 − 650 = 2 345,80 € ;
// Livret k2 = 500,00 € ; patrimoine total = 2 845,80 €.
// Aucun rechargement de page dans ces parcours : c'est justement ce que le ticket corrige.
const {test,expect}=require('./outils');

const COURANT='TEST QA Compte courant';
const LIVRET='TEST QA Livret';
const euros=v=>v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';

const solde=(page,nom)=>page.locator('.compte-card',{hasText:nom}).locator('.compte-solde-actuel');
const patrimoine=page=>page.locator('#patrimoine-total');
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();

async function verifierSoldes(page,courant,livret){
  await onglet(page,'Comptes');
  await expect(solde(page,COURANT)).toHaveText(euros(courant));
  await expect(solde(page,LIVRET)).toHaveText(euros(livret));
  await expect(patrimoine(page)).toHaveText(euros(courant+livret));
  await onglet(page,'Transactions');
}

// Le focus automatique de la description arrive 100 ms après l'ouverture : on l'attend avant de remplir.
async function attendreModale(page){
  await expect(page.locator('#tx-modal')).toHaveClass(/open/);
  await expect(page.locator('#modal-tx-desc')).toBeFocused();
}
async function nouvelle(page,bouton,{desc,montant,compte,depuis,vers}){
  await page.getByRole('button',{name:bouton}).click();
  await attendreModale(page);
  await page.fill('#modal-tx-desc',desc);
  await page.fill('#modal-tx-amount',String(montant));
  if(compte) await page.selectOption('#modal-tx-compte',compte);
  if(depuis) await page.selectOption('#modal-tx-depuis',depuis);
  if(vers) await page.selectOption('#modal-tx-vers',vers);
  await page.click('#tx-modal-save');
  await expect(page.locator('#tx-modal')).not.toHaveClass(/open/);
}
async function ouvrirExistante(page,desc){
  await page.locator('.tx-item',{hasText:desc}).click();
  await expect(page.locator('#tx-modal-title')).toHaveText('Modifier la transaction');
  await attendreModale(page);
}

test.beforeEach(async({app})=>{
  await verifierSoldes(app,2345.80,500);
});

test('entrée : le solde du compte augmente du montant, sans rechargement',async({app})=>{
  await nouvelle(app,'+ Entrée d\'argent',{desc:'TEST QA Remboursement',montant:'120.35',compte:'k2'});
  await verifierSoldes(app,2345.80,620.35);
});

test('sortie : le solde du compte diminue',async({app})=>{
  await nouvelle(app,'− Sortie d\'argent',{desc:'TEST QA Pharmacie',montant:'12.5',compte:'k1'});
  await verifierSoldes(app,2333.30,500);
});

test('mouvement : la source diminue, la destination augmente, le patrimoine ne bouge pas',async({app})=>{
  await nouvelle(app,'⇄ Mouvement entre comptes',{desc:'TEST QA Virement livret',montant:'300',depuis:'k1',vers:'k2'});
  await verifierSoldes(app,2045.80,800);
});

test('modification du montant et du compte : les deux comptes sont recalculés',async({app})=>{
  await ouvrirExistante(app,'TEST QA Boulangerie');              // sortie de 4,20 € sur le compte courant
  await app.fill('#modal-tx-amount','10');
  await app.selectOption('#modal-tx-compte','k2');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await verifierSoldes(app,2350,490);
});

test('duplication : la copie est prise en compte dans le solde',async({app})=>{
  await ouvrirExistante(app,'TEST QA Boulangerie');
  await app.click('#tx-modal-dup');
  await attendreModale(app);
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await verifierSoldes(app,2341.60,500);
});

test('suppression : le solde revient à sa valeur précédente',async({app})=>{
  await nouvelle(app,'− Sortie d\'argent',{desc:'TEST QA À supprimer',montant:'75',compte:'k1'});
  await verifierSoldes(app,2270.80,500);

  await ouvrirExistante(app,'TEST QA À supprimer');
  await app.click('#tx-modal-delete');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await expect(app.locator('.tx-item',{hasText:'TEST QA À supprimer'})).toHaveCount(0);
  await verifierSoldes(app,2345.80,500);
});

test('erreur de chargement des comptes : message sur l\'onglet Comptes, liste des transactions à jour',async({app,base,journal})=>{
  journal.attendre(/loadComptes/);
  journal.attendre(/status of 400/);
  base.forcerErreurLecture('v_soldes_comptes','42501');
  await nouvelle(app,'− Sortie d\'argent',{desc:'TEST QA Malgré l\'erreur',montant:'9',compte:'k1'});

  // La transaction est enregistrée et la liste est redessinée malgré l'échec des comptes.
  await expect(app.locator('.tx-item',{hasText:'TEST QA Malgré l\'erreur'})).toBeVisible();
  expect(base.tables.transactions.some(t=>t.description==='TEST QA Malgré l\'erreur')).toBe(true);

  await onglet(app,'Comptes');
  await expect(app.locator('#comptes-cards .modal-error')).toContainText('Chargement des comptes impossible');
  await expect(app.locator('#comptes-cards .modal-error')).toContainText('42501');
  await expect(patrimoine(app)).toHaveText('— €');

  // La lecture suivante réussit : les soldes reflètent l'opération.
  base.forcerErreurLecture('v_soldes_comptes',null);
  await onglet(app,'Transactions');
  await nouvelle(app,'− Sortie d\'argent',{desc:'TEST QA Après l\'erreur',montant:'1',compte:'k1'});
  await verifierSoldes(app,2335.80,500);
});
