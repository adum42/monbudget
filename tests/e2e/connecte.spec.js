// Tests connectés à la vraie base TEST `ebupazakzfbpptmlrzze` (#9).
//
// - Utilisateur de test dédié : identifiants lus dans les variables TEST_EMAIL / TEST_PASSWORD
//   (secrets GitHub en CI). Aucun agent ne les lit ni ne les saisit lui-même.
//   Sans ces variables (en local, ou PR venant d'un fork), ces tests sont IGNORÉS, pas en échec.
// - Toute donnée créée commence par « TEST QA e2e » et est supprimée à la fin du test, même en cas
//   d'échec. Le jeu de données de #21 (libellés « TEST … ») n'est jamais modifié.
// - Seul TEST est joignable : tout appel vers un autre projet Supabase ou un autre site est bloqué
//   (fixture « reseau » de outils.js), et le bandeau TEST est contrôlé avant toute saisie.
const {test,expect}=require('./outils');

const EMAIL=process.env.TEST_EMAIL;
const MOT_DE_PASSE=process.env.TEST_PASSWORD;

test.skip(!EMAIL||!MOT_DE_PASSE,'TEST_EMAIL / TEST_PASSWORD absents : tests connectés ignorés');

test.use({
  baseReelle:true,
  avecSession:false,
  // Protection du mot de passe : une trace ou une capture enregistrerait la saisie (vérifié le 04/11).
  trace:'off',
  screenshot:'off',
});

// Connexion par l'écran de l'app. Le champ mot de passe est vidé juste après le clic
// (doLogin a déjà lu la valeur) : l'instantané de page joint à un échec ne le contient donc pas.
async function seConnecter(page){
  await page.fill('#login-email',EMAIL);
  try{
    await page.locator('#login-pass').fill(MOT_DE_PASSE);
    await page.getByRole('button',{name:'Se connecter'}).click();
  }finally{
    await page.evaluate(()=>{document.getElementById('login-pass').value='';});
  }
  await expect(page.locator('#auth-msg'),'message de l\'écran de connexion').not.toHaveClass(/error/);
  await expect(page.locator('#app-screen')).toBeVisible({timeout:15_000});
}

// Date du jour à Paris, au format AAAA-MM-JJ (même calcul que dateLocaleISO de l'app).
function aujourdhuiParis(){
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris'}).format(new Date());
}

test('connexion de l\'utilisateur de test',async({app})=>{
  await seConnecter(app);
  // Comparaison sans afficher l'adresse dans le message d'échec (Supabase la met en minuscules).
  const affiche=(await app.locator('#user-email').textContent()).trim().toLowerCase();
  expect(affiche===EMAIL.trim().toLowerCase(),'l\'e-mail affiché n\'est pas celui de TEST_EMAIL').toBe(true);
  await expect(app.locator('#env-banner')).toBeVisible();
});

test.describe('avec des données TEST QA',()=>{
  let description;

  test.beforeEach(async({},testInfo)=>{
    // Libellé unique : deux exécutions de la CI en même temps ne se gênent pas.
    description=`TEST QA e2e ${process.env.GITHUB_RUN_ID||'local'} ${testInfo.project.name} ${Date.now()}`;
  });

  test.afterEach(async({app})=>{
    // Nettoyage garanti, même si le test a échoué en route. La RLS limite la suppression
    // aux données de l'utilisateur de test ; le filtre exact protège tout le reste.
    const reste=await app.evaluate(async d=>{
      if(typeof sb==='undefined'||!currentUser) return null;
      await sb.from('transactions').delete().eq('description',d);
      const {count}=await sb.from('transactions').select('id',{count:'exact',head:true}).eq('description',d);
      return count;
    },description);
    if(reste!==null) expect(reste,'transaction TEST QA restée en base').toBe(0);
  });

  test('créer puis supprimer une transaction',async({app})=>{
    await seConnecter(app);

    await app.getByRole('button',{name:'− Sortie d\'argent'}).click();
    // Focus automatique posé 100 ms après l'ouverture : on l'attend avant de remplir.
    await expect(app.locator('#modal-tx-desc')).toBeFocused();
    await expect(app.locator('#modal-tx-date')).toHaveValue(aujourdhuiParis());
    // Compte : celui par défaut s'il existe, sinon le premier de la liste.
    const compte=app.locator('#modal-tx-compte');
    if(!await compte.inputValue()){
      const premier=await compte.locator('option:not([value=""])').first().getAttribute('value');
      expect(premier,'l\'utilisateur de test n\'a aucun compte').toBeTruthy();
      await compte.selectOption(premier);
    }
    await app.fill('#modal-tx-desc',description);
    await app.fill('#modal-tx-amount','1.23');
    await app.click('#tx-modal-save');

    await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
    const ligne=app.locator('.tx-item',{hasText:description});
    await expect(ligne).toBeVisible();
    await expect(ligne).toContainText('1,23');

    // Elle existe vraiment en base (lecture par le client Supabase de la page).
    expect(await app.evaluate(async d=>(await sb.from('transactions').select('montant,type').eq('description',d)).data,description))
      .toEqual([{montant:1.23,type:'sortie'}]);

    await ligne.click();
    await app.click('#tx-modal-delete');
    await app.getByRole('button',{name:'Confirmer la suppression'}).click();
    await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
    await expect(ligne).toHaveCount(0);
    expect(await app.evaluate(async d=>(await sb.from('transactions').select('id').eq('description',d)).data,description))
      .toEqual([]);
  });

  test('changer de mois',async({app})=>{
    await seConnecter(app);
    const libelle=app.locator('#month-label');
    const [a,m]=aujourdhuiParis().split('-').map(Number);
    const nomMois=(annee,mois)=>new Date(annee,mois-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

    await expect(libelle).toHaveText(nomMois(a,m));
    await app.click('#btn-prev-month');
    await expect(libelle).toHaveText(nomMois(m===1?a-1:a,m===1?12:m-1));
    await app.click('#btn-next-month');
    await expect(libelle).toHaveText(nomMois(a,m));
  });
});
