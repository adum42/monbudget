// Carte compte : opérations saisies depuis le relevé et « Solde attendu en banque » (#82), sans connexion.
// Fausse base (outils.js) : le compte courant k1 a déjà un salaire (01/11), une boulangerie (03/11)
// et un loyer (05/10). On lui ajoute un relevé du 03/11 égal au solde calculé ce jour-là :
// 1 000 + 2 000 − 4,20 − 650 = 2 345,80 €. La boulangerie du 03/11 est donc « le jour même du relevé ».
// Horloge figée au 04/11/2026 : une opération du 04/11 est postérieure au relevé.
const {test,expect}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const COURANT='TEST QA Compte courant';
const LIVRET='TEST QA Livret';

const carte=(page,nom)=>page.locator('.compte-card',{hasText:nom});
const ligneDepuis=(page,nom)=>carte(page,nom).locator('.compte-depuis-releve');
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();

async function demarrer(page,base,{releve=2345.80,transactions=[]}={}){
  base.tables.soldes.push({id:'s1',user_id:ID_USER,compte_id:'k1',date:'2026-11-03',montant:releve,note:null});
  base.tables.transactions.push(...transactions);
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
  await onglet(page,'Comptes');
  await expect(carte(page,COURANT).locator('.compte-voyant')).toBeVisible();
}
const sortie=(id,date,montant,m={})=>({id,user_id:ID_USER,description:'TEST QA '+id,montant,type:'sortie',categorie_id:null,
  date,tricount:'non',epingle:false,note:null,compte_id:'k1',...m});

test('sans opération après le relevé : carte inchangée',async({app,base})=>{
  await demarrer(app,base);
  const c=carte(app,COURANT);
  await expect(c.locator('.compte-solde-actuel')).toHaveText('2 345,80 €');
  await expect(c.locator('.compte-solde-date')).toHaveText('Solde calculé depuis le 30/09/2026');
  await expect(ligneDepuis(app,COURANT)).toHaveCount(0);
  await expect(c.locator('.compte-voyant')).toHaveText('✓ rapproché');
  // L'opération du 03/11 (boulangerie) est du jour même du relevé : pas comptée.
});

test('une sortie après le relevé : solde attendu, ligne en rouge, écart et voyant inchangés',async({app,base})=>{
  await demarrer(app,base,{transactions:[sortie('test','2026-11-04',1.5)]});
  const c=carte(app,COURANT);
  await expect(c.locator('.compte-solde-actuel')).toHaveText('2 344,30 €');
  await expect(c.locator('.compte-solde-date')).toHaveText('Solde attendu en banque');
  const l=ligneDepuis(app,COURANT);
  await expect(l.locator('td').first()).toHaveText('Depuis le relevé (1 opération)');
  await expect(l.locator('td.num')).toHaveText('-1,50 €');
  await expect(l.locator('td.num')).toHaveClass(/neg/);
  await expect(c.locator('.compte-detail tr',{hasText:'Écart'}).locator('td.num')).toHaveText('0,00 €');
  await expect(c.locator('.compte-voyant')).toHaveText('✓ rapproché');
  await expect(app.locator('#patrimoine-total')).toHaveText('2 844,30 €');
  // L'autre compte, sans relevé, reste inchangé
  await expect(ligneDepuis(app,LIVRET)).toHaveCount(0);
  await expect(carte(app,LIVRET).locator('.compte-voyant')).toHaveText('Aucun relevé');
});

test('plusieurs opérations : pluriel et montant net positif en vert',async({app,base})=>{
  await demarrer(app,base,{transactions:[
    sortie('a','2026-11-04',10),
    sortie('b','2026-11-04',35.5,{type:'entrée'}),
    sortie('c','2026-11-04',0.5),
  ]});
  const l=ligneDepuis(app,COURANT);
  await expect(l.locator('td').first()).toHaveText('Depuis le relevé (3 opérations)');
  await expect(l.locator('td.num')).toHaveText('+25,00 €');
  await expect(l.locator('td.num')).toHaveClass(/pos/);
});

test('supprimer l\'opération après le relevé fait disparaître la ligne, sans recharger',async({app,base})=>{
  await demarrer(app,base,{transactions:[sortie('test','2026-11-04',1.5)]});
  await expect(ligneDepuis(app,COURANT)).toHaveCount(1);
  await onglet(app,'Transactions');
  await app.locator('.tx-item',{hasText:'TEST QA test'}).click();
  await expect(app.locator('#tx-modal')).toHaveClass(/open/);
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await app.click('#tx-modal-delete');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await onglet(app,'Comptes');
  await expect(ligneDepuis(app,COURANT)).toHaveCount(0);
  await expect(carte(app,COURANT).locator('.compte-solde-date')).toHaveText('Solde calculé depuis le 30/09/2026');
  await expect(carte(app,COURANT).locator('.compte-solde-actuel')).toHaveText('2 345,80 €');
});

test('saisir une opération après le relevé fait apparaître la ligne, sans recharger',async({app,base})=>{
  await demarrer(app,base);
  await onglet(app,'Transactions');
  await app.getByRole('button',{name:'+ Nouvelle opération'}).click();
  await expect(app.locator('#modal-tx-desc')).toBeFocused();
  await app.fill('#modal-tx-desc','TEST QA Café');
  await app.fill('#modal-tx-amount','2.40');
  await app.selectOption('#modal-tx-compte','k1');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await onglet(app,'Comptes');
  await expect(ligneDepuis(app,COURANT).locator('td.num')).toHaveText('-2,40 €');
});

test('ligne lisible sans défilement horizontal',async({app,base})=>{
  await demarrer(app,base,{transactions:[sortie('test','2026-11-04',1.5)]});
  const l=ligneDepuis(app,COURANT);
  await expect(l).toBeVisible();
  const deborde=await app.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(deborde,'défilement horizontal').toBe(false);
  const [libelle,montant]=await Promise.all([l.locator('td').first().boundingBox(),l.locator('td.num').boundingBox()]);
  const c=await carte(app,COURANT).boundingBox();
  expect(montant.x+montant.width).toBeLessThanOrEqual(c.x+c.width+1);
  expect(libelle.x+libelle.width).toBeLessThanOrEqual(montant.x+1);
});
