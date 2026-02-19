Pod::Spec.new do |s|
  s.name           = 'NativeCompose'
  s.version        = '1.0.0'
  s.summary        = 'Native SwiftUI compose/post creation module'
  s.description    = 'Native SwiftUI implementation of the compose screen with text input, media picker, keyboard handling, and thread composition'
  s.author         = 'Claude Code'
  s.homepage       = 'https://github.com/yourusername/bsky'
  s.platforms      = { :ios => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'PhotosUI', 'UIKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
