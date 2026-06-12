// ══════════════════════════════════════════
// REGALÍA PASCUAL
// ══════════════════════════════════════════

// Regalia public API (called from HTML)
function regaliaOnDrop(e){
  e.preventDefault();
  document.getElementById('regalia-drop').classList.remove('over');
  const f=e.dataTransfer.files[0]; if(f) regaliaLoadFile(f);
}
function regaliaLoadFile(file){
  if(!file) return;
  // Dispatch to the obfuscated processFile via a synthetic file input change
  const dt = new DataTransfer();
  dt.items.add(file);
  const fi = document.getElementById('regalia-fi');
  fi.files = dt.files;
  // Call internal processFile — it reads from the drop event
  // Trigger via FileReader directly
  const reader = new FileReader();
  reader.onload = function(e2){
    try{
      const wb = XLSX.read(new Uint8Array(e2.target.result), {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      if(!rows.length){ regaliaShowError('Archivo vacío.'); return; }
      const keys = Object.keys(rows[0]);
      function fk(opts){ return keys.find(function(k){ return opts.some(function(o){ return k.trim().toUpperCase().includes(o); }); })||null; }
      const kPer = fk(['PERIODO','PERIOD','MES','MONTH']);
      const kSuel = fk(['SUELDO','SALARIO','SALARY']);
      if(!kPer||!kSuel){ regaliaShowError('No se encontraron columnas PERIODO y SUELDO.'); return; }
      const kId=fk(['ID']);
      const kCed=fk(['CEDULA','CÉDULA','CED','DOC']);
      const kNom=fk(['NOMBRE','NAME','EMPLEADO']);
      const kCar=fk(['CARGO','PUESTO']);
      const kDep=fk(['DEPARTAMENTO','DEPTO','AREA','ÁREA']);
      const byEmp={};
      rows.forEach(function(r,i){
        const cedula=kCed?String(r[kCed]||''):'';
        const nombre=kNom?String(r[kNom]||'Empleado '+(i+1)):'Empleado '+(i+1);
        const key=(cedula||nombre).trim();
        if(!byEmp[key]) byEmp[key]={id:kId?String(r[kId]||''):String(i+1),cedula,nombre,cargo:kCar?String(r[kCar]||''):'',depto:kDep?String(r[kDep]||''):'',pagos:[]};
        const per=String(r[kPer]||'').trim();
        const sueldo=parseFloat(r[kSuel])||0;
        if(per&&sueldo) byEmp[key].pagos.push({periodo:per,sueldo});
      });
      const results=Object.values(byEmp).map(function(emp){
        const calc=regaliaCalc(emp);
        return Object.assign({},emp,calc);
      });
      document.getElementById('regalia-error').style.display='none';
      regaliaRenderResults(results);
    }catch(err){ regaliaShowError('Error: '+err.message); }
  };
  reader.readAsArrayBuffer(file);
}

function regaliaCalc(emp){
  // Parse periodo MM-AAAA → sortable key
  function periodoKey(p){
    const pts=String(p).trim().split('-');
    // Supports AAAA-MM (preferred) or MM-AAAA (legacy)
    if(pts.length<2) return 0;
    const a=parseInt(pts[0]), b=parseInt(pts[1]);
    // If first part is 4 digits → AAAA-MM
    if(pts[0].length===4) return a*100+b;
    // else MM-AAAA
    return b*100+a;
  }
  const byPer={};
  emp.pagos.forEach(function(pg){ const k=periodoKey(pg.periodo); byPer[k]=(byPer[k]||0)+pg.sueldo; });
  const sorted=Object.keys(byPer).map(Number).sort(function(a,b){return a-b;});
  if(!sorted.length) return {regalia:0,meses:0,promedio:0,mesData:{},proyectado:false};
  const lastKey=sorted[sorted.length-1];
  const lastAnio=Math.floor(lastKey/100);
  const lastMes=lastKey%100;
  const projected={...byPer};
  let isProj=false;
  if(lastMes>=10){
    isProj=true;
    const lastSueldo=projected[lastKey];
    for(let m=lastMes+1;m<=12;m++){ const k=lastAnio*100+m; if(!projected[k]) projected[k]=lastSueldo; }
  }
  const allKeys=Object.keys(projected).map(Number).sort(function(a,b){return a-b;});
  const total=allKeys.reduce(function(s,k){return s+projected[k];},0);
  const n=allKeys.length;
  const promedio=Math.round((total/n)*100)/100;
  const regalia=Math.round(promedio*(n/12)*100)/100;
  const mesData={};
  for(let m=1;m<=12;m++){ const k=lastAnio*100+m; mesData[m]=projected[k]!==undefined?projected[k]:null; }
  return {regalia,meses:n,promedio,mesData,proyectado:isProj};
}

function regaliaRenderResults(data){
  if(!data.length) return;
  const total=data.reduce(function(s,r){return s+r.regalia;},0);
  document.getElementById('regalia-count').textContent='('+data.length+' empleados)';
  document.getElementById('regalia-stats').innerHTML=
    '<div class="card" style="background:var(--gris);border-radius:7px;padding:12px"><div style="font-size:10px;font-weight:700;color:#646e7e;text-transform:uppercase;margin-bottom:4px">Empleados</div><div style="font-size:15px;font-weight:700;color:var(--azul)">'+data.length+'</div></div>'+
    '<div class="card" style="background:var(--gris);border-radius:7px;padding:12px"><div style="font-size:10px;font-weight:700;color:#646e7e;text-transform:uppercase;margin-bottom:4px">Total Regalía</div><div style="font-size:15px;font-weight:700;color:#1e6b3c">RD$'+total.toLocaleString('es-DO',{minimumFractionDigits:2})+'</div></div>';
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  let html='<table><thead><tr><th>#</th><th>Cédula</th><th>Nombre</th><th>Cargo</th><th>Promedio</th>';
  MESES.forEach(function(m){html+='<th>'+m+'</th>';});
  html+='<th>Meses</th><th style="color:#1e6b3c">Regalía</th></tr></thead><tbody>';
  data.forEach(function(r){
    html+='<tr>';
    html+='<td>'+r.id+'</td><td>'+fmtCed(r.cedula)+'</td>';
    html+='<td><strong>'+r.nombre+'</strong>'+(r.proyectado?' <span style="font-size:9px;background:#fef3c7;color:#92400e;border-radius:3px;padding:1px 5px">Proyectado</span>':'')+'</td>';
    html+='<td>'+r.cargo+'</td>';
    html+='<td>'+r.promedio.toLocaleString('es-DO',{minimumFractionDigits:2})+'</td>';
    for(let m=1;m<=12;m++){
      const v=r.mesData[m];
      html+='<td>'+(v!==null&&v!==undefined?v.toLocaleString('es-DO',{minimumFractionDigits:2}):'—')+'</td>';
    }
    html+='<td>'+r.meses+'</td>';
    html+='<td style="color:#1e6b3c;font-weight:700">'+r.regalia.toLocaleString('es-DO',{minimumFractionDigits:2})+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table>';
  document.getElementById('regalia-table').innerHTML=html;
  document.getElementById('regalia-results').style.display='block';
  document.getElementById('regalia-dl-btn').onclick=function(){ regaliaDescargar(data); };
}

function regaliaShowError(msg){
  const el=document.getElementById('regalia-error');
  el.textContent='Aviso: '+msg; el.style.display='block';
}

function regaliaReset(){
  document.getElementById('regalia-results').style.display='none';
  document.getElementById('regalia-fi').value='';
  document.getElementById('regalia-error').style.display='none';
}

function regaliaDescargar(data){
  const MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const rows=data.map(function(r){
    const row={'ID':r.id,'Cédula':fmtCed(r.cedula),'Nombre':r.nombre,'Cargo':r.cargo,'Departamento':r.depto,'Sueldo Promedio':r.promedio};
    MESES.forEach(function(m,i){ row[m]=r.mesData[i+1]!==null?r.mesData[i+1]:''; });
    row['Meses Pagados']=r.meses;
    row['Monto Regalía']=r.regalia;
    row['Proyectado']=r.proyectado?'Sí':'No';
    return row;
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Regalía');
  XLSX.writeFile(wb,'Regalia_Pascual_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

function regaliaDownloadTemplate(){
  const rows=[
    {ID:1,CEDULA:'001-0000001-1',NOMBRE:'Juan Pérez',CARGO:'Analista',DEPARTAMENTO:'Recursos Humanos',PERIODO:'2026-01',SUELDO:80000},
    {ID:1,CEDULA:'001-0000001-1',NOMBRE:'Juan Pérez',CARGO:'Analista',DEPARTAMENTO:'Recursos Humanos',PERIODO:'2026-02',SUELDO:80000},
    {ID:2,CEDULA:'001-0000002-2',NOMBRE:'María Gómez',CARGO:'Coordinadora',DEPARTAMENTO:'Finanzas',PERIODO:'2026-01',SUELDO:55000},
    {ID:2,CEDULA:'001-0000002-2',NOMBRE:'María Gómez',CARGO:'Coordinadora',DEPARTAMENTO:'Finanzas',PERIODO:'2026-02',SUELDO:60000},
  ];
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:6},{wch:16},{wch:28},{wch:20},{wch:22},{wch:10},{wch:12}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Plantilla');
  XLSX.writeFile(wb,'plantilla-regalia-pascual.xlsx');
}
