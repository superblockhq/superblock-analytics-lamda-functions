import { Pool, type QueryResult, type QueryResultRow } from "pg";

let cachedPool: Pool | null = null;
let cachedCredentials: { username?: string; password?: string } | null = null;

const REGION = process.env.AWS_REGION || "ap-south-1";

/**
 * Retrieves database credentials from AWS Secrets Manager using DB_SECRET_ARN,
 * or falls back to local environment variables if DB_SECRET_ARN is not provided.
 */
async function getDbCredentials(): Promise<{ username: string; password: string }> {
  if (cachedCredentials?.username && cachedCredentials?.password) {
    return {
      username: cachedCredentials.username,
      password: cachedCredentials.password,
    };
  }

  const secretArn = process.env.DB_SECRET_ARN;

  if (secretArn) {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        "@aws-sdk/client-secrets-manager"
      );
      const client = new SecretsManagerClient({ region: REGION });
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await client.send(command);

      if (response.SecretString) {
        try {
          const parsed = JSON.parse(response.SecretString);
          cachedCredentials = {
            username: parsed.username || parsed.user || "superblockhq",
            password: parsed.password || "",
          };
          return {
            username: cachedCredentials.username!,
            password: cachedCredentials.password!,
          };
        } catch {
          // If secret is plain text password rather than JSON
          cachedCredentials = {
            username: process.env.DB_USER || "superblockhq",
            password: response.SecretString,
          };
          return {
            username: cachedCredentials.username!,
            password: cachedCredentials.password!,
          };
        }
      }
    } catch (err: any) {
      console.warn("Could not retrieve secret from Secrets Manager:", err?.message || err);
    }
  }

  // Local / Direct environment fallback (for SSH tunnel or local testing)
  const username =
    process.env.DB_USER || process.env.PGUSER || "superblockhq";
  let password =
    process.env.DB_PASSWORD || process.env.PGPASSWORD || "";

  if (!password) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { execFileSync } = await import("child_process");

      const pgAdminPython =
        "C:\\Users\\Dell\\AppData\\Local\\Programs\\pgAdmin 4\\python\\python.exe";
      const pythonExe =
        process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)
          ? process.env.PYTHON_PATH
          : fs.existsSync(pgAdminPython)
          ? pgAdminPython
          : "python";

      const { fileURLToPath } = await import("url");
      const currentDir =
        typeof __dirname !== "undefined"
          ? __dirname
          : path.dirname(fileURLToPath(import.meta.url));

      const possibleScriptPaths = [
        path.resolve(process.cwd(), "server", "queryAnalyticsDb.py"),
        path.resolve(currentDir, "..", "queryAnalyticsDb.py"),
        path.resolve(currentDir, "queryAnalyticsDb.py"),
        path.resolve(currentDir, "..", "..", "server", "queryAnalyticsDb.py"),
        "C:\\Users\\Dell\\Superblock-Insight\\server\\queryAnalyticsDb.py",
      ];

      let scriptPath = "";
      for (const p of possibleScriptPaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }

      if (scriptPath) {
        const pass = execFileSync(pythonExe, [scriptPath, "--get-password"], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();

        if (pass) {
          password = pass;
          process.env.DB_PASSWORD = pass;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve local DB credentials from queryAnalyticsDb:", err);
    }
  }

  if (password) {
    cachedCredentials = { username, password };
  }
  return { username, password };
}

/**
 * Initializes and returns a singleton PostgreSQL connection pool.
 * Uses RDS Proxy endpoint in DB_HOST with small pool size for AWS Lambda.
 */
export async function getPool(): Promise<Pool> {
  if (cachedPool) {
    return cachedPool;
  }

  const creds = await getDbCredentials();

  const host = process.env.DB_HOST || "127.0.0.1";
  const port = parseInt(
    process.env.DB_PORT || (process.env.AWS_EXECUTION_ENV ? "5432" : "5433"),
    10
  );
  const database = process.env.DB_NAME || "superblockhq";

  // Small connection pool configuration for serverless Lambda execution
  const maxPoolSize = parseInt(process.env.DB_POOL_MAX || "2", 10);

  // SSL is enabled by default for AWS RDS / RDS Proxy; can be explicitly disabled for local tunnels
  const useSsl =
    process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false };

  cachedPool = new Pool({
    host,
    port,
    database,
    user: creds.username,
    password: creds.password,
    max: maxPoolSize,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: useSsl,
  });

  cachedPool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client pool:", err);
    cachedPool = null;
  });

  return cachedPool;
}

/**
 * Executes a parameterized SQL query safely against PostgreSQL.
 * Never interpolates user values directly into SQL strings.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  return pool.query<T>(text, params);
}

/**
 * Gracefully shuts down the connection pool (useful in testing or teardown).
 */
export async function closePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
