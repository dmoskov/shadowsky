Pod::Spec.new do |s|
  s.name           = 'SpotlightSearch'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for iOS Spotlight search integration via CoreSpotlight'
  s.description    = 'Indexes profiles and posts in iOS Spotlight so users can find them from the home screen search'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreSpotlight', 'MobileCoreServices'

  s.source_files = "**/*.swift"
end
