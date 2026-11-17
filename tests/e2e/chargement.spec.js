// Chargement des données après la connexion (#58), sans connexion : Supabase simulé en mémoire.
// Tant que le premier loadAll() n'est pas terminé, aucune fenêtre de saisie ne s'ouvre :
// « + Nouvelle opération » (#73), « + Nouveau compte », « + Nouvelle catégorie »
// sont inactifs et la touche N ne fait rien. Ils redeviennent utilisables à la fin, même en cas d'erreur.
//
// Les lectures de la fausse base sont retenues (lecturesRetenues) jusqu'à base.libererLectures() :
// la « base lente » est simulée sans aucun délai, le test est déterministe (pas de setTimeout).
const {test,expect}=require('./outils');

test.use({lecturesRetenues:true});

const TITRE='Chargement des données en cours…';
const BOUTONS_TX=['+ Nouvelle opération'];

// Attend que l'app ait réellement lancé ses lectures (elles sont suspendues dans la fausse base).
async function attendreChargementEnCours(base){
  await expect.poll(()=>base.lecturesEnAttente,{message:'aucune lecture en attente : loadAll() non lancé'}).toBeGreaterThan(0);
}

test('pendant le chargement : boutons de saisie inactifs, N sans effet, aucune fenêtre ouverte',async({app,base})=>{
  await attendreChargementEnCours(base);

  for(const nom of BOUTONS_TX){
    const b=app.getByRole('button',{name:nom});
    await expect(b).toBeDisabled();
    await expect(b).toHaveAttribute('title',TITRE);
  }
  await app.locator('body').press('n');
  await app.locator('body').press('N');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);

  await app.getByRole('button',{name:'Comptes',exact:true}).click();
  await expect(app.getByRole('button',{name:'+ Nouveau compte'})).toBeDisabled();
  await expect(app.locator('[data-solde-compte-id]')).toHaveCount(0);   // « Saisir un solde » n'existe pas encore
  await app.getByRole('button',{name:'Catégories',exact:true}).click();
  await expect(app.getByRole('button',{name:'+ Nouvelle catégorie'})).toBeDisabled();
  await expect(app.locator('.modal-overlay.open')).toHaveCount(0);

  // Fin du chargement : tout redevient utilisable.
  base.libererLectures();
  await expect(app.getByRole('button',{name:'+ Nouvelle catégorie'})).toBeEnabled();
  await expect(app.getByRole('button',{name:'+ Nouvelle catégorie'})).not.toHaveAttribute('title',/./);
  await app.getByRole('button',{name:'Comptes',exact:true}).click();
  await expect(app.getByRole('button',{name:'+ Nouveau compte'})).toBeEnabled();
  await app.getByRole('button',{name:'Transactions',exact:true}).click();
  for(const nom of BOUTONS_TX) await expect(app.getByRole('button',{name:nom})).toBeEnabled();
});

test('après le chargement : « + Nouvelle opération » propose le compte par défaut',async({app,base})=>{
  await attendreChargementEnCours(base);
  base.libererLectures();
  await expect(app.locator('#tx-list')).toContainText('TEST QA Boulangerie');

  await app.getByRole('button',{name:'+ Nouvelle opération'}).click();
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-tx-compte')).toHaveValue('k1');
  await expect(app.locator('#modal-tx-compte option')).toHaveText(['Choisir un compte…','TEST QA Compte courant','TEST QA Livret']);
});

test('après le chargement : la touche N ouvre une sortie avec le compte par défaut',async({app,base})=>{
  await attendreChargementEnCours(base);
  base.libererLectures();
  await expect(app.getByRole('button',{name:'+ Nouvelle opération'})).toBeEnabled();

  await app.locator('body').press('n');
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-tx-compte')).toHaveValue('k1');
});

test('chargement en erreur : l\'erreur s\'affiche et les boutons redeviennent utilisables',async({app,base,journal})=>{
  journal.attendre(/loadTransactions/);
  journal.attendre(/400/);   // « Failed to load resource » du navigateur pour la réponse en erreur
  base.forcerErreurLecture('transactions','42501');
  await attendreChargementEnCours(base);
  await expect(app.getByRole('button',{name:'+ Nouvelle opération'})).toBeDisabled();

  base.libererLectures();
  await expect(app.locator('#tx-list')).toContainText('Chargement des transactions impossible');
  await expect(app.getByRole('button',{name:'+ Nouvelle opération'})).toBeEnabled();
  await app.getByRole('button',{name:'+ Nouvelle opération'}).click();
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-tx-compte')).toHaveValue('k1');   // les comptes, eux, sont chargés
});
