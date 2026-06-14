
// Nómina dinámica desde Supabase (reemplaza la constante NOMINA cuando está cargada)
var NOMINA_LIVE = null;

function getNomina(){
  return (NOMINA_LIVE && NOMINA_LIVE.length) ? NOMINA_LIVE : NOMINA;
}

// Carga la nómina desde Supabase (tabla nomina_mayo2026)
async function cargarNominaLive(){
  try{
    var r = await fetch(SUPA_URL+'/rest/v1/nomina_mayo2026?select=cedula,nombre,sexo,puesto,departamento,sueldo,fecha_ingreso&order=nombre.asc&limit=5000', {headers: SUPA_HEADERS});
    if(r.ok){
      var data = await r.json();
      if(data && data.length){
        NOMINA_LIVE = data.map(function(e){
          return {
            cedula: String(e.cedula||'').replace(/[^0-9]/g,''),
            nombre: e.nombre||'',
            sexo: e.sexo||'',
            puesto: e.puesto||'',
            departamento: e.departamento||'',
            sueldo: e.sueldo||0,
            fecha_ingreso: e.fecha_ingreso||'',
            grupo: e.grupo||'',
          };
        });
        return true;
      }
    }
  }catch(e){ console.warn('cargarNominaLive', e); }
  return false;
}

function buscarEmpleado(){
  const q = (document.getElementById('cert-buscar').value||'').trim().toLowerCase();
  const sug = document.getElementById('cert-sugerencias');
  if(q.length < 2){ sug.innerHTML=''; return; }
  const found = getNomina().filter(function(e){
    const qd=q.replace(/[^0-9]/g,''); return (qd && e.cedula.indexOf(qd)>=0) || e.nombre.toLowerCase().indexOf(q)>=0;
  }).slice(0,8);
  if(!found.length){ sug.innerHTML='<div class="cert-sug"><div class="cert-sug-item" style="color:#9e1b32">No se encontró ningún empleado</div></div>'; return; }
  let html = '<div class="cert-sug">';
  found.forEach(function(e){
    html += '<div class="cert-sug-item" onclick="seleccionarEmpleado(&quot;'+e.cedula+'&quot;)"><strong>'+e.nombre+'</strong><span>'+fmtCed(e.cedula)+' &middot; '+e.puesto+'</span></div>';
  });
  html += '</div>';
  sug.innerHTML = html;
}

function seleccionarEmpleado(cedula){
  const e = getNomina().find(function(x){ return x.cedula===cedula; });
  if(!e) return;
  document.getElementById('cert-buscar').value = e.nombre;
  document.getElementById('cert-sugerencias').innerHTML = '';
  document.getElementById('ce-nombre').value = e.nombre;
  document.getElementById('ce-cedula').value = fmtCed(e.cedula);
  document.getElementById('ce-cargo').value = e.puesto;
  document.getElementById('ce-depto').value = e.departamento;
  document.getElementById('ce-sueldo').value = 'RD$ '+Number(e.sueldo).toLocaleString('es-DO')+'.00';
  document.getElementById('ce-ingreso').value = e.fecha_ingreso;
  document.getElementById('ce-grupo').value = e.grupo;
  document.getElementById('ce-sexo').value = e.sexo;
  const now = new Date();
  document.getElementById('ce-fecha-doc').value = String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+now.getFullYear();
  document.getElementById('cert-form-wrap').style.display = 'block';
  document.getElementById('st-cert').style.display = 'none';
}

