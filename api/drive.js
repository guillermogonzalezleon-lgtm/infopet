// Infopet — Subir archivos a Google Drive

import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido, usa POST' });
  }

  const { file, filename, mimeType } = req.body || {};

  if (!file || !filename) {
    return res.status(400).json({ error: 'Faltan campos requeridos: file (base64) y filename' });
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!saJson) {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON no configurado en el servidor' });
  }
  if (!folderId) {
    return res.status(500).json({ error: 'GOOGLE_DRIVE_FOLDER_ID no configurado en el servidor' });
  }

  try {
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    const buffer = Buffer.from(file, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId]
      },
      media: {
        mimeType: mimeType || 'image/jpeg',
        body: stream
      },
      fields: 'id, webViewLink'
    });

    return res.status(200).json({
      success: true,
      id: response.data.id,
      webViewLink: response.data.webViewLink
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error subiendo a Google Drive: ' + err.message });
  }
}
