"""從不同工作目錄重建，確認整個專案可搬移且輸出一致。"""
import json
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

root = Path(__file__).resolve().parents[1]
backup_root = (root / 'backups').resolve()
backup_root.mkdir(exist_ok=True)
temp = backup_root / ('portability-' + uuid.uuid4().hex)
temp.mkdir()
try:
    moved = Path(temp) / '獨立題庫'
    moved.mkdir()
    shutil.copy2(root / 'build_site.py', moved)
    shutil.copytree(root / 'data', moved / 'data')
    subprocess.run([sys.executable, str(moved / 'build_site.py')], cwd=temp, check=True)
    for name in ['manifest.json', 'cchs-ipas-2026.json']:
        actual = json.loads((moved / 'docs/banks' / name).read_text(encoding='utf-8'))
        expected = json.loads((root / 'docs/banks' / name).read_text(encoding='utf-8'))
        assert actual == expected, name
    bank = json.loads((moved / 'docs/banks/cchs-ipas-2026.json').read_text(encoding='utf-8'))
    assert len(bank['questions']) == 150
    assert [u['id'] for u in bank['units']] == ['w%02d' % i for i in range(1, 19)]
    assert [(u['value'], u['limit'], u['timeSec']) for u in bank['units'][-3:]] == [('科二',30,1800), ('科一',40,3000), ('科二',40,2700)]
    print('PASS: standalone rebuild, 150 questions, 18 weeks, original output preserved.')
finally:
    if temp.resolve().parent != backup_root or not temp.name.startswith('portability-'):
        raise RuntimeError('Unsafe cleanup target')
    # 保留小型重建結果供搬移稽核；也避免 OneDrive 同步鎖造成清理失敗。
    print('Rebuild evidence: backups/' + temp.name)
