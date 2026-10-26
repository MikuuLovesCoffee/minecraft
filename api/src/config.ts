function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3031),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  mcDir: process.env.MC_DIR ?? '/opt/minecraft/server',
  mcHost: process.env.MC_HOST ?? '127.0.0.1',
  mcPort: Number(process.env.MC_PORT ?? 25565),
  admins: (process.env.ADMIN_PLAYERS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE !== 'false',
};

if (config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
