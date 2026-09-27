import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createLogTailer } from './tailer'

const tempDirs: string[] = []

afterEach(async function cleanupTempDirs() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

async function tempLog(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mongoscope-log-tail-'))
  tempDirs.push(dir)
  const path = join(dir, 'mongod.log')
  await writeFile(path, content)
  return path
}

function line(msg: string, c = 'COMMAND'): string {
  return `{"t":{"$date":"2024-01-01T00:00:00.000Z"},"s":"I",  "c":"${c}",  "id":1,   "ctx":"c1","msg":"${msg}","attr":{"ns":"a.b","durationMillis":10}}\n`
}

describe('createLogTailer', () => {
  it('seeds trailing lines then follows appends', async () => {
    const path = await tempLog(line('seed-1') + line('seed-2'))
    const tailer = createLogTailer({ path, pollIntervalMs: 10_000, seedLineTarget: 2000 })
    await tailer.start()
    const seeded = tailer.getSnapshot()
    expect(seeded.lines.map((entry) => entry.msg)).toEqual(['seed-1', 'seed-2'])
    expect(seeded.stats.format).toBe('JSON (4.4+)')
    expect(seeded.stats.bufferedCount).toBe(2)

    await appendFile(path, line('live-1'))
    await tailer.pollOnce()
    const after = tailer.getSnapshot()
    expect(after.lines.map((entry) => entry.msg)).toEqual(['seed-1', 'seed-2', 'live-1'])
    tailer.stop()
  })

  it('detects size-decrease rotation, increments restarts, keeps ring content', async () => {
    const path = await tempLog(line('before-1') + line('before-2'))
    const tailer = createLogTailer({ path, pollIntervalMs: 10_000 })
    await tailer.start()
    expect(tailer.getSnapshot().lines).toHaveLength(2)
    expect(tailer.getSnapshot().stats.restartsDetected).toBe(0)

    await writeFile(path, line('after-rotate'))
    await tailer.pollOnce()

    const snap = tailer.getSnapshot()
    expect(snap.stats.restartsDetected).toBe(1)
    expect(snap.lines.map((entry) => entry.msg)).toEqual(['before-1', 'before-2', 'after-rotate'])
    expect(snap.offset).toBeGreaterThan(0)
    tailer.stop()
  })

  it('does not drop buffered lines when following after pause-equivalent stop/start offset retain', async () => {
    const path = await tempLog(line('a'))
    const tailer = createLogTailer({ path, pollIntervalMs: 10_000 })
    await tailer.start()
    await appendFile(path, line('b'))
    await tailer.pollOnce()
    const beforeStop = tailer.getSnapshot().lines.map((entry) => entry.msg)
    expect(beforeStop).toEqual(['a', 'b'])

    // stop clears the interval but domain ring is owned by the tailer instance;
    // session store will retain snapshot — here verify stop does not clear ring.
    tailer.stop()
    expect(tailer.getSnapshot().lines.map((entry) => entry.msg)).toEqual(['a', 'b'])
  })
})