function limpiarCert(){
  document.getElementById('cert-buscar').value='';
  document.getElementById('cert-sugerencias').innerHTML='';
  document.getElementById('cert-form-wrap').style.display='none';
  ['ce-nombre','ce-cedula','ce-cargo','ce-depto','ce-sueldo','ce-ingreso','ce-grupo',
   'ce-pais','ce-salida','ce-retorno','ce-motivo-viaje','ce-fecha-desv','ce-motivo-desv',
   'ce-obs','ce-fecha-doc'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('ce-firmante').value='Joney R. Dotel Coll';
  document.getElementById('st-cert').style.display='none';
  document.querySelector('input[name="cert-tipo"][value="labora"]').checked=true;
  onTipoCert();
}

function onTipoCert(){
  const tipo = document.querySelector('input[name="cert-tipo"]:checked').value;
  document.getElementById('extra-consular').style.display = tipo==='consular' ? 'block' : 'none';
  document.getElementById('extra-desvinc').style.display  = tipo==='desvinculacion' ? 'block' : 'none';
}

function getCertData(){
  return {
    nombre:       document.getElementById('ce-nombre').value.trim(),
    cedula:       document.getElementById('ce-cedula').value.trim(),
    cargo:        document.getElementById('ce-cargo').value.trim(),
    departamento: document.getElementById('ce-depto').value.trim(),
    sueldo:       document.getElementById('ce-sueldo').value.trim(),
    fecha_ingreso:document.getElementById('ce-ingreso').value.trim(),
    grupo:        document.getElementById('ce-grupo').value.trim(),
    sexo:         document.getElementById('ce-sexo').value,
    firmante:     document.getElementById('ce-firmante').value.trim(),
    fecha_doc:    document.getElementById('ce-fecha-doc').value.trim(),
    obs:          document.getElementById('ce-obs').value.trim(),
    tipo:         document.querySelector('input[name="cert-tipo"]:checked').value,
    pais:         (document.getElementById('ce-pais')||{value:''}).value.trim(),
    salida:       (document.getElementById('ce-salida')||{value:''}).value.trim(),
    retorno:      (document.getElementById('ce-retorno')||{value:''}).value.trim(),
    motivo_viaje: (document.getElementById('ce-motivo-viaje')||{value:''}).value.trim(),
    fecha_desv:   (document.getElementById('ce-fecha-desv')||{value:''}).value.trim(),
    motivo_desv:  (document.getElementById('ce-motivo-desv')||{value:''}).value.trim(),
  };
}

// ── PDF Certificación ──
// Números en letras (pesos dominicanos)
function numLetras(n){
  const U=['','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez',
    'once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
  const D=['','diez','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C=['','cien','doscientos','trescientos','cuatrocientos','quinientos','seiscientos',
    'setecientos','ochocientos','novecientos'];
  if(n===0) return 'cero';
  if(n<0) return 'menos '+numLetras(-n);
  let s='';
  if(n>=1000000){ s+=numLetras(Math.floor(n/1000000))+' millón '; n%=1000000; }
  if(n>=1000){ const m=Math.floor(n/1000); s+=(m===1?'mil ':numLetras(m)+' mil '); n%=1000; }
  if(n>=100){ s+=C[Math.floor(n/100)]+' '; n%=100; }
  if(n>=20){ s+=D[Math.floor(n/10)]+(n%10?' y '+U[n%10]:''); }
  else if(n>0){ s+=U[n]; }
  return s.trim();
}

function sueldoLetras(sueldoStr){
  const num = parseFloat(String(sueldoStr).replace(/[^0-9.]/g,''))||0;
  const entero = Math.floor(num);
  const cents = Math.round((num - entero)*100);
  const letras = numLetras(entero);
  const centsStr = String(cents).padStart(2,'0');
  return letras.charAt(0).toUpperCase()+letras.slice(1)+' Pesos Dominicanos con '+centsStr+'/100';
}

function sueldoAnual(sueldoStr){
  const m = parseFloat(String(sueldoStr).replace(/[^0-9.]/g,''))||0;
  return m*12;
}

function fmtPeso(n){
  return 'RD$'+n.toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// ISR/TSS calculation
function calcTSS(sueldo){
  const AFP_TASA=0.0287, ARS_TASA=0.0304, AFP_TOPE=13330, ARS_TOPE=7059.79;
  const afp = Math.min(sueldo*AFP_TASA, AFP_TOPE);
  const ars = Math.min(sueldo*ARS_TASA, ARS_TOPE);
  return Math.round((afp+ars)*100)/100;
}

function calcISRMensual(sueldo){
  const base = sueldo - calcTSS(sueldo);
  const TRAMOS=[{inf:0,sup:34685,tasa:0},{inf:34685.01,sup:52027.42,tasa:0.15},
    {inf:52027.43,sup:72260.25,tasa:0.2},{inf:72260.26,sup:Infinity,tasa:0.25}];
  let isr=0;
  for(const t of TRAMOS){
    if(base<=t.inf) break;
    isr+=(Math.min(base,t.sup)-t.inf)*t.tasa;
  }
  return Math.round(isr*100)/100;
}

function buildCertPDF(doc, d){
  const W=216, H=279, ML=20, MR=20, ANC=W-ML-MR;
  const AZUL=[26,58,107], ROJO=[200,16,46], NEGRO=[30,30,30];

  const esMasc = (d.sexo||'').toUpperCase().indexOf('MASC')>=0;
  const sr = esMasc ? 'el señor' : 'la señora';
  const Sr = esMasc ? 'el Sr.' : 'la Sra.';
  const portador = esMasc ? 'portador' : 'portadora';

  // Helper: add text with Times New Roman
  function setTimes(style, size){ doc.setFont('times', style); doc.setFontSize(size); }

  // ─── LOGO CENTRADO ───
  try{ doc.addImage('data:image/jpeg;base64,'+LOGO_B64,'JPEG', W/2-16, 6, 32, 26); }catch(e){}

  // Texto debajo del logo
  setTimes('bold', 10); doc.setTextColor(...AZUL);
  doc.text('Proyectos Estratégicos', W/2, 36, {align:'center'});
  doc.text('y Especiales de la Presidencia', W/2, 41, {align:'center'});



  let y = 0;

  // ════ CERTIFICACIÓN LABORAL / CONSULAR ════
  if(d.tipo === 'labora' || d.tipo === 'laboro' || d.tipo === 'consular'){

    // Título
    y = 62;
    setTimes('bold', 14); doc.setTextColor(...NEGRO);
    doc.text('CERTIFICACIÓN', W/2, y, {align:'center'});
    y += 22;

    // Cuerpo del texto — laboro
    doc.setTextColor(...NEGRO);
    setTimes('normal', 11);

    const sueldo = parseFloat(String(d.sueldo).replace(/[^0-9.]/g,''))||0;
    const anual = sueldo * 12;
    const tss = calcTSS(sueldo);
    const isr = calcISRMensual(sueldo);
    const retenciones = Math.round((tss + isr)*12*100)/100;

    let parrafo1 = '';
    if(d.tipo === 'labora' || d.tipo === 'laboro'){
      parrafo1 =
        'Por este medio se hace constar que ' + sr + ' ';
    } else {
      parrafo1 =
        'Por este medio se hace constar que ' + sr + ' ';
    }

    // Escribir párrafo con nombre en negrita
    const nombreUpper = (d.nombre||'').toUpperCase();
    const cedulaFmt = fmtCed(d.cedula);
    const cargoUpper = (d.cargo||'').toUpperCase();
    const deptUpper = (d.departamento||'').toUpperCase();

    // Build full justified text block manually with mixed bold
    function writeJustified(doc, segments, x, y, maxW, lineH){
      // segments: array of {text, bold}
      // Simple approach: build words with style tags, then wrap
      let lines = [];
      let curLine = [];
      let curW = 0;
      const spaceW = doc.setFont('times','normal') && 0;

      for(let si=0; si<segments.length; si++){
        const seg = segments[si];
        doc.setFont('times', seg.bold?'bold':'normal');
        doc.setFontSize(11);
        const words = seg.text.split(' ');
        for(let wi=0; wi<words.length; wi++){
          const w = words[wi];
          if(!w) continue;
          const ww = doc.getTextWidth(w+' ');
          if(curW + ww > maxW && curLine.length > 0){
            lines.push(curLine);
            curLine = [];
            curW = 0;
          }
          curLine.push({text:w, bold:seg.bold});
          curW += ww;
        }
      }
      if(curLine.length) lines.push(curLine);

      let cy = y;
      for(let li=0; li<lines.length; li++){
        let cx = x;
        const line = lines[li];
        const isLast = li===lines.length-1;
        // calc total width
        let totalW = 0;
        line.forEach(function(item){
          doc.setFont('times', item.bold?'bold':'normal');
          doc.setFontSize(11);
          totalW += doc.getTextWidth(item.text);
        });
        const spaces = line.length-1;
        // espacio natural de Times 11pt — la última línea no se justifica
        doc.setFont('times','normal'); doc.setFontSize(11);
        const natSp = doc.getTextWidth(' ');
        const extraSpace = isLast ? natSp : (spaces>0 ? Math.max(natSp, (maxW-totalW)/spaces) : natSp);
        line.forEach(function(item, idx){
          doc.setFont('times', item.bold?'bold':'normal');
          doc.setFontSize(11);
          doc.setTextColor(...NEGRO);
          doc.text(item.text, cx, cy);
          cx += doc.getTextWidth(item.text) + (idx<line.length-1 ? extraSpace : 0);
        });
        cy += lineH;
      }
      return cy;
    }

    const lineH = 6.5;

    if(d.tipo === 'labora' || d.tipo === 'laboro'){
      // Párrafo 1
      y = writeJustified(doc, [
        {text:'Por este medio se hace constar que '+sr+' ', bold:false},
        {text:nombreUpper+',', bold:true},
        {text:' '+portador+' de la cédula de Identidad Personal y Electoral', bold:false},
        {text:' No. '+cedulaFmt+',', bold:true},
        {text:' labora para esta', bold:false},
        {text:' DIRECCIÓN GENERAL DE PROYECTOS ESTRATÉGICOS Y ESPECIALES DE LA PRESIDENCIA,', bold:true},
        {text:' desde el '+d.fecha_ingreso+', desempeñando el cargo de', bold:false},
        {text:' '+cargoUpper+',', bold:true},
        {text:' en '+articuloDepto(d.departamento)+' '+d.departamento+', con un salario bruto mensual de', bold:false},
        {text:' '+fmtPeso(sueldo)+' ('+sueldoLetras(d.sueldo)+').', bold:true},
      ], ML, y, ANC, lineH);

      y += 8;
      y = writeJustified(doc, [
        {text:'Se expide la presente, a solicitud de la parte interesada, para los fines de lugar, en Santo Domingo, Distrito Nacional, a los '+d.fecha_doc.split('/')[0]+' día del mes de '+mesEnLetras(d.fecha_doc)+' del año '+d.fecha_doc.split('/')[2]+'.', bold:false}
      ], ML, y, ANC, lineH);

    } else {
      // Consular — salario anual + retenciones
      y = writeJustified(doc, [
        {text:'Por este medio se hace constar que '+sr+' ', bold:false},
        {text:nombreUpper+',', bold:true},
        {text:' '+portador+' de la cédula de Identidad Personal y Electoral', bold:false},
        {text:' No. '+cedulaFmt+',', bold:true},
        {text:' labora para esta', bold:false},
        {text:' DIRECCIÓN GENERAL DE PROYECTOS ESTRATÉGICOS Y ESPECIALES DE LA PRESIDENCIA', bold:true},
        {text:' desde el '+d.fecha_ingreso+', desempeñando el cargo de', bold:false},
        {text:' '+cargoUpper+',', bold:true},
        {text:' en '+articuloDepto(d.departamento)+' '+d.departamento+', devengando un salario anual de', bold:false},
        {text:' '+fmtPeso(anual)+' ('+sueldoLetras(anual)+'),', bold:true},
        {text:' se le aplica retención por TSS e ISR de', bold:false},
        {text:' '+fmtPeso(retenciones)+' ('+sueldoLetras(retenciones)+').', bold:true},
      ], ML, y, ANC, lineH);

      y += 8;
      y = writeJustified(doc, [
        {text:'Se expide la presente, a solicitud de la parte interesada, en Santo Domingo, Distrito Nacional, a los '+d.fecha_doc.split('/')[0]+' días del mes de '+mesEnLetras(d.fecha_doc)+' del año '+d.fecha_doc.split('/')[2]+'.', bold:false}
      ], ML, y, ANC, lineH);
    }

    // Firma — bloque centrado
    y += 18;
    setTimes('normal', 11); doc.setTextColor(...NEGRO);
    doc.text('Atentamente,', W/2, y, {align:'center'});
    y += 22;
    doc.setLineWidth(0.5); doc.setDrawColor(...NEGRO);
    doc.line(W/2-34, y, W/2+34, y);
    y += 5.5;
    setTimes('bold', 11);
    doc.text(d.firmante||'Joney R. Dotel Coll', W/2, y, {align:'center'});
    y += 5.5;
    setTimes('normal', 10);
    doc.text('Directora de Recursos Humanos', W/2, y, {align:'center'});

    // Referencia DRH
    y += 14;
    setTimes('normal', 10); doc.setTextColor(80,80,80);
    doc.text(drhRef(), ML, y);

  // ════ DESVINCULACIÓN ════
  } else if(d.tipo === 'desvinculacion'){

    // Logo ya está arriba — formato carta
    y = 54;

    // Fecha y lugar
    setTimes('normal', 11); doc.setTextColor(...NEGRO);
    doc.text('Santo Domingo, D.N.', ML, y);
    y += 5.5;
    doc.text(d.fecha_doc+' del año '+d.fecha_doc.split('/')[2]||'', ML, y);
    y += 14;

    // Destinatario
    setTimes('normal', 11);
    doc.text((esMasc?'Señor:':'Señora:'), ML, y);
    y += 5.5;
    setTimes('bold', 11);
    doc.text((d.nombre||'').toUpperCase(), ML, y);
    y += 5.5;
    setTimes('normal', 11);
    doc.text('Sus manos. —', ML, y);
    y += 14;

    // Saludo
    setTimes('bold', 11);
    const apellido = (d.nombre||'').split(' ').slice(-1)[0];
    doc.text('Distinguido '+(esMasc?'Sr.':'Sra.')+' '+apellido+',', ML, y);
    y += 10;

    // Cuerpo
    setTimes('normal', 11);
    function writeJustifiedSimple(text, yy){
      const lines = doc.splitTextToSize(text, ANC);
      lines.forEach(function(line, i){
        doc.text(line, ML, yy + i*6.5);
      });
      return yy + lines.length*6.5;
    }

    y = writeJustifiedSimple(
      'Cortésmente me dirijo a usted para notificarle que, por conveniencia en el servicio la Dirección General de Proyectos Estratégicos y Especiales de la Presidencia, ha decidido desvincularlo(a) de la posición de '+d.cargo+', adscrito(a) a '+articuloDepto(d.departamento)+' '+d.departamento+', con efectividad al '+d.fecha_desv+', de acuerdo con el Art. Núm. 94 de la Ley de Función Pública Núm. 41-08.',
      y
    );
    y += 8;
    y = writeJustifiedSimple(
      'De igual manera agradecemos por las labores realizadas durante el tiempo de servicio que formó parte de nuestro equipo de trabajo.',
      y
    );
    y += 8;

    setTimes('normal', 11);
    doc.text('Sin otro particular,', ML, y);
    y += 18;

    // Firma
    doc.setLineWidth(0.5); doc.setDrawColor(...NEGRO);
    doc.line(ML, y, ML+65, y);
    y += 5;
    setTimes('bold', 11);
    doc.text(d.firmante||'Joney R. Dotel Coll', ML, y);
    y += 5;
    setTimes('normal', 10);
    doc.text('Directora de Recursos Humanos', ML, y);
    y += 5;
    doc.text(drhRef(), ML, y);
  }

  // ─── FOOTER con iconos vectoriales ───
  const fy = H - 11;
  doc.setDrawColor(...AZUL); doc.setLineWidth(0.5);
  doc.line(ML, fy-5.5, W-MR, fy-5.5);

  // Dibuja cada icono dentro de un círculo (estilo membrete oficial)
  function iconCircle(cx, cy){
    doc.setDrawColor(...AZUL); doc.setLineWidth(0.35);
    doc.circle(cx, cy, 2.1, 'S');
  }
  function iconPin(cx, cy){
    iconCircle(cx, cy);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy-0.35, 0.62, 'S');
    doc.line(cx-0.55, cy-0.05, cx, cy+1.05);
    doc.line(cx+0.55, cy-0.05, cx, cy+1.05);
  }
  function iconMail(cx, cy){
    iconCircle(cx, cy);
    doc.setLineWidth(0.3);
    doc.rect(cx-1.05, cy-0.75, 2.1, 1.5, 'S');
    doc.line(cx-1.05, cy-0.75, cx, cy+0.15);
    doc.line(cx+1.05, cy-0.75, cx, cy+0.15);
  }
  function iconWeb(cx, cy){
    iconCircle(cx, cy);
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, 1.05, 'S');
    doc.line(cx-1.05, cy, cx+1.05, cy);
    doc.ellipse(cx, cy, 0.45, 1.05, 'S');
  }
  function iconPhone(cx, cy){
    iconCircle(cx, cy);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx-0.62, cy-1.0, 1.24, 2.0, 0.25, 0.25, 'S');
    doc.line(cx-0.25, cy+0.62, cx+0.25, cy+0.62);
  }
  function iconSocial(cx, cy){
    iconCircle(cx, cy);
    doc.setLineWidth(0.3);
    doc.line(cx-0.75, cy, cx+0.7, cy-0.7);
    doc.line(cx-0.75, cy, cx+0.7, cy+0.7);
    doc.circle(cx-0.75, cy, 0.32, 'F');
    doc.circle(cx+0.7, cy-0.7, 0.32, 'F');
    doc.circle(cx+0.7, cy+0.7, 0.32, 'F');
  }

  const footerItems = [
    {icon: iconPin,    txt: 'Av. Mexico, esq. Leopoldo\nNavarro, Sto. Dgo., R.D.'},
    {icon: iconMail,   txt: 'info@propeep.gob.do'},
    {icon: iconWeb,    txt: 'www.propeep.gob.do'},
    {icon: iconPhone,  txt: '809 686 1800'},
    {icon: iconSocial, txt: '@propeepgob'},
  ];
  setTimes('normal', 6.5);
  const colW2 = ANC / footerItems.length;
  footerItems.forEach(function(item, i){
    const colCx = ML + i * colW2 + colW2/2;
    const lines = item.txt.split('\n');
    // ancho del texto = línea más larga
    let textW = 0;
    lines.forEach(function(ln){ textW = Math.max(textW, doc.getTextWidth(ln)); });
    const iconW = 4.2, gap = 1.6;
    const totalW = iconW + gap + textW;
    const startX = colCx - totalW/2;
    item.icon(startX + 2.1, fy - 0.6);
    doc.setTextColor(90,90,90);
    const ty = lines.length > 1 ? fy - 1.6 : fy + 0.4;
    lines.forEach(function(ln, li){
      doc.text(ln, startX + iconW + gap, ty + li*2.7);
    });
  });
}

