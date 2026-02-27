import snowflake from 'snowflake-sdk'
import { config } from 'dotenv'

config()

let connection: snowflake.Connection | null = null

function summarizeSnowflakeError(err: any) {
  if (!err) return err
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    sqlState: err.sqlState,
    data: err.data
      ? {
          ...('type' in err.data ? { type: err.data.type } : {}),
          ...('queryId' in err.data ? { queryId: err.data.queryId } : {}),
        }
      : undefined,
  }
}

export async function getConnection(): Promise<snowflake.Connection> {
  if (connection) {
    return connection
  }

  return new Promise((resolve, reject) => {
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT || '',
      username: process.env.SNOWFLAKE_USER || '',
      password: process.env.SNOWFLAKE_PASSWORD || '',
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || '',
      database: process.env.SNOWFLAKE_DATABASE || '',
      schema: process.env.SNOWFLAKE_SCHEMA || 'LIGHTHOUSE_MART',
      role: process.env.SNOWFLAKE_ROLE || '',
    })

    conn.connect((err) => {
      if (err) {
        console.error('Failed to connect to Snowflake:', summarizeSnowflakeError(err))
        reject(err)
      } else {
        console.log('Connected to Snowflake')
        connection = conn
        resolve(conn)
      }
    })
  })
}

export async function executeQuery<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const conn = await getConnection()

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: (params as any) || [],
      complete: (err: any, _stmt: any, rows: any) => {
        if (err) {
          console.error('Query execution error:', summarizeSnowflakeError(err))
          reject(err)
        } else {
          resolve(rows || [])
        }
      },
    })
  })
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    return new Promise((resolve, reject) => {
      connection!.destroy((err: any) => {
        if (err) {
          console.error('Error closing connection:', summarizeSnowflakeError(err))
          reject(err)
        } else {
          connection = null
          console.log('Connection closed')
          resolve()
        }
      })
    })
  }
}
