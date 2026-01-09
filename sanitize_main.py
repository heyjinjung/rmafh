path = r'c:\Users\JAVIS\rmarh\backend\app\main.py'
with open(path, 'rb') as f:
    content = f.read()

# Try to decode as utf-8 but ignore errors, then re-encode as utf-8
# This will strip/replace invalid characters that cause SyntaxError
new_content = content.decode('utf-8', errors='ignore').encode('utf-8')

with open(path, 'wb') as f:
    f.write(new_content)
    
print("Sanitized main.py (stripped invalid UTF-8 bytes)")
