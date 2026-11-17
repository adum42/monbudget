// Onglet Comptes : montants suivis de « € » jamais coupés en fin de ligne (#56), sans connexion.
// Fausse base (outils.js) : compte courant k1 = solde initial + 2 000 − 4,20 − 650 ; livret k2 = 500 €.
// On fixe le solde initial de k1 pour obtenir le patrimoine voulu, puis on vérifie, à 1280 et à 390 px :
//   - que le montant et « € » tiennent sur une seule ligne (une seule ligne de rectangles de texte) ;
//   - qu'il n'y a pas de défilement horizontal.
// La police Syne n'est pas chargée dans les tests (police de repli) : la vérification sur la preview,
// avec la vraie police, est faite à part.
const {test,expect}=require('./outils');

const COURANT='TEST QA Compte courant';
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();

// Nombre de lignes occupées par le texte d'un élément (rectangles de texte à des hauteurs différentes).
async function nbLignes(locator){
  return locator.evaluate(el=>{
    const r=document.createRange();r.selectNodeContents(el);
    const tops=[...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top));
    return new Set(tops).size;
  });
}
async function sansDefilementHorizontal(page){
  const {sw,cw}=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(sw,'défilement horizontal').toBeLessThanOrEqual(cw);
}

async function demarrer(page,base,soldeInitialK1,{plafond=null}={}){
  const k1=base.tables.comptes.find(c=>c.id==='k1');
  k1.solde_initial=soldeInitialK1;k1.plafond=plafond;
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
  await onglet(page,'Comptes');
  await expect(page.locator('.compte-card',{hasText:COURANT}).locator('.compte-voyant')).toBeVisible();
}

// soldeInitialK1 → patrimoine : +1 345,80 € d'opérations sur k1, +500 € sur k2.
const CAS=[
  {nom:'1 234 567,89 € (critère du ticket)',initial:1232722.09,patrimoine:'1 234 567,89 €',courant:'1 234 067,89 €'},
  {nom:'−9 876 543,21 € (montant négatif)',initial:-9878389.01,patrimoine:'-9 876 543,21 €',courant:'-9 877 043,21 €'},
];

for(const cas of CAS){
  test(`patrimoine de ${cas.nom} : montant et « € » sur une seule ligne, sans défilement horizontal`,async({app,base})=>{
    await demarrer(app,base,cas.initial,{plafond:1234567.89});
    const total=app.locator('#patrimoine-total');
    await expect(total).toHaveText(cas.patrimoine);
    expect(await nbLignes(total),'patrimoine total sur une ligne').toBe(1);

    const carte=app.locator('.compte-card',{hasText:COURANT});
    const solde=carte.locator('.compte-solde-actuel');
    await expect(solde).toHaveText(cas.courant);
    expect(await nbLignes(solde),'solde calculé de la carte sur une ligne').toBe(1);
    for(const cellule of await carte.locator('.compte-detail td.num').all())
      expect(await nbLignes(cellule),'montant du détail de la carte sur une ligne').toBe(1);

    // Le bouton « + Nouveau compte » reste visible et entier dans le bandeau du patrimoine.
    const bandeau=await app.locator('.patrimoine-total').boundingBox();
    const bouton=await app.getByRole('button',{name:'+ Nouveau compte'}).boundingBox();
    expect(bouton.x+bouton.width).toBeLessThanOrEqual(bandeau.x+bandeau.width);
    await sansDefilementHorizontal(app);
  });
}

test('à 1280 px, rendu du patrimoine inchangé (Syne 32 px, montant et bouton sur la même ligne)',async({app,base},testInfo)=>{
  test.skip(testInfo.project.name!=='bureau-1280','vérification propre au bureau');
  await demarrer(app,base,1232722.09);
  const total=app.locator('#patrimoine-total');
  await expect(total).toHaveCSS('font-size','32px');
  const t=await total.boundingBox();
  const b=await app.getByRole('button',{name:'+ Nouveau compte'}).boundingBox();
  expect(b.y,'bouton sur la même ligne que le montant').toBeLessThan(t.y+t.height);
  expect(b.x,'bouton à droite du montant').toBeGreaterThan(t.x+t.width);
});
