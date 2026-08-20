import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  stravaClientId: required("STRAVA_CLIENT_ID"),
  stravaClientSecret: required("STRAVA_CLIENT_SECRET"),
  stravaRedirectUri: required("STRAVA_REDIRECT_URI"),
};
