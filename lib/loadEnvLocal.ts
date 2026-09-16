import fs from 'fs'
import path from 'path'

// Next.js auto-loads .env.local for its own dev/build/start processes, but
// standalone scripts run outside Next (drizzle-kit's CLI, scripts/seed.ts
// via `npx tsx`) don't get that for free. Minimal KEY=VALUE parser -- good
// enough for the handful of vars this project actually needs, and avoids
// pulling in a dotenv dependency just for this.
export function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
