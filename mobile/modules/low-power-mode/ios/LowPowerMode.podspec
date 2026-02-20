Pod::Spec.new do |s|
  s.name           = 'LowPowerMode'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for detecting iOS Low Power Mode'
  s.description    = 'Bridges ProcessInfo.isLowPowerModeEnabled to React Native via Expo Modules'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
end
