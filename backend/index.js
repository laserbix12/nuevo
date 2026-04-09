const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'tareas_db', // Asegúrate que el nombre coincida
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
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

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

  const [adminDefaultRows] = await pool.query(
    'SELECT id FROM administradores WHERE username = ? LIMIT 1',
    ['admin'],
  );

  if (adminDefaultRows.length === 0) {
    await pool.query(
      'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
      ['admin', 'Administrador Inicial', passwordHash],
    );

    console.log('Se creo el administrador por defecto admin / admin123');
    return;
  }

  if (forzarAdminDev) {
    await pool.query(
      'UPDATE administradores SET nombre = ?, password_hash = ? WHERE username = ?',
      ['Administrador Inicial', passwordHash, 'admin'],
    );

    console.log('Administrador por defecto sincronizado: admin / admin123');
  }
}

function firmarToken(admin) {
  return jwt.sign(
    {
      sub: admin.id,
      username: admin.username,
      nombre: admin.nombre,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

function extraerAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    nombre: admin.nombre,
  };
}

function autenticarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ mensaje: 'Token requerido.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_error) {
    res.status(401).json({ mensaje: 'Token invalido o expirado.' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, fecha: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ mensaje: 'Username y password son obligatorios.' });
    return;
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, nombre, password_hash FROM administradores WHERE username = ? LIMIT 1',
      [username],
    );

    const admin = rows[0];
    if (!admin) {
      res.status(401).json({ mensaje: 'Credenciales invalidas.' });
      return;
    }

    const passwordValida = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValida) {
      res.status(401).json({ mensaje: 'Credenciales invalidas.' });
      return;
    }

    res.json({
      token: firmarToken(admin),
      admin: extraerAdmin(admin),
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'No se pudo iniciar sesion.' });
  }
});

app.get('/api/auth/me', autenticarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, nombre FROM administradores WHERE id = ? LIMIT 1',
      [req.admin.sub],
    );

    const admin = rows[0];
    if (!admin) {
      res.status(404).json({ mensaje: 'Administrador no encontrado.' });
      return;
    }

    res.json({ admin });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ mensaje: 'No se pudo cargar el perfil.' });
  }
});

app.post('/api/auth/admins', autenticarToken, async (req, res) => {
  const { username, password, nombre } = req.body;
  if (!username || !password || !nombre) {
    res.status(400).json({ mensaje: 'Nombre, username y password son obligatorios.' });
    return;
  }

  try {
    const [duplicados] = await pool.query(
      'SELECT id FROM administradores WHERE username = ? LIMIT 1',
      [username],
    );

    if (duplicados.length > 0) {
      res.status(409).json({ mensaje: 'Ese username ya existe.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
      [username.trim(), nombre.trim(), passwordHash],
    );

    res.status(201).json({ mensaje: 'Administrador creado correctamente.' });
  } catch (error) {
    console.error('Error creando administrador:', error);
    res.status(500).json({ mensaje: 'No se pudo crear el administrador.' });
  }
});

app.put('/api/auth/profile', autenticarToken, async (req, res) => {
  const { nombre, passwordActual, passwordNueva } = req.body;
  if (!nombre || !passwordActual) {
    res.status(400).json({ mensaje: 'Nombre y passwordActual son obligatorios.' });
    return;
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, nombre, password_hash FROM administradores WHERE id = ? LIMIT 1',
      [req.admin.sub],
    );

    const admin = rows[0];
    if (!admin) {
      res.status(404).json({ mensaje: 'Administrador no encontrado.' });
      return;
    }

    const passwordValida = await bcrypt.compare(passwordActual, admin.password_hash);
    if (!passwordValida) {
      res.status(401).json({ mensaje: 'La contrasena actual no coincide.' });
      return;
    }

    const nuevoHash = passwordNueva
      ? await bcrypt.hash(passwordNueva, SALT_ROUNDS)
      : admin.password_hash;

    await pool.query(
      'UPDATE administradores SET nombre = ?, password_hash = ? WHERE id = ?',
      [nombre.trim(), nuevoHash, admin.id],
    );

    res.json({
      mensaje: 'Perfil actualizado correctamente.',
      admin: {
        id: admin.id,
        username: admin.username,
        nombre: nombre.trim(),
      },
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ mensaje: 'No se pudo actualizar el perfil.' });
  }
});

app.get('/api/tareas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, titulo, resumen, expira, idUsuario, completada
      FROM tareas
      ORDER BY completada ASC, expira ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error GET /api/tareas:', error);
    res.status(500).json({ mensaje: 'Error consultando las tareas.' });
  }
});

