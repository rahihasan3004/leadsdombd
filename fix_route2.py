with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'r') as f:
    content = f.read()

old = 'import type { AdminUser } from "@/lib/admin-guard";\n'
new = 'import type { AdminUser } from "@/lib/admin-guard";\nimport type { UserRole } from "@fine-leads/database";\n'

if old in content:
    content = content.replace(old, new, 1)
    with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'w') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Old string not found')
