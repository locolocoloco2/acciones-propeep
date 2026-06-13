// ══════════════════════════════════════════
// REPORTE DE NOVEDADES — Por tipo de nómina
// ══════════════════════════════════════════

// Mapeo: naturaleza (clave Supabase) → {tipo, concepto}
const REP_MAPEO = {
  nom_ord:        {tipo:'ENTRADA', concepto:'INGRESO'},
  nom_nom:        {tipo:'ENTRADA', concepto:'INGRESO'},
  contrato:       {tipo:'ENTRADA', concepto:'CONTRATO'},
  suplencia:      {tipo:'ENTRADA', concepto:'SUPLENCIA'},
  reingreso:      {tipo:'ENTRADA', concepto:'REINGRESO'},
  promocion:      {tipo:'CAMBIO',  concepto:'PROMOCION'},
  reclasificacion:{tipo:'CAMBIO',  concepto:'RECLASIFICACION'},
  aumento:        {tipo:'CAMBIO',  concepto:'AUMENTO DE SUELDO'},
  traslado:       {tipo:'CAMBIO',  concepto:'TRASLADO'},
  renuncia:       {tipo:'SALIDA',  concepto:'RENUNCIA'},
  termino_cont:   {tipo:'SALIDA',  concepto:'TERMINO DE CONTRATO'},
  suspension_cargo:{tipo:'SALIDA', concepto:'SUSPENSION'},
  abandono:       {tipo:'SALIDA',  concepto:'ABANDONO'},
  exclusion:      {tipo:'SALIDA',  concepto:'EXCLUSION DE NOMINA'},
  fallecimiento:  {tipo:'SALIDA',  concepto:'FALLECIMIENTO'},
  invalidez:      {tipo:'SALIDA',  concepto:'INVALIDEZ'},
  suspension_disc:{tipo:'SALIDA',  concepto:'SUSPENSION DISCIPLINARIA'},
};

// Etiquetas legibles de naturaleza en Supabase
const REP_NAT_MAP = {
  'Nombre. Ordinario':'nom_ord','Nombre. Nominal':'nom_nom','Por contrato':'contrato',
  'Suplencia o Inter.':'suplencia','Reingreso':'reingreso','Promoción':'promocion',
  'Reclasificación':'reclasificacion','Aumento sueldo':'aumento','Traslado':'traslado',
  'Renuncia':'renuncia','Termino De Cont.':'termino_cont','Suspensión De Cargo':'suspension_cargo',
  'Abandono':'abandono','Exclusión de nomina':'exclusion','Fallecimiento':'fallecimiento',
  'Invalidez':'invalidez','Suspensión':'suspension_disc',
};

let repNomina     = {};   // cedula → row de la nómina cargada
let repFilas      = [];   // filas del reporte editable
let repAcciones   = {};   // cedula → acción del mes en Supabase
let repFechaEdit  = '';

// ── Cargar archivo de nómina ──
function repLoadNomina(file){
  if(!file) return;
  document.getElementById('rep-fi-label').textContent = file.name;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      let hi = all.findIndex(function(r){
        return r.some(function(c){ return String(c).toLowerCase().includes('cedula'); });
      });
      if(hi<0) hi=3;
      repNomina = {};
      all.slice(hi+1).forEach(function(r){
        if(!r[1]) return;
        const ced = String(r[1]).trim();
        repNomina[ced] = {
          nomina:     String(r[0]||'').trim(),
          cedula:     ced,
          nombre:     String(r[2]||'').trim(),
          cargo:      String(r[3]||'').trim(),
          sueldo:     parseFloat(r[4])||0,   // Sueldo Bruto
          isr:        parseFloat(r[5])||0,   // ISR
          inabi:      parseFloat(r[6])||0,   // SeguroVida (INABI)
          afp:        parseFloat(r[7])||0,   // SS_Empleado (AFP)
          sfs:        parseFloat(r[8])||0,   // SFS_Empleado (SFS)
          sfs_empl:   parseFloat(r[9])||0,   // SFS_Empleador
          ss_empl:    parseFloat(r[10])||0,  // SS_Empleador
          dep_adic:   parseFloat(r[11])||0,  // DescAdicional (SFS Padres)
          riesgo:     parseFloat(r[12])||0,  // Riesgo_Lab
          total_desc: parseFloat(r[13])||0,  // TotalDesc
          sueldo_neto:parseFloat(r[14])||0,  // SueldoNeto
        };
      });
      const per = document.getElementById('rep-periodo').value.trim() || 'MAYO 2026';
      const tipo = document.getElementById('rep-tipo-nomina').value;
      document.getElementById('rep-titulo-tipo').textContent = tipo + ' · ' + per + ' · ' + Object.keys(repNomina).length + ' empleados';
      document.getElementById('rep-editor').style.display = 'block';
      repSt('nomina-status', Object.keys(repNomina).length + ' empleados cargados desde ' + file.name, 'ok');
    }catch(err){ repSt('nomina-status','Error al leer: '+err.message,'err'); }
  };
  reader.readAsArrayBuffer(file);
}

