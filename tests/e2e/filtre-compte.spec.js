// Filtre par compte et ligne de sous-total des transactions affichées (#72), sans connexion : Supabase simulé.
// Fausse base (outils.js), horloge au 04/11/2026 (mois affiché : novembre) : compte courant k1 (« TEST QA Salaire »
// +2 000, « TEST QA Boulangerie » −4,20, catégorie c1, épinglée), livret k2, « TEST QA Loyer octobre » −650 hors du mois.
// On ajoute une sortie sur le livret et un virement interne (catégorie cochée cv) du courant vers le livret.
const {test,expect,UTILISATEUR,nouvelleOperation}=require('./outils');

const lignes=page=>page.locator('#tx-list .tx-item');
const sousTotal=page=>page.locator('#tx-sous-total');
const metrics=page=>page.locator('#metrics');
const indicateur=page=>page.locator('#mvt-compte-indicateur .badge');
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();
const tx=(id,desc,m={})=>({id,user_id:UTILISATEUR.id,description:desc,montant:10,type:'sortie',categorie_id:null,
  date:'2026-11-02',tricount:'non',epingle:false,note:null,compte_id:'k1',...m});
// Espaces insécables du format fr-FR ramenées à des espaces simples
const texteSousTotal=async page=>(await sousTotal(page).innerText()).replace(/[  ]/g,' ').replace(/\s+/g,' ').trim();

async function ajouterJeu(page,base){
  base.tables.transactions.push(
    tx('t72a','TEST QA Cinéma',{compte_id:'k2',montant:30,categorie_id:'c2'}),
    tx('t72b','TEST QA Virement vers livret',{compte_id:'k1',montant:100,categorie_id:'cv'}),
    tx('t72c','TEST QA Virement depuis courant',{compte_id:'k2',montant:100,categorie_id:'cv',type:'entrée'}),
  );
  await page.reload();
  await expect(lignes(page)).toHaveCount(5);
}

test('la liste f-compte propose « Tous les comptes » puis les comptes, dans l\'ordre de la modale',async({app})=>{
  const options=await app.$$eval('#f-compte option',os=>os.map(o=>o.textContent));
  expect(options).toEqual(['Tous les comptes','TEST QA Compte courant','TEST QA Livret']);
  await expect(app.locator('#f-compte')).toHaveValue('all');
  // La liste de la modale n'est remplie qu'à l'ouverture
  await nouvelleOperation(app,'sortie');
  const modale=await app.$$eval('#modal-tx-compte option',os=>os.filter(o=>o.value).map(o=>o.textContent));
  expect(options.slice(1)).toEqual(modale);
});

test('choisir un compte n\'affiche que ses transactions ; « Tous les comptes » les affiche toutes',async({app,base})=>{
  await ajouterJeu(app,base);
  await app.selectOption('#f-compte','k2');
  await expect(lignes(app)).toHaveCount(2);
  for(const t of ['TEST QA Cinéma','TEST QA Virement depuis courant']) await expect(lignes(app).filter({hasText:t})).toHaveCount(1);
  await app.selectOption('#f-compte','all');
  await expect(lignes(app)).toHaveCount(5);
});

test('sous-total : sans filtre, « Mouvement de compte » comptée dans N mais pas dans les montants',async({app,base})=>{
  await ajouterJeu(app,base);
  await expect(sousTotal(app)).toBeVisible();
  // Entrées en vert, sorties en rouge
  const couleur=sel=>app.locator('#tx-sous-total '+sel).evaluate(el=>getComputedStyle(el).color);
  const [vert,rouge]=await app.evaluate(()=>{const s=getComputedStyle(document.documentElement);return [s.getPropertyValue('--green').trim(),s.getPropertyValue('--red').trim()];});
  expect(await couleur('.st-montant.green')).not.toBe(await couleur('.st-nb'));
  expect(await couleur('.st-montant.red')).not.toBe(await couleur('.st-nb'));
  expect(vert&&rouge).toBeTruthy();
  // 5 lignes ; entrées : salaire 2 000 ; sorties : boulangerie 4,20 + cinéma 30 (le virement est exclu)
  expect(await texteSousTotal(app)).toBe('5 opérations · +2 000,00 € · −34,20 €');
  // Avec le filtre catégorie sur « Mouvement de compte », ses montants comptent
  await app.selectOption('#f-cat','cv');
  await expect(lignes(app)).toHaveCount(2);
  expect(await texteSousTotal(app)).toBe('2 opérations · +100,00 € · −100,00 €');
});

