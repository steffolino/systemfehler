import { Router } from 'itty-router'
import { searchHandler, detailHandler, sourcesHandler, healthHandler } from './routes'

export interface Env { DB: D1Database; LLM_MODEL: string; ANTHROPIC_API_KEY?: string }

const router = Router()
router.get('/health', healthHandler)
router.get('/search', searchHandler)
router.get('/detail/:id', detailHandler)
router.get('/sources', sourcesHandler)

export default { fetch: (req: Request, env: Env, ctx: ExecutionContext) => router.handle(req, env, ctx) }
