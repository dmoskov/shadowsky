Pod::Spec.new do |s|
  s.name           = 'NativeNotificationsList'
  s.version        = '1.0.0'
  s.summary        = 'Native notifications list view component'
  s.description    = 'Native Notifications List Expo Module for BSKY mobile app'
  s.homepage       = 'https://github.com/user/repo'
  s.license        = 'MIT'
  s.author         = 'BSKY Team'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'FeedBridge'
  s.dependency 'NotificationBridge'
  s.dependency 'RichTextView'
  s.dependency 'ExpoSwiftUIFeed'

  s.source_files = '**/*.{h,m,mm,swift,cpp}'
end