// ── Cruzar con acciones de personal en Supabase ──
async function repBuscarAcciones(){
  const per = document.getElementById('rep-periodo').value.trim();
  if(!per){ repSt('nomina-status','Ingresa el período (AAAA-MM)','err'); return; }
  const [anio, mes] = per.split('-');
  if(!anio || !mes){ repSt('nomina-status','Formato de período incorrecto. Usa AAAA-MM','err'); return; }
  repSt('nomina-status','Buscando acciones de personal en el período...','info');
  try{
    // Buscar acciones creadas en ese mes (filtramos por fecha_generacion que contiene MM/AAAA)
    const r = await fetch(SUPA_URL+'/rest/v1/acciones_personal?select=*&estado=eq.Aplicada&order=id.desc&limit=500',{headers:SUPA_HEADERS});
    const all = r.ok ? await r.json() : [];
    repAcciones = {};
    const filtro = mes.padStart(2,'0')+'/'+anio;
    all.forEach(function(a){
      if(!a.fecha_generacion || !a.fecha_generacion.includes(filtro)) return;
      const ced = String(a.cedula_empleado||'').replace(/[^0-9]/g,'');
      if(!ced) return;
      // Resolver naturaleza → clave interna
      const natLabel = a.naturaleza||'';
      let key = REP_NAT_MAP[natLabel];
      if(!key){
        // Buscar por coincidencia parcial
        key = Object.keys(REP_NAT_MAP).find(function(k){
          return natLabel.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(natLabel.toLowerCase());
        });
        if(key) key = REP_NAT_MAP[key];
      }
      if(key && REP_MAPEO[key]){
        repAcciones[ced] = {key, ...REP_MAPEO[key], naturaleza:natLabel, accion:a};
      }
    });
    // Auto-agregar filas cruzando con nómina cargada
    let encontrados = 0;
    Object.keys(repAcciones).forEach(function(ced){
      const emp = repNomina[ced];
      if(!emp) return;
      const ya = repFilas.find(function(f){ return f.cedula===ced; });
      if(ya) return;
      const ac = repAcciones[ced];
      const fechaAc = ac.accion.fecha_generacion ? ac.accion.fecha_generacion.split(' ')[0] : '';
      repFilas.push({
        cedula: ced, nombre: emp.nombre, cargo: emp.cargo, sueldo: emp.sueldo,
        tipo: ac.tipo, concepto: ac.concepto,
        fecha: repFmtFecha(fechaAc), autoDetected: true,
      });
      encontrados++;
    });
    repRenderTabla();
    repSt('nomina-status', encontrados+' novedades detectadas automáticamente. Puedes ajustar los conceptos.', 'ok');
  }catch(err){ repSt('nomina-status','Error: '+err.message,'err'); }
}

// ── Buscador de empleado en nómina ──
function repBuscarEmp(){
  const q = (document.getElementById('rep-buscar').value||'').toLowerCase().trim();
  const sug = document.getElementById('rep-sugerencias');
  if(q.length < 2){ sug.innerHTML=''; return; }
  const qd = q.replace(/[^0-9]/g,'');
  const found = Object.values(repNomina).filter(function(e){
    return (qd && e.cedula.replace(/[^0-9]/g,'').includes(qd)) ||
           e.nombre.toLowerCase().includes(q) ||
           e.cargo.toLowerCase().includes(q);
  }).slice(0,8);
  if(!found.length){ sug.innerHTML='<div class="cert-sug"><div class="cert-sug-item" style="color:#9E1B32">No encontrado en nómina</div></div>'; return; }
  let html='<div class="cert-sug">';
  found.forEach(function(e){
    const ac = repAcciones[e.cedula.replace(/[^0-9]/g,'')];
    const badge = ac ? ' <span style="font-size:9px;background:#dde8f5;color:var(--azul);border-radius:2px;padding:1px 5px">'+ac.concepto+'</span>' : '';
    html += '<div class="cert-sug-item" onclick="repSeleccionarEmp(&quot;'+e.cedula+'&quot;)"><strong>'+e.nombre+'</strong><span>'+fmtCed(e.cedula)+'</span>'+badge+'</div>';
  });
  html += '</div>';
  sug.innerHTML = html;
}

