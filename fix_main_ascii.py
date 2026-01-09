path = r'c:\Users\JAVIS\rmarh\backend\app\main.py'
with open(path, 'rb') as f:
    data = f.read()

# Target line part - even more generic to avoid mismatch
target_start = b'return s in {"1", "true", "t", "yes", "y", "ok", "o"'
start = data.find(target_start)
if start != -1:
    end = data.find(b'}', start)
    if end != -1:
        # Replace with ASCII only version to guarantee it works
        new_line = target_start + b'}'
        new_data = data[:start] + new_line + data[end+1:]
        
        with open(path, 'wb') as f:
            f.write(new_data)
        print("Successfully fixed main.py with ASCII only")
    else:
        print("Could not find closing brace")
else:
    print("Could not find target line")
