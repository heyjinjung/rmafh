import os

path = r'c:\Users\JAVIS\rmarh\backend\app\main.py'
with open(path, 'rb') as f:
    data = f.read()

# Target line part
target = b'return s in {"1", "true", "t", "yes", "y", "ok", "o"'
start = data.find(target)
if start != -1:
    # Find the closing brace of the set
    end = data.find(b'}', start)
    if end != -1:
        # Construct the new line with standard UTF-8 Korean characters
        korean_chars = ', "응", "확인", "완료"'.encode('utf-8')
        new_data = data[:start] + target + korean_chars + b'}' + data[end+1:]
        
        with open(path, 'wb') as f:
            f.write(new_data)
        print("Successfully fixed main.py")
    else:
        print("Could not find closing brace")
else:
    print("Could not find target line")
