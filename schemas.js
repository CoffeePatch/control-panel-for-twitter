import {
  arrayOf,
  boolean,
  isObject,
  object,
  oneOf,
  optional,
  string,
} from './shared/settings-schema.js'
import { createSettingsTransfer } from './shared/settings-transfer.js'

import { DEFAULT_SETTINGS } from './default-settings.js'

// Increment for incompatible changes only
export const SETTINGS_SCHEMA_VERSION = 1

const quotedTweet = object({
  quotedBy: string({ maxLength: 50 }),
  user: string({ maxLength: 30 }),
  time: string({ maxLength: 30 }),
  text: optional(string({ maxLength: 280 })),
})

/**
 * @type {Record<import('./types').UserSettingsKey, import('./shared/types').FieldDescriptor>}
 */
export const currentSettingsSchema = {
  // Pro
  customTheme: string(),
  mutedWords: string(),
  mutedWordsError: boolean(),
  // Shared
  addAddMutedWordMenuItem: boolean(),
  addFocusedTweetAccountLocation: boolean(),
  bypassAgeVerification: boolean(),
  bypassMediaContextMenu: boolean(),
  cleanTweetLinks: boolean(),
  darkModeTheme: oneOf(['lightsOut', 'dim', 'monokaiExtended', 'gruvboxDarkSoft']),
  defaultFollowingToRecent: boolean(),
  defaultToFollowing: boolean(),
  defaultToLatestSearch: boolean(),
  disableHomeTimeline: boolean(),
  disableTweetTextFormatting: boolean(),
  disableUsSportFeatures: boolean(),
  disableVideoLooping: boolean(),
  disabledHomeTimelineRedirect: oneOf(['notifications', 'messages']),
  dontUseChirpFont: boolean(),
  dropdownMenuFontWeight: boolean(),
  fastBlock: boolean(),
  fontSize: oneOf(['xSmall', 'small', 'default', 'large', 'xLarge']),
  hideAdsNav: boolean(),
  hideAiTweets: boolean(),
  hideBookmarkButton: boolean(),
  hideBookmarkMetrics: boolean(),
  hideBusinessNav: boolean(),
  hideCalls: boolean(),
  hideChatNav: boolean(),
  hideCommunitiesNav: boolean(),
  hideComposeTweet: boolean(),
  hideConnectNav: boolean(),
  hideCreatorStudioNav: boolean(),
  hideDiscoverSuggestions: boolean(),
  hideEditImage: boolean(),
  hideExplorePageContents: boolean(),
  hideFollowingMenu: boolean(),
  hideFollowingMetrics: boolean(),
  hideForYouTimeline: boolean(),
  hideGrok: boolean(),
  hideGrokTweets: boolean(),
  hideHistoryNav: boolean(),
  hideInlinePrompts: boolean(),
  hideJobs: boolean(),
  hideLikeMetrics: boolean(),
  hideListRetweets: boolean(),
  hideListsNav: boolean(),
  hideManageTimelines: boolean(),
  hideMetrics: boolean(),
  hideMoney: boolean(),
  hideMoreFromThisAuthor: boolean(),
  hideNotificationLikes: boolean(),
  hideNotificationRetweets: boolean(),
  hideNotifications: oneOf(['ignore', 'badges', 'hide']),
  hidePremiumReplies: boolean(),
  hidePremiumUpsells: boolean(),
  hideProfileHeaderMetrics: boolean(),
  hideProfileRetweets: boolean(),
  hideQuoteTweetMetrics: boolean(),
  hideQuotesFrom: arrayOf(string({ maxLength: 50 }), { maxLength: 10000 }),
  hideReplyMetrics: boolean(),
  hideRetweetMetrics: boolean(),
  hideSeeNewTweets: boolean(),
  hideShareTweetButton: boolean(),
  hideSortRepliesMenu: boolean(),
  hideSpacesNav: boolean(),
  hideSubscriptions: boolean(),
  hideSuggestedContentSearch: boolean(),
  hideSuggestedContentTimeline: boolean(),
  hideUnavailableQuoteTweets: boolean(),
  hideVerifiedTabs: boolean(),
  hideViewActivityLinks: boolean(),
  hideViews: boolean(),
  lightModeTheme: oneOf(['light', 'catppuccinLatte', 'solarizedLight', 'gruvboxLight']),
  mutableQuoteTweets: boolean(),
  mutedQuotes: arrayOf(quotedTweet, { maxLength: 10000 }),
  premiumBlueChecks: oneOf(['ignore', 'replace', 'hide']),
  quoteTweets: oneOf(['separate', 'hide', 'ignore']),
  reducedInteractionMode: boolean(),
  removeSidebarPanelGradients: boolean(),
  restoreLinkHeadlines: boolean(),
  restoreOtherInteractionLinks: boolean(),
  restoreQuoteTweetsLink: boolean(),
  retweets: oneOf(['separate', 'hide', 'ignore']),
  revertMediaCarousel: boolean(),
  revertProfileTabs: boolean(),
  revertTwemoji: boolean(),
  revertXBranding: boolean(),
  showBookmarkButtonUnderFocusedTweets: boolean(),
  showPremiumReplyBusiness: boolean(),
  showPremiumReplyFollowedBy: boolean(),
  showPremiumReplyFollowersCount: boolean(),
  showPremiumReplyFollowersCountAmount: oneOf(['1000', '10000', '100000', '1000000']),
  showPremiumReplyFollowing: boolean(),
  showPremiumReplyGovernment: boolean(),
  sortReplies: oneOf(['relevant', 'recent', 'liked']),
  themeFollowButtons: boolean(),
  tweetTranslation: oneOf(['off', 'manual', 'auto']),
  tweakQuoteTweetsPage: boolean(),
  unblurSensitiveContent: boolean(),
  uninvertFollowButtons: boolean(),
  videoLayoutDiagnostics: boolean(),
  // Desktop only
  addUserHoverCardAccountLocation: boolean(),
  fullWidthContent: boolean(),
  fullWidthMedia: boolean(),
  hideAccountSwitcher: boolean(),
  hideChatDrawer: boolean(),
  hideExploreNav: boolean(),
  hideExploreNavWithSidebar: boolean(),
  hideLiveBroadcasts: boolean(),
  hideSidebarContent: boolean(),
  hideSuggestedFollows: boolean(),
  hideTimelineTweetBox: boolean(),
  hideTodaysNews: boolean(),
  hideWhatsHappening: boolean(),
  navBaseFontSize: boolean(),
  navDensity: oneOf(['default', 'comfortable', 'compact']),
  showRelevantPeople: boolean(),
  // Mobile only
  hideLiveBroadcastBar: boolean(),
  preventNextVideoAutoplay: boolean(),
  // Advancedd
  customCss: string({ maxLength: 50000 }),
  enableCustomCss: boolean(),
}

