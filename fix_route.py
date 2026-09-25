with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'r') as f:
    content = f.read()

old = ('    const { role, organizationId, walletBalanceAdjustment, balanceReason } = updateFields;\n'
       '\n'
       '    if (walletBalanceAdjustment !== undefined && typeof walletBalanceAdjustment !== "number") {\n'
       '      return NextResponse.json({ error: "walletBalanceAdjustment must be a number" }, { status: 400 });\n'
       '    }\n'
       '\n'
       '     const updated = await updateUser(')

new = ('    const { role, organizationId, walletBalanceAdjustment, balanceReason } = updateFields as {\n'
       '      role?: import("@prisma/client").UserRole;\n'
       '      organizationId?: string;\n'
       '      walletBalanceAdjustment?: number;\n'
       '      balanceReason?: string;\n'
       '    };\n'
       '\n'
       '    if (walletBalanceAdjustment !== undefined && typeof walletBalanceAdjustment !== "number") {\n'
       '      return NextResponse.json({ error: "walletBalanceAdjustment must be a number" }, { status: 400 });\n'
       '    }\n'
       '\n'
       '     const updated = await updateUser(')

if old in content:
    content = content.replace(old, new, 1)
    with open(r'D:\Fine Leads\apps\web\app\api\admin\users\[id]\route.ts', 'w') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Old string not found')
    idx = content.find('updateFields;')
    print(repr(content[idx:idx+400]))
