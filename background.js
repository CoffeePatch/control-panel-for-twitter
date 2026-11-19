import { get, SERVER_ORIGIN, set } from './shared/settings.js'
import { initSettingsSync, startSync } from './shared/settings-background.js'
import { isObject } from './shared/settings-schema.js'
import { crossesVersionThreshold } from './shared/version.js'

import { runSettingsMigrations, scheduleSettingsMigrations } from './migrations.js'

//#region Constants
const DISABLED_ICONS = {
  16: 'icons/icon16-disabled.png',
  32: 'icons/icon32-disabled.png',
  48: 'icons/icon48-disabled.png',
  64: 'icons/icon64-disabled.png',
  96: 'icons/icon96-disabled.png',
  128: 'icons/icon128-disabled.png',
}
const ENABLED_ICONS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  64: 'icons/icon64.png',
  96: 'icons/icon96.png',
  128: 'icons/icon128.png',
}
const IS_PRO = Number(chrome.runtime.getManifest().version.split('.')[0]) >= 5
const IS_SAFARI = location.protocol.startsWith('safari-web-extension:')
//#endregion

//#region Functions
function updateToolbarIcon(enabled) {
  const title = chrome.i18n.getMessage(enabled ? 'extensionName' : 'extensionNameDisabled')
  if (chrome.runtime.getManifest().manifest_version == 3) {
    chrome.action.setTitle({ title })
    if (!IS_SAFARI) {
      chrome.action.setIcon({ path: enabled ? ENABLED_ICONS : DISABLED_ICONS })
    } else {
      chrome.action.setBadgeText({ text: enabled ? '' : '⏻' })
    }
  } else {
    chrome.browserAction.setTitle({ title })
    chrome.browserAction.setIcon({ path: enabled ? ENABLED_ICONS : DISABLED_ICONS })
  }
}
//#endregion

//#region Main
let startupTask = Promise.resolve()
let migrationsCompletedThisStartup = false

/** @param {chrome.runtime.InstalledDetails} [details] */
function main(details) {
  const task = startupTask.then(async () => {
    const currentVersion = chrome.runtime.getManifest().version
    if (details?.reason == 'install') {
      const { settings } = await get('settings')
      if (!isObject(settings)) await set({ settings: {} })
    } else if (details?.reason == 'update' && !migrationsCompletedThisStartup) {
      await scheduleSettingsMigrations(details.previousVersion, currentVersion)
    }
    if (await runSettingsMigrations(currentVersion)) migrationsCompletedThisStartup = true
    const { pendingStorageMigration } = await get('pendingStorageMigration')
    if (pendingStorageMigration) return
    if (IS_PRO) await startSync()
  })
  startupTask = task.catch(() => {})
  return task
}

initSettingsSync({ apiBase: SERVER_ORIGIN, proEnabled: IS_PRO })
const startup = main().catch((error) => {
  console.error('[background]', error)
})

chrome.storage.local.get({ enabled: true }, ({ enabled }) => {
  updateToolbarIcon(enabled)
})

chrome.runtime.onInstalled.addListener((details) => {
  const startup = main(details)
  startup.catch((error) => console.error('[background]', error))
  if (details.reason == 'install') {
    chrome.tabs.create({
      url: 'https://soitis.dev/control-panel-for-twitter/welcome',
    })
  } else if (details.reason == 'update') {
    const previous = details.previousVersion
    const current = chrome.runtime.getManifest().version
    const significantVersions = [crossesVersionThreshold(previous, current, '5') && '5'].filter(
      Boolean,
    )
    if (significantVersions.length > 0) {
      chrome.tabs.create({
        url: `https://soitis.dev/control-panel-for-twitter/updated?version=${significantVersions[0]}`,
        active: false,
      })
    }
  }
  return startup
})

chrome.runtime.onStartup.addListener(() => {
  // Wake the background at browser startup without running main() twice
  return startup
})

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.enabled) {
    updateToolbarIcon(changes.enabled.newValue)
  }
})

// Listen for download requests and tab opening from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'DOWNLOAD_MEDIA') {
    handleDownloadMedia(message, sendResponse)
    return true
  }
  if (message?.type === 'OPEN_TAB') {
    handleOpenTab(message, sender)
  }
})

function handleOpenTab(message, sender) {
  const { url, active = false } = message
  if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
    return
  }
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (
      host !== 'twitter.com' &&
      !host.endsWith('.twitter.com') &&
      host !== 'x.com' &&
      !host.endsWith('.x.com')
    ) {
      console.warn('[CPFT] Unauthorized open tab host:', host)
      return
    }
    /** @type {chrome.tabs.CreateProperties} */
    const createProperties = { url, active: Boolean(active) }
    if (sender?.tab?.id) {
      createProperties.openerTabId = sender.tab.id
    }
    chrome.tabs.create(createProperties)
  } catch (e) {
    console.error('[CPFT] Error opening tab:', e)
  }
}

