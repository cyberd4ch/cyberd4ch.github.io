/**
 * Snapshot the home lab into data/lab.json — the same contract as
 * fetch-github.mjs: the site reflects the real stack, not a hand-edited list.
 *
 * Probes (all best-effort; a miss just omits that section):
 *   kubectl (context kind-lab02)  nodes, pods, deployments, restarts, top
 *   docker / colima               the lab-04 compose stack, edge socat
 *   TCP reachability              forgejo :8443, the two VM ssh forwards
 *   filesystem                    the qcow2 disk images in vms/
 *
 * Network failures are non-fatal: the previously committed snapshot is kept.
 * In CI (no homelab attached) the script exits 0 without touching the file.
 */
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { execFile } from 'node:child_process'

const OUT = path.join(process.cwd(), 'data', 'lab.json')
const CTX = process.env.LAB_CONTEXT || 'kind-lab02'
const VMS_DIR = process.env.HOME ? path.join(process.env.HOME, 'cloud_prep', 'vms') : null

/**
 * The published snapshot stays dummy: the site describes the lab's SHAPE
 * (what runs, what's up/down) without advertising its real hostnames,
 * context names, or forwarded ports — so going public later doesn't hand
 * anyone a map of the private network.
 */
const dummyName = name =>
  String(name || '')
    .replace(/lab\d+-/g, '')
    .replace(/kind-/, 'kind-') || 'node'
const DUMMY_FORGE_URL = 'https://forge.lab.local/'

const run = (cmd, args, timeout = 20000) =>
  new Promise(resolve => {
    execFile(cmd, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) =>
      resolve(err ? null : stdout)
    )
  })

/** one TCP probe with a deadline */
function probe(host, port, timeout = 1500) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port })
    const done = ok => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeout)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
  })
}

