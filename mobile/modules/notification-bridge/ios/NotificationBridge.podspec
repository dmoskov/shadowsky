Pod::Spec.new do |s|
  s.name           = 'NotificationBridge'
  s.version        = '1.0.0'
  s.summary        = 'Native module for passing notification data to Swift'
  s.description    = 'Notification Bridge Expo Module for BSKY mobile app'
  s.homepage       = 'https://github.com/user/repo'
  s.license        = 'MIT'
  s.author         = 'BSKY Team'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'FeedBridge'

  s.source_files = '**/*.{h,m,mm,swift,cpp}'
end
