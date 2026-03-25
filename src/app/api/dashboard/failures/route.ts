import { NextResponse } from 'next/server';
import { getDuckDBFailedQueries } from '@/lib/duckdb/queries';

export async function GET() {
  try {
    const data = await getDuckDBFailedQueries(10);
    return NextResponse.json(data);
  } catch (error) {
    console.error("DuckDB Query Error:", error);
    return NextResponse.json({ error: "Failed to fetch telemetry" }, { status: 500 });
  }
}