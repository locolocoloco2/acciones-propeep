// ══════════════════════════════════════════
// REPORTE DE NÓMINA — Formato oficial (estilo SIGEF)
// Legal horizontal · orden alfabético · cuadro de conceptos
// ══════════════════════════════════════════

var npNomina = [];  // array de empleados de la nómina cargada

// ── File handlers ──
function npHandle(input){ if(input.files && input.files.length) npLoad(input.files[0]); }
function npOnDrop(e){
  e.preventDefault();
  document.getElementById('np-zona').classList.remove('over');
  if(e.dataTransfer && e.dataTransfer.files.length) npLoad(e.dataTransfer.files[0]);
}

function npSt(id, msg, tipo){
  var el = document.getElementById('np-'+id);
  if(!el) return;
  el.textContent = msg; el.className = 'status '+tipo; el.style.display='block';
}

function npLoad(file){
  document.getElementById('np-label').textContent = 'Cargando '+file.name+'...';
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var wb = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      var ws = wb.Sheets[wb.SheetNames[0]];
      var all = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      var hi = all.findIndex(function(r){
        return r.some(function(c){ return String(c).toLowerCase().indexOf('cedula')>=0; });
      });
      if(hi<0) hi=3;
      npNomina = [];
      var periodo = '';
      all.slice(hi+1).forEach(function(r){
        if(!r[1]) return;
        var ced = String(r[1]).trim();
        if(!periodo && r[0]) periodo = String(r[0]).trim();
        npNomina.push({
          nomina:     String(r[0]||'').trim(),
          cedula:     ced,
          nombre:     String(r[2]||'').trim(),
          cargo:      String(r[3]||'').trim(),
          sueldo:     parseFloat(r[4])||0,   // Salario Bruto
          isr:        parseFloat(r[5])||0,
          inabi:      parseFloat(r[6])||0,   // SeguroVida (RD$25)
          afp:        parseFloat(r[7])||0,   // SS_Empleado
          sfs:        parseFloat(r[8])||0,   // SFS_Empleado
          sfs_empl:   parseFloat(r[9])||0,
          ss_empl:    parseFloat(r[10])||0,
          dep_adic:   parseFloat(r[11])||0,  // DescAdicional
          riesgo:     parseFloat(r[12])||0,
          total_desc: parseFloat(r[13])||0,
          neto:       parseFloat(r[14])||0,
        });
      });
      window._npPeriodo = periodo;
      document.getElementById('np-label').textContent = file.name+' — '+npNomina.length+' empleados ('+periodo+')';
      document.getElementById('np-zona').style.borderColor='var(--azul)';
      document.getElementById('np-zona').style.background='var(--azul-claro)';
      npRenderResumen();
      document.getElementById('np-preview').style.display='block';
      npSt('status', npNomina.length+' empleados cargados desde '+file.name, 'ok');
    }catch(err){ npSt('status','Error al leer: '+err.message,'err'); }
  };
  reader.readAsArrayBuffer(file);
}

function npRenderResumen(){
  function s(fn){ return npNomina.reduce(function(t,e){ return t+fn(e); },0); }
  function f(n){ return 'RD$ '+n.toLocaleString('es-DO',{minimumFractionDigits:2}); }
  var cards = [
    ['Empleados', String(npNomina.length), 'var(--azul)'],
    ['Salario Bruto', f(s(function(e){return e.sueldo;})), 'var(--azul)'],
    ['ISR', f(s(function(e){return e.isr;})), '#9E1B32'],
    ['AFP', f(s(function(e){return e.afp;})), '#9E1B32'],
    ['SFS', f(s(function(e){return e.sfs;})), '#9E1B32'],
    ['Total Descuentos', f(s(function(e){return e.total_desc;})), '#9E1B32'],
    ['Neto a Pagar', f(s(function(e){return e.neto;})), '#155C30'],
  ];
  document.getElementById('np-resumen').innerHTML = cards.map(function(c){
    return '<div style="background:var(--gris);border:1px solid var(--gris2);border-radius:var(--radio);padding:13px 15px">'+
      '<div style="font-size:9px;font-weight:700;color:var(--texto2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px">'+c[0]+'</div>'+
      '<div style="font-size:15px;font-weight:600;color:'+c[2]+';font-variant-numeric:tabular-nums">'+c[1]+'</div></div>';
  }).join('');
}

