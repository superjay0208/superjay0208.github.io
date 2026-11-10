import { restoreRun } from './still-counts-engine.js?v=sc1';
export const runKey = topic => `still-counts:run:v1:${topic.id}:${topic.revision}`;
export function storageAdapter(storage) {
  let available = true;
  return {
    get available() { return available; },
    read(key) { try { return storage.getItem(key); } catch { available = false; return null; } },
    write(key, value) { try { storage.setItem(key, value); return true; } catch { available = false; return false; } },
    load(topic) { const raw = this.read(runKey(topic)); return { run: raw ? restoreRun(topic, raw) : null, invalid: !!raw && !restoreRun(topic, raw) }; },
    save(topic, run) { return this.write(runKey(topic), JSON.stringify(run)); }
  };
}
