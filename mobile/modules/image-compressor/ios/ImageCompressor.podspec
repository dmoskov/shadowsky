Pod::Spec.new do |s|
  s.name           = 'ImageCompressor'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for native image compression, resizing, and cropping using ImageIO'
  s.description    = 'Compresses and resizes images before upload using iOS native CoreGraphics and ImageIO APIs for optimal performance'
  s.author         = 'ShadowSky'
  s.homepage       = 'https://shadowsky.io'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.swift"
  s.frameworks = 'CoreGraphics', 'ImageIO', 'UniformTypeIdentifiers'
end
