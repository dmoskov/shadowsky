Pod::Spec.new do |s|
  s.name           = 'VideoCompressor'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for hardware-accelerated video compression using AVAssetExportSession'
  s.description    = 'Compresses video files before upload using iOS native AVFoundation APIs for optimal performance'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
  s.frameworks = 'AVFoundation', 'CoreMedia'
end
