Pod::Spec.new do |s|
  s.name           = 'AlternateIcon'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for iOS alternate app icons'
  s.homepage       = 'https://github.com/dmoskov/shadowsky'
  s.license        = 'MIT'
  s.author         = 'ShadowSky'
  s.source         = { git: '' }
  s.platform       = :ios, '16.0'
  s.swift_version  = '5.9'
  s.source_files   = '**/*.swift'
  s.dependency 'ExpoModulesCore'
end
