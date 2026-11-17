# Rascunho de ajustes na Política de Privacidade e nos Termos do Spinos

**Status: PUBLICADO em `/privacidade` e `/termos` em 2026-11-17 por decisão do Cyro, ainda SEM revisão de advogado. Este arquivo é a lista do que o advogado deve conferir (ver seção 4, itens 6 a 9, e a cláusula de fidelidade nos Termos).**
Escrito em 2026-11-16, depois de o Spinos ganhar site, páginas de captação, conteúdo gerado por IA, relatórios e e-mail.

## 1. O que a política atual afirma e deixou de ser verdade

| Trecho atual | Problema |
|---|---|
| "Não somos um CRM" | O Spinos agora tem CRM (funil, contatos, atividades, automações). |
| "Cookies: apenas os estritamente necessários... não utilizamos analytics" | Os sites dos clientes têm medição própria de visitas (sem cookie, com identificador diário anônimo) e, quando o cliente liga, GA4/Meta Pixel, sempre atrás de banner de consentimento. A política da plataforma precisa dizer o que vale para o app e o que vale para os sites. |
| Resend: "e-mails transacionais" | Agora também envia campanhas dos clientes para os contatos deles. |
| Seção 1: dados só de "empresas-alvo e decisores" com base em legítimo interesse | Passam a existir contatos de clientes e leads do site, com base legal CONSENTIMENTO ou CONTRATO (e legítimo interesse só na prospecção). |
| Seção 3: IA "scores, resumos, chat" | A IA também escreve rascunhos de conteúdo (posts, artigos, e-mails). |
| Seção 6: retenção "180 dias após cancelamento" | Não menciona prazos por tipo de dado (abaixo). |

## 2. Papéis (ponto central para o advogado)

- **Dados dos usuários do Spinos** (cadastro, cobrança): o Spinos é **controlador**.
- **Dados dos contatos e leads dos clientes** (quem preenche o formulário do site, quem recebe a campanha, contatos do CRM): o **cliente é o controlador** e o Spinos é **operador**, e trata esses dados apenas conforme as instruções do cliente. Isso pede um **contrato/aditivo de tratamento de dados (DPA)** entre Spinos e cada cliente, aceito nos Termos.
- **Prospecção por IA** (empresas e decisores encontrados em fontes públicas): hoje a política diz legítimo interesse; manter, com o direito de oposição já descrito.

## 3. Texto proposto (substitui ou acrescenta)

**Seção 1, dados que coletamos, acrescentar:**
> **Dados de contatos e leads dos nossos clientes:** quando o cliente usa o CRM, o site ou o e-mail do Spinos, nome, e-mail, telefone, empresa, mensagens e a origem do contato (página, campanha, anúncio) passam a ser guardados na conta do cliente. Nesse caso o cliente decide a finalidade e a base legal, e o Spinos atua como operador, tratando os dados apenas para prestar o serviço contratado.

**Seção 1, cookies, substituir:**
> **Cookies e medição:** no aplicativo usamos apenas cookies estritamente necessários (sessão e autenticação). Os sites criados no Spinos medem visitas e cliques com um contador próprio, sem cookies e sem guardar dados pessoais (o visitante é representado por um identificador diário anônimo). Ferramentas de terceiros (por exemplo Google Analytics e Meta Pixel) só são carregadas no site de um cliente se ele as ativar, e somente depois do consentimento do visitante.

**Seção 2, acrescentar:**
> - Hospedar o site e as páginas de captação do cliente e entregar os contatos recebidos ao CRM dele;
> - Enviar campanhas de e-mail em nome do cliente, somente a contatos com consentimento ou relação contratual registrados, sempre com link de descadastro;
> - Gerar relatórios de origem, custo e desempenho.

**Seção 3, substituir:**
> Parte do processamento (scores, resumos de empresas, sugestões de abordagem e rascunhos de textos de marketing) usa modelos de linguagem de terceiros. As saídas são **sugestões e rascunhos**, sujeitos a imprecisão. Nenhum texto é publicado ou enviado sem que o usuário o revise e aprove. O usuário é responsável pelo conteúdo que decidir usar, inclusive quanto às normas do seu conselho profissional.

