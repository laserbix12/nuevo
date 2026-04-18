const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const { buildDbConfig } = require('./db-config');
const dbConfig = buildDbConfig();

const poolConfig = {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function crearBaseDeDatos() {
  // Solo intentar crear la base de datos en entornos que no sean de producción.
  if (!dbConfig.shouldAutoCreateDatabase) {
    console.log('⚠️ Se omite CREATE DATABASE en entorno de producción/administrado según db-config.');
    return;
  }

  const poolTemporal = mysql.createPool(poolConfig);
  const connTemp = await poolTemporal.getConnection();
  await connTemp.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  connTemp.release();
  await poolTemporal.end();
}

async function crearTablas() {
  const pool = mysql.createPool({ ...poolConfig, database: dbConfig.database });
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
    const passwordHash = await bcrypt.hash('admin123', 10);
    await pool.query('INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)', [
      'admin',
      'Administrador Inicial',
      passwordHash,
    ]);
    console.log('✅ Admin creado: admin / admin123');
  }

  await pool.end();
}

async function main() {
  try {
    await crearBaseDeDatos();
    await crearTablas();
    console.log('✅ Setup de la base de datos completado');
  } catch (error) {
    console.error('❌ Error en setup-db:', error.message);
    process.exit(1);
  }
}

main();
