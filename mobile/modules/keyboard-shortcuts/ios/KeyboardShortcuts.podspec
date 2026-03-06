Pod::Spec.new do |s|
  s.name           = 'KeyboardShortcuts'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for iPad hardware keyboard shortcuts via UIKeyCommand'
  s.description    = 'Registers UIKeyCommand shortcuts for iPad Magic Keyboard with discoverability overlay support'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
end
