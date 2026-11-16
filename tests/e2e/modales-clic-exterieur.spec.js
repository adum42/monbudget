// Fenêtres et clic à l'extérieur (#71), sans connexion : Supabase simulé en mémoire.
// Les 4 modales (transaction, catégorie, compte, solde) ne se ferment plus au clic sur le fond ;
// elles se ferment toujours par « Annuler » / « Fermer », la croix ✕ et Échap.
const {test,expect}=require('./outils');

const MODALES=[
  {nom:'transaction',id:'tx-modal',champ:'#modal-tx-desc',annuler:'Annuler',
    ouvrir:page=>page.getByRole('button',{name:'− Sortie d\'argent'}).click()},
  {nom:'catégorie',id:'cat-modal',champ:'#modal-cat-nom',annuler:'Annuler',
    ouvrir:async page=>{
      await page.getByRole('button',{name:'Catégories',exact:true}).click();
      await page.getByRole('button',{name:'+ Nouvelle catégorie'}).click();
    }},
  {nom:'compte',id:'compte-modal',champ:'#modal-c-nom',annuler:'Annuler',
    ouvrir:async page=>{
      await page.getByRole('button',{name:'Comptes',exact:true}).click();
      await page.getByRole('button',{name:'+ Nouveau compte'}).click();
    }},
  {nom:'solde',id:'solde-modal',champ:'#modal-solde-note',annuler:'Fermer',
    ouvrir:async page=>{
      await page.getByRole('button',{name:'Comptes',exact:true}).click();
      await page.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-solde-compte-id]').click();
    }},
];

const modale=(page,m)=>page.locator('#'+m.id);

async function ouvrir(page,m){
  await m.ouvrir(page);
  await expect(modale(page,m)).toHaveClass(/open/);
  await page.waitForTimeout(150);   // laisse passer le focus automatique (100 ms après l'ouverture)
}

// Clic sur le fond sombre, dans la marge de 24 px autour de la fenêtre : c'est bien le fond qui reçoit le clic.
async function cliquerFond(page,m){
  await modale(page,m).click({position:{x:5,y:5}});
}

for(const m of MODALES){
  test(`modale ${m.nom} : un clic sur le fond ne la ferme pas et garde la saisie`,async({app,base})=>{
    await ouvrir(app,m);
    await app.fill(m.champ,'TEST QA saisie en cours');
    const ecrituresAvant=base.ecritures.length;

    await cliquerFond(app,m);
    await cliquerFond(app,m);   // un second clic ne change rien non plus

    await expect(modale(app,m)).toHaveClass(/open/);
    await expect(app.locator(m.champ)).toHaveValue('TEST QA saisie en cours');
    expect(base.ecritures.length).toBe(ecrituresAvant);   // rien n'est envoyé
  });

  test(`modale ${m.nom} : « ${m.annuler} », la croix et Échap la ferment toujours`,async({app})=>{
    // « Annuler » / « Fermer »
    await ouvrir(app,m);
    await modale(app,m).getByRole('button',{name:m.annuler,exact:true}).click();
    await expect(modale(app,m)).not.toHaveClass(/open/);

    // Croix ✕
    await ouvrir(app,m);
    await modale(app,m).locator('.modal-close').click();
    await expect(modale(app,m)).not.toHaveClass(/open/);

    // Échap, curseur hors des champs (dans un champ, Échap reste sans effet : hors périmètre)
    await ouvrir(app,m);
    await app.evaluate(()=>document.activeElement&&document.activeElement.blur());
    await app.keyboard.press('Escape');
    await expect(modale(app,m)).not.toHaveClass(/open/);
  });
}
