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

// PUT /api/auth/profile - Actualizar perfil del administrador
app.put('/api/auth/profile', verificarToken, async (req, res) => {
  try {
    const { nombre, passwordActual, passwordNueva } = req.body;
    
    if (!nombre || !passwordActual) {
      return res.status(400).json({ mensaje: 'Nombre y contraseña actual son requeridos' });
    }

    const [admins] = await pool.query('SELECT * FROM administradores WHERE id = ?', [req.admin.adminId]);
    if (admins.length === 0) {
      return res.status(404).json({ mensaje: 'Administrador no encontrado' });
    }

    const admin = admins[0];
    const passwordValida = await bcrypt.compare(passwordActual, admin.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }

    let query = 'UPDATE administradores SET nombre = ?';
    const values = [nombre];

    if (passwordNueva) {
      const hash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
      query += ', password_hash = ?';
      values.push(hash);
    }

    query += ' WHERE id = ?';
    values.push(req.admin.adminId);

    await pool.query(query, values);

    res.json({
      mensaje: 'Perfil actualizado exitosamente',
      admin: { id: admin.id, username: admin.username, nombre }
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ mensaje: 'Error en el servidor al actualizar perfil' });
  }
});

// POST /api/auth/admins - Crear un nuevo administrador
app.post('/api/auth/admins', verificarToken, async (req, res) => {
  try {
    const { username, nombre, password } = req.body;

    if (!username || !nombre || !password) {
      return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
      [username, nombre, passwordHash]
    );

    res.status(201).json({
      mensaje: 'Administrador creado exitosamente',
      admin: { id: result.insertId, username, nombre }
    });
  } catch (error) {
    console.error('Error al crear administrador:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }
    res.status(500).json({ mensaje: 'Error en el servidor al crear administrador' });
  }
});

// --- ENDPOINT DE SALUD (HEALTH CHECK) ---
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend funcionando correctamente' });
});

// --- RUTAS DE TAREAS ---

// GET /api/tareas - Obtener todas las tareas del admin autenticado
app.get('/api/tareas', verificarToken, async (req, res) => {
  try {
    const { idUsuario } = req.query;

    let query = 'SELECT id, titulo, resumen, expira, idUsuario, completada FROM tareas WHERE idAdmin = ?';
    const values = [req.admin.adminId];

    if (idUsuario) {
      query += ' AND idUsuario = ?';
      values.push(idUsuario);
    }

    query += ' ORDER BY expira ASC';

    const [tareas] = await pool.query(query, values);
    res.json(tareas);
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({ error: 'Error al obtener tareas' });
  }
});

