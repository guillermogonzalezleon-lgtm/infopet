// Infopet — Configuración de entorno y protección de datos
// 7 capas de protección para que nada toque datos reales sin pasar por todas

export function getConfig() {
  const env = process.env.INFOPET_ENV || 'preview';
  const isProd = env === 'production';

  return {
    environment: env,
    isProd,

    // Solo permite escritura si WRITE_MODE=enabled explícitamente
    writeEnabled: process.env.WRITE_MODE === 'enabled',

    // Google Sheets: producción usa el real, preview usa copia de prueba
    sheetsId: isProd
      ? process.env.GOOGLE_SHEETS_ID
      : process.env.GOOGLE_SHEETS_ID_TEST || process.env.GOOGLE_SHEETS_ID,

    // Carpeta Drive: producción usa la real, preview usa carpeta de prueba
    driveFolderId: isProd
      ? process.env.GOOGLE_DRIVE_FOLDER_ID
      : process.env.GOOGLE_DRIVE_FOLDER_ID_TEST || process.env.GOOGLE_DRIVE_FOLDER_ID,
  };
}

// Middleware para bloquear escrituras cuando no está habilitado
export function requireWriteAccess(res) {
  const config = getConfig();

  if (!config.writeEnabled) {
    res.status(403).json({
      error: '🔒 Modo solo lectura activado',
      message: 'Las escrituras están bloqueadas para proteger los datos. Para habilitar, configura WRITE_MODE=enabled en Vercel.',
      environment: config.environment,
      tip: config.isProd
        ? 'Estás en PRODUCCIÓN. Asegúrate de que realmente quieres escribir datos reales.'
        : 'Estás en PREVIEW. Configura WRITE_MODE=enabled y usa datos de prueba.'
    });
    return false;
  }

  return true;
}

// Info del ambiente actual (para mostrar en el frontend)
export function getEnvironmentInfo() {
  const config = getConfig();
  return {
    environment: config.environment,
    writeEnabled: config.writeEnabled,
    isProd: config.isProd,
    banner: config.isProd
      ? null
      : '⚠️ AMBIENTE DE PRUEBA — Los cambios NO afectan datos reales'
  };
}
