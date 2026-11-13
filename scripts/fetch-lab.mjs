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

const run = (cmd, args, timeout = 8000) =>
  new Promise(resolve => {
    execFile(cmd, args, { timeout }, (err, stdout) =>
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
  // ---- kind cluster ----------------------------------------------------------
  let cluster = null
  const nodesRaw = await run('kubectl', ['--context', CTX, 'get', 'nodes', '-o', 'json'])
  if (nodesRaw) {
    try {
      const nodes = JSON.parse(nodesRaw)
      const podsRaw = await run('kubectl', ['--context', CTX, 'get', 'pods', '-A', '-o', 'json'])
      const deploysRaw = await run('kubectl', ['--context', CTX, 'get', 'deploy', '-A', '-o', 'json'])
      const pods = podsRaw ? JSON.parse(podsRaw).items : []
      const deploys = deploysRaw ? JSON.parse(deploysRaw).items : []
      cluster = {
        context: CTX,
        version:
          nodes.items[0]?.status?.nodeInfo?.kubeletVersion ??
          nodes.items[0]?.status?.nodeInfo?.kubeProxyVersion ??
          '',
        nodes: nodes.items.map(n => ({
          name: n.metadata.name,
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
            name: p.metadata.name,
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
            return { name, cpu, mem }
          })
      }
    } catch {
      cluster = null // parse hiccup → treat as unreachable
    }
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
        return { name, status: status || '', ports: ports || '' }
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
      forgejo: { up: forgejo, url: 'https://forgejo.lab02.local:8443/' },
    },
    vms,
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