async function main() {
  // previous snapshot, for carry-forward when the cluster API turns hostile
  let previous = null
  try {
    previous = JSON.parse(await fs.readFile(OUT, 'utf8'))
  } catch {
    // first snapshot — nothing to carry forward
  }

  // ---- kind cluster ----------------------------------------------------------
  // probed resource by resource: a denied listing (rbac drift, api-server
  // mood) degrades that section instead of wiping the whole snapshot
  let cluster = null
  const nodesRaw = await run('kubectl', ['--context', CTX, 'get', 'nodes', '-o', 'json'])
  const podsRaw = await run('kubectl', ['--context', CTX, 'get', 'pods', '-A', '-o', 'json'])
  const deploysRaw = await run('kubectl', ['--context', CTX, 'get', 'deploy', '-A', '-o', 'json'])
  if (nodesRaw || podsRaw || deploysRaw) {
    try {
      const nodes = nodesRaw ? JSON.parse(nodesRaw) : { items: [] }
      const pods = podsRaw ? JSON.parse(podsRaw).items : []
      const deploys = deploysRaw ? JSON.parse(deploysRaw).items : []
      let version = nodes.items[0]?.status?.nodeInfo?.kubeletVersion ?? ''
      if (!version) {
        const verRaw = await run('kubectl', ['--context', CTX, 'version', '-o', 'json'])
        if (verRaw) {
          try {
            version = JSON.parse(verRaw).serverVersion?.gitVersion ?? ''
          } catch {
            // version probe is best-effort
          }
        }
      }
      cluster = {
        context: 'kind-lab',
        version,
        nodesDenied: !nodesRaw,
        nodes: nodes.items.map(n => ({
          name: dummyName(n.metadata.name),
          role: Object.keys(n.metadata.labels || {}).some(l => l === 'node-role.kubernetes.io/control-plane')
            ? 'control-plane'
            : 'worker',
          ready: (n.status.conditions || []).some(c => c.type === 'Ready' && c.status === 'True'),
        })),
        pods: pods.map(p => {
          const statuses = p.status?.containerStatuses || []
          const ready = statuses.length > 0 && statuses.every(s => s.ready)
          return {
            ns: p.metadata.namespace,
            name: dummyName(p.metadata.name),
            phase: p.status?.phase ?? '',
            ready,
            restarts: statuses.reduce((sum, s) => sum + (s.restartCount || 0), 0),
          }
        }),
        deployments: deploys.map(d => ({
          ns: d.metadata.namespace,
          name: d.metadata.name,
          ready: `${d.status?.readyReplicas ?? 0}/${d.spec?.replicas ?? 0}`,
        })),
        restartsTotal: pods.reduce(
          (sum, p) =>
            sum +
            (p.status?.containerStatuses || []).reduce((s, c) => s + (c.restartCount || 0), 0),
          0,
        ),
      }
      // metrics-server top, when it answers
      const topRaw = await run('kubectl', ['--context', CTX, 'top', 'nodes', '--no-headers'])
      if (topRaw) {
        cluster.metrics = topRaw
          .trim()
          .split('\n')
          .map(line => {
            const [name, cpu, , mem] = line.split(/\s+/)
            return { name: dummyName(name), cpu, mem }
          })
      }
    } catch {
      cluster = null // parse hiccup → treat as unreachable
    }
  }

  // the cluster API answered nothing usable — carry the last known state
  // forward, flagged stale, rather than publishing "unreachable" while the
  // cluster may simply be rbac-grumpy
  if (!cluster && previous?.cluster) {
    cluster = { ...previous.cluster, stale: true }
  }

  // ---- docker (colima): the compose-era stacks --------------------------------
  let docker = null
  const psRaw = await run('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}\t{{.Ports}}'])
  if (psRaw !== null) {
    docker = psRaw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, status, ports] = line.split('\t')
        // published host ports stay out of the public snapshot too
        return { name: dummyName(name), status: status || '', ports: '' }
      })
  }

  // ---- reachability -----------------------------------------------------------
  const [forgejo, ubuntuSsh, kaliSsh] = await Promise.all([
    probe('127.0.0.1', 8443),
    probe('127.0.0.1', 50022),
    probe('127.0.0.1', 50122),
  ])

  // ---- VM disk images ---------------------------------------------------------
  let vms = null
  if (VMS_DIR) {
    const disks = []
    for (const vm of ['kali', 'ubuntu']) {
      try {
        const files = await fs.readdir(path.join(VMS_DIR, vm))
        for (const f of files) {
          if (f.endsWith('.qcow2')) {
            const st = await fs.stat(path.join(VMS_DIR, vm, f))
            disks.push({ vm, file: f, gb: +(st.size / 1024 ** 3).toFixed(1) })
          }
        }
      } catch {
        // vm dir missing — fine
      }
    }
    vms = {
      ubuntu: { up: ubuntuSsh, forward: '127.0.0.1:50022' },
      kali: { up: kaliSsh, forward: '127.0.0.1:50122' },
      disks,
    }
  }

  if (!cluster && !docker && !vms) {
    console.warn('[lab] nothing reachable — keeping the existing snapshot')
    process.exit(0)
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    cluster,
    docker,
    services: {
      forgejo: { up: forgejo, url: DUMMY_FORGE_URL },
    },
    vms: vms
      ? {
          ...vms,
          // loopback forwards exist, but their ports stay private
          ubuntu: { up: vms.ubuntu.up, forward: 'loopback' },
          kali: { up: vms.kali.up, forward: 'loopback' },
        }
      : null,
  }
  await fs.mkdir(path.dirname(OUT), { recursive: true })
  await fs.writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `[lab] cluster ${cluster ? 'up' : 'down'}, docker ${docker ? docker.length + ' containers' : 'down'}, forgejo ${forgejo ? 'up' : 'down'} → ${path.relative(process.cwd(), OUT)}`,
  )
}

main().catch(err => {
  console.warn(`[lab] snapshot failed, keeping existing snapshot: ${err.message}`)
  process.exit(0)
})
