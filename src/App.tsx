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
type Language = 'zh' | 'en'

const STORE_NAME = 'TTS-烛照'
const DISPLAY_NAME = 'TTS-Chic NVF'
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

const MARKET_LABELS: Record<Language, Record<string, string>> = {
  zh: {
    'PID-US（美国）': 'US 美国',
    'PID-GB（英国）': 'GB 英国',
    'PID-DE（德国）': 'DE 德国',
    'PID-FR（法国）': 'FR 法国',
    'PID-ES（西班牙）': 'ES 西班牙',
    'PID-IT（意大利）': 'IT 意大利',
    'PID-MX（墨西哥）': 'MX 墨西哥',
    'PID-SA（沙特）': 'SA 沙特',
  },
  en: {
    'PID-US（美国）': 'US',
    'PID-GB（英国）': 'GB',
    'PID-DE（德国）': 'DE',
    'PID-FR（法国）': 'FR',
    'PID-ES（西班牙）': 'ES',
    'PID-IT（意大利）': 'IT',
    'PID-MX（墨西哥）': 'MX',
    'PID-SA（沙特）': 'SA',
  },
}

const SORT_LABELS: Record<Language, Record<SortKey, string>> = {
  zh: { sales30: '30天销量', sales7: '7天销量', daysOnline: '上架天数' },
  en: { sales30: '30-Day Sales', sales7: '7-Day Sales', daysOnline: 'Days Online' },
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
const TAG_LABELS: Record<string, Record<Language, string>> = {
  爆款: { zh: '爆款', en: 'Hot Seller' },
  稳定出单: { zh: '稳定出单', en: 'Stable Sales' },
  潜力新品: { zh: '潜力新品', en: 'New Potential' },
  多站点: { zh: '多站点', en: 'Multi-Market' },
  待观察: { zh: '待观察', en: 'Watch' },
}
const TAG_DESCRIPTIONS: Record<string, Record<Language, string>> = {
  爆款: { zh: '近7天销量较高，或近期销量动能明显', en: 'High 7-day sales or clear recent sales momentum' },
  稳定出单: { zh: '近30天销量稳定，且近7天仍有销量', en: 'Stable 30-day sales with recent 7-day orders' },
  潜力新品: { zh: '上架30天内，且近7天已有销量', en: 'Listed within 30 days and sold in the last 7 days' },
  多站点: { zh: `有效 PID 覆盖不少于 ${MIN_GOOD_PID_COUNT} 个站点`, en: `Valid PIDs cover at least ${MIN_GOOD_PID_COUNT} markets` },
  待观察: { zh: '暂未出现明显销量、上新或多站点覆盖信号', en: 'No clear sales, new-arrival, or multi-market signal yet' },
}
const TAG_ORDER = ['爆款', '稳定出单', '潜力新品', '多站点', '待观察']
const ALL_OPTION = '全部'
const BASKET_STORAGE_KEY = 'cargo-board:selected-items'
const GUIDE_COLLAPSED_STORAGE_KEY = 'cargo-board:guide-collapsed'
const RULES_COLLAPSED_STORAGE_KEY = 'cargo-board:rules-collapsed'
const LANGUAGE_STORAGE_KEY = 'cargo-board:language'


const TEXT = {
  zh: {
    lang: 'English', title: '货盘', subtitle: '实时读取金山 AirScript 接口，支持搜索、类目筛选、标签选品、销量排序，并可导出当前筛选结果。', refresh: '刷新数据', refreshing: '刷新中…', exportCurrent: '导出当前结果', exportTitle: '导出当前搜索、筛选和排序后的结果', spuCount: 'SPU 数', skcCount: 'SKC 数量', validPid: '有效 PID', updatedAt: '数据更新时间', loading: '加载中', guideTitle: '机构选品建议', guideStrong: '优先带货参考', guideTips: ['优先看「爆款」「稳定出单」「潜力新品」', '点击 SPU 查看同款所有 SKC', '点击图片预览大图，点击 PID 快速复制', '推荐标签按销量、上架天数和 PID 覆盖自动计算', '加入「选品篮」后可统一导出或复制推广信息'], expand: '展开', collapse: '收起', ruleTitle: '推荐标签规则', ruleStrong: '自动计算，仅供选品参考', basket: '选品篮', selectedPrefix: '已选 ', selectedSuffix: ' 款', viewAll: '查看全部', selectedOnly: '只看已选', exportSelected: '导出已选', copied: '已复制', copySelected: '复制已选话术', clear: '清空', search: '搜索', searchPlaceholder: 'SPU / SKC / 款号 / 颜色', clearSearch: '清空搜索', category: '类目', clearCategory: '清空类目筛选', pickTags: '推荐标签', sorting: '排序处理中…', meta: (total: number, filtered: number, start: number, end: number) => `共 ${total} 条数据，筛选后 ${filtered} 条，当前展示 ${start}-${end} 条；导出会包含当前筛选结果`, prev: '上一页', next: '下一页', image: '图片', styleNo: '款号', color: '颜色', daysOnline: '上架天数', oneCopy: '一键复制', marketPids: '各站 PID', loadingData: '正在加载货盘数据…', noMatch: '没有匹配的数据', previewLabel: '商品图片预览', productImage: '商品图片', closePreview: '关闭预览', openOriginal: '打开原图', imageBroken: '图片失效', noImage: '无图', addBasket: '加入选品篮', removeBasket: '移出选品篮', selected: '已选', add: '加入', preview: '预览大图', cancelSpu: '取消筛选 SPU：', filterSpu: '点击筛选该 SPU 下所有 SKC：', cancelFilter: '取消筛选', filter: '筛选', day: '天', sales7: '7天销量', sales30: '30天销量', copyPid: '点击复制 ', noPid: '暂无 PID', requestFailed: '接口请求失败：', loadFailed: '加载失败', clipboardError: '复制失败：浏览器没有开放剪贴板权限', desc: '倒序', asc: '正序', sortPrefix: '按', sortSuffix: '排序', pitchTitle: '货盘推荐', store: '店铺', imageLink: '图片链接', operator: '运营', fileSuffix: '货盘'
  },
  en: {
    lang: '中文', title: 'Cargo Board', subtitle: 'Reads the Kingsoft AirScript API in real time, with search, category filters, pick tags, sales sorting, and export for current results.', refresh: 'Refresh Data', refreshing: 'Refreshing…', exportCurrent: 'Export Current', exportTitle: 'Export current searched, filtered, and sorted results', spuCount: 'SPUs', skcCount: 'SKCs', validPid: 'Valid PIDs', updatedAt: 'Updated', loading: 'Loading', guideTitle: 'Agency Picking Guide', guideStrong: 'Priority references', guideTips: ['Prioritize Hot Seller, Stable Sales, and New Potential items', 'Click SPU to view all SKCs of the same style', 'Click image to preview; click PID to copy quickly', 'Pick tags are calculated from sales, days online, and PID coverage', 'Add items to Basket to export or copy pitches together'], expand: 'Expand', collapse: 'Collapse', ruleTitle: 'Pick Tag Rules', ruleStrong: 'Auto-calculated, for picking reference only', basket: 'Basket', selectedPrefix: 'Selected ', selectedSuffix: ' items', viewAll: 'View All', selectedOnly: 'Selected Only', exportSelected: 'Export Selected', copied: 'Copied', copySelected: 'Copy Selected Pitch', clear: 'Clear', search: 'Search', searchPlaceholder: 'SPU / SKC / Style No. / Color', clearSearch: 'Clear search', category: 'Category', clearCategory: 'Clear category filter', pickTags: 'Pick Tags', sorting: 'Sorting…', meta: (total: number, filtered: number, start: number, end: number) => `${total} records, ${filtered} after filtering, showing ${start}-${end}; export includes current filtered results`, prev: 'Prev', next: 'Next', image: 'Image', styleNo: 'Style No.', color: 'Color', daysOnline: 'Days Online', oneCopy: 'Copy Pitch', marketPids: 'Market PIDs', loadingData: 'Loading cargo data…', noMatch: 'No matching data', previewLabel: 'Product image preview', productImage: 'Product image', closePreview: 'Close preview', openOriginal: 'Open original', imageBroken: 'Image unavailable', noImage: 'No image', addBasket: 'Add to basket', removeBasket: 'Remove from basket', selected: 'Selected', add: 'Add', preview: 'Preview image', cancelSpu: 'Clear SPU filter: ', filterSpu: 'Filter all SKCs under SPU: ', cancelFilter: 'Clear', filter: 'Filter', day: 'd', sales7: '7-Day Sales', sales30: '30-Day Sales', copyPid: 'Copy ', noPid: 'No PID', requestFailed: 'API request failed: ', loadFailed: 'Load failed', clipboardError: 'Copy failed: clipboard permission is not available in this browser', desc: 'Desc', asc: 'Asc', sortPrefix: 'Sort by ', sortSuffix: '', pitchTitle: 'Cargo Recommendation', store: 'Store', imageLink: 'Image URL', operator: 'Operator', fileSuffix: 'cargo-board'
  },
} as const

function readSavedBoolean(key: string, fallback = false) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? fallback : raw === 'true'
  } catch {
    return fallback
  }
}

