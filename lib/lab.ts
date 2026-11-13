/**
 * The lab's hand-maintained half: the expansion tracker and the cloud-study
 * curriculum. The LIVE half (cluster/pods/services/vms) comes from
 * data/lab.json, snapshotted by scripts/fetch-lab.mjs — the tracker records
 * intent; the snapshot records reality.
 */

export type TrackerStatus = 'done' | 'active' | 'planned'

export interface TrackerItem {
  name: string
  status: TrackerStatus
  note: string
  /** when it reached its current status (YYYY-MM-DD or null) */
  at?: string | null
}

export const TRACKER: TrackerItem[] = [
  {
    name: 'lab-01 · three-tier docker compose',
    status: 'done',
    at: '2026-11-06',
    note: 'nginx + flask + postgres in one compose file — the baseline stack every later lab re-implements.',
  },
  {
    name: 'lab-02 · same tiers on a kind cluster',
    status: 'done',
    at: '2026-11-07',
    note: 'the compose stack translated to kubernetes: deployments, services, configmaps, the secret that is a bag of keys.',
  },
  {
    name: 'lab-03 · observability layer',
    status: 'done',
    at: '2026-11-08',
    note: 'metrics-server, kube-state-metrics, prometheus, grafana, postgres-exporter bolted onto lab-02; alerts verified end-to-end with a chaos pod.',
  },
  {
    name: 'lab-04 · terraform iac',
    status: 'done',
    at: '2026-11-12',
    note: 'the three tiers declared in hcl — all 8 exercises run: s3 remote state with versioning + locking, the aws provider swap, and the stack instanced twice from a module.',
  },
  {
    name: 'home-lab · ansible baseline',
    status: 'done',
    at: '2026-11-08',
    note: 'network map (addresses, ports, who-can-reach-whom) plus a baseline playbook that is idempotent on both vm — changed=0 on the second run.',
  },
  {
    name: 'forge · helm chart on the cluster',
    status: 'done',
    at: '2026-11-12',
    note: 'forgejo + runner (dind sidecar) + in-cluster registry over tls from cert-manager; the compose forge retired with its volumes kept as a rollback.',
  },
  {
    name: 'gitops · argo cd deploys the chart',
    status: 'done',
    at: '2026-11-12',
    note: 'the chart is deployed by argo cd from the forge\'s own repo — sync-gitops.sh is the only path from editing the chart to a release.',
  },
  {
    name: 'reverse engineering · workflow',
    status: 'active',
    at: null,
    note: 'first self-built stripped elf analyzed in the kali vm; five reproducible notes and a reused helper remain for completion.',
  },
  {
    name: 'public edge · tunnel + ingress',
    status: 'planned',
    at: null,
    note: 'everything currently faces loopback; going public needs a tunnel (cloudflared) in front of the ingress — deliberately last.',
  },
]

export interface StudyTopic {
  name: string
  /** 0-3: portions of the topic worked through */
  progress: number
  /** 'learning' | 'working' | 'comfortable' — the honest self-grade */
  proficiency: 'learning' | 'working' | 'comfortable'
  evidence: string
}

export const STUDY: StudyTopic[] = [
  {
    name: 'docker & compose',
    progress: 3,
    proficiency: 'comfortable',
    evidence: 'lab-01 compose stack, lab-04 containers via terraform, colima migration after docker desktop, the dind sidecar in the forge runner.',
  },
  {
    name: 'kubernetes',
    progress: 2,
    proficiency: 'working',
    evidence: 'labs 02/03 on kind: deployments, services, configmaps/secrets, nodeport vs clusterip, boot-time retries, crashloop forensics.',
  },
  {
    name: 'observability',
    progress: 2,
    proficiency: 'working',
    evidence: 'prometheus + grafana + ksm + postgres-exporter on the cluster; alert fired → chaos pod deleted → self-resolved, verified end to end.',
  },
  {
    name: 'terraform / iac',
    progress: 3,
    proficiency: 'working',
    evidence: 'lab-04: hcl modules, s3 remote state with versioning and locking, provider swap to aws, drift created and destroyed on purpose.',
  },
  {
    name: 'ansible',
    progress: 2,
    proficiency: 'working',
    evidence: 'baseline playbook idempotent on ubuntu + kali (changed=0 second run); learned serial-console debugging when ssh lied.',
  },
  {
    name: 'gitops',
    progress: 1,
    proficiency: 'learning',
    evidence: 'argo cd deploys the forge chart from the forge\'s own repo; sync-gitops.sh is the only release path.',
  },
  {
    name: 'aws',
    progress: 1,
    proficiency: 'learning',
    evidence: 'scoped iam user limited to the terraform state bucket, root locked behind mfa with no keys, remote state in s3 with versioning and locking, a real bucket created/drifting/destroyed.',
  },
  {
    name: 'networking fundamentals',
    progress: 2,
    proficiency: 'working',
    evidence: 'the home-lab network map: slirp nat quirks, docker bridges 172.17/18/19, the reachability matrix proven by curl, not by belief.',
  },
]

export interface LabCluster {
  context: string
  version: string
  /** the nodes listing was denied at probe time (rbac drift) — everything else still read */
  nodesDenied?: boolean
  /** carried forward from the previous snapshot after a failed probe */
  stale?: boolean
  nodes: { name: string; role: string; ready: boolean }[]
  pods: { ns: string; name: string; phase: string; ready: boolean; restarts: number }[]
  deployments: { ns: string; name: string; ready: string }[]
  restartsTotal: number
  /** present only when kubectl top answered at snapshot time */
  metrics?: { name: string; cpu: string; mem: string }[]
}

export interface LabSnapshot {
  generatedAt: string
  cluster: LabCluster | null
  docker: { name: string; status: string; ports: string }[] | null
  services: { forgejo: { up: boolean; url: string } }
  vms: {
    ubuntu: { up: boolean; forward: string }
    kali: { up: boolean; forward: string }
    disks: { vm: string; file: string; gb: number }[]
  } | null
}

export const PROFICIENCY_STEPS = ['learning', 'working', 'comfortable'] as const
