const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const SALT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

async function setupAdmin() {
  const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'tareas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    // Crear tabla si no existe
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
    console.log('✅ Tabla administradores verificada');

    // Hashear contraseña
    const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);

    // Verificar si admin existe
    const [existingAdmin] = await pool.query(
      'SELECT id FROM administradores WHERE username = ?',
      ['admin']
    );

    if (existingAdmin.length > 0) {
      // Actualizar contraseña del admin existente
      await pool.query(
        'UPDATE administradores SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
        [passwordHash, 'admin']
      );
      console.log('✅ Usuario admin actualizado con contraseña: admin123');
    } else {
      // Crear nuevo usuario admin
      await pool.query(
        'INSERT INTO administradores (username, nombre, password_hash) VALUES (?, ?, ?)',
        ['admin', 'Administrador', passwordHash]
      );
      console.log('✅ Usuario admin creado: usuario=admin, contraseña=admin123');
    }

    console.log('\n✨ Setup completado exitosamente');
    console.log('Credenciales: admin / admin123\n');

  } catch (error) {
    console.error('❌ Error en setup:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupAdmin();
