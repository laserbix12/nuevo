const readline = require('readline');
const mysql = require('mysql2/promise');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise(resolve => rl.question(q, resolve));
}

(async () => {
  console.log('=== Test de conexion TiDB Cloud ===\n');

  const host = await ask('HOST (Enter para usar gateway01.us-east-1.prod.aws.tidbcloud.com): ');
  const user = await ask('USERNAME (Enter para usar 3b3aLzPeGeWntHt.root): ');
  const pass = await ask('PASSWORD (pega la contraseña exacta): ');
  const db   = await ask('DATABASE (Enter para usar test): ');

  const config = {
    host: host.trim() || 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: user.trim() || '3b3aLzPeGeWntHt.root',
    password: pass.trim(),
    database: db.trim() || 'test',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionLimit: 1,
  };

  console.log('\nProbando conexion con:');
  console.log('  Host:', config.host);
  console.log('  User:', config.user);
  console.log('  Pass:', config.password.substring(0, 3) + '***' + config.password.substring(config.password.length - 3));
  console.log('  DB:  ', config.database);

  try {
    const pool = mysql.createPool(config);
    const conn = await pool.getConnection();
    await conn.ping();
    const [v] = await conn.query('SELECT VERSION() as v');
    console.log('\n✅ CONECTADO EXITOSAMENTE!');
    console.log('   Version:', v[0].v);

    // Guardar en .env automaticamente
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    let env = fs.readFileSync(envPath, 'utf8');
    env = env.replace(/^DB_USER=.*$/m, `DB_USER=${config.user}`);
    env = env.replace(/^DB_PASSWORD=.*$/m, `DB_PASSWORD=${config.password}`);
    env = env.replace(/^DB_HOST=.*$/m, `DB_HOST=${config.host}`);
    env = env.replace(/^DB_NAME=.*$/m, `DB_NAME=${config.database}`);
    fs.writeFileSync(envPath, env);
    console.log('\n✅ Archivo .env actualizado automaticamente!');
    console.log('   Ahora ejecuta: npm run dev\n');

    conn.release();
    await pool.end();
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    if (e.message.includes('Access denied')) {
      console.error('   La contraseña o usuario es incorrecta.');
      console.error('   Ve a TiDB Cloud > Connect > Reset Password');
    }
  }

  rl.close();
})();
