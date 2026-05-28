Roteiro de Testes Automatizados - Sistema SEDEC 360 (Fase 5)
Instrução para o Agente: Execute os ciclos de teste abaixo utilizando o navegador. Para cada falha, documente o log e tente corrigir o código se solicitado. Utilize as credenciais fornecidas no arquivo .env.local ou no dicionário de usuários de teste.

🏁 Ciclo 1: Identidade e Interface (Header e Dashboard)
[ ] Teste 1.1: Setor no Header

Ação: Logar com usuário vinculado a um setor (usuario-teste@exemplo.com).

Validação: Verificar se o código do setor aparece abaixo do nome no header.

[ ] Teste 1.2: Admin sem Setor

Ação: Logar como admin-teste@exemplo.com

Validação: Garantir que nenhum código de setor extra é exibido.

[ ] Teste 1.3: Painéis Recolhíveis

Ação: Acessar /dashboard/projetos.

Validação: Verificar se painéis e filtros iniciam no estado collapsed.

Interação: Clicar em "Painéis" e "Filtros", validar expansão, aplicar filtro e verificar se o botão indica "ativos".

👑 Ciclo 2: Perfil Master e Permissões Administrativas
[ ] Teste 2.1: UI Perfil Master

Ação: Logar como master-teste@exemplo.com

Validação: Badge "Master" presente, botão "Gestão" visível.

[ ] Teste 2.2: Acesso Restrito Master

Ação: Clicar em "Gestão".

Validação: Apenas abas Configurações, Solicitações, Log visíveis. Abas Usuários e Setores devem estar ocultas.

[ ] Teste 2.3: Configurações de Módulos (Toggles)

Ação: Ir em Configurações.

Validação: Confirmar existência dos 6 toggles (3 para Projetos/Entregas, 3 para Atividades).

🔒 Ciclo 3: Permissões Granulares (Datas Independentes)
[ ] Teste 3.1: Edição Restrita (Somente Datas)

Configuração: Admin desabilita proj_permitir_edicao_atividades e habilita proj_permitir_edicao_datas_atividades.

Ação: Logar como Gestor do setor líder. Tentar editar uma atividade.

Validação: Ícone de lixeira oculto. No modal de edição, campos de texto devem estar disabled (cinza). Apenas o campo "Data Prevista" deve permitir alteração e salvamento.

📝 Ciclo 4: Novos Campos e Formulários (Fase 1)
[ ] Teste 4.1: Cadastro de Projeto

Ação: Acessar /dashboard/projetos/novo.

Validação: Preencher novos campos (Responsável, Indicador de Sucesso, Checkboxes de Tipo de Ação).

Sub-teste: Verificar campo "Critérios de Aceite" em Entregas e "Dependências Críticas" em Atividades.

[ ] Teste 4.2: Visualização de Badges

Ação: Abrir detalhe do projeto salvo.

Validação: Tipos de ação devem aparecer como Badges Roxos.

⚖️ Ciclo 5: Fluxo de Aprovação e Gabinete (Fase 5)
[ ] Teste 5.1: Solicitação de Alteração

Ação: Gestor edita um projeto.

Validação: Alerta de "Solicitação enviada" deve aparecer. O projeto original não deve mudar. Badge "Aguardando aprovação" deve surgir no header.

[ ] Teste 5.2: Bloqueio de Duplicidade

Ação: Tentar editar o mesmo projeto novamente.

Validação: Sistema deve bloquear com mensagem de "Solicitação pendente".

[ ] Teste 5.3: Cancelamento de Solicitação

Ação: No rodapé do projeto, clicar em "Cancelar" na seção de pendências.

Validação: Solicitação deve sumir da lista.

🔔 Ciclo 6: Gestão de Solicitações (Admin)
[ ] Teste 6.1: Alerta de Notificação (Sino)

Ação: Com solicitações pendentes, logar como Admin.

Validação: Ícone de sino pulsante com contagem no header em qualquer página.

[ ] Teste 6.2: Deferimento (Aprovação)

Ação: Na aba "Solicitações", aprovar uma edição com justificativa.

Validação: Mudança aplicada imediatamente no projeto. Verificar destaque (De: Vermelho -> Para: Verde).

[ ] Teste 6.3: Indeferimento (Recusa)

Ação: Recusar uma solicitação.

Validação: Dados originais mantidos. Gestor deve ver no histórico como "Recusada" com a justificativa.

📜 Ciclo 7: Auditoria (Log de Alterações)
[ ] Ação: Acessar Log de Alterações.

[ ] Validação: Verificar se o log registra: "Campo: anterior → novo", nome da entidade e a nota "via solicitação de [Nome]".