// Pending downloads tracking for filename determination enforcement
/**
 * @typedef {Object} PendingDownloadEntry
 * @property {string} url
 * @property {string} fullPath
 * @property {number} timestamp
 * @property {(response: any) => void} sendResponse
 * @property {number} [downloadId]
 * @property {boolean} [determined]
 * @property {boolean} [timedOut]
 * @property {any} [watchdogTimer]
 */

/** @type {Map<string, { inFlight: PendingDownloadEntry | null, timedOut: PendingDownloadEntry[], queue: PendingDownloadEntry[] }>} */
const downloadQueuesByUrl = new Map()

/** @type {Map<number, PendingDownloadEntry>} */
const pendingDownloadsById = new Map()

const hasOnDeterminingFilenameSupport =
  typeof chrome !== 'undefined' &&
  typeof chrome.downloads?.onDeterminingFilename?.addListener === 'function'

function cleanupStalePendingDownloads() {
  const now = Date.now()
  for (const [url, urlState] of downloadQueuesByUrl.entries()) {
    if (urlState.inFlight && now - urlState.inFlight.timestamp >= 60000) {
      if (urlState.inFlight.watchdogTimer) clearTimeout(urlState.inFlight.watchdogTimer)
      urlState.inFlight = null
    }
    if (urlState.timedOut) {
      urlState.timedOut = urlState.timedOut.filter((e) => now - e.timestamp < 60000)
    }
    urlState.queue = urlState.queue.filter((e) => now - e.timestamp < 60000)
    if (
      !urlState.inFlight &&
      (!urlState.timedOut || urlState.timedOut.length === 0) &&
      urlState.queue.length === 0
    ) {
      downloadQueuesByUrl.delete(url)
    }
  }
  for (const [id, entry] of pendingDownloadsById.entries()) {
    if (now - entry.timestamp >= 60000) {
      pendingDownloadsById.delete(id)
    }
  }
}

function advanceUrlQueue(url, completedEntry) {
  const urlState = downloadQueuesByUrl.get(url)
  if (!urlState) return

  if (completedEntry) {
    if (urlState.inFlight === completedEntry) {
      urlState.inFlight = null
    } else if (urlState.timedOut) {
      const idx = urlState.timedOut.indexOf(completedEntry)
      if (idx !== -1) {
        urlState.timedOut.splice(idx, 1)
      }
    }
  } else {
    urlState.inFlight = null
  }

  if (!urlState.inFlight && urlState.queue.length > 0) {
    const nextEntry = urlState.queue.shift()
    if (nextEntry) startDownloadEntry(urlState, nextEntry)
  } else if (!urlState.inFlight && (!urlState.timedOut || urlState.timedOut.length === 0)) {
    downloadQueuesByUrl.delete(url)
  }
}

const WATCHDOG_TIMEOUT_MS = 15000

function startDownloadEntry(urlState, entry) {
  urlState.inFlight = entry

  entry.watchdogTimer = setTimeout(() => {
    if (urlState.inFlight === entry && !entry.determined) {
      entry.timedOut = true
      if (!urlState.timedOut) {
        urlState.timedOut = []
      }
      urlState.timedOut.push(entry)
      urlState.inFlight = null
      advanceUrlQueue(entry.url, entry)
    }
  }, WATCHDOG_TIMEOUT_MS)

  chrome.downloads.download(
    {
      url: entry.url,
      filename: entry.fullPath,
      conflictAction: 'uniquify',
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer)
        console.error('Download failed:', chrome.runtime.lastError.message)
        if (entry.downloadId) {
          pendingDownloadsById.delete(entry.downloadId)
        }
        entry.sendResponse({ success: false, error: chrome.runtime.lastError.message })
        advanceUrlQueue(entry.url, entry)
        return
      }

      entry.downloadId = downloadId
      if (!entry.determined) {
        pendingDownloadsById.set(downloadId, entry)
      } else {
        pendingDownloadsById.delete(downloadId)
      }

      entry.sendResponse({ success: true, downloadId })

      if (!hasOnDeterminingFilenameSupport) {
        if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer)
        advanceUrlQueue(entry.url, entry)
      }
    },
  )
}

if (
  typeof chrome !== 'undefined' &&
  typeof chrome.downloads?.onCreated?.addListener === 'function'
) {
  chrome.downloads.onCreated.addListener((item) => {
    try {
      if (!chrome.runtime?.id || item.byExtensionId !== chrome.runtime.id) return
      if (!item.id || !item.url) return

      const urlState = downloadQueuesByUrl.get(item.url)
      if (urlState?.inFlight && !urlState.inFlight.downloadId) {
        urlState.inFlight.downloadId = item.id
        if (!urlState.inFlight.determined) {
          pendingDownloadsById.set(item.id, urlState.inFlight)
        }
      }
    } catch (e) {
      console.error('[CPFT] Error in onCreated listener:', e)
    }
  })
}

