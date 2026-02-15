Pod::Spec.new do |s|
  s.name           = 'ThreadBridge'
  s.version        = '1.0.0'
  s.summary        = 'Thread data bridge module'
  s.description    = 'Bridges thread data from JavaScript to native Swift'
  s.author         = 'Claude Code'
  s.homepage       = 'https://github.com/yourusername/bsky'
  s.platforms      = { :ios => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
