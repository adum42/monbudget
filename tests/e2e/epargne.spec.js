// Onglet Statistiques : histogramme « Épargne — 6 mois » (#100), sans connexion.
// Épargne du mois = entrées − sorties, hors catégorie « Mouvement de compte » ; barre verte au-dessus
// de 0, rouge en dessous ; mois sans opération : sur l'axe, sans barre, infobulle « aucune opération ».
// Horloge figée au 04/11/2026 (outils.js) : la période va de juin à novembre 2026.
// Fausse base de départ : novembre = +2 000 (Salaire) − 4,20 (Boulangerie) = +1 995,80 ; octobre = −650 (Loyer).
const {test,expect,nouvelleOperation}=require('./outils');

const ID_USER='00000000-0000-4000-8000-0000000000a1';
const VERT='rgba(34,201,122,0.7)',ROUGE='rgba(240,82,82,0.7)';
const onglet=(page,nom)=>page.getByRole('button',{name:nom,exact:true}).click();
const ligneTx=(id,description,type,montant,date,categorie_id=null,compte_id='k1')=>
  ({id,user_id:ID_USER,description,montant,type,categorie_id,date,tricount:'non',epingle:false,note:null,compte_id});

// Critères du ticket : septembre +600 (2 000 − 1 400), août −300 (1 000 − 1 300),
// et un virement interne de 500 € en septembre, qui ne change pas la barre.
async function ajouterMoisDuTicket(page,base){
  base.tables.transactions.push(
    ligneTx('s1','TEST QA Paie septembre','entrée',2000,'2026-09-01'),
    ligneTx('s2','TEST QA Dépenses septembre','sortie',1400,'2026-09-15','c1'),
    ligneTx('s3','TEST QA Virement livret','sortie',500,'2026-09-20','cv','k1'),
    ligneTx('s4','TEST QA Virement livret','entrée',500,'2026-09-20','cv','k2'),
    ligneTx('a1','TEST QA Paie août','entrée',1000,'2026-08-01'),
    ligneTx('a2','TEST QA Dépenses août','sortie',1300,'2026-08-10','c2'),
  );
  await page.reload();
  await expect(page.locator('#app-screen')).toBeVisible();
}

// État du graphique, lu dans l'instance Chart.js de la page.
const graphique=page=>page.evaluate(()=>{
  const d=chartEpargne.data.datasets[0];
  const tip=chartEpargne.options.plugins.tooltip.callbacks.label;
  return {
    labels:chartEpargne.data.labels,
    labelsEvolution:chartMonths.data.labels,
    nbSeries:chartEpargne.data.datasets.length,
    valeurs:d.data,
    brutes:d.epargne,
    couleurs:d.backgroundColor,
    infobulles:d.data.map((_,i)=>tip({dataset:d,dataIndex:i})),
    legende:chartEpargne.options.plugins.legend.display,
  };
});
async function ouvrirStats(page){
  await onglet(page,'Statistiques');
  await expect.poll(()=>page.evaluate(()=>typeof chartEpargne!=='undefined'&&chartEpargne!==null)).toBe(true);
}

test('carte « Épargne — 6 mois » sous « Évolution 6 mois » : barres vertes et rouges, virement interne exclu, mois vides sans barre',async({app,base})=>{
  await ajouterMoisDuTicket(app,base);
  await ouvrirStats(app);

  const carte=app.locator('#stats-epargne-card');
  await expect(carte.locator('.card-title')).toHaveText('Épargne — 6 mois');
  await expect(carte.locator('canvas#chart-epargne')).toBeVisible();
  const evolution=app.locator('.card',{has:app.locator('#chart-months')});
  const bEvol=await evolution.boundingBox(),bEp=await carte.boundingBox();
  expect(bEp.y,'la carte est sous « Évolution 6 mois »').toBeGreaterThanOrEqual(bEvol.y+bEvol.height);

  const g=await graphique(app);
  expect(g.labels).toEqual(g.labelsEvolution);                      // mêmes mois qu'« Évolution 6 mois »
  expect(g.labels).toHaveLength(6);
  expect(g.nbSeries).toBe(1);
  expect(g.legende).toBe(false);
  //                       juin  juil. août  sept. oct.  nov.
  expect(g.brutes).toEqual([null,null,-300, 600,  -650, 1995.8]);
  expect(g.valeurs).toEqual([0,   0,   -300, 600,  -650, 1995.8]);
  expect(g.couleurs).toEqual([VERT,VERT,ROUGE,VERT,ROUGE,VERT]);
  expect(g.infobulles).toEqual(['aucune opération','aucune opération','−300,00 €','+600,00 €','−650,00 €','+1 995,80 €']);

  // Axe Y : ligne 0 au milieu et plus nette que le reste de la grille, graduations en € fr-FR.
  const axe=await app.evaluate(()=>{
    const y=chartEpargne.scales.y;
    const zero=y.ticks.findIndex(t=>t.value===0);
    const ctx=i=>({tick:y.ticks[i]});
    return {min:y.min,max:y.max,
      couleurZero:chartEpargne.config.options.scales.y.grid.color(ctx(zero)),
      couleurAutre:chartEpargne.config.options.scales.y.grid.color(ctx(zero===0?1:0)),
      epaisseurZero:chartEpargne.config.options.scales.y.grid.lineWidth(ctx(zero)),
      graduation:chartEpargne.config.options.scales.y.ticks.callback(-1500)};
  });
  expect(axe.min).toBe(-axe.max);
  expect(axe.max).toBeGreaterThanOrEqual(1995.8);
  expect(axe.couleurZero).not.toBe(axe.couleurAutre);
  expect(axe.epaisseurZero).toBeGreaterThan(1);
  expect(axe.graduation).toBe('-1 500 €');
});

