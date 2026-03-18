import os
import re

files_to_fix = [
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\api.php",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\src\hooks\useFancyNumbers.js",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\context\ImportContext.jsx",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\components\Toast.jsx",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\vite.config.js",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\components\DashboardLayout.jsx",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\components\ConfirmModal.jsx",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\utils\api.js",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\utils\ErrorBoundary.jsx",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\utils\PatternEngine.js",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\utils\authService.js",
    r"c:\Users\dk637\OneDrive\Desktop\FansiNumber\admin\src\pages\Inventory.jsx"
]

pattern = re.compile(r'<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> [a-f0-9]+(?:\n|)', re.MULTILINE)

for filepath in files_to_fix:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        if '<<<<<<< HEAD' in content:
            new_content = pattern.sub(r'\1', content)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed {os.path.basename(filepath)}")
        else:
            print(f"No conflict markers in {os.path.basename(filepath)}")