**Seção 4, tabela de operadores:** trocar a linha do Resend por "Envio de e-mails do sistema e das campanhas dos clientes" e acrescentar uma linha: "Vercel: também hospeda os sites dos clientes".

**Seção 6, retenção, acrescentar:**
> | Dado | Prazo |
> |---|---|
> | Conta e dados do cliente | enquanto a conta estiver ativa e até 180 dias depois do cancelamento |
> | Visitas e cliques dos sites (anônimos) | 14 meses |
> | Endereço de destinatário de campanhas | 24 meses; depois só os números agregados |
> | Rascunhos de conteúdo descartados | 90 dias |
> | Lista de descadastro | enquanto a conta existir (é o que impede reenvio) |

**Seção 8, direitos, acrescentar:**
> Para dados de contatos e leads de um cliente do Spinos, o pedido deve ser feito ao próprio cliente, que usa as ferramentas do Spinos para atender (exportar os dados da pessoa, anonimizá-la, descadastrá-la). Se preferir, escreva para contato@spinos.com.br e encaminharemos ao cliente responsável.

## 4. Termos de Uso: pontos a incluir

1. Aceite do aditivo de tratamento de dados (papéis acima).
2. O cliente declara ter base legal para os contatos que importa ou coleta, e que usará o e-mail só para quem consentiu ou é cliente.
3. O conteúdo gerado por IA é rascunho; o cliente responde pelo que publica e pela conformidade com seu conselho profissional (ex.: NBC PG 01 para contadores).
4. Limites de uso por plano (buscas, conteúdo, e-mails) e suspensão do envio em caso de reclamações ou abuso.
5. O Spinos pode pausar o envio de e-mails e tirar um site do ar se houver indício de fraude, spam ou conteúdo ilícito.
6. Condições comerciais (tabela de planos de 2026-11-16): implantação de R$ 1.500, paga uma vez, na primeira assinatura; fidelidade mínima de 6 meses (o Stripe não impede o cancelamento antes, então a cláusula precisa prever multa ou saldo devido e como o cliente pede o cancelamento); preço mensal por plano (Essencial R$ 997, Crescimento R$ 1.997, Aceleração R$ 3.497).
7. A promessa de volume é "contas-alvo por mês" (100, 300 e 1.000), contadas por mês de calendário, sem acúmulo. Definir no contrato o que acontece com a franquia não usada e com o intervalo mínimo entre buscas por plano.
8. Verba de mídia (Google Ads, Meta Ads) é paga direto pelo cliente às plataformas. Gestão de anúncios e conteúdo para redes sociais fazem parte do Aceleração e podem ser contratados à parte nos outros planos: definir escopo e preço desse serviço fora da assinatura.
9. Preço de fundador (10 primeiros clientes: sem implantação e preço travado por 12 meses), se mantido: registrar a condição no contrato de cada um, já que o sistema ainda não a controla.

## 5. O que o produto já faz (para o advogado conferir)

- Base legal registrada por contato; só consentimento ou contrato recebe campanha.
- Descadastro de um clique (cabeçalho List-Unsubscribe) e por página com confirmação; endereço, erro de entrega e reclamação entram numa lista de supressão por organização.
- Anonimização de pessoa (contato, observações e endereço nos e-mails enviados) e exportação dos dados de uma pessoa, ambas com registro de auditoria.
- Exportação completa dos dados da conta e solicitação de exclusão da organização (com confirmação manual).
- Retenção automática diária (prazos da seção 3).
- Isolamento entre clientes por organização no banco (RLS).
- Site novo nasce fora do Google. O formulário de contato registra a base **interesse legítimo** (responder a quem escreveu); só a inscrição com caixa de consentimento marcada registra **consentimento**, e só consentimento ou contrato permite campanha.
