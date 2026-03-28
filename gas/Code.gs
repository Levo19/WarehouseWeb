// ============================================================
// WarehouseWeb — Google Apps Script Backend
// Tablas requeridas en Google Sheets (compartidas con MosExpress):
//   PRODUCTO_BASE, PRESENTACIONES, EQUIVALENCIAS,
//   Usuarios, Guias, GuiaDetalle, Envasados, AjustesProductos
// Columna a agregar en PRODUCTO_BASE: Stock_Almacen
// ============================================================

function doGet(e) {
  var accion = e.parameter.accion;
  if (accion === 'catalogo')   return descargarCatalogo();
  if (accion === 'login')      return verificarLogin(e.parameter.u, e.parameter.c);
  if (accion === 'dashboard')  return obtenerDashboard();
  return resp({ status: 'error', mensaje: 'Accion no valida' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.accion === 'despacho')         return procesarDespacho(data);
    if (data.accion === 'envasado')         return procesarEnvasado(data);
    if (data.accion === 'actualizar_stock') return actualizarStockManual(data);
    if (data.accion === 'imprimir')         return procesarImpresion(data);
    return resp({ status: 'error', mensaje: 'Accion desconocida: ' + data.accion });
  } catch (err) {
    return resp({ status: 'error', mensaje: err.toString() });
  }
}

// ─── CATALOGO ───────────────────────────────────────────────

function descargarCatalogo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nombres = ['PRODUCTO_BASE', 'PRESENTACIONES', 'EQUIVALENCIAS'];
  var catalogo = {};
  nombres.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    catalogo[name] = sh ? getJSON(sh) : [];
  });
  return resp({ status: 'success', data: catalogo });
}

// ─── LOGIN ──────────────────────────────────────────────────

function verificarLogin(u, c) {
  if (!u || !c) return resp({ status: 'error', mensaje: 'Credenciales incompletas' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Usuarios');
  if (!sh) return resp({ status: 'error', mensaje: 'Tabla Usuarios no encontrada' });
  var rows = getJSON(sh);
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (String(row.usuario) === String(u) && String(row.clave) === String(c)) {
      var activo = row.activo;
      if (activo === false || activo === 0 || activo === 'false' || activo === '0')
        return resp({ status: 'error', mensaje: 'Usuario inactivo' });
      return resp({
        status: 'success',
        usuario: {
          usuario: row.usuario,
          nombre: (row.nombres || '') + ' ' + (row.apellido || ''),
          modulos: row.modulos || 'DASHBOARD,DESPACHOS,ENVASADOR,HERRAMIENTAS'
        }
      });
    }
  }
  return resp({ status: 'error', mensaje: 'Usuario o clave incorrectos' });
}

// ─── DESPACHO (SALIDA) ──────────────────────────────────────

function procesarDespacho(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shGuias    = ss.getSheetByName('Guias');
  var shDetalle  = ss.getSheetByName('GuiaDetalle');
  var shProductos = ss.getSheetByName('PRODUCTO_BASE');
  var shPres     = ss.getSheetByName('PRESENTACIONES');

  if (!shGuias || !shDetalle)
    return resp({ status: 'error', mensaje: 'Tablas Guias/GuiaDetalle no encontradas' });

  var fecha   = new Date();
  var idGuia  = 'GS-' + fecha.getTime();

  // Cabecera de guia
  // Columns: idGuia, tipo, fecha, usuario, proveedor, comentario, estado, idPreingreso, foto
  shGuias.appendRow([idGuia, 'SALIDA', fecha, data.usuario || '', '', data.comentario || '', 'COMPLETADO', '', '']);

  // Detalle + actualizar stock
  var presentaciones = shPres ? getJSON(shPres) : [];
  data.items.forEach(function(item, idx) {
    var idDetalle = 'D-' + fecha.getTime() + '-' + idx;
    shDetalle.appendRow([idDetalle, idGuia, item.codBarras, item.cantidad, '']);
    var pres = findFirst(presentaciones, function(p) { return String(p.Cod_Barras) === String(item.codBarras); });
    if (pres && shProductos) {
      var factor = parseFloat(pres.Factor) || 1;
      actualizarStockEnSheet(shProductos, String(pres.SKU_Base), -(item.cantidad * factor));
    }
  });

  return resp({ status: 'success', idGuia: idGuia, mensaje: 'Despacho registrado' });
}

// ─── ENVASADO (INGRESO producto terminado + SALIDA materia prima) ──

function procesarEnvasado(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shGuias    = ss.getSheetByName('Guias');
  var shDetalle  = ss.getSheetByName('GuiaDetalle');
  var shEnvasados = ss.getSheetByName('Envasados');
  var shProductos = ss.getSheetByName('PRODUCTO_BASE');
  var shPres     = ss.getSheetByName('PRESENTACIONES');

  if (!shGuias || !shDetalle)
    return resp({ status: 'error', mensaje: 'Tablas Guias/GuiaDetalle no encontradas' });

  var fecha = new Date();
  var ts    = fecha.getTime();
  var presentaciones = shPres ? getJSON(shPres) : [];

  // — INGRESO: producto terminado —
  var idIngreso = 'GI-' + ts;
  shGuias.appendRow([idIngreso, 'INGRESO', fecha, data.usuario || '', '', 'Envasado', 'COMPLETADO', '', '']);
  shDetalle.appendRow(['D-' + ts + '-pt', idIngreso, data.productoTerminado.codBarras, data.productoTerminado.cantidad, '']);

  var presTerminado = findFirst(presentaciones, function(p) {
    return String(p.Cod_Barras) === String(data.productoTerminado.codBarras);
  });
  if (presTerminado && shProductos) {
    var factorPT = parseFloat(presTerminado.Factor) || 1;
    actualizarStockEnSheet(shProductos, String(presTerminado.SKU_Base), data.productoTerminado.cantidad * factorPT);
  }

  // — SALIDA: materias primas —
  var mps = data.materiasPrimas || [];
  if (mps.length > 0) {
    var idSalida = 'GS-' + (ts + 1);
    shGuias.appendRow([idSalida, 'SALIDA', fecha, data.usuario || '', '', 'Envasado - materia prima', 'COMPLETADO', '', '']);
    mps.forEach(function(mp, idx) {
      shDetalle.appendRow(['D-' + ts + '-mp' + idx, idSalida, mp.codBarras, mp.cantidad, '']);
      var presMp = findFirst(presentaciones, function(p) { return String(p.Cod_Barras) === String(mp.codBarras); });
      if (presMp && shProductos) {
        var factorMp = parseFloat(presMp.Factor) || 1;
        actualizarStockEnSheet(shProductos, String(presMp.SKU_Base), -(mp.cantidad * factorMp));
      }
    });
  }

  // Registro en Envasados
  if (shEnvasados) {
    shEnvasados.appendRow([ts, fecha, data.usuario || '', data.productoTerminado.codBarras,
      data.productoTerminado.cantidad, JSON.stringify(mps)]);
  }

  return resp({ status: 'success', idIngreso: idIngreso, mensaje: 'Envasado registrado' });
}

// ─── ACTUALIZAR STOCK MANUAL ─────────────────────────────────

function actualizarStockManual(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PRODUCTO_BASE');
  if (!sh) return resp({ status: 'error', mensaje: 'PRODUCTO_BASE no encontrada' });
  actualizarStockEnSheet(sh, data.skuBase, data.delta);
  return resp({ status: 'success' });
}

// ─── DASHBOARD ──────────────────────────────────────────────

function obtenerDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PRODUCTO_BASE');
  if (!sh) return resp({ status: 'success', alertas: [] });

  var productos = getJSON(sh);
  var alertas = [];
  productos.forEach(function(p) {
    var stock = p.Stock_Almacen !== undefined && p.Stock_Almacen !== '' ? (parseFloat(p.Stock_Almacen) || 0) : null;
    if (stock !== null && stock <= 10) {
      alertas.push({ sku: p.SKU_Base, nombre: p.Nombre, stock: stock, tipo: stock === 0 ? 'AGOTADO' : 'BAJO' });
    }
  });
  alertas.sort(function(a, b) { return a.stock - b.stock; });
  return resp({ status: 'success', alertas: alertas });
}