function repSeleccionarEmp(ced){
  const e = repNomina[ced] || Object.values(repNomina).find(function(r){ return r.cedula===ced; });
  if(!e) return;
  document.getElementById('rep-buscar').value = e.nombre;
  document.getElementById('rep-sugerencias').innerHTML = '';
  // Si hay acción detectada, pre-llenar tipo y concepto
  const cedDig = ced.replace(/[^0-9]/g,'');
  const ac = repAcciones[cedDig];
  if(ac){
    document.getElementById('rep-mov-tipo').value = ac.tipo;
    repActualizarConceptos(ac.tipo);
    document.getElementById('rep-mov-conc').value = ac.concepto;
  }
}

function repActualizarConceptos(tipo){
  const map = {
    'ENTRADA': ['INGRESO','REINGRESO','CONTRATO','SUPLENCIA'],
    'SALIDA':  ['RENUNCIA','TERMINO DE CONTRATO','SUSPENSION','ABANDONO','EXCLUSION DE NOMINA','FALLECIMIENTO','INVALIDEZ','DESVINCULACION','SUSPENSION DISCIPLINARIA'],
    'CAMBIO':  ['RECLASIFICACION','PROMOCION','AUMENTO DE SUELDO','TRASLADO'],
  };
  const sel = document.getElementById('rep-mov-conc');
  const opts = (map[tipo]||[]);
  sel.innerHTML = opts.map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('');
}

document.addEventListener('DOMContentLoaded', function(){
  const movTipo = document.getElementById('rep-mov-tipo');
  if(movTipo) movTipo.addEventListener('change', function(){ repActualizarConceptos(this.value); });
});

// ── Agregar fila manual ──
function repAgregarFila(){
  const buscar = document.getElementById('rep-buscar').value.trim();
  if(!buscar){ alert('Busca y selecciona un empleado primero.'); return; }
  // Buscar en nomina
  const qd = buscar.replace(/[^0-9]/g,'');
  const emp = Object.values(repNomina).find(function(e){
    return (qd && e.cedula.replace(/[^0-9]/g,'')=== qd) || e.nombre.toLowerCase()===buscar.toLowerCase();
  });
  if(!emp){ alert('Empleado no encontrado en la nómina cargada.'); return; }
  const ya = repFilas.find(function(f){ return f.cedula===emp.cedula; });
  if(ya){ alert('Este empleado ya está en la tabla.'); return; }
  const tipo    = document.getElementById('rep-mov-tipo').value;
  const concepto= document.getElementById('rep-mov-conc').value;
  const fecha   = document.getElementById('rep-mov-fecha').value;
  repFilas.push({
    cedula:emp.cedula, nombre:emp.nombre, cargo:emp.cargo, sueldo:emp.sueldo,
    tipo, concepto, fecha:repFmtFecha(fecha), autoDetected:false,
  });
  document.getElementById('rep-buscar').value='';
  document.getElementById('rep-sugerencias').innerHTML='';
  repRenderTabla();
}

