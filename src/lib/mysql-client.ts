import 'server-only';
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export const getMysqlClient = async () => {
  if (!pool) {
    const host = process.env.MYSQL_HOST;
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD;
    const database = process.env.MYSQL_DATABASE;
    const port = process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306;

    if (!host || !user || !database) {
      throw new Error('Missing MySQL environment variables. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.');
    }

    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      connectionLimit: 10,
      enableKeepAlive: true
    });
  }

  return pool;
};
