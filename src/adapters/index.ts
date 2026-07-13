import { MOCK_DISTRIBUIDORES } from '@/mocks/distribuidores'
import { MOCK_DASHBOARD } from '@/mocks/dashboard'
import { MOCK_COLA } from '@/mocks/cola'
import { MOCK_MAESTRO } from '@/mocks/maestro'
import { MOCK_STAGES } from '@/mocks/corrida'
import { SEEDS } from '@/seeds'
import { runIngest, runPipeline, runExport } from '@/worker/client'
import { saveBlob } from '@/reports/save'

// The single boundary where mocks are bound. Real modules replace these fields sprint by sprint.
// This is the ONLY module allowed to import from src/mocks/ and src/seeds/ — every UI task
// consumes the store, never the mocks directly.
export const adapters = {
  seeds: SEEDS,
  getDashboard: () => MOCK_DASHBOARD,
  getDistribuidores: () => MOCK_DISTRIBUIDORES,
  getCola: () => MOCK_COLA,
  getMaestro: () => MOCK_MAESTRO,
  getStages: () => MOCK_STAGES,
  ingest: runIngest, // ← already real
  runPipeline, // ← already real: streams the file through the resolution engine
  runExport, // ← already real: on-demand second pass, exports the standardized base as CSV
  saveBlob, // ← already real: File System Access save with an anchor-download fallback
}