export const V4_KEY_MIGRATIONS = {
  disableNflFeatures: { rename: 'disableUsSportFeatures' },
  hideGrokNav: { rename: 'hideGrok' },
  hideJobsNav: { rename: 'hideJobs' },
  hideMessagesDrawer: { rename: 'hideChatDrawer' },
  hideWhoToFollowEtc: { rename: 'hideSuggestedContentTimeline' },
  listRetweets: { rename: 'hideListRetweets', convert: (value) => value == 'hide' },
  sortFollowing: {
    rename: 'defaultFollowingToRecent',
    convert: (value) => value == 'mostRecent',
  },
  alwaysUseLatestTweets: { rename: 'defaultToFollowing' },
  hideMoreTweets: { rename: 'hideDiscoverSuggestions' },
  hideTotalTweetsMetrics: { rename: 'hideProfileHeaderMetrics' },
  hideVerifiedNotificationsTab: { rename: 'hideVerifiedTabs' },
  replaceLogo: { rename: 'revertXBranding' },
  hideTwitterBlueReplies: { rename: 'hidePremiumReplies' },
  hideTwitterBlueUpsells: { rename: 'hidePremiumUpsells' },
  showBlueReplyFollowersCount: { rename: 'showPremiumReplyFollowersCount' },
  showBlueReplyFollowersCountAmount: { rename: 'showPremiumReplyFollowersCountAmount' },
  twitterBlueChecks: {
    rename: 'premiumBlueChecks',
    convert: (value) => (value == 'dim' ? 'replace' : value),
  },
}

