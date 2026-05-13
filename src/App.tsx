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
  pickTags: PickTag[]
}

type PickTag = {
  label: string
  tone: 'hot' | 'new' | 'stable' | 'coverage' | 'watch'
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
const PAGE_SIZE = 50
const MIN_GOOD_PID_COUNT = 3
const TAG_TONES: Record<string, PickTag['tone']> = {
  爆款: 'hot',
  潜力新品: 'new',
  稳定出单: 'stable',
  多站点: 'coverage',
  待观察: 'watch',
}
const TAG_DESCRIPTIONS: Record<string, string> = {
  爆款: '近7天销量较高，或近期销量动能明显',
  稳定出单: '近30天销量稳定，且近7天仍有销量',
  潜力新品: '上架30天内，且近7天已有销量',
  多站点: `有效 PID 覆盖不少于 ${MIN_GOOD_PID_COUNT} 个站点`,
  待观察: '暂未出现明显销量、上新或多站点覆盖信号',
}
const TAG_ORDER = ['爆款', '稳定出单', '潜力新品', '多站点', '待观察']
const BASKET_STORAGE_KEY = 'cargo-board:selected-items'
const GUIDE_COLLAPSED_STORAGE_KEY = 'cargo-board:guide-collapsed'
const RULES_COLLAPSED_STORAGE_KEY = 'cargo-board:rules-collapsed'

function readSavedBoolean(key: string, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : raw === 'true'
  } catch {
    return fallback
  }
}