// ── Render tabla editable ──
function repRenderTabla(){
  const tbody = document.getElementById('rep-tbody');
  if(!repFilas.length){
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--texto2);padding:20px">Sin novedades agregadas.</td></tr>';
    document.getElementById('rep-totales').style.display='none';
    return;
  }
  const TIPOS_COLOR = {ENTRADA:'#EEF7F1', SALIDA:'#FBF0F2', CAMBIO:'#FEF3C7'};
  const TIPOS_FG    = {ENTRADA:'#155C30', SALIDA:'#9E1B32', CAMBIO:'#92400E'};
  const CONCEPTOS = {
    ENTRADA:['INGRESO','REINGRESO','CONTRATO','SUPLENCIA'],
    SALIDA:['RENUNCIA','TERMINO DE CONTRATO','SUSPENSION','ABANDONO','EXCLUSION DE NOMINA','FALLECIMIENTO','INVALIDEZ','DESVINCULACION','SUSPENSION DISCIPLINARIA'],
    CAMBIO:['RECLASIFICACION','PROMOCION','AUMENTO DE SUELDO','TRASLADO'],
  };
  // Sort: ENTRADA primero, luego CAMBIO, luego SALIDA
  const ord = {ENTRADA:0,CAMBIO:1,SALIDA:2};
  const sorted = repFilas.slice().sort(function(a,b){
    if((ord[a.tipo]||9)!==(ord[b.tipo]||9)) return (ord[a.tipo]||9)-(ord[b.tipo]||9);
    return a.nombre.localeCompare(b.nombre);
  });
  let idx=0;
  tbody.innerHTML = sorted.map(function(f){
    const i = idx++;
    const fi = repFilas.indexOf(f); // index in real array for edits
    const bg = TIPOS_COLOR[f.tipo]||'#fff';
    const fg = TIPOS_FG[f.tipo]||'inherit';
    const concOpts = (CONCEPTOS[f.tipo]||[]).map(function(c){
      return '<option value="'+c+'"'+(c===f.concepto?' selected':'')+'>'+c+'</option>';
    }).join('');
    const auto = f.autoDetected ? '<span title="Detectado automáticamente" style="font-size:9px;background:#dde8f5;color:var(--azul);border-radius:2px;padding:1px 4px;margin-left:4px">AUTO</span>' : '';
    return `<tr style="background:${bg}">
      <td style="color:var(--texto2)">${i+1}</td>
      <td>${fmtCed(f.cedula)}</td>
      <td><strong>${f.nombre}</strong>${auto}</td>
      <td>${f.cargo}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${f.sueldo.toLocaleString('es-DO',{minimumFractionDigits:2})}</td>
      <td><input type="date" value="${repFmtFechaInput(f.fecha)}" onchange="repEditFecha(${fi},this.value)" style="width:130px;font-size:11px;padding:3px 6px"></td>
      <td><span style="color:${fg};font-weight:700;font-size:10px">${f.tipo}</span></td>
      <td><select onchange="repEditConcepto(${fi},this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--borde);border-radius:var(--radio);font-family:inherit">${concOpts}</select></td>
      <td><button onclick="repEliminarFila(${fi})" style="background:none;border:none;color:#9E1B32;cursor:pointer;font-size:14px;line-height:1" title="Eliminar">×</button></td>
    </tr>`;
  }).join('');

  // Totales
  ['ENTRADA','SALIDA','CAMBIO'].forEach(function(t){
    const rows = repFilas.filter(function(f){ return f.tipo===t; });
    const sum  = rows.reduce(function(s,f){ return s+f.sueldo; },0);
    const id   = t==='ENTRADA'?'ent':t==='SALIDA'?'sal':'cam';
    const el   = document.getElementById('rep-tot-'+id);
    if(el) el.textContent = rows.length+' · RD$ '+sum.toLocaleString('es-DO',{minimumFractionDigits:2});
  });
  document.getElementById('rep-totales').style.display='block';
}

function repEditConcepto(i, val){ repFilas[i].concepto = val; }
function repEditFecha(i, val){ repFilas[i].fecha = repFmtFecha(val); }
function repEliminarFila(i){ repFilas.splice(i,1); repRenderTabla(); }
function repLimpiarTabla(){ repFilas=[]; repRenderTabla(); }

// ── Formato de fecha ──
function repFmtFecha(str){
  if(!str) return '';
  // dd/mm/aaaa input → dd/mm/aaaa display
  if(str.includes('/')) return str.substring(0,10);
  // aaaa-mm-dd input → dd/mm/aaaa
  const p=str.split('-'); if(p.length===3) return p[2]+'/'+p[1]+'/'+p[0];
  return str;
}
function repFmtFechaInput(str){
  if(!str) return '';
  const p=str.split('/'); if(p.length===3) return p[2]+'-'+p[1]+'-'+p[0];
  return str;
}

