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
  'https://nuevo-zeta-navy.vercel.app',
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

// --- RUTAS DE AUTENTICACIÓN ---
function firmarToken(adminId, username) {
  return jwt.sign({ adminId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const [admins] = await pool.query('SELECT * FROM administradores WHERE username = ?', [username]);
    if (admins.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const admin = admins[0];
    const passwordValida = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = firmarToken(admin.id, admin.username);
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nombre: admin.nombre,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', verificarToken, async (req, res) => {
  try {
    const [admins] = await pool.query('SELECT id, username, nombre FROM administradores WHERE id = ?', [
      req.admin.adminId,
    ]);
    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin no encontrado' });
    }
    res.json({ admin: admins[0] });
  } catch (error) {
    console.error('Error en obtener perfil:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// --- ENDPOINT DE SALUD (HEALTH CHECK) ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend funcionando correctamente' });
});

// --- EL RESTO DE TUS FUNCIONES (inicializarBaseDeDatos, etc.) SE MANTIENEN IGUAL ---

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