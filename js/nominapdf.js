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

  // Llave presupuestaria — solo cambia la cuenta (CCP) según el tipo
  var cuentas = {
    Fijo:                  '2.1.1.1.01',
    Temporal:              '2.1.1.2.08',
    Caracter_Eventual:     '2.1.1.2.09',
    Compensacion_Seguridad:'2.1.2.2.05',
  };
  var cuenta = cuentas[tipoNom] || '2.1.1.1.01';
  var llavePresup = 'Cap:0201 SubCap:06 UE:0009 Prog:19 Prod:01 Proy:00 Act:0001 FueEsp:0100 Org:100 Reg:98 Prov:99 Mun:9999 CCP:'+cuenta+' Fun:1.1.02 Obj:00000';
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

  function drawHeader(esRecap){
    pageNum++;
    // Logo
    try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG',ML,3,15,15.7); }catch(e){}
    // Título centrado
    hv('bold',13); doc.setTextColor(...NEGRO);
    if(esRecap){
      doc.text('Recapitulación de Nómina', W/2, 10, {align:'center'});
      // Sin subtítulo en la página de recapitulación (se ahorra espacio)
    } else {
      doc.text('Reporte de Nómina', W/2, 10, {align:'center'});
      hv('normal',7.5); doc.setTextColor(50,50,50);
      doc.text('Nómina Normal - '+periodoStr+' - PROPEEP - '+institucion, W/2, 15, {align:'center'});
      doc.text('Concepto Pago Sueldo: '+estatus+' Correspondiente al mes de '+mesStr+' '+anioStr, W/2, 19, {align:'center'});
    }
    // Fecha + página
    hv('normal',7); doc.setTextColor(90,90,90);
    var hoy = new Date();
    doc.text('Fecha Impresión: '+hoy.toLocaleDateString('es-DO')+' '+hoy.toLocaleTimeString('es-DO'), W-MR, 8, {align:'right'});
    doc.text('Pág.: '+pageNum, W-MR, 13, {align:'right'});
    // Coletilla (toda en negrita)
    hv('bold',6.8); doc.setTextColor(40,40,40);
    doc.text('Coletilla: '+coletilla, ML, 21.5);
    // Llave presupuestaria debajo — cada etiqueta Cap:/SubCap: en negrita, su valor en regular
    npDrawLlave(ML, 25);
  }

  // Dibuja la llave presupuestaria con etiquetas en negrita y valores en regular
  function npDrawLlave(x0, yL){
    var partes = [
      ['Cap:','0201'],['SubCap:','06'],['UE:','0009'],['Prog:','19'],['Prod:','01'],
      ['Proy:','00'],['Act:','0001'],['FueEsp:','0100'],['Org:','100'],['Reg:','98'],
      ['Prov:','99'],['Mun:','9999'],['CCP:',cuenta],['Fun:','1.1.02'],['Obj:','00000'],
    ];
    var x = x0;
    doc.setFontSize(6.8); doc.setTextColor(80,80,80);
    partes.forEach(function(p){
      doc.setFont('helvetica','bold');
      doc.text(p[0], x, yL);
      x += doc.getTextWidth(p[0]) + 0.4;
      doc.setFont('helvetica','normal');
      doc.text(p[1], x, yL);
      x += doc.getTextWidth(p[1]) + 2.2;
    });
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

  // ── Render pages — TODAS las filas con el MISMO alto, contenido centrado ──
  hv('normal',6.8);
  var LINE_H = 3.0;    // separación entre líneas dentro de una celda
  var ROW_H  = 8.0;    // alto uniforme: cómodo para 2 líneas, no apretado

  drawHeader();
  var y = drawTableHeader(29);

  var T = {bruto:0,afp:0,isr:0,sfs:0,otros:0,desc:0,neto:0};

  emps.forEach(function(e,i){
    if(y+ROW_H > H-14){
      doc.addPage();
      drawHeader();
      y = drawTableHeader(29);
    }
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ML,y,ANC,ROW_H,'F'); }
    hv('normal',6.8); doc.setTextColor(...NEGRO);

    // Nombre y cargo: máximo 2 líneas (si excede, se trunca con elipsis implícita)
    var nomLines = doc.splitTextToSize(e.nombre||'', colWidths.nom-2).slice(0,2);
    var carLines = doc.splitTextToSize(e.cargo||'', colWidths.cargo-2).slice(0,2);

    var midY = y + ROW_H/2;  // centro vertical real de la fila

    // Cada bloque se centra respecto a midY según su número de líneas
    var nomStartY = midY - ((nomLines.length-1)*LINE_H)/2 + 1.0;
    nomLines.forEach(function(ln, li){ doc.text(ln, C.nom+1, nomStartY + li*LINE_H); });
    var carStartY = midY - ((carLines.length-1)*LINE_H)/2 + 1.0;
    carLines.forEach(function(ln, li){ doc.text(ln, C.cargo+1, carStartY + li*LINE_H); });

    // Columnas de una sola línea: centradas en midY
    var cellY = midY + 1.0;
    doc.text(estatus, C.est+1, cellY);
    doc.text(fmtCed(e.cedula||''), C.doc+1, cellY);
    var otros = (e.inabi||0) + (e.dep_adic||0);
    doc.text(num(e.sueldo),    C.bruto+colWidths.bruto-1, cellY, {align:'right'});
    doc.text(num(e.afp),       C.afp+colWidths.afp-1,     cellY, {align:'right'});
    doc.text(num(e.isr),       C.isr+colWidths.isr-1,     cellY, {align:'right'});
    doc.text(num(e.sfs),       C.sfs+colWidths.sfs-1,     cellY, {align:'right'});
    doc.text(num(otros),       C.otros+colWidths.otros-1, cellY, {align:'right'});
    doc.text(num(e.total_desc),C.desc+colWidths.desc-1,   cellY, {align:'right'});
    doc.text(num(e.neto),      C.neto+colWidths.neto-1,   cellY, {align:'right'});

    doc.setDrawColor(220,222,228); doc.setLineWidth(0.15);
    doc.line(ML, y+ROW_H, W-MR, y+ROW_H);
    T.bruto+=e.sueldo; T.afp+=e.afp; T.isr+=e.isr;
    T.sfs+=e.sfs; T.otros+=otros; T.desc+=e.total_desc; T.neto+=e.neto;
    y+=ROW_H;
  });

  // Total General row
  if(y+7 > H-14){ doc.addPage(); drawHeader(); y=29; }
  doc.setFillColor(235,238,243); doc.rect(ML,y,ANC,7,'F');
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.rect(ML,y,ANC,7,'S');
  hv('bold',7); doc.setTextColor(...NAVY);
  doc.text('TOTAL GENERAL  ('+emps.length+' servidores)', C.nom+1, y+4.8);
  doc.text(num(T.bruto), C.bruto+colWidths.bruto-1, y+4.8, {align:'right'});
  doc.text(num(T.afp),   C.afp+colWidths.afp-1,     y+4.8, {align:'right'});
  doc.text(num(T.isr),   C.isr+colWidths.isr-1,     y+4.8, {align:'right'});
  doc.text(num(T.sfs),   C.sfs+colWidths.sfs-1,     y+4.8, {align:'right'});
  doc.text(num(T.otros), C.otros+colWidths.otros-1, y+4.8, {align:'right'});
  doc.text(num(T.desc),  C.desc+colWidths.desc-1,   y+4.8, {align:'right'});
  doc.text(num(T.neto),  C.neto+colWidths.neto-1,   y+4.8, {align:'right'});
  y+=7;

  // ── RECAPITULACIÓN DE NÓMINA — página propia con su propio título ──
  doc.addPage();
  drawHeader(true);
  y = 31;

  var sumInabi   = npNomina.reduce(function(t,e){return t+(e.inabi||0);},0);
  var sumDepAdic = npNomina.reduce(function(t,e){return t+(e.dep_adic||0);},0);
  var sumSfsEmpl = npNomina.reduce(function(t,e){return t+(e.sfs_empl||0);},0);
  var sumSsEmpl  = npNomina.reduce(function(t,e){return t+(e.ss_empl||0);},0);
  var sumRiesgo  = npNomina.reduce(function(t,e){return t+(e.riesgo||0);},0);
  var creditoF   = parseFloat((document.getElementById('np-credito-fiscal')||{value:0}).value)||0;

  // 5 columnas: SIGEF | RNC | Beneficiario | Concepto | Monto
  var conceptos = [
    ['02001','499999984','COLECTOR DE IMPUESTOS INTERNOS','IMPUESTO SOBRE LA RENTA', T.isr],
    ['02002','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','SEGURIDAD SOCIAL', T.afp],
    ['03007','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','APORTE SEG. FAMILIAR DE SALUD EMPLEADO', T.sfs],
    ['03002','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','SEGURO PERCAPITA (SFS PADRES)', sumDepAdic],
    ['03004','430149462','INSTITUTO DE AUXILIOS Y VIVIENDAS','SEG. VIDA, CES. E INVALIDEZ', sumInabi],
    ['','499999984','COLECTOR DE IMPUESTOS INTERNOS','CREDITO FISCAL PARA ISR', creditoF],
    ['','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','APORTE AFP EMPLEADOR', sumSsEmpl],
    ['','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','APORTE SFS EMPLEADOR', sumSfsEmpl],
    ['','430149454','TESORERIA DE LA SEGURIDAD SOCIAL','APORTE RIESGO LABORAL', sumRiesgo],
  ];

  var k1=22, k2=28, k3=110, k4=115, k5=38;
  var ctblW = k1+k2+k3+k4+k5;
  var ctblX = (W - ctblW)/2;
  var KX = {sigef:ctblX, rnc:ctblX+k1, ben:ctblX+k1+k2, con:ctblX+k1+k2+k3, mon:ctblX+ctblW};

  doc.setFillColor(235,238,243); doc.rect(ctblX,y,ctblW,7,'F');
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.rect(ctblX,y,ctblW,7,'S');
  hv('bold',8); doc.setTextColor(...NAVY);
  doc.text('SIGEF', KX.sigef+2, y+4.8);
  doc.text('RNC', KX.rnc+2, y+4.8);
  doc.text('BENEFICIARIO', KX.ben+2, y+4.8);
  doc.text('CONCEPTO', KX.con+2, y+4.8);
  doc.text('MONTO (RD$)', KX.mon-2, y+4.8, {align:'right'});
  y+=7;

  conceptos.forEach(function(c,i){
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ctblX,y,ctblW,6,'F'); }
    hv('normal',8); doc.setTextColor(...NEGRO);
    doc.text(c[0], KX.sigef+2, y+4);
    doc.text(c[1], KX.rnc+2, y+4);
    doc.text((c[2]||'').substring(0,42), KX.ben+2, y+4);
    doc.text((c[3]||'').substring(0,44), KX.con+2, y+4);
    hv('bold',8);
    doc.text(num(c[4]), KX.mon-2, y+4, {align:'right'});
    doc.setDrawColor(220,222,228); doc.setLineWidth(0.15);
    doc.line(ctblX, y+6, ctblX+ctblW, y+6);
    y+=6;
  });
  y+=4;

  // ══ BLOQUE FINAL (totales + firmas + certifico) — SIEMPRE JUNTO ══
  // Alto real del bloque: 3 totales(26) + respiro(16) + firmas(16) + respiro(16) + certifico(20) ≈ 94mm
  var BLOQUE_H = 101;
  if(y + BLOQUE_H > H-14){
    doc.addPage();
    drawHeader(true);
    y = 31;
  }

  // 3 totales con borde
  function totalBar(label, monto){
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
    doc.rect(ctblX,y,ctblW,7,'S');
    hv('bold',8.5); doc.setTextColor(...NEGRO);
    doc.text(label, ctblX+2, y+4.8);
    doc.text(num(monto), ctblX+ctblW-2, y+4.8, {align:'right'});
    y+=7+1.5;
  }
  // Total descuentos al empleado incluye el crédito fiscal restado (como en SIGEF: el crédito reduce el ISR a pagar)
  var totalDescEmp = T.desc - creditoF;
  var netoConCredito = T.neto + creditoF;
  totalBar('TOTAL SUELDOS BRUTOS', T.bruto);
  totalBar('TOTAL DESCUENTOS EMPLEADOS', totalDescEmp);
  totalBar('TOTAL SUELDO NETO', netoConCredito);
  y+=30;

  // ── 4 FIRMAS configurables ──
  var firmantes = (window.PROPEEP_CONFIG && window.PROPEEP_CONFIG.firmantes) || [
    {nombre:'PEDRO A. CID MARTINEZ', cargo:'ENCARGADO (A) DE REGISTRO, CONTROL Y NOMINA'},
    {nombre:'JONEY R. DOTEL COLL', cargo:'DIRECTOR (A) DE RECURSOS HUMANOS'},
    {nombre:'JESUS MIGUEL OZUNA PAULINO', cargo:'DIRECTOR ADMINISTRATIVO FINANCIERO (INTERINO)'},
    {nombre:'ROBERT D. POLANCO TEJADA', cargo:'DIRECTOR (A) DE PROYECTOS ESTRATEGICOS Y ESPECIALES DE LA PRESIDENCIA'},
  ];

  var fw = 74;
  var gap = (ANC - 4*fw)/3;
  var fxs = [0,1,2,3].map(function(k){ return ML + k*(fw+gap); });
  doc.setDrawColor(...NEGRO); doc.setLineWidth(0.4);
  fxs.forEach(function(fx){ doc.line(fx, y, fx+fw, y); });
  var ny = y+4.5;
  firmantes.forEach(function(fm, k){
    var fx = fxs[k];
    hv('bold',7.5); doc.setTextColor(...NEGRO);
    doc.text(fm.nombre||'', fx+fw/2, ny, {align:'center'});
    hv('normal',6.8); doc.setTextColor(70,70,70);
    var cargoLines = doc.splitTextToSize(fm.cargo||'', fw);
    cargoLines.forEach(function(ln, li){
      doc.text(ln, fx+fw/2, ny+4 + li*3, {align:'center'});
    });
  });
  y = ny + 20;

  // ── Certificación (letra regular, alineada con los márgenes de la tabla de conceptos) ──
  hv('normal',7); doc.setTextColor(...NEGRO);
  var certText = 'CERTIFICO QUE ESTA NOMINA DE PAGO, CONSTA DE '+emps.length+' PERSONAS, ESTA CORRECTA Y COMPLETA Y QUE LAS PERSONAS ENUMERADAS EN LA MISMA SON LAS QUE A ESTA FECHA FIGURAN EN LOS RECORDS DE PERSONAL QUE MANTIENE LA SECCION DE SERVICIOS PERSONALES DE LA CONTRALORIA GENERAL DE LA REPUBLICA.';
  var certLines = doc.splitTextToSize(certText, ctblW);
  certLines.forEach(function(ln, li){
    doc.text(ln, ctblX, y + li*4.5);
  });

  // Footer con numeración en todas las páginas
  var totalP = doc.internal.getNumberOfPages();
  for(var p=1;p<=totalP;p++){
    doc.setPage(p);
    var fy=H-6;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(ML,fy-3,W-MR,fy-3);
    hv('normal',6.3); doc.setTextColor(110,110,110);
    doc.text('Coletilla: '+coletilla, ML, fy);
    doc.text('Pág. '+p+' / '+totalP, W-MR, fy, {align:'right'});
  }

  doc.save('Reporte_Nomina_'+tipoNom+'_'+periodoStr+'.pdf');
  npSt('pdf-status','Reporte de Nómina exportado correctamente.','ok');
}
