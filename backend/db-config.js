const path = require('path');
const fs = require('fs');
const tls = require('tls');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function envFirst(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

function parseBoolean(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseMysqlUrl(connectionString) {
  if (!connectionString) {
    return {};
  }

  try {
    const url = new URL(connectionString);
    const database = url.pathname ? url.pathname.replace(/^\/+/, '') : undefined;

    return {
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      database: database || undefined,
    };
  } catch (_error) {
    return {};
  }
}

/**
 * Construye la configuración SSL para mysql2.
 *
 * Orden de prioridad:
 *   1. DB_SSL_CA  → ruta a un archivo .pem local (para desarrollo)
 *   2. DB_SSL     → "true" usa el bundle de CAs del sistema (TiDB Cloud, PlanetScale, etc.)
 *   3. Host que contenga "tidbcloud" o "planetscale" → SSL automático
 */
function buildSslConfig(host) {
  const caPath = envFirst('DB_SSL_CA');
  if (caPath) {
    const resolvedPath = path.resolve(caPath);
    if (fs.existsSync(resolvedPath)) {
      console.log(`🔒 SSL: usando CA personalizado → ${resolvedPath}`);
      return { ca: fs.readFileSync(resolvedPath) };
    }
    console.warn(`⚠️  DB_SSL_CA apunta a ${resolvedPath}, pero el archivo no existe. Usando CA del sistema.`);
  }

  const sslFlag = parseBoolean(envFirst('DB_SSL'));
  const requiresSsl = sslFlag ?? /tidbcloud|planetscale|aiven|digitalocean/i.test(host || '');

  if (requiresSsl) {
    console.log('🔒 SSL: usando certificados del sistema operativo');
    return {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    };
  }

  return undefined;
}

function buildDbConfig() {
  const urlConfig = parseMysqlUrl(envFirst('MYSQL_URL', 'DATABASE_URL'));

  const host = urlConfig.host || envFirst('MYSQL_HOST', 'MYSQLHOST', 'DB_HOST') || 'localhost';
  const database = urlConfig.database || envFirst('MYSQL_DATABASE', 'MYSQLDATABASE', 'DB_NAME') || 'tareas';
  const autoCreateFromEnv = parseBoolean(envFirst('DB_AUTO_CREATE'));
  const shouldAutoCreateDatabase = autoCreateFromEnv ?? ['localhost', '127.0.0.1'].includes(host);

  return {
    host,
    port: urlConfig.port || Number(envFirst('MYSQL_PORT', 'MYSQLPORT', 'DB_PORT') || 3306),
    user: urlConfig.user || envFirst('MYSQL_USER', 'MYSQLUSER', 'DB_USER') || 'root',
    password: urlConfig.password !== undefined ? urlConfig.password : (envFirst('MYSQL_PASSWORD', 'MYSQLPASSWORD', 'DB_PASSWORD') || ''),
    database,
    shouldAutoCreateDatabase,
    ssl: buildSslConfig(host),
  };
}

module.exports = {
  buildDbConfig,
  envFirst,
};
