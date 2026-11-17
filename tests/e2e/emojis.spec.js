// Sélecteur d'emoji des catégories (#78), sans connexion : Supabase simulé en mémoire.
// Fausse base : c1 « TEST QA Courses » 🛒 (portée par la transaction t2 « TEST QA Boulangerie »), c2 « TEST QA Loisirs » 🎮.
const {test,expect}=require('./outils');

const ligneCat=(page,nom)=>page.locator('.cat-item',{hasText:nom});
const grille=page=>page.locator('#emoji-grid');
const option=(page,e)=>page.locator(`#emoji-grid [data-emoji="${e}"]`);
const apercu=page=>page.locator('#modal-emoji-preview');
const libre=page=>page.locator('#emoji-libre');
const erreurLibre=page=>page.locator('#emoji-libre-erreur');
const ecrituresCat=base=>base.ecritures.filter(e=>e.table==='categories'&&e.methode!=='GET');

async function ongletCategories(page){
  await page.getByRole('button',{name:'Catégories',exact:true}).click();
  await expect(ligneCat(page,'TEST QA Courses')).toBeVisible();
}
// Le focus automatique du nom (100 ms après l'ouverture) volerait une saisie commencée avant :
// on l'attend avant toute action (piège du setTimeout, voir #55).
async function ouverte(page){
  await expect(page.locator('#cat-modal')).toHaveClass(/open/);
  await expect(page.locator('#modal-cat-nom')).toBeFocused();
}
async function modifier(page,nom){
  await ongletCategories(page);
  await ligneCat(page,nom).locator('.btn-edit').click();
  await ouverte(page);
}
async function nouvelle(page){
  await ongletCategories(page);
  await page.getByRole('button',{name:'+ Nouvelle catégorie'}).click();
  await ouverte(page);
}
async function rechercher(page,texte){ await page.fill('#emoji-search',texte); }

test('16 groupes, dont les nouveaux ; anciens et nouveaux emojis dans leur groupe',async({app})=>{
  await nouvelle(app);
  const groupes=app.locator('#emoji-cats [data-emoji-groupe]');
  await expect(groupes).toHaveCount(16);
  await expect(groupes.first()).toHaveText('🏠 Quotidien');
  await expect(groupes.first()).toHaveClass(/active/);
  await expect(option(app,'🛒')).toBeVisible();                       // ancien emoji, groupe par défaut
  // Total du catalogue affiché : environ 250 emojis
  const total=await app.evaluate(()=>Object.values(EMOJI_CATS).flat().length);
  expect(total).toBeGreaterThanOrEqual(240);
  await groupes.filter({hasText:'Maison'}).click();
  await expect(groupes.filter({hasText:'Maison'})).toHaveClass(/active/);
  await expect(option(app,'⚡')).toBeVisible();
  await expect(option(app,'🛒')).toHaveCount(0);
  await groupes.filter({hasText:'Santé'}).click();
  await expect(option(app,'🦷')).toBeVisible();
  await expect(option(app,'🩺')).toBeVisible();
});

test('la recherche filtre sur les mots-clés, sans accents ni majuscules, sur un début de mot',async({app})=>{
  await nouvelle(app);
  await rechercher(app,'elec');
  await expect(option(app,'⚡')).toBeVisible();
  await expect(option(app,'🛒')).toHaveCount(0);
  await expect(app.locator('#emoji-aucun')).toBeHidden();

  await rechercher(app,'resto');
  await expect(option(app,'🍽️')).toBeVisible();
  await expect(option(app,'⚡')).toHaveCount(0);

  await rechercher(app,'SANTE');
  await expect(option(app,'💊')).toBeVisible();
  await expect(option(app,'🏥')).toBeVisible();
  await expect(option(app,'🍽️')).toHaveCount(0);

  // Un clic dans les résultats choisit l'emoji
  await option(app,'💊').click();
  await expect(apercu(app)).toHaveText('💊');
  await expect(option(app,'💊')).toHaveClass(/selected/);
});

test('mot inconnu : « Aucun emoji trouvé » ; vider la recherche revient au groupe courant',async({app})=>{
  await nouvelle(app);
  await app.locator('#emoji-cats [data-emoji-groupe]',{hasText:'Animaux'}).click();
  await expect(option(app,'🐶')).toBeVisible();

  await rechercher(app,'zzzz');
  await expect(app.locator('#emoji-aucun')).toBeVisible();
  await expect(app.locator('#emoji-aucun')).toHaveText('Aucun emoji trouvé');
  await expect(grille(app).locator('[data-emoji]')).toHaveCount(0);

  await rechercher(app,'');
  await expect(app.locator('#emoji-aucun')).toBeHidden();
  await expect(option(app,'🐶')).toBeVisible();
  await expect(option(app,'🛒')).toHaveCount(0);
  await expect(app.locator('#emoji-cats [data-emoji-groupe]',{hasText:'Animaux'})).toHaveClass(/active/);
});