/**
 * Checks whether an input represents a legacy v4 export or raw settings.
 * @param {unknown} input
 * @returns {boolean}
 */
export function isLegacyV4Backup(input) {
  if (!isObject(input)) return false
  if (
    input.format === 'TweetEnhc Settings' ||
    input.format === 'Control Panel for Twitter Settings'
  ) {
    return true
  }
  // Exclude explicit v5 envelopes and unversioned debugging exports
  if ('extensionId' in input || 'schemaVersion' in input) return false
  if ('version' in input && 'settings' in input && typeof input.version === 'string') return false

  const candidate = isObject(input.settings) ? input.settings : input
  if (!isObject(candidate)) return false
  const keys = Object.keys(candidate)
  const recognizedCount = keys.filter(
    (k) => k in currentSettingsSchema || k in V4_KEY_MIGRATIONS,
  ).length
  return recognizedCount >= 3
}

/**
 * Normalizes legacy v4 backup exports into v5 format.
 * @param {unknown} input
 * @returns {unknown}
 */
export function convertLegacyBackup(input) {
  if (!isLegacyV4Backup(input)) return input
  const rawObj = /** @type {Record<string, unknown>} */ (input)
  const rawSettings = /** @type {Record<string, unknown>} */ (
    isObject(rawObj.settings) ? rawObj.settings : rawObj
  )

  const mappedSettings = { ...DEFAULT_SETTINGS }

  for (const [key, value] of Object.entries(rawSettings)) {
    if (
      key === 'version' ||
      key === 'installedVersion' ||
      key === 'lastLayout' ||
      key === 'format' ||
      key === 'exportedAt'
    ) {
      continue
    }
    if (Object.hasOwn(V4_KEY_MIGRATIONS, key)) {
      const migration = V4_KEY_MIGRATIONS[key]
      const target = migration.rename || key
      mappedSettings[target] = migration.convert ? migration.convert(value) : value
    } else if (Object.hasOwn(currentSettingsSchema, key)) {
      mappedSettings[key] = value
    }
  }

  return {
    extensionId: 'control-panel-for-twitter',
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    settings: mappedSettings,
  }
}

const nativeSettingsTransfer = createSettingsTransfer({
  extensionId: 'control-panel-for-twitter',
  schema: currentSettingsSchema,
  schemaVersion: SETTINGS_SCHEMA_VERSION,
})

/** @type {ReturnType<typeof createSettingsTransfer>} */
export const settingsTransfer = {
  ...nativeSettingsTransfer,
  validateSettingsExport: (input) => {
    return nativeSettingsTransfer.validateSettingsExport(convertLegacyBackup(input))
  },
  validateSettingsJson: (json) => {
    let input
    try {
      input = JSON.parse(json)
    } catch (error) {
      /** @type {import('./shared/types').SettingsImportIssue[]} */
      const issues = [
        {
          code: 'invalidJsonFile',
          detail: error instanceof Error ? error.message : String(error),
        },
      ]
      return { settings: null, issues }
    }
    const candidate = convertLegacyBackup(input)
    const { settings, invalid, unknown, error, warning } =
      nativeSettingsTransfer.validateSettingsExport(candidate)
    if (error) return { settings: null, issues: [{ code: error }] }
    /** @type {import('./shared/types').SettingsImportIssue[]} */
    const issues = []
    if (warning) issues.push({ code: 'unsupportedSettingsSchemaVersion' })
    if (invalid.length) issues.push({ code: 'invalidSettings', detail: invalid.join(', ') })
    if (unknown.length) issues.push({ code: 'unknownSettings', detail: unknown.join(', ') })
    return { settings: issues.length ? null : settings, issues }
  },
}

export const { createSettingsExport, validateSettingsExport, validateSettingsJson } =
  settingsTransfer