function readSavedLanguage(): Language {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
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

function tagLabel(label: string, language: Language) {
  return TAG_LABELS[label]?.[language] || label
}

function tagDescription(label: string, language: Language) {
  return TAG_DESCRIPTIONS[label]?.[language] || TAG_DESCRIPTIONS[label]?.zh || ''
}

function buildPitchText(item: CargoItem, language: Language) {
  const t = TEXT[language]
  const activePids = MARKET_KEYS
    .map((key) => ({ market: MARKET_LABELS[language][key], pid: item.pids[key] }))
    .filter(({ pid }) => pid && pid !== '-')
    .map(({ market, pid }) => `${market}: ${pid}`)

  return [
    `【${DISPLAY_NAME} ${t.pitchTitle}】`,
    `SPU: ${item.spu || '-'}`,
    `SKC: ${item.skcId || '-'}`,
    `${t.styleNo}: ${item.styleNo || '-'}`,
    `${t.color}: ${item.color || '-'}`,
    `${t.category}: ${item.leafCategory || item.category || '-'}`,
    `${t.pickTags}: ${item.pickTags.map((tag) => tagLabel(tag.label, language)).join(' / ')}`,
    `${t.daysOnline}: ${item.daysOnline ? `${item.daysOnline}${t.day}` : '-'}`,
    `${t.sales7}: ${item.sales7}`,
    `${t.sales30}: ${item.sales30}`,
    activePids.length ? `${t.marketPids}:\n${activePids.join('\n')}` : `${t.marketPids}: ${t.noPid}`,
    item.imageLink ? `${t.image}: ${item.imageLink}` : '',
  ].filter(Boolean).join('\n')
}

function exportCsv(items: CargoItem[], language: Language) {
  const t = TEXT[language]
  const headers = [t.store, t.imageLink, 'SPU', 'SKC ID', t.styleNo, t.color, t.category, t.pickTags, t.operator, t.daysOnline, t.sales7, t.sales30, ...MARKET_KEYS.map((key) => MARKET_LABELS[language][key])]
  const rows = items.map((item) => [
    item.store,
    item.imageLink,
    item.spu,
    item.skcId,
    item.styleNo,
    item.color,
    item.category,
    item.pickTags.map((tag) => tagLabel(tag.label, language)).join(' / '),
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
  a.download = `${DISPLAY_NAME}-${t.fileSuffix}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type CargoRowProps = {
  item: CargoItem
  copiedPid: string
  isSelected: boolean
  isSpuFiltered: boolean
  language: Language
  text: (typeof TEXT)[Language]
  onCopyPitch: (item: CargoItem) => void
  onCopyPid: (pid: string) => void
  onPreviewImage: (item: CargoItem) => void
  onSearchSpu: (spu: string) => void
  onToggleSelection: (id: string) => void
}

type ImageThumbProps = {
  src: string
  alt: string
  fallback: string
}

const ImageThumb = memo(function ImageThumb({ src, alt, fallback }: ImageThumbProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className="image-fallback">{fallback}</span>
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

const CargoRow = memo(function CargoRow({ item, copiedPid, isSelected, isSpuFiltered, language, text: t, onCopyPitch, onCopyPid, onPreviewImage, onSearchSpu, onToggleSelection }: CargoRowProps) {
  return (
    <tr className={isSelected ? 'selected-row' : ''}>
      <td className="basket-cell" data-label={t.basket}>
        <button
          className={`basket-toggle${isSelected ? ' active' : ''}`}
          type="button"
          onClick={() => onToggleSelection(item.id)}
          title={isSelected ? t.removeBasket : t.addBasket}
        >
          {isSelected ? t.selected : t.add}
        </button>
      </td>
      <td className="image-cell" data-label={t.image}>
        {item.imageLink ? (
          <button className="image-preview-trigger" type="button" onClick={() => onPreviewImage(item)} title={t.preview}>
            <ImageThumb key={item.imageLink} src={item.imageLink} alt={item.styleNo || item.spu || t.productImage} fallback={t.imageBroken} />
          </button>
        ) : <span className="no-image">{t.noImage}</span>}
      </td>
      <td data-label="SPU / SKC">
        {item.spu ? (
          <button
            className={`spu-link${isSpuFiltered ? ' active' : ''}`}
            type="button"
            onClick={() => onSearchSpu(item.spu)}
            title={isSpuFiltered ? `${t.cancelSpu}${item.spu}` : `${t.filterSpu}${item.spu}`}
          >
            <span>{item.spu}</span>
            <em>{isSpuFiltered ? t.cancelFilter : t.filter}</em>
          </button>
        ) : <strong>-</strong>}
        <small>{item.skcId || '-'}</small>
      </td>
      <td data-label={t.styleNo}>{item.styleNo || '-'}</td>
      <td data-label={t.color}>{item.color || '-'}</td>
      <td className="category" data-label={t.category} title={item.category}>{item.leafCategory || '-'}</td>
      <td className="pick-tags" data-label={t.pickTags}>
        {item.pickTags.map((tag) => <span className={`pick-tag ${tag.tone}`} key={tag.label} title={tagDescription(tag.label, language)}>{tagLabel(tag.label, language)}</span>)}
      </td>
      <td data-label={t.daysOnline}>{item.daysOnline ? `${item.daysOnline}${t.day}` : '-'}</td>
      <td className={item.sales7 > 0 ? 'sales hot' : 'sales'} data-label={t.sales7}>{item.sales7}</td>
      <td className={item.sales30 > 0 ? 'sales hot' : 'sales'} data-label={t.sales30}>{item.sales30}</td>
      <td className="pitch-cell" data-label={t.oneCopy}>
        <button className={`pitch-copy${copiedPid === `pitch:${item.id}` ? ' copied' : ''}`} type="button" onClick={() => onCopyPitch(item)}>
          {copiedPid === `pitch:${item.id}` ? t.copied : t.oneCopy}
        </button>
      </td>
      <td className="pid-list" data-label={t.marketPids}>
        {MARKET_KEYS.map((key) => {
          const pid = item.pids[key]
          const canCopy = Boolean(pid && pid !== '-')
          return (
            <button
              className={`pid-chip${canCopy ? '' : ' muted'}${copiedPid === pid ? ' copied' : ''}`}
              disabled={!canCopy}
              key={key}
              onClick={() => onCopyPid(pid)}
              title={canCopy ? `${t.copyPid}${pid}` : t.noPid}
              type="button"
            >
              {MARKET_LABELS[language][key]}: {pid}
              {copiedPid === pid && <em>{t.copied}</em>}
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
  const [rulesCollapsed, setRulesCollapsed] = useState(() => readSavedBoolean(RULES_COLLAPSED_STORAGE_KEY, true))
  const [sortBy, setSortBy] = useState<SortKey>('sales7')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [copiedPid, setCopiedPid] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(readSavedSelectedIds)
  const [previewItem, setPreviewItem] = useState<CargoItem | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [language, setLanguage] = useState<Language>(readSavedLanguage)
  const [isPending, startTransition] = useTransition()
  const t = TEXT[language]

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cargo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Context: { argv: { store_name: STORE_NAME } } }),
      })
      if (!response.ok) throw new Error(`${t.requestFailed}${response.status}`)
      const payload = await response.json()
      const list = (payload?.data?.result || []) as RawRecord[]
      setItems(list.map(normalizeRecord))
      setUpdatedAt(new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date()))
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [language, t.loadFailed, t.requestFailed])

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

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  const validSelectedIds = useMemo(() => {
    if (!items.length) return selectedIds

    const itemIds = new Set(items.map((item) => item.id))
    return new Set(Array.from(selectedIds).filter((id) => itemIds.has(id)))
  }, [items, selectedIds])

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.leafCategory).filter(Boolean))
    return [ALL_OPTION, ...Array.from(set).sort((a, b) => a.localeCompare(b, language === 'zh' ? 'zh-Hans-CN' : 'en-US'))]
  }, [items, language])

  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => {
      item.pickTags.forEach((tag) => set.add(tag.label))
    })
    const extraTags = Array.from(set)
      .filter((tag) => !TAG_ORDER.includes(tag))
      .sort((a, b) => tagLabel(a, language).localeCompare(tagLabel(b, language), language === 'zh' ? 'zh-Hans-CN' : 'en-US'))
    return [ALL_OPTION, ...TAG_ORDER, ...extraTags]
  }, [items, language])

  const filteredItems = useMemo(() => {
    const key = keyword.trim().toLowerCase()
    return items.filter((item) => {
      const inCategory = category === ALL_OPTION || item.leafCategory === category
      const inTag = tagFilter === ALL_OPTION || item.pickTags.some((tag) => tag.label === tagFilter)
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
      await navigator.clipboard.writeText(selectedItems.map((item) => buildPitchText(item, language)).join('\n\n---\n\n'))
      setCopiedPid('selected:pitch')
      window.setTimeout(() => setCopiedPid((current) => (current === 'selected:pitch' ? '' : current)), 1200)
    } catch {
      setError(t.clipboardError)
    }
  }, [language, selectedItems, t.clipboardError])

  const handleCopyPitch = useCallback(async (item: CargoItem) => {
    try {
      await navigator.clipboard.writeText(buildPitchText(item, language))
      setCopiedPid(`pitch:${item.id}`)
      window.setTimeout(() => setCopiedPid((current) => (current === `pitch:${item.id}` ? '' : current)), 1200)
    } catch {
      setError(t.clipboardError)
    }
  }, [language, t.clipboardError])

  const handleCopyPid = useCallback(async (pid: string) => {
    if (!pid || pid === '-') return

    try {
      await navigator.clipboard.writeText(pid)
      setCopiedPid(pid)
      window.setTimeout(() => setCopiedPid((current) => (current === pid ? '' : current)), 1200)
    } catch {
      setError(t.clipboardError)
    }
  }, [t.clipboardError])

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
    const directionLabel = sortDirection === 'desc' ? t.desc : t.asc
    return (
      <button
        type="button"
        className={`sort-header${active ? ' active' : ''}`}
        onClick={() => handleSortChange(value)}
        aria-sort={active ? (sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
        title={`${t.sortPrefix}${SORT_LABELS[language][value]}${nextDirection === 'desc' ? t.desc : t.asc}${t.sortSuffix}`}
      >
        {SORT_LABELS[language][value]}
        <span aria-hidden="true">{active ? (sortDirection === 'desc' ? '↓' : '↑') : '↕'}</span>
        {active && <em>{directionLabel}</em>}
      </button>
    )
  }

  return (
    <main className="page">
      <header className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker">
            <p className="eyebrow">Cargo Board</p>
            <button type="button" className="language-toggle" onClick={() => setLanguage((current) => (current === 'zh' ? 'en' : 'zh'))} aria-label="Switch language">
              <span className={language === 'zh' ? 'active' : ''}>中</span>
              <i aria-hidden="true" />
              <span className={language === 'en' ? 'active' : ''}>EN</span>
            </button>
          </div>
          <h1>{DISPLAY_NAME} {t.title}</h1>
          <p className="sub-title">{t.subtitle}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={loadData} disabled={loading}>{loading ? t.refreshing : t.refresh}</button>
          <button type="button" className="secondary" onClick={() => exportCsv(sortedItems, language)} disabled={!sortedItems.length} title={t.exportTitle}>{t.exportCurrent}</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats-grid">
        <div><span>{t.spuCount}</span><strong>{stats.spuCount}</strong></div>
        <div><span>{t.skcCount}</span><strong>{stats.skcCount}</strong></div>
        <div><span>{t.validPid}</span><strong>{stats.pidCount}</strong></div>
        <div><span>{t.updatedAt}</span><strong className="updated-at">{updatedAt || t.loading}</strong></div>
      </section>

      <section className={`agency-guide${guideCollapsed ? ' collapsed' : ''}`}>
        <div className="agency-guide-title">
          <span>{t.guideTitle}</span>
          <strong>{t.guideStrong}</strong>
        </div>
        {!guideCollapsed && (
          <div className="agency-guide-tips">
            {t.guideTips.map((tip) => <span key={tip}>{tip}</span>)}
          </div>
        )}
        <button className="section-toggle" type="button" onClick={() => setGuideCollapsed((current) => !current)}>
          {guideCollapsed ? t.expand : t.collapse}
        </button>
      </section>

      <section className={`tag-rule-panel${rulesCollapsed ? ' collapsed' : ''}`}>
        <div>
          <span>{t.ruleTitle}</span>
          <strong>{t.ruleStrong}</strong>
        </div>
        {!rulesCollapsed && (
          <ul>
            {TAG_ORDER.map((name) => (
              <li key={name}>
                <span className={`pick-tag ${TAG_TONES[name]}`}>{tagLabel(name, language)}</span>
                <em>{tagDescription(name, language)}</em>
              </li>
            ))}
          </ul>
        )}
        <button className="section-toggle" type="button" onClick={() => setRulesCollapsed((current) => !current)}>
          {rulesCollapsed ? t.expand : t.collapse}
        </button>
      </section>

      <section className="basket-bar">
        <div>
          <span>{t.basket}</span>
          <strong>{t.selectedPrefix}{selectedItems.length}{t.selectedSuffix}</strong>
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
            {showSelectedOnly ? t.viewAll : t.selectedOnly}
          </button>
          <button type="button" className="secondary" disabled={!selectedItems.length} onClick={() => exportCsv(selectedItems, language)}>{t.exportSelected}</button>
          <button type="button" disabled={!selectedItems.length} onClick={handleCopySelectedPitch}>{copiedPid === 'selected:pitch' ? t.copied : t.copySelected}</button>
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
            {t.clear}
          </button>
        </div>
      </section>

      <section className="toolbar">
        <label>
          <span>{t.search}</span>
          <div className="search-field">
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value)
                setCurrentPage(1)
              }}
              placeholder={t.searchPlaceholder}
            />
            {keyword && (
              <button
                type="button"
                className="clear-search"
                onClick={() => {
                  setKeyword('')
                  setCurrentPage(1)
                }}
                aria-label={t.clearSearch}
                title={t.clearSearch}
              >
                ×
              </button>
            )}
          </div>
        </label>
        <label>
          <span>{t.category}</span>
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
            {category !== ALL_OPTION && (
              <button
                type="button"
                className="clear-filter"
                onClick={() => {
                  setCategory(ALL_OPTION)
                  setCurrentPage(1)
                }}
                aria-label={t.clearCategory}
                title={t.clearCategory}
              >
                ×
              </button>
            )}
          </div>
        </label>
        <div className="tag-filter-field">
          <span>{t.pickTags}</span>
          <div className="tag-filter-list">
            {tagOptions.map((name) => (
              <button
                type="button"
                className={`tag-filter-chip ${TAG_TONES[name] || 'all'}${tagFilter === name ? ' active' : ''}`}
                key={name}
                onClick={() => {
                  setTagFilter((current) => (current === name && name !== ALL_OPTION ? ALL_OPTION : name))
                  setCurrentPage(1)
                }}
              >
                <span>{name === ALL_OPTION ? (language === 'zh' ? '全部' : 'All') : tagLabel(name, language)}</span>
              </button>
            ))}
          </div>
        </div>
        {isPending && <div className="sort-pending">{t.sorting}</div>}
      </section>

      <section className="table-card">
        <div className="table-meta">
          <span>{t.meta(items.length, sortedItems.length, sortedItems.length ? pageStart + 1 : 0, pageEnd)}</span>
          <div className="pagination">
            <button type="button" className="secondary" onClick={() => handlePageChange(safeCurrentPage - 1)} disabled={safeCurrentPage <= 1}>{t.prev}</button>
            <strong>{safeCurrentPage} / {totalPages}</strong>
            <button type="button" className="secondary" onClick={() => handlePageChange(safeCurrentPage + 1)} disabled={safeCurrentPage >= totalPages}>{t.next}</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.basket}</th>
                <th>{t.image}</th>
                <th>SPU / SKC</th>
                <th>{t.styleNo}</th>
                <th>{t.color}</th>
                <th>{t.category}</th>
                <th>{t.pickTags}</th>
                <th>{renderSortableHeader('daysOnline')}</th>
                <th>{renderSortableHeader('sales7')}</th>
                <th>{renderSortableHeader('sales30')}</th>
                <th>{t.oneCopy}</th>
                <th>{t.marketPids}</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr><td colSpan={12} className="empty">{t.loadingData}</td></tr>
              ) : pageItems.length ? pageItems.map((item) => {
                const rowCopiedPid = Object.values(item.pids).includes(copiedPid) ? copiedPid : ''
                return <CargoRow copiedPid={rowCopiedPid || (copiedPid === `pitch:${item.id}` ? copiedPid : '')} isSelected={validSelectedIds.has(item.id)} isSpuFiltered={keyword.trim() === item.spu} item={item} key={item.id} language={language} text={t} onCopyPitch={handleCopyPitch} onCopyPid={handleCopyPid} onPreviewImage={setPreviewItem} onSearchSpu={handleSearchSpu} onToggleSelection={handleToggleSelection} />
              }) : (
                <tr><td colSpan={12} className="empty">{t.noMatch}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {previewItem && (
        <div className="image-modal" role="dialog" aria-modal="true" aria-label={t.previewLabel} onClick={closeImagePreview}>
          <div className="image-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="image-modal-header">
              <div>
                <strong>{previewItem.styleNo || previewItem.spu || t.productImage}</strong>
                <span>{previewItem.spu || '-'} / {previewItem.skcId || '-'}</span>
              </div>
              <button type="button" className="image-modal-close" onClick={closeImagePreview} aria-label={t.closePreview}>×</button>
            </div>
            <div className="image-modal-body">
              <img src={previewItem.imageLink} alt={previewItem.styleNo || previewItem.spu || t.productImage} />
            </div>
            <div className="image-modal-footer">
              <a href={previewItem.imageLink} target="_blank" rel="noreferrer">{t.openOriginal}</a>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
