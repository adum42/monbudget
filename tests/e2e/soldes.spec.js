// Soldes banque (#55), sans connexion : erreurs de saveSoldeEntry et deleteSoldeEntry affichées
// dans la fenêtre « Saisir un solde », saisie invalide refusée sans requête, et confirmation
// en 2 temps sur la croix ✕ de l'historique.
// Fausse base (outils.js) complétée par deux relevés du compte courant.
const {test,expect}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';

// s2 avant s1 dans la table (la fausse base ignore « order ») : la ligne ciblée (s1)
// n'est pas la première de la table, mais elle est la première affichée (date la plus récente).
async function ouvrirSoldes(page,base){
  base.tables.soldes.push(
    {id:'s2',user_id:ID_USER,compte_id:'k1',date:'2026-10-15',montant:1100,note:'TEST QA à garder'},
    {id:'s1',user_id:ID_USER,compte_id:'k1',date:'2026-11-01',montant:1200,note:'TEST QA cible'},
  );
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
  await page.getByRole('button',{name:'Comptes',exact:true}).click();
  await page.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-solde-compte-id]').click();
  await expect(page.locator('#solde-modal')).toHaveClass(/open/);
  await expect(lignes(page)).toHaveCount(2);
}
const lignes=page=>page.locator('#solde-history-list .solde-entry');
const ligne=(page,date)=>lignes(page).filter({hasText:date});
const erreur=page=>page.locator('#solde-modal-error');
const confirmation=page=>page.locator('#solde-confirm-msg');
const ecritures=(base,methode)=>base.ecritures.filter(e=>e.table==='soldes'&&(!methode||e.methode===methode));
const enregistrer=page=>page.locator('#solde-modal-save').click();

async function saisir(page,montant,date,note){
  await page.fill('#modal-solde-montant',montant);
  await page.fill('#modal-solde-date',date);
  await page.fill('#modal-solde-note',note);
}
async function saisieConservee(page,montant,date,note){
  await expect(page.locator('#modal-solde-montant')).toHaveValue(montant);
  await expect(page.locator('#modal-solde-date')).toHaveValue(date);
  await expect(page.locator('#modal-solde-note')).toHaveValue(note);
}

test.beforeEach(async({page})=>{
  page.on('dialog',d=>{throw new Error('boîte de dialogue inattendue : '+d.message());});
});

test('erreur de la base à l\'enregistrement : message avec le code, saisie et historique conservés',async({app,base,journal})=>{
  journal.attendre(/saveSoldeEntry/);
  journal.attendre(/status of 400/);
  await ouvrirSoldes(app,base);
  await expect(erreur(app)).toBeHidden();
  await saisir(app,'1300.5','2026-11-03','TEST QA relevé du 3');
  base.forcerErreur('42501');
  await enregistrer(app);

  await expect(erreur(app)).toBeVisible();
  await expect(erreur(app)).toContainText('Relevé non enregistré');
  await expect(erreur(app)).toContainText('42501');
  await expect(app.locator('#solde-modal')).toHaveClass(/open/);
  await saisieConservee(app,'1300.5','2026-11-03','TEST QA relevé du 3');
  await expect(lignes(app)).toHaveCount(2);
  expect(ecritures(base)).toHaveLength(1);
  expect(base.tables.soldes.map(s=>s.id)).toEqual(['s2','s1']);

  // Nouvel essai réussi : le message disparaît, le relevé arrive dans l'historique
  await enregistrer(app);
  await expect(erreur(app)).toBeHidden();
  await expect(lignes(app)).toHaveCount(3);
  await expect(lignes(app).nth(0)).toContainText('2026-11-03 — TEST QA relevé du 3');
  await expect(lignes(app).nth(0)).toContainText(/1\s300,50\s€/);
  await expect(app.locator('#modal-solde-montant')).toHaveValue('');
  await expect(app.locator('#modal-solde-note')).toHaveValue('');
  const posts=ecritures(base,'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1].corps).toEqual([{user_id:ID_USER,compte_id:'k1',date:'2026-11-03',montant:1300.5,note:'TEST QA relevé du 3'}]);
});

test('coupure réseau à l\'enregistrement : message explicite, fenêtre ouverte',async({app,base,journal})=>{
  journal.attendre(/saveSoldeEntry/);
  journal.attendre(/net::ERR_/);
  await ouvrirSoldes(app,base);
  await app.route('**/rest/v1/soldes**',r=>r.request().method()==='POST'?r.abort('internetdisconnected'):r.fallback());
  await saisir(app,'1250','2026-11-04','TEST QA coupure');
  await enregistrer(app);

  await expect(erreur(app)).toContainText('Impossible de joindre le serveur');
  await expect(app.locator('#solde-modal')).toHaveClass(/open/);
  await saisieConservee(app,'1250','2026-11-04','TEST QA coupure');
  await expect(lignes(app)).toHaveCount(2);
  await expect(app.locator('#solde-modal-save')).toBeEnabled();
});

test('montant vide ou date vide : message, aucune requête ; message effacé à la réouverture',async({app,base})=>{
  await ouvrirSoldes(app,base);
  await saisir(app,'','2026-11-04','TEST QA sans montant');
  await enregistrer(app);
  await expect(erreur(app)).toContainText('Indiquez le montant du relevé');
  await saisieConservee(app,'','2026-11-04','TEST QA sans montant');

  await saisir(app,'1250','','TEST QA sans date');
  await enregistrer(app);
  await expect(erreur(app)).toHaveText('Indiquez la date du relevé.');
  await saisieConservee(app,'1250','','TEST QA sans date');
  expect(ecritures(base)).toHaveLength(0);
  await expect(lignes(app)).toHaveCount(2);

  // Fermer puis rouvrir : plus de message
  await app.locator('#solde-modal').getByRole('button',{name:'Fermer'}).click();
  await expect(app.locator('#solde-modal')).not.toHaveClass(/open/);
  await app.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-solde-compte-id]').click();
  await expect(erreur(app)).toBeHidden();
  expect(ecritures(base)).toHaveLength(0);
});

