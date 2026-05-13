import { memo, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import './App.css'

type RawRecord = {
  id: string
  fields: Record<string, unknown>
}

type CargoItem = {
  id: string
  imageLink: string
  spu: string
  skcId: string
  store: string
  styleNo: string
  category: string
  leafCategory: string
  operator: string
  color: string
  daysOnline: number
  sales7: number
  sales30: number
  account: string
  pids: Record<string, string>
  searchable: string
  pidCount: number
}

type SortKey = 'sales30' | 'sales7' | 'daysOnline'
type SortDirection = 'asc' | 'desc'

const STORE_NAME = 'TTS-烛照'
const MARKET_KEYS = [
  'PID-US（美国）',
  'PID-GB（英国）',
  'PID-DE（德国）',
  'PID-FR（法国）',
  'PID-ES（西班牙）',
  'PID-IT（意大利）',
  'PID-MX（墨西哥）',
  'PID-SA（沙特）',
]

const MARKET_LABELS: Record<string, string> = {
  'PID-US（美国）': 'US 美国',
  'PID-GB（英国）': 'GB 英国',
  'PID-DE（德国）': 'DE 德国',
  'PID-FR（法国）': 'FR 法国',
  'PID-ES（西班牙）': 'ES 西班牙',
  'PID-IT（意大利）': 'IT 意大利',
  'PID-MX（墨西哥）': 'MX 墨西哥',
  'PID-SA（沙特）': 'SA 沙特',
}

const SORT_LABELS: Record<SortKey, string> = {
  sales30: '30天销量',
  sales7: '7天销量',
  daysOnline: '上架天数',
}

function firstText(value: unknown): string {
  if (Array.isArray(value)) return firstText(value[0])
  if (value == null) return ''
  if (typeof value === 'object') return ''
  return String(value).trim()
}

function numberValue(value: unknown): number {
  const n = Number(firstText(value) || value || 0)
  return Number.isFinite(n) ? n : 0
}

function cleanImageLink(value: unknown): string {
  return firstText(value).replace(/^"|"$/g, '')
}

function leafCategory(category: string) {
  return category.split('>').at(-1)?.trim() || category || '-'
}

function normalizeRecord(record: RawRecord): CargoItem {
  const fields = record.fields || {}
  const category = firstText(fields['类目'])
  const pids = Object.fromEntries(
    MARKET_KEYS.map((key) => [key, firstText(fields[key]) || '-']),
  )
  const item = {
    id: record.id,
    imageLink: cleanImageLink(fields['图片链接'] || fields['图片']),
    spu: firstText(fields.SPU),
    skcId: firstText(fields.skc_id),
    store: firstText(fields['店铺']),
    styleNo: firstText(fields['款号']),
    category,
    leafCategory: leafCategory(category),
    operator: firstText(fields['运营人员']),
    color: firstText(fields['颜色']),
    daysOnline: numberValue(fields['上架天数']),
    sales7: numberValue(fields['近7天销量']),
    sales30: numberValue(fields['近30天销量']),
    account: firstText(fields['关联：account_info']),
    pids,
  }

  return {
    ...item,
    searchable: [item.spu, item.skcId, item.styleNo, item.color, item.category, item.account]
      .join(' ')
      .toLowerCase(),
    pidCount: MARKET_KEYS.reduce((sum, key) => sum + (pids[key] && pids[key] !== '-' ? 1 : 0), 0),
  }
}

function exportCsv(items: CargoItem[]) {
  const headers = ['店铺', '图片链接', 'SPU', 'SKC ID', '款号', '颜色', '类目', '运营', '上架天数', '近7天销量', '近30天销量', ...MARKET_KEYS]
  const rows = items.map((item) => [
    item.store,
    item.imageLink,
    item.spu,
    item.skcId,
    item.styleNo,
    item.color,
    item.category,
    item.operator,
    item.daysOnline,
    item.sales7,
    item.sales30,
    ...MARKET_KEYS.map((key) => item.pids[key]),
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${STORE_NAME}-货盘表.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type CargoRowProps = {
  item: CargoItem
  copiedPid: string
  onCopyPid: (pid: string) => void
}

const CargoRow = memo(function CargoRow({ item, copiedPid, onCopyPid }: CargoRowProps) {
  return (
    <tr>
      <td className="image-cell" data-label="图片">
        {item.imageLink ? (
          <a href={item.imageLink} target="_blank" rel="noreferrer" title="点击查看原图">
            <img src={item.imageLink} alt={item.styleNo || item.spu || '商品图片'} loading="lazy" />
          </a>
        ) : <span className="no-image">无图</span>}
      </td>
      <td data-label="SPU / SKC"><strong>{item.spu || '-'}</strong><small>{item.skcId || '-'}</small></td>
      <td data-label="款号">{item.styleNo || '-'}</td>
      <td data-label="颜色">{item.color || '-'}</td>
      <td className="category" data-label="类目" title={item.category}>{item.leafCategory || '-'}</td>
      <td data-label="上架天数">{item.daysOnline ? `${item.daysOnline}天` : '-'}</td>
      <td className={item.sales7 > 0 ? 'sales hot' : 'sales'} data-label="7天销量">{item.sales7}</td>
      <td className={item.sales30 > 0 ? 'sales hot' : 'sales'} data-label="30天销量">{item.sales30}</td>
      <td className="pid-list" data-label="各站 PID">
        {MARKET_KEYS.map((key) => {
          const pid = item.pids[key]
          const canCopy = Boolean(pid && pid !== '-')
          return (
            <button
              className={`pid-chip${canCopy ? '' : ' muted'}${copiedPid === pid ? ' copied' : ''}`}
              disabled={!canCopy}
              key={key}
              onClick={() => onCopyPid(pid)}
              title={canCopy ? `点击复制 ${pid}` : '暂无 PID'}
              type="button"
            >
              {MARKET_LABELS[key]}：{pid}
              {copiedPid === pid && <em>已复制</em>}
            </button>
          )
        })}
      </td>
    </tr>
  )
})

function App() {
  const [items, setItems] = useState<CargoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部')
  const [sortBy, setSortBy] = useState<SortKey>('sales7')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [copiedPid, setCopiedPid] = useState('')
  const [isPending, startTransition] = useTransition()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cargo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Context: { argv: { store_name: STORE_NAME } } }),
      })
      if (!response.ok) throw new Error(`接口请求失败：${response.status}`)
      const payload = await response.json()
      const list = (payload?.data?.result || []) as RawRecord[]
      setItems(list.map(normalizeRecord))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void loadData()
    })
  }, [loadData])

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.leafCategory).filter(Boolean))
    return ['全部', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))]
  }, [items])

  const filteredItems = useMemo(() => {
    const key = keyword.trim().toLowerCase()
    return items.filter((item) => {
      const inCategory = category === '全部' || item.leafCategory === category
      return inCategory && (!key || item.searchable.includes(key))
    })
  }, [items, keyword, category])

  const sortedItems = useMemo(() => {
    const direction = sortDirection === 'desc' ? -1 : 1
    return [...filteredItems].sort((a, b) => (a[sortBy] - b[sortBy]) * direction)
  }, [filteredItems, sortBy, sortDirection])

  const stats = useMemo(() => {
    const spuSet = new Set<string>()
    const skcSet = new Set<string>()
    const pidSet = new Set<string>()

    filteredItems.forEach((item) => {
      if (item.spu) spuSet.add(item.spu)
      if (item.skcId) skcSet.add(item.skcId)
      MARKET_KEYS.forEach((key) => {
        const pid = item.pids[key]
        if (pid && pid !== '-') pidSet.add(pid)
      })
    })

    return {
      spuCount: spuSet.size,
      skcCount: skcSet.size,
      pidCount: pidSet.size,
    }
  }, [filteredItems])

  const handleCopyPid = useCallback(async (pid: string) => {
    if (!pid || pid === '-') return

    try {
      await navigator.clipboard.writeText(pid)
      setCopiedPid(pid)
      window.setTimeout(() => setCopiedPid((current) => (current === pid ? '' : current)), 1200)
    } catch {
      setError('复制失败：浏览器没有开放剪贴板权限')
    }
  }, [])

  function handleSortChange(value: SortKey) {
    startTransition(() => {
      if (sortBy === value) {
        setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      } else {
        setSortBy(value)
        setSortDirection('desc')
      }
    })
  }

  function renderSortableHeader(value: SortKey) {
    const active = sortBy === value
    const nextDirection = active && sortDirection === 'desc' ? 'asc' : 'desc'
    const directionLabel = sortDirection === 'desc' ? '倒序' : '正序'
    return (
      <button
        type="button"
        className={`sort-header${active ? ' active' : ''}`}
        onClick={() => handleSortChange(value)}
        aria-sort={active ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
        title={`按${SORT_LABELS[value]}${nextDirection === 'desc' ? '倒序' : '正序'}排序`}
      >
        {SORT_LABELS[value]}
        <span aria-hidden="true">{active ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}</span>
        {active && <em>{directionLabel}</em>}
      </button>
    )
  }

  return (
    <main className="page">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Cargo Board</p>
          <h1>{STORE_NAME} 货盘表</h1>
          <p className="sub-title">实时读取金山 AirScript 接口，支持搜索、类目筛选、销量排序和 CSV 导出。</p>
        </div>
        <div className="actions">
          <button type="button" onClick={loadData} disabled={loading}>{loading ? '刷新中…' : '刷新数据'}</button>
          <button type="button" className="secondary" onClick={() => exportCsv(sortedItems)} disabled={!sortedItems.length}>导出 CSV</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <div><span>SPU 数</span><strong>{stats.spuCount}</strong></div>
        <div><span>SKC 数量</span><strong>{stats.skcCount}</strong></div>
        <div><span>有效 PID</span><strong>{stats.pidCount}</strong></div>
      </section>

      <section className="toolbar">
        <label>
          <span>搜索</span>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="SPU / SKC / 款号 / 颜色" />
        </label>
        <label>
          <span>类目</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        {isPending && <div className="sort-pending">排序处理中…</div>}
      </section>

      <section className="table-card">
        <div className="table-meta">共 {items.length} 条数据，当前展示 {sortedItems.length} 条</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>图片</th>
                <th>SPU / SKC</th>
                <th>款号</th>
                <th>颜色</th>
                <th>类目</th>
                <th>{renderSortableHeader('daysOnline')}</th>
                <th>{renderSortableHeader('sales7')}</th>
                <th>{renderSortableHeader('sales30')}</th>
                <th>各站 PID</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr><td colSpan={9} className="empty">正在加载货盘数据…</td></tr>
              ) : sortedItems.length ? sortedItems.map((item) => {
                const rowCopiedPid = Object.values(item.pids).includes(copiedPid) ? copiedPid : ''
                return <CargoRow copiedPid={rowCopiedPid} item={item} key={item.id} onCopyPid={handleCopyPid} />
              }) : (
                <tr><td colSpan={9} className="empty">没有匹配的数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
