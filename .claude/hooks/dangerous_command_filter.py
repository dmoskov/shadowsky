#!/usr/bin/env python3
"""
dangerous_command_filter.py
Place in ~/.claude/hooks/ and make executable: chmod +x dangerous_command_filter.py
"""

import json
import sys
import re

def main():
    hook_data = json.load(sys.stdin)
    command = hook_data.get('tool_input', {}).get('command', '').strip()
    
    # Critical: these patterns are BLOCKED completely
    critical_patterns = [
        # Destructive file operations
        r'\brm\s+(-[rfRF]+\s+|.*\s+-[rfRF]+)',  # rm with force/recursive
        r'\brm\s+[^|>&]*\*',  # rm with wildcards
        r'\brm\s+/',  # rm on root paths
        r'\bdd\s+',  # disk destroyer
        r'\bshred\s+',  # secure file deletion
        r'\bmkfs',  # format filesystem
        
        # System breakers  
        r':\(\)\{.*:\|:.*\}',  # fork bomb
        r'>\s*/etc/',  # overwriting system files
        r'>\s*/usr/',
        r'>\s*/bin/',
        r'>\s*/sys/',
        
        # Resource exhaustion
        r'\byes\s*\|(?!.*head|.*tail|.*less)',  # yes without limits
        r'cat\s+/dev/(urandom|random)\s*>',  # fill disk with random
        
        # Remote code execution
        r'curl\s+',
        r'wget\s+',
        
        # Database destruction
        r'DROP\s+(DATABASE|SCHEMA|TABLE)\s+(?!IF\s+EXISTS\s+temp)',
        r'DELETE\s+FROM\s+\w+(?!\s+WHERE)',  # DELETE without WHERE
        r'TRUNCATE\s+TABLE',
        
        # Git dangers
        r'git\s+push\s+[^|]*--force[^|]*\b(main|master)\b',
        
        # Permission destruction
        r'chmod\s+[^|]*777',
        r'chmod\s+[^|]*-R\s+[^|]*[0-7]?[0-7][0-7]',  # recursive chmod
        r'chown\s+[^|]*-R',  # recursive chown
    ]
    
    # Warning: these patterns trigger a confirmation prompt
    warning_patterns = [
        # Package management
        r'\b(apt|apt-get|yum|dnf|brew|snap)\s+(remove|purge|uninstall|autoremove)',
        r'\bpip\s+uninstall',
        r'\bnpm\s+uninstall',
        
        # Service management
        r'systemctl\s+(stop|disable|mask)',
        r'service\s+\w+\s+stop',
        
        # Network changes
        r'iptables\s+-[DF]',  # flush/delete rules
        r'ufw\s+(disable|reset)',
        
        # Credential risks
        r'echo\s+["\']?[^"\']*password',
        r'cat\s+[^|]*\.(pem|key|crt|pfx|p12|jks)',
        r'cat\s+[^|]*/\.(env|aws/|ssh/|gnupg/)',
        
        # Git operations
        r'git\s+reset\s+--hard',
        r'git\s+clean\s+-[xfd]',
        r'git\s+push\s+--force(?!.*\b(main|master)\b)',  # force push to non-main
        
        # History and environment
        r'\bhistory\b',
        r'\bprintenv\b',
        r'\benv\b(?!\s+\w+=)',  # env without setting variables
    ]
    
    # Check critical patterns - BLOCK
    for pattern in critical_patterns:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"❌ BLOCKED: This command matches a dangerous pattern.", file=sys.stderr)
            print(f"Pattern: {pattern}", file=sys.stderr)
            print(f"Command: {command}", file=sys.stderr)
            print(f"\nIf this is intentional, please run it manually.", file=sys.stderr)
            sys.exit(2)  # Exit code 2 blocks execution
    
    # Check warning patterns - LOG but ALLOW (you could change to prompt)
    for pattern in warning_patterns:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"⚠️  WARNING: Potentially risky command detected", file=sys.stderr)
            print(f"Command: {command}", file=sys.stderr)
            # Continue execution (exit 0) but log the warning
            # Change to sys.exit(2) if you want to block these too
    
    # Default: allow everything else
    sys.exit(0)

if __name__ == "__main__":
    main()