function drhRef(){
  if(!SESSION || !SESSION.nombre) return 'DRH';
  const p = SESSION.nombre.trim().split(/\s+/);
  const apellido = p.length >= 3 ? p[2] : (p[1]||'');
  const ini = (p[0].charAt(0) + (apellido.charAt(0)||'')).toLowerCase();
  return 'DRH/' + ini;
}

function articuloDepto(depto){
  const d = (depto||'').toUpperCase().trim();
  // Dirección → "la Dirección..."
  if(d.startsWith('DIRECCION') || d.startsWith('DIRECCIÓN')) return 'la';
  // Subdirección → "la Subdirección..."
  if(d.startsWith('SUBDIRECCION') || d.startsWith('SUBDIRECCIÓN')) return 'la';
  // División → "la División..."
  if(d.indexOf('DIVISION')>=0 || d.indexOf('DIVISIÓN')>=0) return 'la';
  // Sección → "la Sección..."
  if(d.indexOf('SECCION')>=0 || d.indexOf('SECCIÓN')>=0) return 'la';
  // Oficina → "la Oficina..."
  if(d.startsWith('OFICINA')) return 'la';
  // Consultoría → "la Consultoría..."
  if(d.startsWith('CONSULTORIA') || d.startsWith('CONSULTORÍA')) return 'la';
  // Departamento → "el Departamento..."
  if(d.startsWith('DEPARTAMENTO')) return 'el';
  // DAF y sus subdivisiones → "la DAF" pero si dice DEPARTAMENTO dentro → "el"
  if(d.startsWith('DAF')){
    if(d.indexOf('DEPARTAMENTO')>=0) return 'el';
    if(d.indexOf('DIVISION')>=0 || d.indexOf('DIVISIÓN')>=0) return 'la';
    if(d.indexOf('SECCION')>=0 || d.indexOf('SECCIÓN')>=0) return 'la';
    return 'la'; // DAF sola
  }
  // Programa → "el Programa..."
  if(d.startsWith('PROGRAMA')) return 'el';
  // Fallback → "el"
  return 'el';
}

