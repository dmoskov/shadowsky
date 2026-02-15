Pod::Spec.new do |s|
  s.name           = 'NativeFeedList'
  s.version        = '1.0.0'
  s.summary        = 'Native feed list view component'
  s.description    = 'Native Feed List Expo Module for BSKY mobile app'
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
