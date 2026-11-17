// Onglet Comptes : libellés du graphique d'évolution (#54), sans connexion.
// La courbe en pointillés est la somme des derniers relevés saisis à chaque date : elle s'appelle
// « Total des relevés » (et non plus « Total patrimoine »), et la carte « Évolution des soldes banque — 12 mois ».
// Le calcul ne change pas : on vérifie les valeurs et les couleurs de chaque courbe.
// Fausse base (outils.js) : k1 « TEST QA Compte courant » (#5B6EF5), k2 « TEST QA Livret » (#22C97A).
const {test,expect}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();

// Jeux de données du graphique, lus dans l'instance Chart.js de la page.
const courbes=page=>page.evaluate(()=>chartComptes.data.datasets.map(d=>({
  label:d.label,couleur:d.borderColor,pointilles:d.borderDash||null,valeurs:d.data.map(p=>[p.x,p.y]),
})));

test('légende « Total des relevés », titre « Évolution des soldes banque — 12 mois », calcul inchangé',async({app,base})=>{
  base.tables.soldes.push(
    {id:'s1',user_id:ID_USER,compte_id:'k2',date:'2026-11-01',montant:500,note:null},
    {id:'s2',user_id:ID_USER,compte_id:'k1',date:'2026-11-03',montant:2345.8,note:null},
  );
  await app.reload();
  await expect(app.locator('#app-screen')).toBeVisible();
  await onglet(app,'Comptes');

  const section=app.locator('#tab-comptes');
  await expect(section.locator('.card-title',{hasText:'12 mois'})).toHaveText('Évolution des soldes banque — 12 mois');
  await expect(section).not.toContainText('Total patrimoine');
  await expect(section).not.toContainText('Évolution du patrimoine');
  await expect(section.locator('.patrimoine-label')).toHaveText('Patrimoine total');

  await expect.poll(()=>app.evaluate(()=>chartComptes!==null)).toBe(true);
  expect(await courbes(app)).toEqual([
    {label:'TEST QA Compte courant',couleur:'#5B6EF5',pointilles:null,valeurs:[['2026-11-01',null],['2026-11-03',2345.8]]},
    {label:'TEST QA Livret',couleur:'#22C97A',pointilles:null,valeurs:[['2026-11-01',500],['2026-11-03',500]]},
    {label:'Total des relevés',couleur:'#F0F0F2',pointilles:[5,5],valeurs:[['2026-11-01',500],['2026-11-03',2845.8]]},
  ]);
});
