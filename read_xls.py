import xlrd, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'örnek şablonlar/1- TUTANAKLAR Y.M. VE PİYASA FİYAT ARAŞTIRMASI.xls'
wb = xlrd.open_workbook(path, formatting_info=True)

for s in wb.sheets():
    print(f'\n{"="*60}')
    print(f'SAYFA: {s.name}  ({s.nrows} satir x {s.ncols} sutun)')
    print('='*60)
    for r in range(s.nrows):
        row_vals = []
        for c in range(s.ncols):
            v = s.cell(r, c).value
            if v != '':
                row_vals.append(f'[{c}]{str(v)[:40]}')
        if row_vals:
            print(f'R{r:02d}: ' + '  |  '.join(row_vals))
