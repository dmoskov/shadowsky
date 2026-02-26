Pod::Spec.new do |s|
  s.name           = 'NativeSearch'
  s.version        = '1.0.0'
  s.summary        = 'Native SwiftUI search module'
  s.description    = 'Native SwiftUI implementation of the search screen with native search bar, results list, trending topics, and tab switching'
  s.author         = 'Claude Code'
  s.homepage       = 'https://github.com/yourusername/bsky'
  s.platforms      = { :ios => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoSwiftUIFeed'

  s.frameworks = 'UIKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