// POST /api/tareas - Crear nueva tarea
app.post('/api/tareas', verificarToken, async (req, res) => {
  try {
    const { id, titulo, resumen, expira, idUsuario } = req.body;
    
    // Validaciones
    if (!id || !titulo || !resumen || !expira) {
      return res.status(400).json({ error: 'Faltan campos requeridos: id, titulo, resumen, expira' });
    }

    // Verificar que la fecha sea válida
    if (isNaN(new Date(expira).getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido (usa YYYY-MM-DD)' });
    }

    await pool.query(
      'INSERT INTO tareas (id, titulo, resumen, expira, idUsuario, idAdmin, completada) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [id, titulo, resumen, expira, idUsuario || 0, req.admin.adminId]
    );

    res.status(201).json({ 
      message: 'Tarea creada exitosamente',
      tarea: { id, titulo, resumen, expira, idUsuario: idUsuario || 0, completada: 0 }
    });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Ya existe una tarea con ese ID' });
    }
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

// PUT /api/tareas/:id - Actualizar tarea
app.put('/api/tareas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, resumen, expira, completada } = req.body;

    // Verificar que la tarea pertenece al admin
    const [tareas] = await pool.query(
      'SELECT id FROM tareas WHERE id = ? AND idAdmin = ?',
      [id, req.admin.adminId]
    );

    if (tareas.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    // Preparar actualización dinámica
    const campos = [];
    const valores = [];
    
    if (titulo !== undefined) {
      campos.push('titulo = ?');
      valores.push(titulo);
    }
    if (resumen !== undefined) {
      campos.push('resumen = ?');
      valores.push(resumen);
    }
    if (expira !== undefined) {
      campos.push('expira = ?');
      valores.push(expira);
    }
    if (completada !== undefined) {
      campos.push('completada = ?');
      valores.push(completada);
    }

    if (campos.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    campos.push('updated_at = CURRENT_TIMESTAMP');
    valores.push(id, req.admin.adminId);

    await pool.query(
      `UPDATE tareas SET ${campos.join(', ')} WHERE id = ? AND idAdmin = ?`,
      valores
    );

    res.json({ message: 'Tarea actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// DELETE /api/tareas/:id - Eliminar tarea
app.delete('/api/tareas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM tareas WHERE id = ? AND idAdmin = ?',
      [id, req.admin.adminId]
    );

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    res.json({ message: 'Tarea eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

// --- RESTO DE FUNCIONES ---

async function inicializarBaseDeDatos() {
  try {
    // Crear tabla administradores
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
    console.log('✅ Tabla administradores creada');

    // SOLUCIÓN: Verificar si la tabla tareas tiene la estructura correcta (columna idAdmin).
    // Si no la tiene (porque se creó con tu script manual), la eliminamos para que el backend la recree bien.
    try {
      await pool.query('SELECT idAdmin FROM tareas LIMIT 1');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ Se detectó la tabla "tareas" incompleta. Recreando estructura correcta...');
        await pool.query('DROP TABLE IF EXISTS tareas');
      }
    }

    // Crear tabla tareas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tareas (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        resumen TEXT NOT NULL,
        expira DATE NOT NULL,
        idUsuario INT NOT NULL,
        idAdmin INT NOT NULL,
        completada TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (idAdmin) REFERENCES administradores(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabla tareas creada');

    // Verificar si existe admin por defecto
    const [admins] = await pool.query('SELECT COUNT(*) AS total FROM administradores');
    
    if (admins[0].total === 0) {
      const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
      await pool.query(
        'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
        ['admin', 'Administrador Inicial', passwordHash],
      );
      console.log('✅ Usuario admin creado: usuario=admin, contraseña=admin123');
    } else {
      console.log(`✅ ${admins[0].total} administrador(es) encontrado(s)`);
    }

  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error.message);
    throw error;
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
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
  });

  try {
    const connTemp = await poolTemporal.getConnection();
    const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas';
    
    await connTemp.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Base de datos "${dbName}" lista`);
    
    connTemp.release();
    await poolTemporal.end();
  } catch (error) {
    console.error('❌ Error creando base de datos:', error.message);
    throw error;
  }
}

async function iniciarServidor() {
  try {
    console.log('🔌 Conectando a base de datos...');
    console.log(`   Host: ${process.env.MYSQLHOST || process.env.DB_HOST || 'localhost'}`);
    console.log(`   Puerto: ${process.env.MYSQLPORT || process.env.DB_PORT || 3306}`);
    console.log(`   Usuario: ${process.env.MYSQLUSER || process.env.DB_USER || 'root'}`);
    console.log(`   Base de datos: ${process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas'}`);
    
    // Primero crear la BD si no existe
    await crearBaseDatosIfNotExists();

    // Probar conexión
    const connection = await pool.getConnection();
    await connection.ping();
    console.log('✅ Conectado a la base de datos MySQL');
    connection.release();

    // Inicializar tablas y datos
    await inicializarBaseDeDatos();

    // Escuchar en 0.0.0.0
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Servidor listo en el puerto ${PORT}`);
      console.log(`📍 http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('\n❌ No se pudo iniciar el backend:');
    console.error(`   ${error.message}\n`);
    console.error('Verifica que:');
    console.error('1. MySQL está corriendo (usar XAMPP, WAMP, o servidor remoto)');
    console.error('2. El usuario "root" existe sin contraseña (o actualiza .env)');
    console.error('3. Las variables en .env son correctas\n');
    process.exit(1);
  }
}

iniciarServidor();