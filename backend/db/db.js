import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT;
const DB_USER = process.env.DB_USER;
const DB_DB = process.env.DB_DB;

const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    password: DB_PASSWORD,
    user: DB_USER,
    database: DB_DB
});

export default pool;
