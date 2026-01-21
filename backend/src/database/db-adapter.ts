// Database adapter that supports both SQLite (dev) and PostgreSQL/Supabase (prod)
import sqlite3 from 'sqlite3'
import { join } from 'path'
import { Pool, Client } from 'pg'

export type DatabaseType = 'sqlite' | 'postgresql'
export type DatabaseConnection = sqlite3.Database | Pool | Client

let dbConnection: DatabaseConnection | null = null
let dbType: DatabaseType = 'sqlite'

// Initialize database connection based on environment
export function initializeDatabaseConnection(): DatabaseConnection {
  if (dbConnection) {
    return dbConnection
  }

  const databaseUrl = process.env.DATABASE_URL
  const useSupabase = !!databaseUrl && databaseUrl.startsWith('postgres')

  if (useSupabase) {
    // Use Supabase/PostgreSQL
    dbType = 'postgresql'
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err)
    })

    dbConnection = pool
    console.log('✅ Connected to PostgreSQL/Supabase database')
  } else {
    // Use SQLite (local development)
    dbType = 'sqlite'
    const dbPath = join(process.cwd(), 'database.sqlite')
    dbConnection = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening SQLite database:', err)
      } else {
        console.log('✅ Connected to SQLite database')
      }
    })
    // Enable foreign keys for SQLite
    if (dbConnection instanceof sqlite3.Database) {
      dbConnection.run('PRAGMA foreign_keys = ON')
    }
  }

  return dbConnection
}

export function getDatabase(): DatabaseConnection {
  if (!dbConnection) {
    return initializeDatabaseConnection()
  }
  return dbConnection
}

export function getDatabaseType(): DatabaseType {
  return dbType
}

// Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
function convertPlaceholders(sql: string, params: any[]): string {
  if (dbType === 'sqlite') {
    return sql // SQLite uses ? placeholders
  }

  // PostgreSQL uses $1, $2, etc.
  let paramIndex = 1
  return sql.replace(/\?/g, () => `$${paramIndex++}`)
}

// Promise-based database operations that work with both SQLite and PostgreSQL
export const dbRun = async (
  database: DatabaseConnection,
  sql: string,
  params: any[] = []
): Promise<{ lastID?: number; changes: number; rows?: any[] }> => {
  const convertedSql = convertPlaceholders(sql, params)

  if (dbType === 'sqlite') {
    const db = database as sqlite3.Database
    return new Promise((resolve, reject) => {
      db.run(convertedSql, params, function (err) {
        if (err) reject(err)
        else resolve({ lastID: this.lastID, changes: this.changes })
      })
    })
  } else {
    // PostgreSQL
    const pool = database as Pool
    try {
      // For INSERT statements, add RETURNING id to get the last inserted ID
      let querySql = convertedSql
      if (convertedSql.trim().toUpperCase().startsWith('INSERT')) {
        // Check if RETURNING clause already exists
        if (!convertedSql.toUpperCase().includes('RETURNING')) {
          querySql = convertedSql.replace(/;?\s*$/, '') + ' RETURNING id'
        }
      }
      
      const result = await pool.query(querySql, params)
      return {
        lastID: result.rows[0]?.id || undefined,
        changes: result.rowCount || 0,
        rows: result.rows,
      }
    } catch (error) {
      throw error
    }
  }
}

export const dbGet = async (
  database: DatabaseConnection,
  sql: string,
  params: any[] = []
): Promise<any> => {
  const convertedSql = convertPlaceholders(sql, params)

  if (dbType === 'sqlite') {
    const db = database as sqlite3.Database
    return new Promise((resolve, reject) => {
      db.get(convertedSql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  } else {
    // PostgreSQL
    const pool = database as Pool
    try {
      const result = await pool.query(convertedSql, params)
      return result.rows[0] || null
    } catch (error) {
      throw error
    }
  }
}

export const dbAll = async (
  database: DatabaseConnection,
  sql: string,
  params: any[] = []
): Promise<any[]> => {
  const convertedSql = convertPlaceholders(sql, params)

  if (dbType === 'sqlite') {
    const db = database as sqlite3.Database
    return new Promise((resolve, reject) => {
      db.all(convertedSql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows || [])
      })
    })
  } else {
    // PostgreSQL
    const pool = database as Pool
    try {
      const result = await pool.query(convertedSql, params)
      return result.rows || []
    } catch (error) {
      throw error
    }
  }
}

export const dbExec = async (database: DatabaseConnection, sql: string): Promise<void> => {
  if (dbType === 'sqlite') {
    const db = database as sqlite3.Database
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  } else {
    // PostgreSQL - split by semicolons and execute each statement
    const pool = database as Pool
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      try {
        await pool.query(statement)
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists') && !error.message?.includes('duplicate')) {
          throw error
        }
      }
    }
  }
}

// Helper function to check if a column exists in a table
export async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const db = getDatabase()

  if (dbType === 'sqlite') {
    try {
      const columns = await dbAll(db, `PRAGMA table_info(${tableName})`)
      return columns.some((col: any) => col.name === columnName)
    } catch {
      return false
    }
  } else {
    // PostgreSQL
    try {
      const result = await dbGet(
        db,
        `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
        `,
        [tableName.toLowerCase(), columnName.toLowerCase()]
      )
      return !!result
    } catch {
      return false
    }
  }
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (dbConnection) {
    if (dbType === 'sqlite') {
      const db = dbConnection as sqlite3.Database
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err)
          else {
            dbConnection = null
            resolve()
          }
        })
      })
    } else {
      const pool = dbConnection as Pool
      await pool.end()
      dbConnection = null
    }
  }
}