test('coller 🦖 l\'applique : enregistré et affiché partout',async({app,base})=>{
  await modifier(app,'TEST QA Courses');
  await expect(apercu(app)).toHaveText('🛒');
  await libre(app).fill('🦖');
  await expect(apercu(app)).toHaveText('🦖');
  await expect(erreurLibre(app)).toBeHidden();
  await app.locator('#cat-modal-save').click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);

  const maj=ecrituresCat(base).filter(e=>e.methode==='PATCH');
  expect(maj).toHaveLength(1);
  expect(maj[0].corps.emoji).toBe('🦖');
  expect(maj[0].filtres).toEqual({id:'c1'});

  await expect(ligneCat(app,'TEST QA Courses').locator('.cat-emoji-display')).toHaveText('🦖');
  await expect(app.locator('#f-cat option',{hasText:'TEST QA Courses'})).toHaveText(/🦖/);
  await app.getByRole('button',{name:'Transactions',exact:true}).click();
  await expect(app.locator('.tx-item',{hasText:'TEST QA Boulangerie'})).toContainText('🦖 TEST QA Courses');
});

test('emoji composé collé dans une nouvelle catégorie : envoyé tel quel',async({app,base})=>{
  await nouvelle(app);
  await app.fill('#modal-cat-nom','TEST QA Famille');
  await libre(app).fill('👨‍👩‍👧');
  await expect(apercu(app)).toHaveText('👨‍👩‍👧');
  await app.locator('#cat-modal-save').click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  const ajouts=ecrituresCat(base).filter(e=>e.methode==='POST');
  expect(ajouts).toHaveLength(1);
  expect([].concat(ajouts[0].corps)[0].emoji).toBe('👨‍👩‍👧');
  await expect(ligneCat(app,'TEST QA Famille').locator('.cat-emoji-display')).toHaveText('👨‍👩‍👧');
});

test('« abc », « 12 » et « 🍕🍔 » refusés avec un message, emoji choisi inchangé',async({app,base})=>{
  await modifier(app,'TEST QA Courses');
  for(const valeur of ['abc','12','🍕🍔']){
    await libre(app).fill(valeur);
    await expect(erreurLibre(app)).toBeVisible();
    await expect(erreurLibre(app)).toHaveText('Colle un seul emoji, sans texte ni chiffre.');
    await expect(libre(app)).toHaveAttribute('aria-invalid','true');
    await expect(apercu(app)).toHaveText('🛒');
  }
  // Champ vidé : message effacé
  await libre(app).fill('');
  await expect(erreurLibre(app)).toBeHidden();
  // La catégorie existante garde son emoji
  await app.locator('#cat-modal-save').click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  const maj=ecrituresCat(base).filter(e=>e.methode==='PATCH');
  expect(maj).toHaveLength(1);
  expect(maj[0].corps.emoji).toBe('🛒');
  await expect(ligneCat(app,'TEST QA Courses').locator('.cat-emoji-display')).toHaveText('🛒');
});

test('à la réouverture, recherche, champ libre et message sont remis à zéro',async({app})=>{
  await modifier(app,'TEST QA Courses');
  await rechercher(app,'zzzz');
  await libre(app).fill('abc');
  await expect(erreurLibre(app)).toBeVisible();
  await app.locator('#cat-modal .modal-close').click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);

  await ligneCat(app,'TEST QA Loisirs').locator('.btn-edit').click();
  await ouverte(app);
  await expect(apercu(app)).toHaveText('🎮');
  await expect(app.locator('#emoji-search')).toHaveValue('');
  await expect(libre(app)).toHaveValue('');
  await expect(erreurLibre(app)).toBeHidden();
  await expect(app.locator('#emoji-aucun')).toBeHidden();
  await expect(option(app,'🛒')).toBeVisible();
});

test('fenêtre utilisable sans défilement horizontal de la page',async({app})=>{
  await nouvelle(app);
  await rechercher(app,'c');                       // beaucoup de résultats
  await libre(app).fill('abc');                    // message d'erreur affiché
  const debord=await app.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
  // Les emojis de la grille restent cliquables (au moins 30 px de large)
  const boite=await grille(app).locator('[data-emoji]').first().boundingBox();
  expect(boite.width).toBeGreaterThanOrEqual(30);
  // Aucun emoji coupé : chaque case de la grille tient dans la largeur visible de la grille
  const coupes=await app.evaluate(()=>{
    const g=document.getElementById('emoji-grid').getBoundingClientRect();
    return [...document.querySelectorAll('#emoji-grid [data-emoji]')].filter(b=>{
      const r=b.getBoundingClientRect();return r.left<g.left-1||r.right>g.right+1;
    }).map(b=>b.dataset.emoji);
  });
  expect(coupes).toEqual([]);
  // Le champ libre et la grille sont dans la fenêtre
  const fenetre=await app.locator('#cat-modal .modal').boundingBox();
  const champ=await libre(app).boundingBox();
  expect(champ.x).toBeGreaterThanOrEqual(fenetre.x);
  expect(champ.x+champ.width).toBeLessThanOrEqual(fenetre.x+fenetre.width+1);
});
