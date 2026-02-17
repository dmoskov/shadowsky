Pod::Spec.new do |s|
  s.name           = 'ShareIntent'
  s.version        = '1.0.0'
  s.summary        = 'Expo module to read shared content from iOS Share Extension via App Group'
  s.description    = 'Provides access to content shared via the iOS Share Extension using App Group UserDefaults and shared containers'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
end