function readSavedSelectedIds() {
  try {
    const raw = window.localStorage.getItem(BASKET_STORAGE_KEY)
    const ids = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
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

function buildPickTags(item: Omit<CargoItem, 'searchable' | 'pidCount' | 'pickTags'>, pidCount: number): PickTag[] {
  const tags: PickTag[] = []
  const isNew = item.daysOnline > 0 && item.daysOnline <= 30
  const salesMomentum = item.sales7 * 4 >= Math.max(item.sales30, 1)

  if (item.sales7 >= 10 || (item.sales7 >= 5 && salesMomentum)) {
    tags.push({ label: '爆款', tone: 'hot' })
  }

  if (isNew && item.sales7 > 0) {
    tags.push({ label: '潜力新品', tone: 'new' })
  }

  if (item.sales30 >= 20 && item.sales7 > 0) {
    tags.push({ label: '稳定出单', tone: 'stable' })
  }

  if (pidCount >= MIN_GOOD_PID_COUNT) {
    tags.push({ label: '多站点', tone: 'coverage' })
  }

  if (!tags.length) {
    tags.push({ label: '待观察', tone: 'watch' })
  }

  return tags.slice(0, 3)
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

  const pidCount = MARKET_KEYS.reduce((sum, key) => sum + (pids[key] && pids[key] !== '-' ? 1 : 0), 0)

  return {
    ...item,
    searchable: [item.spu, item.skcId, item.styleNo, item.color, item.category, item.account]
      .join(' ')
      .toLowerCase(),
    pidCount,
    pickTags: buildPickTags(item, pidCount),
  }
}

function buildPitchText(item: CargoItem) {
  const activePids = MARKET_KEYS
    .map((key) => ({ market: MARKET_LABELS[key], pid: item.pids[key] }))
    .filter(({ pid }) => pid && pid !== '-')
    .map(({ market, pid }) => `${market}：${pid}`)

  return [
    `【${STORE_NAME} 货盘推荐】`,
    `SPU：${item.spu || '-'}`,
    `SKC：${item.skcId || '-'}`,
    `款号：${item.styleNo || '-'}`,
    `颜色：${item.color || '-'}`,
    `类目：${item.leafCategory || item.category || '-'}`,
    `选品标签：${item.pickTags.map((tag) => tag.label).join(' / ')}`,
    `上架天数：${item.daysOnline ? `${item.daysOnline}天` : '-'}`,
    `近7天销量：${item.sales7}`,
    `近30天销量：${item.sales30}`,
    activePids.length ? `各站 PID：\n${activePids.join('\n')}` : '各站 PID：暂无',
    item.imageLink ? `图片：${item.imageLink}` : '',
  ].filter(Boolean).join('\n')
}

function exportCsv(items: CargoItem[]) {
  const headers = ['店铺', '图片链接', 'SPU', 'SKC ID', '款号', '颜色', '类目', '选品标签', '运营', '上架天数', '近7天销量', '近30天销量', ...MARKET_KEYS]
  const rows = items.map((item) => [
    item.store,
    item.imageLink,
    item.spu,
    item.skcId,
    item.styleNo,
    item.color,
    item.category,
    item.pickTags.map((tag) => tag.label).join(' / '),
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
  isSelected: boolean
  isSpuFiltered: boolean
  onCopyPitch: (item: CargoItem) => void
  onCopyPid: (pid: string) => void
  onPreviewImage: (item: CargoItem) => void
  onSearchSpu: (spu: string) => void
  onToggleSelection: (id: string) => void
}

type ImageThumbProps = {
  src: string
  alt: string
}

const ImageThumb = memo(function ImageThumb({ src, alt }: ImageThumbProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className="image-fallback">图片失效</span>
  }

  return (
    <>
      {!loaded && <span className="image-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={loaded ? 'loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  )
})

const CargoRow = memo(function CargoRow({ item, copiedPid, isSelected, isSpuFiltered, onCopyPitch, onCopyPid, onPreviewImage, onSearchSpu, onToggleSelection }: CargoRowProps) {
  return (
    <tr className={isSelected ? 'selected-row' : ''}>
      <td className="basket-cell" data-label="选品篮">
        <button
          className={`basket-toggle${isSelected ? ' active' : ''}`}
          type="button"
          onClick={() => onToggleSelection(item.id)}
          title={isSelected ? '移出选品篮' : '加入选品篮'}
        >
          {isSelected ? '已选' : '加入'}
        </button>
      </td>
      <td className="image-cell" data-label="图片">
        {item.imageLink ? (
          <button className="image-preview-trigger" type="button" onClick={() => onPreviewImage(item)} title="预览大图">
            <ImageThumb key={item.imageLink} src={item.imageLink} alt={item.styleNo || item.spu || '商品图片'} />
          </button>
        ) : <span className="no-image">无图</span>}
      </td>
      <td data-label="SPU / SKC">
        {item.spu ? (
          <button
            className={`spu-link${isSpuFiltered ? ' active' : ''}`}
            type="button"
            onClick={() => onSearchSpu(item.spu)}
            title={isSpuFiltered ? `取消筛选 SPU：${item.spu}` : `点击筛选该 SPU 下所有 SKC：${item.spu}`}
          >
            <span>{item.spu}</span>
            <em>{isSpuFiltered ? '取消筛选' : '筛选'}</em>
          </button>
        ) : <strong>-</strong>}
        <small>{item.skcId || '-'}</small>
      </td>
      <td data-label="款号">{item.styleNo || '-'}</td>
      <td data-label="颜色">{item.color || '-'}</td>
      <td className="category" data-label="类目" title={item.category}>{item.leafCategory || '-'}</td>
      <td className="pick-tags" data-label="推荐标签">
        {item.pickTags.map((tag) => <span className={`pick-tag ${tag.tone}`} key={tag.label} title={TAG_DESCRIPTIONS[tag.label]}>{tag.label}</span>)}
      </td>
      <td data-label="上架天数">{item.daysOnline ? `${item.daysOnline}天` : '-'}</td>
      <td className={item.sales7 > 0 ? 'sales hot' : 'sales'} data-label="7天销量">{item.sales7}</td>
      <td className={item.sales30 > 0 ? 'sales hot' : 'sales'} data-label="30天销量">{item.sales30}</td>
      <td className="pitch-cell" data-label="一键复制">
        <button className={`pitch-copy${copiedPid === `pitch:${item.id}` ? ' copied' : ''}`} type="button" onClick={() => onCopyPitch(item)}>
          {copiedPid === `pitch:${item.id}` ? '已复制' : '一键复制'}
        </button>
      </td>
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
  const [updatedAt, setUpdatedAt] = useState('')
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('全部')
  const [tagFilter, setTagFilter] = useState('全部')
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [guideCollapsed, setGuideCollapsed] = useState(() => readSavedBoolean(GUIDE_COLLAPSED_STORAGE_KEY))
  const [rulesCollapsed, setRulesCollapsed] = useState(() => readSavedBoolean(RULES_COLLAPSED_STORAGE_KEY))
  const [sortBy, setSortBy] = useState<SortKey>('sales7')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [copiedPid, setCopiedPid] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(readSavedSelectedIds)
  const [previewItem, setPreviewItem] = useState<CargoItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
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
      setUpdatedAt(new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()))
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

  useEffect(() => {
    window.localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(Array.from(selectedIds)))
  }, [selectedIds])

  useEffect(() => {
    window.localStorage.setItem(GUIDE_COLLAPSED_STORAGE_KEY, String(guideCollapsed))
  }, [guideCollapsed])

  useEffect(() => {
    window.localStorage.setItem(RULES_COLLAPSED_STORAGE_KEY, String(rulesCollapsed))
  }, [rulesCollapsed])

  const validSelectedIds = useMemo(() => {
    if (!items.length) return selectedIds

    const itemIds = new Set(items.map((item) => item.id))
    return new Set(Array.from(selectedIds).filter((id) => itemIds.has(id)))
  }, [items, selectedIds])

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.leafCategory).filter(Boolean))
    return ['全部', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))]
  }, [items])

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      item.pickTags.forEach((tag) => set.add(tag.label))
    })
    const extraTags = Array.from(set)
      .filter((tag) => !TAG_ORDER.includes(tag))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
    return ['全部', ...TAG_ORDER, ...extraTags]
  }, [items])

  const filteredItems = useMemo(() => {
    const key = keyword.trim().toLowerCase()
    return items.filter((item) => {
      const inCategory = category === '全部' || item.leafCategory === category
      const inTag = tagFilter === '全部' || item.pickTags.some((tag) => tag.label === tagFilter)
      const inBasket = !showSelectedOnly || validSelectedIds.has(item.id)
      return inCategory && inTag && inBasket && (!key || item.searchable.includes(key))
    })
  }, [items, keyword, category, tagFilter, showSelectedOnly, validSelectedIds])

  const sortedItems = useMemo(() => {
    const direction = sortDirection === 'desc' ? -1 : 1
    return [...filteredItems].sort((a, b) => (a[sortBy] - b[sortBy]) * direction)
  }, [filteredItems, sortBy, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageStart = (safeCurrentPage - 1) * PAGE_SIZE
  const pageEnd = Math.min(pageStart + PAGE_SIZE, sortedItems.length)
  const pageItems = useMemo(() => {
    return sortedItems.slice(pageStart, pageEnd)
  }, [sortedItems, pageStart, pageEnd])

  const selectedItems = useMemo(() => {
    return items.filter((item) => validSelectedIds.has(item.id))
  }, [items, validSelectedIds])

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

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleCopySelectedPitch = useCallback(async () => {
    if (!selectedItems.length) return

    try {
      await navigator.clipboard.writeText(selectedItems.map(buildPitchText).join('\n\n---\n\n'))
      setCopiedPid('selected:pitch')
      window.setTimeout(() => setCopiedPid((current) => (current === 'selected:pitch' ? '' : current)), 1200)
    } catch {
      setError('复制失败：浏览器没有开放剪贴板权限')
    }
  }, [selectedItems])

  const handleCopyPitch = useCallback(async (item: CargoItem) => {
    try {
      await navigator.clipboard.writeText(buildPitchText(item))
      setCopiedPid(`pitch:${item.id}`)
      window.setTimeout(() => setCopiedPid((current) => (current === `pitch:${item.id}` ? '' : current)), 1200)
    } catch {
      setError('复制失败：浏览器没有开放剪贴板权限')
    }
  }, [])

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
      setCurrentPage(1)
    })
  }

  function handlePageChange(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages))
  }

  function handleSearchSpu(spu: string) {
    setKeyword((current) => (current.trim() === spu ? '' : spu))
    setCurrentPage(1)
  }

  function closeImagePreview() {
    setPreviewItem(null)
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
          <p className="sub-title">实时读取金山 AirScript 接口，支持搜索、类目筛选、标签选品、销量排序，并可导出当前筛选结果。</p>
        </div>
        <div className="actions">
          <button type="button" onClick={loadData} disabled={loading}>{loading ? '刷新中…' : '刷新数据'}</button>
          <button type="button" className="secondary" onClick={() => exportCsv(sortedItems)} disabled={!sortedItems.length} title="导出当前搜索、筛选和排序后的结果">导出当前结果</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <div><span>SPU 数</span><strong>{stats.spuCount}</strong></div>
        <div><span>SKC 数量</span><strong>{stats.skcCount}</strong></div>
        <div><span>有效 PID</span><strong>{stats.pidCount}</strong></div>
        <div><span>数据更新时间</span><strong className="updated-at">{updatedAt || '加载中'}</strong></div>
      </section>

      <section className={`agency-guide${guideCollapsed ? ' collapsed' : ''}`}>
        <div className="agency-guide-title">
          <span>机构选品建议</span>
          <strong>优先带货参考</strong>
        </div>
        {!guideCollapsed && (
          <div className="agency-guide-tips">
            <span>优先看「爆款」「稳定出单」「潜力新品」</span>
            <span>点击 SPU 查看同款所有 SKC</span>
            <span>点击图片预览大图，点击 PID 快速复制</span>
            <span>推荐标签按销量、上架天数和 PID 覆盖自动计算</span>
            <span>加入「选品篮」后可统一导出或复制推广信息</span>
          </div>
        )}
        <button className="section-toggle" type="button" onClick={() => setGuideCollapsed((current) => !current)}>
          {guideCollapsed ? '展开' : '收起'}
        </button>
      </section>

      <section className={`tag-rule-panel${rulesCollapsed ? ' collapsed' : ''}`}>
        <div>
          <span>推荐标签规则</span>
          <strong>自动计算，仅供选品参考</strong>
        </div>
        {!rulesCollapsed && (
          <ul>
            {TAG_ORDER.map((name) => (
              <li key={name}>
                <span className={`pick-tag ${TAG_TONES[name]}`}>{name}</span>
                <em>{TAG_DESCRIPTIONS[name]}</em>
              </li>
            ))}
          </ul>
        )}
        <button className="section-toggle" type="button" onClick={() => setRulesCollapsed((current) => !current)}>
          {rulesCollapsed ? '展开' : '收起'}
        </button>
      </section>

      <section className="basket-bar">
        <div>
          <span>选品篮</span>
          <strong>已选 {selectedItems.length} 款</strong>
        </div>
        <div className="basket-actions">
          <button
            type="button"
            className={`secondary${showSelectedOnly ? ' active' : ''}`}
            disabled={!selectedItems.length}
            onClick={() => {
              setShowSelectedOnly((current) => !current)
              setCurrentPage(1)
            }}
          >
            {showSelectedOnly ? '查看全部' : '只看已选'}
          </button>
          <button type="button" className="secondary" disabled={!selectedItems.length} onClick={() => exportCsv(selectedItems)}>导出已选</button>
          <button type="button" disabled={!selectedItems.length} onClick={handleCopySelectedPitch}>{copiedPid === 'selected:pitch' ? '已复制' : '复制已选话术'}</button>
          <button
            type="button"
            className="basket-clear"
            disabled={!selectedItems.length}
            onClick={() => {
              setSelectedIds(new Set())
              setShowSelectedOnly(false)
              setCurrentPage(1)
            }}
          >
            清空
          </button>
        </div>
      </section>

      <section className="toolbar">
        <label>
          <span>搜索</span>
          <div className="search-field">
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="SPU / SKC / 款号 / 颜色"
            />
            {keyword && (
              <button
                type="button"
                className="clear-search"
                onClick={() => {
                  setKeyword('')
                  setCurrentPage(1)
                }}
                aria-label="清空搜索"
                title="清空搜索"
              >
                ×
              </button>
            )}
          </div>
        </label>
        <label>
          <span>类目</span>
          <div className="select-field">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setCurrentPage(1)
              }}
            >
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            {category !== '全部' && (
              <button
                type="button"
                className="clear-filter"
                onClick={() => {
                  setCategory('全部')
                  setCurrentPage(1)
                }}
                aria-label="清空类目筛选"
                title="清空类目筛选"
              >
                ×
              </button>
            )}
          </div>
        </label>
        <div className="tag-filter-field">
          <span>推荐标签</span>
          <div className="tag-filter-list">
            {tagOptions.map((name) => (
              <button
                type="button"
                className={`tag-filter-chip ${TAG_TONES[name] || 'all'}${tagFilter === name ? ' active' : ''}`}
                key={name}
                onClick={() => {
                  setTagFilter((current) => (current === name && name !== '全部' ? '全部' : name))
                  setCurrentPage(1)
                }}
              >
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
        {isPending && <div className="sort-pending">排序处理中…</div>}
      </section>

      <section className="table-card">
        <div className="table-meta">
          <span>共 {items.length} 条数据，筛选后 {sortedItems.length} 条，当前展示 {sortedItems.length ? pageStart + 1 : 0}-{pageEnd} 条；导出会包含当前筛选结果</span>
          <div className="pagination">
            <button type="button" className="secondary" onClick={() => handlePageChange(safeCurrentPage - 1)} disabled={safeCurrentPage <= 1}>上一页</button>
            <strong>{safeCurrentPage} / {totalPages}</strong>
            <button type="button" className="secondary" onClick={() => handlePageChange(safeCurrentPage + 1)} disabled={safeCurrentPage >= totalPages}>下一页</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>选品篮</th>
                <th>图片</th>
                <th>SPU / SKC</th>
                <th>款号</th>
                <th>颜色</th>
                <th>类目</th>
                <th>推荐标签</th>
                <th>{renderSortableHeader('daysOnline')}</th>
                <th>{renderSortableHeader('sales7')}</th>
                <th>{renderSortableHeader('sales30')}</th>
                <th>一键复制</th>
                <th>各站 PID</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr><td colSpan={12} className="empty">正在加载货盘数据…</td></tr>
              ) : pageItems.length ? pageItems.map((item) => {
                const rowCopiedPid = Object.values(item.pids).includes(copiedPid) ? copiedPid : ''
                return <CargoRow copiedPid={rowCopiedPid || (copiedPid === `pitch:${item.id}` ? copiedPid : '')} isSelected={validSelectedIds.has(item.id)} isSpuFiltered={keyword.trim() === item.spu} item={item} key={item.id} onCopyPitch={handleCopyPitch} onCopyPid={handleCopyPid} onPreviewImage={setPreviewItem} onSearchSpu={handleSearchSpu} onToggleSelection={handleToggleSelection} />
              }) : (
                <tr><td colSpan={12} className="empty">没有匹配的数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {previewItem && (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label="商品图片预览" onClick={closeImagePreview}>
          <div className="image-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="image-modal-header">
              <div>
                <strong>{previewItem.styleNo || previewItem.spu || '商品图片'}</strong>
                <span>{previewItem.spu || '-'} / {previewItem.skcId || '-'}</span>
              </div>
              <button type="button" className="image-modal-close" onClick={closeImagePreview} aria-label="关闭预览">×</button>
            </div>
            <div className="image-modal-body">
              <img src={previewItem.imageLink} alt={previewItem.styleNo || previewItem.spu || '商品图片'} />
            </div>
            <div className="image-modal-footer">
              <a href={previewItem.imageLink} target="_blank" rel="noreferrer">打开原图</a>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
