"""Extração somente leitura. Dados identificáveis ficam em .private (ignorado pelo Git)."""
import argparse, datetime, json, pathlib
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument('--downloads', default=str(pathlib.Path.home() / 'Downloads'))
args = parser.parse_args()
out = pathlib.Path('.private'); out.mkdir(exist_ok=True)
for module, title in [('cateter', 'Cateter Vesical'), ('bloqueio', 'Medidas de Bloqueio')]:
    path = pathlib.Path(args.downloads) / f'UNI (SCIH) Auditoria Interna - {title} (respostas).xlsx'
    book = openpyxl.load_workbook(path, data_only=True, read_only=True)
    values = [[v.isoformat() if isinstance(v, (datetime.date, datetime.datetime)) else v for v in row] for row in book.active.values]
    (out / f'{module}.json').write_text(json.dumps({'values': values}, ensure_ascii=False), encoding='utf-8')
    print(f'{module}: {len(values)-1} respostas extraídas; dados privados não publicados.')
