CREATE DATABASE IF NOT EXISTS tareas_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tareas_db;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS tareas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS administradores;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    avatar VARCHAR(120) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

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
    CONSTRAINT fk_tareas_usuario
      FOREIGN KEY (idUsuario) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_tareas_admin
      FOREIGN KEY (idAdmin) REFERENCES administradores(id) ON DELETE CASCADE,
    INDEX idx_tareas_usuario (idUsuario),
    INDEX idx_tareas_admin (idAdmin)
) ENGINE=InnoDB;

INSERT INTO administradores (username, nombre, password_hash)
VALUES ('admin', 'Administrador Inicial', '$2a$10$z32gc0KDDq7duzE1Bw1qeu5jeUpvpxtS0MIPOJf8/MHXP5sDG14Vu');

INSERT INTO usuarios (nombre, avatar)
VALUES
    ('Michaell Pulido', 'avatar-1.svg'),
    ('Maria Garcia', 'avatar-2.svg'),
    ('Carlos Rivera', 'avatar-3.svg');

SELECT 'Base de datos lista' AS estado;
SELECT * FROM administradores;
SELECT * FROM usuarios;
SELECT * FROM tareas;
