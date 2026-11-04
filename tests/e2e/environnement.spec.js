// Démarrage de l'app servie en local : base TEST, bandeau, écran de connexion (#9).
// Sans connexion : Supabase est simulé par la fixture « base » (voir outils.js).
const {test,expect}=require('./outils');

test.describe('avec une session ouverte',()=>{
  test('l\'app s\'ouvre sur TEST avec le bandeau et le mois courant',async({app})=>{
    // La fixture « app » a déjà vérifié l'URL, le bandeau et le message console.
    await expect(app.locator('#user-email')).toHaveText('test.qa@exemple.invalid');
    await expect(app.locator('#month-label')).toHaveText('novembre 2026');
    // Transactions de novembre affichées, celle d'octobre non.
    await expect(app.locator('.tx-item',{hasText:'TEST QA Salaire'})).toBeVisible();
    await expect(app.locator('.tx-item',{hasText:'TEST QA Loyer octobre'})).toHaveCount(0);
  });

  test('pas de défilement horizontal',async({app})=>{
    const {page,ecran}=await app.evaluate(()=>({page:document.documentElement.scrollWidth,ecran:document.documentElement.clientWidth}));
    expect(page,'la page déborde de l\'écran').toBeLessThanOrEqual(ecran);
  });
});

test.describe('sans session',()=>{
  test.use({avecSession:false});

  test('l\'écran de connexion s\'affiche, sans aucune écriture',async({app,base})=>{
    await expect(app.locator('#auth-screen')).toBeVisible();
    await expect(app.locator('#app-screen')).toBeHidden();
    await expect(app.getByRole('button',{name:'Se connecter'})).toBeVisible();
    expect(base.ecritures).toEqual([]);
  });
});
