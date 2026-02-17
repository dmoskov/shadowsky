Pod::Spec.new do |s|
  s.name           = 'NativeProfileView'
  s.version        = '1.0.0'
  s.summary        = 'Native SwiftUI profile view component for React Native'
  s.description    = 'Provides a high-performance native profile header and tab switching for iOS'
  s.author         = ''
  s.homepage       = 'https://github.com/shadowsky'
  s.platforms      = { :ios => '15.0', :tvos => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoSwiftUIFeed'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