// ── Guardar nómina en Supabase ──
async function repGuardarNomina(){
  if(!Object.keys(repNomina).length){ repSt('pdf-status','No hay nómina cargada.','err'); return; }
  repSt('pdf-status','Guardando nómina en base de datos...','info');
  const per  = document.getElementById('rep-periodo').value.trim();
  const tipo = document.getElementById('rep-tipo-nomina').value;
  const rows = Object.values(repNomina).map(function(e){
    return {
      periodo: per, tipo_nomina: tipo,
      cedula: e.cedula, nombre: e.nombre, cargo: e.cargo, sueldo: e.sueldo,
    };
  });
  // Upsert en lotes de 100
  let ok = true;
  for(let i=0;i<rows.length;i+=100){
    const batch = rows.slice(i,i+100);
    const r = await fetch(SUPA_URL+'/rest/v1/nomina_historico', {
      method:'POST',
      headers:{...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'},
      body: JSON.stringify(batch),
    });
    if(!r.ok) ok=false;
  }
  repSt('pdf-status', ok?'Nómina guardada correctamente en la base de datos.':'Error al guardar (parte de la nómina puede haberse guardado).', ok?'ok':'err');
}

// ── Generar PDF ──
function repGenerarPDF(){
  // Use novResultado if repFilas is empty (unified module)
  if(!repFilas.length && window.novResultado){
    var r = window.novResultado;
    r.ingresos.forEach(function(e){ repFilas.push({cedula:e.cedula,nombre:e.nombre,cargo:e.cargo,sueldo:e.sueldo_bruto,tipo:'ENTRADA',concepto:'INGRESO',fecha:''}); });
    r.salidas.forEach(function(e){ repFilas.push({cedula:e.cedula,nombre:e.nombre,cargo:e.cargo,sueldo:e.sueldo_bruto,tipo:'SALIDA',concepto:'EXCLUSION DE NOMINA',fecha:''}); });
    r.cambios.forEach(function(c){ repFilas.push({cedula:c.despues.cedula,nombre:c.despues.nombre,cargo:c.despues.cargo,sueldo:c.despues.sueldo_bruto,tipo:'CAMBIO',concepto:'RECLASIFICACION',fecha:''}); });
  }
  if(!repFilas.length){ repSt('pdf-status','Compara los períodos primero.','err'); return; }
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const W=216, H=279, ML=14, MR=14, ANC=W-ML-MR;
  const NAVY=[13,30,63], ROJO=[140,18,36], NEGRO=[20,20,20];

  function tm(style,sz){ doc.setFont('times',style); doc.setFontSize(sz); }
  function hv(style,sz){ doc.setFont('helvetica',style); doc.setFontSize(sz); }

  // ── Logo ──
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG',W-MR-26,6,26,22); }catch(e){}

  // ── Encabezado texto ──
  tm('bold',11); doc.setTextColor(...NAVY);
  doc.text('PROYECTOS ESTRATEGICOS Y PROGRAMAS ESPECIALES DE LA PR', ML, 12);
  const sub = document.getElementById('rep-pdf-sub').value.trim();
  if(sub){ tm('normal',10); doc.text(sub, ML, 18); }
  const titulo = document.getElementById('rep-pdf-titulo').value.trim();
  tm('bold',11); doc.text(titulo, ML, 24);
  doc.setLineWidth(0.5); doc.setDrawColor(...NAVY); doc.line(ML,27,W-MR-28,27);

  let y = 34;

  // ── Secciones ──
  const secciones = [
    {label:'ENTRADAS', tipo:'ENTRADA', colMonto:'SUELDO'},
    {label:'CAMBIOS',  tipo:'CAMBIO',  colMonto:'SUELDO'},
    {label:'SALIDAS',  tipo:'SALIDA',  colMonto:'MONTO'},
  ];

  const COL = {id:ML, ced:ML+8, nom:ML+30, car:ML+88, mon:ML+136, fec:ML+156, con:ML+178};

  function drawSeccion(sec, filas){
    if(!filas.length) return;
    // Título sección
    hv('bold',9.5); doc.setTextColor(...NEGRO);
    doc.text(sec.label, ML, y); y+=4;

    // Header tabla
    doc.setFillColor(...NAVY);
    doc.rect(ML, y, ANC, 6.5,'F');
    hv('bold',7.5); doc.setTextColor(255,255,255);
    doc.text('ID',    COL.id+1,  y+4.5);
    doc.text('CEDULA',COL.ced,   y+4.5);
    doc.text('NOMBRE',COL.nom,   y+4.5);
    doc.text('CARGO', COL.car,   y+4.5);
    doc.text(sec.colMonto, COL.mon, y+4.5);
    doc.text('FECHA', COL.fec,   y+4.5);
    doc.text('CONCEPTO',COL.con, y+4.5);
    y+=6.5;

    // Filas
    let total=0;
    filas.forEach(function(f,i){
      if(y > H-42){ doc.addPage(); y=18; }
      const bg = i%2===0;
      if(!bg){ doc.setFillColor(242,243,245); doc.rect(ML,y,ANC,5.5,'F'); }
      hv('normal',7.5); doc.setTextColor(...NEGRO);
      doc.text(String(i+1), COL.id+1, y+4);
      doc.text(fmtCed(f.cedula).substring(0,14), COL.ced, y+4);
      doc.text((f.nombre||'').substring(0,30), COL.nom, y+4);
      doc.text((f.cargo||'').substring(0,22), COL.car, y+4);
      const montoStr = f.sueldo.toLocaleString('es-DO',{minimumFractionDigits:2});
      doc.text(montoStr, COL.mon+18, y+4, {align:'right'});
      doc.text(f.fecha||'', COL.fec, y+4);
      doc.text((f.concepto||'').substring(0,18), COL.con, y+4);
      doc.setDrawColor(230,232,237); doc.setLineWidth(0.2);
      doc.line(ML, y+5.5, W-MR, y+5.5);
      total+=f.sueldo; y+=5.5;
    });

    // Total sección
    doc.setFillColor(240,241,244);
    doc.rect(ML,y,ANC,5.5,'F');
    hv('bold',7.5); doc.setTextColor(...NAVY);
    doc.text('TOTAL', COL.mon-12, y+4);
    doc.text(total.toLocaleString('es-DO',{minimumFractionDigits:2}), COL.mon+18, y+4, {align:'right'});
    y+=5.5+8;
  }

  const sorted = repFilas.slice().sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
  secciones.forEach(function(sec){
    drawSeccion(sec, sorted.filter(function(f){ return f.tipo===sec.tipo; }));
  });

  // ── Firma ──
  if(y > H-30){ doc.addPage(); y=18; }
  y = Math.max(y, H-45);
  doc.setLineWidth(0.5); doc.setDrawColor(...NEGRO);
  doc.line(ML, y, ML+65, y); y+=5;
  hv('bold',9); doc.setTextColor(...NEGRO);
  const firmante = document.getElementById('rep-pdf-firmante').value.trim();
  const cargoF   = document.getElementById('rep-pdf-cargo-firmante').value.trim();
  doc.text(firmante, ML, y); y+=5;
  hv('normal',8.5); doc.setTextColor(80,80,80);
  doc.text(cargoF, ML, y);

  // ── Footer ──
  const fy = H-8;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(ML,fy-4,W-MR,fy-4);
  hv('normal',6.5); doc.setTextColor(100,100,100);
  doc.text('PROPEEP · Dirección General de Proyectos Estratégicos y Especiales de la Presidencia · Dirección de Recursos Humanos', W/2, fy, {align:'center'});

  const tipo  = document.getElementById('rep-tipo-nomina').value;
  const per   = document.getElementById('rep-periodo').value.trim() || new Date().toISOString().slice(0,7);
  doc.save('Reporte_Novedades_'+tipo+'_'+per+'.pdf');
  repSt('pdf-status','PDF exportado correctamente.','ok');
}

// ── Reset ──
function repReset(){
  repNomina={}; repFilas=[]; repAcciones=[];
  document.getElementById('rep-editor').style.display='none';
  document.getElementById('rep-fi-label').textContent='Ninguno';
  document.getElementById('rep-fi').value='';
  document.getElementById('rep-nomina-status').style.display='none';
  document.getElementById('rep-pdf-status').style.display='none';
  repRenderTabla();
}

// ── Status helper ──
function repSt(id, msg, tipo){
  const el=document.getElementById('rep-'+id);
  if(!el) return;
  el.textContent=msg; el.className='status '+tipo; el.style.display='block';
}

// ══════════════════════════════════════════
// RESUMEN FINANCIERO DE NÓMINA — PDF
// ══════════════════════════════════════════
function repGenerarResumenPDF(){
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const W=216, H=279, ML=18, MR=18, ANC=W-ML-MR;
  const NAVY=[13,30,63], ROJO=[140,18,36], NEGRO=[20,20,20];

  function tm(style,sz){ doc.setFont('times',style); doc.setFontSize(sz); }

  // ── Logo centrado ──
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG',W/2-17,8,34,28); }catch(e){}
  tm('bold',12); doc.setTextColor(...ROJO);
  doc.text('Proyectos Estratégicos y Especiales', W/2, 40, {align:'center'});
  doc.text('de la Presidencia PROPEEP',           W/2, 46, {align:'center'});
  // Línea decorativa bajo el texto del logo
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.8);
  doc.line(W/2-24, 48.5, W/2+24, 48.5);

  let y = 58;
  tm('bold',16); doc.setTextColor(...NEGRO);
  doc.text('DIVISION DE NOMINA', W/2, y, {align:'center'}); y+=7;
  tm('bold',12);
  doc.text('VALORES EN RD$', W/2, y, {align:'center'}); y+=12;

  // Subtítulo del resumen
  const subtRes = (document.getElementById('rep-pdf-subtitulo-res')||{value:''}).value.trim() ||
                  'RESUMEN DE NOMINA';
  tm('normal',9); doc.setTextColor(80,80,80);
  doc.text(subtRes, W/2, y, {align:'center'}); y+=10;

  // ── Cálculos: todo del Excel, solo Crédito Fiscal es manual ──
  const creditoF  = parseFloat((document.getElementById('rep-credito-fiscal')||{value:0}).value)||0;

  // Novedades (del panel de novedades cargado — lado izquierdo = anterior)
  const entradas  = repFilas.filter(function(f){return f.tipo==='ENTRADA';});
  const salidas   = repFilas.filter(function(f){return f.tipo==='SALIDA';});
  const cambios   = repFilas.filter(function(f){return f.tipo==='CAMBIO';});
  function sumF(arr){ return arr.reduce(function(s,f){return s+f.sueldo;},0); }
  const montoInc   = sumF(entradas);
  const montoExc   = sumF(salidas);
  const montoPromo = sumF(cambios);

  // Período anterior (nomDataA del módulo de novedades si existe, si no: 0)
  const empsAnt   = (typeof novDataA!=='undefined') ? Object.values(novDataA) : [];
  function sumA(fn){ return empsAnt.reduce(function(s,e){return s+fn(e);},0); }
  const nomAnt    = sumA(function(e){return e.sueldo_bruto||e.sueldo||0;});

  // Período nuevo (nómina cargada en este módulo)
  // Use repNomina (reporte module) or novDataB (novedades module) as fallback
  var _nomSrc = (Object.keys(repNomina||{}).length > 0) ? repNomina : (window._novRepNomina||{});
  const emps = Object.values(_nomSrc);
  if(!emps.length){ repSt('pdf-status','Compara los períodos primero antes de exportar el PDF.','err'); return; }
  function sumN(fn){ return emps.reduce(function(s,e){return s+fn(e);},0); }

  const sueldoBruto = sumN(function(e){return e.sueldo||0;});
  const isr         = sumN(function(e){return e.isr||0;});
  const inabi       = sumN(function(e){return e.inabi||0;});
  const afp         = sumN(function(e){return e.afp||0;});
  const sfs         = sumN(function(e){return e.sfs||0;});
  const depAdic     = sumN(function(e){return e.dep_adic||0;});  // SFS Padres / Dep. Adicionales
  const totalDesc   = sumN(function(e){return e.total_desc||0;}) - creditoF;
  const netoAPagar  = sumN(function(e){return e.sueldo_neto||0;}) + creditoF;
  const cantEmp     = emps.length;

  // ── Función de fila ──
  const VALX = W - MR - 4;
  const SIGX = W/2 + 10;

  function linea(){ doc.setDrawColor(210,214,225); doc.setLineWidth(0.2); doc.line(ML,y,W-MR,y); y+=0.5; }
  function espacio(h){ y+=h; }

  function filaGrande(label, valor, prefijo, bold){
    doc.setFillColor(255,255,255);
    tm(bold?'bold':'normal', bold?13:11); doc.setTextColor(...NEGRO);
    doc.text(label, ML+2, y);
    if(prefijo){ tm('bold',11); doc.setTextColor(100,100,100); doc.text(prefijo, SIGX, y, {align:'center'}); }
    tm(bold?'bold':'normal', bold?13:11); doc.setTextColor(...NEGRO);
    const vStr = 'RD$  '+valor.toLocaleString('es-DO',{minimumFractionDigits:2});
    doc.text(vStr, VALX, y, {align:'right'});
    y+=7;
  }

  function filaNormal(label, valor, prefijo){
    tm('normal',10); doc.setTextColor(...NEGRO);
    doc.text(label, ML+4, y);
    if(prefijo){ tm('normal',10); doc.setTextColor(100,100,100); doc.text(prefijo, SIGX, y, {align:'center'}); }
    const vStr = valor!==null ? '$'+Math.abs(valor).toLocaleString('es-DO',{minimumFractionDigits:2}) : '';
    tm('normal',10); doc.setTextColor(...NEGRO);
    doc.text(vStr, VALX, y, {align:'right'});
    y+=6;
  }

  function filaTotal(label, valor, sz){
    const s = sz||12;
    tm('bold',s); doc.setTextColor(...NEGRO);
    doc.text(label, ML+2, y);
    const vStr = 'RD$  '+valor.toLocaleString('es-DO',{minimumFractionDigits:2});
    doc.text(vStr, VALX, y, {align:'right'});
    // Doble línea
    doc.setLineWidth(0.5); doc.setDrawColor(...NEGRO);
    doc.line(VALX-55, y+1.5, VALX, y+1.5);
    y+=7;
  }

  // ── Contenido ──
  // MONTO NOMINA ANTERIOR
  filaGrande('MONTO NOMINA ANTERIOR', nomAnt, '', true);
  linea(); espacio(3);

  // INCLUSIONES
  filaGrande('INCLUSIONES', montoInc, '+', false);
  linea(); espacio(3);

  // EXCLUSIONES
  filaGrande('EXCLUSIONES', montoExc, '-', false);
  linea(); espacio(3);

  // PROMOCIONES (siempre se muestra aunque sea 0)
  filaGrande('PROMOCIONES', montoPromo, montoPromo>=0?'+':'-', false);
  linea(); espacio(5);

  // SUELDOS BRUTOS
  // SUELDOS BRUTOS = Anterior + Inclusiones − Exclusiones + Promociones
  const sueldoBrutoCalc = nomAnt + montoInc - montoExc + montoPromo;
  const diferencia = Math.round(Math.abs(sueldoBrutoCalc - sueldoBruto)*100)/100;
  filaTotal('SUELDOS BRUTOS', sueldoBrutoCalc, 14);
  espacio(5);

  // Deducciones
  filaNormal('ISR',                    isr);
  linea();
  filaNormal('CREDITO FISCAL',         creditoF);
  linea();
  filaNormal('AFP',                    afp);
  linea();
  filaNormal('SFS',                    sfs);
  linea();
  filaNormal('ADICIONALES',            depAdic);
  linea();
  filaNormal('SEGURO DE VIDA (INAVI)', inabi);
  linea();
  // Cantidad empleados (sin monto)
  tm('normal',10); doc.setTextColor(...NEGRO);
  // CANTIDAD DE EMPLEADOS — count from loaded nomina file
  const cantEmpNomina = Object.keys(repNomina).length;
  doc.text('CANTIDAD DE EMPLEADOS', ML+4, y);
  tm('bold',11); doc.setTextColor(...NAVY);
  doc.text(String(cantEmpNomina||cantEmp), VALX, y, {align:'right'});
  doc.setTextColor(...NEGRO);
  y+=6; linea(); espacio(5);

  // Totales finales
  filaTotal('TOTAL DEDUCCIONES EMPLEADOS', totalDesc, 12);
  filaTotal('NETO A PAGAR', sueldoBrutoCalc - totalDesc, 14);
  espacio(12);

  // ── Validación contable ──
  if(diferencia > 1){
    espacio(3);
    tm('normal',8); doc.setTextColor(140,18,36);
    doc.text('Diferencia: RD$ '+diferencia.toLocaleString('es-DO',{minimumFractionDigits:2})+
      ' (calc:'+sueldoBrutoCalc.toLocaleString('es-DO',{minimumFractionDigits:2})+
      ' vs excel:'+sueldoBruto.toLocaleString('es-DO',{minimumFractionDigits:2})+'). Verificar.', ML, y);
    y+=5; doc.setTextColor(...NEGRO);
  }

  // ── Firma ──
  if(y > H-30){ doc.addPage(); y=20; }
  doc.setLineWidth(0.6); doc.setDrawColor(...NEGRO);
  doc.line(ML, y, ML+72, y); y+=5;
  tm('bold',10); doc.setTextColor(...NEGRO);
  const firmante = (document.getElementById('rep-pdf-firmante')||{value:'PEDRO A. CID MARTINEZ'}).value.trim();
  const cargoF   = (document.getElementById('rep-pdf-cargo-firmante')||{value:'ENCARGADO DE NOMINA'}).value.trim();
  doc.text(firmante, ML, y); y+=5;
  tm('normal',9); doc.setTextColor(80,80,80);
  doc.text(cargoF, ML, y);

  // ── Footer ──
  const fy=H-8;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(ML,fy-4,W-MR,fy-4);
  tm('normal',6.5); doc.setTextColor(100,100,100);
  doc.text('PROPEEP · Dirección General de Proyectos Estratégicos y Especiales de la Presidencia · División de Nómina', W/2, fy, {align:'center'});

  const tipo = (document.getElementById('rep-tipo-nomina')||{value:'Nomina'}).value;
  const per  = (document.getElementById('rep-periodo')||{value:''}).value.trim() || new Date().toISOString().slice(0,7);
  doc.save('Resumen_Nomina_'+tipo+'_'+per+'.pdf');
  repSt('pdf-status','Resumen Financiero exportado correctamente.','ok');
}
