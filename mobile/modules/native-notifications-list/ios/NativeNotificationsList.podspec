Pod::Spec.new do |s|
  s.name           = 'NativeNotificationsList'
  s.version        = '1.0.0'
  s.summary        = 'Native SwiftUI notifications list component'
  s.description    = 'Expo module that provides a native SwiftUI notifications list view for React Native'
  s.author         = ''
  s.homepage       = 'https://github.com/yourusername/yourrepo'
  s.platforms      = { :ios => '13.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'NotificationBridge'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
