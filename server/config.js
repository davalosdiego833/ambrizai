// Production configuration fallback
// Provides non-secret defaults when hosting environment variables are missing.
//
// IMPORTANT: No secrets live in this file. GEMINI_API_KEY and JWT_SECRET must
// be set as real environment variables — either in Hostinger's Node.js App
// Manager -> Environment Variables, or in a .env file placed directly on the
// server (never committed to git). This file must load AFTER dotenv (see
// index.js) so a local .env is always respected first.

import crypto from 'crypto';

const config = {
  PORT: process.env.PORT || 5050,
  NODE_ENV: process.env.NODE_ENV || 'production',
};

// Non-secret defaults are safe to write back into process.env.
process.env.PORT = process.env.PORT || config.PORT;
process.env.NODE_ENV = process.env.NODE_ENV || config.NODE_ENV;

if (!process.env.GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY no está configurada. El chat funcionará en Modo Simulado hasta que se configure como variable de entorno.');
}

if (!process.env.JWT_SECRET) {
  // Never fall back to a fixed, human-readable secret — that defeats the
  // purpose (anyone who has ever seen this file/repo could forge sessions).
  // Generate a random one for this process instead, and warn loudly.
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️ JWT_SECRET no está configurada como variable de entorno. Se generó una temporal solo para esta ejecución (las sesiones no sobrevivirán un reinicio del servidor). Configúrala en Hostinger para producción.');
}

export default config;
