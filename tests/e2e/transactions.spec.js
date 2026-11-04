// Parcours clés sur les transactions, sans connexion (#9) : Supabase simulé en mémoire.
// Chaque test repart d'une fausse base neuve (voir donneesInitiales dans outils.js).
const {test,expect}=require('./outils');

// Ouvre la modale « Sortie d'argent » et attend le focus automatique sur la description,
// posé 100 ms après l'ouverture : remplir avant ferait perdre la saisie (piège vu sur #8).
async function ouvrirNouvelleSortie(page){
  await page.getByRole('button',{name:'− Sortie d\'argent'}).click();
  await expect(page.locator('#tx-modal')).toHaveClass(/open/);
  await expect(page.locator('#modal-tx-desc')).toBeFocused();
}

test('créer puis supprimer une transaction',async({app,base})=>{
  // 1. Création
  await ouvrirNouvelleSortie(app);
  await expect(app.locator('#modal-tx-date')).toHaveValue('2026-11-04');     // date du jour (heure figée)
  await expect(app.locator('#modal-tx-compte')).toHaveValue('k1');           // compte par défaut
  await app.fill('#modal-tx-desc','TEST QA Pharmacie');
  await app.fill('#modal-tx-amount','12.5');
  await app.click('#tx-modal-save');

  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  const ligne=app.locator('.tx-item',{hasText:'TEST QA Pharmacie'});
  await expect(ligne).toBeVisible();
  // Ce que l'app a réellement envoyé à la base :
  expect(base.ecritures).toHaveLength(1);
  expect(base.ecritures[0]).toMatchObject({methode:'POST',table:'transactions'});
  expect(base.ecritures[0].corps[0]).toMatchObject({
    description:'TEST QA Pharmacie',montant:12.5,type:'sortie',date:'2026-11-04',
    compte_id:'k1',compte_dest_id:null,user_id:'00000000-0000-4000-8000-0000000000a1',
  });

  // 2. Suppression en deux temps : « Supprimer » puis « Confirmer la suppression »
  await ligne.click();
  await expect(app.locator('#tx-modal-title')).toHaveText('Modifier la transaction');
  await app.click('#tx-modal-delete');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();

  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await expect(ligne).toHaveCount(0);
  expect(base.ecritures[1]).toMatchObject({methode:'DELETE',table:'transactions'});
  expect(base.tables.transactions.some(t=>t.description==='TEST QA Pharmacie')).toBe(false);
});

test('changer de mois',async({app})=>{
  const libelle=app.locator('#month-label');
  await expect(libelle).toHaveText('novembre 2026');

  await app.click('#btn-prev-month');
  await expect(libelle).toHaveText('octobre 2026');
  await expect(app.locator('.tx-item',{hasText:'TEST QA Loyer octobre'})).toBeVisible();
  await expect(app.locator('.tx-item',{hasText:'TEST QA Salaire'})).toHaveCount(0);

  await app.click('#btn-next-month');
  await app.click('#btn-next-month');
  await expect(libelle).toHaveText('décembre 2026');
  await expect(app.locator('.tx-item')).toHaveCount(0);

  await app.click('#btn-prev-month');
  await expect(libelle).toHaveText('novembre 2026');
  await expect(app.locator('.tx-item',{hasText:'TEST QA Salaire'})).toBeVisible();
});

test('une erreur de la base reste affichée dans la modale',async({app,base,journal})=>{
  // L'app écrit l'erreur dans la console (console.error) : on la déclare attendue.
  journal.attendre(/saveTx/);
  journal.attendre(/status of 400/);
  base.forcerErreur('23514');

  await ouvrirNouvelleSortie(app);
  await app.fill('#modal-tx-desc','TEST QA Erreur');
  await app.fill('#modal-tx-amount','5');
  await app.click('#tx-modal-save');

  await expect(app.locator('#tx-modal-error')).toBeVisible();
  await expect(app.locator('#tx-modal-error')).toContainText('erreur 23514');
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);      // la saisie n'est pas perdue
  await expect(app.locator('#modal-tx-desc')).toHaveValue('TEST QA Erreur');
});
