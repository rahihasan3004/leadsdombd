with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'r') as f:
    content = f.read()

old = '      role?: import("@prisma/client").UserRole;\n'
new = '      role?: UserRole;\n'

if old in content:
    content = content.replace(old, new, 1)
    with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'w') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Old string not found')
