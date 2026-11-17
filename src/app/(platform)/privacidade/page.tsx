import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Política de Privacidade — Spinos",
};

export default function PrivacidadePage() {
  return (
    <LegalPageLayout title="Política de Privacidade" updatedAt="17 de novembro de 2026">
      <section>
        <p>
          Esta Política de Privacidade descreve como a <strong>Everest Consultoria e Marketing Ltda.</strong> (CNPJ
          20.055.110/0001-68), com sede na Avenida Reynaldo de Porcari, 2433, Sala 9, Medeiros, Jundiaí-SP, doravante{" "}
          <strong>&quot;Spinos&quot;</strong>, <strong>&quot;nós&quot;</strong> ou <strong>&quot;Controlador&quot;</strong>, coleta, usa,
          compartilha e protege dados pessoais no âmbito da plataforma Spinos — Inteligência Comercial
          (spinos.com.br e app.spinos.com.br).
        </p>
        <p>
          Esta política se aplica a usuários da plataforma, visitantes do site institucional e a terceiros
          mencionados na plataforma (contatos e decisores de empresas monitoradas pelos nossos clientes — ver a
          seção específica abaixo).
        </p>
        <p>
          A Spinos é uma plataforma B2B que reúne inteligência comercial, CRM, sites e páginas de captação,
          relatórios, conteúdo e e-mail para empresas. Não somos um data broker e não comercializamos bases de dados
          pessoais para terceiros.
        </p>
        <p>
          <strong>Papéis no tratamento:</strong> sobre os dados dos usuários da plataforma (cadastro, cobrança) a
          Spinos é <strong>controladora</strong>. Sobre os dados dos contatos e leads dos nossos clientes (quem preenche
          o formulário do site de um cliente, quem recebe uma campanha, contatos do CRM do cliente) o{" "}
          <strong>cliente é o controlador</strong> e a Spinos atua como <strong>operadora</strong>, tratando esses
          dados apenas conforme as instruções do cliente e para prestar o serviço contratado.
        </p>
      </section>

      <section>
        <h2>1. Quais dados coletamos</h2>
        <p>
          <strong>Dados de cadastro e conta:</strong> nome, e-mail, senha (armazenada de forma criptografada),
          organização/empresa a que pertence, cargo, quando informado.
        </p>
        <p>
          <strong>Dados de perfil comercial (ICP):</strong> produtos/serviços vendidos, ticket médio, ciclo de
          vendas, modelo de venda, setor e porte de empresa-alvo. Descrevem o negócio do cliente, não pessoas
          físicas.
        </p>
        <p>
          <strong>Dados de empresas-alvo e de decisores:</strong> a Spinos organiza sinais públicos de mercado sobre
          empresas terceiras (contratações, investimentos, notícias) para identificar oportunidades comerciais — em
          sua maioria, dado de pessoa jurídica, fora do escopo da LGPD. Quando a plataforma identifica, ou o próprio
          usuário insere, nome, e-mail ou telefone de uma pessoa física decisora em uma empresa-alvo, isso constitui
          dado pessoal de terceiro, tratado com base em legítimo interesse (art. 7º, IX, LGPD) e obtido
          exclusivamente de fontes públicas e profissionais. Qualquer pessoa nessa situação pode solicitar
          informação, correção ou remoção desses dados a qualquer momento, pelo canal indicado na seção 9, sem
          necessidade de ser usuária da Spinos.
        </p>
        <p>
          <strong>Dados de contatos e leads dos nossos clientes:</strong> quando o cliente usa o CRM, o site ou o
          e-mail da Spinos, nome, e-mail, telefone, empresa, mensagens e a origem do contato (página, campanha,
          anúncio) passam a ser guardados na conta do cliente. Nesse caso o cliente decide a finalidade e a base
          legal, e a Spinos atua como operadora, tratando os dados apenas para prestar o serviço contratado.
        </p>
        <p>
          <strong>Dados de pagamento:</strong> processados diretamente pela Stripe, nosso processador de pagamentos.
          Não armazenamos número de cartão de crédito em nossos servidores.
        </p>
        <p>
          <strong>Cookies e medição:</strong> no aplicativo usamos apenas cookies estritamente necessários
          (sessão e autenticação). Os sites criados na Spinos medem visitas e cliques com um contador próprio, sem
          cookies e sem guardar dados pessoais (o visitante é representado por um identificador diário anônimo).
          Ferramentas de terceiros (por exemplo Google Analytics e Meta Pixel) só são carregadas no site de um
          cliente se ele as ativar, e somente depois do consentimento do visitante.
        </p>
      </section>

      <section>
        <h2>2. Para que usamos os dados</h2>
        <ul>
          <li>Viabilizar criação de conta, login e uso da plataforma;</li>
          <li>
            Gerar o Spinos Score e recomendações de oportunidades a partir do cruzamento de sinais públicos com o
            ICP do cliente;
          </li>
          <li>Processar cobrança e gestão de assinatura;</li>
          <li>
            Enviar comunicações transacionais (confirmação de cadastro, redefinição de senha, convites de equipe);
          </li>
          <li>Hospedar o site e as páginas de captação do cliente e entregar os contatos recebidos ao CRM dele;</li>
          <li>
            Enviar campanhas de e-mail em nome do cliente, somente a contatos com consentimento ou relação
            contratual registrados, sempre com link de descadastro;
          </li>
          <li>Gerar relatórios de origem, custo e desempenho;</li>
          <li>Suporte ao cliente;</li>
          <li>Cumprimento de obrigações legais e defesa em processos administrativos ou judiciais.</li>
        </ul>
        <p>
          Não utilizamos dados pessoais para tomada de decisão automatizada que produza efeitos jurídicos sobre o
          titular sem possibilidade de revisão humana.
        </p>
      </section>

      <section>
        <h2>3. Uso de Inteligência Artificial</h2>
        <p>
          Parte do processamento (scores, resumos de empresas, sugestões de abordagem, o assistente de chat e
          rascunhos de textos de marketing) usa modelos de linguagem de terceiros. As saídas são{" "}
          <strong>sugestões e rascunhos</strong>, sujeitos a imprecisão. Nenhum texto é publicado ou enviado sem que
          o usuário o revise e aprove. O usuário é responsável pelo conteúdo que decidir usar, inclusive quanto às
          normas do seu conselho profissional.
        </p>
      </section>

      <section>
        <h2>4. Com quem compartilhamos dados</h2>
        <p>Utilizamos os seguintes operadores para viabilizar o serviço:</p>
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Finalidade</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Anthropic</td>
              <td>Processamento de IA (scores, chat, sugestões)</td>
            </tr>
            <tr>
              <td>Supabase</td>
              <td>Banco de dados e autenticação</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Hospedagem da aplicação e dos sites dos clientes</td>
            </tr>
            <tr>
              <td>Resend</td>
              <td>Envio de e-mails do sistema e das campanhas dos clientes</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Processamento de pagamentos e cobrança recorrente</td>
            </tr>
          </tbody>
        </table>
        <p>Não vendemos, alugamos ou comercializamos dados pessoais a terceiros para fins de marketing de terceiros.</p>
      </section>

      <section>
        <h2>5. Transferência internacional de dados</h2>
        <p>
          Alguns dos fornecedores acima podem processar dados em servidores localizados fora do Brasil, incluindo
          Estados Unidos. Essa transferência ocorre com base em cláusulas contratuais e nos padrões de proteção de
          dados exigidos desses fornecedores, nos termos do art. 33 da Lei Geral de Proteção de Dados (LGPD).
        </p>
      </section>

      <section>
        <h2>6. Retenção e eliminação de dados</h2>
        <p>
          Mantemos os dados enquanto a conta permanecer ativa e por até 180 (cento e oitenta) dias após o
          cancelamento, para fins de suporte, auditoria e cumprimento de obrigações legais, fiscais e regulatórias.
          Encerrado esse prazo, os dados pessoais são eliminados ou anonimizados, ressalvado o que a legislação
          aplicável exigir manter por prazo diverso. Prazos por tipo de dado:
        </p>
        <table>
          <thead>
            <tr>
              <th>Dado</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Conta e dados do cliente</td>
              <td>Enquanto a conta estiver ativa e até 180 dias depois do cancelamento</td>
            </tr>
            <tr>
              <td>Visitas e cliques dos sites (anônimos)</td>
              <td>14 meses</td>
            </tr>
            <tr>
              <td>Endereço de destinatário de campanhas</td>
              <td>24 meses; depois, apenas números agregados</td>
            </tr>
            <tr>
              <td>Rascunhos de conteúdo descartados</td>
              <td>90 dias</td>
            </tr>
            <tr>
              <td>Lista de descadastro</td>
              <td>Enquanto a conta existir (é o que impede o reenvio)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>7. Segurança da informação</h2>
        <p>
          Adotamos medidas técnicas e administrativas para proteger os dados pessoais, incluindo controle de acesso
          por organização (isolamento entre clientes), autenticação segura e políticas de segurança em nível de
          banco de dados. Em caso de incidente de segurança que gere risco relevante aos titulares, seguiremos os
          procedimentos de notificação previstos na LGPD.
        </p>
      </section>

      <section>
        <h2>8. Seus direitos como titular de dados</h2>
        <p>
          Nos termos do art. 18 da LGPD, você pode solicitar, a qualquer momento: confirmação da existência de
          tratamento; acesso aos dados; correção de dados incompletos ou desatualizados; anonimização, bloqueio ou
          eliminação de dados desnecessários; portabilidade; informação sobre compartilhamento; e revogação de
          consentimento, quando aplicável.
        </p>
        <p>
          Para dados de contatos e leads de um cliente da Spinos, o pedido deve ser feito ao próprio cliente, que usa
          as ferramentas da Spinos para atender (exportar os dados da pessoa, anonimizá-la, descadastrá-la). Se
          preferir, escreva para o canal da seção 9 e encaminharemos ao cliente responsável.
        </p>
      </section>

      <section>
        <h2>9. Encarregado de Dados e canal de contato</h2>
        <p>
          Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato pelo e-mail{" "}
          <a href="mailto:contato@spinos.com.br" style={{ color: "var(--primary)" }}>
            contato@spinos.com.br
          </a>
          .
        </p>
      </section>

      <section>
        <h2>10. Crianças e adolescentes</h2>
        <p>
          A Spinos é uma plataforma B2B destinada a uso profissional por maiores de 18 anos. Não coletamos
          intencionalmente dados de crianças ou adolescentes.
        </p>
      </section>

      <section>
        <h2>11. Alterações desta política</h2>
        <p>
          Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas por e-mail ou
          aviso na plataforma antes de entrarem em vigor.
        </p>
      </section>

      <section>
        <h2>12. Legislação aplicável e foro</h2>
        <p>
          Esta política é regida pelas leis da República Federativa do Brasil, em especial a Lei nº 13.709/2018
          (LGPD). Fica eleito o foro da comarca de Jundiaí-SP para dirimir eventuais controvérsias.
        </p>
      </section>
    </LegalPageLayout>
  );
}
