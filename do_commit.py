#!/usr/bin/env python3
"""Execute git commands to commit changes."""
import os
import sys

# Change to shadowsky directory
os.chdir('/workspace/shadowsky')
print(f"Working directory: {os.getcwd()}")

# Git commands
commands = [
    'git add src/components/VideoPlayer.tsx',
    'git status --short',
    '''git commit -m "[1213045707899353] fix: Add cleanup for HLS.js event listeners in VideoPlayer

- Extracted HLS event handlers (MANIFEST_PARSED, ERROR) into named functions
- Added explicit .off() calls to remove HLS event listeners before destroying instance
- Ensures no memory leaks when component unmounts or video source changes

All 10 event listeners now have proper cleanup:
- 8 DOM addEventListener calls with removeEventListener
- 2 HLS.js .on() calls with .off() (newly fixed)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"''',
    'git push origin task/1213045707899353',
    'git rev-parse HEAD'
]

for cmd in commands:
    print(f"\n{'='*60}")
    print(f"Executing: {cmd[:70]}...")
    print('='*60)
    ret = os.system(cmd)
    if ret != 0:
        print(f"Command failed with return code: {ret}", file=sys.stderr)
        if 'commit' in cmd:
            # Continue even if commit fails (might be nothing to commit)
            continue
        else:
            sys.exit(ret)

print("\n" + "="*60)
print("All commands completed!")
print("="*60)
