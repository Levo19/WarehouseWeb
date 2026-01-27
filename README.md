# WarehouseWeb
# Warehouse ERP

Sistema de gestión de almacenes (ERP) basado en web con backend en Google Apps Script.

## Requisitos Previos

- **Cuenta de Google**: Para alojar el backend y la base de datos (Google Sheets).
- **Google Sheets**:
    1.  Crea un nuevo Google Sheet.
    2.  Renómbralo a "Warehouse ERP Database" (o similar).
    3.  Asegúrate de crear las siguientes pestañas:
        -   `Usuarios`: Columnas [Username, Password, Name, Role, Modules]
        -   `Productos`: Columnas [Codigo, Descripcion, Unidad, Stock, Imagen, Min, StockInicial, FactorZona]
        -   `Solicitudes`: (Para el módulo de despachos)
        -   `Guias`: (Historial de movimientos)
        -   `GuiaDetalle`: (Detalle de productos por guía)
        -   `Preingresos`: (Recepción de mercadería)
        -   `Proveedores`: (Lista de proveedores)

## Instalación del Backend (Google Apps Script)

1.  Abre tu Google Sheet.
2.  Ve a **Extensiones > Apps Script**.
3.  Copia el contenido de `code.gs` en el editor.
4.  **IMPORTANTE**: Busca la variable `EXTERNAL_SHEET_ID_SOLICITUDES` al inicio del archivo y reemplaza su valor con el ID de tu hoja de cálculo (encuéntralo en la URL: `.../d/TU_ID_AQUI/edit...`).
5.  Ve a **Implantar > Nueva implantación**.
    -   Tipo: **Aplicación web**.
    -   Ejecutar como: **Yo**.
    -   Quién tiene acceso: **Cualquier usuario**.
6.  Copia la **URL de la aplicación web** generada.

## Configuración del Frontend

1.  Abre `app.js`.
2.  Busca la constante `LEVO_API_URL` (Línea 6 aprox).
3.  Reemplaza su valor con la URL que copiaste en el paso anterior.
4.  Guarda los cambios.

## Seguridad

-   El sistema valida usuarios contra la hoja `Usuarios`.
-   **Asegúrate de crear al menos un usuario** manualmente en la hoja `Usuarios` antes de intentar iniciar sesión.
    -   Ejemplo: `admin` | `password123` | `Admin` | `Master` | `all`

## Uso

Abre `index.html` en tu navegador para iniciar la aplicación.
