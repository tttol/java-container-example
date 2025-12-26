CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO Users (name) VALUES ('Alice Johnson');
INSERT INTO Users (name) VALUES ('Bob Smith');
INSERT INTO Users (name) VALUES ('Charlie Brown');
INSERT INTO Users (name) VALUES ('Diana Prince');
INSERT INTO Users (name) VALUES ('Eve Davis');
