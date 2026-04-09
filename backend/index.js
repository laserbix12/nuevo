const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
// CAMBIO 1: Usamos bcryptjs para evitar errores de compilación en Linux/Railway
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// CAMBIO 2: Railway asigna el puerto dinámicamente, aseguramos 0.0.0.0
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const pool = mysql.createPool({
  // CAMBIO 3: Priorizamos MYSQLHOST que es la que Railway inyecta automáticamente
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas', 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const allowedOrigins = [
  'http://localhost:4200',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no autorizado por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Middlewares y rutas se mantienen igual...
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// --- EL RESTO DE TUS FUNCIONES (inicializarBaseDeDatos, firmarToken, etc.) SE MANTIENEN IGUAL ---
// ... (Aquí va todo tu código de rutas y lógica que ya tienes)

async function inicializarBaseDeDatos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      titulo VARCHAR(150) NOT NULL,
      resumen TEXT NOT NULL,
      expira DATE NOT NULL,
      idUsuario INT NOT NULL,
      completada TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [admins] = await pool.query('SELECT COUNT(*) AS total FROM administradores');
  const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
  const forzarAdminDev = process.env.FORCE_DEFAULT_ADMIN !== 'false';

  if (admins[0].total === 0) {
    await pool.query(
      'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
      ['admin', 'Administrador Inicial', passwordHash],
    );
    console.log('Auto-seeding completado: usuario inicial admin / admin123');
    return;
  }
}

// ... (Todas tus rutas /api/auth, /api/tareas, etc. se mantienen)

async function crearBaseDatosIfNotExists() {
  const poolTemporal = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  });

  try {
    const connTemp = await poolTemporal.getConnection();
    const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas';
    await connTemp.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Base de datos "${dbName}" lista`);
    connTemp.release();
    await poolTemporal.end();
  } catch (error) {
    console.error('❌ No se pudo crear la base de datos:', error);
    throw error;
  }
}

async function iniciarServidor() {
  try {
    // Primero crear la BD si no existe
    await crearBaseDatosIfNotExists();

    const connection = await pool.getConnection();
    console.log('✅ Conectado a la base de datos MySQL');
    connection.release();

    await inicializarBaseDeDatos();

    // CAMBIO IMPORTANTE: Escuchar en 0.0.0.0 para que Railway pueda dirigir el tráfico
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor listo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error('❌ No se pudo iniciar el backend:', error);
    process.exit(1);
  }
}

iniciarServidor();