if (hasOnDeterminingFilenameSupport) {
  chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    let suggested = false
    function safeSuggest(suggestion) {
      if (suggested) return
      suggested = true
      try {
        if (suggestion) {
          suggest(suggestion)
        } else {
          suggest()
        }
      } catch (e) {
        console.error('[CPFT] Error calling suggest:', e)
      }
    }

    try {
      if (!chrome.runtime?.id || item.byExtensionId !== chrome.runtime.id) {
        safeSuggest()
        return
      }

      if (item.id && pendingDownloadsById.has(item.id)) {
        const entry = pendingDownloadsById.get(item.id)
        pendingDownloadsById.delete(item.id)
        if (entry) {
          entry.determined = true
          if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer)
          advanceUrlQueue(entry.url, entry)
          if (entry.fullPath) {
            safeSuggest({ filename: entry.fullPath, conflictAction: 'uniquify' })
            return
          }
        }
      }

      const urlState = downloadQueuesByUrl.get(item.url)
      if (urlState) {
        if (urlState.timedOut && urlState.timedOut.length > 0) {
          const timedOutIdx = urlState.timedOut.findIndex(
            (e) => e.downloadId && item.id === e.downloadId,
          )
          if (timedOutIdx !== -1) {
            const timedEntry = urlState.timedOut.splice(timedOutIdx, 1)[0]
            timedEntry.determined = true
            if (timedEntry.downloadId) {
              pendingDownloadsById.delete(timedEntry.downloadId)
            }
            if (
              urlState.timedOut.length === 0 &&
              !urlState.inFlight &&
              urlState.queue.length === 0
            ) {
              downloadQueuesByUrl.delete(item.url)
            }
            safeSuggest({ filename: timedEntry.fullPath, conflictAction: 'uniquify' })
            return
          }
        }

        if (urlState.inFlight) {
          const entry = urlState.inFlight
          let isMatch = true
          if (urlState.timedOut && urlState.timedOut.length > 0) {
            if (urlState.timedOut.some((e) => e.downloadId && item.id === e.downloadId)) {
              isMatch = false
            }
          }

          if (isMatch) {
            entry.determined = true
            if (entry.watchdogTimer) clearTimeout(entry.watchdogTimer)
            if (entry.downloadId) {
              pendingDownloadsById.delete(entry.downloadId)
            }
            advanceUrlQueue(item.url, entry)
            safeSuggest({ filename: entry.fullPath, conflictAction: 'uniquify' })
            return
          }
        }
      }

      safeSuggest()
    } catch (err) {
      console.error('[CPFT] Error in onDeterminingFilename:', err)
      safeSuggest()
    }
  })
}

if (
  typeof chrome !== 'undefined' &&
  typeof chrome.downloads?.onErased?.addListener === 'function'
) {
  chrome.downloads.onErased.addListener((downloadId) => {
    pendingDownloadsById.delete(downloadId)
  })
}

function handleDownloadMedia(message, sendResponse) {
  const { url, filename, subfolder } = message
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    sendResponse({ success: false, error: 'Invalid media URL' })
    return
  }

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (
      host !== 'twimg.com' &&
      !host.endsWith('.twimg.com') &&
      host !== 'twitter.com' &&
      !host.endsWith('.twitter.com') &&
      host !== 'x.com' &&
      !host.endsWith('.x.com')
    ) {
      sendResponse({ success: false, error: `Unauthorized download host: ${host}` })
      return
    }
  } catch {
    sendResponse({ success: false, error: 'Invalid URL structure' })
    return
  }

  const safeFilename = sanitizeFilename(filename)
  const safeSubfolder = sanitizeSubfolder(subfolder)
  const fullPath = safeSubfolder ? `${safeSubfolder}/${safeFilename}` : safeFilename

  cleanupStalePendingDownloads()

  const entry = {
    url,
    fullPath,
    timestamp: Date.now(),
    sendResponse,
    determined: false,
  }

  let urlState = downloadQueuesByUrl.get(url)
  if (!urlState) {
    urlState = { inFlight: null, timedOut: [], queue: [] }
    downloadQueuesByUrl.set(url, urlState)
  }

  if (urlState.inFlight) {
    urlState.queue.push(entry)
  } else {
    startDownloadEntry(urlState, entry)
  }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: sanitize filenames and paths
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f-\x9f]/g

function sanitizeSubfolder(subfolder) {
  if (typeof subfolder !== 'string' || !subfolder.trim()) {
    return ''
  }

  const rawSegments = subfolder.split(/[/\\]+/)
  const cleanSegments = []

  for (const seg of rawSegments) {
    let clean = seg
      .replace(CONTROL_CHARS_RE, '')
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()

    clean = clean.replace(/^[\s.]+|[\s.]+$/g, '').trim()

    if (!clean || clean === '.' || clean === '..') {
      continue
    }

    cleanSegments.push(clean)
  }

  return cleanSegments.join('/')
}

function sanitizeFilename(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    return `twitter_media_${Date.now()}`
  }
  return (
    filename
      .replace(CONTROL_CHARS_RE, '')
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .replace(/^[\s._]+|[\s._]+$/g, '')
      .trim() || `twitter_media_${Date.now()}`
  )
}
//#endregion
