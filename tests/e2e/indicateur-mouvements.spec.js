// Indicateur « Mouvements de compte » en tête de la liste des transactions (#70), sans connexion.
// Fausse base (outils.js) : « TEST QA Virement interne » (cv) est cochée « Mouvement de compte »,
// aucune opération dans cette catégorie au départ ; horloge figée au 04/11/2026 (mois affiché : novembre).
const {test,expect,nouvelleOperation}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const MOINS='−';
const VERT='✓ Mouvements de compte : 0,00 €';
const rouge=txt=>'✗ Mouvements de compte : '+txt;
const indicateur=page=>page.locator('#mvt-compte-indicateur .badge');
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();

async function verifierBadge(page,texte,couleur){
  await expect(indicateur(page)).toHaveText(texte);
  await expect(indicateur(page)).toHaveClass(couleur==='vert'?/badge-ok/:/badge-ko/);
}
async function saisir(page,type,description,montant,compte){
  await nouvelleOperation(page,type);
  await page.fill('#modal-tx-desc',description);
  await page.fill('#modal-tx-amount',montant);
  await page.selectOption('#modal-tx-compte',compte);
  await page.selectOption('#modal-tx-cat','cv');
  await page.click('#tx-modal-save');
  await expect(page.locator('#tx-modal')).not.toHaveClass(/open/);
}
const ligneVirement=(id,type,date,compte_id,montant=100)=>({id,user_id:ID_USER,description:'TEST QA Virement '+id,montant,type,
  categorie_id:'cv',date,tricount:'non',epingle:false,note:null,compte_id});

test('départ : catégorie cochée sans opération, badge vert en tête de la liste',async({app})=>{
  await verifierBadge(app,VERT,'vert');
  // En tête de la carte Historique, avant la recherche et la liste
  const ordre=await app.evaluate(()=>{
    const i=document.getElementById('mvt-compte-indicateur'),l=document.getElementById('tx-list'),r=document.getElementById('tx-search');
    return [!!(i.compareDocumentPosition(r)&Node.DOCUMENT_POSITION_FOLLOWING),!!(i.compareDocumentPosition(l)&Node.DOCUMENT_POSITION_FOLLOWING)];
  });
  expect(ordre).toEqual([true,true]);
});

test('création, modification et suppression : le badge suit sans recharger la page',async({app})=>{
  // Seulement la sortie : rouge à −100,00 €
  await saisir(app,'sortie','TEST QA Virement vers livret','100','k1');
  await verifierBadge(app,rouge(MOINS+'100,00 €'),'rouge');
  // L'entrée de 100 € sur le livret : vert à 0,00 €
  await saisir(app,'entrée','TEST QA Virement reçu livret','100','k2');
  await verifierBadge(app,VERT,'vert');
  // Modification du montant de l'entrée : 90 € -> rouge à −10,00 €
  await app.locator('.tx-item',{hasText:'TEST QA Virement reçu livret'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await app.fill('#modal-tx-amount','90');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await verifierBadge(app,rouge(MOINS+'10,00 €'),'rouge');
  // Suppression de l'entrée : rouge à −100,00 €
  await app.locator('.tx-item',{hasText:'TEST QA Virement reçu livret'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await app.click('#tx-modal-delete');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await verifierBadge(app,rouge(MOINS+'100,00 €'),'rouge');
  // Les opérations normales (Boulangerie, Salaire) n'entrent pas dans le calcul : la sortie seule donne −100
});

test('virement parti le 31/10 et arrivé le 02/11 : rouge sur chaque mois, vert en « Tout voir »',async({app,base})=>{
  base.tables.transactions.push(ligneVirement('a','sortie','2026-10-31','k1'),ligneVirement('b','entrée','2026-11-02','k2'));
  await app.reload();
  await expect(app.locator('#app-screen')).toBeVisible();
  await verifierBadge(app,rouge('+100,00 €'),'rouge');                     // novembre : l'entrée seule
  await app.click('#btn-prev-month');
  await verifierBadge(app,rouge(MOINS+'100,00 €'),'rouge');                // octobre : la sortie seule
  await app.click('#btn-view-all');
  await verifierBadge(app,VERT,'vert');                                     // tout l'historique
  await app.click('#btn-view-all');                                         // retour au mois affiché
  await verifierBadge(app,rouge(MOINS+'100,00 €'),'rouge');
});

test('le badge ignore les filtres et la recherche de la liste',async({app,base})=>{
  base.tables.transactions.push(ligneVirement('a','sortie','2026-11-02','k1',30));
  await app.reload();
  await expect(app.locator('#app-screen')).toBeVisible();
  await verifierBadge(app,rouge(MOINS+'30,00 €'),'rouge');
  await app.selectOption('#f-type','entrée');
  await app.selectOption('#f-cat','c1');
  await app.fill('#tx-search','Boulangerie');
  await expect(app.locator('.empty')).toBeVisible();
  await verifierBadge(app,rouge(MOINS+'30,00 €'),'rouge');
});

test('aucune catégorie cochée : badge masqué ; la cocher l\'affiche sans recharger',async({app,base})=>{
  base.tables.categories.find(c=>c.id==='cv').mouvement_compte=false;
  base.tables.transactions.push(ligneVirement('a','sortie','2026-11-02','k1',30));
  await app.reload();
  await expect(app.locator('#app-screen')).toBeVisible();
  await expect(app.locator('.tx-item',{hasText:'TEST QA Virement a'})).toBeVisible();
  await expect(app.locator('#mvt-compte-indicateur')).toBeHidden();
  await expect(indicateur(app)).toHaveCount(0);
  // Cocher « Mouvement de compte » sur Virement interne : le badge apparaît
  await onglet(app,'Catégories');
  await app.locator('.cat-item',{hasText:'TEST QA Virement interne'}).locator('.btn-edit').click();
  await app.locator('label[for="modal-cat-mvt"]').click();
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  await onglet(app,'Transactions');
  await verifierBadge(app,rouge(MOINS+'30,00 €'),'rouge');
});

test('absent de l\'onglet Statistiques et des autres onglets',async({app})=>{
  await verifierBadge(app,VERT,'vert');
  for(const nom of ['Statistiques','Comptes','Catégories']){
    await onglet(app,nom);
    await expect(app.locator('#mvt-compte-indicateur')).toBeHidden();
    await expect(app.getByText('Mouvements de compte :').filter({visible:true})).toHaveCount(0);
  }
  await onglet(app,'Transactions');
  await expect(indicateur(app)).toBeVisible();
});

test('lisible sans défilement horizontal (1280 et 390 px)',async({app,base})=>{
  base.tables.transactions.push(ligneVirement('a','sortie','2026-11-02','k1',123456.78));
  await app.reload();
  await expect(app.locator('#app-screen')).toBeVisible();
  const attendu=(123456.78).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  await verifierBadge(app,rouge(MOINS+attendu+' €'),'rouge');
  const largeur=app.viewportSize().width;
  const boite=await indicateur(app).boundingBox();
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x+boite.width).toBeLessThanOrEqual(largeur);
  expect(await indicateur(app).evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  const debord=await app.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});
