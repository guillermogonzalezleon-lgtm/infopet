// Infopet — Endpoint de info de ambiente
// El frontend consulta esto para mostrar banner de staging

import { getEnvironmentInfo } from './config.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json(getEnvironmentInfo());
}
