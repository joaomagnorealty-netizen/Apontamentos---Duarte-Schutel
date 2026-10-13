# Apontamentos – página de consulta para fornecedores

Página de consulta dos apontamentos da Magno, sem login e sem Claude. É publicada pelo GitHub Pages.

- `index.html`: a página, com o mesmo visual do app de apontamentos.
- `casca.js`: lê os dados de `dados/` e guarda no navegador de cada pessoa as disciplinas escolhidas e os apontamentos marcados.
- `dados/<empreendimento>.json`: dados do dia. A tarefa agendada do Claude grava esse arquivo depois de cada sincronização, sem os comentários internos.
- `scripts/montar_snapshot.py`: monta o arquivo de dados a partir da exportação do app.
