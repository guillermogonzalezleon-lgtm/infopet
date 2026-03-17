// Infopet — Configuración de entorno y protección de datos
// WRITE_MODE controla si las APIs pueden modificar datos reales

export function getConfig() {
  return {
    // "production" = datos reales | "preview" = solo lectura + datos de prueba
    environment: process.env.INFOPET_ENV || 'preview',

    // Solo permite escritura si WRITE_MODE=enabled explícitamente
    writeEnabled: process.env.WRITE_MODE === 'enabled',

    // Google Sheets de prueba (copia de la Carga Maestra)
    sheetsId: process.env.INFOPET_ENV === 'production'
      ? process.env.GOOGLE_SHEETS_ID
      : process.env.GOOGLE_SHEETS_ID_TEST || process.env.GOOGLE_SHEETS_ID,

    // Carpeta Drive de prueba
    driveFolderId: process.env.INFOPET_ENV === 'production'
      ? process.env.GOOGLE_DRIVE_FOLDER_ID
      : process.env.GOOGLE_DRIVE_FOLDER_ID_TEST || process.env.GOOGLE_DRIVE_FOLDER_ID,
  };
}

// Middleware para bloquear escrituras en modo preview
export function requireWriteAccess(res) {
  const config = getConfig();
  if (!config.writeEnabled) {
    res.status(403).json({
      error: 'Modo solo lectura activado',
      message: 'Las escrituras están bloqueadas. Para habilitar, configura WRITE_MODE=enabled en las variables de entorno.',
      environment: config.environment
    });
    return false;
  }
  return true;
}