test('infobulle au survol : « aucune opération » sur un mois vide, montant signé sur un mois rempli',async({app,base})=>{
  await ajouterMoisDuTicket(app,base);
  await ouvrirStats(app);
  await app.locator('#chart-epargne').scrollIntoViewIfNeeded();
  // Position de chaque colonne à l'écran, calculée par Chart.js.
  // L'infobulle suit la souris : on attend le texte attendu (la précédente peut rester affichée un instant).
  const survol=async(index,attendu)=>{
    const pos=await app.evaluate(i=>{
      const r=chartEpargne.canvas.getBoundingClientRect();
      return {x:r.left+chartEpargne.scales.x.getPixelForValue(i),y:r.top+(chartEpargne.chartArea.top+chartEpargne.chartArea.bottom)/2};
    },index);
    await app.mouse.move(pos.x,pos.y);
    await expect.poll(()=>app.evaluate(()=>{
      const b=chartEpargne.tooltip.body;return b&&b.length?b[0].lines.join(' '):'';
    }),{message:'infobulle de la colonne '+index}).toBe(attendu);
  };
  await survol(0,'aucune opération');
  await survol(3,'+600,00 €');
  await survol(2,'−300,00 €');
  await survol(1,'aucune opération');
});

test('les 6 mois ne dépendent pas du mois choisi dans l\'en-tête',async({app,base})=>{
  await ajouterMoisDuTicket(app,base);
  await ouvrirStats(app);
  const avant=await graphique(app);
  await app.click('#btn-prev-month');
  await app.click('#btn-prev-month');
  await app.click('#btn-prev-month');
  await expect(app.locator('#stats-kpis')).toBeVisible();
  const apres=await graphique(app);
  expect(apres.labels).toEqual(avant.labels);
  expect(apres.labelsEvolution).toEqual(avant.labelsEvolution);
  expect(apres.brutes).toEqual(avant.brutes);
});

test('recalcul après une saisie et au retour sur l\'onglet, sans erreur console',async({app})=>{
  await ouvrirStats(app);
  expect((await graphique(app)).brutes).toEqual([null,null,null,null,-650,1995.8]);

  // Nouvelle sortie de 2 000 € en novembre : la barre passe en dessous de 0.
  await onglet(app,'Transactions');
  await nouvelleOperation(app,'sortie');
  await app.fill('#modal-tx-desc','TEST QA Gros achat');
  await app.fill('#modal-tx-amount','2000');
  await app.click('#tx-modal-save');
  await expect(app.locator('#tx-modal')).not.toHaveClass(/open/);
  await expect(app.locator('.tx-item',{hasText:'TEST QA Gros achat'})).toHaveCount(1);

  await ouvrirStats(app);
  const g=await graphique(app);
  expect(g.brutes).toEqual([null,null,null,null,-650,-4.2]);
  expect(g.couleurs[5]).toBe(ROUGE);
  expect(g.infobulles[5]).toBe('−4,20 €');

  // Allers-retours : le graphique est détruit et recréé à chaque fois, sans erreur (le journal le vérifie).
  for(let i=0;i<3;i++){await onglet(app,'Transactions');await ouvrirStats(app);}
  expect((await graphique(app)).brutes).toEqual([null,null,null,null,-650,-4.2]);
});

test('changer la catégorie « Mouvement de compte » recalcule l\'épargne',async({app})=>{
  // Courses (Boulangerie 4,20 € en novembre) devient la catégorie « Mouvement de compte » : novembre = +2 000.
  await onglet(app,'Catégories');
  await app.locator('.cat-item',{hasText:'TEST QA Courses'}).locator('.btn-edit').click();
  await app.locator('label[for="modal-cat-mvt"]').click();
  await app.getByRole('button',{name:'Enregistrer'}).click();
  await expect(app.locator('#cat-modal')).not.toHaveClass(/open/);
  await expect(app.locator('.cat-item',{hasText:'TEST QA Courses'}).locator('.cat-mvt-compte')).toBeVisible();
  await ouvrirStats(app);
  expect((await graphique(app)).brutes).toEqual([null,null,null,null,-650,2000]);
});

test('lisible sans défilement horizontal (390 px comme 1280 px)',async({app,base})=>{
  await ajouterMoisDuTicket(app,base);
  await ouvrirStats(app);
  const carte=app.locator('#stats-epargne-card');
  await carte.scrollIntoViewIfNeeded();
  await expect(carte).toBeVisible();
  const mesures=await app.evaluate(()=>({
    page:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    carte:document.getElementById('stats-epargne-card').getBoundingClientRect().right,
    largeur:document.documentElement.clientWidth,
    canvas:document.getElementById('chart-epargne').getBoundingClientRect().width,
  }));
  expect(mesures.page,'défilement horizontal').toBeLessThanOrEqual(0);
  expect(mesures.carte).toBeLessThanOrEqual(mesures.largeur);
  expect(mesures.canvas).toBeGreaterThan(200);
});
