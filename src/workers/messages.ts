export type WorkerMessage =
  | { type: 'start'; config: unknown }
  | { type: 'ready' }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'sync_complete'; skillsUpdated: string[] }
  | { type: 'scan_complete'; skillName: string; passed: boolean }
  | { type: 'index_rebuilt'; skillCount: number }
  | { type: 'error'; message: string };
