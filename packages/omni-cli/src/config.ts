export const config = {
  apiUrl: process.env.OMNI_API_URL ?? "http://127.0.0.1:3000",
  jwtSecret: process.env.OMNI_JWT_SECRET ?? "omni-grid-jwt-dev-secret",
  busUrl: process.env.OMNI_BUS_URL ?? "nats://localhost:4222",
  busBackend: (process.env.OMNI_BUS_BACKEND ?? "in-memory") as "in-memory" | "nats",
};