function nombreDepto(depto){
  // Capitalize properly for display in carta
  return (depto||'').trim();
}

function mesEnLetras(fechaStr){
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const parts = (fechaStr||'').split('/');
  if(parts.length<2) return '';
  const m = parseInt(parts[1]);
  return meses[m-1]||'';
}
async function generarCertificacion(){
  const d = getCertData();
  if(!d.nombre){ showSt('st-cert','Aviso: Selecciona un empleado primero.','err'); return; }
  if(!d.fecha_doc){ showSt('st-cert','Aviso: La fecha del documento es requerida.','err'); return; }
  if(d.tipo==='consular' && (!d.pais||!d.salida||!d.retorno)){ showSt('st-cert','Aviso: Completa los datos del viaje.','err'); return; }
  if(d.tipo==='desvinculacion' && (!d.fecha_desv||!d.motivo_desv)){ showSt('st-cert','Aviso: Completa los datos de desvinculación.','err'); return; }

  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  buildCertPDF(doc, d);
  const fname = d.tipo+'_'+d.nombre.replace(/\s+/g,'_').substring(0,30)+'_'+d.fecha_doc.replace(/\//g,'-')+'.pdf';
  doc.save(fname);

  showSt('st-cert','PDF generado. Guardando en base de datos...','info');

  // Save to Supabase and update nomina record if fields changed
  await sbInsertCert(d);

  // Update nomina if data was modified
  const _cedDig = String(d.cedula||'').replace(/[^0-9]/g,'');
  const original = getNomina().find(function(e){ return e.cedula===_cedDig; });
  if(original){
    const sueldoNum = parseFloat(String(d.sueldo).replace(/[^0-9.]/g,''))||0;
    if(original.nombre!==d.nombre || original.puesto!==d.cargo || original.departamento!==d.departamento || original.sueldo!==sueldoNum || original.fecha_ingreso!==d.fecha_ingreso){
      original.nombre = d.nombre;
      original.puesto = d.cargo;
      original.departamento = d.departamento;
      original.sueldo = sueldoNum;
      original.fecha_ingreso = d.fecha_ingreso;
      await sbUpdateNomina(d);
    }
  }
  showSt('st-cert','Certificación generada y guardada correctamente.','ok');
}

// ══════════════════════════════════════════
// CERTIFICACIONES EMITIDAS — HISTÓRICO
// ══════════════════════════════════════════
let certHistData = [];
const CERT_TIPOS = {labora:'Carta de Labora', laboro:'Carta de Labora', consular:'Carta Consular', desvinculacion:'Desvinculación'};

async function loadCertHist(){
  const body = document.getElementById('certhist-body');
  body.innerHTML = '<div class="hist-loading">Cargando registro...</div>';
  try{
    const r = await fetch(SUPA_URL+'/rest/v1/certificaciones?order=id.desc&limit=500', {headers: SUPA_HEADERS});
    certHistData = r.ok ? await r.json() : [];
  }catch(e){ console.warn('CertHist read error', e); certHistData = []; }
  renderCertHist();
}

function certHistFiltered(){
  const q = (document.getElementById('certhist-search').value||'').toLowerCase();
  const tipo = document.getElementById('certhist-tipo').value;
  return certHistData.filter(function(r){
    const rTipo = r.tipo === 'laboro' ? 'labora' : r.tipo;
    if(tipo && rTipo !== tipo) return false;
    if(q){
      const blob = ((r.nombre_empleado||'')+' '+(r.cedula_empleado||'')+' '+fmtCed(r.cedula_empleado)+' '+(r.generado_por||'')).toLowerCase();
      if(blob.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function renderCertHist(){
  const rows = certHistFiltered();
  const body = document.getElementById('certhist-body');
  if(!rows.length){
    body.innerHTML = '<div class="hist-loading">No hay certificaciones registradas con esos criterios.</div>';
    return;
  }
  let html = '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Emitida por</th><th>Tipo</th><th>Empleado</th><th>Cédula</th><th>Cargo</th><th>Documento</th></tr></thead><tbody>';
  rows.forEach(function(r){
    html += '<tr>';
    html += '<td>'+(r.fecha_generacion||'—')+'</td>';
    html += '<td><strong>'+(r.generado_por||'—')+'</strong></td>';
    html += '<td>'+(CERT_TIPOS[r.tipo]||r.tipo||'—')+'</td>';
    html += '<td>'+(r.nombre_empleado||'—')+'</td>';
    html += '<td>'+(fmtCed(r.cedula_empleado)||'—')+'</td>';
    html += '<td>'+(r.cargo||'—')+'</td>';
    if(r.datos_extra){
      html += '<td><button onclick="reDescargarCert('+r.id+')" class="btn btn-outline" style="padding:4px 12px;font-size:10px">Descargar PDF</button></td>';
    } else {
      html += '<td><span style="font-size:11px;color:#a4abb7">No disponible</span></td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="margin-top:10px;font-size:11.5px;color:#646e7e">'+rows.length+' certificación(es)</div>';
  body.innerHTML = html;
}

function reDescargarCert(id){
  const rec = certHistData.find(function(r){ return r.id === id; });
  if(!rec || !rec.datos_extra){ alert('No hay datos guardados para regenerar este documento.'); return; }
  try{
    const d = JSON.parse(rec.datos_extra);
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    buildCertPDF(doc, d);
    const fname = (d.tipo||'certificacion')+'_'+(d.nombre||'').replace(/\s+/g,'_').substring(0,30)+'.pdf';
    doc.save(fname);
  }catch(e){ alert('Error al regenerar el PDF: '+e.message); }
}

function exportarCertHist(){
  const rows = certHistFiltered();
  if(!rows.length){ alert('No hay registros visibles para exportar.'); return; }
  const data = rows.map(function(r){
    return {
      'Fecha':r.fecha_generacion||'', 'Emitida Por':r.generado_por||'',
      'Tipo':CERT_TIPOS[r.tipo]||r.tipo||'', 'Empleado':r.nombre_empleado||'',
      'Cédula':fmtCed(r.cedula_empleado), 'Cargo':r.cargo||'',
      'Departamento':r.departamento||'', 'Sueldo':r.sueldo||'', 'Fecha Ingreso':r.fecha_ingreso||''
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{wch:20},{wch:28},{wch:20},{wch:34},{wch:16},{wch:26},{wch:28},{wch:16},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Certificaciones');
  XLSX.writeFile(wb, 'Certificaciones_Emitidas_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

// ── Supabase cert functions ──
async function sbInsertCert(d){
  try{
    const now = new Date();
    const fecha = now.toLocaleString('es-DO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    await fetch(SUPA_URL+'/rest/v1/certificaciones', {
      method:'POST',
      headers:{...SUPA_HEADERS,'Prefer':'return=minimal'},
      body: JSON.stringify({
        fecha_generacion: fecha,
        generado_por: SESSION ? SESSION.nombre : '',
        tipo: d.tipo,
        nombre_empleado: d.nombre,
        cedula_empleado: d.cedula,
        cargo: d.cargo,
        departamento: d.departamento,
        sueldo: d.sueldo,
        fecha_ingreso: d.fecha_ingreso,
        datos_extra: JSON.stringify(d)
      })
    });
  }catch(e){ console.warn('Cert insert error',e); }
}

async function sbUpdateNomina(d){
  try{
    await fetch(SUPA_URL+'/rest/v1/nomina_mayo2026?cedula=eq.'+String(d.cedula||'').replace(/[^0-9]/g,''), {
      method:'PATCH',
      headers:{...SUPA_HEADERS,'Prefer':'return=minimal'},
      body: JSON.stringify({
        nombre: d.nombre,
        puesto: d.cargo,
        departamento: d.departamento,
        sueldo: parseFloat(String(d.sueldo).replace(/[^0-9.]/g,''))||0,
        fecha_ingreso: d.fecha_ingreso
      })
    });
  }catch(e){ console.warn('Nomina update error',e); }
}

// ══════════════════════════════════════════
// DESCARGAR PDF DESDE HISTÓRICO
// ══════════════════════════════════════════
function descargarPDF(id){
  const rec = histData.find(function(r){ return r.id === id; });
  if(!rec || !rec.form_data){ alert('No hay datos de formulario para esta acción.'); return; }
  try{
    const d = JSON.parse(rec.form_data);
    const fname = 'Accion_Personal_'+(d.nombre||'').replace(/\s+/g,'_').substring(0,40)+'.pdf';
    makePDF(d).save(fname);
  }catch(e){ alert('Error al generar PDF: '+e.message); }
}

// ══════════════════════════════════════════
// EXPORTAR HISTÓRICO A EXCEL
// ══════════════════════════════════════════
function exportarExcel(){
  if(!histData.length){ alert('No hay registros para exportar.'); return; }
  const search = (document.getElementById('hist-search').value||'').toLowerCase();
  const estFilt = document.getElementById('hist-est').value;
  const tipoFilt = document.getElementById('hist-tipo') ? document.getElementById('hist-tipo').value : '';
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
    if(tipoFilt && (r.tipo_empleado||'') !== tipoFilt) return false;
    if(search && nombre.indexOf(search)<0 && cedula.indexOf(search)<0) return false;
    return true;
  });

  if(!filtered.length){ alert('No hay registros visibles para exportar.'); return; }

  const headers = ['Fecha','Generado Por','Empleado','Cédula','Cargo','Tipo Empleado','Sueldo','Naturaleza','Motivación','Estado'];
  const rows = filtered.map(function(r){
    return [
      r.fecha_generacion||'',
      r.generado_por||'',
      r.nombre_empleado||'',
      fmtCed(r.cedula_empleado),
      r.cargo||'',
      tipoEmpLabel(r.tipo_empleado||''),
      r.sueldo||'',
      r.naturaleza||'',
      r.motivacion||'',
      r.estado||'Creada'
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    {wch:20},{wch:28},{wch:35},{wch:18},{wch:30},
    {wch:18},{wch:22},{wch:60},{wch:12}
  ];
  // Style header row (bold via cell format)
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
  const fecha = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, 'Historico_Acciones_'+fecha+'.xlsx');
}

