Pod::Spec.new do |s|
  s.name           = 'NativeMessages'
  s.version        = '1.0.0'
  s.summary        = 'Native SwiftUI messages module'
  s.description    = 'Native SwiftUI implementation of DM conversations and message threads'
  s.author         = 'Claude Code'
  s.homepage       = 'https://github.com/yourusername/bsky'
  s.platforms      = { :ios => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