test('croix ✕ : confirmation du relevé cliqué, Annuler ne supprime rien, Confirmer supprime ce relevé seulement',async({app,base})=>{
  await ouvrirSoldes(app,base);

  // Le clic sur ✕ ne supprime rien : il demande confirmation pour ce relevé, focus sur Annuler
  await ligne(app,'2026-11-01').locator('[data-del-solde-id]').click();
  await expect(confirmation(app)).toHaveText(/^Supprimer le relevé du 01\/11\/2026 \(1\s200,00\s€\)\s\?$/);
  await expect(app.locator('#solde-confirm-annuler')).toBeFocused();
  await expect(ligne(app,'2026-11-01')).toHaveClass(/a-supprimer/);
  await expect(app.locator('#solde-modal-save')).toHaveCount(0);
  expect(ecritures(base)).toHaveLength(0);

  // Une seule confirmation à la fois : la croix d'une autre ligne la remplace
  await ligne(app,'2026-10-15').locator('[data-del-solde-id]').click();
  await expect(app.locator('#solde-confirm-msg')).toHaveCount(1);
  await expect(confirmation(app)).toHaveText(/du 15\/10\/2026 \(1\s100,00 €\)/);
  await expect(app.locator('.solde-entry.a-supprimer')).toHaveCount(1);
  await expect(ligne(app,'2026-10-15')).toHaveClass(/a-supprimer/);

  // Annuler : rien n'est supprimé, la fenêtre revient à la saisie
  await app.click('#solde-confirm-annuler');
  await expect(confirmation(app)).toHaveCount(0);
  await expect(app.locator('#solde-modal-save')).toBeVisible();
  await expect(app.locator('.solde-entry.a-supprimer')).toHaveCount(0);
  await expect(lignes(app)).toHaveCount(2);
  expect(ecritures(base)).toHaveLength(0);

  // Confirmer la suppression : seul s1 est supprimé
  await ligne(app,'2026-11-01').locator('[data-del-solde-id]').click();
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(lignes(app)).toHaveCount(1);
  await expect(ligne(app,'2026-11-01')).toHaveCount(0);
  await expect(lignes(app)).toContainText('TEST QA à garder');
  expect(ecritures(base,'DELETE').map(e=>e.filtres)).toEqual([{id:'s1'}]);
  expect(base.tables.soldes.map(s=>s.id)).toEqual(['s2']);
  await expect(app.locator('#solde-modal-save')).toBeVisible();
  await expect(erreur(app)).toBeHidden();

  // Échap avec une confirmation ouverte : la fenêtre se ferme, et rouvre sans confirmation
  await ligne(app,'2026-10-15').locator('[data-del-solde-id]').click();
  await expect(app.locator('#solde-confirm-annuler')).toBeFocused();
  await app.keyboard.press('Escape');
  await expect(app.locator('#solde-modal')).not.toHaveClass(/open/);
  await app.locator('.compte-card',{hasText:'TEST QA Compte courant'}).locator('[data-solde-compte-id]').click();
  await expect(confirmation(app)).toHaveCount(0);
  await expect(app.locator('#solde-modal-save')).toBeVisible();
  expect(ecritures(base,'DELETE')).toHaveLength(1);
});

test('erreur de la base à la suppression : message, le relevé reste, la confirmation reste proposée',async({app,base,journal})=>{
  journal.attendre(/deleteSoldeEntry/);
  journal.attendre(/status of 400/);
  await ouvrirSoldes(app,base);
  await ligne(app,'2026-11-01').locator('[data-del-solde-id]').click();
  base.forcerErreur('42501');
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();

  await expect(erreur(app)).toContainText('Relevé non supprimé');
  await expect(erreur(app)).toContainText('42501');
  await expect(lignes(app)).toHaveCount(2);
  await expect(ligne(app,'2026-11-01')).toBeVisible();
  await expect(confirmation(app)).toContainText('01/11/2026');
  expect(base.tables.soldes.map(s=>s.id)).toEqual(['s2','s1']);

  // Nouvel essai réussi : message effacé, relevé supprimé
  await app.getByRole('button',{name:'Confirmer la suppression'}).click();
  await expect(lignes(app)).toHaveCount(1);
  await expect(erreur(app)).toBeHidden();
  expect(ecritures(base,'DELETE').map(e=>e.filtres)).toEqual([{id:'s1'},{id:'s1'}]);
});

test('confirmation entièrement visible, sans défilement horizontal',async({app,base})=>{
  await ouvrirSoldes(app,base);
  await ligne(app,'2026-11-01').locator('[data-del-solde-id]').click();
  for(const sel of ['#solde-confirm-msg','#solde-confirm-annuler','#solde-confirm-supprimer']){
    await expect(app.locator(sel)).toBeInViewport({ratio:1});
  }
  const debord=await app.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(debord).toBeLessThanOrEqual(0);
});