// ── Guardar en Supabase ──
async function npGuardar(){
  if(!npNomina.length){ npSt('pdf-status','No hay nómina cargada.','err'); return; }
  npSt('pdf-status','Guardando nómina en base de datos...','info');
  var per = window._npPeriodo || '';
  var tipo = document.getElementById('np-tipo').value;
  var rows = npNomina.map(function(e){
    return { periodo:per, tipo_nomina:tipo, cedula:e.cedula, nombre:e.nombre, cargo:e.cargo, sueldo:e.sueldo };
  });
  var ok = true;
  for(var i=0;i<rows.length;i+=100){
    var batch = rows.slice(i,i+100);
    try{
      var r = await fetch(SUPA_URL+'/rest/v1/nomina_historico', {
        method:'POST',
        headers: Object.assign({}, SUPA_HEADERS, {'Prefer':'resolution=merge-duplicates,return=minimal'}),
        body: JSON.stringify(batch),
      });
      if(!r.ok) ok=false;
    }catch(e){ ok=false; }
  }
  npSt('pdf-status', ok?'Nómina guardada correctamente en la base de datos.':'Error al guardar (verifica que la tabla nomina_historico exista).', ok?'ok':'err');
}

// ── Generar PDF estilo SIGEF ──
function npGenerarPDF(){
  if(!npNomina.length){ npSt('pdf-status','Carga la nómina primero.','err'); return; }

  var {jsPDF} = window.jspdf;
  var doc = new jsPDF({orientation:'landscape',unit:'mm',format:'legal'});
  var W=355.6, H=215.9, ML=8, MR=8, ANC=W-ML-MR;
  var NAVY=[13,30,63], NEGRO=[20,20,20];

  function hv(style,sz){ doc.setFont('helvetica',style); doc.setFontSize(sz); }

  var tipoNom   = (document.getElementById('np-tipo')||{value:'Fijo'}).value;
  var periodo   = window._npPeriodo || new Date().toISOString().slice(0,7);

  // Labels automáticos según tipo
  var tipoLabels = {
    Fijo:                  {estatus:'Fijo',      coletilla:'NÓMINA DE SUELDOS A PERSONAL FIJO'},
    Temporal:              {estatus:'Temporal',  coletilla:'NÓMINA DE SUELDOS A PERSONAL TEMPORAL'},
    Caracter_Eventual:     {estatus:'Caract. Eventual', coletilla:'NÓMINA DE SUELDOS A PERSONAL DE CARÁCTER EVENTUAL'},
    Compensacion_Seguridad:{estatus:'Comp. Seg.',coletilla:'COMPENSACIÓN SEGURIDAD MILITAR'},
  };
  var lbl   = tipoLabels[tipoNom] || {estatus:tipoNom, coletilla:'NÓMINA DE SUELDOS'};
  var estatus  = lbl.estatus;
  // Período en español para coletilla: "MAYO 2026" etc
  var meses = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  var periodoStr = periodo; // e.g. "2026-05"
  var mesNum = parseInt((periodo||'').split('-')[1]||0);
  var anioStr= (periodo||'').split('-')[0]||'';
  var mesStr = meses[mesNum]||periodo;
  var coletilla = lbl.coletilla + (mesStr ? ', '+mesStr+' '+anioStr : '');

  var institucion = 'DIRECCIÓN GENERAL DE PROYECTOS ESTRATÉGICOS Y ESPECIALES DE LA PRESIDENCIA';

  // Orden alfabético
  var emps = npNomina.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });

  // ── Columnas (mm) — sin "Total Ingresos", ajustadas para legal horizontal ──
  // Ancho total disponible: 339.6mm
  // Distribución: Nombre(68) Cargo(56) Estatus(22) Doc(28) Bruto(26) AFP(22) ISR(24) SFS(22) Otros(22) TotalDesc(26) Neto(26)
  // Suma: 68+56+22+28+26+22+24+22+22+26+26 = 342 ≈ 339.6 (ajustamos)
  var C = {
    nom:    ML,
    cargo:  ML+67,
    est:    ML+122,
    doc:    ML+144,
    bruto:  ML+172,
    afp:    ML+198,
    isr:    ML+220,
    sfs:    ML+244,
    otros:  ML+266,
    desc:   ML+288,
    neto:   ML+314,
  };
  var colWidths = {
    nom:67, cargo:55, est:22, doc:28, bruto:26, afp:22, isr:24, sfs:22, otros:22, desc:26, neto:25
  };

  function num(n){ return (n||0).toLocaleString('es-DO',{minimumFractionDigits:2}); }

  var totalPages = 0;  // will set after
  var pageNum = 0;

  function drawHeader(){
    pageNum++;
    // Logo
    try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG',ML,4,16,13); }catch(e){}
    // Título centrado
    hv('bold',13); doc.setTextColor(...NEGRO);
    doc.text('Reporte de Nómina', W/2, 10, {align:'center'});
    hv('normal',7.5); doc.setTextColor(50,50,50);
    doc.text('Nómina Normal - '+periodoStr+' - PROPEEP - '+institucion, W/2, 15, {align:'center'});
    doc.text('Concepto Pago Sueldo: '+estatus+' Correspondiente al mes de '+mesStr+' '+anioStr, W/2, 19, {align:'center'});
    // Fecha + página
    hv('normal',7); doc.setTextColor(90,90,90);
    var hoy = new Date();
    doc.text('Fecha Impresión: '+hoy.toLocaleDateString('es-DO')+' '+hoy.toLocaleTimeString('es-DO'), W-MR, 8, {align:'right'});
    doc.text('Pág.: '+pageNum, W-MR, 13, {align:'right'});
    // Coletilla
    hv('normal',6.5); doc.setTextColor(60,60,60);
    doc.text('Coletilla: '+coletilla, ML, 22);
  }

  function drawTableHeader(y){
    doc.setFillColor(...NAVY); doc.rect(ML,y,ANC,8,'F');
    hv('bold',6.8); doc.setTextColor(255,255,255);
    doc.text('Servidor Público',            C.nom+1,          y+5.2);
    doc.text('Cargo',                       C.cargo+1,        y+5.2);
    doc.text('Est.',                        C.est+1,          y+5.2);
    doc.text('Documento',                   C.doc+1,          y+5.2);
    doc.text('Salario Bruto',               C.bruto+colWidths.bruto-1,  y+5.2, {align:'right'});
    doc.text('AFP',                         C.afp+colWidths.afp-1,      y+5.2, {align:'right'});
    doc.text('ISR',                         C.isr+colWidths.isr-1,      y+5.2, {align:'right'});
    doc.text('SFS',                         C.sfs+colWidths.sfs-1,      y+5.2, {align:'right'});
    doc.text('Otros Desc.',                 C.otros+colWidths.otros-1,  y+5.2, {align:'right'});
    doc.text('Total Desc.',                 C.desc+colWidths.desc-1,    y+5.2, {align:'right'});
    doc.text('Neto',                        C.neto+colWidths.neto-1,    y+5.2, {align:'right'});
    return y+8;
  }

  function measureRowHeight(e){
    // Measure how many lines nombre and cargo need
    var nomLines = doc.splitTextToSize(e.nombre||'', colWidths.nom-2).length;
    var carLines = doc.splitTextToSize(e.cargo||'', colWidths.cargo-2).length;
    var lines = Math.max(nomLines, carLines, 1);
    return Math.max(5, lines * 3.4 + 2);
  }

  // ── Render pages ──
  drawHeader();
  var y = drawTableHeader(24);

  var T = {bruto:0,afp:0,isr:0,sfs:0,otros:0,desc:0,neto:0};

  emps.forEach(function(e,i){
    hv('normal',6.8);
    var rh = measureRowHeight(e);
    if(y+rh > H-14){
      doc.addPage();
      drawHeader();
      y = drawTableHeader(24);
    }
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ML,y,ANC,rh,'F'); }
    doc.setTextColor(...NEGRO);
    // Multi-line text for nombre and cargo
    var nomLines = doc.splitTextToSize(e.nombre||'', colWidths.nom-2);
    var carLines = doc.splitTextToSize(e.cargo||'', colWidths.cargo-2);
    var textY = y + 3.2;
    hv('normal',6.8); doc.setTextColor(...NEGRO);
    doc.text(nomLines, C.nom+1, textY);
    doc.text(carLines, C.cargo+1, textY);
    doc.text(estatus, C.est+1, textY);
    doc.text(fmtCed(e.cedula||''), C.doc+1, textY);
    var otros = (e.inabi||0) + (e.dep_adic||0);
    doc.text(num(e.sueldo),    C.bruto+colWidths.bruto-1, textY, {align:'right'});
    doc.text(num(e.afp),       C.afp+colWidths.afp-1,     textY, {align:'right'});
    doc.text(num(e.isr),       C.isr+colWidths.isr-1,     textY, {align:'right'});
    doc.text(num(e.sfs),       C.sfs+colWidths.sfs-1,     textY, {align:'right'});
    doc.text(num(otros),       C.otros+colWidths.otros-1, textY, {align:'right'});
    doc.text(num(e.total_desc),C.desc+colWidths.desc-1,   textY, {align:'right'});
    doc.text(num(e.neto),      C.neto+colWidths.neto-1,   textY, {align:'right'});
    // Row separator
    doc.setDrawColor(220,222,228); doc.setLineWidth(0.15);
    doc.line(ML, y+rh, W-MR, y+rh);
    T.bruto+=e.sueldo; T.afp+=e.afp; T.isr+=e.isr;
    T.sfs+=e.sfs; T.otros+=otros; T.desc+=e.total_desc; T.neto+=e.neto;
    y+=rh;
  });

  // Total General row
  if(y+7 > H-14){ doc.addPage(); drawHeader(); y=24; }
  doc.setFillColor(...NAVY); doc.rect(ML,y,ANC,7,'F');
  hv('bold',7); doc.setTextColor(255,255,255);
  doc.text('TOTAL GENERAL  ('+emps.length+' servidores)', C.nom+1, y+4.8);
  doc.text(num(T.bruto), C.bruto+colWidths.bruto-1, y+4.8, {align:'right'});
  doc.text(num(T.afp),   C.afp+colWidths.afp-1,     y+4.8, {align:'right'});
  doc.text(num(T.isr),   C.isr+colWidths.isr-1,     y+4.8, {align:'right'});
  doc.text(num(T.sfs),   C.sfs+colWidths.sfs-1,     y+4.8, {align:'right'});
  doc.text(num(T.otros), C.otros+colWidths.otros-1, y+4.8, {align:'right'});
  doc.text(num(T.desc),  C.desc+colWidths.desc-1,   y+4.8, {align:'right'});
  doc.text(num(T.neto),  C.neto+colWidths.neto-1,   y+4.8, {align:'right'});
  y+=7;

  // ── Cuadro de conceptos — en su propia página con header ──
  doc.addPage();
  drawHeader();
  y = 30;

  var sumInabi   = npNomina.reduce(function(t,e){return t+(e.inabi||0);},0);
  var sumDepAdic = npNomina.reduce(function(t,e){return t+(e.dep_adic||0);},0);
  var sumSfsEmpl = npNomina.reduce(function(t,e){return t+(e.sfs_empl||0);},0);
  var sumSsEmpl  = npNomina.reduce(function(t,e){return t+(e.ss_empl||0);},0);
  var sumRiesgo  = npNomina.reduce(function(t,e){return t+(e.riesgo||0);},0);

  var conceptos = [
    ['100-08',  'Salario',                              T.bruto],
    ['500-01',  'AFP',                                  T.afp],
    ['500-02',  'Impuesto Sobre la Renta',              T.isr],
    ['500-03',  'Seguro de Vida (INABI)',                sumInabi],
    ['510-02',  'Seguro Familiar de Salud (SFS)',        T.sfs],
    ['510-03',  'SFS Padres / Dependientes Adicionales', sumDepAdic],
    ['900-01',  'Aporte Fondos de Pensiones (Empleador)',sumSsEmpl],
    ['900-02',  'Aporte Seguro de Riesgo Laboral',      sumRiesgo],
    ['900-03',  'Aporte Seguro Familiar de Salud (Empleador)', sumSfsEmpl],
  ];

  // Header de conceptos tabla
  var cw1=40, cw2=160, cw3=50; // Código | Concepto | Monto
  doc.setFillColor(...NAVY); doc.rect(ML,y,cw1+cw2+cw3,7,'F');
  hv('bold',7.5); doc.setTextColor(255,255,255);
  doc.text('Código SIGEF', ML+2,          y+5);
  doc.text('Beneficiario / Concepto',     ML+cw1+2,    y+5);
  doc.text('Monto (RD$)', ML+cw1+cw2+cw3-2, y+5, {align:'right'});
  y+=7;

  conceptos.forEach(function(c,i){
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ML,y,cw1+cw2+cw3,5.5,'F'); }
    hv('normal',7.5); doc.setTextColor(...NEGRO);
    doc.text(c[0],    ML+2,              y+3.8);
    doc.text(c[1],    ML+cw1+2,         y+3.8);
    doc.text(num(c[2]), ML+cw1+cw2+cw3-2, y+3.8, {align:'right'});
    doc.setDrawColor(220,222,228); doc.setLineWidth(0.15);
    doc.line(ML, y+5.5, ML+cw1+cw2+cw3, y+5.5);
    y+=5.5;
  });
  y+=10;

  // ── Firmas ──
  var firmaH = 28;
  if(y+firmaH > H-10){ doc.addPage(); drawHeader(); y=30; }
  var fw = 70;
  var fx1=ML+10, fx2=ML+10+fw+20, fx3=ML+10+2*(fw+20), fx4=ML+10+3*(fw+20);
  doc.setDrawColor(...NEGRO); doc.setLineWidth(0.4);
  [fx1,fx2,fx3,fx4].forEach(function(fx){ doc.line(fx,y,fx+fw,y); });
  y+=5;
  hv('normal',7); doc.setTextColor(50,50,50);
  doc.text('Preparado por:',    fx1, y);
  doc.text('Aprobado por:',     fx2, y);
  doc.text('Aprobado por:',     fx3, y);
  doc.text('Revisado por:',     fx4, y);
  y+=5;
  hv('bold',7); doc.setTextColor(...NEGRO);
  doc.text('Responsable de Nómina',    fx1, y);
  doc.text('Responsable Financiero',   fx2, y);
  doc.text('Responsable Institución',  fx3, y);
  doc.text('Servicios Personales CGR', fx4, y);
  y+=12;
  // Segunda fila de firmas
  var fx5=ML+10, fx6=ML+10+(fw+20)*2;
  [fx5,fx6].forEach(function(fx){ doc.line(fx,y,fx+fw,y); });
  y+=5;
  hv('normal',7); doc.setTextColor(50,50,50);
  doc.text('Firmas OPCIONALES, según aplique:', fx5-10, y-5);
  doc.text('Aprobado por:',                    fx5, y);
  doc.text('Aprobado por:',                    fx6, y);
  y+=5;
  hv('bold',7); doc.setTextColor(...NEGRO);
  doc.text('Resp. Advo. y Financiero adscrita', fx5, y);
  doc.text('Resp. Institución adscrita',        fx6, y);

  // Footer en todas las páginas
  var totalP = doc.internal.getNumberOfPages();
  for(var p=1;p<=totalP;p++){
    doc.setPage(p);
    var fy=H-5;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(ML,fy-3,W-MR,fy-3);
    hv('normal',6.5); doc.setTextColor(110,110,110);
    doc.text('Coletilla: '+coletilla, ML, fy);
    doc.text('Pág. '+p+' / '+totalP, W-MR, fy, {align:'right'});
  }

  doc.save('Reporte_Nomina_'+tipoNom+'_'+periodoStr+'.pdf');
  npSt('pdf-status','Reporte de Nómina exportado correctamente.','ok');
}
