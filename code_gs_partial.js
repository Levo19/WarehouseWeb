/**
 * =========================================================================
 *  GUÍA DE ACTUALIZACIÓN DEL BACKEND (Google Apps Script - Code.gs)
 * =========================================================================
 * 
 * Para que la integración funcione, debes realizar 2 cambios manuales en tu
 * archivo "Código.gs" en el editor de Apps Script.
 * 
 * -------------------------------------------------------------------------
 * PASO 1: Actualizar la función doPost(e)
 * -------------------------------------------------------------------------
 * Busca la función doPost(e) y agrega el caso 'getProviderPurchases' dentro
 * del bloque switch(action). Debería quedar así:
 * 
 * function doPost(e) {
 *   // ... código existente ...
 *   switch (action) {
 *     case 'login':
 *        // ...
 *        break;
 *     
 *     // --- AGREGAR ESTE CASO ---
 *     case 'getProviderPurchases':
 *        result = getProviderPurchases(data.payload);
 *        break;
 *     // -------------------------
 *     
 *     case 'getDispatchRequests':
 *        // ...
 *   }
 *   // ...
 * }
 * 
 * -------------------------------------------------------------------------
 * PASO 2: Agregar la Nueva Función
 * -------------------------------------------------------------------------
 * Copia y pega la siguiente función AL FINAL de tu archivo Code.gs.
 * Esta función se conecta al libro externo de Compras.
 */

function getProviderPurchases(payload) {
    // ID del Libro de Compras (Extraído de tu captura)
    const COMPRAS_ID = '11Ajy-Mq-Zv11FFoYmI74k36nCzM7q0J83hLWD0YmdlI';
    const targetProvider = payload.provider;

    if (!targetProvider) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No provider specified' })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
        // Abre el libro externo
        const ss = SpreadsheetApp.openById(COMPRAS_ID);

        // Busca la hoja 'Compras' (o usa la primera si no existe)
        let ws = ss.getSheetByName('Compras');
        if (!ws) ws = ss.getSheets()[0];

        const data = ws.getDataRange().getValues();
        // Headers esperados: 
        // Col D (Index 3) = CodigoProducto
        // Col E (Index 4) = NombreProducto
        // Col K (Index 10) = CostoUnitario
        // Col L (Index 11) = Proveedor

        const productsMap = {};

        // Empezar en fila 1 para saltar encabezados
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const provider = row[11]; // Columna L (Proveedor)

            // Comparación flexible de texto
            if (String(provider).toLowerCase().trim() === String(targetProvider).toLowerCase().trim()) {
                const code = row[3]; // Columna D (Código)

                // Guardar solo el último registro (o el primero encontrado) para evitar duplicados
                // Si quieres el precio más reciente, asumiendo orden cronológico, esto se sobrescribe
                // Para asegurar únicos:
                if (!productsMap[code]) {
                    productsMap[code] = {
                        codigo: code,
                        nombre: row[4], // Col E
                        costo: row[10], // Col K
                        fecha: row[1]   // Col B (Fecha)
                    };
                }
            }
        }

        const productList = Object.values(productsMap);

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            data: productList
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Error Backend: ' + e.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * PASO 3: Agregar la función getPackingList
 * -------------------------------------------------------------------------
 * Copia y pega esta función AL FINAL de tu archivo Code.gs.
 * Esta función obtiene la lista de productos de envasado.
 */
function getPackingList() {
    // URL del Libro de "Compras" (que contiene ListaEnvasados)
    const COMPRAS_URL = 'https://docs.google.com/spreadsheets/d/1IAjy-Mg-Zv11FFoYml74k36nCzM7q0J83hLWD0YmdiI/edit';

    try {
        const ss = SpreadsheetApp.openByUrl(COMPRAS_URL);
        let ws = ss.getSheetByName('ListaEnvasados');

        // Si no existe, intentar buscar algo parecido o fallar
        if (!ws) {
            // Fallback: search loosely
            const sheets = ss.getSheets();
            ws = sheets.find(s => s.getName().toLowerCase().includes('envasad'));
        }

        if (!ws) {
            return { status: 'error', message: "Hoja 'ListaEnvasados' no encontrada." };
        }

        const data = ws.getDataRange().getValues();
        // Headers (Row 1 is index 0). Data starts at index 1.
        // A=Codigo (0), B=Origen (1), C=Factor (2), D=Cantidad (3), E=Prefijo (4), 
        // F=NombreCompleto (5), G=Presentacion (6), H=Empaque (7), I=Tipo (8)

        if (data.length < 2) return { status: 'success', data: [] };

        const packingList = [];

        // Empezar en fila 1 (index 1) para saltar encabezados
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const code = String(row[0]).trim();
            const name = String(row[5]).trim(); // NombreCompleto

            if (!code || !name) continue;

            packingList.push({
                codigo: code,
                origen: row[1],
                factor: row[2],
                cantidad: row[3],
                prefijo: row[4],
                nombre: name,
                presentacion: row[6],
                empaque: row[7],
                tipo: row[8]
            });
        }

        return { status: 'success', data: packingList };

    } catch (e) {
        return { status: 'error', message: "Error leyendo ListaEnvasados: " + e.toString() };
    }
}
