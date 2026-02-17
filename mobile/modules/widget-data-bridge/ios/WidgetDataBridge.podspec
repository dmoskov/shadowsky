Pod::Spec.new do |s|
  s.name           = 'WidgetDataBridge'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for writing widget data to App Group UserDefaults'
  s.description    = 'Bridges data from React Native to WidgetKit widgets via shared App Group UserDefaults'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'

  s.source_files = "**/*.swift"
end