app.get('/api/tareas/usuario/:idUsuario', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT id, titulo, resumen, expira, idUsuario, completada
        FROM tareas
        WHERE idUsuario = ?
        ORDER BY completada ASC, expira ASC
      `,
      [req.params.idUsuario],
    );

    res.json(rows);
  } catch (error) {
    console.error('Error GET /api/tareas/usuario/:idUsuario:', error);
    res.status(500).json({ mensaje: 'Error consultando las tareas del usuario.' });
  }
});

app.post('/api/tareas', autenticarToken, async (req, res) => {
  const { titulo, resumen, expira, idUsuario } = req.body;
  if (!titulo || !resumen || !expira || !idUsuario) {
    res.status(400).json({ mensaje: 'Faltan datos obligatorios para crear la tarea.' });
    return;
  }

  try {
    await pool.query(
      `
        INSERT INTO tareas (id, titulo, resumen, expira, idUsuario, completada)
        VALUES (UUID(), ?, ?, ?, ?, 0)
      `,
      [titulo.trim(), resumen.trim(), expira, Number(idUsuario)],
    );

    res.status(201).json({ mensaje: 'Tarea creada correctamente.' });
  } catch (error) {
    console.error('Error POST /api/tareas:', error);
    res.status(500).json({ mensaje: 'No se pudo crear la tarea.' });
  }
});

app.put('/api/tareas/:id', autenticarToken, async (req, res) => {
  const { titulo, resumen, expira } = req.body;
  if (!titulo || !resumen || !expira) {
    res.status(400).json({ mensaje: 'Faltan datos obligatorios para actualizar la tarea.' });
    return;
  }

  try {
    const [result] = await pool.query(
      'UPDATE tareas SET titulo = ?, resumen = ?, expira = ? WHERE id = ?',
      [titulo.trim(), resumen.trim(), expira, req.params.id],
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ mensaje: 'La tarea no existe.' });
      return;
    }

    res.json({ mensaje: 'Tarea actualizada correctamente.' });
  } catch (error) {
    console.error('Error PUT /api/tareas/:id:', error);
    res.status(500).json({ mensaje: 'No se pudo actualizar la tarea.' });
  }
});

app.patch('/api/tareas/:id/completar', autenticarToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE tareas SET completada = 1 WHERE id = ?',
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ mensaje: 'La tarea no existe.' });
      return;
    }

    res.json({ mensaje: 'Tarea completada correctamente.' });
  } catch (error) {
    console.error('Error PATCH /api/tareas/:id/completar:', error);
    res.status(500).json({ mensaje: 'No se pudo completar la tarea.' });
  }
});

app.delete('/api/tareas/:id', autenticarToken, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tareas WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      res.status(404).json({ mensaje: 'La tarea no existe.' });
      return;
    }

    res.json({ mensaje: 'Tarea eliminada correctamente.' });
  } catch (error) {
    console.error('Error DELETE /api/tareas/:id:', error);
    res.status(500).json({ mensaje: 'No se pudo eliminar la tarea.' });
  }
});

async function iniciarServidor() {
  try {
    const connection = await pool.getConnection();
    console.log('Conectado a la base de datos MySQL');
    connection.release();

    await inicializarBaseDeDatos();

    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el backend:', error);
    process.exit(1);
  }
}

iniciarServidor();
