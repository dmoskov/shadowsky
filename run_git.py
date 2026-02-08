#!/usr/bin/env python3
import subprocess
import os

# Change to the shadowsky directory
os.chdir('/workspace/shadowsky')

print("Current directory:", os.getcwd())
print()

# Add the file
print("=== Adding VideoPlayer.tsx ===")
result = subprocess.run(['git', 'add', 'src/components/VideoPlayer.tsx'], capture_output=True, text=True)
print("Return code:", result.returncode)
if result.stdout:
    print("stdout:", result.stdout)
if result.stderr:
    print("stderr:", result.stderr)
print()

# Check status
print("=== Git Status ===")
result = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print("stderr:", result.stderr)
print()

# Commit
print("=== Committing ===")
commit_msg = """[1213045707899353] fix: Add cleanup for HLS.js event listeners in VideoPlayer

- Extracted HLS event handlers (MANIFEST_PARSED, ERROR) into named functions
- Added explicit .off() calls to remove HLS event listeners before destroying instance
- Ensures no memory leaks when component unmounts or video source changes

All 10 event listeners now have proper cleanup:
- 8 DOM addEventListener calls with removeEventListener
- 2 HLS.js .on() calls with .off() (newly fixed)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"""

result = subprocess.run(['git', 'commit', '-m', commit_msg], capture_output=True, text=True)
print("Return code:", result.returncode)
print(result.stdout)
if result.stderr:
    print("stderr:", result.stderr)
print()

# Get commit SHA
print("=== Commit SHA ===")
result = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True)
if result.returncode == 0:
    commit_sha = result.stdout.strip()
    print(commit_sha)

    # Save to file for reading later
    with open('/tmp/commit_sha.txt', 'w') as f:
        f.write(commit_sha)
print()

# Push
print("=== Pushing to origin ===")
result = subprocess.run(['git', 'push', 'origin', 'task/1213045707899353'], capture_output=True, text=True)
print("Return code:", result.returncode)
print(result.stdout)
if result.stderr:
    print("stderr:", result.stderr)
