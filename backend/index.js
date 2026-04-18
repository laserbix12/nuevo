const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

const DB_HOST = process.env.MYSQL_HOST || process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.MYSQL_PORT || process.env.MYSQLPORT || process.env.DB_PORT || 3306);
const DB_USER = process.env.MYSQL_USER || process.env.MYSQLUSER || process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
const DATABASE = process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas';

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DATABASE,
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
app.use('/api/avatars', express.static(path.join(__dirname, 'public', 'avatars')));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

function firmarToken(adminId, username) {
  return jwt.sign({ adminId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ mensaje: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
}

function urlAvatar(req, avatarFileName) {
  return `${req.protocol}://${req.get('host')}/api/avatars/${avatarFileName}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'Backend funcionando correctamente' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseña requeridos' });
    }

    const [admins] = await pool.query('SELECT * FROM administradores WHERE username = ?', [username]);
    if (admins.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
    }

    const admin = admins[0];
    const passwordValida = await bcrypt.compare(password, admin.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
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
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

app.get('/api/auth/me', verificarToken, async (req, res) => {
  try {
    const [admins] = await pool.query('SELECT id, username, nombre FROM administradores WHERE id = ?', [
      req.admin.adminId,
    ]);
    if (admins.length === 0) {
      return res.status(404).json({ mensaje: 'Admin no encontrado' });
    }
    res.json({ admin: admins[0] });
  } catch (error) {
    console.error('Error en obtener perfil:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

app.put('/api/auth/profile', verificarToken, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ mensaje: 'Nombre y contraseña actual son requeridos' });
    }

    const [admins] = await pool.query('SELECT * FROM administradores WHERE id = ?', [req.admin.adminId]);
    if (admins.length === 0) {
      return res.status(404).json({ mensaje: 'Administrador no encontrado' });
    }

    const admin = admins[0];
    const usernameNormalizado = username.trim();

    const [duplicados] = await pool.query(
      'SELECT id FROM administradores WHERE username = ? AND id <> ?',
      [usernameNormalizado, req.admin.adminId],
    );
    if (duplicados.length > 0) {
      return res.status(400).json({ mensaje: 'El nombre de usuario ya estÃ¡ en uso' });
    }
    if (false) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }

    let query = 'UPDATE administradores SET username = ?';
    const values = [usernameNormalizado];

    if (password && password.trim()) {
      const hash = await bcrypt.hash(password.trim(), SALT_ROUNDS);
      query += ', password_hash = ?';
      values.push(hash);
    }

    query += ' WHERE id = ?';
    values.push(req.admin.adminId);

    await pool.query(query, values);
    res.json({
      mensaje: 'Perfil actualizado exitosamente',
      admin: { id: admin.id, username: usernameNormalizado, nombre: admin.nombre },
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ mensaje: 'Error en el servidor al actualizar perfil' });
  }
});

app.post('/api/auth/admins', verificarToken, async (req, res) => {
  try {
    const { username, nombre, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseÃ±a son requeridos' });
    }

    const nombreNormalizado = nombre?.trim() || username.trim();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.query(
      'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
      [username.trim(), nombreNormalizado, passwordHash],
    );

    res.status(201).json({
      mensaje: 'Administrador creado exitosamente',
      admin: { id: result.insertId, username: username.trim(), nombre: nombreNormalizado },
    });
  } catch (error) {
    console.error('Error al crear administrador:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensaje: 'El nombre de usuario ya está en uso' });
    }
    res.status(500).json({ mensaje: 'Error en el servidor al crear administrador' });
  }
});

app.get('/api/usuarios', async (req, res) => {
  try {
    const [usuarios] = await pool.query('SELECT id, nombre, avatar FROM usuarios ORDER BY nombre ASC');
    const lista = usuarios.map((usuario) => ({
      id: usuario.id,
      nombre: usuario.nombre,
      avatar: usuario.avatar,
      foto: urlAvatar(req, usuario.avatar),
    }));
    res.json(lista);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
});

app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'avatars') {
      const archivos = await fs.promises.readdir(path.join(__dirname, 'public', 'avatars'));
      const lista = archivos
        .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()))
        .map((avatar) => ({ id: avatar, url: urlAvatar(req, avatar) }));
      return res.json(lista);
    }

    const [usuarios] = await pool.query('SELECT id, nombre, avatar FROM usuarios WHERE id = ?', [id]);
    if (usuarios.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      avatar: usuario.avatar,
      foto: urlAvatar(req, usuario.avatar),
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ mensaje: 'Error al obtener usuario' });
  }
});

app.get('/api/usuarios/avatars', async (req, res) => {
  try {
    const archivos = await fs.promises.readdir(path.join(__dirname, 'public', 'avatars'));
    const lista = archivos
      .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()))
      .map((avatar) => ({ id: avatar, url: urlAvatar(req, avatar) }));
    res.json(lista);
  } catch (error) {
    console.error('Error al listar avatares:', error);
    res.status(500).json({ mensaje: 'Error al obtener catálogo de avatares' });
  }
});

app.post('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const { nombre, avatar } = req.body;
    if (!nombre || !avatar) {
      return res.status(400).json({ mensaje: 'Nombre y avatar son requeridos' });
    }

    const rutaAvatar = path.join(__dirname, 'public', 'avatars', avatar);
    if (!fs.existsSync(rutaAvatar)) {
      return res.status(400).json({ mensaje: 'Avatar inválido' });
    }

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, avatar) VALUES (?, ?)',
      [nombre.trim(), avatar],
    );

    res.status(201).json({
      id: resultado.insertId,
      nombre: nombre.trim(),
      avatar,
      foto: urlAvatar(req, avatar),
      mensaje: 'Usuario creado exitosamente',
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ mensaje: 'Error al crear usuario' });
  }
});

app.put('/api/usuarios/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, avatar } = req.body;
    if (!nombre || !avatar) {
      return res.status(400).json({ mensaje: 'Nombre y avatar son requeridos' });
    }

    const rutaAvatar = path.join(__dirname, 'public', 'avatars', avatar);
    if (!fs.existsSync(rutaAvatar)) {
      return res.status(400).json({ mensaje: 'Avatar inválido' });
    }

    const [resultado] = await pool.query('UPDATE usuarios SET nombre = ?, avatar = ? WHERE id = ?', [
      nombre.trim(),
      avatar,
      id,
    ]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({
      id: Number(id),
      nombre: nombre.trim(),
      avatar,
      foto: urlAvatar(req, avatar),
      mensaje: 'Usuario actualizado correctamente',
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ mensaje: 'Error al actualizar usuario' });
  }
});

app.delete('/api/usuarios/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario y sus tareas eliminados correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar usuario' });
  }
});

app.get('/api/tareas', async (req, res) => {
  try {
    const { idUsuario } = req.query;
    if (!idUsuario) {
      return res.status(400).json({ mensaje: 'Se requiere idUsuario para listar tareas' });
    }

    const [tareas] = await pool.query(
      'SELECT id, titulo, resumen, expira, idUsuario, completada FROM tareas WHERE idUsuario = ? ORDER BY expira ASC',
      [Number(idUsuario)],
    );

    res.json(tareas);
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({ mensaje: 'Error al obtener tareas' });
  }
});

app.post('/api/tareas', verificarToken, async (req, res) => {
  try {
    const { id, titulo, resumen, expira, idUsuario } = req.body;
    if (!id || !titulo || !resumen || !expira || !idUsuario) {
      return res.status(400).json({ mensaje: 'Faltan campos requeridos: id, titulo, resumen, expira, idUsuario' });
    }

    const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [idUsuario]);
    if (usuarios.length === 0) {
      return res.status(400).json({ mensaje: 'El usuario asociado no existe' });
    }

    if (isNaN(new Date(expira).getTime())) {
      return res.status(400).json({ mensaje: 'Formato de fecha inválido (usa YYYY-MM-DD)' });
    }

    await pool.query(
      'INSERT INTO tareas (id, titulo, resumen, expira, idUsuario, idAdmin, completada) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [id, titulo.trim(), resumen.trim(), expira, idUsuario, req.admin.adminId],
    );

    res.status(201).json({
      mensaje: 'Tarea creada exitosamente',
      tarea: { id, titulo: titulo.trim(), resumen: resumen.trim(), expira, idUsuario, completada: 0 },
    });
  } catch (error) {
    console.error('Error al crear tarea:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensaje: 'Ya existe una tarea con ese ID' });
    }
    res.status(500).json({ mensaje: 'Error al crear tarea' });
  }
});

app.put('/api/tareas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, resumen, expira, completada, idUsuario } = req.body;

    const [tareas] = await pool.query('SELECT id FROM tareas WHERE id = ? AND idAdmin = ?', [id, req.admin.adminId]);
    if (tareas.length === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada' });
    }

    const campos = [];
    const valores = [];

    if (titulo !== undefined) {
      campos.push('titulo = ?');
      valores.push(titulo.trim());
    }
    if (resumen !== undefined) {
      campos.push('resumen = ?');
      valores.push(resumen.trim());
    }
    if (expira !== undefined) {
      if (isNaN(new Date(expira).getTime())) {
        return res.status(400).json({ mensaje: 'Formato de fecha inválido' });
      }
      campos.push('expira = ?');
      valores.push(expira);
    }
    if (completada !== undefined) {
      campos.push('completada = ?');
      valores.push(completada ? 1 : 0);
    }
    if (idUsuario !== undefined) {
      const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE id = ?', [idUsuario]);
      if (usuarios.length === 0) {
        return res.status(400).json({ mensaje: 'El usuario asociado no existe' });
      }
      campos.push('idUsuario = ?');
      valores.push(idUsuario);
    }

    if (campos.length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    campos.push('updated_at = CURRENT_TIMESTAMP');
    valores.push(id, req.admin.adminId);

    await pool.query(`UPDATE tareas SET ${campos.join(', ')} WHERE id = ? AND idAdmin = ?`, valores);
    res.json({ mensaje: 'Tarea actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({ mensaje: 'Error al actualizar tarea' });
  }
});

app.delete('/api/tareas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM tareas WHERE id = ? AND idAdmin = ?', [id, req.admin.adminId]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Tarea no encontrada' });
    }
    res.json({ mensaje: 'Tarea eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({ mensaje: 'Error al eliminar tarea' });
  }
});

async function crearBaseDeDatosIfNotExists() {
  // Solo intentar crear la base de datos en entornos que no sean de producción.
  if (process.env.NODE_ENV === 'production' || DB_HOST.includes('railway.internal')) {
    console.log('⚠️ Se omite CREATE DATABASE en entorno de producción/administrado.');
    return;
  }

  const poolTemporal = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  });

  try {
    const connTemp = await poolTemporal.getConnection();
    await connTemp.query(`CREATE DATABASE IF NOT EXISTS \`${DATABASE}\``);
    connTemp.release();
    await poolTemporal.end();
  } catch (error) {
    console.error('❌ Error creando base de datos:', error.message);
    throw error;
  }
}

