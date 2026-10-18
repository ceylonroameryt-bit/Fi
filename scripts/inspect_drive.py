import re
import os

content_path = r'C:\Users\Sujampathi\.gemini\antigravity-ide\brain\aa7ec8fd-be56-4614-aa11-4592bad56ed7\.system_generated\steps\46\content.md'
with open(content_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Look for drive items
files = set(re.findall(r'([a-zA-Z0-9_\-\s\(\)\.]+\.(?:pdf|docx?|pptx?|xlsx?))', text, re.IGNORECASE))
valid_files = [f for f in sorted(files) if not f.startswith('vnd.') and not f.startswith('g.owner') and not f.startswith('window.')]
print(f"Discovered {len(valid_files)} documents in Google Drive:")
for vf in valid_files:
    print(f"  * {vf}")
