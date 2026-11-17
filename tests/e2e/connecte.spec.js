// Tests connectés à la vraie base TEST `ebupazakzfbpptmlrzze` (#9).
//
// - Utilisateur de test dédié : identifiants lus dans les variables TEST_EMAIL / TEST_PASSWORD
//   (secrets GitHub en CI). Aucun agent ne les lit ni ne les saisit lui-même.
//   Sans ces variables (en local, ou PR venant d'un fork), ces tests sont IGNORÉS, pas en échec.
// - Toute donnée créée commence par « TEST QA e2e » et est supprimée à la fin du test, même en cas
//   d'échec, y compris après sa modification (#120). Le jeu de données de #21 (libellés « TEST … »)
//   n'est jamais modifié.
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
  // L'écran principal s'affiche AVANT la fin du chargement des données (loadAll) : ouvrir une modale
  // tout de suite donnerait une liste de comptes vide (vu en CI le 04/11). On attend les comptes
  // du jeu de données de #21.
  await expect.poll(()=>page.evaluate(()=>comptes.length),
    {message:'comptes de l\'utilisateur de test non chargés (jeu de données #21 absent ?)',timeout:15_000})
    .toBeGreaterThan(0);
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
  let description;          // libellé à la création
  let descriptionModifiee;  // libellé après l'étape « modifier » (#120)

  test.beforeEach(async({},testInfo)=>{
    // Libellé unique : deux exécutions de la CI en même temps ne se gênent pas.
    description=`TEST QA e2e ${process.env.GITHUB_RUN_ID||'local'} ${testInfo.project.name} ${Date.now()}`;
    // Le libellé modifié reprend le libellé d'origine : il commence lui aussi par « TEST QA e2e »
    // et reste propre à cette exécution.
    descriptionModifiee=`${description} modifiée`;
  });

  test.afterEach(async({app})=>{
    // Nettoyage garanti, même si le test a échoué en route : l'opération peut porter le libellé
    // d'origine OU le libellé modifié selon l'endroit de l'échec (#120), on supprime donc les deux.
    // La RLS limite la suppression aux données de l'utilisateur de test ; le filtre exact (eq, un
    // libellé à la fois) protège tout le reste, dont le jeu de données de #21.
    const reste=await app.evaluate(async libelles=>{
      if(typeof sb==='undefined'||!currentUser) return null;
      let total=0;
      for(const d of libelles){
        await sb.from('transactions').delete().eq('description',d);
        const {count,error}=await sb.from('transactions').select('id',{count:'exact',head:true}).eq('description',d);
        if(error) throw new Error('comptage des données TEST QA impossible : '+error.message);
        total+=count;
      }
      return total;
    },[description,descriptionModifiee]);
    if(reste!==null) expect(reste,'transaction TEST QA restée en base').toBe(0);
  });

  test('créer, modifier puis supprimer une transaction',async({app})=>{
    await seConnecter(app);

    await app.getByRole('button',{name:'+ Nouvelle opération'}).click();
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
    // Son identifiant sert à relire CETTE ligne après la modification.
    const id=await app.evaluate(async d=>(await sb.from('transactions').select('id').eq('description',d)).data[0].id,description);

    // ── Modifier (#120) : saveTx en mise à jour (update … eq('id', …)) ──────────
    await ligne.click();
    await expect(app.locator('#tx-modal')).toHaveClass(/open/);
    // Mode modification : bouton Supprimer affiché et champs pré-remplis avec l'opération créée.
    await expect(app.locator('#tx-modal-delete')).toBeVisible();
    await expect(app.locator('#modal-tx-desc')).toHaveValue(description);
    // Le focus automatique (100 ms après l'ouverture) est aussi posé en modification : on l'attend
    // avant toute saisie, sinon il pourrait revenir sur la description au milieu du remplissage.
    await expect(app.locator('#modal-tx-desc')).toBeFocused();
    await app.fill('#modal-tx-desc',descriptionModifiee);
    await app.fill('#modal-tx-amount','4.56');
    await app.click('#btn-type-in');                       // sortie → entrée
    await expect(app.locator('#btn-type-in')).toHaveAttribute('aria-pressed','true');
    await app.fill('#modal-tx-note','TEST QA e2e note');    // champ de plus envoyé par construireLigneTx
    await app.click('#tx-modal-save');

    // À l'écran : modale fermée, nouveau libellé, montant en entrée (signe + et vert), ancien libellé disparu.
    await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
    const ligneModifiee=app.locator('.tx-item',{hasText:descriptionModifiee});
    await expect(ligneModifiee).toBeVisible();
    await expect(ligneModifiee.locator('.tx-amount')).toContainText('+4,56');
    await expect(ligneModifiee.locator('.tx-amount')).toHaveClass(/green/);
    await expect(ligneModifiee.locator('.tx-note')).toHaveText('TEST QA e2e note');
    // hasText cherche une sous-chaîne et le libellé d'origine est contenu dans le libellé modifié :
    // on cherche donc le texte exact.
    await expect(app.locator('.tx-item').getByText(description,{exact:true})).toHaveCount(0);

    // En base : une seule ligne parmi les deux libellés de l'exécution, la même (même id), mise à jour.
    expect(await app.evaluate(async id=>(await sb.from('transactions').select('description,montant,type,note').eq('id',id)).data,id))
      .toEqual([{description:descriptionModifiee,montant:4.56,type:'entrée',note:'TEST QA e2e note'}]);
    expect(await app.evaluate(async d=>(await sb.from('transactions').select('id').eq('description',d)).data,description))
      .toEqual([]);

    // ── Supprimer par l'écran ─────────────────────────────────────────────
    await ligneModifiee.click();
    await expect(app.locator('#tx-modal')).toHaveClass(/open/);
    await app.click('#tx-modal-delete');
    await app.getByRole('button',{name:'Confirmer la suppression'}).click();
    await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
    await expect(ligneModifiee).toHaveCount(0);
    expect(await app.evaluate(async id=>(await sb.from('transactions').select('id').eq('id',id)).data,id))
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
