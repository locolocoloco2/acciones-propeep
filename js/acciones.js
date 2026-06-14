// ══════════════════════════════════════════
// ACCIONES / NATURALEZA
// ══════════════════════════════════════════
const ACCIONES = [
  { cod:'11', titulo:'11. DESIGNACIONES', items:[
    {key:'nom_ord',label:'Nombre. Ordinario'},
    {key:'nom_nom',label:'Nombre. Nominal'},
    {key:'contrato',label:'Por contrato'},
    {key:'suplencia',label:'Suplencia o Inter.'},
  ]},
  { cod:'12', titulo:'12. CAMBIO', items:[
    {key:'promocion',label:'Promoción'},
    {key:'reclasificacion',label:'Reclasificación'},
    {key:'aumento',label:'Aumento sueldo'},
    {key:'traslado',label:'Traslado'},
    {key:'reingreso',label:'Reingreso'},
  ]},
  { cod:'13', titulo:'13. VAC Y LIC.', items:[
    {key:'vacaciones',label:'VACACIONES'},
    {key:'permiso',label:'Permiso'},
    {key:'lic_especial',label:'Especial'},
    {key:'lic_con_sueldo',label:'Con sueldo'},
    {key:'lic_sin_sueldo',label:'Sin sueldo'},
    {key:'lic_enfermedad',label:'Por Enfermedad.'},
    {key:'lic_maternidad',label:'Por maternidad'},
    {key:'lic_estudio',label:'Por estudio'},
  ]},
  { cod:'14', titulo:'14. DISCIPLINA', items:[
    {key:'amonestacion',label:'Amonestaciones'},
    {key:'suspension_disc',label:'Suspensión'},
  ]},
  { cod:'15', titulo:'15. SEP. DEL SERV.', items:[
    {key:'renuncia',label:'Renuncia'},
    {key:'termino_cont',label:'Termino De Cont.'},
    {key:'suspension_cargo',label:'Suspensión De Cargo'},
    {key:'abandono',label:'Abandono'},
    {key:'exclusion',label:'Exclusión de nomina'},
    {key:'fallecimiento',label:'Fallecimiento'},
    {key:'invalidez',label:'Invalidez'},
  ]},
  { cod:'16', titulo:'16. OTRAS ACCIONES', items:[
    {key:'cambio_nombre',label:'Cambios de Nombres'},
    {key:'reconocimiento',label:'Reconocimiento'},
    {key:'perm_estudios',label:'Para estudios'},
    {key:'perm_matrimonio',label:'Por matrimonio'},
    {key:'fall_familiar',label:'Fallecimiento Familiar'},
    {key:'otras',label:'Otras'},
  ]},
];

function natLabel(key){
  for(var g of ACCIONES) for(var it of g.items) if(it.key===key) return it.label;
  return key||'—';
}

(function(){
  const grid = document.getElementById('nat-grid');
  ACCIONES.forEach(g => {
    const div = document.createElement('div');
    div.className = 'nat-group';
    div.innerHTML = '<div class="nat-title">'+g.titulo+'</div>';
    g.items.forEach(it => {
      const lbl = document.createElement('label');
      lbl.className = 'nat-item';
      lbl.setAttribute('data-natkey', it.key);
      lbl.innerHTML = '<input type="radio" name="nat" value="'+it.key+'"> '+it.label;
      div.appendChild(lbl);
    });
    grid.appendChild(div);
  });
  document.querySelector('input[value="nom_ord"]').checked = true;
  document.getElementById('f-fecha').valueAsDate = new Date();
})();

const VAC_PERM_KEYS = ['vacaciones','permiso','lic_especial','lic_con_sueldo','lic_sin_sueldo','lic_enfermedad','lic_maternidad','lic_estudio'];
const VAC_PERM_LABELS = VAC_PERM_KEYS.map(function(k){ return natLabel(k).toLowerCase(); });

function applyNatRestrictions(){
  if(!SESSION) return;
  if(SESSION.rol === 'vacperm'){
    document.querySelectorAll('.nat-item').forEach(function(lbl){
      const key = lbl.getAttribute('data-natkey');
      if(VAC_PERM_KEYS.indexOf(key) < 0){
        lbl.style.opacity = '0.3'; lbl.style.pointerEvents = 'none';
        lbl.querySelector('input').disabled = true;
      } else {
        lbl.style.opacity = ''; lbl.style.pointerEvents = '';
        lbl.querySelector('input').disabled = false;
      }
    });
    const fa = document.querySelector('input[value="vacaciones"]');
    if(fa) fa.checked = true;
  } else {
    document.querySelectorAll('.nat-item').forEach(function(lbl){
      lbl.style.opacity = ''; lbl.style.pointerEvents = '';
      lbl.querySelector('input').disabled = false;
    });
  }
}

