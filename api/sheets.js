// Infopet — Append a Google Sheets (Carga Maestra)

import { google } from 'googleapis';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo se permite el método POST' });
  }

  const { values } = req.body || {};

  if (!values || !Array.isArray(values)) {
    return res.status(400).json({ error: 'Se requiere un array "values" en el body' });
  }

  // Columnas esperadas: Clasificación, Tipo, Nombre, Variante, Marca,
  // Permite Decimal, Código Barra, SKU, Precio Costo, Precio Venta

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!credentialsJson || !sheetId) {
    return res.status(500).json({ error: 'Credenciales de Google Sheets no configuradas en el servidor' });
  }

  try {
    const credentials = JSON.parse(credentialsJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Hoja1!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [values]
      }
    });

    return res.status(200).json({
      success: true,
      updatedRange: result.data.updates?.updatedRange || null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error escribiendo en Google Sheets: ' + err.message });
  }
}