test('le filtre compte se combine avec type, catégorie, recherche et « Tout voir » ; le sous-total suit',async({app,base})=>{
  await ajouterJeu(app,base);
  await app.selectOption('#f-compte','k1');
  expect(await texteSousTotal(app)).toBe('3 opérations · +2 000,00 € · −4,20 €');
  await app.selectOption('#f-type','sortie');
  await expect(lignes(app)).toHaveCount(2);
  expect(await texteSousTotal(app)).toBe('2 opérations · +0,00 € · −4,20 €');
  await app.selectOption('#f-cat','c1');
  await expect(lignes(app)).toHaveCount(1);
  expect(await texteSousTotal(app)).toBe('1 opération · +0,00 € · −4,20 €');
  // « Tout voir » : le loyer d'octobre (k1, sortie, sans catégorie) n'est pas en c1
  await app.click('#btn-view-all');
  await expect(lignes(app)).toHaveCount(1);
  await app.selectOption('#f-cat','all');
  await expect(lignes(app)).toHaveCount(3);
  expect(await texteSousTotal(app)).toBe('3 opérations · +0,00 € · −654,20 €');
  // Recherche
  await app.fill('#tx-search','loyer');
  await expect(lignes(app)).toHaveCount(1);
  expect(await texteSousTotal(app)).toBe('1 opération · +0,00 € · −650,00 €');
  // Le tri ne change pas le sous-total
  await app.fill('#tx-search','');
  const avant=await texteSousTotal(app);
  await app.selectOption('#f-sort','montant-asc');
  expect(await texteSousTotal(app)).toBe(avant);
});

test('aucune transaction affichée : sous-total masqué',async({app,base})=>{
  await ajouterJeu(app,base);
  await app.selectOption('#f-compte','k2');
  await app.selectOption('#f-type','sortie');
  await app.selectOption('#f-cat','cv');
  await expect(lignes(app)).toHaveCount(0);
  await expect(sousTotal(app)).toBeHidden();
  await app.selectOption('#f-cat','all');
  await expect(sousTotal(app)).toBeVisible();
});

test('barre Entrées / Sorties / Solde du mois et indicateur « Mouvements de compte » inchangés par les filtres',async({app,base})=>{
  await ajouterJeu(app,base);
  const metricsAvant=await metrics(app).innerText();
  const indicateurAvant=await indicateur(app).innerText();
  await app.selectOption('#f-compte','k2');
  await app.selectOption('#f-type','entrée');
  await app.fill('#tx-search','virement');
  await expect(lignes(app)).toHaveCount(1);
  expect(await metrics(app).innerText()).toBe(metricsAvant);
  expect(await indicateur(app).innerText()).toBe(indicateurAvant);
  for(const nom of ['Statistiques','Comptes','Transactions']){
    await onglet(app,nom);
    expect(await metrics(app).innerText()).toBe(metricsAvant);
  }
});

test('sous-total mis à jour après une création, sans recharger la page',async({app})=>{
  await app.selectOption('#f-compte','k1');
  expect(await texteSousTotal(app)).toBe('2 opérations · +2 000,00 € · −4,20 €');
  await nouvelleOperation(app,'sortie');
  await app.fill('#modal-tx-desc','TEST QA Pharmacie');
  await app.fill('#modal-tx-amount','12.5');
  await app.selectOption('#modal-tx-compte','k1');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await expect(lignes(app)).toHaveCount(3);
  expect(await texteSousTotal(app)).toBe('3 opérations · +2 000,00 € · −16,70 €');
  await expect(app.locator('#f-compte')).toHaveValue('k1');   // le filtre survit au rechargement des comptes
});

test('nom de compte avec apostrophe et « < » affiché tel quel ; compte disparu -> « Tous les comptes »',async({app,base})=>{
  base.tables.comptes.push({id:'k3',user_id:UTILISATEUR.id,nom:'TEST QA L\'épargne <b>x</b>',type:'livret',par_defaut:false,
    couleur:'#F59E0B',solde_initial:0,date_solde_initial:'2026-09-30',plafond:null});
  base.tables.transactions.push(tx('t72d','TEST QA Dépôt',{compte_id:'k3',type:'entrée',montant:50}));
  await app.reload();
  const opt=app.locator('#f-compte option[value="k3"]');
  await expect(opt).toHaveText('TEST QA L\'épargne <b>x</b>');
  await expect(app.locator('#f-compte b')).toHaveCount(0);
  await app.selectOption('#f-compte','k3');
  await expect(lignes(app)).toHaveCount(1);
  // Le compte disparaît (autre onglet, autre appareil) : au rechargement des comptes, retour à « Tous les comptes »
  base.tables.transactions.splice(base.tables.transactions.findIndex(t=>t.id==='t72d'),1);
  base.tables.comptes.splice(base.tables.comptes.findIndex(c=>c.id==='k3'),1);
  await app.evaluate(()=>rechargerComptes());
  await expect(app.locator('#f-compte')).toHaveValue('all');
  await expect(app.locator('#f-compte option')).toHaveCount(3);
  // Toutes les opérations du mois chargées sont de nouveau affichées (le dépôt reste en mémoire jusqu'au prochain chargement)
  await expect(lignes(app)).toHaveCount(3);
});

test('barre de filtres et sous-total lisibles, sans défilement horizontal',async({app,base})=>{
  await ajouterJeu(app,base);
  await app.selectOption('#f-compte','k1');
  await expect(app.locator('#f-compte')).toBeVisible();
  await expect(sousTotal(app)).toBeVisible();
  const deborde=await app.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(deborde).toBe(false);
  const st=await sousTotal(app).boundingBox();
  const vw=app.viewportSize().width;
  expect(st.x).toBeGreaterThanOrEqual(0);
  expect(st.x+st.width).toBeLessThanOrEqual(vw);
});
