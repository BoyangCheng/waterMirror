import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;

// 生产环境使用连接池，开发环境单连接
const sql = postgres(connectionString, {
  max: process.env.NODE_ENV === "production" ? 10 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export default sql;
