with open(r'D:\Fine Leads\apps\web\app\api\dashboard\metrics\route.ts', 'r') as f:
    content = f.read()

old = '    const recentOrders = (() => {'
new = '    const recentOrders = await (async () => {'

if old in content:
    content = content.replace(old, new, 1)
    with open(r'D:\Fine Leads\apps\web\app\api\dashboard\metrics\route.ts', 'w') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Old string not found')