function isAllowedForRole(natLabelStr){
  if(!SESSION) return false;
  if(SESSION.rol === 'admin') return true;
  if(SESSION.rol === 'vacperm'){
    const nl = (natLabelStr||'').toLowerCase();
    return VAC_PERM_LABELS.some(function(l){ return nl.indexOf(l)>=0 || l.indexOf(nl)>=0; });
  }
  return false;
}

// ══════════════════════════════════════════
// SUPABASE — BASE DE DATOS
// ══════════════════════════════════════════
let histData = [];   // array de objetos {id, fecha_generacion, generado_por, nombre_empleado, cedula_empleado, cargo, sueldo, naturaleza, motivacion, estado}

async function sbInsert(d){
  try{
    const r = await fetch(SUPA_URL+'/rest/v1/acciones_personal', {
      method: 'POST',
      headers: {...SUPA_HEADERS, 'Prefer': 'return=representation'},
      body: JSON.stringify(d)
    });
    if(!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  }catch(e){ console.warn('Supabase insert error', e); return null; }
}

async function sbRead(){
  try{
    const r = await fetch(SUPA_URL+'/rest/v1/acciones_personal?order=id.desc&limit=500', {
      headers: SUPA_HEADERS
    });
    if(!r.ok) return [];
    return await r.json();
  }catch(e){ console.warn('Supabase read error', e); return []; }
}

async function sbUpdateEstado(id, estado){
  try{
    const r = await fetch(SUPA_URL+'/rest/v1/acciones_personal?id=eq.'+id, {
      method: 'PATCH',
      headers: {...SUPA_HEADERS, 'Prefer': 'return=minimal'},
      body: JSON.stringify({estado})
    });
    return r.ok;
  }catch(e){ console.warn('Supabase update error', e); return false; }
}

// ══════════════════════════════════════════
// HISTÓRICO UI
// ══════════════════════════════════════════
async function loadHist(){
  document.getElementById('hist-body').innerHTML = '<div class="hist-loading">Cargando histórico...</div>';
  histData = await sbRead();
  renderHist();
}

function renderHist(){
  const search = (document.getElementById('hist-search').value||'').toLowerCase();
  const estFilt = document.getElementById('hist-est').value;
  const rol = SESSION ? SESSION.rol : '';

  let base = histData;
  if(rol === 'vacperm'){
    base = base.filter(function(r){ return isAllowedForRole(r.naturaleza||''); });
  }

  const filtered = base.filter(function(r){
    const nombre = (r.nombre_empleado||'').toLowerCase();
    const cedula = ((r.cedula_empleado||'')+' '+fmtCed(r.cedula_empleado)).toLowerCase();
    const est = r.estado||'Creada';
    if(estFilt && est !== estFilt) return false;
    if(search && nombre.indexOf(search)<0 && cedula.indexOf(search)<0) return false;
    return true;
  });

  // Hide bulk bar when re-rendering
  const bulkBar = document.getElementById('bulk-bar');
  if(bulkBar) bulkBar.style.display = 'none';

  if(!filtered.length){
    document.getElementById('hist-body').innerHTML = '<div class="hist-loading">No se encontraron registros.</div>';
    return;
  }

  const isAdmin = rol === 'admin';
  // Check-all only for admins (bulk actions)
  const checkAllTh = isAdmin ? '<th style="width:32px"><input type="checkbox" id="chk-all" onchange="toggleCheckAll(this)" title="Seleccionar todo" style="accent-color:var(--azul);width:15px;height:15px"></th>' : '';
  let html = '<div class="table-wrap"><table><thead><tr>'+checkAllTh+'<th>Fecha</th><th>Generado por</th><th>Empleado</th><th>Cédula</th><th>Cargo</th><th>Naturaleza</th><th>Estado</th>'+(isAdmin?'<th>Cambiar</th>':'')+'<th>Descargar</th></tr></thead><tbody>';
  filtered.forEach(function(r){
    const est = r.estado||'Creada';
    const estClass = est.replace(/\s/g,'');
    html += '<tr id="row-'+r.id+'">';
    // Checkbox only for admins
    if(isAdmin){
      html += '<td><input type="checkbox" class="row-chk" data-id="'+r.id+'" onchange="onRowCheck()" style="accent-color:var(--azul);width:15px;height:15px"></td>';
    }
    html += '<td>'+(r.fecha_generacion||'—')+'</td>';
    html += '<td>'+(r.generado_por||'—')+'</td>';
    html += '<td><strong>'+(r.nombre_empleado||'—')+'</strong></td>';
    html += '<td>'+(fmtCed(r.cedula_empleado)||'—')+'</td>';
    html += '<td>'+(r.cargo||'—')+'</td>';
    html += '<td>'+(r.naturaleza||'—')+'</td>';
    html += '<td><span class="est-badge est-'+estClass+'" id="badge-'+r.id+'">'+est+'</span></td>';
    if(isAdmin){
      html += '<td><select onchange="cambiarEstado('+r.id+',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--borde);border-radius:4px;font-family:inherit">';
      ['Creada','Aplicada','Rechazada'].forEach(function(s){
        html += '<option value="'+s+'"'+(s===est?' selected':'')+'>'+s+'</option>';
      });
      html += '</select></td>';
    }
    // Download button — only when Creada
    if(est === 'Creada' && r.form_data){
      html += '<td><button onclick="descargarPDF('+r.id+')" class="btn btn-primary">Descargar PDF</button></td>';
    } else if(est === 'Aplicada'){
      html += '<td><span title="Acción ya aplicada" style="font-size:11px;color:#1e6b3c;font-weight:600">Aplicada</span></td>';
    } else if(est === 'Rechazada'){
      html += '<td><span style="font-size:11px;color:#9e1b32;font-weight:600">Rechazada</span></td>';
    } else {
      html += '<td><span style="font-size:11px;color:#a4abb7">Sin datos</span></td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="margin-top:10px;font-size:11.5px;color:#646e7e">'+filtered.length+' registro(s)</div>';
  document.getElementById('hist-body').innerHTML = html;
}

// ── CHECKBOX LOGIC ──
function onRowCheck(){
  const checked = document.querySelectorAll('.row-chk:checked');
  const bulkBar = document.getElementById('bulk-bar');
  const countEl = document.getElementById('bulk-count');
  if(checked.length > 0){
    bulkBar.style.display = 'flex';
    countEl.textContent = checked.length + ' seleccionada' + (checked.length===1?'':'s');
  } else {
    bulkBar.style.display = 'none';
  }
  // Sync check-all state
  const all = document.querySelectorAll('.row-chk');
  const chkAll = document.getElementById('chk-all');
  if(chkAll) chkAll.checked = all.length > 0 && checked.length === all.length;
}

function toggleCheckAll(master){
  document.querySelectorAll('.row-chk').forEach(function(chk){ chk.checked = master.checked; });
  onRowCheck();
}

function deseleccionarTodo(){
  document.querySelectorAll('.row-chk').forEach(function(chk){ chk.checked = false; });
  const chkAll = document.getElementById('chk-all');
  if(chkAll) chkAll.checked = false;
  const bulkBar = document.getElementById('bulk-bar');
  if(bulkBar) bulkBar.style.display = 'none';
}

function getSelectedIds(){
  return Array.from(document.querySelectorAll('.row-chk:checked')).map(function(c){ return parseInt(c.getAttribute('data-id')); });
}

async function aplicarEnGrupo(){
  const ids = getSelectedIds();
  if(!ids.length) return;
  if(!confirm('¿Marcar ' + ids.length + ' acción(es) como Aplicada?')) return;
  await cambiarEstadoGrupo(ids, 'Aplicada');
}

async function rechazarEnGrupo(){
  const ids = getSelectedIds();
  if(!ids.length) return;
  if(!confirm('¿Marcar ' + ids.length + ' acción(es) como Rechazada?')) return;
  await cambiarEstadoGrupo(ids, 'Rechazada');
}

async function cambiarEstadoGrupo(ids, nuevoEstado){
  const bulkBar = document.getElementById('bulk-bar');
  const countEl = document.getElementById('bulk-count');
  countEl.textContent = 'Actualizando...';
  for(let i=0; i<ids.length; i++){
    const id = ids[i];
    const rec = histData.find(function(r){ return r.id === id; });
    if(rec) rec.estado = nuevoEstado;
    await sbUpdateEstado(id, nuevoEstado);
  }
  deseleccionarTodo();
  renderHist();
}

async function cambiarEstado(id, nuevoEstado){
  const rec = histData.find(r => r.id === id);
  if(rec) rec.estado = nuevoEstado;
  renderHist();
  await sbUpdateEstado(id, nuevoEstado);
}

// ══════════════════════════════════════════
// REGISTRO DE ACCIÓN
// ══════════════════════════════════════════
async function registrarAccion(d){
  if(!SESSION) return null;
  const now = new Date();
  const fecha = now.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  // Store serialized form data for later PDF download
  const formJson = JSON.stringify({
    nombre: (d.nombre||'').toUpperCase(),
    fecha: d.fecha||'',
    cargo: (d.cargo||'').toUpperCase(),
    sueldo: d.sueldo||'',
    superior: d.superior||'',
    fecha_ingreso: d.fecha_ingreso||'',
    unidad: d.unidad||'',
    cedula: d.cedula||'',
    tiempo_adm: d.tiempo_adm||'',
    naturaleza: d.naturaleza||'',
    motivacion: d.motivacion||'',
    directora: d.directora||'Directora de Recursos Humanos'
  });
  const result = await sbInsert({
    fecha_generacion: fecha,
    generado_por: SESSION.nombre,
    nombre_empleado: (d.nombre||'').toUpperCase(),
    cedula_empleado: d.cedula||'',
    cargo: (d.cargo||'').toUpperCase(),
    sueldo: d.sueldo||'',
    naturaleza: natLabel(d.naturaleza),
    motivacion: (d.motivacion||'').substring(0,500),
    estado: 'Creada',
    form_data: formJson
  });
  return result;
}

// ══════════════════════════════════════════
// DATE UTILS
// ══════════════════════════════════════════
function fmtCed(c){
  const d = String(c||'').replace(/[^0-9]/g,'');
  if(d.length === 11) return d.slice(0,3)+'-'+d.slice(3,10)+'-'+d.slice(10);
  return String(c||'').trim();
}

function fmtDate(v){
  if(!v) return '';
  const p=v.split('-');
  if(p.length===3 && p[0].length===4) return p[2]+'/'+p[1]+'/'+p[0];
  return v;
}

function excelDateToStr(val){
  if(!val && val!==0) return '';
  const s = String(val).trim();
  if(!s) return '';
  if(s.indexOf('/')!==-1) return s;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){ const p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  const n = Number(s);
  if(!isNaN(n) && n > 1000){
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();
  }
  return s;
}

// ══════════════════════════════════════════
// PDF — buildPage
// ══════════════════════════════════════════
function buildPage(doc, d) {
  const W=216, H=279;
  const ML=10, MR=10, ANC=W-ML-MR;
  const AZUL=[26,58,107], ROJO=[200,16,46], NEGRO=[0,0,0];
  const GRIS_HDR=[208,216,232], GRIS_FILA=[235,238,245];
  const BLANCO=[255,255,255];
  const HDR_H = 34;
  doc.setFillColor(...BLANCO);
  doc.rect(0, 0, W, HDR_H, 'F');
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG', ML, 4, 26, 24); }catch(e){}
  doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
  doc.line(ML+30, 5, ML+30, HDR_H-4);
  doc.setTextColor(...AZUL);
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
  doc.text('Dirección General de Proyectos', W-MR, 13, {align:'right'});
  doc.text('Estratégicos y Especiales de la Presidencia', W-MR, 20, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
  doc.setTextColor(100,100,100);
  doc.text('Acción de Personal', W-MR, 27, {align:'right'});
  doc.setDrawColor(...ROJO); doc.setLineWidth(1.5);
  doc.line(0, HDR_H, W, HDR_H);
  doc.setLineWidth(0.3);
  let y = HDR_H + 4;
  const ROW=9.5, ROW_S=7.0;
  function secHdr(txt, yy){
    doc.setFillColor(...AZUL); doc.rect(ML,yy,ANC,ROW_S,'F');
    doc.setTextColor(...BLANCO); doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    doc.text(txt, W/2, yy+ROW_S-2, {align:'center'});
    return yy+ROW_S;
  }
  function drawRow(l1,v1,b1, l2,v2,b2, yy, ratio){
    if(ratio===undefined) ratio=0.67;
    const c1=ANC*ratio;
    doc.setFillColor(...GRIS_FILA); doc.rect(ML,yy,ANC,ROW,'F');
    doc.setDrawColor(170,178,196); doc.setLineWidth(0.3);
    doc.rect(ML,yy,ANC,ROW,'S'); doc.line(ML+c1,yy,ML+c1,yy+ROW);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...AZUL);
    doc.text(l1, ML+2, yy+ROW-2.8);
    const lw1=doc.getTextWidth(l1);
    doc.setFont('helvetica',b1?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor(...NEGRO);
    doc.text(doc.splitTextToSize(String(v1||''),c1-lw1-4)[0]||'', ML+2+lw1+1.5, yy+ROW-2.8);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...AZUL);
    doc.text(l2, ML+c1+2, yy+ROW-2.8);
    const lw2=doc.getTextWidth(l2);
    doc.setFont('helvetica',b2?'bold':'normal'); doc.setFontSize(8.5); doc.setTextColor(...NEGRO);
    doc.text(String(v2||''), ML+c1+2+lw2+1.5, yy+ROW-2.8);
    return yy+ROW;
  }
  function row1(lbl,val,yy){
    doc.setFillColor(...GRIS_FILA); doc.rect(ML,yy,ANC,ROW,'F');
    doc.setDrawColor(170,178,196); doc.setLineWidth(0.3); doc.rect(ML,yy,ANC,ROW,'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...AZUL);
    doc.text(lbl, ML+2, yy+ROW-2.8);
    const lw=doc.getTextWidth(lbl);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...NEGRO);
    doc.text(String(val||''), ML+2+lw+1.5, yy+ROW-2.8);
    return yy+ROW;
  }
  y = secHdr('A. DATOS GENERALES', y);
  y = drawRow('2. NOMBRE (S) Y APELLIDO(S) DEL EMPLEADO:',(d.nombre||'').toUpperCase(),true,'3. FECHA:',d.fecha||'',false,y);
  y = drawRow('4. CARGO QUE DESEMPEÑA:',(d.cargo||'').toUpperCase(),true,'5. SUELDO:',d.sueldo||'',false,y);
  y = drawRow('6. SUPERIOR INMEDIATO:',(d.superior||'').toUpperCase(),false,'7. FECHA DE INGRESO:',d.fecha_ingreso||'',false,y);
  y = drawRow('8. UNIDAD DE TRABAJO:',(d.unidad||'').toUpperCase(),false,'9. CEDULA:',fmtCed(d.cedula),true,y);
  y = row1('10. TIEMPO EN LA ADM. PUBLICA.:',d.tiempo_adm||'',y);
  y += 2;
  y = secHdr('B. NATURALEZA DE LA ACCION', y);
  const maxI=Math.max(...ACCIONES.map(g=>g.items.length));
  const COL=ANC/6, ALT_CH=14, ALT_IT=6.5;
  ACCIONES.forEach(function(g,i){
    const x=ML+i*COL;
    doc.setFillColor(...GRIS_HDR); doc.rect(x,y,COL,ALT_CH,'F');
    doc.setDrawColor(150,158,176); doc.setLineWidth(0.3); doc.rect(x,y,COL,ALT_CH,'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...AZUL);
    const pts=g.titulo.split('. ');
    doc.text(pts[0]+'.', x+COL/2, y+5.5, {align:'center'});
    const tit=pts.slice(1).join('. ');
    doc.splitTextToSize(tit,COL-2).forEach(function(ln,li){ doc.text(ln,x+COL/2,y+9.5+(li*3.2),{align:'center'}); });
  });
  y += ALT_CH;
  const nat=d.naturaleza||'';
  for(let row=0;row<maxI;row++){
    ACCIONES.forEach(function(g,i){
      const x=ML+i*COL;
      doc.setFillColor(...BLANCO); doc.rect(x,y,COL,ALT_IT,'F');
      doc.setDrawColor(185,190,205); doc.setLineWidth(0.25); doc.rect(x,y,COL,ALT_IT,'S');
      if(row<g.items.length){
        const it=g.items[row];
        const bx=x+2.5, by=y+ALT_IT/2;
        doc.setDrawColor(50,50,50); doc.setLineWidth(0.5);
        doc.rect(bx-1.3,by-1.3,2.6,2.6,'S');
        if(it.key===nat){
          doc.setFillColor(200,16,46); doc.rect(bx-1.3,by-1.3,2.6,2.6,'F');
          doc.setDrawColor(255,255,255); doc.setLineWidth(0.7);
          doc.line(bx-0.9,by+0.1,bx,by+1.1); doc.line(bx,by+1.1,bx+1.3,by-0.9);
        }
        doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(...NEGRO);
        doc.text(it.label, bx+2.2, by+1.8);
      }
    });
    y += ALT_IT;
  }
  y += 3;
  const MOTIV_HDR=8;
  doc.setFillColor(...GRIS_HDR); doc.rect(ML,y,ANC,MOTIV_HDR,'F');
  doc.setDrawColor(170,178,196); doc.setLineWidth(0.3); doc.rect(ML,y,ANC,MOTIV_HDR,'S');
  doc.setFont('helvetica','bolditalic'); doc.setFontSize(8.5); doc.setTextColor(...NEGRO);
  doc.text('17. ', ML+2.5, y+MOTIV_HDR-2);
  doc.text('MOTIVACION DE LA ACCION:', ML+2.5+doc.getTextWidth('17. '), y+MOTIV_HDR-2);
  y += MOTIV_HDR;
  const FIRMA_SPACE=42;
  const MOTIV_H=Math.max(30, H-y-FIRMA_SPACE-8);
  doc.setFillColor(...BLANCO); doc.rect(ML,y,ANC,MOTIV_H,'F');
  doc.setDrawColor(170,178,196); doc.rect(ML,y,ANC,MOTIV_H,'S');
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...NEGRO);
  doc.text(doc.splitTextToSize(d.motivacion||'',ANC-6), ML+3, y+7);
  y += MOTIV_H;
  y += 26;
  const firma=d.directora||'Directora de Recursos Humanos';
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...NEGRO);
  const fw=doc.getTextWidth(firma)+18;
  doc.setLineWidth(0.8); doc.setDrawColor(...NEGRO);
  doc.line(W/2-fw/2,y,W/2+fw/2,y);
  doc.text(firma, W/2, y+6, {align:'center'});
}

function makePDF(d){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  buildPage(doc,d); return doc;
}

// ══════════════════════════════════════════
// FORMULARIO INDIVIDUAL
// ══════════════════════════════════════════
function getFormData(){
  return {
    nombre: document.getElementById('f-nombre').value.trim(),
    fecha: fmtDate(document.getElementById('f-fecha').value),
    cargo: document.getElementById('f-cargo').value.trim(),
    sueldo: document.getElementById('f-sueldo').value.trim(),
    superior: document.getElementById('f-superior').value.trim(),
    fecha_ingreso: fmtDate(document.getElementById('f-ingreso').value),
    unidad: document.getElementById('f-unidad').value.trim(),
    cedula: document.getElementById('f-cedula').value.trim(),
    tiempo_adm: document.getElementById('f-tiempo').value.trim(),
    naturaleza: document.querySelector('input[name="nat"]:checked') ? document.querySelector('input[name="nat"]:checked').value : '',
    motivacion: document.getElementById('f-motiv').value.trim(),
    directora: document.getElementById('f-firma').value.trim(),
  };
}

function showSt(id,msg,tipo){
  const el=document.getElementById(id);
  el.textContent=msg; el.className='status '+tipo; el.style.display='block';
}

async function genFormPDF(){
  const d=getFormData();
  if(!d.nombre){showSt('st-form','Aviso: El nombre del empleado es requerido.','err');return;}
  if(!d.motivacion){showSt('st-form','Aviso: La motivación es requerida.','err');return;}
  if(SESSION && SESSION.rol==='vacperm' && VAC_PERM_KEYS.indexOf(d.naturaleza)<0){
    showSt('st-form','Aviso: No tienes permiso para crear acciones de esta naturaleza.','err');return;
  }
  const fname='Accion_Personal_'+d.nombre.replace(/\s+/g,'_').substring(0,40)+'.pdf';
  makePDF(d).save(fname);
  showSt('st-form','PDF descargado. Registrando en base de datos...','info');
  await registrarAccion(d);
  showSt('st-form','PDF descargado y guardado. Puedes re-descargarlo desde el Histórico mientras esté en estado "Creada".','ok');
}

function limpiarForm(){
  ['f-nombre','f-cargo','f-sueldo','f-superior','f-unidad','f-cedula','f-tiempo','f-motiv'].forEach(function(id){document.getElementById(id).value='';}),
  document.getElementById('f-fecha').valueAsDate=new Date();
  document.getElementById('f-ingreso').value='';
  document.getElementById('f-firma').value='Directora de Recursos Humanos';
  document.querySelector('input[value="nom_ord"]').checked=true;
  document.getElementById('st-form').style.display='none';
}

// ══════════════════════════════════════════
// CARGA MASIVA
// ══════════════════════════════════════════
const COLS=[
  {key:'nombre',label:'Nombre(s) y Apellido(s)'},
  {key:'fecha',label:'Fecha (DD/MM/AAAA)'},
  {key:'cargo',label:'Cargo'},
  {key:'sueldo',label:'Sueldo'},
  {key:'superior',label:'Superior Inmediato'},
  {key:'fecha_ingreso',label:'Fecha Ingreso'},
  {key:'unidad',label:'Unidad de Trabajo'},
  {key:'cedula',label:'Cédula'},
  {key:'tiempo_adm',label:'Tiempo Adm. Pública'},
  {key:'naturaleza',label:'Código de Acción'},
  {key:'motivacion',label:'Motivación'},
  {key:'directora',label:'Firma / Responsable'},
];
const KEYS_VALIDAS=ACCIONES.reduce(function(acc,g){return acc.concat(g.items.map(function(it){return it.key;}));},[]).join(', ');
let excelData=[];

function dlPlantilla(){
  const wb=XLSX.utils.book_new();
  const wsData=[
    ['=== INSTRUCCIONES ==='],
    ['Llena desde la fila 3. Una fila por empleado.'],
    ['Codigos validos para Codigo de Accion:'],
    [KEYS_VALIDAS],[''],
    COLS.map(function(c){return c.label;}),
    ['HILLARY YSABEL DE PENA MARTINEZ','29/05/2025','GESTOR DE PROTOCOLO','RD$ 50,000.00',
     'DIRECTOR(A) DE COMUNICACIONES','10/05/2025','DIVISION DE EVENTOS Y PROTOCOLO',
     '402-1394237-4','','nom_ord',
     'Inclusion en la nomina FIJO, con efectividad al 10/05/2025.','Directora de Recursos Humanos']
  ];
  const ws=XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols']=COLS.map(function(_,i){return {wch:i===10?70:i===0?42:22};});
  XLSX.utils.book_append_sheet(wb,ws,'Acciones');
  XLSX.writeFile(wb,'Plantilla_Accion_Personal_PROPEEP.xlsx');
}

function onDrop(e){
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('over');
  const f=e.dataTransfer.files[0]; if(f) loadExcel(f);
}

function loadExcel(file){
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      let hi=rows.findIndex(function(r){return r.some(function(c){return String(c).toLowerCase().indexOf('nombre')>=0;});});
      if(hi<0) hi=0;
      const DATE_KEYS={fecha:true,fecha_ingreso:true};
      excelData=rows.slice(hi+1).filter(function(r){return r.some(function(c){return String(c).trim()!='';})})
        .map(function(row){
          const obj={};
          COLS.forEach(function(col,i){ obj[col.key]=DATE_KEYS[col.key]?excelDateToStr(row[i]):String(row[i]||'').trim(); });
          return obj;
        }).filter(function(d){return d.nombre;});
      if(!excelData.length){ showSt('st-lote','No se encontraron filas de datos válidas.','err'); document.getElementById('prev-section').style.display='none'; return; }
      renderPrev();
      document.getElementById('prev-section').style.display='block';
      document.getElementById('st-lote').style.display='none';
    }catch(err){ showSt('st-lote','Error al leer el archivo: '+err.message,'err'); }
  };
  reader.readAsArrayBuffer(file);
}

function natSelectHtml(idx,currentKey){
  var opts='<option value="">— Seleccionar —</option>';
  ACCIONES.forEach(function(g){
    opts+='<optgroup label="'+g.titulo+'">';
    g.items.forEach(function(it){ opts+='<option value="'+it.key+'"'+(it.key===currentKey?' selected':'')+'>'+it.label+'</option>'; });
    opts+='</optgroup>';
  });
  return '<select onchange="excelData['+idx+'].naturaleza=this.value" style="min-width:160px;font-size:11.5px;padding:4px 6px;border:1.5px solid var(--borde);border-radius:4px;font-family:inherit">'+opts+'</select>';
}

function renderPrev(){
  const cols=['nombre','fecha','cargo','sueldo','cedula'];
  const lbls=['Nombre','Fecha','Cargo','Sueldo','Cédula'];
  let html='<table><thead><tr>'+lbls.map(function(l){return '<th>'+l+'</th>';}).join('')+'<th>Naturaleza de la Acción *</th></tr></thead><tbody>';
  excelData.forEach(function(d,i){
    html+='<tr>'+cols.map(function(k){return '<td>'+(d[k]||'—')+'</td>';}).join('')+'<td>'+natSelectHtml(i,d.naturaleza)+'</td></tr>';
  });
  html+='</tbody></table>';
  document.getElementById('prev-table').innerHTML=html;
  document.getElementById('prev-count').textContent='('+excelData.length+' empleados)';
}

function clearExcel(){ excelData=[]; document.getElementById('prev-section').style.display='none'; document.getElementById('fi').value=''; }

async function genLote(){
  if(!excelData.length) return;
  const sinNat=excelData.filter(function(d){return !d.naturaleza;});
  if(sinNat.length>0){ showSt('st-lote','Aviso: '+sinNat.length+' fila(s) sin naturaleza de acción.','err'); return; }
  const btn=document.getElementById('btn-lote');
  btn.disabled=true;
  const pw=document.getElementById('prog-wrap'), pb=document.getElementById('prog-bar');
  pw.style.display='block'; pb.style.width='0%';
  showSt('st-lote','Generando PDF con '+excelData.length+' acciones...','info');
  const {jsPDF}=window.jspdf;
  const finalDoc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  for(let i=0;i<excelData.length;i++){
    try{
      if(i>0) finalDoc.addPage('letter','portrait');
      buildPage(finalDoc,excelData[i]);
    }catch(e){ console.warn('Error fila',i,e); }
    pb.style.width=Math.round(((i+1)/excelData.length)*80)+'%';
    await new Promise(function(r){setTimeout(r,8);});
  }
  finalDoc.save('Acciones_Personal_'+new Date().toISOString().slice(0,10)+'.pdf');
  showSt('st-lote','Guardando en base de datos...','info');
  for(let i=0;i<excelData.length;i++){
    await registrarAccion(excelData[i]);
  }
  pb.style.width='100%';
  btn.disabled=false;
  showSt('st-lote','PDF con '+excelData.length+' páginas descargado y guardado. Re-descargable desde el Histórico mientras estén en estado Creada.','ok');
}

// ══════════════════════════════════════════
// RESUMEN POR MES (Pedro)
// ══════════════════════════════════════════
const NAT_POSITIVO = ['nom_ord','nom_nom','contrato','suplencia','reingreso','promocion','aumento','reclasificacion'];
const NAT_NEGATIVO = ['renuncia','termino_cont','suspension_cargo','abandono','exclusion','fallecimiento','invalidez','suspension_disc'];

function parseMonto(str){
  if(!str) return 0;
  const n = parseFloat(String(str).replace(/[^0-9.]/g,''));
  return isNaN(n) ? 0 : n;
}

function natSigno(natStr){
  for(var i=0; i<NAT_POSITIVO.length; i++){
    if((natLabel(NAT_POSITIVO[i])||'').toLowerCase() === (natStr||'').toLowerCase()) return 1;
  }
  for(var i=0; i<NAT_NEGATIVO.length; i++){
    if((natLabel(NAT_NEGATIVO[i])||'').toLowerCase() === (natStr||'').toLowerCase()) return -1;
  }
  return 0;
}

function renderResumen(){
  const year = parseInt(document.getElementById('res-year').value)||new Date().getFullYear();
  if(!histData.length){
    document.getElementById('resumen-body').innerHTML = '<div class="hist-loading">No hay registros.</div>';
    return;
  }
  const byMonth = {};
  histData.forEach(function(r){
    const fechaStr = r.fecha_generacion||'';
    const parts = fechaStr.split('/');
    if(parts.length < 3) return;
    const yy = parseInt(parts[2]);
    const mm = parseInt(parts[1]);
    if(yy !== year) return;
    if(!byMonth[mm]) byMonth[mm] = [];
    byMonth[mm].push(r);
  });
  const keys = Object.keys(byMonth).map(Number).sort(function(a,b){return a-b;});
  if(!keys.length){
    document.getElementById('resumen-body').innerHTML = '<div class="hist-loading">Sin registros para '+year+'.</div>';
    return;
  }
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let totalAcciones=0;
  let html = '';
  keys.forEach(function(mes){
    const rows = byMonth[mes];
    let mesPos=0, mesNeg=0, mesNeu=0;
    let mesMontoPos=0, mesMontoNeg=0;
    rows.forEach(function(r){
      const signo = natSigno(r.naturaleza||'');
      const monto = parseMonto(r.sueldo||'');
      if(signo>0){ mesPos++; mesMontoPos+=monto; }
      else if(signo<0){ mesNeg++; mesMontoNeg+=monto; }
      else mesNeu++;
    });
    const mesTotal = rows.length;
    totalAcciones += mesTotal;
    const mesNeto = mesMontoPos - mesMontoNeg;
    html += '<div class="mes-card">';
    html += '<div class="mes-header" onclick="toggleMes(&quot;mes-'+mes+'&quot;)">';
    html += '<span style="font-size:13px;font-weight:700">'+MESES[mes-1]+'</span>';
    html += '<div class="mes-totales">';
    html += '<span>Total: <strong>'+mesTotal+' acciones</strong></span>';
    html += '<span class="monto-pos">▲ '+mesPos+' | RD$'+mesMontoPos.toLocaleString('es-DO')+'</span>';
    html += '<span class="monto-neg">▼ '+mesNeg+' | RD$'+mesMontoNeg.toLocaleString('es-DO')+'</span>';
    html += '<span style="color:#fff;font-weight:700">Neto: RD$'+mesNeto.toLocaleString('es-DO')+'</span>';
    html += '</div></div>';
    html += '<div id="mes-'+mes+'" class="mes-body">';
    html += '<div class="table-wrap"><table><thead><tr><th>Empleado</th><th>Cédula</th><th>Cargo</th><th>Sueldo</th><th>Naturaleza</th><th>Estado</th><th>Signo</th></tr></thead><tbody>';
    rows.forEach(function(r){
      const signo = natSigno(r.naturaleza||'');
      const signoHtml = signo>0 ? '<span class="monto-pos">▲ Positivo</span>' : signo<0 ? '<span class="monto-neg">▼ Negativo</span>' : '<span class="monto-neu">○ Neutro</span>';
      const est = r.estado||'Creada';
      html += '<tr>';
      html += '<td><strong>'+(r.nombre_empleado||'—')+'</strong></td>';
      html += '<td>'+(fmtCed(r.cedula_empleado)||'—')+'</td>';
      html += '<td>'+(r.cargo||'—')+'</td>';
      html += '<td>'+(r.sueldo||'—')+'</td>';
      html += '<td>'+(r.naturaleza||'—')+'</td>';
      html += '<td><span class="est-badge est-'+est.replace(/\s/g,'')+'">'+est+'</span></td>';
      html += '<td>'+signoHtml+'</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div></div>';
  });
  let grandPos=0, grandNeg=0;
  keys.forEach(function(mes){
    byMonth[mes].forEach(function(r){
      const signo = natSigno(r.naturaleza||'');
      const monto = parseMonto(r.sueldo||'');
      if(signo>0) grandPos+=monto;
      else if(signo<0) grandNeg+=monto;
    });
  });
  const grandNeto = grandPos - grandNeg;
  html += '<div class="resumen-total">';
  html += '<span> '+year+': <strong>'+totalAcciones+' acciones</strong></span>';
  html += '<span class="monto-pos">▲ Ingresos: RD$'+grandPos.toLocaleString('es-DO')+'</span>';
  html += '<span class="monto-neg">▼ Egresos: RD$'+grandNeg.toLocaleString('es-DO')+'</span>';
  html += '<span style="color:var(--azul)">Neto: RD$'+grandNeto.toLocaleString('es-DO')+'</span>';
  html += '</div>';
  document.getElementById('resumen-body').innerHTML = html;
}

function toggleMes(id){
  const el = document.getElementById(id);
  if(el) el.style.display = el.style.display==='none' ? '' : 'none';
}

