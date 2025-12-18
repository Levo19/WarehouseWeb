function separateRequest(payload) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Solicitudes');
    const data = sheet.getDataRange().getValues();

    // Payload: { idSolicitud, cantidad, usuario }
    const idToFind = payload.idSolicitud;
    const qtyToSeparate = parseFloat(payload.cantidad);

    let rowIndex = -1;
    // Find row (assuming ID is in Col F -> index 5)
    // Columns: Code(0), Qty(1), Date(2), User(3), Status(4), ID(5)
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][5]) === String(idToFind)) {
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Solicitud no encontrada' })).setMimeType(ContentService.MimeType.JSON);
    }

    // Real Row Number (1-based)
    const sheetRow = rowIndex + 1;
    const originalQty = parseFloat(data[rowIndex][1]);
    const originalCode = data[rowIndex][0];
    const originalUser = data[rowIndex][3];

    if (qtyToSeparate > originalQty) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Cantidad excede pendiente' })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. CREATE NEW ROW (Separado)
    const newId = Utilities.getUuid().split('-')[0]; // Simple Short ID
    const now = new Date();
    const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    // Code, Qty, Date, User, Status, ID
    sheet.appendRow([originalCode, qtyToSeparate, formattedDate, originalUser, 'separado', newId]);

    // 2. UPDATE ORIGINAL ROW
    const remaining = originalQty - qtyToSeparate;

    if (remaining > 0) {
        // Just reduce quantity, keep as 'solicitado'
        sheet.getRange(sheetRow, 2).setValue(remaining);
    } else {
        // Fully separated -> Mark as 'completado' to hide from pending
        // We do NOT delete it to preserve history as 'solicitado' (but fulfilled)
        // Actually, if we set it to 'atendido' or 'completado', it filters out from Pending view.
        sheet.getRange(sheetRow, 2).setValue(0); // Optional: Set to 0? Or keep original qty?
        // If we keep original qty, "Pending" calculation is hard.
        // User said "desaparecer de pendiente".
        // Setting Qty 0 and Status 'completado' represents it well.
        sheet.getRange(sheetRow, 2).setValue(0);
        sheet.getRange(sheetRow, 5).setValue('completado');
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}

// --- NEW FUNCTION FOR COMPRAS HISTORY ---
function getProviderPurchases(payload) {
    const COMPRAS_ID = '11Ajy-Mq-Zv11FFoYmI74k36nCzM7q0J83hLWD0YmdlI';
    const targetProvider = payload.provider; // sent from frontend

    if (!targetProvider) return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No provider specified' })).setMimeType(ContentService.MimeType.JSON);

    try {
        const ss = SpreadsheetApp.openById(COMPRAS_ID);
        const sheet = ss.getSheetByName('Compras'); // Assuming default tab name, or 'Hoja 1'? Screenshot shows 'Compras' specific? No, screenshot 1 shows 'Tablas' maybe?
        // Screenshot 2 shows 'bdLevoWeb'. Bottom tabs: 'Compras'.
        // Wait, the screenshot shows 'Compras' at the bottom tab.

        let ws = ss.getSheetByName('Compras');
        if (!ws) ws = ss.getSheets()[0]; // Fallback to first sheet

        const data = ws.getDataRange().getValues();
        // Headers: IdCompra(0), Fecha(1), Hora(2), CodigoProducto(3), NombreProducto(4)... CostoUnitario(10), Proveedor(11)

        // Map to store unique products. Key: CodigoProducto
        const productsMap = {};

        // Skip header (row 0)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            const provider = row[11]; // Col L

            if (String(provider).toLowerCase().trim() === String(targetProvider).toLowerCase().trim()) {
                const code = row[3]; // Col D
                if (!productsMap[code]) {
                    productsMap[code] = {
                        codigo: code,
                        nombre: row[4], // Col E
                        costo: row[10], // Col K
                        fecha: row[1]   // Keep date to maybe show "Last Bought"?
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
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}