// ─── PRINTNODE PROXY ────────────────────────────────────────
// Guardar la clave en Proyecto > Propiedades del script > PRINTNODE_API_KEY

function procesarImpresion(data) {
  var key = PropertiesService.getScriptProperties().getProperty('PRINTNODE_API_KEY');
  if (!key) return resp({ status: 'error', mensaje: 'PRINTNODE_API_KEY no configurada en Propiedades del script' });
  if (!data.printerId || !data.content) return resp({ status: 'error', mensaje: 'Faltan printerId o content' });

  var options = {
    method: 'post',
    headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(key + ':') },
    contentType: 'application/json',
    payload: JSON.stringify({
      printerId: parseInt(data.printerId, 10),
      title: data.title || 'WarehouseWeb',
      contentType: 'raw_base64',
      content: data.content
    }),
    muteHttpExceptions: true
  };

  try {
    var r = UrlFetchApp.fetch('https://api.printnode.com/printjobs', options);
    var code = r.getResponseCode();
    if (code !== 201) return resp({ status: 'error', mensaje: 'PrintNode respondio ' + code + ': ' + r.getContentText() });
    return resp({ status: 'success', printJobId: r.getContentText() });
  } catch(err) {
    return resp({ status: 'error', mensaje: 'Error llamando PrintNode: ' + err.toString() });
  }
}

// ─── HELPERS ────────────────────────────────────────────────

function actualizarStockEnSheet(sh, skuBase, delta) {
  var data    = sh.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h); });
  var skuCol  = headers.indexOf('SKU_Base');
  var stockCol = headers.indexOf('Stock_Almacen');

  // Si la columna no existe, la creamos
  if (stockCol === -1) {
    stockCol = headers.length;
    sh.getRange(1, stockCol + 1).setValue('Stock_Almacen');
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][skuCol]) === skuBase) {
      var current = parseFloat(data[i][stockCol]) || 0;
      var newStock = Math.max(0, current + delta);
      sh.getRange(i + 1, stockCol + 1).setValue(newStock);
      return;
    }
  }
}

function getJSON(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    result.push(row);
  }
  return result;
}

function findFirst(arr, fn) {
  for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) return arr[i]; }
  return null;
}

function resp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
