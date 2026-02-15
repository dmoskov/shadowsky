Pod::Spec.new do |s|
  s.name           = 'NotificationBridge'
  s.version        = '1.0.0'
  s.summary        = 'Bridge module for passing notification data from React Native to Swift'
  s.description    = 'Expo module that provides a bridge for passing AT Protocol notification data from React Native to native Swift code'
  s.author         = ''
  s.homepage       = 'https://github.com/yourusername/yourrepo'
  s.platforms      = { :ios => '13.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
