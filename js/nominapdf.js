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
  // LEGAL HORIZONTAL: 355.6 x 215.9 mm
  var doc = new jsPDF({orientation:'landscape',unit:'mm',format:'legal'});
  var W=355.6, H=215.9, ML=10, MR=10, ANC=W-ML-MR;
  var NAVY=[13,30,63], NEGRO=[20,20,20];

  function hv(style,sz){ doc.setFont('helvetica',style); doc.setFontSize(sz); }

  var institucion = (document.getElementById('np-institucion')||{value:''}).value.trim();
  var subtitulo   = (document.getElementById('np-subtitulo')||{value:''}).value.trim();
  var coletilla   = (document.getElementById('np-coletilla')||{value:''}).value.trim();
  var tipoNom     = (document.getElementById('np-tipo')||{value:'Fijo'}).value;
  var periodo     = window._npPeriodo || new Date().toISOString().slice(0,7);
  var tipoLabel   = {Fijo:'Fijo',Temporal:'Temporal',Caracter_Eventual:'Carácter Eventual',Compensacion_Seguridad:'Compensación y Seguridad'}[tipoNom]||tipoNom;
  var estatusCorto= {Fijo:'Fijo',Temporal:'Temporal',Caracter_Eventual:'Caract. Eventual',Compensacion_Seguridad:'Comp. Seguridad'}[tipoNom]||tipoNom;

  // Orden alfabético
  var emps = npNomina.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });

  // Columnas (mm) — estilo SIGEF
  var C = {
    nom: ML,
    cargo: ML+78,
    est: ML+140,
    doc: ML+170,
    bruto: ML+198,
    ing: ML+222,
    afp: ML+246,
    isr: ML+268,
    sfs: ML+290,
    otros: ML+312,
    desc: ML+330,
    neto: ANC+ML,
  };

  var pageNum = 0;
  function header(){
    pageNum++;
    // Logo
    try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG',ML,6,18,15); }catch(e){}
    hv('bold',13); doc.setTextColor(...NEGRO);
    doc.text('Reporte de Nómina', W/2, 11, {align:'center'});
    hv('normal',8); doc.setTextColor(60,60,60);
    doc.text(subtitulo+' - '+periodo, W/2, 16, {align:'center'});
    doc.text('Concepto Pago Sueldo: '+tipoLabel+' Correspondiente a '+periodo, W/2, 20, {align:'center'});
    // Fecha impresión derecha
    hv('normal',7); doc.setTextColor(90,90,90);
    var hoy = new Date();
    doc.text('Fecha Impresión: '+hoy.toLocaleDateString('es-DO')+' '+hoy.toLocaleTimeString('es-DO'), W-MR, 9, {align:'right'});
    doc.text('Pág.: '+pageNum, W-MR, 13, {align:'right'});

    // Cabecera de tabla
    var hy = 26;
    doc.setFillColor(...NAVY); doc.rect(ML,hy,ANC,8,'F');
    hv('bold',7); doc.setTextColor(255,255,255);
    doc.text('Servidor Público', C.nom+1, hy+5);
    doc.text('Cargo', C.cargo, hy+5);
    doc.text('Estatus', C.est, hy+5);
    doc.text('Documento', C.doc, hy+5);
    doc.text('Salario Bruto', C.bruto+18, hy+5, {align:'right'});
    doc.text('Total Ing.', C.ing+18, hy+5, {align:'right'});
    doc.text('AFP', C.afp+16, hy+5, {align:'right'});
    doc.text('ISR', C.isr+16, hy+5, {align:'right'});
    doc.text('SFS', C.sfs+16, hy+5, {align:'right'});
    doc.text('Otros Desc.', C.otros+14, hy+5, {align:'right'});
    doc.text('Total Desc.', C.desc+16, hy+5, {align:'right'});
    doc.text('Neto', C.neto, hy+5, {align:'right'});
    return hy+8;
  }

  function num(n){ return n.toLocaleString('es-DO',{minimumFractionDigits:2}); }

  var y = header();
  var rh = 4.6;

  // Totales generales
  var T = {bruto:0,ing:0,afp:0,isr:0,sfs:0,otros:0,desc:0,neto:0};

  emps.forEach(function(e,i){
    if(y > H-20){ doc.addPage(); y = header(); }
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ML,y,ANC,rh,'F'); }
    hv('normal',6.8); doc.setTextColor(...NEGRO);
    doc.text((e.nombre||'').substring(0,46), C.nom+1, y+3.2);
    doc.text((e.cargo||'').substring(0,36), C.cargo, y+3.2);
    doc.text(estatusCorto, C.est, y+3.2);
    doc.text(fmtCed(e.cedula||''), C.doc, y+3.2);
    var otros = e.inabi + e.dep_adic;  // RD$25 INABI + Dep Adicional
    doc.text(num(e.sueldo), C.bruto+18, y+3.2, {align:'right'});
    doc.text(num(e.sueldo), C.ing+18, y+3.2, {align:'right'});
    doc.text(num(e.afp), C.afp+16, y+3.2, {align:'right'});
    doc.text(num(e.isr), C.isr+16, y+3.2, {align:'right'});
    doc.text(num(e.sfs), C.sfs+16, y+3.2, {align:'right'});
    doc.text(num(otros), C.otros+14, y+3.2, {align:'right'});
    doc.text(num(e.total_desc), C.desc+16, y+3.2, {align:'right'});
    doc.text(num(e.neto), C.neto, y+3.2, {align:'right'});
    doc.setDrawColor(228,230,235); doc.setLineWidth(0.1);
    doc.line(ML,y+rh,W-MR,y+rh);
    T.bruto+=e.sueldo; T.ing+=e.sueldo; T.afp+=e.afp; T.isr+=e.isr;
    T.sfs+=e.sfs; T.otros+=otros; T.desc+=e.total_desc; T.neto+=e.neto;
    y+=rh;
  });

  // Fila Total General
  if(y > H-16){ doc.addPage(); y=header(); }
  doc.setFillColor(...NAVY); doc.rect(ML,y,ANC,6,'F');
  hv('bold',7); doc.setTextColor(255,255,255);
  doc.text('TOTAL GENERAL ('+emps.length+')', C.nom+1, y+4);
  doc.text(num(T.bruto), C.bruto+18, y+4, {align:'right'});
  doc.text(num(T.ing), C.ing+18, y+4, {align:'right'});
  doc.text(num(T.afp), C.afp+16, y+4, {align:'right'});
  doc.text(num(T.isr), C.isr+16, y+4, {align:'right'});
  doc.text(num(T.sfs), C.sfs+16, y+4, {align:'right'});
  doc.text(num(T.otros), C.otros+14, y+4, {align:'right'});
  doc.text(num(T.desc), C.desc+16, y+4, {align:'right'});
  doc.text(num(T.neto), C.neto, y+4, {align:'right'});
  y+=6+8;

  // ── Cuadro de conceptos ──
  // INABI(25) y servicios funerarios se separan; aquí presentamos los conceptos disponibles
  var sumInabi   = npNomina.reduce(function(t,e){return t+e.inabi;},0);
  var sumDepAdic = npNomina.reduce(function(t,e){return t+e.dep_adic;},0);
  var sumSfsEmpl = npNomina.reduce(function(t,e){return t+e.sfs_empl;},0);
  var sumSsEmpl  = npNomina.reduce(function(t,e){return t+e.ss_empl;},0);
  var sumRiesgo  = npNomina.reduce(function(t,e){return t+e.riesgo;},0);

  var conceptos = [
    ['100-08 - Salario', T.bruto],
    ['500-01 - AFP', T.afp],
    ['500-02 - Impuesto Sobre la Renta', T.isr],
    ['500-03 - Seguro de Vida (INABI)', sumInabi],
    ['510-02 - Seguro Familiar de Salud (SFS)', T.sfs],
    ['510-03 - SFS Padres / Dependientes Adicionales', sumDepAdic],
    ['900-01 - Aporte Fondos de Pensiones (Empleador)', sumSsEmpl],
    ['900-02 - Aporte Seguro de Riesgo Laboral', sumRiesgo],
    ['900-03 - Aporte Seguro Familiar de Salud (Empleador)', sumSfsEmpl],
  ];

  if(y > H-50){ doc.addPage(); y=20; }
  hv('bold',8); doc.setTextColor(...NAVY);
  doc.text('CONCEPTOS', ML, y); y+=2;
  doc.setFillColor(...NAVY); doc.rect(ML,y,140,6,'F');
  hv('bold',7); doc.setTextColor(255,255,255);
  doc.text('Concepto', ML+2, y+4);
  doc.text('Monto (RD$)', ML+138, y+4, {align:'right'});
  y+=6;
  conceptos.forEach(function(c,i){
    if(i%2===0){ doc.setFillColor(244,245,247); doc.rect(ML,y,140,5,'F'); }
    hv('normal',7); doc.setTextColor(...NEGRO);
    doc.text(c[0], ML+2, y+3.4);
    doc.text(num(c[1]), ML+138, y+3.4, {align:'right'});
    y+=5;
  });

  // ── Firmas (nunca solas) ──
  var firmaH = 30;
  if(y + firmaH > H-10){ doc.addPage(); y=24; }
  else { y+=12; }
  var fx1=ML+10, fx2=ML+110, fx3=ML+210;
  doc.setDrawColor(...NEGRO); doc.setLineWidth(0.4);
  [fx1,fx2,fx3].forEach(function(fx){ doc.line(fx, y, fx+70, y); });
  hv('normal',7.5); doc.setTextColor(...NEGRO);
  doc.text('Preparado por', fx1, y+5);
  doc.text('Revisado por', fx2, y+5);
  doc.text('Aprobado por', fx3, y+5);
  hv('bold',7.5);
  doc.text('Responsable de Nómina', fx1, y+9);
  doc.text('Responsable Financiero', fx2, y+9);
  doc.text('Responsable Institución', fx3, y+9);

  // Footer
  var fy=H-6;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.3); doc.line(ML,fy-3,W-MR,fy-3);
  hv('normal',6.5); doc.setTextColor(110,110,110);
  doc.text('Coletilla: '+coletilla+' · '+institucion, ML, fy);

  doc.save('Reporte_Nomina_'+tipoNom+'_'+periodo+'.pdf');
  npSt('pdf-status','Reporte de Nómina exportado correctamente.','ok');
}