async function inicializarBaseDeDatos() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS administradores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        avatar VARCHAR(120) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    try {
      await pool.query('SELECT idUsuario FROM tareas LIMIT 1');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ Se detectó la tabla tareas con estructura antigua. Recreando la tabla.');
        await pool.query('DROP TABLE IF EXISTS tareas');
      }
    }

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
        FOREIGN KEY (idUsuario) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (idAdmin) REFERENCES administradores(id) ON DELETE CASCADE,
        INDEX idx_tareas_usuario(idUsuario),
        INDEX idx_tareas_admin(idAdmin)
      ) ENGINE=InnoDB
    `);

    const [admins] = await pool.query('SELECT COUNT(*) AS total FROM administradores');
    if (admins[0].total === 0) {
      const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);
      await pool.query(
        'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
        ['admin', 'Administrador Inicial', passwordHash],
      );
      console.log('✅ Usuario admin creado: usuario=admin, contraseña=admin123');
    }

    const [usuarios] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    if (usuarios[0].total === 0) {
      await pool.query(
        'INSERT INTO usuarios (nombre, avatar) VALUES (?, ?), (?, ?), (?, ?)',
        [
          'Michaell Pulido', 'avatar-1.svg',
          'María García', 'avatar-2.svg',
          'Carlos Rivera', 'avatar-3.svg',
        ],
      );
      console.log('✅ Usuarios de ejemplo creados');
    }
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error.message);
    throw error;
  }
}

async function iniciarServidor() {
  try {
    console.log('🔌 Conectando a base de datos...');
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Puerto: ${DB_PORT}`);
    console.log(`   Usuario: ${DB_USER}`);
    console.log(`   Base de datos: ${DATABASE}`);

    await crearBaseDeDatosIfNotExists();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Conectado a la base de datos MySQL');

    await inicializarBaseDeDatos();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Servidor listo en el puerto ${PORT}`);
      console.log(`📍 http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('\n❌ No se pudo iniciar el backend:');
    console.error(`   ${error.message}\n`);
    if (error.code === 'ENOTFOUND') {
      console.error('   No se puede resolver el host MySQL. Verifica DB_HOST y tu red.');
    }
    console.error('Verifica que:');
    console.error('1. MySQL está corriendo (usar XAMPP, WAMP, o servidor remoto)');
    console.error('2. El usuario y contraseña de MySQL son correctos');
    console.error('3. Las variables en .env son correctas y alcanzables desde tu entorno local\n');
    process.exit(1);
  }
}

iniciarServidor();
