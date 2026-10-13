#!/usr/bin/env python3
"""Monta o arquivo de dados da casca a partir da exportação do app de apontamentos.

Uso:
  python3 scripts/montar_snapshot.py <pasta_exportada> <slug> <arquivo_saida>

<pasta_exportada> é a pasta usada como out_dir nas leituras do ArtifactData. Ela contém:
  empreendimentos/<slug>.json
  empreendimentos/<slug>/apontamentos/*.json
  empreendimentos/<slug>/reunioes/*.json
  empreendimentos/<slug>/resumos/*.json

A coleção "interno" (comentários de visibilidade restrita) NUNCA entra no arquivo.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Campos de controle da sincronização que não interessam aos fornecedores.
CAMPOS_FORA = {"syncEmAndamento", "syncSolicitadaEm", "syncBloqueada", "autoStatus",
               "ultimaSyncAgendada", "tarefaSyncId"}


def ler(p: Path):
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def colecao(pasta: Path):
    if not pasta.is_dir():
        return {}
    out = {}
    for arq in sorted(pasta.glob("*.json")):
        out[arq.stem] = ler(arq)
    return out


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    base, slug, saida = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    emp_arq = base / "empreendimentos" / f"{slug}.json"
    if not emp_arq.is_file():
        sys.exit(f"Documento do empreendimento não encontrado: {emp_arq}")
    emp = {k: v for k, v in ler(emp_arq).items() if k not in CAMPOS_FORA}
    raiz = base / "empreendimentos" / slug
    aps = colecao(raiz / "apontamentos")
    if not aps:
        sys.exit("Nenhum apontamento exportado; arquivo não gerado.")
    snap = {
        "slug": slug,
        "geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "empreendimento": emp,
        "apontamentos": aps,
        "reunioes": colecao(raiz / "reunioes"),
        "resumos": colecao(raiz / "resumos"),
    }
    texto = json.dumps(snap, ensure_ascii=False, sort_keys=True, indent=1)
    if '"interno"' in json.dumps(list(snap.keys())):
        sys.exit("Erro: a coleção interno não pode ir para a casca.")
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(texto + "\n", encoding="utf-8")
    print(f"{saida}: {len(aps)} apontamentos, {len(snap['reunioes'])} reuniões, "
          f"{len(snap['resumos'])} resumos, {len(texto)//1024} KB")


if __name__ == "__main__":
    main()
