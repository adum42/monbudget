// Croix ✕ d'effacement de la recherche des transactions (#77), sans connexion : Supabase simulé en mémoire.
// Fausse base (outils.js), mois affiché : novembre 2026 → « TEST QA Salaire » (entrée) et « TEST QA Boulangerie »
// (sortie, épinglée) ; « TEST QA Loyer octobre » est en octobre.
const {test,expect}=require('./outils');

const champ=page=>page.locator('#tx-search');
const croix=page=>page.getByRole('button',{name:'Effacer la recherche'});
const lignes=page=>page.locator('#tx-list .tx-item');

test('champ vide : pas de croix ; elle apparaît à la saisie et disparaît quand on vide le champ',async({app})=>{
  await expect(champ(app)).toHaveValue('');
  await expect(croix(app)).toBeHidden();
  await champ(app).fill('boul');
  await expect(croix(app)).toBeVisible();
  await expect(lignes(app)).toHaveCount(1);
  // Vidé à la main : la croix disparaît
  await champ(app).fill('');
  await expect(croix(app)).toBeHidden();
  await expect(lignes(app)).toHaveCount(2);
  // Des espaces seuls restent du texte : la croix permet de les effacer
  await champ(app).pressSequentially(' ');
  await expect(croix(app)).toBeVisible();
});

test('clic sur la croix : champ vidé, liste réaffichée, focus dans le champ, croix masquée',async({app})=>{
  await champ(app).fill('salaire');
  await expect(lignes(app)).toHaveCount(1);
  await croix(app).click();
  await expect(champ(app)).toHaveValue('');
  await expect(champ(app)).toBeFocused();
  await expect(croix(app)).toBeHidden();
  await expect(lignes(app)).toHaveCount(2);
  await expect(lignes(app).filter({hasText:'TEST QA Salaire'})).toBeVisible();
  await expect(lignes(app).filter({hasText:'TEST QA Boulangerie'})).toBeVisible();
});

test('la croix ne réinitialise ni les filtres ni « Tout voir »',async({app})=>{
  await app.selectOption('#f-type','sortie');
  await app.selectOption('#f-cat','c1');
  await app.selectOption('#f-epingle','oui');
  await app.selectOption('#f-tricount','non');
  await app.selectOption('#f-sort','montant-asc');
  await app.click('#btn-view-all');                       // tout l'historique
  await champ(app).fill('salaire');                        // aucune sortie ne correspond
  await expect(lignes(app)).toHaveCount(0);
  await croix(app).click();
  await expect(app.locator('#f-type')).toHaveValue('sortie');
  await expect(app.locator('#f-cat')).toHaveValue('c1');
  await expect(app.locator('#f-epingle')).toHaveValue('oui');
  await expect(app.locator('#f-tricount')).toHaveValue('non');
  await expect(app.locator('#f-sort')).toHaveValue('montant-asc');
  // Seule la Boulangerie (sortie, Courses, épinglée) répond aux autres filtres
  await expect(lignes(app)).toHaveCount(1);
  await expect(lignes(app).first()).toContainText('TEST QA Boulangerie');
  // « Tout voir » toujours actif : le loyer d'octobre (sortie sans catégorie) apparaît si on retire le filtre catégorie
  await app.selectOption('#f-cat','all');
  await app.selectOption('#f-epingle','all');
  await expect(lignes(app).filter({hasText:'TEST QA Loyer octobre'})).toBeVisible();
});

test('zone de clic d\'au moins 32 × 32 px, dans le champ, sans chevaucher le texte ni défilement horizontal',async({app})=>{
  await champ(app).fill('un texte de recherche assez long pour remplir tout le champ de saisie');
  await expect(croix(app)).toBeVisible();
  const mesures=await app.evaluate(()=>{
    const c=document.getElementById('tx-search'),b=document.getElementById('tx-search-clear');
    const rc=c.getBoundingClientRect(),rb=b.getBoundingClientRect(),st=getComputedStyle(c);
    return {
      largeur:rb.width,hauteur:rb.height,
      dedans:rb.left>=rc.left&&rb.right<=rc.right+0.5,
      // Fin de la zone de texte (bord droit moins la marge intérieure) avant le début de la croix
      finTexte:rc.right-parseFloat(st.paddingRight)-parseFloat(st.borderRightWidth),debutCroix:rb.left,
      defilement:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      couleur:getComputedStyle(b).color,muted:getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),
    };
  });
  expect(mesures.largeur).toBeGreaterThanOrEqual(32);
  expect(mesures.hauteur).toBeGreaterThanOrEqual(32);
  expect(mesures.dedans).toBe(true);
  expect(mesures.finTexte).toBeLessThanOrEqual(mesures.debutCroix+0.5);
  expect(mesures.defilement).toBe(false);
  expect(mesures.couleur).toBe('rgb(122, 125, 138)');      // --muted : #7A7D8A
  expect(mesures.muted.toUpperCase()).toBe('#7A7D8A');
});
