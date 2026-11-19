import { expect, test } from 'vitest'

import { DEFAULT_SETTINGS } from '../default-settings.js'
import {
  createSettingsExport,
  SETTINGS_SCHEMA_VERSION,
  validateSettingsExport,
  validateSettingsJson,
} from '../schemas.js'

test.each(['4.99.0', '5.0.0'])('round-trips all settings exported by %s', (version) => {
  const exported = JSON.parse(JSON.stringify(createSettingsExport(DEFAULT_SETTINGS, version)))

  expect(exported.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
  expect(exported.version).toBe(version)
  expect(validateSettingsExport(exported)).toEqual({
    settings: DEFAULT_SETTINGS,
    invalid: [],
    unknown: [],
  })
})

test.each(['4.99.1', '5.1.0', '99.0.0', undefined])(
  'validates using the schema version independently of extension version %s',
  (version) => {
    const result = validateSettingsExport({
      extensionId: 'control-panel-for-twitter',
      schemaVersion: 1,
      version,
      settings: { hideGrok: false, customTheme: '#abcdef' },
    })

    expect(result).toEqual({
      settings: { hideGrok: false, customTheme: '#abcdef' },
      invalid: [],
      unknown: [],
    })
  },
)

test.each([undefined, null, '1', 0, -1, 1.5, true, {}, [], Number.MAX_SAFE_INTEGER + 1])(
  'rejects missing or invalid schema version %j',
  (schemaVersion) => {
    expect(
      validateSettingsExport({
        extensionId: 'control-panel-for-twitter',
        schemaVersion,
        settings: { hideGrok: true },
      }),
    ).toEqual({
      settings: {},
      invalid: [],
      unknown: [],
      error: 'invalidSettingsSchemaVersion',
    })
  },
)

test('warns about a newer schema while importing recognised, valid settings', () => {
  expect(
    validateSettingsExport({
      extensionId: 'control-panel-for-twitter',
      schemaVersion: SETTINGS_SCHEMA_VERSION + 1,
      settings: { hideGrok: false, hideAdsNav: 'yes', futureFlag: true },
    }),
  ).toEqual({
    settings: { hideGrok: false },
    invalid: ['hideAdsNav'],
    unknown: ['futureFlag'],
    warning: 'newerSettingsSchemaVersion',
  })
})

test('reports invalid values and unknown new flags while importing compatible settings', () => {
  expect(
    validateSettingsExport({
      extensionId: 'control-panel-for-twitter',
      schemaVersion: 1,
      settings: { hideGrok: false, hideAdsNav: 'yes', futureFlag: true },
    }),
  ).toEqual({
    settings: { hideGrok: false },
    invalid: ['hideAdsNav'],
    unknown: ['futureFlag'],
  })
})

test.each([null, [], true, {}, { settings: [] }, { settings: null }])(
  'rejects an invalid export envelope %j',
  (input) => {
    expect(validateSettingsExport(input).error).toBe('noSettingsObject')
  },
)

test('rejects an unversioned debugging export', () => {
  expect(validateSettingsExport({ version: '4.998.0', settings: { hideGrok: true } }).error).toBe(
    'invalidSettingsSchemaVersion',
  )
})

test('converts and validates legacy v4 TweetEnhc Settings backup', () => {
  const legacyBackup = {
    format: 'TweetEnhc Settings',
    version: 1,
    exportedAt: '2026-11-16T04:00:00.000Z',
    settings: {
      alwaysUseLatestTweets: false,
      twitterBlueChecks: 'dim',
      replaceLogo: false,
      hideGrokNav: false,
      hideForYouTimeline: false,
      tweetTranslation: 'auto',
      videoLayoutDiagnostics: true,
      retiredV4Field: 'someValue',
    },
  }

  const result = validateSettingsJson(JSON.stringify(legacyBackup))
  expect(result.issues).toEqual([])
  expect(result.settings).not.toBeNull()
  expect(result.settings?.defaultToFollowing).toBe(false)
  expect(result.settings?.premiumBlueChecks).toBe('replace')
  expect(result.settings?.revertXBranding).toBe(false)
  expect(result.settings?.hideGrok).toBe(false)
  expect(result.settings?.hideForYouTimeline).toBe(false)
  expect(result.settings?.tweetTranslation).toBe('auto')
  expect(result.settings?.videoLayoutDiagnostics).toBe(true)
  expect(result.settings?.cleanTweetLinks).toBe(DEFAULT_SETTINGS.cleanTweetLinks)
})

test('converts and validates legacy raw JSON settings', () => {
  const rawSettings = {
    hideForYouTimeline: false,
    retweets: 'separate',
    cleanTweetLinks: true,
    tweetTranslation: 'manual',
    alwaysUseLatestTweets: true,
  }

  const result = validateSettingsJson(JSON.stringify(rawSettings))
  expect(result.issues).toEqual([])
  expect(result.settings).not.toBeNull()
  expect(result.settings?.defaultToFollowing).toBe(true)
  expect(result.settings?.hideForYouTimeline).toBe(false)
  expect(result.settings?.retweets).toBe('separate')
})

test('rejects legacy backup with invalid setting value', () => {
  const legacyBackup = {
    format: 'TweetEnhc Settings',
    version: 1,
    settings: {
      hideForYouTimeline: 'not-a-boolean',
      darkModeTheme: 'invalidTheme',
    },
  }

  const result = validateSettingsJson(JSON.stringify(legacyBackup))
  expect(result.settings).toBeNull()
  expect(result.issues).toEqual([
    {
      code: 'invalidSettings',
      detail: 'darkModeTheme, hideForYouTimeline',
    },
  ])
})
