import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const db=await pool.connect();
try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(7134559)');await db.query(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));await db.query('COMMIT');console.log('Database migration complete');}finally{db.release();await pool.end();}
